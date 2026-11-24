import { useQuery } from '@tanstack/react-query';
import { UserPlus, X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { ClienteForm } from '../../components/ClienteForm';
import { Janela } from '../../components/ui';
import { api } from '../../lib/api';
import { formatarDocumento } from '../../lib/formato';
import type { Cliente, Pagina } from '../../lib/tipos';

export function SeletorCliente({ cliente, aoMudar }: { cliente: Cliente | null; aoMudar: (c: Cliente | null) => void }) {
  const [texto, setTexto] = useState('');
  const [novo, setNovo] = useState(false);
  const q = useDeferredValue(texto.trim());
  const { data } = useQuery({
    queryKey: ['clientes-busca', q],
    queryFn: () => api<Pagina<Cliente>>(`/clientes?${new URLSearchParams({ q, porPagina: '6' })}`),
    enabled: q.length >= 2,
  });

  if (cliente) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-md bg-stone-50 p-3 ring-1 ring-stone-200">
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{cliente.nome}</p>
          <p className="text-xs text-stone-500">{[formatarDocumento(cliente.documento), cliente.telefone].filter(Boolean).join(' · ') || 'Sem CPF/CNPJ'}</p>
        </div>
        <button onClick={() => aoMudar(null)} className="rounded p-1 text-stone-500 hover:bg-stone-200" aria-label="Remover cliente">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar cliente (opcional)…"
          aria-label="Buscar cliente"
          className="block w-full rounded-md border-0 bg-white px-3 py-2 text-sm ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-marca-600 focus:outline-none"
        />
        <button onClick={() => setNovo(true)} className="rounded-md px-2.5 text-stone-600 ring-1 ring-stone-300 hover:bg-stone-50" title="Cadastrar cliente" aria-label="Cadastrar cliente">
          <UserPlus className="size-4" />
        </button>
      </div>
      {q.length >= 2 && data && (
        <ul className="absolute z-20 mt-1 w-full rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-stone-200">
          {data.itens.length === 0 && <li className="px-3 py-2 text-stone-500">Nenhum cliente. Use + para cadastrar.</li>}
          {data.itens.map((c) => (
            <li key={c.id}>
              <button onClick={() => { aoMudar(c); setTexto(''); }} className="w-full px-3 py-2 text-left hover:bg-marca-50">
                <span className="font-medium">{c.nome}</span>
                <span className="block text-xs text-stone-500">{formatarDocumento(c.documento) || c.telefone || ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Janela aberta={novo} aoFechar={() => setNovo(false)} titulo="Novo cliente" largura="max-w-xl">
        {novo && <ClienteForm completo={false} aoCancelar={() => setNovo(false)} aoSalvar={(c) => { aoMudar(c); setNovo(false); }} />}
      </Janela>
    </div>
  );
}
