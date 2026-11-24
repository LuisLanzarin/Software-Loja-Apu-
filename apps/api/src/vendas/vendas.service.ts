import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { CaixaService } from '../caixa/caixa.service.ts';
import { temPermissao } from '../common/permissoes.ts';
import { ConfiguracaoService } from '../configuracao/configuracao.service.ts';
import { valorDe } from '../estoque/calculos.ts';
import { exigirInteiro, movimentar } from '../estoque/movimentacao.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import type { DadosVenda, FiltroVendas } from './vendas.schemas.ts';

export interface MotivoAutorizacao {
  tipo: 'DESCONTO' | 'SEM_ESTOQUE' | 'CANCELAMENTO';
  detalhe: string;
}

/** Resposta 403 que a tela entende como "chame o gerente". */
export class AutorizacaoNecessaria extends HttpException {
  constructor(motivos: MotivoAutorizacao[]) {
    super({ statusCode: 403, codigo: 'AUTORIZACAO_NECESSARIA', message: 'Esta operação precisa de autorização do gerente.', motivos }, HttpStatus.FORBIDDEN);
  }
}

const INCLUIR_VENDA = {
  cliente: true,
  vendedor: { select: { id: true, nome: true } },
  autorizadoPor: { select: { nome: true } },
  canceladaPor: { select: { nome: true } },
  itens: { orderBy: { id: 'asc' } },
  pagamentos: { orderBy: { id: 'asc' } },
  boletos: { orderBy: { parcela: 'asc' } },
  vendaGerada: { select: { id: true } },
} satisfies Prisma.VendaInclude;

