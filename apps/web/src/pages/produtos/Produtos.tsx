import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PackagePlus, Percent, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router';
import { Botao, Cabecalho, Carregando, Cartao, Etiqueta, Margem, Paginacao, Selecao, Tabela, Vazio } from '../../components/ui';
import { api } from '../../lib/api';
import { useCategorias } from '../../lib/consultas';
import { formatarReais } from '../../lib/formato';
import { usePode } from '../../lib/sessao';
import type { Pagina, Produto } from '../../lib/tipos';

export function Produtos() {
  const pode = usePode();
  const navegar = useNavigate();
  const verCusto = pode('produto.ver_custo');
  const editar = pode('produto.editar');

  const [busca, setBusca] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [situacao, setSituacao] = useState('ativos');
  const [pagina, setPagina] = useState(1);
  const q = useDeferredValue(busca);
  const { data: categorias } = useCategorias();

  const params = new URLSearchParams({ q, situacao, pagina: String(pagina), ...(categoriaId ? { categoriaId } : {}) });
  const { data, isLoading } = useQuery({
    queryKey: ['produtos', params.toString()],
    queryFn: () => api<Pagina<Produto>>(`/produtos?${params}`),
    placeholderData: keepPreviousData,
  });

  const filtrar = (f: () => void) => {
    f();
    setPagina(1);
  };

  const colunas = [
    { titulo: 'Código' },
    { titulo: 'Descrição' },
    { titulo: 'Categoria' },
    { titulo: 'Un.' },
    ...(verCusto ? [{ titulo: 'Custo', direita: true }] : []),
    { titulo: 'Preço', direita: true },
    ...(verCusto ? [{ titulo: 'Margem', direita: true }] : []),
  ];

  return (
    <>
      <Cabecalho
        titulo="Produtos"
        descricao={verCusto ? 'Cadastro, preços e margens.' : 'Consulta de produtos e preços.'}
        acoes={
          <>
            {pode('preco.reajustar') && (
              <Botao variante="secundario" onClick={() => navegar('/produtos/reajuste')}>
                <Percent className="size-4" aria-hidden /> Reajustar preços
              </Botao>
            )}
            {editar && (
              <Botao onClick={() => navegar('/produtos/novo')}>
                <PackagePlus className="size-4" aria-hidden /> Novo produto
              </Botao>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-72 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-stone-400" aria-hidden />
          <input
            type="search"
            autoFocus
            value={busca}
            onChange={(e) => filtrar(() => setBusca(e.target.value))}
            placeholder="Buscar por descrição, código, código de barras ou marca…"
            aria-label="Buscar produtos"
            className="block w-full rounded-md border-0 bg-white py-2 pr-3 pl-9 text-sm ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-marca-600 focus:outline-none"
          />
        </div>
        <Selecao rotulo="Categoria" value={categoriaId} onChange={(e) => filtrar(() => setCategoriaId(e.target.value))} className="w-48">
          <option value="">Todas</option>
          {categorias?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Selecao>
        <Selecao rotulo="Situação" value={situacao} onChange={(e) => filtrar(() => setSituacao(e.target.value))} className="w-36">
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </Selecao>
      </div>

      <Cartao className="overflow-hidden [&>div]:p-0">
        {isLoading ? (
          <Carregando />
        ) : (
          <Tabela colunas={colunas} vazio={!data?.itens.length && <Vazio>{q ? `Nenhum produto encontrado para “${q}”.` : 'Nenhum produto cadastrado ainda.'}</Vazio>}>
            {data?.itens.map((p) => (
              <tr
                key={p.id}
                onClick={editar ? () => navegar(`/produtos/${p.id}`) : undefined}
                className={`${editar ? 'cursor-pointer hover:bg-marca-50/50' : ''} ${p.ativo ? '' : 'text-stone-400'}`}
              >
                <td className="px-4 py-2.5 font-mono text-xs">{p.codigo}</td>
                <td className="px-4 py-2.5">
                  <span className="font-medium">{p.descricao}</span>
                  {p.marca && <span className="text-stone-500"> · {p.marca}</span>}
                  {!p.ativo && <span className="ml-2"><Etiqueta>Inativo</Etiqueta></span>}
                  {p.localizacao && <span className="block text-xs text-stone-500">Local: {p.localizacao}</span>}
                </td>
                <td className="px-4 py-2.5 text-stone-600">{p.categoria?.nome ?? '—'}</td>
                <td className="px-4 py-2.5 text-stone-600">{p.unidade.sigla}</td>
                {verCusto && <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">{formatarReais(p.custo ?? 0)}</td>}
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatarReais(p.precoVenda)}</td>
                {verCusto && (
                  <td className="px-4 py-2.5 text-right">
                    <Margem real={p.margemReal} desejada={p.margemEfetiva} />
                  </td>
                )}
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
      {data && <Paginacao pagina={pagina} total={data.total} porPagina={data.porPagina} aoMudar={setPagina} />}
      {verCusto && (
        <p className="mt-3 text-xs text-stone-500">
          Margem líquida após impostos, despesas e comissão. <span className="text-red-700">Vermelho</span>: prejuízo ·{' '}
          <span className="text-amber-700">âmbar</span>: abaixo da margem desejada.
        </p>
      )}
    </>
  );
}
