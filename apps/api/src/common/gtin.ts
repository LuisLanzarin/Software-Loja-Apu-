/** Valida código de barras EAN/GTIN (8, 12, 13 ou 14 dígitos) pelo dígito verificador. */
export function gtinValido(codigo: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(codigo)) return false;
  const digitos = [...codigo].map(Number);
  const verificador = digitos.pop()!;
  const soma = digitos.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === verificador;
}