const qtd = (m: number) => (m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

@Injectable()
export class VendasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracaoService,
    private readonly caixa: CaixaService,
    private readonly auth: AuthService,
  ) {}

  async obter(id: number, u?: UsuarioSessao) {
    const v = await this.prisma.venda.findUnique({ where: { id }, include: INCLUIR_VENDA });
    if (!v) throw new NotFoundException('Venda não encontrada.');
    if (u && !temPermissao(u.perfil, 'venda.ver_todas') && v.vendedorId !== u.id) {
      throw new ForbiddenException('Você só pode ver as suas próprias vendas.');
    }
    if (u && !temPermissao(u.perfil, 'produto.ver_custo')) {
      return { ...v, itens: v.itens.map(({ custoUnitario: _, ...i }) => i) };
    }
    return v;
  }

  async listar(f: FiltroVendas, u: UsuarioSessao) {
    const where: Prisma.VendaWhereInput = {
      ...(f.status ? { status: f.status } : {}),
      ...(f.clienteId ? { clienteId: f.clienteId } : {}),
      ...(f.numero ? { id: f.numero } : {}),
      ...(temPermissao(u.perfil, 'venda.ver_todas') ? (f.vendedorId ? { vendedorId: f.vendedorId } : {}) : { vendedorId: u.id }),
    };
    if (f.de || f.ate) {
      where.criadoEm = {
        ...(f.de ? { gte: new Date(`${f.de}T00:00:00`) } : {}),
        ...(f.ate ? { lte: new Date(`${f.ate}T23:59:59.999`) } : {}),
      };
    }
    const [itens, total, soma] = await this.prisma.$transaction([
      this.prisma.venda.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (f.pagina - 1) * 50,
        take: 50,
        include: { cliente: { select: { nome: true } }, vendedor: { select: { nome: true } }, pagamentos: { select: { forma: true } } },
      }),
      this.prisma.venda.count({ where }),
      this.prisma.venda.aggregate({ where: { ...where, status: 'FINALIZADA' }, _sum: { total: true }, _count: true }),
    ]);
    return { itens, total, pagina: f.pagina, porPagina: 50, totalFinalizadas: soma._count, valorFinalizadas: soma._sum.total ?? 0 };
  }

  /** Registra uma venda (finalizar=true) ou um orçamento (finalizar=false). */
  async registrar(d: DadosVenda, u: UsuarioSessao, ip?: string) {
    const cfg = await this.config.obter();

    // --- Orçamento de origem: preços prometidos valem até o fim da validade.
    let precosOrcamento = new Map<number, number>();
    if (d.orcamentoId) {
      const orc = await this.prisma.venda.findUnique({ where: { id: d.orcamentoId }, include: { itens: true } });
      if (!orc || orc.status !== 'ORCAMENTO') throw new BadRequestException('Orçamento não encontrado ou já utilizado.');
      if (!d.finalizar) throw new BadRequestException('Para alterar um orçamento, crie um novo.');
      if (orc.validoAte && orc.validoAte >= new Date()) precosOrcamento = new Map(orc.itens.map((i) => [i.produtoId, i.precoUnitario]));
    }

    // --- Cliente
    const cliente = d.clienteId ? await this.prisma.cliente.findUnique({ where: { id: d.clienteId } }) : null;
    if (d.clienteId && !cliente) throw new BadRequestException('Cliente não encontrado.');

    // --- Itens: o preço vem SEMPRE do cadastro (ou do orçamento válido), nunca da tela.
    const ids = [...new Set(d.itens.map((i) => i.produtoId))];
    const produtos = new Map(
      (await this.prisma.produto.findMany({ where: { id: { in: ids } }, include: { unidade: true } })).map((p) => [p.id, p]),
    );
    const linhas = d.itens.map((i) => {
      const p = produtos.get(i.produtoId);
      if (!p) throw new BadRequestException('Produto não encontrado.');
      if (!p.ativo) throw new BadRequestException(`"${p.descricao}" está inativo.`);
      exigirInteiro(i.quantidade, p.unidade, p.descricao);
      const preco = precosOrcamento.get(p.id) ?? p.precoVenda;
      const bruto = valorDe(i.quantidade, preco);
      if (i.desconto > bruto) throw new BadRequestException(`Desconto maior que o valor de "${p.descricao}".`);
      return { p, quantidade: i.quantidade, preco, bruto, desconto: i.desconto, total: bruto - i.desconto };
    });
    const subtotal = linhas.reduce((a, l) => a + l.bruto, 0);
    const descontoItens = linhas.reduce((a, l) => a + l.desconto, 0);
    if (d.descontoGeral > subtotal - descontoItens) throw new BadRequestException('O desconto é maior que o valor da venda.');
    const consumo = subtotal - descontoItens - d.descontoGeral;
    if (consumo <= 0) throw new BadRequestException('O total da venda precisa ser maior que zero.');
    // Taxa de serviço sobre o consumo já com desconto.
    const taxaServico = d.cobrarTaxaServico && cfg.taxaServicoPct > 0 ? Math.round((consumo * cfg.taxaServicoPct) / 10000) : 0;
    const total = consumo + taxaServico;

    const base = {
      clienteId: cliente?.id ?? null, vendedorId: u.id, subtotal, descontoItens, descontoGeral: d.descontoGeral,
      taxaServico, total, observacoes: d.observacoes,
    };
    const itensData = linhas.map((l) => ({
      produtoId: l.p.id, descricao: l.p.descricao, unidadeSigla: l.p.unidade.sigla, quantidade: l.quantidade,
      precoUnitario: l.preco, desconto: l.desconto, total: l.total, custoUnitario: l.p.custo,
    }));

    if (!d.finalizar) {
      const validoAte = new Date();
      validoAte.setDate(validoAte.getDate() + cfg.validadeOrcamentoDias);
      validoAte.setHours(23, 59, 59, 999);
      const orc = await this.prisma.venda.create({ data: { ...base, status: 'ORCAMENTO', validoAte, itens: { create: itensData } } });
      return { venda: await this.obter(orc.id, u), autorizadoPor: null };
    }

    // --- Daqui em diante: venda de verdade.
    const sessao = await this.caixa.exigirSessaoAberta(u.id);

    // Autorização do gerente: desconto acima do limite e/ou venda sem estoque.
    const motivos: MotivoAutorizacao[] = [];
    const pctDesconto = Math.round(((descontoItens + d.descontoGeral) * 10000) / subtotal);
    if (pctDesconto > cfg.descontoMaxSemAutorizacao) {
      motivos.push({
        tipo: 'DESCONTO',
        detalhe: `Desconto de ${(pctDesconto / 100).toLocaleString('pt-BR')}% (limite sem autorização: ${(cfg.descontoMaxSemAutorizacao / 100).toLocaleString('pt-BR')}%)`,
      });
    }
    const pedido = new Map<number, number>();
    for (const l of linhas) pedido.set(l.p.id, (pedido.get(l.p.id) ?? 0) + l.quantidade);
    for (const [id, q] of pedido) {
      const p = produtos.get(id)!;
      if (q > p.estoqueAtual) {
        motivos.push({ tipo: 'SEM_ESTOQUE', detalhe: `${p.descricao}: pedido ${qtd(q)} ${p.unidade.sigla}, em estoque ${qtd(Math.max(p.estoqueAtual, 0))}` });
      }
    }
    const autorizadoPor = await this.resolverAutorizacao(motivos, u, d.autorizacao, ip);

    // Pagamentos
    const pagamentos = this.validarPagamentos(d.pagamentos, total, cliente);

    const id = await this.prisma.$transaction(async (tx) => {
      const venda = await tx.venda.create({
        data: {
          ...base, status: 'FINALIZADA', caixaSessaoId: sessao.id, finalizadaEm: new Date(), troco: pagamentos.troco,
          orcamentoOrigemId: d.orcamentoId ?? null,
          autorizadoPorId: autorizadoPor?.id ?? null,
          motivosAutorizacao: motivos.length ? motivos.map((m) => m.detalhe).join(' | ') : null,
          itens: { create: itensData },
          pagamentos: { create: pagamentos.registros.map(({ forma, valor, parcelas }) => ({ forma, valor, parcelas })) },
        },
      });
      if (d.orcamentoId) await tx.venda.update({ where: { id: d.orcamentoId }, data: { status: 'CONVERTIDO' } });

      for (const l of linhas) {
        await movimentar(tx, {
          produtoId: l.p.id, tipo: 'VENDA', quantidade: -l.quantidade, custoUnitario: l.p.custo,
          motivo: `Venda nº ${venda.id}`, usuarioId: u.id, vendaId: venda.id,
          permitirNegativo: motivos.some((m) => m.tipo === 'SEM_ESTOQUE'),
        });
      }
      for (const pg of pagamentos.registros) {
        if (pg.forma === 'BOLETO') {
          await tx.contaReceber.createMany({ data: pg.boletos!.map((b) => ({ ...b, vendaId: venda.id, clienteId: cliente!.id })) });
        } else {
          await tx.caixaMovimento.create({ data: { sessaoId: sessao.id, tipo: 'VENDA', forma: pg.forma, valor: pg.valor, vendaId: venda.id, usuarioId: u.id } });
        }
      }
      return venda.id;
    });
    return { venda: await this.obter(id, u), autorizadoPor };
  }

  /**
   * Se houver motivos, exige um gerente: o próprio usuário (se for gerente/admin)
   * ou o login e senha de um gerente enviados junto. Sem isso, devolve 403 com os motivos.
   */
  private async resolverAutorizacao(motivos: MotivoAutorizacao[], u: UsuarioSessao, autorizacao: DadosVenda['autorizacao'], ip?: string) {
    if (!motivos.length) return null;
    if (temPermissao(u.perfil, 'venda.autorizar')) return { id: u.id, nome: u.nome };
    if (!autorizacao) throw new AutorizacaoNecessaria(motivos);
    const g = await this.auth.autorizar(autorizacao.login, autorizacao.senha, 'venda.autorizar', ip);
    return { id: g.id, nome: g.nome };
  }

  private validarPagamentos(lista: DadosVenda['pagamentos'], total: number, cliente: { id: number; documento: string | null; nome: string } | null) {
    if (!lista.length) throw new BadRequestException('Informe a forma de pagamento.');
    const soma = lista.reduce((a, p) => a + p.valor, 0);
    if (soma < total) throw new BadRequestException(`Faltam ${reais(total - soma)} para fechar o pagamento.`);
    const dinheiro = lista.filter((p) => p.forma === 'DINHEIRO').reduce((a, p) => a + p.valor, 0);
    const troco = soma - total;
    if (troco > dinheiro) throw new BadRequestException('Só pagamento em dinheiro pode ter troco. Confira os valores.');

    let trocoRestante = troco;
    const registros = lista.map((p) => {
      let valor = p.valor;
      if (p.forma === 'DINHEIRO' && trocoRestante > 0) {
        const abate = Math.min(trocoRestante, valor);
        valor -= abate;
        trocoRestante -= abate;
      }
      if (p.forma !== 'BOLETO') return { forma: p.forma, valor, parcelas: p.forma === 'CREDITO' ? p.parcelas : 1 };

      if (!cliente) throw new BadRequestException('Venda no boleto precisa de um cliente cadastrado.');
      if (!cliente.documento) throw new BadRequestException(`Cadastre o CPF/CNPJ de ${cliente.nome} para vender no boleto.`);
      const primeiro = p.primeiroVencimento ? new Date(`${p.primeiroVencimento}T12:00:00`) : null;
      if (!primeiro) throw new BadRequestException('Informe o vencimento do primeiro boleto.');
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      if (primeiro < hoje) throw new BadRequestException('O vencimento do boleto não pode ser no passado.');
      const parte = Math.floor(valor / p.parcelas);
      const boletos = Array.from({ length: p.parcelas }, (_, i) => {
        const vencimento = new Date(primeiro);
        vencimento.setDate(vencimento.getDate() + i * p.intervaloDias);
        return { parcela: i + 1, totalParcelas: p.parcelas, valor: i === p.parcelas - 1 ? valor - parte * (p.parcelas - 1) : parte, vencimento };
      });
      return { forma: p.forma, valor, parcelas: p.parcelas, boletos };
    });
    return { troco, registros: registros.filter((r) => r.valor > 0) };
  }

  async cancelarOrcamento(id: number, u: UsuarioSessao) {
    const v = await this.obter(id, u);
    if (v.status !== 'ORCAMENTO') throw new BadRequestException('Só orçamentos em aberto podem ser descartados.');
    await this.prisma.venda.update({ where: { id }, data: { status: 'CANCELADA', canceladaEm: new Date(), canceladaPorId: u.id, motivoCancelamento: 'Orçamento descartado' } });
  }

  /** Cancela a venda: devolve estoque, estorna o caixa e cancela boletos em aberto. */
  async cancelar(id: number, motivo: string, autorizacao: DadosVenda['autorizacao'], u: UsuarioSessao, ip?: string) {
    const v = await this.obter(id, u);
    if (v.status !== 'FINALIZADA') throw new BadRequestException('Só vendas finalizadas podem ser canceladas.');
    if (v.boletos.some((b) => b.status === 'PAGO')) throw new BadRequestException('Esta venda tem boleto já pago. Fale com o financeiro.');

    const cfg = await this.config.obter();
    const motivos: MotivoAutorizacao[] = v.total > cfg.cancelamentoMaxSemAutorizacao
      ? [{ tipo: 'CANCELAMENTO', detalhe: `Venda de ${reais(v.total)} (limite sem autorização: ${reais(cfg.cancelamentoMaxSemAutorizacao)})` }]
      : [];
    const autorizadoPor = await this.resolverAutorizacao(motivos, u, autorizacao, ip);

    const pagamentosCaixa = v.pagamentos.filter((p) => p.forma !== 'BOLETO');
    const sessao = pagamentosCaixa.length ? await this.caixa.exigirSessaoAberta(u.id) : null;
    const itens = await this.prisma.vendaItem.findMany({ where: { vendaId: id } });

    await this.prisma.$transaction(async (tx) => {
      const texto = `Cancelamento da venda nº ${id}: ${motivo}`;
      for (const i of itens) {
        await movimentar(tx, { produtoId: i.produtoId, tipo: 'ESTORNO_VENDA', quantidade: i.quantidade, custoUnitario: i.custoUnitario, motivo: texto, usuarioId: u.id, vendaId: id });
      }
      for (const p of pagamentosCaixa) {
        await tx.caixaMovimento.create({ data: { sessaoId: sessao!.id, tipo: 'ESTORNO_VENDA', forma: p.forma, valor: -p.valor, vendaId: id, motivo, usuarioId: u.id } });
      }
      await tx.contaReceber.updateMany({ where: { vendaId: id, status: 'ABERTO' }, data: { status: 'CANCELADO' } });
      await tx.venda.update({
        where: { id },
        data: { status: 'CANCELADA', canceladaEm: new Date(), canceladaPorId: u.id, motivoCancelamento: motivo, cancelamentoAutorizadoPorId: autorizadoPor?.id ?? null },
      });
    });
    return { venda: await this.obter(id, u), autorizadoPor };
  }
}
