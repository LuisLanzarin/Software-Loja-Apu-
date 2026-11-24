import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import type { DadosAjuste, DadosInventario } from './estoque.schemas.ts';
import { exigirInteiro, movimentar } from './movimentacao.ts';

export const POR_PAGINA_MOV = 50;

@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  async resumo() {
    const p = this.prisma.produto;
    const [ativos, abaixoMinimo, semEstoque, valor] = await Promise.all([
      p.count({ where: { ativo: true } }),
      p.count({ where: { ativo: true, estoqueMinimo: { gt: 0 }, estoqueAtual: { lt: p.fields.estoqueMinimo } } }),
      p.count({ where: { ativo: true, estoqueAtual: { lte: 0 } } }),
      this.prisma.$queryRaw<{ v: number | bigint | null }[]>`
        SELECT SUM("estoqueAtual" * "custo") AS v FROM "Produto" WHERE "ativo" = 1 AND "estoqueAtual" > 0`,
    ]);
    return { ativos, abaixoMinimo, semEstoque, valorEstoque: Math.round(Number(valor[0]?.v ?? 0) / 1000) };
  }

  async movimentacoes(produtoId: number | undefined, pagina: number) {
    const where = produtoId ? { produtoId } : {};
    const [itens, total] = await this.prisma.$transaction([
      this.prisma.movimentacaoEstoque.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (pagina - 1) * POR_PAGINA_MOV,
        take: POR_PAGINA_MOV,
        include: {
          usuario: { select: { nome: true } },
          produto: { select: { codigo: true, descricao: true, unidade: { select: { sigla: true } } } },
          entrada: { select: { id: true, numeroNota: true } },
        },
      }),
      this.prisma.movimentacaoEstoque.count({ where }),
    ]);
    return { itens, total, pagina, porPagina: POR_PAGINA_MOV };
  }

  async ajustar(d: DadosAjuste, usuarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      const produto = await tx.produto.findUnique({ where: { id: d.produtoId }, include: { unidade: true } });
      if (!produto) throw new NotFoundException('Produto não encontrado.');
      exigirInteiro(d.quantidade, produto.unidade, produto.descricao);
      const sinal = d.tipo === 'AJUSTE_ENTRADA' ? 1 : -1;
      const p = await movimentar(tx, { produtoId: d.produtoId, tipo: d.tipo, quantidade: sinal * d.quantidade, motivo: d.motivo, usuarioId });
      return { produto: { id: p.id, descricao: p.descricao, codigo: p.codigo }, saldoAntes: produto.estoqueAtual, saldoDepois: p.estoqueAtual };
    });
  }

  /** Grava a contagem física: cada diferença vira uma movimentação de INVENTÁRIO. */
  async inventariar(d: DadosInventario, usuarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      const diferencas: { produtoId: number; codigo: string; descricao: string; sistema: number; contado: number; diferenca: number; valor: number }[] = [];
      for (const item of d.itens) {
        const produto = await tx.produto.findUnique({ where: { id: item.produtoId }, include: { unidade: true } });
        if (!produto) throw new NotFoundException(`Produto ${item.produtoId} não encontrado.`);
        exigirInteiro(item.contado, produto.unidade, produto.descricao);
        const diferenca = item.contado - produto.estoqueAtual;
        if (diferenca === 0) continue;
        await movimentar(tx, {
          produtoId: produto.id,
          tipo: 'INVENTARIO',
          quantidade: diferenca,
          motivo: d.observacao ? `Inventário: ${d.observacao}` : 'Inventário (contagem física)',
          usuarioId,
        });
        diferencas.push({
          produtoId: produto.id, codigo: produto.codigo, descricao: produto.descricao,
          sistema: produto.estoqueAtual, contado: item.contado, diferenca,
          valor: Math.round((diferenca * produto.custo) / 1000),
        });
      }
      return { contados: d.itens.length, diferencas, valorDiferenca: diferencas.reduce((a, x) => a + x.valor, 0) };
    });
  }
}
