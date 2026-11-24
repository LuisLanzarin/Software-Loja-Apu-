import { BadRequestException } from '@nestjs/common';
import type { Prisma, TipoMovimentacao } from '../generated/prisma/client.ts';

type Tx = Prisma.TransactionClient;

export interface Movimento {
  produtoId: number;
  tipo: TipoMovimentacao;
  /** milésimos: positivo entra, negativo sai */
  quantidade: number;
  /** centavos por unidade de venda; padrão = custo médio atual */
  custoUnitario?: number;
  motivo?: string | null;
  usuarioId?: number | null;
  entradaId?: number;
  permitirNegativo?: boolean;
}

/**
 * ÚNICO ponto do sistema que altera estoque. Precisa rodar dentro de uma transação:
 * atualiza o saldo de forma atômica (increment) e grava a movimentação com o saldo resultante.
 */
export async function movimentar(tx: Tx, m: Movimento) {
  if (m.quantidade === 0) throw new BadRequestException('Quantidade zero.');
  const produto = await tx.produto.update({
    where: { id: m.produtoId },
    data: { estoqueAtual: { increment: m.quantidade } },
    include: { unidade: true },
  });
  if (produto.estoqueAtual < 0 && !m.permitirNegativo) {
    const saldo = (produto.estoqueAtual - m.quantidade) / 1000;
    throw new BadRequestException(
      `Estoque insuficiente de "${produto.descricao}": saldo ${saldo.toLocaleString('pt-BR')} ${produto.unidade.sigla}.`,
    );
  }
  await tx.movimentacaoEstoque.create({
    data: {
      produtoId: m.produtoId,
      tipo: m.tipo,
      quantidade: m.quantidade,
      saldoApos: produto.estoqueAtual,
      custoUnitario: m.custoUnitario ?? produto.custo,
      motivo: m.motivo ?? null,
      usuarioId: m.usuarioId ?? null,
      entradaId: m.entradaId,
    },
  });
  return produto;
}

/** Produtos vendidos em unidade inteira (UN, SC, CX…) não aceitam quantidade quebrada. */
export function exigirInteiro(quantidade: number, unidade: { sigla: string; fracionavel: boolean }, descricao: string) {
  if (!unidade.fracionavel && quantidade % 1000 !== 0) {
    throw new BadRequestException(`"${descricao}" é controlado em ${unidade.sigla}: use quantidade inteira.`);
  }
}
