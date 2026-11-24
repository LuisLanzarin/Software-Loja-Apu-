import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Paginacao, Selecao, Tabela, Vazio } from '../../components/ui';
import { api } from '../../lib/api';
import { formatarDataHora, formatarReais } from '../../lib/formato';
import { NOMES_FORMA, type Pagina, type StatusVenda, type Venda } from '../../lib/tipos';

export const STATUS_VENDA: Record<StatusVenda, { rotulo: string; cor: 'verde' | 'vermelho' | 'azul' | 'cinza' }> = {
  FINALIZADA: { rotulo: 'Finalizada', cor: 'verde' },
  ORCAMENTO: { rotulo: 'Orçamento', cor: 'azul' },
  CONVERTIDO: { rotulo: 'Orçamento convertido', cor: 'cinza' },
  CANCELADA: { rotulo: 'Cancelada', cor: 'vermelho' },
};

const hoje = () => new Date().toLocaleDateString('sv-SE');
const diasAtras = (n: number) => new Date(Date.now() - n * 864e5).toLocaleDateString('sv-SE');

export function Vendas() {
  const navegar = useNavigate();
  const [de, setDe] = useState(hoje());
  const [ate, setAte] = useState(hoje());
  const [status, setStatus] = useState('');
  const [pagina, setPagina] = useState(1);
  const qs = new URLSearchParams({ pagina: String(pagina), ...(de ? { de } : {}), ...(ate ? { ate } : {}), ...(status ? { status } : {}) });
  const { data, isLoading } = useQuery({
    queryKey: ['vendas', qs.toString()],
    queryFn: () => api<Pagina<Venda> & { totalFinalizadas: number; valorFinalizadas: number }>(`/vendas?${qs}`),
    placeholderData: keepPreviousData,
  });
  const periodo = (d: string, a: string) => { setDe(d); setAte(a); setPagina(1); };

  return (
    <>
      <Cabecalho
        titulo="Vendas e orçamentos"
        acoes={<Botao onClick={() => navegar('/pdv')}><ShoppingCart className="size-4" aria-hidden /> Nova venda</Botao>}
      />
      <Cartao className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1 pb-0.5">
            <Botao variante="secundario" onClick={() => periodo(hoje(), hoje())}>Hoje</Botao>
            <Botao variante="secundario" onClick={() => periodo(diasAtras(6), hoje())}>7 dias</Botao>
            <Botao variante="secundario" onClick={() => periodo(diasAtras(29), hoje())}>30 dias</Botao>
          </div>
          <Campo rotulo="De" type="date" value={de} onChange={(e) => { setDe(e.target.value); setPagina(1); }} />
          <Campo rotulo="Até" type="date" value={ate} onChange={(e) => { setAte(e.target.value); setPagina(1); }} />
          <Selecao rotulo="Situação" value={status} onChange={(e) => { setStatus(e.target.value); setPagina(1); }} className="w-52">
            <option value="">Todas</option>
            <option value="FINALIZADA">Finalizadas</option>
            <option value="ORCAMENTO">Orçamentos em aberto</option>
            <option value="CANCELADA">Canceladas</option>
          </Selecao>
          {data && (
            <p className="ml-auto pb-2 text-sm text-stone-600">
              {data.totalFinalizadas} venda(s) finalizada(s): <strong className="text-base text-stone-900">{formatarReais(data.valorFinalizadas)}</strong>
            </p>
          )}
        </div>
      </Cartao>
      <Cartao className="overflow-hidden [&>div]:p-0">
        {isLoading ? <Carregando /> : (
          <Tabela
            colunas={[{ titulo: 'Nº' }, { titulo: 'Data' }, { titulo: 'Cliente' }, { titulo: 'Vendedor' }, { titulo: 'Pagamento' }, { titulo: 'Total', direita: true }, { titulo: 'Situação' }]}
            vazio={!data?.itens.length && <Vazio>Nenhuma venda no período.</Vazio>}
          >
            {data?.itens.map((v) => (
              <tr key={v.id} onClick={() => navegar(`/vendas/${v.id}`)} className={`cursor-pointer hover:bg-marca-50/50 ${v.status === 'CANCELADA' ? 'text-stone-400' : ''}`}>
                <td className="px-4 py-2.5 font-mono text-xs">{v.id}</td>
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{formatarDataHora(v.criadoEm)}</td>
                <td className="px-4 py-2.5">{v.cliente?.nome ?? <span className="text-stone-400">—</span>}</td>
                <td className="px-4 py-2.5">{v.vendedor.nome}</td>
                <td className="px-4 py-2.5 text-stone-600">{[...new Set(v.pagamentos.map((p) => NOMES_FORMA[p.forma]))].join(' + ') || '—'}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatarReais(v.total)}</td>
                <td className="px-4 py-2.5"><Etiqueta cor={STATUS_VENDA[v.status].cor}>{STATUS_VENDA[v.status].rotulo}</Etiqueta></td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
      {data && <Paginacao pagina={pagina} total={data.total} porPagina={data.porPagina} aoMudar={setPagina} />}
    </>
  );
}
