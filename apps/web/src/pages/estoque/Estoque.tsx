import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ClipboardCheck, PackagePlus, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Botao, Cabecalho, Carregando, Cartao, Etiqueta, Paginacao, Selecao, Tabela, Vazio } from '../../components/ui';
import { api } from '../../lib/api';
import { useCategorias } from '../../lib/consultas';
import { formatarQtd, formatarReais } from '../../lib/formato';
import { usePode } from '../../lib/sessao';
import type { Pagina, Produto, Resumo } from '../../lib/tipos';

export function SituacaoEstoque({ p }: { p: Pick<Produto, 'estoqueAtual' | 'estoqueMinimo'> }) {
  if (p.estoqueAtual <= 0) return <Etiqueta cor="vermelho">Sem estoque</Etiqueta>;
  if (p.estoqueMinimo > 0 && p.estoqueAtual < p.estoqueMinimo) return <Etiqueta cor="laranja">Repor</Etiqueta>;
  return <Etiqueta cor="verde">OK</Etiqueta>;
}

function Indicador({ titulo, valor, destaque, ativo, onClick }: { titulo: string; valor: string; destaque?: boolean; ativo?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`rounded-lg bg-white p-4 text-left shadow-sm ring-1 ${ativo ? 'ring-2 ring-marca-600' : 'ring-stone-200'} ${onClick ? 'hover:ring-marca-500' : ''}`}
    >
      <p className="text-sm text-stone-600">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${destaque ? 'text-marca-700' : ''}`}>{valor}</p>
    </Tag>
  );
}

export function Estoque() {
  const pode = usePode();
  const navegar = useNavigate();
  const verCusto = pode('produto.ver_custo');
  const [params, setParams] = useSearchParams();
  const filtro = params.get('filtro') ?? 'todos';
  const [busca, setBusca] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [pagina, setPagina] = useState(1);
  const q = useDeferredValue(busca);
  const { data: categorias } = useCategorias();
  const { data: resumo } = useQuery({ queryKey: ['estoque-resumo'], queryFn: () => api<Resumo>('/estoque/resumo') });

  const qs = new URLSearchParams({ q, estoque: filtro, pagina: String(pagina), ...(categoriaId ? { categoriaId } : {}) });
  const { data, isLoading } = useQuery({
    queryKey: ['produtos', 'estoque', qs.toString()],
    queryFn: () => api<Pagina<Produto>>(`/produtos?${qs}`),
    placeholderData: keepPreviousData,
  });

  const mudarFiltro = (f: string) => {
    setParams(f === 'todos' || f === filtro ? {} : { filtro: f });
    setPagina(1);
  };

  return (
    <>
      <Cabecalho
        titulo="Estoque"
        descricao="Saldos, alertas de reposição e histórico de cada produto."
        acoes={
          <>
            {pode('estoque.ajustar') && (
              <Botao variante="secundario" onClick={() => navegar('/estoque/inventario')}>
                <ClipboardCheck className="size-4" aria-hidden /> Inventário
              </Botao>
            )}
            {pode('estoque.entrada') && (
              <Botao onClick={() => navegar('/entradas/nova')}>
                <PackagePlus className="size-4" aria-hidden /> Entrada de mercadoria
              </Botao>
            )}
          </>
        }
      />

      {resumo && (
        <div className={`mb-6 grid gap-4 ${verCusto ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <Indicador titulo="Produtos ativos" valor={resumo.ativos.toLocaleString('pt-BR')} ativo={filtro === 'todos'} onClick={() => mudarFiltro('todos')} />
          <Indicador titulo="Abaixo do mínimo" valor={resumo.abaixoMinimo.toLocaleString('pt-BR')} destaque={resumo.abaixoMinimo > 0} ativo={filtro === 'abaixo_minimo'} onClick={() => mudarFiltro('abaixo_minimo')} />
          <Indicador titulo="Sem estoque" valor={resumo.semEstoque.toLocaleString('pt-BR')} destaque={resumo.semEstoque > 0} ativo={filtro === 'sem_estoque'} onClick={() => mudarFiltro('sem_estoque')} />
          {verCusto && resumo.valorEstoque !== undefined && <Indicador titulo="Valor em estoque (custo)" valor={formatarReais(resumo.valorEstoque)} />}
        </div>
      )}

      <div className="mb-4 flex items-end gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-stone-400" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
            placeholder="Buscar produto…"
            aria-label="Buscar produto no estoque"
            className="block w-full rounded-md border-0 bg-white py-2 pr-3 pl-9 text-sm ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-marca-600 focus:outline-none"
          />
        </div>
        <Selecao rotulo="Categoria" value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); setPagina(1); }} className="w-56">
          <option value="">Todas</option>
          {categorias?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Selecao>
      </div>

      <Cartao className="overflow-hidden [&>div]:p-0">
        {isLoading ? <Carregando /> : (
          <Tabela
            colunas={[
              { titulo: 'Código' }, { titulo: 'Produto' }, { titulo: 'Saldo', direita: true }, { titulo: 'Mínimo', direita: true }, { titulo: 'Situação' },
              ...(verCusto ? [{ titulo: 'Custo médio', direita: true }, { titulo: 'Valor', direita: true }] : []),
            ]}
            vazio={!data?.itens.length && <Vazio>Nenhum produto neste filtro.</Vazio>}
          >
            {data?.itens.map((p) => (
              <tr key={p.id} onClick={() => navegar(`/estoque/${p.id}`)} className="cursor-pointer hover:bg-marca-50/50">
                <td className="px-4 py-2.5 font-mono text-xs">{p.codigo}</td>
                <td className="px-4 py-2.5">
                  <span className="font-medium">{p.descricao}</span>
                  {p.localizacao && <span className="block text-xs text-stone-500">Local: {p.localizacao}</span>}
                </td>
                <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${p.estoqueAtual < 0 ? 'text-red-700' : ''}`}>
                  {formatarQtd(p.estoqueAtual)} <span className="font-normal text-stone-500">{p.unidade.sigla}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">{p.estoqueMinimo ? formatarQtd(p.estoqueMinimo) : '—'}</td>
                <td className="px-4 py-2.5"><SituacaoEstoque p={p} /></td>
                {verCusto && (
                  <>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">{formatarReais(p.custo ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatarReais(Math.max(0, Math.round((p.estoqueAtual * (p.custo ?? 0)) / 1000)))}</td>
                  </>
                )}
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
      {data && <Paginacao pagina={pagina} total={data.total} porPagina={data.porPagina} aoMudar={setPagina} />}
    </>
  );
}
