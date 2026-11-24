import { z } from 'zod';
import { centavos, idOpcional, textoOpcional } from '../common/esquemas.ts';

const milesimos = z.number().int().positive('A quantidade deve ser maior que zero').max(1_000_000_000);

export const ajusteSchema = z.object({
  produtoId: z.number().int().positive(),
  tipo: z.enum(['AJUSTE_ENTRADA', 'AJUSTE_SAIDA', 'PERDA']),
  quantidade: milesimos,
  motivo: z.string().trim().min(3, 'Descreva o motivo do ajuste').max(300),
});
export type DadosAjuste = z.infer<typeof ajusteSchema>;

export const inventarioSchema = z.object({
  itens: z
    .array(z.object({ produtoId: z.number().int().positive(), contado: z.number().int().min(0).max(1_000_000_000) }))
    .min(1, 'Informe a contagem de pelo menos um produto')
    .max(5000),
  observacao: textoOpcional(300),
});
export type DadosInventario = z.infer<typeof inventarioSchema>;

export const movimentacoesSchema = z.object({
  produtoId: z.coerce.number().int().positive().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

export const entradaSchema = z
  .object({
    fornecedorId: idOpcional,
    numeroNota: textoOpcional(30),
    dataEmissao: z.iso.date().nullish().transform((v) => (v ? new Date(`${v}T12:00:00`) : null)),
    frete: centavos.default(0),
    outrasDespesas: centavos.default(0),
    desconto: centavos.default(0),
    observacoes: textoOpcional(500),
    itens: z
      .array(
        z.object({
          produtoId: z.number().int().positive(),
          unidadeId: z.number().int().positive(),
          quantidade: milesimos,
          custoUnitario: centavos,
        }),
      )
      .min(1, 'Adicione pelo menos um produto')
      .max(500),
  });
export type DadosEntrada = z.infer<typeof entradaSchema>;

export const cancelarEntradaSchema = z.object({
  motivo: z.string().trim().min(5, 'Explique o motivo do cancelamento').max(300),
});

export const listarEntradasSchema = z.object({
  fornecedorId: z.coerce.number().int().positive().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});
