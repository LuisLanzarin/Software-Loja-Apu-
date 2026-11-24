import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Janela, Paginacao, Tabela, Vazio } from '../components/ui';
import { api } from '../lib/api';
import { decimalParaTexto, formatarReais, lerDecimal } from '../lib/formato';

interface Boleto {
  id: number; vendaId: number; parcela: number; totalParcelas: number; valor: number; vencimento: string;
  status: 'ABERTO' | 'PAGO' | 'CANCELADO'; pagoEm: string | null; valorPago: number | null;
  cliente: { id: number; nome: string; telefone: string | null }; baixadoPor: { nome: string } | null;
}

const ABAS = [['abertos', 'Em aberto'], ['vencidos', 'Vencidos'], ['pagos', 'Pagos'], ['todos', 'Todos']] as const;

export function Boletos() {
  const qc = useQueryClient();
  const [situacao, setSituacao] = useState<(typeof ABAS)[number][0]>('abertos');
  const [pagina, setPagina] = useState(1);
  const [baixando, setBaixando] = useState<Boleto | null>(null);
  const [erro, setErro] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['boletos', situacao, pagina],
    queryFn: () => api<{ itens: Boleto[]; total: number; porPagina: number; totalAberto: number; totalVencido: number; quantidadeVencidos: number }>(`/boletos?situacao=${situacao}&pagina=${pagina}`),
    placeholderData: keepPreviousData,
  });
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  async function baixar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const valorPago = lerDecimal(f.valor, 2);
    if (!valorPago) return setErro('Informe o valor recebido.');
    try {
      await api(`/boletos/${baixando!.id}/baixar`, { method: 'POST', body: { valorPago, pagoEm: f.data } });
      setBaixando(null);
      await qc.invalidateQueries({ queryKey: ['boletos'] });
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <>
      <Cabecalho titulo="Boletos a receber" descricao="Parcelas das vendas no boleto. Dê baixa quando o pagamento cair na conta." />
      {data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Cartao><p className="text-sm text-stone-600">Total em aberto</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatarReais(data.totalAberto)}</p></Cartao>
          <Cartao><p className="text-sm text-stone-600">Vencidos ({data.quantidadeVencidos})</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${data.totalVencido ? 'text-red-700' : ''}`}>{formatarReais(data.totalVencido)}</p></Cartao>
        </div>
      )}
      <div className="mb-4 flex gap-1">
        {ABAS.map(([k, r]) => (
          <Botao key={k} variante={situacao === k ? 'primario' : 'secundario'} onClick={() => { setSituacao(k); setPagina(1); }}>{r}</Botao>
        ))}
      </div>
      <Cartao className="overflow-hidden [&>div]:p-0">
        {isLoading ? <Carregando /> : (
          <Tabela colunas={[{ titulo: 'Vencimento' }, { titulo: 'Cliente' }, { titulo: 'Venda' }, { titulo: 'Parcela' }, { titulo: 'Valor', direita: true }, { titulo: 'Situação' }, { titulo: '' }]}
            vazio={!data?.itens.length && <Vazio>Nenhum boleto nesta situação.</Vazio>}>
            {data?.itens.map((b) => {
              const vencido = b.status === 'ABERTO' && new Date(b.vencimento) < hoje;
              return (
                <tr key={b.id}>
                  <td className={`px-4 py-2.5 tabular-nums ${vencido ? 'font-medium text-red-700' : ''}`}>{new Date(b.vencimento).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2.5">{b.cliente.nome}{b.cliente.telefone && <span className="block text-xs text-stone-500">{b.cliente.telefone}</span>}</td>
                  <td className="px-4 py-2.5"><Link to={`/vendas/${b.vendaId}`} className="text-marca-700 underline">nº {b.vendaId}</Link></td>
                  <td className="px-4 py-2.5 tabular-nums">{b.parcela}/{b.totalParcelas}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatarReais(b.valor)}</td>
                  <td className="px-4 py-2.5">
                    {b.status === 'PAGO' ? <Etiqueta cor="verde">Pago em {new Date(b.pagoEm!).toLocaleDateString('pt-BR')}</Etiqueta>
                      : b.status === 'CANCELADO' ? <Etiqueta>Cancelado</Etiqueta>
                      : vencido ? <Etiqueta cor="vermelho">Vencido</Etiqueta> : <Etiqueta cor="laranja">Em aberto</Etiqueta>}
                  </td>
                  <td className="px-4 py-1.5 text-right">{b.status === 'ABERTO' && <Botao variante="secundario" onClick={() => { setErro(''); setBaixando(b); }}>Dar baixa</Botao>}</td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </Cartao>
      {data && <Paginacao pagina={pagina} total={data.total} porPagina={data.porPagina} aoMudar={setPagina} />}
      <Janela aberta={!!baixando} aoFechar={() => setBaixando(null)} titulo="Dar baixa no boleto">
        {baixando && (
          <form onSubmit={baixar} className="space-y-4">
            <p className="text-sm text-stone-600">{baixando.cliente.nome} · parcela {baixando.parcela}/{baixando.totalParcelas} · vencimento {new Date(baixando.vencimento).toLocaleDateString('pt-BR')}</p>
            <Campo rotulo="Valor recebido (R$)" name="valor" inputMode="decimal" required defaultValue={decimalParaTexto(baixando.valor, 2)} />
            <Campo rotulo="Data do pagamento" name="data" type="date" required defaultValue={new Date().toLocaleDateString('sv-SE')} />
            <Alerta>{erro}</Alerta>
            <div className="flex justify-end gap-2">
              <Botao type="button" variante="secundario" onClick={() => setBaixando(null)}>Cancelar</Botao>
              <Botao type="submit">Confirmar baixa</Botao>
            </div>
          </form>
        )}
      </Janela>
    </>
  );
}
