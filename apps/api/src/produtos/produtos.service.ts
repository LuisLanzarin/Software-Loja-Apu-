import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { margemEfetiva, margemReal, precoSugerido, type ParametrosPreco } from '../common/precificacao.ts';
import { normalizarBusca } from '../common/texto.ts';
import { ConfiguracaoService } from '../configuracao/configuracao.service.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { TIPOS_REAJUSTE, type DadosProduto, type DadosReajuste, type FiltroProdutos } from './produtos.schemas.ts';

export const POR_PAGINA = 50;

/** Campos que só quem tem "produto.ver_custo" pode ver. */
const CAMPOS_RESTRITOS = ['custo', 'margemPct', 'margemEfetiva', 'precoSugerido', 'margemReal', 'fornecedores'] as const;

type Calculos = { margemEfetiva: number; precoSugerido: number | null; margemReal: number | null };

@Injectable()
export class ProdutosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracaoService,
  ) {}

  async parametros(): Promise<ParametrosPreco & { margemPadraoPct: number }> {
    const c = await this.config.obter();
    return { impostosPct: c.impostosPct, despesasFixasPct: c.despesasFixasPct, comissaoPct: c.comissaoPct, margemPadraoPct: c.margemPadraoPct };
  }

  private calcular(
    p: { custo: number; precoVenda: number; margemPct: number | null; categoria?: { margemPct: number | null } | null },
    par: ParametrosPreco & { margemPadraoPct: number },
  ): Calculos {
    const margem = margemEfetiva(p.margemPct, p.categoria?.margemPct, par.margemPadraoPct);
    return { margemEfetiva: margem, precoSugerido: precoSugerido(p.custo, margem, par), margemReal: margemReal(p.custo, p.precoVenda, par) };
  }

  /** Acrescenta os cálculos de preço e remove o que o usuário não pode ver. */
  async apresentar<T extends { custo: number; precoVenda: number; margemPct: number | null; categoria?: { margemPct: number | null } | null }>(
    produtos: T[],
    verCusto: boolean,
  ) {
    const par = await this.parametros();
    return produtos.map((p) => {
      const completo: Record<string, unknown> = { ...p, ...this.calcular(p, par) };
      if (!verCusto) for (const c of CAMPOS_RESTRITOS) delete completo[c];
      return completo;
    });
  }

  async listar(f: FiltroProdutos) {
    const where: Prisma.ProdutoWhereInput = {
      ...(f.situacao === 'todos' ? {} : { ativo: f.situacao === 'ativos' }),
      ...(f.categoriaId ? { categoriaId: f.categoriaId } : {}),
      ...(f.fornecedorId ? { fornecedores: { some: { fornecedorId: f.fornecedorId } } } : {}),
    };
    const q = f.q?.trim();
    if (q) {
      // Cada palavra precisa aparecer na descrição ("cim 50" acha "Cimento CP-II 50kg"),
      // ou o texto é exatamente o código interno / código de barras.
      const palavras = normalizarBusca(q).split(' ');
      where.OR = [
        { AND: palavras.map((w) => ({ descricaoBusca: { contains: w } })) },
        { codigo: q },
        { codigoBarras: q },
        { marca: { contains: q } },
      ];
    }
    const [itens, total] = await this.prisma.$transaction([
      this.prisma.produto.findMany({
        where,
        orderBy: { descricao: 'asc' },
        skip: (f.pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        include: { categoria: { select: { nome: true, margemPct: true } }, unidade: { select: { sigla: true, fracionavel: true } } },
      }),
      this.prisma.produto.count({ where }),
    ]);
    return { itens, total };
  }

  async obter(id: number) {
    const p = await this.prisma.produto.findUnique({
      where: { id },
      include: {
        categoria: { select: { id: true, nome: true, margemPct: true } },
        unidade: true,
        conversoes: { include: { unidade: true }, orderBy: { id: 'asc' } },
        fornecedores: { include: { fornecedor: { select: { id: true, razaoSocial: true, nomeFantasia: true } } } },
      },
    });
    if (!p) throw new NotFoundException('Produto não encontrado.');
    return p;
  }

  historico(produtoId: number) {
    return this.prisma.historicoPreco.findMany({
      where: { produtoId },
      orderBy: { id: 'desc' },
      take: 50,
      include: { usuario: { select: { nome: true } } },
    });
  }

  async salvar(id: number | null, d: DadosProduto, usuarioId: number) {
    const atual = id ? await this.obter(id) : null;
    await this.validar(id, d);

    const { conversoes, fornecedores, ...campos } = d;
    const dados = { ...campos, codigo: campos.codigo ?? atual?.codigo ?? `tmp-${Date.now()}-${Math.random()}`, descricaoBusca: normalizarBusca(d.descricao) };

    const produto = await this.prisma.$transaction(async (tx) => {
      const p = atual
        ? await tx.produto.update({ where: { id: atual.id }, data: dados })
        : await tx.produto.create({ data: dados });

      if (!campos.codigo && !atual) {
        // Código automático: 000001, 000002… (pula se alguém já usou o número manualmente)
        let codigo = String(p.id).padStart(6, '0');
        if (await tx.produto.findUnique({ where: { codigo } })) codigo = `P${codigo}`;
        await tx.produto.update({ where: { id: p.id }, data: { codigo } });
      }

      await tx.produtoConversao.deleteMany({ where: { produtoId: p.id } });
      if (conversoes.length) await tx.produtoConversao.createMany({ data: conversoes.map((c) => ({ ...c, produtoId: p.id })) });
      await tx.produtoFornecedor.deleteMany({ where: { produtoId: p.id } });
      if (fornecedores.length) await tx.produtoFornecedor.createMany({ data: fornecedores.map((f) => ({ ...f, produtoId: p.id })) });

      if (!atual || atual.custo !== d.custo || atual.precoVenda !== d.precoVenda) {
        await tx.historicoPreco.create({
          data: {
            produtoId: p.id,
            custoAnterior: atual?.custo ?? 0,
            custoNovo: d.custo,
            precoAnterior: atual?.precoVenda ?? 0,
            precoNovo: d.precoVenda,
            motivo: atual ? 'Alteração no cadastro' : 'Cadastro do produto',
            usuarioId,
          },
        });
      }
      return p;
    });
    return { antes: atual, depois: await this.obter(produto.id) };
  }

  private async validar(id: number | null, d: DadosProduto) {
    const unidade = await this.prisma.unidade.findUnique({ where: { id: d.unidadeId } });
    if (!unidade) throw new BadRequestException('Unidade de venda não encontrada.');
    if (!unidade.fracionavel && d.estoqueMinimo % 1000 !== 0) {
      throw new BadRequestException(`O estoque mínimo deve ser um número inteiro de ${unidade.sigla}.`);
    }
    if (d.categoriaId && !(await this.prisma.categoria.findUnique({ where: { id: d.categoriaId } }))) {
      throw new BadRequestException('Categoria não encontrada.');
    }

    const unidadesConv = d.conversoes.map((c) => c.unidadeId);
    if (unidadesConv.includes(d.unidadeId)) throw new BadRequestException('A unidade de compra deve ser diferente da unidade de venda.');
    if (new Set(unidadesConv).size !== unidadesConv.length) throw new BadRequestException('Há unidades de compra repetidas.');
    if (unidadesConv.length && (await this.prisma.unidade.count({ where: { id: { in: unidadesConv } } })) !== unidadesConv.length) {
      throw new BadRequestException('Unidade de compra não encontrada.');
    }

    const forn = d.fornecedores.map((f) => f.fornecedorId);
    if (new Set(forn).size !== forn.length) throw new BadRequestException('Há fornecedores repetidos.');
    if (forn.length && (await this.prisma.fornecedor.count({ where: { id: { in: forn } } })) !== forn.length) {
      throw new BadRequestException('Fornecedor não encontrado.');
    }

    for (const [campo, valor, nome] of [
      ['codigo', d.codigo, 'código'],
      ['codigoBarras', d.codigoBarras, 'código de barras'],
    ] as const) {
      if (!valor) continue;
      const outro = await this.prisma.produto.findFirst({ where: { [campo]: valor, ...(id ? { id: { not: id } } : {}) } });
      if (outro) throw new ConflictException(`Este ${nome} já é usado em "${outro.descricao}".`);
    }
  }

  /** Calcula (e opcionalmente grava) um reajuste de preços em lote. */
  async reajustar(r: DadosReajuste, aplicar: boolean, usuarioId: number) {
    const par = await this.parametros();
    const produtos = await this.prisma.produto.findMany({
      where: {
        ativo: true,
        ...(r.categoriaId ? { categoriaId: r.categoriaId } : {}),
        ...(r.fornecedorId ? { fornecedores: { some: { fornecedorId: r.fornecedorId } } } : {}),
      },
      include: { categoria: { select: { margemPct: true } } },
      orderBy: { descricao: 'asc' },
    });

    const fator = 10000 + (r.percentual ?? 0);
    const itens: { id: number; codigo: string; descricao: string; custoAntes: number; custoDepois: number; precoAntes: number; precoDepois: number }[] = [];
    let ignorados = 0;

    for (const p of produtos) {
      let custo = p.custo;
      let preco: number | null = p.precoVenda;
      const margem = margemEfetiva(p.margemPct, p.categoria?.margemPct, par.margemPadraoPct);
      const aplicarFator = (v: number) => Math.round((v * fator) / 10000);
      if (r.tipo === 'CUSTO_PERCENTUAL' || r.tipo === 'CUSTO_PERCENTUAL_SUGERIDO') custo = aplicarFator(p.custo);
      if (r.tipo === 'CUSTO_PERCENTUAL' || r.tipo === 'PRECO_PERCENTUAL') preco = aplicarFator(p.precoVenda);
      if (r.tipo === 'CUSTO_PERCENTUAL_SUGERIDO' || r.tipo === 'PRECO_SUGERIDO') preco = custo > 0 ? precoSugerido(custo, margem, par) : null;

      if (preco === null || preco <= 0) {
        ignorados++; // sem custo cadastrado ou percentuais somando 100%+
        continue;
      }
      if (preco === p.precoVenda && custo === p.custo) continue;
      itens.push({ id: p.id, codigo: p.codigo, descricao: p.descricao, custoAntes: p.custo, custoDepois: custo, precoAntes: p.precoVenda, precoDepois: preco });
    }

    if (aplicar && itens.length) {
      const motivo = `Reajuste em lote: ${TIPOS_REAJUSTE[r.tipo]}${r.percentual ? ` (${(r.percentual / 100).toLocaleString('pt-BR')}%)` : ''}`;
      await this.prisma.$transaction([
        ...itens.map((i) => this.prisma.produto.update({ where: { id: i.id }, data: { custo: i.custoDepois, precoVenda: i.precoDepois } })),
        this.prisma.historicoPreco.createMany({
          data: itens.map((i) => ({
            produtoId: i.id, custoAnterior: i.custoAntes, custoNovo: i.custoDepois,
            precoAnterior: i.precoAntes, precoNovo: i.precoDepois, motivo, usuarioId,
          })),
        }),
      ]);
    }
    return { itens, ignorados, totalAnalisados: produtos.length };
  }
}
