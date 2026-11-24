/**
 * Formação de preço por MARKUP DIVISOR.
 *
 *   preço = custo / (1 − (impostos + despesas fixas + comissão + margem))
 *
 * Diferente de "custo + X%", este cálculo garante que, depois de pagar impostos,
 * despesas e comissão (que incidem sobre o PREÇO), sobra exatamente a margem desejada.
 * Todos os percentuais em pontos-base (1% = 100); valores em centavos.
 *
 * ⚠ Mantenha igual a apps/web/src/lib/precificacao.ts
 */

export interface ParametrosPreco {
  impostosPct: number;
  despesasFixasPct: number;
  comissaoPct: number;
}

export const custosVariaveis = (p: ParametrosPreco) => p.impostosPct + p.despesasFixasPct + p.comissaoPct;

/** Preço sugerido em centavos, ou null se os percentuais somam 100% ou mais. */
export function precoSugerido(custo: number, margemPct: number, p: ParametrosPreco): number | null {
  const divisor = 10000 - custosVariaveis(p) - margemPct;
  if (divisor <= 0) return null;
  return Math.round((custo * 10000) / divisor);
}

/** Margem líquida real (pontos-base) que o preço praticado deixa. Pode ser negativa. */
export function margemReal(custo: number, preco: number, p: ParametrosPreco): number | null {
  if (preco <= 0) return null;
  return 10000 - custosVariaveis(p) - Math.round((custo * 10000) / preco);
}

/** Margem que vale para o produto: a dele, senão a da categoria, senão a da loja. */
export const margemEfetiva = (produto: number | null, categoria: number | null | undefined, loja: number) =>
  produto ?? categoria ?? loja;
