import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { forwardRef, useDeferredValue, useId, useImperativeHandle, useRef, useState } from 'react';
import { api } from '../lib/api';
import { formatarQtd, formatarReais } from '../lib/formato';
import type { Pagina, Produto } from '../lib/tipos';

export interface BuscaProdutoRef {
  focar: () => void;
}

/**
 * Campo de busca de produto com lista suspensa e teclado (↑ ↓ Enter Esc).
 * Leitor de código de barras funciona como teclado: digita o código + Enter.
 */
export const BuscaProduto = forwardRef<BuscaProdutoRef, { aoEscolher: (p: Produto) => void; autoFocus?: boolean; placeholder?: string }>(
  function BuscaProduto({ aoEscolher, autoFocus, placeholder }, ref) {
    const [texto, setTexto] = useState('');
    const [aberto, setAberto] = useState(false);
    const [ativo, setAtivo] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    // Fecha a lista um instante depois de perder o foco (para o clique na opção funcionar),
    // mas cancela se o usuário voltar a digitar antes — leitores de código de barras são rápidos.
    const timerFechar = useRef<number>(undefined);
    const abrir = () => { window.clearTimeout(timerFechar.current); setAberto(true); };
    const idLista = useId();
    const q = useDeferredValue(texto.trim());
    useImperativeHandle(ref, () => ({ focar: () => input.current?.focus() }));

    const { data, isFetching } = useQuery({
      queryKey: ['busca-produto', q],
      queryFn: () => api<Pagina<Produto>>(`/produtos?${new URLSearchParams({ q, situacao: 'ativos', porPagina: '10' })}`),
      enabled: q.length >= 2,
      staleTime: 10_000,
    });
    const itens = q.length >= 2 ? (data?.itens ?? []) : [];

    function escolher(p: Produto) {
      aoEscolher(p);
      setTexto('');
      setAberto(false);
      setAtivo(0);
      input.current?.focus();
    }

    async function aoTeclar(e: React.KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); abrir(); setAtivo((a) => Math.min(a + 1, itens.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
      if (e.key === 'Escape') setAberto(false);
      if (e.key === 'Enter') {
        e.preventDefault();
        const termo = texto.trim();
        // Código digitado/lido inteiro: busca direto, sem esperar a lista.
        const exato = itens.find((p) => p.codigo === termo || p.codigoBarras === termo);
        if (exato) return escolher(exato);
        if (q === termo && itens[ativo]) return escolher(itens[ativo]);
        if (termo) {
          const r = await api<Pagina<Produto>>(`/produtos?${new URLSearchParams({ q: termo, situacao: 'ativos', porPagina: '2' })}`);
          if (r.itens.length === 1) return escolher(r.itens[0]);
          abrir();
        }
      }
    }

    return (
      <div className="relative">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-stone-400" aria-hidden />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={aberto && itens.length > 0}
          aria-controls={idLista}
          aria-label="Buscar produto"
          autoFocus={autoFocus}
          autoComplete="off"
          value={texto}
          placeholder={placeholder ?? 'Digite o nome, código ou passe o leitor de código de barras…'}
          onChange={(e) => { setTexto(e.target.value); abrir(); setAtivo(0); }}
          onKeyDown={aoTeclar}
          onBlur={() => { timerFechar.current = window.setTimeout(() => setAberto(false), 150); }}
          onFocus={() => texto && abrir()}
          className="block w-full rounded-md border-0 bg-white py-2 pr-3 pl-9 text-sm ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-marca-600 focus:outline-none"
        />
        {aberto && q.length >= 2 && (
          <ul id={idLista} role="listbox" className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-stone-200">
            {itens.length === 0 && <li className="px-3 py-2 text-stone-500">{isFetching ? 'Buscando…' : 'Nenhum produto encontrado.'}</li>}
            {itens.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === ativo}
                onMouseDown={(e) => { e.preventDefault(); escolher(p); }}
                onMouseEnter={() => setAtivo(i)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === ativo ? 'bg-marca-50' : ''}`}
              >
                <span className="w-16 shrink-0 font-mono text-xs text-stone-500">{p.codigo}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{p.descricao}</span>
                <span className={`shrink-0 text-xs tabular-nums ${p.estoqueAtual <= 0 ? 'text-red-600' : 'text-stone-500'}`}>
                  {formatarQtd(p.estoqueAtual)} {p.unidade.sigla}
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums">{formatarReais(p.precoVenda)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
