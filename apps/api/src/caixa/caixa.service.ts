import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { FormaPagamento } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

/** Formas que passam pelo caixa (boleto é a prazo e não entra na conferência). */
export const FORMAS_CAIXA = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'] as const satisfies FormaPagamento[];
export type FormaCaixa = (typeof FORMAS_CAIXA)[number];

@Injectable()
export class CaixaService {
  constructor(private readonly prisma: PrismaService) {}

  sessaoAberta(usuarioId: number) {
    return this.prisma.caixaSessao.findFirst({ where: { usuarioId, status: 'ABERTO' } });
  }

  async exigirSessaoAberta(usuarioId: number) {
    const s = await this.sessaoAberta(usuarioId);
    if (!s) throw new BadRequestException({ message: 'Abra o caixa antes de registrar vendas.', codigo: 'CAIXA_FECHADO' });
    return s;
  }

  async abrir(usuarioId: number, fundoTroco: number) {
    if (await this.sessaoAberta(usuarioId)) throw new BadRequestException('Você já tem um caixa aberto.');
    return this.prisma.caixaSessao.create({ data: { usuarioId, fundoTroco } });
  }

  /** Totais da sessão por forma de pagamento. Dinheiro esperado inclui o fundo de troco. */
  async resumo(sessaoId: number) {
    const sessao = await this.prisma.caixaSessao.findUnique({
      where: { id: sessaoId },
      include: {
        usuario: { select: { id: true, nome: true } },
        fechamento: true,
        movimentos: { orderBy: { id: 'asc' }, include: { usuario: { select: { nome: true } } } },
      },
    });
    if (!sessao) throw new NotFoundException('Sessão de caixa não encontrada.');

    const porForma = Object.fromEntries(FORMAS_CAIXA.map((f) => [f, 0])) as Record<FormaCaixa, number>;
    let vendas = 0, estornos = 0, sangrias = 0, suprimentos = 0;
    for (const m of sessao.movimentos) {
      if (m.forma !== 'BOLETO') porForma[m.forma] += m.valor;
      if (m.tipo === 'VENDA') vendas += m.valor;
      if (m.tipo === 'ESTORNO_VENDA') estornos += m.valor;
      if (m.tipo === 'SANGRIA') sangrias += m.valor;
      if (m.tipo === 'SUPRIMENTO') suprimentos += m.valor;
    }
    const esperado = { ...porForma, DINHEIRO: sessao.fundoTroco + porForma.DINHEIRO };
    const agregado = await this.prisma.venda.aggregate({
      where: { caixaSessaoId: sessaoId, status: 'FINALIZADA' },
      _count: true,
      _sum: { total: true },
    });
    const boletos = await this.prisma.vendaPagamento.aggregate({
      where: { forma: 'BOLETO', venda: { caixaSessaoId: sessaoId, status: 'FINALIZADA' } },
      _sum: { valor: true },
    });
    return {
      ...sessao,
      esperado,
      totais: {
        vendas, estornos, sangrias, suprimentos,
        quantidadeVendas: agregado._count,
        faturamento: agregado._sum.total ?? 0,
        boletos: boletos._sum.valor ?? 0,
      },
    };
  }

  async movimentar(usuarioId: number, tipo: 'SANGRIA' | 'SUPRIMENTO', valor: number, motivo: string) {
    const sessao = await this.exigirSessaoAberta(usuarioId);
    if (tipo === 'SANGRIA') {
      const { esperado } = await this.resumo(sessao.id);
      if (valor > esperado.DINHEIRO) throw new BadRequestException('A sangria é maior que o dinheiro em caixa.');
    }
    return this.prisma.caixaMovimento.create({
      data: { sessaoId: sessao.id, tipo, forma: 'DINHEIRO', valor: tipo === 'SANGRIA' ? -valor : valor, motivo, usuarioId },
    });
  }

  /** Fechamento com conferência cega: o operador informa o que contou; o sistema compara. */
  async fechar(usuarioId: number, informado: Record<FormaCaixa, number>, observacao: string | null) {
    const sessao = await this.exigirSessaoAberta(usuarioId);
    const { esperado } = await this.resumo(sessao.id);
    await this.prisma.$transaction([
      ...FORMAS_CAIXA.map((forma) =>
        this.prisma.caixaFechamento.create({
          data: { sessaoId: sessao.id, forma, esperado: esperado[forma], informado: informado[forma], diferenca: informado[forma] - esperado[forma] },
        }),
      ),
      this.prisma.caixaSessao.update({ where: { id: sessao.id }, data: { status: 'FECHADO', fechadoEm: new Date(), observacao } }),
    ]);
    return this.resumo(sessao.id);
  }

  listar(usuarioId: number | undefined, pagina: number) {
    const where = usuarioId ? { usuarioId } : {};
    return this.prisma.$transaction([
      this.prisma.caixaSessao.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (pagina - 1) * 30,
        take: 30,
        include: { usuario: { select: { nome: true } }, fechamento: true },
      }),
      this.prisma.caixaSessao.count({ where }),
    ]);
  }

  async obterVisivel(id: number, usuarioId: number, verTodos: boolean) {
    const r = await this.resumo(id);
    if (!verTodos && r.usuarioId !== usuarioId) throw new ForbiddenException('Você só pode ver o seu próprio caixa.');
    // Enquanto aberto, o operador não vê o "esperado" (conferência cega); quem supervisiona vê.
    if (r.status === 'ABERTO' && !verTodos) return { ...r, esperado: undefined };
    return r;
  }
}
