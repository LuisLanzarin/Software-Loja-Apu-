import { Perfil } from '../generated/prisma/enums.ts';

const { VENDEDOR, FINANCEIRO, GERENTE, ADMIN } = Perfil;

/**
 * Matriz de permissões. Para mudar quem pode o quê, altere só aqui.
 * As próximas etapas acrescentam permissões de produtos, estoque, vendas e caixa.
 */
export const PERMISSOES = {
  'usuarios.gerenciar': [ADMIN],
  'configuracao.editar': [GERENTE, ADMIN],
  'auditoria.ver': [GERENTE, ADMIN],
  'produto.ver_custo': [FINANCEIRO, GERENTE, ADMIN],
  'produto.editar': [FINANCEIRO, GERENTE, ADMIN],
  'preco.reajustar': [FINANCEIRO, GERENTE, ADMIN],
  'precificacao.editar': [FINANCEIRO, GERENTE, ADMIN],
  'fornecedor.ver': [FINANCEIRO, GERENTE, ADMIN],
  'fornecedor.editar': [FINANCEIRO, GERENTE, ADMIN],
  'cadastros.editar': [FINANCEIRO, GERENTE, ADMIN],
  'estoque.entrada': [FINANCEIRO, GERENTE, ADMIN],
  'estoque.ajustar': [GERENTE, ADMIN],
  'estoque.cancelar_entrada': [GERENTE, ADMIN],
  'venda.realizar': [VENDEDOR, GERENTE, ADMIN],
  'venda.ver_todas': [FINANCEIRO, GERENTE, ADMIN],
  'caixa.operar': [VENDEDOR, GERENTE, ADMIN],
  'caixa.ver_todos': [FINANCEIRO, GERENTE, ADMIN],
  'cliente.editar': [VENDEDOR, FINANCEIRO, GERENTE, ADMIN],
  'boleto.baixar': [FINANCEIRO, GERENTE, ADMIN],
  'relatorio.ver': [FINANCEIRO, GERENTE, ADMIN],
  'backup.gerenciar': [ADMIN],
  'venda.autorizar': [GERENTE, ADMIN],
} as const satisfies Record<string, readonly Perfil[]>;

export type Permissao = keyof typeof PERMISSOES;

export function permissoesDoPerfil(perfil: Perfil): Permissao[] {
  return (Object.keys(PERMISSOES) as Permissao[]).filter((p) =>
    (PERMISSOES[p] as readonly Perfil[]).includes(perfil),
  );
}

export function temPermissao(perfil: Perfil, permissao: Permissao): boolean {
  return (PERMISSOES[permissao] as readonly Perfil[]).includes(perfil);
}
