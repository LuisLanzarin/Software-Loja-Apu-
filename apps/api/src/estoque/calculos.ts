/**
 * Cálculos de estoque — funções puras, testadas em test/regras.spec.ts.
 * Quantidades em milésimos, valores em centavos.
 */

/**
 * Custo médio ponderado após uma entrada.
 * Saldo negativo (vendeu sem ter dado entrada) é tratado como zero:
 * o custo passa a ser o da nova compra.
 */
export function custoMedio(saldo: number, custoAtual: number, qtdEntrada: number, custoEntrada: number): number {
  const base = Math.max(saldo, 0);
  if (base + qtdEntrada <= 0) return custoEntrada;
  return Math.round((base * custoAtual + qtdEntrada * custoEntrada) / (base + qtdEntrada));
}

/**
 * Custo médio depois de ESTORNAR uma entrada: tira do valor em estoque
 * exatamente o que aquela entrada colocou.
 */
export function custoMedioAposEstorno(saldoAntes: number, custoAtual: number, qtdEstornada: number, valorEstornado: number, custoAnteriorAEntrada: number): number {
  const saldoDepois = saldoAntes - qtdEstornada;
  if (saldoDepois <= 0) return custoAnteriorAEntrada;
  const valorDepois = (saldoAntes * custoAtual) / 1000 - valorEstornado;
  return Math.max(0, Math.round((valorDepois * 1000) / saldoDepois));
}

/**
 * Divide `extra` (frete + despesas − desconto) entre os itens proporcionalmente ao valor de cada um.
 * A soma das partes é sempre exatamente `extra` (o último item absorve o arredondamento).
 */
export function ratear(valores: number[], extra: number): number[] {
  if (!valores.length) return [];
  const total = valores.reduce((a, b) => a + b, 0);
  const partes = valores.map((v) => (total > 0 ? Math.trunc((extra * v) / total) : Math.trunc(extra / valores.length)));
  partes[partes.length - 1] += extra - partes.reduce((a, b) => a + b, 0);
  return partes;
}

/** Valor em centavos de `quantidade` (milésimos) a `unitario` (centavos por unidade). */
export const valorDe = (quantidade: number, unitario: number) => Math.round((quantidade * unitario) / 1000);
