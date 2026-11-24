import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { GraficoBarras } from '../../components/GraficoBarras';
import { Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Margem, Selecao, Tabela, Vazio } from '../../components/ui';
import { api } from '../../lib/api';
import { useCategorias } from '../../lib/consultas';
import { exportarCSV, pct, reais } from '../../lib/csv';
import { formatarDataHora, formatarPct, formatarQtd, formatarReais } from '../../lib/formato';
import { NOMES_FORMA, type FormaPagamento } from '../../lib/tipos';

type Agrupar = 'dia' | 'semana' | 'mes';
interface Linha { quantidade: number; faturamento: number; descontos: number; custo: number; lucroBruto: number; margemBruta: number | null; ticketMedio: number }
interface RelVendas {
  totais: Linha & { resultadoEstimado: number; percentuaisUsados: number; canceladas: number; valorCancelado: number };
  periodos: (Linha & { chave: string; rotulo: string })[];
  formasPagamento: { forma: FormaPagamento; valor: number }[];
  vendedores: (Linha & { id: number; nome: string })[];
}
interface RelProdutos {
  totalFaturamento: number;
  produtos: { id: number; codigo: string; descricao: string; unidade: string; categoria: string | null; quantidade: number; faturamento: number; custo: number; lucroBruto: number; margemBruta: number | null; participacao: number; acumulado: number; classe: 'A' | 'B' | 'C' }[];
  resumoABC: { classe: 'A' | 'B' | 'C'; produtos: number; faturamento: number }[];
  categorias: { nome: string; faturamento: number; custo: number; lucroBruto: number; margemBruta: number | null }[];
}
interface RelCaixas {
  sessoes: { id: number; operador: string; abertoEm: string; fechadoEm: string | null; status: string; esperado: number; informado: number; diferenca: number }[];
  porForma: Record<string, { esperado: number; informado: number; diferenca: number }>;
  abertos: number;
}

