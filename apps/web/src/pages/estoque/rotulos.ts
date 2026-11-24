export const TIPOS_MOV: Record<string, { rotulo: string; cor: 'verde' | 'vermelho' | 'azul' | 'laranja' | 'cinza' }> = {
  ENTRADA_COMPRA: { rotulo: 'Entrada (compra)', cor: 'verde' },
  ESTORNO_COMPRA: { rotulo: 'Entrada cancelada', cor: 'vermelho' },
  AJUSTE_ENTRADA: { rotulo: 'Ajuste (entrada)', cor: 'azul' },
  AJUSTE_SAIDA: { rotulo: 'Ajuste (saída)', cor: 'laranja' },
  PERDA: { rotulo: 'Perda / avaria', cor: 'vermelho' },
  INVENTARIO: { rotulo: 'Inventário', cor: 'azul' },
  VENDA: { rotulo: 'Venda', cor: 'cinza' },
  ESTORNO_VENDA: { rotulo: 'Venda cancelada', cor: 'verde' },
};
