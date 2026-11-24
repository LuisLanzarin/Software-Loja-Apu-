import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alerta, AreaTexto, Botao, Cabecalho, Campo, Carregando, Cartao, Margem, Selecao } from '../../components/ui';
import { api } from '../../lib/api';
import { useCategorias, useFornecedores, useParametrosPreco, useUnidades } from '../../lib/consultas';
import { decimalParaTexto, formatarDataHora, formatarPct, formatarReais, lerDecimal } from '../../lib/formato';
import { margemEfetiva, margemReal, precoSugerido } from '../../lib/precificacao';
import type { Produto } from '../../lib/tipos';

interface Estado {
  codigo: string;
  codigoBarras: string;
  descricao: string;
  marca: string;
  categoriaId: string;
  unidadeId: string;
  custo: string;
  precoVenda: string;
  margemPct: string; // vazio = herda
  estoqueMinimo: string;
  localizacao: string;
  observacoes: string;
  ativo: boolean;
  conversoes: { unidadeId: string; fator: string }[];
  fornecedores: { fornecedorId: string; codigoFornecedor: string }[];
}

const VAZIO: Estado = {
  codigo: '', codigoBarras: '', descricao: '', marca: '', categoriaId: '', unidadeId: '', custo: '', precoVenda: '',
  margemPct: '', estoqueMinimo: '0', localizacao: '', observacoes: '', ativo: true, conversoes: [], fornecedores: [],
};

function paraEstado(p: Produto): Estado {
  return {
    codigo: p.codigo,
    codigoBarras: p.codigoBarras ?? '',
    descricao: p.descricao,
    marca: p.marca ?? '',
    categoriaId: p.categoriaId ? String(p.categoriaId) : '',
    unidadeId: String(p.unidadeId),
    custo: decimalParaTexto(p.custo ?? 0, 2),
    precoVenda: decimalParaTexto(p.precoVenda, 2),
    margemPct: p.margemPct != null ? decimalParaTexto(p.margemPct, 2) : '',
    estoqueMinimo: (p.estoqueMinimo / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }),
    localizacao: p.localizacao ?? '',
    observacoes: p.observacoes ?? '',
    ativo: p.ativo,
    conversoes: (p.conversoes ?? []).map((c) => ({ unidadeId: String(c.unidadeId), fator: (c.fator / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) })),
    fornecedores: (p.fornecedores ?? []).map((f) => ({ fornecedorId: String(f.fornecedorId), codigoFornecedor: f.codigoFornecedor ?? '' })),
  };
}

export function ProdutoForm() {
  const { id } = useParams();
  const novo = id === undefined;
  const { data, isLoading } = useQuery({ queryKey: ['produto', id], queryFn: () => api<Produto>(`/produtos/${id}`), enabled: !novo });
  if (!novo && (isLoading || !data)) return <Carregando />;
  return <Formulario key={id ?? 'novo'} produto={data} />;
}

