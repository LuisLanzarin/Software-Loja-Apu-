import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Botao, Cabecalho, Carregando, Cartao } from '../components/ui';
import { api } from '../lib/api';
import { formatarDataHora } from '../lib/formato';

interface Registro {
  id: number;
  acao: string;
  entidade: string | null;
  entidadeId: string | null;
  detalhes: string | null;
  ip: string | null;
  criadoEm: string;
  usuario: { nome: string; login: string } | null;
}

const ACOES: Record<string, string> = {
  'setup.concluido': 'Sistema configurado',
  'login.sucesso': 'Entrou no sistema',
  'login.falha': 'Tentativa de login falhou',
  'login.bloqueado': 'Usuário bloqueado (senhas erradas)',
  logout: 'Saiu do sistema',
  'senha.trocada': 'Trocou a própria senha',
  'usuario.criado': 'Criou usuário',
  'usuario.alterado': 'Alterou usuário',
  'usuario.senha_redefinida': 'Redefiniu senha de usuário',
  'usuario.desbloqueado': 'Desbloqueou usuário',
  'configuracao.alterada': 'Alterou configurações',
};

export function Auditoria() {
  const [pagina, setPagina] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['auditoria', pagina],
    queryFn: () => api<{ itens: Registro[]; total: number; porPagina: number }>(`/auditoria?pagina=${pagina}`),
    placeholderData: keepPreviousData,
  });
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <>
      <Cabecalho titulo="Auditoria" descricao="Registro de quem fez o quê e quando. Não pode ser alterado." />
      <Cartao className="overflow-hidden [&>div]:p-0">
        {isLoading ? (
          <Carregando />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3">Data e hora</th>
                <th className="px-5 py-3">Usuário</th>
                <th className="px-5 py-3">Ação</th>
                <th className="px-5 py-3">Computador (IP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data?.itens.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap tabular-nums text-stone-600">{formatarDataHora(r.criadoEm)}</td>
                  <td className="px-5 py-2.5">{r.usuario?.nome ?? <span className="text-stone-400">—</span>}</td>
                  <td className="px-5 py-2.5">
                    {ACOES[r.acao] ?? r.acao}
                    {r.acao === 'login.falha' && !r.usuario && r.detalhes && (
                      <span className="text-stone-500"> (login: {JSON.parse(r.detalhes).login})</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-stone-500">{r.ip?.replace('::ffff:', '') ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>
      <div className="mt-4 flex items-center justify-end gap-3 text-sm text-stone-600">
        <span>
          Página {pagina} de {paginas}
        </span>
        <Botao variante="secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
          Anterior
        </Botao>
        <Botao variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
          Próxima
        </Botao>
      </div>
    </>
  );
}
