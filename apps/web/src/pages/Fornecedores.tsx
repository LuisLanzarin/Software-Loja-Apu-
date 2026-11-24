import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useDeferredValue, useState, type FormEvent } from 'react';
import { Alerta, AreaTexto, Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Janela, Selecao, Tabela, Vazio } from '../components/ui';
import { api } from '../lib/api';
import { formatarDocumento } from '../lib/formato';
import { usePode } from '../lib/sessao';
import type { Fornecedor } from '../lib/tipos';

export function Fornecedores() {
  const qc = useQueryClient();
  const pode = usePode();
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('ativos');
  const [editando, setEditando] = useState<Fornecedor | 'novo' | null>(null);
  const [erro, setErro] = useState('');
  const q = useDeferredValue(busca);

  const { data, isLoading } = useQuery({
    queryKey: ['fornecedores', situacao, q],
    queryFn: () => api<Fornecedor[]>(`/fornecedores?${new URLSearchParams({ situacao, q })}`),
  });

  const salvar = useMutation({
    mutationFn: (corpo: unknown) =>
      editando && editando !== 'novo'
        ? api(`/fornecedores/${editando.id}`, { method: 'PATCH', body: corpo })
        : api('/fornecedores', { method: 'POST', body: corpo }),
    onSuccess: () => {
      setEditando(null);
      return qc.invalidateQueries({ queryKey: ['fornecedores'] });
    },
    onError: (e) => setErro(e.message),
  });

  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>;
    salvar.mutate({
      ...f,
      prazoEntregaDias: f.prazoEntregaDias ? Number(f.prazoEntregaDias) : null,
      ativo: f.ativo !== 'nao',
    });
  }

  const atual = editando !== 'novo' ? editando : null;

  return (
    <>
      <Cabecalho
        titulo="Fornecedores"
        descricao="De quem a loja compra."
        acoes={
          pode('fornecedor.editar') && (
            <Botao onClick={() => { setErro(''); setEditando('novo'); }}>
              <Plus className="size-4" aria-hidden /> Novo fornecedor
            </Botao>
          )
        }
      />
      <div className="mb-4 flex items-end gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-stone-400" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, cidade ou CNPJ…"
            aria-label="Buscar fornecedores"
            className="block w-full rounded-md border-0 bg-white py-2 pr-3 pl-9 text-sm ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-marca-600 focus:outline-none"
          />
        </div>
        <Selecao rotulo="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value)} className="w-36">
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </Selecao>
      </div>

      <Cartao className="overflow-hidden [&>div]:p-0">
        {isLoading ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={[{ titulo: 'Fornecedor' }, { titulo: 'CNPJ / CPF' }, { titulo: 'Contato' }, { titulo: 'Cidade' }, { titulo: 'Produtos', direita: true }]}
            vazio={!data?.length && <Vazio>Nenhum fornecedor encontrado.</Vazio>}
          >
            {data?.map((f) => (
              <tr
                key={f.id}
                onClick={pode('fornecedor.editar') ? () => { setErro(''); setEditando(f); } : undefined}
                className={`${pode('fornecedor.editar') ? 'cursor-pointer hover:bg-marca-50/50' : ''} ${f.ativo ? '' : 'text-stone-400'}`}
              >
                <td className="px-4 py-2.5">
                  <span className="font-medium">{f.nomeFantasia || f.razaoSocial}</span>
                  {f.nomeFantasia && <span className="block text-xs text-stone-500">{f.razaoSocial}</span>}
                  {!f.ativo && <Etiqueta>Inativo</Etiqueta>}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{formatarDocumento(f.documento) || '—'}</td>
                <td className="px-4 py-2.5">
                  {f.contato && <span className="block">{f.contato}</span>}
                  <span className="text-xs text-stone-500">{[f.telefone, f.email].filter(Boolean).join(' · ') || '—'}</span>
                </td>
                <td className="px-4 py-2.5 text-stone-600">{[f.cidade, f.uf].filter(Boolean).join('/') || '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{f.totalProdutos ?? 0}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Janela aberta={!!editando} aoFechar={() => setEditando(null)} titulo={atual ? 'Editar fornecedor' : 'Novo fornecedor'} largura="max-w-2xl">
        <form key={atual?.id ?? 'novo'} onSubmit={enviar} className="grid gap-4 sm:grid-cols-6">
          <Campo rotulo="Razão social ou nome" name="razaoSocial" required autoFocus defaultValue={atual?.razaoSocial} className="sm:col-span-4" />
          <Campo rotulo="CNPJ ou CPF" name="documento" defaultValue={formatarDocumento(atual?.documento ?? null)} className="sm:col-span-2" />
          <Campo rotulo="Nome fantasia" name="nomeFantasia" defaultValue={atual?.nomeFantasia ?? ''} className="sm:col-span-3" />
          <Campo rotulo="Pessoa de contato" name="contato" defaultValue={atual?.contato ?? ''} className="sm:col-span-3" />
          <Campo rotulo="Telefone / WhatsApp" name="telefone" type="tel" defaultValue={atual?.telefone ?? ''} className="sm:col-span-2" />
          <Campo rotulo="E-mail" name="email" type="email" defaultValue={atual?.email ?? ''} className="sm:col-span-4" />
          <Campo rotulo="Cidade" name="cidade" defaultValue={atual?.cidade ?? ''} className="sm:col-span-3" />
          <Campo rotulo="UF" name="uf" maxLength={2} defaultValue={atual?.uf ?? ''} className="sm:col-span-1" />
          <Campo rotulo="Prazo de entrega (dias)" name="prazoEntregaDias" type="number" min={0} max={365} defaultValue={atual?.prazoEntregaDias ?? ''} className="sm:col-span-2" />
          <AreaTexto rotulo="Observações" name="observacoes" defaultValue={atual?.observacoes ?? ''} className="sm:col-span-6" />
          {atual && (
            <Selecao rotulo="Situação" name="ativo" defaultValue={atual.ativo ? 'sim' : 'nao'} className="sm:col-span-3">
              <option value="sim">Ativo</option>
              <option value="nao">Inativo</option>
            </Selecao>
          )}
          <div className="sm:col-span-6">
            <Alerta>{erro}</Alerta>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-6">
            <Botao type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
            <Botao type="submit" carregando={salvar.isPending}>Salvar</Botao>
          </div>
        </form>
      </Janela>
    </>
  );
}
