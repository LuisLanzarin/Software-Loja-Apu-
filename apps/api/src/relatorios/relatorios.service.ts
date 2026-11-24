import { BadRequestException, Injectable } from '@nestjs/common';
import { custosVariaveis } from '../common/precificacao.ts';
import { ConfiguracaoService } from '../configuracao/configuracao.service.ts';
import type { FormaPagamento } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { chaveDia, inicioDoPeriodo, intervalo, periodosEntre, rotulo, type Agrupamento } from './periodos.ts';

const custoItem = (i: { quantidade: number; custoUnitario: number }) => Math.round((i.quantidade * i.custoUnitario) / 1000);
const margem = (lucro: number, faturamento: number) => (faturamento > 0 ? Math.round((lucro * 10000) / faturamento) : null);

@Injectable()
export class RelatoriosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracaoService,
  ) {}

  private validar(de: string, ate: string) {
    const { inicio, fim } = intervalo(de, ate);
    if (fim < inicio) throw new BadRequestException('A data final é anterior à inicial.');
    if (fim.getTime() - inicio.getTime() > 400 * 864e5) throw new BadRequestException('Escolha um período de até 1 ano.');
    return { inicio, fim };
  }

  /** Fechamento por período: faturamento, custo, lucro bruto, formas de pagamento e vendedores. */
  async vendas(de: string, ate: string, agrupar: Agrupamento) {
    const { inicio, fim } = this.validar(de, ate);
    const cfg = await this.config.obter();
    const vendas = await this.prisma.venda.findMany({
      where: { status: 'FINALIZADA', finalizadaEm: { gte: inicio, lte: fim } },
      select: {
        id: true, finalizadaEm: true, total: true, subtotal: true, descontoItens: true, descontoGeral: true,
        vendedor: { select: { id: true, nome: true } },
        itens: { select: { quantidade: true, custoUnitario: true } },
        pagamentos: { select: { forma: true, valor: true } },
      },
    });

    type Linha = { quantidade: number; faturamento: number; descontos: number; custo: number };
    const vazio = (): Linha => ({ quantidade: 0, faturamento: 0, descontos: 0, custo: 0 });
    const periodos = new Map(periodosEntre(inicio, fim, agrupar).map((d) => [chaveDia(d), { inicio: d, ...vazio() }]));
    const vendedores = new Map<number, Linha & { nome: string }>();
    const formas = new Map<FormaPagamento, number>();
    const total = vazio();

    for (const v of vendas) {
      const custo = v.itens.reduce((a, i) => a + custoItem(i), 0);
      const descontos = v.descontoItens + v.descontoGeral;
      const somar = (l: Linha) => { l.quantidade++; l.faturamento += v.total; l.descontos += descontos; l.custo += custo; };
      const chave = chaveDia(inicioDoPeriodo(v.finalizadaEm!, agrupar));
      const p = periodos.get(chave) ?? { inicio: inicioDoPeriodo(v.finalizadaEm!, agrupar), ...vazio() };
      periodos.set(chave, p);
      somar(p);
      somar(total);
      const vend = vendedores.get(v.vendedor.id) ?? { nome: v.vendedor.nome, ...vazio() };
      vendedores.set(v.vendedor.id, vend);
      somar(vend);
      for (const pg of v.pagamentos) formas.set(pg.forma, (formas.get(pg.forma) ?? 0) + pg.valor);
    }

    const canceladas = await this.prisma.venda.aggregate({
      where: { status: 'CANCELADA', canceladaEm: { gte: inicio, lte: fim }, finalizadaEm: { not: null } },
      _count: true,
      _sum: { total: true },
    });

    const comLucro = <T extends Linha>(l: T) => {
      const lucro = l.faturamento - l.custo;
      return { ...l, lucroBruto: lucro, margemBruta: margem(lucro, l.faturamento), ticketMedio: l.quantidade ? Math.round(l.faturamento / l.quantidade) : 0 };
    };
    const pctVariaveis = custosVariaveis(cfg);
    const resumo = comLucro(total);

    return {
      periodo: { de, ate, agrupar },
      totais: {
        ...resumo,
        // Estimativa: tira do faturamento os impostos, despesas fixas e comissão da formação de preço.
        resultadoEstimado: Math.round(resumo.faturamento * (1 - pctVariaveis / 10000)) - resumo.custo,
        percentuaisUsados: pctVariaveis,
        canceladas: canceladas._count,
        valorCancelado: canceladas._sum.total ?? 0,
      },
      periodos: [...periodos.values()]
        .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
        .map((p) => ({ chave: chaveDia(p.inicio), rotulo: rotulo(p.inicio, agrupar), ...comLucro(p) })),
      formasPagamento: [...formas.entries()].map(([forma, valor]) => ({ forma, valor })).sort((a, b) => b.valor - a.valor),
      vendedores: [...vendedores.entries()].map(([id, v]) => ({ id, ...comLucro(v) })).sort((a, b) => b.faturamento - a.faturamento),
    };
  }

  /** Desempenho por produto com curva ABC (A = 80% do faturamento, B = até 95%, C = resto). */
  async produtos(de: string, ate: string, categoriaId?: number) {
    const { inicio, fim } = this.validar(de, ate);
    const itens = await this.prisma.vendaItem.findMany({
      where: {
        venda: { status: 'FINALIZADA', finalizadaEm: { gte: inicio, lte: fim } },
        ...(categoriaId ? { produto: { categoriaId } } : {}),
      },
      select: {
        quantidade: true, total: true, custoUnitario: true,
        venda: { select: { total: true, subtotal: true, descontoItens: true } },
        produto: { select: { id: true, codigo: true, descricao: true, unidade: { select: { sigla: true } }, categoria: { select: { id: true, nome: true } } } },
      },
    });

    type Acc = { quantidade: number; faturamento: number; custo: number };
    const porProduto = new Map<number, Acc & { codigo: string; descricao: string; unidade: string; categoria: string | null }>();
    const porCategoria = new Map<string, Acc>();
    for (const i of itens) {
      // Rateia o desconto dado na venda inteira entre os itens, para os totais baterem com o caixa.
      const liquidoItens = i.venda.subtotal - i.venda.descontoItens;
      const faturamento = liquidoItens > 0 ? Math.round((i.total * i.venda.total) / liquidoItens) : 0;
      const custo = custoItem(i);
      const p = porProduto.get(i.produto.id) ?? {
        codigo: i.produto.codigo, descricao: i.produto.descricao, unidade: i.produto.unidade.sigla,
        categoria: i.produto.categoria?.nome ?? null, quantidade: 0, faturamento: 0, custo: 0,
      };
      p.quantidade += i.quantidade; p.faturamento += faturamento; p.custo += custo;
      porProduto.set(i.produto.id, p);
      const nomeCat = i.produto.categoria?.nome ?? 'Sem categoria';
      const c = porCategoria.get(nomeCat) ?? { quantidade: 0, faturamento: 0, custo: 0 };
      c.faturamento += faturamento; c.custo += custo; c.quantidade++;
      porCategoria.set(nomeCat, c);
    }

    const totalFat = [...porProduto.values()].reduce((a, p) => a + p.faturamento, 0);
    let acumulado = 0;
    const produtos = [...porProduto.entries()]
      .sort((a, b) => b[1].faturamento - a[1].faturamento)
      .map(([id, p]) => {
        const antes = acumulado;
        acumulado += p.faturamento;
        // Classe pela posição em que o produto COMEÇA na curva: o item que cruza 80% ainda é A.
        const classe = totalFat === 0 ? 'C' : antes / totalFat < 0.8 ? 'A' : antes / totalFat < 0.95 ? 'B' : 'C';
        const lucro = p.faturamento - p.custo;
        return {
          id, ...p, lucroBruto: lucro, margemBruta: margem(lucro, p.faturamento),
          participacao: totalFat ? Math.round((p.faturamento * 10000) / totalFat) : 0,
          acumulado: totalFat ? Math.round((acumulado * 10000) / totalFat) : 0, classe,
        };
      });

    const resumoABC = (['A', 'B', 'C'] as const).map((classe) => {
      const l = produtos.filter((p) => p.classe === classe);
      return { classe, produtos: l.length, faturamento: l.reduce((a, p) => a + p.faturamento, 0) };
    });
    const categorias = [...porCategoria.entries()]
      .map(([nome, c]) => ({ nome, faturamento: c.faturamento, custo: c.custo, lucroBruto: c.faturamento - c.custo, margemBruta: margem(c.faturamento - c.custo, c.faturamento) }))
      .sort((a, b) => b.faturamento - a.faturamento);

    return { periodo: { de, ate }, totalFaturamento: totalFat, produtos, resumoABC, categorias };
  }

  /** Fechamentos de caixa do período, com as diferenças de conferência. */
  async caixas(de: string, ate: string) {
    const { inicio, fim } = this.validar(de, ate);
    const sessoes = await this.prisma.caixaSessao.findMany({
      where: { abertoEm: { gte: inicio, lte: fim } },
      orderBy: { abertoEm: 'asc' },
      include: { usuario: { select: { nome: true } }, fechamento: true },
    });
    const porForma: Record<string, { esperado: number; informado: number; diferenca: number }> = {};
    for (const s of sessoes) {
      for (const f of s.fechamento) {
        const a = (porForma[f.forma] ??= { esperado: 0, informado: 0, diferenca: 0 });
        a.esperado += f.esperado; a.informado += f.informado; a.diferenca += f.diferenca;
      }
    }
    return {
      periodo: { de, ate },
      sessoes: sessoes.map((s) => ({
        id: s.id, operador: s.usuario.nome, abertoEm: s.abertoEm, fechadoEm: s.fechadoEm, status: s.status,
        esperado: s.fechamento.reduce((a, f) => a + f.esperado, 0),
        informado: s.fechamento.reduce((a, f) => a + f.informado, 0),
        diferenca: s.fechamento.reduce((a, f) => a + f.diferenca, 0),
      })),
      porForma,
      abertos: sessoes.filter((s) => s.status === 'ABERTO').length,
    };
  }
}
