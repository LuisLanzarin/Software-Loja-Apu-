import { z } from 'zod';

/** Texto opcional: string vazia vira null. */
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const centavos = z.number().int('Valor inválido').min(0, 'O valor não pode ser negativo').max(10_000_000_00);
export const pontosBase = z.number().int().min(0).max(9999, 'Percentual deve ser menor que 100%');
export const idOpcional = z.number().int().positive().nullish().transform((v) => v ?? null);

export const situacaoSchema = z.enum(['ativos', 'inativos', 'todos']).default('ativos');
export const filtroAtivo = (s: 'ativos' | 'inativos' | 'todos') =>
  s === 'todos' ? {} : { ativo: s === 'ativos' };