const iso = (d: Date) => d.toLocaleDateString('sv-SE');
/** "2026-11-03" → "03/11" (dia/semana) ou "nov/26" (mês). */
function rotuloEixo(chave: string, a: Agrupar) {
  const [ano, mes, dia] = chave.split('-');
  if (a !== 'mes') return `${dia}/${mes}`;
  return `${new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${ano.slice(2)}`;
}
function preset(nome: string): [string, string, Agrupar] {
  const h = new Date();
  const seg = new Date(h); seg.setDate(h.getDate() - ((h.getDay() + 6) % 7));
  switch (nome) {
    case 'semana': return [iso(seg), iso(h), 'dia'];
    case 'mes': return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(h), 'dia'];
    case 'mesPassado': return [iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), iso(new Date(h.getFullYear(), h.getMonth(), 0)), 'dia'];
    case 'ano': return [iso(new Date(h.getFullYear(), 0, 1)), iso(h), 'mes'];
    default: return [iso(h), iso(h), 'dia'];
  }
}
const PRESETS = [['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['mesPassado', 'Mês passado'], ['ano', 'Este ano']] as const;
const ABAS = [['vendas', 'Fechamento de vendas'], ['produtos', 'Produtos (curva ABC)'], ['caixas', 'Caixas']] as const;

function Indicador({ titulo, valor, detalhe }: { titulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    <Cartao>
      <p className="text-sm text-stone-600">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-stone-500">{detalhe}</p>}
    </Cartao>
  );
}

export function Relatorios() {
  const [aba, setAba] = useState<(typeof ABAS)[number][0]>('vendas');
  const [[de, ate, agrupar], setPeriodo] = useState(preset('mes'));
  const [presetAtivo, setPresetAtivo] = useState('mes');
  const escolher = (p: string) => { setPeriodo(preset(p)); setPresetAtivo(p); };

  return (
    <>
      <Cabecalho titulo="Relatórios" descricao="Fechamento diário, semanal e mensal, desempenho de produtos e conferência de caixas." />
      <div className="mb-4 flex gap-1 border-b border-stone-200">
        {ABAS.map(([k, r]) => (
          <button key={k} onClick={() => setAba(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${aba === k ? 'border-marca-600 text-marca-700' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>{r}</button>
        ))}
      </div>
      <Cartao className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1 pb-0.5">
            {PRESETS.map(([k, r]) => <Botao key={k} variante={presetAtivo === k ? 'primario' : 'secundario'} onClick={() => escolher(k)}>{r}</Botao>)}
          </div>
          <Campo rotulo="De" type="date" value={de} onChange={(e) => { setPeriodo([e.target.value, ate, agrupar]); setPresetAtivo(''); }} />
          <Campo rotulo="Até" type="date" value={ate} onChange={(e) => { setPeriodo([de, e.target.value, agrupar]); setPresetAtivo(''); }} />
          {aba === 'vendas' && (
            <Selecao rotulo="Agrupar por" value={agrupar} onChange={(e) => setPeriodo([de, ate, e.target.value as Agrupar])} className="w-36">
              <option value="dia">Dia</option>
              <option value="semana">Semana</option>
              <option value="mes">Mês</option>
            </Selecao>
          )}
        </div>
      </Cartao>
      {aba === 'vendas' && <AbaVendas de={de} ate={ate} agrupar={agrupar} />}
      {aba === 'produtos' && <AbaProdutos de={de} ate={ate} />}
      {aba === 'caixas' && <AbaCaixas de={de} ate={ate} />}
    </>
  );
}

function AbaVendas({ de, ate, agrupar }: { de: string; ate: string; agrupar: Agrupar }) {
  const { data: r, isLoading, error } = useQuery({
    queryKey: ['rel-vendas', de, ate, agrupar],
    queryFn: () => api<RelVendas>(`/relatorios/vendas?${new URLSearchParams({ de, ate, agrupar })}`),
    placeholderData: keepPreviousData,
  });
  if (error) return <Cartao><p className="text-sm text-red-700">{error.message}</p></Cartao>;
  if (isLoading || !r) return <Carregando />;
  const t = r.totais;
  const totalFormas = r.formasPagamento.reduce((a, f) => a + f.valor, 0);

  function csv() {
    exportarCSV(`fechamento_${de}_a_${ate}`, ['Período', 'Vendas', 'Faturamento (R$)', 'Descontos (R$)', 'Custo (R$)', 'Lucro bruto (R$)', 'Margem bruta (%)', 'Ticket médio (R$)'], [
      ...r!.periodos.map((p) => [p.rotulo, p.quantidade, reais(p.faturamento), reais(p.descontos), reais(p.custo), reais(p.lucroBruto), pct(p.margemBruta), reais(p.ticketMedio)]),
      ['TOTAL', t.quantidade, reais(t.faturamento), reais(t.descontos), reais(t.custo), reais(t.lucroBruto), pct(t.margemBruta), reais(t.ticketMedio)],
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Indicador titulo="Faturamento" valor={formatarReais(t.faturamento)} detalhe={t.descontos ? `${formatarReais(t.descontos)} em descontos` : undefined} />
        <Indicador titulo="Vendas" valor={t.quantidade.toLocaleString('pt-BR')} detalhe={`Ticket médio ${formatarReais(t.ticketMedio)}`} />
        <Indicador titulo="Lucro bruto" valor={formatarReais(t.lucroBruto)} detalhe={<>Margem bruta <Margem real={t.margemBruta} /></>} />
        <Indicador titulo="Resultado estimado" valor={formatarReais(t.resultadoEstimado)} detalhe={`Lucro bruto − ${formatarPct(t.percentuaisUsados)} de impostos, despesas e comissão`} />
        <Indicador titulo="Cancelamentos" valor={t.canceladas.toLocaleString('pt-BR')} detalhe={t.canceladas ? formatarReais(t.valorCancelado) : 'Nenhum no período'} />
      </div>

      <Cartao titulo="Faturamento por período">
        {t.quantidade === 0 ? <Vazio>Nenhuma venda finalizada no período.</Vazio> : (
          <GraficoBarras
            titulo="Faturamento por período"
            formatar={(v) => formatarReais(v).replace(',00', '')}
            dados={r.periodos.map((p) => ({ chave: p.chave, rotulo: p.rotulo, eixo: rotuloEixo(p.chave, agrupar), valor: p.faturamento, detalhe: `${p.quantidade} venda(s) · lucro ${formatarReais(p.lucroBruto)}` }))}
          />
        )}
      </Cartao>

      <Cartao titulo="Fechamento" className="overflow-hidden [&>div:last-child]:p-0" acoes={<Botao variante="secundario" onClick={csv}><Download className="size-4" aria-hidden /> Excel (CSV)</Botao>}>
        <Tabela colunas={[{ titulo: 'Período' }, { titulo: 'Vendas', direita: true }, { titulo: 'Faturamento', direita: true }, { titulo: 'Descontos', direita: true }, { titulo: 'Custo', direita: true }, { titulo: 'Lucro bruto', direita: true }, { titulo: 'Margem', direita: true }]}>
          {r.periodos.map((p) => (
            <tr key={p.chave} className={p.quantidade ? '' : 'text-stone-400'}>
              <td className="px-4 py-2">{p.rotulo}</td>
              <td className="px-4 py-2 text-right tabular-nums">{p.quantidade}</td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">{formatarReais(p.faturamento)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatarReais(p.descontos)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatarReais(p.custo)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatarReais(p.lucroBruto)}</td>
              <td className="px-4 py-2 text-right">{p.quantidade ? <Margem real={p.margemBruta} /> : '—'}</td>
            </tr>
          ))}
          <tr className="bg-stone-50 font-semibold">
            <td className="px-4 py-2.5">Total</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{t.quantidade}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatarReais(t.faturamento)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatarReais(t.descontos)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatarReais(t.custo)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatarReais(t.lucroBruto)}</td>
            <td className="px-4 py-2.5 text-right"><Margem real={t.margemBruta} /></td>
          </tr>
        </Tabela>
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Formas de pagamento">
          {r.formasPagamento.length === 0 ? <Vazio>Sem pagamentos.</Vazio> : (
            <ul className="space-y-3 text-sm">
              {r.formasPagamento.map((f) => (
                <li key={f.forma}>
                  <div className="flex justify-between tabular-nums"><span>{NOMES_FORMA[f.forma]}</span><span>{formatarReais(f.valor)} <span className="text-stone-500">· {formatarPct(Math.round((f.valor * 10000) / totalFormas))}</span></span></div>
                  <div className="mt-1 h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-marca-600" style={{ width: `${(f.valor / totalFormas) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Vendedores" className="overflow-hidden [&>div:last-child]:p-0">
          <Tabela colunas={[{ titulo: 'Vendedor' }, { titulo: 'Vendas', direita: true }, { titulo: 'Faturamento', direita: true }, { titulo: 'Ticket médio', direita: true }, { titulo: 'Margem', direita: true }]} vazio={!r.vendedores.length && <Vazio>Sem vendas.</Vazio>}>
            {r.vendedores.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2">{v.nome}</td>
                <td className="px-4 py-2 text-right tabular-nums">{v.quantidade}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{formatarReais(v.faturamento)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatarReais(v.ticketMedio)}</td>
                <td className="px-4 py-2 text-right"><Margem real={v.margemBruta} /></td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
      </div>
    </div>
  );
}

function AbaProdutos({ de, ate }: { de: string; ate: string }) {
  const [categoriaId, setCategoriaId] = useState('');
  const { data: categorias } = useCategorias();
  const { data: r, isLoading, error } = useQuery({
    queryKey: ['rel-produtos', de, ate, categoriaId],
    queryFn: () => api<RelProdutos>(`/relatorios/produtos?${new URLSearchParams({ de, ate, ...(categoriaId ? { categoriaId } : {}) })}`),
    placeholderData: keepPreviousData,
  });
  if (error) return <Cartao><p className="text-sm text-red-700">{error.message}</p></Cartao>;
  if (isLoading || !r) return <Carregando />;
  const cor = { A: 'verde', B: 'azul', C: 'cinza' } as const;
  const explicacao = { A: 'Os poucos que trazem 80% do faturamento: nunca deixe faltar.', B: 'Importância intermediária (até 95%).', C: 'Muitos itens, pouco faturamento: cuidado com estoque parado.' };

  function csv() {
    exportarCSV(`curva_abc_${de}_a_${ate}`, ['Classe', 'Código', 'Produto', 'Categoria', 'Quantidade', 'Unidade', 'Faturamento (R$)', 'Participação (%)', 'Acumulado (%)', 'Custo (R$)', 'Lucro bruto (R$)', 'Margem bruta (%)'],
      r!.produtos.map((p) => [p.classe, p.codigo, p.descricao, p.categoria, p.quantidade / 1000, p.unidade, reais(p.faturamento), pct(p.participacao), pct(p.acumulado), reais(p.custo), reais(p.lucroBruto), pct(p.margemBruta)]));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {r.resumoABC.map((c) => (
          <Cartao key={c.classe}>
            <div className="flex items-center justify-between"><Etiqueta cor={cor[c.classe]}>Classe {c.classe}</Etiqueta><span className="text-sm text-stone-600">{c.produtos} produto(s)</span></div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatarReais(c.faturamento)}</p>
            <p className="text-xs text-stone-500">{r.totalFaturamento ? formatarPct(Math.round((c.faturamento * 10000) / r.totalFaturamento)) : '0%'} do faturamento · {explicacao[c.classe]}</p>
          </Cartao>
        ))}
      </div>
      <Cartao
        titulo="Produtos vendidos"
        className="overflow-hidden [&>div:last-child]:p-0"
        acoes={
          <>
            <select aria-label="Categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="rounded-md border-0 py-1.5 text-sm ring-1 ring-stone-300 ring-inset">
              <option value="">Todas as categorias</option>
              {categorias?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <Botao variante="secundario" onClick={csv} disabled={!r.produtos.length}><Download className="size-4" aria-hidden /> Excel (CSV)</Botao>
          </>
        }
      >
        <Tabela
          colunas={[{ titulo: 'Classe' }, { titulo: 'Produto' }, { titulo: 'Qtd.', direita: true }, { titulo: 'Faturamento', direita: true }, { titulo: '% / acum.', direita: true }, { titulo: 'Lucro bruto', direita: true }, { titulo: 'Margem', direita: true }]}
          vazio={!r.produtos.length && <Vazio>Nenhum produto vendido no período.</Vazio>}
        >
          {r.produtos.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2"><Etiqueta cor={cor[p.classe]}>{p.classe}</Etiqueta></td>
              <td className="px-4 py-2"><Link to={`/estoque/${p.id}`} className="hover:underline">{p.descricao}</Link> <span className="font-mono text-xs text-stone-500">{p.codigo}</span>{p.categoria && <span className="block text-xs text-stone-500">{p.categoria}</span>}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatarQtd(p.quantidade)} {p.unidade}</td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">{formatarReais(p.faturamento)}</td>
              <td className="px-4 py-2 text-right text-xs tabular-nums text-stone-600">{formatarPct(p.participacao)} / {formatarPct(p.acumulado)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatarReais(p.lucroBruto)}</td>
              <td className="px-4 py-2 text-right"><Margem real={p.margemBruta} /></td>
            </tr>
          ))}
        </Tabela>
      </Cartao>
      {r.categorias.length > 0 && !categoriaId && (
        <Cartao titulo="Por categoria" className="overflow-hidden [&>div:last-child]:p-0">
          <Tabela colunas={[{ titulo: 'Categoria' }, { titulo: 'Faturamento', direita: true }, { titulo: 'Custo', direita: true }, { titulo: 'Lucro bruto', direita: true }, { titulo: 'Margem', direita: true }]}>
            {r.categorias.map((c) => (
              <tr key={c.nome}>
                <td className="px-4 py-2">{c.nome}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{formatarReais(c.faturamento)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatarReais(c.custo)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatarReais(c.lucroBruto)}</td>
                <td className="px-4 py-2 text-right"><Margem real={c.margemBruta} /></td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
      )}
    </div>
  );
}

function AbaCaixas({ de, ate }: { de: string; ate: string }) {
  const { data: r, isLoading, error } = useQuery({
    queryKey: ['rel-caixas', de, ate],
    queryFn: () => api<RelCaixas>(`/relatorios/caixas?${new URLSearchParams({ de, ate })}`),
    placeholderData: keepPreviousData,
  });
  if (error) return <Cartao><p className="text-sm text-red-700">{error.message}</p></Cartao>;
  if (isLoading || !r) return <Carregando />;
  const corDif = (d: number) => (d < 0 ? 'text-red-700' : d > 0 ? 'text-amber-700' : 'text-emerald-700');
  const nomes: Record<string, string> = { DINHEIRO: 'Dinheiro', PIX: 'PIX', DEBITO: 'Débito', CREDITO: 'Crédito' };

  function csv() {
    exportarCSV(`caixas_${de}_a_${ate}`, ['Nº', 'Operador', 'Abertura', 'Fechamento', 'Sistema (R$)', 'Informado (R$)', 'Diferença (R$)'],
      r!.sessoes.map((s) => [s.id, s.operador, formatarDataHora(s.abertoEm), s.fechadoEm ? formatarDataHora(s.fechadoEm) : 'Aberto', reais(s.esperado), reais(s.informado), reais(s.diferenca)]));
  }

  return (
    <div className="space-y-6">
      {r.abertos > 0 && <p className="text-sm text-amber-700">{r.abertos} caixa(s) ainda aberto(s) no período: as diferenças só aparecem após o fechamento.</p>}
      <div className="grid gap-4 sm:grid-cols-4">
        {['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'].map((f) => {
          const v = r.porForma[f];
          return <Indicador key={f} titulo={`${nomes[f]}: diferença`} valor={<span className={corDif(v?.diferenca ?? 0)}>{formatarReais(v?.diferenca ?? 0)}</span>} detalhe={v ? `Sistema ${formatarReais(v.esperado)} · informado ${formatarReais(v.informado)}` : 'Sem fechamentos'} />;
        })}
      </div>
      <Cartao titulo="Caixas do período" className="overflow-hidden [&>div:last-child]:p-0" acoes={<Botao variante="secundario" onClick={csv} disabled={!r.sessoes.length}><Download className="size-4" aria-hidden /> Excel (CSV)</Botao>}>
        <Tabela colunas={[{ titulo: 'Nº' }, { titulo: 'Operador' }, { titulo: 'Abertura' }, { titulo: 'Fechamento' }, { titulo: 'Sistema', direita: true }, { titulo: 'Informado', direita: true }, { titulo: 'Diferença', direita: true }]} vazio={!r.sessoes.length && <Vazio>Nenhum caixa no período.</Vazio>}>
          {r.sessoes.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2"><Link to={`/caixa/${s.id}`} className="font-mono text-xs text-marca-700 underline">{s.id}</Link></td>
              <td className="px-4 py-2">{s.operador}</td>
              <td className="px-4 py-2 tabular-nums">{formatarDataHora(s.abertoEm)}</td>
              <td className="px-4 py-2 tabular-nums">{s.fechadoEm ? formatarDataHora(s.fechadoEm) : <Etiqueta cor="verde">Aberto</Etiqueta>}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.fechadoEm ? formatarReais(s.esperado) : '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.fechadoEm ? formatarReais(s.informado) : '—'}</td>
              <td className={`px-4 py-2 text-right font-medium tabular-nums ${s.fechadoEm ? corDif(s.diferenca) : ''}`}>{s.fechadoEm ? formatarReais(s.diferenca) : '—'}</td>
            </tr>
          ))}
        </Tabela>
      </Cartao>
    </div>
  );
}
