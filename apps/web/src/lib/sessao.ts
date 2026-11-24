import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api, ApiError } from './api';
import type { Perfil } from './formato';

export type Permissao =
  | 'usuarios.gerenciar'
  | 'configuracao.editar'
  | 'auditoria.ver'
  | 'produto.ver_custo'
  | 'produto.editar'
  | 'preco.reajustar'
  | 'precificacao.editar'
  | 'fornecedor.ver'
  | 'fornecedor.editar'
  | 'cadastros.editar'
  | 'venda.autorizar';

export interface Sessao {
  id: number;
  nome: string;
  login: string;
  perfil: Perfil;
  trocarSenha: boolean;
  permissoes: Permissao[];
  loja: { nome: string; sessaoInatividadeMin: number };
}

/** Usuário logado, ou null se não houver sessão. */
export function useSessao() {
  return useQuery({
    queryKey: ['sessao'],
    queryFn: () =>
      api<Sessao>('/auth/eu').catch((e) => {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }),
    staleTime: Infinity,
  });
}

export function useUsuario(): Sessao {
  const { data } = useSessao();
  if (!data) throw new Error('useUsuario usado fora de uma área logada');
  return data;
}

export function usePode() {
  const u = useUsuario();
  return (p: Permissao) => u.permissoes.includes(p);
}

export function useSair() {
  const qc = useQueryClient();
  return useCallback(
    async (motivo?: string) => {
      await api('/auth/sair', { method: 'POST' }).catch(() => undefined);
      if (motivo) sessionStorage.setItem('motivoSaida', motivo);
      limparSessao(qc);
    },
    [qc],
  );
}

/** Marca "ninguém logado" e descarta os dados do usuário anterior. */
export function limparSessao(qc: QueryClient) {
  qc.setQueryData(['sessao'], null);
  qc.removeQueries({ predicate: (q) => !['sessao', 'setup'].includes(q.queryKey[0] as string) });
}