function Formulario({ produto }: { produto?: Produto }) {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [e, setE] = useState<Estado>(() => (produto ? paraEstado(produto) : VAZIO));
  const [erro, setErro] = useState('');
  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => setE((s) => ({ ...s, [k]: v }));

  const { data: unidades } = useUnidades();
  const { data: categorias } = useCategorias();
  const { data: fornecedores } = useFornecedores();
  const { data: par } = useParametrosPreco();

  const unidade = unidades?.find((u) => String(u.id) === e.unidadeId);
  const categoria = categorias?.find((c) => String(c.id) === e.categoriaId);

  // Cálculo ao vivo, igual ao do servidor.
  const calc = useMemo(() => {
    if (!par) return null;
    const custo = lerDecimal(e.custo || '0', 2) ?? 0;
    const preco = lerDecimal(e.precoVenda || '0', 2) ?? 0;
    const margemProduto = e.margemPct.trim() ? lerDecimal(e.margemPct, 2) : null;
    const margem = margemEfetiva(margemProduto, categoria?.margemPct, par.margemPadraoPct);
    const origem = margemProduto != null ? 'deste produto' : categoria?.margemPct != null ? `da categoria ${categoria.nome}` : 'padrão da loja';
    return { custo, preco, margem, origem, sugerido: custo > 0 ? precoSugerido(custo, margem, par) : null, real: margemReal(custo, preco, par) };
  }, [e.custo, e.precoVenda, e.margemPct, categoria, par]);

  const salvar = useMutation({
    mutationFn: (corpo: unknown) => api<Produto>(produto ? `/produtos/${produto.id}` : '/produtos', { method: produto ? 'PATCH' : 'POST', body: corpo }),
    onSuccess: async (p) => {
      await qc.invalidateQueries({ queryKey: ['produtos'] });
      await qc.invalidateQueries({ queryKey: ['produto'] });
      await qc.invalidateQueries({ queryKey: ['historico'] });
      navegar(produto ? '/produtos' : `/produtos/${p.id}`, { replace: true });
    },
    onError: (err) => setErro(err.message),
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro('');
    const num = (txt: string, casas: number, nome: string) => {
      const v = lerDecimal(txt || '0', casas);
      if (v === null) throw new Error(`${nome}: valor inválido.`);
      return v;
    };
    try {
      salvar.mutate({
        codigo: e.codigo || null,
        codigoBarras: e.codigoBarras || null,
        descricao: e.descricao,
        marca: e.marca || null,
        categoriaId: e.categoriaId ? Number(e.categoriaId) : null,
        unidadeId: Number(e.unidadeId) || undefined,
        custo: num(e.custo, 2, 'Custo'),
        precoVenda: num(e.precoVenda, 2, 'Preço de venda'),
        margemPct: e.margemPct.trim() ? num(e.margemPct, 2, 'Margem') : null,
        estoqueMinimo: num(e.estoqueMinimo, 3, 'Estoque mínimo'),
        localizacao: e.localizacao || null,
        observacoes: e.observacoes || null,
        ativo: e.ativo,
        conversoes: e.conversoes.filter((c) => c.unidadeId).map((c) => ({ unidadeId: Number(c.unidadeId), fator: num(c.fator, 3, 'Conversão') })),
        fornecedores: e.fornecedores.filter((f) => f.fornecedorId).map((f) => ({ fornecedorId: Number(f.fornecedorId), codigoFornecedor: f.codigoFornecedor || null })),
      });
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <form onSubmit={enviar}>
      <Cabecalho
        titulo={produto ? produto.descricao : 'Novo produto'}
        descricao={produto ? `Código ${produto.codigo}` : 'Preencha os dados e confira a margem antes de salvar.'}
        acoes={
          <Botao type="button" variante="secundario" onClick={() => navegar('/produtos')}>
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </Botao>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Cartao titulo="Dados do produto">
            <div className="grid gap-4 sm:grid-cols-6">
              <Campo rotulo="Descrição" required autoFocus value={e.descricao} onChange={(x) => set('descricao', x.target.value)} className="sm:col-span-6" placeholder="Ex.: Cimento CP-II 50kg Votorantim" />
              <Campo rotulo="Código interno" value={e.codigo} onChange={(x) => set('codigo', x.target.value)} className="sm:col-span-2" placeholder={produto ? '' : 'Automático'} />
              <Campo rotulo="Código de barras (EAN)" inputMode="numeric" value={e.codigoBarras} onChange={(x) => set('codigoBarras', x.target.value.replace(/\D/g, ''))} className="sm:col-span-2" />
              <Campo rotulo="Marca" value={e.marca} onChange={(x) => set('marca', x.target.value)} className="sm:col-span-2" />
              <Selecao rotulo="Categoria" value={e.categoriaId} onChange={(x) => set('categoriaId', x.target.value)} className="sm:col-span-2">
                <option value="">Sem categoria</option>
                {categorias?.filter((c) => c.ativo || String(c.id) === e.categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Selecao>
              <Selecao rotulo="Unidade de venda" required value={e.unidadeId} onChange={(x) => set('unidadeId', x.target.value)} className="sm:col-span-2">
                <option value="">Escolha…</option>
                {unidades?.filter((u) => u.ativo || String(u.id) === e.unidadeId).map((u) => <option key={u.id} value={u.id}>{u.sigla} — {u.nome}</option>)}
              </Selecao>
              <Campo
                rotulo={`Estoque mínimo${unidade ? ` (${unidade.sigla})` : ''}`}
                inputMode="decimal"
                value={e.estoqueMinimo}
                onChange={(x) => set('estoqueMinimo', x.target.value)}
                className="sm:col-span-2"
                ajuda="Abaixo disso, o sistema avisa para repor."
              />
              <Campo rotulo="Localização na loja" value={e.localizacao} onChange={(x) => set('localizacao', x.target.value)} className="sm:col-span-3" placeholder="Ex.: Corredor 3, prateleira B" />
              <Selecao rotulo="Situação" value={e.ativo ? 'sim' : 'nao'} onChange={(x) => set('ativo', x.target.value === 'sim')} className="sm:col-span-3">
                <option value="sim">Ativo</option>
                <option value="nao">Inativo (não aparece para venda)</option>
              </Selecao>
              <AreaTexto rotulo="Observações" value={e.observacoes} onChange={(x) => set('observacoes', x.target.value)} className="sm:col-span-6" />
            </div>
          </Cartao>

          <Cartao
            titulo="Unidades de compra"
            acoes={
              <Botao type="button" variante="secundario" onClick={() => set('conversoes', [...e.conversoes, { unidadeId: '', fator: '' }])}>
                <Plus className="size-4" aria-hidden /> Adicionar
              </Botao>
            }
          >
            <p className="mb-3 text-sm text-stone-600">
              Quando o fornecedor vende em outra unidade. Ex.: piso vendido em M2 e comprado em CX: <strong>1 CX = 2,5 M2</strong>.
            </p>
            {e.conversoes.length === 0 && <p className="text-sm text-stone-400">Compra e venda na mesma unidade.</p>}
            <div className="space-y-2">
              {e.conversoes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>1</span>
                  <select
                    aria-label="Unidade de compra"
                    value={c.unidadeId}
                    onChange={(x) => set('conversoes', e.conversoes.map((y, j) => (j === i ? { ...y, unidadeId: x.target.value } : y)))}
                    className="w-40 rounded-md border-0 py-1.5 text-sm ring-1 ring-stone-300 ring-inset"
                  >
                    <option value="">Unidade…</option>
                    {unidades?.filter((u) => String(u.id) !== e.unidadeId).map((u) => <option key={u.id} value={u.id}>{u.sigla} — {u.nome}</option>)}
                  </select>
                  <span>=</span>
                  <input
                    aria-label="Quantidade na unidade de venda"
                    inputMode="decimal"
                    value={c.fator}
                    onChange={(x) => set('conversoes', e.conversoes.map((y, j) => (j === i ? { ...y, fator: x.target.value } : y)))}
                    className="w-24 rounded-md border-0 py-1.5 text-right text-sm ring-1 ring-stone-300 ring-inset"
                  />
                  <span className="text-stone-600">{unidade?.sigla ?? '(unidade de venda)'}</span>
                  <button type="button" onClick={() => set('conversoes', e.conversoes.filter((_, j) => j !== i))} className="ml-auto rounded p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-700" aria-label="Remover conversão">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </Cartao>

          <Cartao
            titulo="Fornecedores"
            acoes={
              <Botao type="button" variante="secundario" onClick={() => set('fornecedores', [...e.fornecedores, { fornecedorId: '', codigoFornecedor: '' }])}>
                <Plus className="size-4" aria-hidden /> Adicionar
              </Botao>
            }
          >
            {e.fornecedores.length === 0 && <p className="text-sm text-stone-400">Nenhum fornecedor vinculado.</p>}
            <div className="space-y-2">
              {e.fornecedores.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    aria-label="Fornecedor"
                    value={f.fornecedorId}
                    onChange={(x) => set('fornecedores', e.fornecedores.map((y, j) => (j === i ? { ...y, fornecedorId: x.target.value } : y)))}
                    className="min-w-0 flex-1 rounded-md border-0 py-1.5 text-sm ring-1 ring-stone-300 ring-inset"
                  >
                    <option value="">Fornecedor…</option>
                    {fornecedores?.filter((x) => x.ativo || String(x.id) === f.fornecedorId).map((x) => <option key={x.id} value={x.id}>{x.nomeFantasia || x.razaoSocial}</option>)}
                  </select>
                  <input
                    aria-label="Código do produto no fornecedor"
                    placeholder="Código no fornecedor"
                    value={f.codigoFornecedor}
                    onChange={(x) => set('fornecedores', e.fornecedores.map((y, j) => (j === i ? { ...y, codigoFornecedor: x.target.value } : y)))}
                    className="w-48 rounded-md border-0 py-1.5 text-sm ring-1 ring-stone-300 ring-inset"
                  />
                  <button type="button" onClick={() => set('fornecedores', e.fornecedores.filter((_, j) => j !== i))} className="rounded p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-700" aria-label="Remover fornecedor">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao titulo="Preço" className="lg:sticky lg:top-6">
            <div className="space-y-4">
              <Campo rotulo={`Custo${unidade ? ` por ${unidade.sigla}` : ''} (R$)`} inputMode="decimal" value={e.custo} onChange={(x) => set('custo', x.target.value)} placeholder="0,00" />
              <Campo
                rotulo="Margem desejada (%)"
                inputMode="decimal"
                value={e.margemPct}
                onChange={(x) => set('margemPct', x.target.value)}
                placeholder={calc ? decimalParaTexto(calc.margem, 2) : ''}
                ajuda={calc && !e.margemPct.trim() ? `Em branco: usa ${formatarPct(calc.margem)} (${calc.origem}).` : undefined}
              />

              {calc && par && (
                <div className="rounded-md bg-stone-50 p-3 text-sm ring-1 ring-stone-200">
                  <div className="flex justify-between text-stone-600">
                    <span>Impostos + despesas + comissão</span>
                    <span className="tabular-nums">{formatarPct(par.impostosPct + par.despesasFixasPct + par.comissaoPct)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-medium">Preço sugerido</span>
                    <span className="font-semibold tabular-nums">{calc.sugerido != null ? formatarReais(calc.sugerido) : '—'}</span>
                  </div>
                  {calc.sugerido != null && (
                    <Botao type="button" variante="secundario" className="mt-2 w-full" onClick={() => set('precoVenda', decimalParaTexto(calc.sugerido!, 2))}>
                      Usar preço sugerido
                    </Botao>
                  )}
                </div>
              )}

              <Campo rotulo={`Preço de venda${unidade ? ` por ${unidade.sigla}` : ''} (R$)`} required inputMode="decimal" value={e.precoVenda} onChange={(x) => set('precoVenda', x.target.value)} placeholder="0,00" />

              {calc && calc.preco > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">Margem líquida com este preço</span>
                  <Margem real={calc.real} desejada={calc.margem} />
                </div>
              )}
              {calc && calc.real != null && calc.real < 0 && <Alerta>Com este preço o produto dá prejuízo.</Alerta>}
            </div>
          </Cartao>

          <Alerta>{erro}</Alerta>
          <Botao type="submit" carregando={salvar.isPending} className="w-full">
            {produto ? 'Salvar alterações' : 'Cadastrar produto'}
          </Botao>

          {produto && <HistoricoPrecos produtoId={produto.id} />}
        </div>
      </div>
    </form>
  );
}

function HistoricoPrecos({ produtoId }: { produtoId: number }) {
  const { data } = useQuery({
    queryKey: ['historico', produtoId],
    queryFn: () =>
      api<{ id: number; custoNovo: number; precoAnterior: number; precoNovo: number; motivo: string; criadoEm: string; usuario: { nome: string } | null }[]>(
        `/produtos/${produtoId}/historico-precos`,
      ),
  });
  if (!data?.length) return null;
  return (
    <Cartao titulo="Histórico de preços">
      <ul className="-my-2 divide-y divide-stone-100 text-sm">
        {data.slice(0, 8).map((h) => (
          <li key={h.id} className="py-2">
            <div className="flex justify-between">
              <span className="tabular-nums">
                {h.precoAnterior > 0 && <span className="text-stone-400 line-through">{formatarReais(h.precoAnterior)}</span>} <strong>{formatarReais(h.precoNovo)}</strong>
              </span>
              <span className="text-xs text-stone-500">custo {formatarReais(h.custoNovo)}</span>
            </div>
            <p className="text-xs text-stone-500">
              {formatarDataHora(h.criadoEm)} · {h.usuario?.nome ?? '—'} · {h.motivo}
            </p>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
