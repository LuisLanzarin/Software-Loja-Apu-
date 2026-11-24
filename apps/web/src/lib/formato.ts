const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

/** O sistema guarda dinheiro em centavos (inteiro). */
export const formatarReais = (centavos: number) => moeda.format(centavos / 100);
export const formatarDataHora = (iso: string) => dataHora.format(new Date(iso));

/** "1.234,56" → 123456. Devolve null se não for um número válido. */
export function lerDecimal(texto: string, casas: number): number | null {
  const limpo = texto.trim().replace(/\s|R\$/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 10 ** casas);
}

/** 123456 → "1.234,56" (para preencher campos de formulário). */
export const decimalParaTexto = (valor: number, casas: number) =>
  (valor / 10 ** casas).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const NOMES_PERFIL = {
  VENDEDOR: 'Vendedor',
  FINANCEIRO: 'Financeiro',
  GERENTE: 'Gerente',
  ADMIN: 'Administrador',
} as const;
export type Perfil = keyof typeof NOMES_PERFIL;

/** Percentual em pontos-base → "15,00%". */
export const formatarPct = (bp: number) =>
  `${(bp / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** Quantidade em milésimos → "2,5" (sem casas quando a unidade não é fracionável). */
export const formatarQtd = (milesimos: number) =>
  (milesimos / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/** CNPJ/CPF só com dígitos/letras → com máscara. */
export function formatarDocumento(doc: string | null) {
  if (!doc) return '';
  if (doc.length === 11) return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (doc.length === 14) return doc.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
  return doc;
}
