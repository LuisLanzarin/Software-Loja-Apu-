import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, Printer, ShoppingCart, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AutorizacaoGerente, motivosDoErro, type Credenciais } from '../../components/AutorizacaoGerente';
import { BuscaProduto, type BuscaProdutoRef } from '../../components/BuscaProduto';
import { Alerta, Botao, Carregando, Cartao, Etiqueta } from '../../components/ui';
import { api } from '../../lib/api';
import { useCaixaAtual } from '../../lib/caixa';
import { valorDe } from '../../lib/calculosEstoque';
import { decimalParaTexto, formatarPct, formatarQtd, formatarReais, lerDecimal } from '../../lib/formato';
import { usePode } from '../../lib/sessao';
import type { Cliente, MotivoAutorizacao, Produto, Venda } from '../../lib/tipos';
import { AbrirCaixa } from '../caixa/AbrirCaixa';
import { JanelaPagamento, type PagamentoEnvio } from './JanelaPagamento';
import { SeletorCliente } from './SeletorCliente';

interface Item {
  chave: number;
  produto: Produto;
  preco: number; // centavos (do cadastro ou do orçamento)
  quantidade: string;
  desconto: string;
}

const campo = 'w-full rounded-md border-0 py-1.5 text-right text-sm tabular-nums ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-marca-600';

