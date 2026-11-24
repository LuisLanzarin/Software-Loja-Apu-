import { Banknote, CreditCard, FileText, QrCode, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Alerta, Botao, Janela } from '../../components/ui';
import { decimalParaTexto, formatarReais, lerDecimal } from '../../lib/formato';
import { NOMES_FORMA, type FormaPagamento } from '../../lib/tipos';

export interface PagamentoEnvio {
  forma: FormaPagamento;
  valor: number;
  parcelas: number;
  primeiroVencimento?: string;
}

interface Linha {
  chave: number;
  forma: FormaPagamento;
  valor: string;
  parcelas: string;
  vencimento: string;
}

const ICONES = { DINHEIRO: Banknote, PIX: QrCode, DEBITO: CreditCard, CREDITO: CreditCard, BOLETO: FileText } as const;
const daquiA = (dias: number) => new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10);
const campo = 'rounded-md border-0 py-1.5 text-sm ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-marca-600';

export function JanelaPagamento({
  aberta, total, temCliente, enviando, erro, aoFechar, aoConfirmar,
}: {
  aberta: boolean; total: number; temCliente: boolean; enviando: boolean; erro: string;
  aoFechar: () => void; aoConfirmar: (p: PagamentoEnvio[]) => void;
}) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const valores = linhas.map((l) => lerDecimal(l.valor || '0', 2) ?? 0);
  const recebido = valores.reduce((a, b) => a + b, 0);
  const falta = Math.max(0, total - recebido);
  const troco = Math.max(0, recebido - total);
  const dinheiro = linhas.reduce((a, l, i) => a + (l.forma === 'DINHEIRO' ? valores[i] : 0), 0);
  const trocoInvalido = troco > dinheiro;

  const adicionar = (forma: FormaPagamento) =>
    setLinhas((x) => [...x, { chave: Date.now(), forma, valor: decimalParaTexto(falta || 0, 2), parcelas: '1', vencimento: daquiA(30) }]);
  const alterar = (chave: number, m: Partial<Linha>) => setLinhas((x) => x.map((l) => (l.chave === chave ? { ...l, ...m } : l)));

  function confirmar() {
    aoConfirmar(
      linhas.map((l, i) => ({
        forma: l.forma,
        valor: valores[i],
        parcelas: Number(l.parcelas) || 1,
        ...(l.forma === 'BOLETO' ? { primeiroVencimento: l.vencimento } : {}),
      })),
    );
  }

  return (
    <Janela aberta={aberta} aoFechar={aoFechar} titulo="Pagamento" largura="max-w-2xl">
      <div className="space-y-5">
        <div className="flex items-baseline justify-between">
          <span className="text-stone-600">Total da venda</span>
          <span className="text-3xl font-semibold tabular-nums">{formatarReais(total)}</span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(NOMES_FORMA) as FormaPagamento[]).map((f) => {
            const Icone = ICONES[f];
            return (
              <button key={f} type="button" onClick={() => adicionar(f)} className="flex flex-col items-center gap-1 rounded-md bg-stone-50 py-3 text-sm font-medium ring-1 ring-stone-200 hover:bg-marca-50 hover:ring-marca-500">
                <Icone className="size-5 text-stone-600" aria-hidden /> {NOMES_FORMA[f]}
              </button>
            );
          })}
        </div>

        {linhas.length > 0 && (
          <ul className="space-y-2">
            {linhas.map((l) => (
              <li key={l.chave} className="flex flex-wrap items-center gap-2 rounded-md p-2 ring-1 ring-stone-200">
                <span className="w-20 text-sm font-medium">{NOMES_FORMA[l.forma]}</span>
                <label className="sr-only" htmlFor={`v${l.chave}`}>Valor em {NOMES_FORMA[l.forma]}</label>
                <input id={`v${l.chave}`} autoFocus inputMode="decimal" value={l.valor} onChange={(e) => alterar(l.chave, { valor: e.target.value })}
                  onFocus={(e) => e.target.select()} className={`${campo} w-32 text-right tabular-nums`} />
                {(l.forma === 'CREDITO' || l.forma === 'BOLETO') && (
                  <select aria-label="Parcelas" value={l.parcelas} onChange={(e) => alterar(l.chave, { parcelas: e.target.value })} className={campo}>
                    {Array.from({ length: l.forma === 'BOLETO' ? 12 : 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}x</option>)}
                  </select>
                )}
                {l.forma === 'BOLETO' && (
                  <label className="flex items-center gap-1 text-sm text-stone-600">
                    1º venc.
                    <input type="date" value={l.vencimento} min={daquiA(0)} onChange={(e) => alterar(l.chave, { vencimento: e.target.value })} className={campo} />
                  </label>
                )}
                <button type="button" onClick={() => setLinhas((x) => x.filter((y) => y.chave !== l.chave))} className="ml-auto rounded p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-700" aria-label="Remover pagamento">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {linhas.some((l) => l.forma === 'BOLETO') && !temCliente && <Alerta tipo="info">Boleto precisa de um cliente com CPF/CNPJ. Feche esta janela e selecione o cliente.</Alerta>}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md bg-stone-50 p-3"><p className="text-xs text-stone-500">Recebido</p><p className="text-lg font-semibold tabular-nums">{formatarReais(recebido)}</p></div>
          <div className={`rounded-md p-3 ${falta ? 'bg-red-50 text-red-800' : 'bg-stone-50'}`}><p className="text-xs">Falta</p><p className="text-lg font-semibold tabular-nums">{formatarReais(falta)}</p></div>
          <div className={`rounded-md p-3 ${troco ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-50'}`}><p className="text-xs">Troco</p><p className="text-lg font-semibold tabular-nums">{formatarReais(troco)}</p></div>
        </div>
        {trocoInvalido && <Alerta>Só pagamento em dinheiro pode ter troco.</Alerta>}
        <Alerta>{erro}</Alerta>

        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={aoFechar}>Voltar</Botao>
          <Botao type="button" onClick={confirmar} carregando={enviando} disabled={!linhas.length || falta > 0 || trocoInvalido}>Confirmar venda</Botao>
        </div>
      </div>
    </Janela>
  );
}
