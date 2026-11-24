/**
 * Agrupamento por dia, semana (segunda a domingo) ou mês, sempre no fuso
 * horário do computador da loja — "hoje" é o dia do caixa, não o dia em UTC.
 */
export type Agrupamento = 'dia' | 'semana' | 'mes';

const dois = (n: number) => String(n).padStart(2, '0');
export const chaveDia = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

export function inicioDoPeriodo(d: Date, a: Agrupamento): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (a === 'semana') r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); // volta até segunda-feira
  if (a === 'mes') r.setDate(1);
  return r;
}

export function rotulo(inicio: Date, a: Agrupamento): string {
  if (a === 'dia') return inicio.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  if (a === 'semana') return `Semana de ${inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  const m = inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** Todos os períodos entre as duas datas (inclusive), para o gráfico mostrar os dias sem venda. */
export function periodosEntre(de: Date, ate: Date, a: Agrupamento): Date[] {
  const lista: Date[] = [];
  for (let d = inicioDoPeriodo(de, a); d <= ate; ) {
    lista.push(new Date(d));
    if (a === 'dia') d.setDate(d.getDate() + 1);
    if (a === 'semana') d.setDate(d.getDate() + 7);
    if (a === 'mes') d.setMonth(d.getMonth() + 1);
  }
  return lista;
}

/** "AAAA-MM-DD" → intervalo local [00:00 do início, 23:59:59.999 do fim]. */
export function intervalo(de: string, ate: string) {
  const inicio = new Date(`${de}T00:00:00`);
  const fim = new Date(`${ate}T23:59:59.999`);
  return { inicio, fim };
}
