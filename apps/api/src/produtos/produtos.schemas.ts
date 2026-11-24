import { z } from 'zod';
import { centavos, idOpcional, pontosBase, situacaoSchema, textoOpcional } from '../common/esquemas.ts';
import { gtinValido } from '../common/gtin.ts';

export const produtoSchema = z.object({
  codigo: textoOpcional(30).refine((v) => v === null || !/\s/.test(v), 'O código não pode ter espaços'),
  codigoBarras: textoOpcional(14).refine(
    (v) => v === null || gtinValido(v),
    'Código de barras inválido (confira os números)',
  ),
  descricao: z.string().trim().min(2, 'Informe a descrição').max(120),
  marca: textoOpcional(60),
  categoriaId: idOpcional,
  unidadeId: z.number({ error: 'Escolha a unidade de venda' }).int().positive(),
  custo: centavos,
  precoVenda: centavos.refine((v) => v > 0, 'Informe o preço de venda'),
  margemPct: pontosBase.nullish().transform((v) => v ?? null),
  estoqueMinimo: z.number().int().min(0).max(1_000_000_000).default(0),
  localizacao: textoOpcional(40),
  observacoes: textoOpcional(1000),
  ativo: z.boolean().default(true),
  conversoes: z
    .array(z.object({ unidadeId: z.number().int().positive(), fator: z.number().int().positive('O fator deve ser maior que zero').max(1_000_000_000) }))
    .max(10)
    .default([]),
  fornecedores: z
    .array(z.object({ fornecedorId: z.number().int().positive(), codigoFornecedor: textoOpcional(40) }))
    .max(20)
    .default([]),
});
export type DadosProduto = z.infer<typeof produtoSchema>;

export const filtroProdutosSchema = z.object({
  q: z.string().max(120).optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  fornecedorId: z.coerce.number().int().positive().optional(),
  situacao: situacaoSchema,
  estoque: z.enum(['todos', 'abaixo_minimo', 'sem_estoque']).default('todos'),
  pagina: z.coerce.number().int().min(1).default(1),
  /** Inventário usa listas grandes de uma vez. */
  porPagina: z.coerce.number().int().min(1).max(2000).default(50),
});
export type FiltroProdutos = z.infer<typeof filtroProdutosSchema>;

export const TIPOS_REAJUSTE = {
  /** Custo e preço mudam no mesmo %: a margem atual de cada produto se mantém. */
  CUSTO_PERCENTUAL: 'Custo e preço no mesmo % (mantém a margem atual)',
  /** Custo muda e o preço passa a ser o sugerido pela margem desejada. */
  CUSTO_PERCENTUAL_SUGERIDO: 'Custo em % e preço pela margem desejada',
  PRECO_PERCENTUAL: 'Preço de venda em %',
  PRECO_SUGERIDO: 'Preço sugerido pela margem desejada (custo atual)',
} as const;

export const reajusteSchema = z
  .object({
    categoriaId: z.number().int().positive().nullish(),
    fornecedorId: z.number().int().positive().nullish(),
    tipo: z.enum(Object.keys(TIPOS_REAJUSTE) as [keyof typeof TIPOS_REAJUSTE]),
    /** Pontos-base; negativo reduz. -90% a +500%. */
    percentual: z.number().int().min(-9000).max(50000).nullish(),
  })
  .refine((r) => r.tipo === 'PRECO_SUGERIDO' || (r.percentual != null && r.percentual !== 0), {
    message: 'Informe o percentual de reajuste',
    path: ['percentual'],
  });
export type DadosReajuste = z.infer<typeof reajusteSchema>;
