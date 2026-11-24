import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FormaPagamento } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

/** Formas que passam pelo caixa (boleto é a prazo e não entra na conferência). */
export const FORMAS_CAIXA = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'] as const satisfies FormaPagamento[];
export type FormaCaixa = (typeof FORMAS_CAIXA)[number];

@Injectable()
export class CaixaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * O caixa é ÚNICO: o gerente abre, todos lançam vendas nele e o gerente fecha.
   * (Se houver mais de uma sessão aberta de versões antigas, vale a mais recente.)
   */
  sessaoAberta() {
    return this.prisma.caixaSessao.findFirst({
      where: { status: 'ABERTO' },
      orderBy: { id: 'desc' },
      include: { usuario: { select: { nome: true } } },
    });
  }

  async exigirSessaoAberta() {
    const s = await this.sessaoAberta();
    if (!s) throw new BadRequestException({ message: 'O caixa está fechado. Peça ao gerente para abrir o caixa.', codigo: 'CAIXA_FECHADO' });
    return s;
  }

  async abrir(usuarioId: number, fundoTroco: number) {
    const aberto = await this.sessaoAberta();
    if (aberto) {
      const hora = aberto.abertoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      throw new BadRequestException(`O caixa já está aberto (por ${aberto.usuario.nome}, às ${hora}).`);
    }
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
    const sessao = await this.exigirSessaoAberta();
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
    const sessao = await this.exigirSessaoAberta();
    const quem = sessao.usuarioId === usuarioId ? null : `Fechado por outro usuário (id ${usuarioId}).`;
    observacao = [observacao, quem].filter(Boolean).join(' ') || null;
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

  listar(pagina: number) {
    return this.prisma.$transaction([
      this.prisma.caixaSessao.findMany({
        orderBy: { id: 'desc' },
        skip: (pagina - 1) * 30,
        take: 30,
        include: { usuario: { select: { nome: true } }, fechamento: true },
      }),
      this.prisma.caixaSessao.count(),
    ]);
  }
}
