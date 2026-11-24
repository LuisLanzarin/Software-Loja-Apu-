/** "Cimento CP-II Votorantim" → "cimento cp-ii votorantim"; remove acentos para a busca. */
export const normalizarBusca = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Remove pontuação de CPF/CNPJ e põe letras em maiúsculas (CNPJ alfanumérico, desde 07/2026). */
export const limparDocumento = (s: string) => s.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();

function digitoVerificador(base: string, pesos: number[]) {
  // Valor de cada caractere = código ASCII − 48 (dígitos 0–9, letras A=17 … Z=42).
  const soma = [...base].reduce((acc, c, i) => acc + (c.charCodeAt(0) - 48) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(doc: string): boolean {
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(doc) || /^(\d)\1{13}$/.test(doc)) return false;
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = digitoVerificador(doc.slice(0, 12), p1);
  const d2 = digitoVerificador(doc.slice(0, 12) + d1, [6, ...p1]);
  return doc.endsWith(`${d1}${d2}`);
}

export function cpfValido(doc: string): boolean {
  if (!/^\d{11}$/.test(doc) || /^(\d)\1{10}$/.test(doc)) return false;
  const dv = (n: number) => {
    const soma = [...doc.slice(0, n)].reduce((acc, c, i) => acc + Number(c) * (n + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(doc[9]) && dv(10) === Number(doc[10]);
}

export const documentoValido = (doc: string) => (doc.length === 11 ? cpfValido(doc) : cnpjValido(doc));
