/**
 * Exporta uma tabela para CSV que abre direto no Excel em português
 * (separador ";", vírgula decimal e BOM para os acentos).
 */
export type Celula = string | number | null | undefined;

export function exportarCSV(nomeArquivo: string, cabecalho: string[], linhas: Celula[][]) {
  const formatar = (c: Celula) => {
    if (c === null || c === undefined) return '';
    const s = typeof c === 'number' ? c.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 3 }) : c;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texto = [cabecalho, ...linhas].map((l) => l.map(formatar).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${nomeArquivo}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

/** Centavos → número em reais para a planilha. */
export const reais = (centavos: number) => centavos / 100;
/** Pontos-base → número em % para a planilha. */
export const pct = (bp: number | null) => (bp === null ? null : bp / 100);
