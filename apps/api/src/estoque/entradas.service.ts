import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { margemEfetiva, margemReal } from '../common/precificacao.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { ProdutosService } from '../produtos/produtos.service.ts';
import { custoMedio, custoMedioAposEstorno, ratear, valorDe } from './calculos.ts';
import type { DadosEntrada } from './estoque.schemas.ts';
import { exigirInteiro, movimentar } from './movimentacao.ts';

export const POR_PAGINA_ENTRADAS = 30;

@Injectable()
export class EntradasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly produtos: ProdutosService,
  ) {}

  listar(fornecedorId: number | undefined, pagina: number) {
    const where = fornecedorId ? { fornecedorId } : {};
    return this.prisma.$transaction([
      this.prisma.entrada.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (pagina - 1) * POR_PAGINA_ENTRADAS,
        take: POR_PAGINA_ENTRADAS,
        include: {
          fornecedor: { select: { razaoSocial: true, nomeFantasia: true } },
          usuario: { select: { nome: true } },
          _count: { select: { itens: true } },
        },
      }),
      this.prisma.entrada.count({ where }),
    ]);
  }

  async obter(id: number) {
    const e = await this.prisma.entrada.findUnique({
      where: { id },
      include: {
        fornecedor: { select: { id: true, razaoSocial: true, nomeFantasia: true, documento: true } },
        usuario: { select: { nome: true } },
        canceladaPor: { select: { nome: true } },
        itens: {
          orderBy: { id: 'asc' },
          include: {
            unidade: { select: { sigla: true } },
            produto: { select: { id: true, codigo: true, descricao: true, precoVenda: true, unidade: { select: { sigla: true } } } },
          },
        },
      },
    });
    if (!e) throw new NotFoundException('Entrada não encontrada.');
    return e;
  }

  async criar(d: DadosEntrada, usuarioId: number) {
    if (d.fornecedorId && !(await this.prisma.fornecedor.findUnique({ where: { id: d.fornecedorId } }))) {
      throw new BadRequestException('Fornecedor não encontrado.');
    }

    // 1) Converte cada item para a unidade de venda e calcula valores.
    const preparados: (DadosEntrada['itens'][number] & { fator: number; quantidadeEstoque: number; valor: number })[] = [];
    for (const [i, item] of d.itens.entries()) {
      const p = await this.prisma.produto.findUnique({ where: { id: item.produtoId }, include: { unidade: true, conversoes: true } });
      if (!p) throw new BadRequestException(`Item ${i + 1}: produto não encontrado.`);
      if (!p.ativo) throw new BadRequestException(`"${p.descricao}" está inativo.`);
      const fator = item.unidadeId === p.unidadeId ? 1000 : p.conversoes.find((c) => c.unidadeId === item.unidadeId)?.fator;
      if (!fator) throw new BadRequestException(`"${p.descricao}" não tem conversão cadastrada para essa unidade de compra.`);
      const unidadeCompra = await this.prisma.unidade.findUniqueOrThrow({ where: { id: item.unidadeId } });
      exigirInteiro(item.quantidade, unidadeCompra, p.descricao);
      const quantidadeEstoque = Math.round((item.quantidade * fator) / 1000);
      exigirInteiro(quantidadeEstoque, p.unidade, p.descricao);
      preparados.push({ ...item, fator, quantidadeEstoque, valor: valorDe(item.quantidade, item.custoUnitario) });
    }

    const totalProdutos = preparados.reduce((a, x) => a + x.valor, 0);
    const extra = d.frete + d.outrasDespesas - d.desconto;
    if (totalProdutos + extra < 0) throw new BadRequestException('O desconto é maior que o total da nota.');
    const rateio = ratear(preparados.map((x) => x.valor), extra);

    // 2) Grava tudo numa única transação: ou entra a nota inteira, ou nada.
    const entradaId = await this.prisma.$transaction(async (tx) => {
      const entrada = await tx.entrada.create({
        data: {
          fornecedorId: d.fornecedorId, numeroNota: d.numeroNota, dataEmissao: d.dataEmissao,
          frete: d.frete, outrasDespesas: d.outrasDespesas, desconto: d.desconto, observacoes: d.observacoes,
          totalProdutos, totalNota: totalProdutos + extra, usuarioId,
        },
      });
      const motivo = `Entrada nº ${entrada.id}${d.numeroNota ? ` (NF ${d.numeroNota})` : ''}`;

      for (const [i, x] of preparados.entries()) {
        const custoTotal = x.valor + rateio[i];
        const custoUnitarioEstoque = Math.round((custoTotal * 1000) / x.quantidadeEstoque);
        const antes = await tx.produto.findUniqueOrThrow({ where: { id: x.produtoId } });
        const novoCusto = custoMedio(antes.estoqueAtual, antes.custo, x.quantidadeEstoque, custoUnitarioEstoque);

        await movimentar(tx, {
          produtoId: x.produtoId, tipo: 'ENTRADA_COMPRA', quantidade: x.quantidadeEstoque,
          custoUnitario: custoUnitarioEstoque, motivo, usuarioId, entradaId: entrada.id, permitirNegativo: true,
        });
        await tx.entradaItem.create({
          data: {
            entradaId: entrada.id, produtoId: x.produtoId, unidadeId: x.unidadeId, fator: x.fator,
            quantidade: x.quantidade, custoUnitario: x.custoUnitario, quantidadeEstoque: x.quantidadeEstoque,
            custoTotal, custoMedioAntes: antes.custo, custoMedioDepois: novoCusto,
          },
        });
        if (novoCusto !== antes.custo) {
          await tx.produto.update({ where: { id: x.produtoId }, data: { custo: novoCusto } });
          await tx.historicoPreco.create({
            data: {
              produtoId: x.produtoId, custoAnterior: antes.custo, custoNovo: novoCusto,
              precoAnterior: antes.precoVenda, precoNovo: antes.precoVenda, motivo, usuarioId,
            },
          });
        }
        if (d.fornecedorId) {
          await tx.produtoFornecedor.upsert({
            where: { produtoId_fornecedorId: { produtoId: x.produtoId, fornecedorId: d.fornecedorId } },
            create: { produtoId: x.produtoId, fornecedorId: d.fornecedorId },
            update: {},
          });
        }
      }
      return entrada.id;
    });

    return { entrada: await this.obter(entradaId), alertasMargem: await this.alertasMargem(preparados.map((x) => x.produtoId)) };
  }

  /** Produtos que, com o novo custo, ficaram abaixo da margem desejada. */
  private async alertasMargem(ids: number[]) {
    const par = await this.produtos.parametros();
    const lista = await this.prisma.produto.findMany({ where: { id: { in: ids } }, include: { categoria: { select: { margemPct: true } } } });
    return lista
      .map((p) => ({
        id: p.id, codigo: p.codigo, descricao: p.descricao, custo: p.custo, precoVenda: p.precoVenda,
        margemDesejada: margemEfetiva(p.margemPct, p.categoria?.margemPct, par.margemPadraoPct),
        margemReal: margemReal(p.custo, p.precoVenda, par),
      }))
      .filter((p) => p.margemReal === null || p.margemReal < p.margemDesejada - 50);
  }

  /** Estorna a entrada: retira as quantidades e desfaz o efeito no custo médio. */
  async cancelar(id: number, motivo: string, usuarioId: number) {
    const entrada = await this.obter(id);
    if (entrada.status === 'CANCELADA') throw new BadRequestException('Esta entrada já foi cancelada.');

    await this.prisma.$transaction(async (tx) => {
      const texto = `Cancelamento da entrada nº ${id}: ${motivo}`;
      for (const item of [...entrada.itens].reverse()) {
        const antes = await tx.produto.findUniqueOrThrow({ where: { id: item.produtoId } });
        await movimentar(tx, {
          produtoId: item.produtoId, tipo: 'ESTORNO_COMPRA', quantidade: -item.quantidadeEstoque,
          custoUnitario: Math.round((item.custoTotal * 1000) / item.quantidadeEstoque), motivo: texto, usuarioId, entradaId: id,
        });
        const novoCusto = custoMedioAposEstorno(antes.estoqueAtual, antes.custo, item.quantidadeEstoque, item.custoTotal, item.custoMedioAntes);
        if (novoCusto !== antes.custo) {
          await tx.produto.update({ where: { id: item.produtoId }, data: { custo: novoCusto } });
          await tx.historicoPreco.create({
            data: {
              produtoId: item.produtoId, custoAnterior: antes.custo, custoNovo: novoCusto,
              precoAnterior: antes.precoVenda, precoNovo: antes.precoVenda, motivo: texto, usuarioId,
            },
          });
        }
      }
      await tx.entrada.update({
        where: { id },
        data: { status: 'CANCELADA', canceladaEm: new Date(), canceladaPorId: usuarioId, motivoCancelamento: motivo },
      });
    });
    return this.obter(id);
  }
}
