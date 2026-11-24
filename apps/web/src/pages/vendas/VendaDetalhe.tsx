import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Printer, ShoppingCart, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AutorizacaoGerente, motivosDoErro, type Credenciais } from '../../components/AutorizacaoGerente';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Janela, Tabela } from '../../components/ui';
import { api } from '../../lib/api';
import { formatarDataHora, formatarDocumento, formatarQtd, formatarReais } from '../../lib/formato';
import { usePode } from '../../lib/sessao';
import { NOMES_FORMA, type MotivoAutorizacao, type Venda } from '../../lib/tipos';
import { STATUS_VENDA } from './Vendas';

export function VendaDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const pode = usePode();
  const { data: v } = useQuery({ queryKey: ['venda', id], queryFn: () => api<Venda>(`/vendas/${id}`) });
  const [cancelando, setCancelando] = useState(false);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [motivos, setMotivos] = useState<MotivoAutorizacao[] | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function cancelar(autorizacao?: Credenciais) {
    setEnviando(true);
    setErro('');
    try {
      await api(`/vendas/${id}/cancelar`, { method: 'POST', body: { motivo: motivoTexto, ...(autorizacao ? { autorizacao } : {}) } });
      setCancelando(false);
      setMotivos(null);
      await qc.invalidateQueries();
    } catch (e) {
      const m = motivosDoErro(e);
      if (m && !autorizacao) { setCancelando(false); setMotivos(m); }
      else if (autorizacao) throw e;
      else setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function descartar() {
    await api(`/vendas/${id}/descartar-orcamento`, { method: 'POST' });
    await qc.invalidateQueries();
  }

  if (!v) return <Carregando />;
  const orcamento = v.status === 'ORCAMENTO';
  const vencido = orcamento && v.validoAte && new Date(v.validoAte) < new Date();

  return (
    <>
      <Cabecalho
        titulo={`${v.status === 'ORCAMENTO' || v.status === 'CONVERTIDO' ? 'Orçamento' : 'Venda'} nº ${v.id}`}
        descricao={`${formatarDataHora(v.criadoEm)} · ${v.vendedor.nome}`}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => navegar('/vendas')}><ArrowLeft className="size-4" aria-hidden /> Vendas</Botao>
            <Botao variante="secundario" onClick={() => window.open(`/vendas/${v.id}/imprimir`, '_blank', 'width=420,height=700')}><Printer className="size-4" aria-hidden /> Imprimir</Botao>
            {orcamento && pode('venda.realizar') && (
              <>
                <Botao variante="secundario" onClick={descartar}><Trash2 className="size-4" aria-hidden /> Descartar</Botao>
                <Botao onClick={() => navegar(`/pdv?orcamento=${v.id}`)}><ShoppingCart className="size-4" aria-hidden /> Abrir no PDV</Botao>
              </>
            )}
            {v.status === 'FINALIZADA' && pode('venda.realizar') && (
              <Botao variante="perigo" onClick={() => { setErro(''); setMotivoTexto(''); setCancelando(true); }}><Ban className="size-4" aria-hidden /> Cancelar venda</Botao>
            )}
          </>
        }
      />

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta cor={STATUS_VENDA[v.status].cor}>{STATUS_VENDA[v.status].rotulo}</Etiqueta>
          {orcamento && v.validoAte && <span className={`text-sm ${vencido ? 'text-red-700' : 'text-stone-600'}`}>Válido até {new Date(v.validoAte).toLocaleDateString('pt-BR')}{vencido ? ' (vencido: valerão os preços atuais)' : ''}</span>}
          {v.vendaGerada && <Link to={`/vendas/${v.vendaGerada.id}`} className="text-sm text-marca-700 underline">Virou a venda nº {v.vendaGerada.id}</Link>}
          {v.orcamentoOrigemId && <Link to={`/vendas/${v.orcamentoOrigemId}`} className="text-sm text-marca-700 underline">Veio do orçamento nº {v.orcamentoOrigemId}</Link>}
        </div>
        {v.status === 'CANCELADA' && v.canceladaEm && <Alerta>Cancelada em {formatarDataHora(v.canceladaEm)} por {v.canceladaPor?.nome}: {v.motivoCancelamento}</Alerta>}
        {v.autorizadoPor && <Alerta tipo="info">Autorizado por {v.autorizadoPor.nome}: {v.motivosAutorizacao}</Alerta>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Cartao titulo="Itens" className="overflow-hidden [&>div:last-child]:p-0">
          <Tabela colunas={[{ titulo: 'Produto' }, { titulo: 'Qtd.', direita: true }, { titulo: 'Preço', direita: true }, { titulo: 'Desconto', direita: true }, { titulo: 'Total', direita: true }]}>
            {v.itens.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2.5">{i.descricao}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatarQtd(i.quantidade)} {i.unidadeSigla}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatarReais(i.precoUnitario)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">{i.desconto ? formatarReais(i.desconto) : '—'}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatarReais(i.total)}</td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
        <div className="space-y-6">
          <Cartao titulo="Resumo">
            <dl className="space-y-1.5 text-sm tabular-nums">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatarReais(v.subtotal)}</dd></div>
              {v.descontoItens > 0 && <div className="flex justify-between"><dt>Desconto nos itens</dt><dd>− {formatarReais(v.descontoItens)}</dd></div>}
              {v.descontoGeral > 0 && <div className="flex justify-between"><dt>Desconto na venda</dt><dd>− {formatarReais(v.descontoGeral)}</dd></div>}
              {v.taxaServico > 0 && <div className="flex justify-between"><dt>Taxa de serviço</dt><dd>+ {formatarReais(v.taxaServico)}</dd></div>}
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatarReais(v.total)}</dd></div>
              {v.pagamentos.map((p) => (
                <div key={p.id} className="flex justify-between text-stone-600"><dt>{NOMES_FORMA[p.forma]}{p.parcelas > 1 ? ` (${p.parcelas}x)` : ''}</dt><dd>{formatarReais(p.valor)}</dd></div>
              ))}
              {v.troco > 0 && <div className="flex justify-between text-stone-600"><dt>Troco</dt><dd>{formatarReais(v.troco)}</dd></div>}
            </dl>
          </Cartao>
          <Cartao titulo="Cliente">
            {v.cliente ? (
              <div className="text-sm"><p className="font-medium">{v.cliente.nome}</p><p className="text-stone-500">{[formatarDocumento(v.cliente.documento), v.cliente.telefone].filter(Boolean).join(' · ')}</p></div>
            ) : <p className="text-sm text-stone-500">Não informado</p>}
          </Cartao>
          {v.boletos.length > 0 && (
            <Cartao titulo="Boletos">
              <ul className="space-y-1.5 text-sm">
                {v.boletos.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 tabular-nums">
                    <span>{b.parcela}/{b.totalParcelas} · {new Date(b.vencimento).toLocaleDateString('pt-BR')}</span>
                    <span className="flex items-center gap-2">{formatarReais(b.valor)}<Etiqueta cor={b.status === 'PAGO' ? 'verde' : b.status === 'CANCELADO' ? 'cinza' : 'laranja'}>{b.status === 'ABERTO' ? 'Aberto' : b.status === 'PAGO' ? 'Pago' : 'Cancelado'}</Etiqueta></span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
      </div>

      <Janela aberta={cancelando} aoFechar={() => setCancelando(false)} titulo={`Cancelar venda nº ${v.id}`}>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); cancelar(); }} className="space-y-4">
          <p className="text-sm text-stone-600">Os produtos voltam para o estoque e o valor sai do seu caixa como estorno. Boletos em aberto são cancelados.</p>
          <Campo rotulo="Motivo" required minLength={5} autoFocus value={motivoTexto} onChange={(e) => setMotivoTexto(e.target.value)} placeholder="Ex.: cliente desistiu da compra" />
          <Alerta>{erro}</Alerta>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setCancelando(false)}>Voltar</Botao>
            <Botao type="submit" variante="perigo" carregando={enviando}>Cancelar venda</Botao>
          </div>
        </form>
      </Janela>
      <AutorizacaoGerente motivos={motivos} aoFechar={() => setMotivos(null)} aoConfirmar={(c) => cancelar(c)} />
    </>
  );
}
