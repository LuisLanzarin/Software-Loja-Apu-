import { formatarReais } from '../../lib/formato';
import type { SessaoCaixa } from '../../lib/caixa';

export const NOMES = { DINHEIRO: 'Dinheiro', PIX: 'PIX', DEBITO: 'Débito', CREDITO: 'Crédito', BOLETO: 'Boleto' } as const;
export const TIPOS_CAIXA = { VENDA: 'Venda', ESTORNO_VENDA: 'Estorno', SANGRIA: 'Sangria', SUPRIMENTO: 'Suprimento' } as const;
const ORDEM = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'];

/** Tabela "esperado × informado" do fechamento. */
export function Conferencia({ sessao }: { sessao: SessaoCaixa }) {
  const total = sessao.fechamento.reduce((a, f) => ({ esperado: a.esperado + f.esperado, informado: a.informado + f.informado, diferenca: a.diferenca + f.diferenca }), { esperado: 0, informado: 0, diferenca: 0 });
  const cor = (d: number) => (d < 0 ? 'text-red-700' : d > 0 ? 'text-amber-700' : 'text-emerald-700');
  return (
    <div>
      <table className="w-full max-w-xl text-sm tabular-nums">
        <thead className="text-left text-xs text-stone-500 uppercase">
          <tr><th className="py-1">Forma</th><th className="py-1 text-right">Sistema</th><th className="py-1 text-right">Informado</th><th className="py-1 text-right">Diferença</th></tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {[...sessao.fechamento].sort((a, b) => ORDEM.indexOf(a.forma) - ORDEM.indexOf(b.forma)).map((f) => (
            <tr key={f.forma}>
              <td className="py-1.5">{NOMES[f.forma]}</td>
              <td className="py-1.5 text-right">{formatarReais(f.esperado)}</td>
              <td className="py-1.5 text-right">{formatarReais(f.informado)}</td>
              <td className={`py-1.5 text-right font-medium ${cor(f.diferenca)}`}>{f.diferenca > 0 ? '+' : ''}{formatarReais(f.diferenca)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-1.5">Total</td>
            <td className="py-1.5 text-right">{formatarReais(total.esperado)}</td>
            <td className="py-1.5 text-right">{formatarReais(total.informado)}</td>
            <td className={`py-1.5 text-right ${cor(total.diferenca)}`}>{total.diferenca > 0 ? '+' : ''}{formatarReais(total.diferenca)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-stone-500">
        Dinheiro do sistema = fundo de troco ({formatarReais(sessao.fundoTroco)}) + vendas em dinheiro − troco − sangrias + suprimentos.
        {sessao.totais.boletos > 0 && <> Vendas no boleto ({formatarReais(sessao.totais.boletos)}) não entram no caixa.</>}
      </p>
      {sessao.observacao && <p className="mt-2 text-sm">Observação: {sessao.observacao}</p>}
    </div>
  );
}
