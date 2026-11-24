import { z } from 'zod';
import { centavos, idOpcional, textoOpcional } from '../common/esquemas.ts';

export const autorizacaoSchema = z
  .object({ login: z.string().trim().min(1).max(40), senha: z.string().min(1).max(128) })
  .nullish();

export const pagamentoSchema = z.object({
  forma: z.enum(['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'BOLETO']),
  valor: centavos.refine((v) => v > 0, 'Valor do pagamento deve ser maior que zero'),
  parcelas: z.number().int().min(1).max(24).default(1),
  /** Boleto: data do 1º vencimento (AAAA-MM-DD) e intervalo entre parcelas. */
  primeiroVencimento: z.iso.date().nullish(),
  intervaloDias: z.number().int().min(1).max(120).default(30),
});

export const vendaSchema = z.object({
  /** false = salvar como orçamento */
  finalizar: z.boolean(),
  orcamentoId: z.number().int().positive().nullish(),
  clienteId: idOpcional,
  itens: z
    .array(
      z.object({
        produtoId: z.number().int().positive(),
        quantidade: z.number().int().positive('Quantidade deve ser maior que zero').max(1_000_000_000),
        desconto: centavos.default(0),
      }),
    )
    .min(1, 'Adicione pelo menos um produto')
    .max(300),
  descontoGeral: centavos.default(0),
  /** Taxa de serviço opcional: o percentual vem da configuração, nunca da tela. */
  cobrarTaxaServico: z.boolean().default(false),
  observacoes: textoOpcional(500),
  pagamentos: z.array(pagamentoSchema).max(10).default([]),
  autorizacao: autorizacaoSchema,
});
export type DadosVenda = z.infer<typeof vendaSchema>;

export const cancelarSchema = z.object({
  motivo: z.string().trim().min(5, 'Explique o motivo do cancelamento').max(300),
  autorizacao: autorizacaoSchema,
});

export const listarVendasSchema = z.object({
  status: z.enum(['ORCAMENTO', 'CONVERTIDO', 'FINALIZADA', 'CANCELADA']).optional(),
  de: z.iso.date().optional(),
  ate: z.iso.date().optional(),
  clienteId: z.coerce.number().int().positive().optional(),
  vendedorId: z.coerce.number().int().positive().optional(),
  numero: z.coerce.number().int().positive().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});
export type FiltroVendas = z.infer<typeof listarVendasSchema>;
