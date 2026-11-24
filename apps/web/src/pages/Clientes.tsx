import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { ClienteForm } from '../components/ClienteForm';
import { Botao, Cabecalho, Carregando, Cartao, Etiqueta, Janela, Paginacao, Tabela, Vazio } from '../components/ui';
import { api } from '../lib/api';
import { formatarDocumento } from '../lib/formato';
import { usePode } from '../lib/sessao';
import type { Cliente, Pagina } from '../lib/tipos';

export function Clientes() {
  const qc = useQueryClient();
  const pode = usePode()('cliente.editar');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(null);
  const q = useDeferredValue(busca);
  const { data, isLoading } = useQuery({
    queryKey: ['clientes', q, pagina],
    queryFn: () => api<Pagina<Cliente>>(`/clientes?${new URLSearchParams({ q, pagina: String(pagina), situacao: 'todos' })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <Cabecalho titulo="Clientes" descricao="Opcional nas vendas; obrigatório (com CPF/CNPJ) para boleto."
        acoes={pode && <Botao onClick={() => setEditando('novo')}><UserPlus className="size-4" aria-hidden /> Novo cliente</Botao>} />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-stone-400" aria-hidden />
        <input type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar por nome, CPF/CNPJ ou telefone…" aria-label="Buscar clientes"
          className="block w-full rounded-md border-0 bg-white py-2 pr-3 pl-9 text-sm ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-marca-600 focus:outline-none" />
      </div>
      <Cartao className="overflow-hidden [&>div]:p-0">
        {isLoading ? <Carregando /> : (
          <Tabela colunas={[{ titulo: 'Nome' }, { titulo: 'CPF / CNPJ' }, { titulo: 'Telefone' }, { titulo: 'Cidade' }]} vazio={!data?.itens.length && <Vazio>Nenhum cliente encontrado.</Vazio>}>
            {data?.itens.map((c) => (
              <tr key={c.id} onClick={pode ? () => setEditando(c) : undefined} className={`${pode ? 'cursor-pointer hover:bg-marca-50/50' : ''} ${c.ativo ? '' : 'text-stone-400'}`}>
                <td className="px-4 py-2.5 font-medium">{c.nome} {!c.ativo && <Etiqueta>Inativo</Etiqueta>}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{formatarDocumento(c.documento) || '—'}</td>
                <td className="px-4 py-2.5">{c.telefone ?? '—'}</td>
                <td className="px-4 py-2.5 text-stone-600">{[c.cidade, c.uf].filter(Boolean).join('/') || '—'}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
      {data && <Paginacao pagina={pagina} total={data.total} porPagina={data.porPagina} aoMudar={setPagina} />}
      <Janela aberta={!!editando} aoFechar={() => setEditando(null)} titulo={editando === 'novo' ? 'Novo cliente' : 'Editar cliente'} largura="max-w-2xl">
        {editando && (
          <ClienteForm key={editando === 'novo' ? 'novo' : editando.id} cliente={editando === 'novo' ? null : editando} aoCancelar={() => setEditando(null)}
            aoSalvar={() => { setEditando(null); qc.invalidateQueries({ queryKey: ['clientes'] }); }} />
        )}
      </Janela>
    </>
  );
}