export function PDV() {
  const qc = useQueryClient();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const busca = useRef<BuscaProdutoRef>(null);
  const pode = usePode();
  const { data: caixa, isLoading: carregandoCaixa } = useCaixaAtual();
  const { data: cfg } = useQuery({
    queryKey: ['configuracao'],
    queryFn: () => api<{ descontoMaxSemAutorizacao: number; taxaServicoPct: number; taxaServicoPadrao: boolean }>('/configuracao'),
  });

  const [itens, setItens] = useState<Item[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [descontoGeral, setDescontoGeral] = useState('');
  const [cobrarTaxa, setCobrarTaxa] = useState<boolean | null>(null); // null = segue o padrão da configuração
  const [orcamento, setOrcamento] = useState<Venda | null>(null);
  const [pagando, setPagando] = useState(0); // >0 = janela aberta (muda a "key" para limpar)
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [motivos, setMotivos] = useState<MotivoAutorizacao[] | null>(null);
  const [pendente, setPendente] = useState<object | null>(null);
  const [concluida, setConcluida] = useState<Venda | null>(null);

  // Abrir orçamento no PDV: /pdv?orcamento=123
  const idOrcamento = params.get('orcamento');
  useEffect(() => {
    if (!idOrcamento) return;
    (async () => {
      const o = await api<Venda>(`/vendas/${idOrcamento}`);
      if (o.status !== 'ORCAMENTO') return setErro(`O orçamento nº ${o.id} não está mais em aberto.`);
      const valido = o.validoAte && new Date(o.validoAte) >= new Date();
      const produtos = await Promise.all(o.itens.map((i) => api<Produto>(`/produtos/${i.produtoId}`)));
      setItens(o.itens.map((i, n) => ({
        chave: Date.now() + n, produto: produtos[n], preco: valido ? i.precoUnitario : produtos[n].precoVenda,
        quantidade: formatarQtd(i.quantidade), desconto: i.desconto ? decimalParaTexto(i.desconto, 2) : '',
      })));
      setCliente(o.cliente);
      setDescontoGeral(o.descontoGeral ? decimalParaTexto(o.descontoGeral, 2) : '');
      setOrcamento(o);
    })().catch((e) => setErro(e.message));
  }, [idOrcamento]);

  const adicionar = useCallback((p: Produto) => {
    setConcluida(null);
    setItens((x) => {
      const existente = x.find((i) => i.produto.id === p.id);
      if (existente) {
        const q = (lerDecimal(existente.quantidade || '0', 3) ?? 0) + 1000;
        return x.map((i) => (i === existente ? { ...i, quantidade: formatarQtd(q) } : i));
      }
      return [...x, { chave: Date.now(), produto: p, preco: p.precoVenda, quantidade: '1', desconto: '' }];
    });
  }, []);
  const alterar = (chave: number, m: Partial<Item>) => setItens((x) => x.map((i) => (i.chave === chave ? { ...i, ...m } : i)));

  // Totais (os mesmos cálculos que o servidor confere)
  const linhas = itens.map((i) => {
    const q = lerDecimal(i.quantidade || '0', 3) ?? 0;
    const bruto = valorDe(q, i.preco);
    const desc = Math.min(lerDecimal(i.desconto || '0', 2) ?? 0, bruto);
    return { q, bruto, desc, total: bruto - desc, semEstoque: q > i.produto.estoqueAtual };
  });
  const subtotal = linhas.reduce((a, l) => a + l.bruto, 0);
  const descItens = linhas.reduce((a, l) => a + l.desc, 0);
  const descGeral = Math.min(lerDecimal(descontoGeral || '0', 2) ?? 0, subtotal - descItens);
  const consumo = subtotal - descItens - descGeral;
  const usaTaxa = !!cfg && cfg.taxaServicoPct > 0;
  const taxaMarcada = usaTaxa && (cobrarTaxa ?? cfg!.taxaServicoPadrao);
  const taxa = taxaMarcada ? Math.round((consumo * cfg!.taxaServicoPct) / 10000) : 0; // igual ao servidor
  const total = consumo + taxa;
  const pctDesconto = subtotal ? Math.round(((descItens + descGeral) * 10000) / subtotal) : 0;
  const acimaLimite = cfg && pctDesconto > cfg.descontoMaxSemAutorizacao;
  const algumSemEstoque = linhas.some((l) => l.semEstoque);
  const quantidadeInvalida = linhas.some((l) => l.q <= 0);

  const corpoBase = () => ({
    clienteId: cliente?.id ?? null,
    orcamentoId: orcamento?.id ?? null,
    itens: itens.map((i, n) => ({ produtoId: i.produto.id, quantidade: linhas[n].q, desconto: linhas[n].desc })),
    descontoGeral: descGeral,
    cobrarTaxaServico: taxaMarcada,
  });

  function limpar() {
    setItens([]);
    setCliente(null);
    setDescontoGeral('');
    setCobrarTaxa(null);
    setOrcamento(null);
    setErro('');
    if (idOrcamento) setParams({});
    busca.current?.focar();
  }

  async function enviar(corpo: object, autorizacao?: Credenciais) {
    setEnviando(true);
    setErro('');
    try {
      const v = await api<Venda>('/vendas', { method: 'POST', body: { ...corpo, ...(autorizacao ? { autorizacao } : {}) } });
      setMotivos(null);
      setPagando(0);
      limpar();
      setConcluida(v);
      await qc.invalidateQueries({ queryKey: ['caixa-atual'] });
      await qc.invalidateQueries({ queryKey: ['produtos'] });
      await qc.invalidateQueries({ queryKey: ['busca-produto'] });
      await qc.invalidateQueries({ queryKey: ['vendas'] });
    } catch (e) {
      const m = motivosDoErro(e);
      if (m && !autorizacao) {
        setPendente(corpo);
        setMotivos(m);
      } else if (autorizacao) {
        throw e; // a janela do gerente mostra o erro
      } else {
        setErro((e as Error).message);
      }
    } finally {
      setEnviando(false);
    }
  }

  const finalizar = useCallback(() => {
    if (!itens.length || quantidadeInvalida || !caixa) return;
    setErro('');
    setPagando((n) => n + 1);
  }, [itens.length, quantidadeInvalida, caixa]);

  // Atalho: F2 finaliza a venda
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); finalizar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [finalizar]);

  if (carregandoCaixa) return <Carregando />;

  return (
    <div className="-mx-2 -my-2">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShoppingCart className="size-6 text-marca-600" aria-hidden /> Venda
          {orcamento && <Etiqueta cor="azul">Orçamento nº {orcamento.id}</Etiqueta>}
        </h1>
        {caixa ? (
          pode('caixa.ver_todos') ? (
            <Link to="/caixa" className="text-sm text-stone-600 hover:underline">
              Caixa aberto desde {new Date(caixa.abertoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {caixa.totais?.quantidadeVendas ?? 0} venda(s)
            </Link>
          ) : (
            <span className="text-sm text-stone-600">Caixa aberto por {caixa.usuario.nome} às {new Date(caixa.abertoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          )
        ) : null}
      </div>

      {!caixa && (
        <Cartao className="mb-4 border-l-4 border-amber-500">
          {pode('caixa.operar') ? (
            <>
              <p className="mb-3 text-sm font-medium">O caixa está fechado. Abra o caixa para registrar vendas (orçamentos podem ser feitos sem caixa).</p>
              <AbrirCaixa compacto />
            </>
          ) : (
            <p className="text-sm font-medium">O caixa está fechado. Peça ao gerente para abrir o caixa antes de lançar vendas.</p>
          )}
        </Cartao>
      )}

      {concluida && (
        <div className="mb-4 flex items-center gap-4 rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold text-emerald-900">
              {concluida.status === 'ORCAMENTO' ? `Orçamento nº ${concluida.id} salvo` : `Venda nº ${concluida.id} concluída`} — {formatarReais(concluida.total)}
            </p>
            {concluida.troco > 0 && <p className="text-2xl font-semibold text-emerald-800">Troco: {formatarReais(concluida.troco)}</p>}
            {concluida.autorizadoPor && <p className="text-sm text-emerald-800">Autorizado por {concluida.autorizadoPor.nome}</p>}
          </div>
          <Botao variante="secundario" onClick={() => window.open(`/vendas/${concluida.id}/imprimir`, '_blank', 'width=420,height=700')}>
            <Printer className="size-4" aria-hidden /> Imprimir
          </Botao>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Cartao className="overflow-visible [&>div]:p-0">
          <div className="border-b border-stone-200 p-4">
            <BuscaProduto ref={busca} aoEscolher={adicionar} autoFocus />
          </div>
          {itens.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-stone-500">Busque um produto ou passe o leitor de código de barras. <kbd className="rounded bg-stone-100 px-1.5 py-0.5 text-xs ring-1 ring-stone-300">F2</kbd> finaliza.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Produto</th>
                  <th className="w-28 px-2 py-2.5 text-right">Qtd.</th>
                  <th className="px-2 py-2.5 text-right">Preço</th>
                  <th className="w-28 px-2 py-2.5 text-right">Desconto</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {itens.map((i, n) => (
                  <tr key={i.chave}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{i.produto.descricao}</span>
                      <span className="block text-xs text-stone-500">
                        <span className="font-mono">{i.produto.codigo}</span> · estoque {formatarQtd(i.produto.estoqueAtual)} {i.produto.unidade.sigla}
                        {linhas[n].semEstoque && <span className="ml-1 font-medium text-amber-700">· sem estoque suficiente (pedirá o gerente)</span>}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <input aria-label={`Quantidade de ${i.produto.descricao}`} inputMode="decimal" value={i.quantidade} onFocus={(e) => e.target.select()}
                          onChange={(e) => alterar(i.chave, { quantidade: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && busca.current?.focar()}
                          className={`${campo} ${linhas[n].q <= 0 ? 'ring-red-500' : ''}`} />
                        <span className="w-7 text-xs text-stone-500">{i.produto.unidade.sigla}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatarReais(i.preco)}</td>
                    <td className="px-2 py-2">
                      <input aria-label={`Desconto em ${i.produto.descricao}`} inputMode="decimal" placeholder="0,00" value={i.desconto}
                        onChange={(e) => alterar(i.chave, { desconto: e.target.value })} className={campo} />
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatarReais(linhas[n].total)}</td>
                    <td className="pr-3">
                      <button onClick={() => setItens((x) => x.filter((y) => y.chave !== i.chave))} className="rounded p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-700" aria-label={`Remover ${i.produto.descricao}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Cartao>

        <div className="space-y-4">
          <Cartao titulo="Cliente">
            <SeletorCliente cliente={cliente} aoMudar={setCliente} />
          </Cartao>

          <Cartao>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-stone-600">Subtotal ({itens.length} itens)</dt><dd className="tabular-nums">{formatarReais(subtotal)}</dd></div>
              {descItens > 0 && <div className="flex justify-between"><dt className="text-stone-600">Desconto nos itens</dt><dd className="tabular-nums">− {formatarReais(descItens)}</dd></div>}
              <div className="flex items-center justify-between gap-3">
                <dt><label htmlFor="desc-geral" className="text-stone-600">Desconto na venda (R$)</label></dt>
                <dd><input id="desc-geral" inputMode="decimal" placeholder="0,00" value={descontoGeral} onChange={(e) => setDescontoGeral(e.target.value)} className={`${campo} w-28`} /></dd>
              </div>
              {pctDesconto > 0 && (
                <p className={`text-xs ${acimaLimite ? 'font-medium text-amber-700' : 'text-stone-500'}`}>
                  Desconto total: {formatarPct(pctDesconto)}{acimaLimite && cfg ? ` — acima de ${formatarPct(cfg.descontoMaxSemAutorizacao)}, pedirá o gerente` : ''}
                </p>
              )}
              {usaTaxa && (
                <div className="flex items-center justify-between">
                  <dt>
                    <label className="flex cursor-pointer items-center gap-2 text-stone-600">
                      <input type="checkbox" checked={taxaMarcada} onChange={(e) => setCobrarTaxa(e.target.checked)} className="size-4 rounded accent-marca-600" />
                      Taxa de serviço ({formatarPct(cfg!.taxaServicoPct).replace(',00', '')})
                    </label>
                  </dt>
                  <dd className={`tabular-nums ${taxaMarcada ? '' : 'text-stone-400'}`}>{formatarReais(taxa)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-stone-200 pt-3">
                <dt className="text-base font-medium">Total</dt>
                <dd className="text-3xl font-semibold tabular-nums">{formatarReais(total)}</dd>
              </div>
            </dl>
            {algumSemEstoque && <div className="mt-3"><Alerta tipo="info">Há itens sem estoque suficiente: a venda vai pedir a senha do gerente.</Alerta></div>}
            {erro && <div className="mt-3"><Alerta>{erro}</Alerta></div>}
            <div className="mt-4 space-y-2">
              <Botao className="w-full py-3 text-base" onClick={finalizar} disabled={!itens.length || quantidadeInvalida || !caixa || consumo <= 0}>
                Finalizar venda (F2)
              </Botao>
              <div className="flex gap-2">
                <Botao variante="secundario" className="flex-1" disabled={!itens.length || quantidadeInvalida || !!orcamento} carregando={enviando && !pagando}
                  onClick={() => enviar({ ...corpoBase(), orcamentoId: null, finalizar: false })}>
                  <FileText className="size-4" aria-hidden /> Salvar orçamento
                </Botao>
                <Botao variante="fantasma" onClick={limpar} disabled={!itens.length && !cliente}>Limpar</Botao>
              </div>
              {orcamento && <button onClick={() => navegar(`/vendas/${orcamento.id}`)} className="w-full text-center text-xs text-stone-500 hover:underline">Ver orçamento nº {orcamento.id}</button>}
            </div>
          </Cartao>
        </div>
      </div>

      <JanelaPagamento
        key={pagando}
        aberta={pagando > 0 && !motivos}
        total={total}
        temCliente={!!cliente}
        enviando={enviando}
        erro={erro}
        aoFechar={() => setPagando(0)}
        aoConfirmar={(pagamentos: PagamentoEnvio[]) => enviar({ ...corpoBase(), finalizar: true, pagamentos })}
      />
      <AutorizacaoGerente motivos={motivos} aoFechar={() => setMotivos(null)} aoConfirmar={(c) => enviar(pendente!, c)} />
    </div>
  );
}
