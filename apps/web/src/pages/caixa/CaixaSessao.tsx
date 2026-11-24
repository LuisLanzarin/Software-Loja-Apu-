import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { Botao, Cabecalho, Carregando, Cartao, Tabela } from '../../components/ui';
import { api } from '../../lib/api';
import type { SessaoCaixa } from '../../lib/caixa';
import { formatarDataHora, formatarReais } from '../../lib/formato';
import { Conferencia, NOMES, TIPOS_CAIXA } from './Conferencia';

export function CaixaSessao() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { data: s } = useQuery({ queryKey: ['caixa-sessao', id], queryFn: () => api<SessaoCaixa>(`/caixa/sessoes/${id}`) });
  if (!s) return <Carregando />;
  return (
    <>
      <Cabecalho
        titulo={`Caixa nº ${s.id} — ${s.usuario.nome}`}
        descricao={`${formatarDataHora(s.abertoEm)} até ${s.fechadoEm ? formatarDataHora(s.fechadoEm) : 'agora (aberto)'}`}
        acoes={<Botao variante="secundario" onClick={() => navegar('/caixa')}><ArrowLeft className="size-4" aria-hidden /> Caixa</Botao>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Cartao><p className="text-sm text-stone-600">Vendas</p><p className="mt-1 text-lg font-semibold tabular-nums">{s.totais!.quantidadeVendas} · {formatarReais(s.totais!.faturamento)}</p></Cartao>
        <Cartao><p className="text-sm text-stone-600">Estornos</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatarReais(s.totais!.estornos)}</p></Cartao>
        <Cartao><p className="text-sm text-stone-600">No boleto (a prazo)</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatarReais(s.totais!.boletos)}</p></Cartao>
      </div>
      {s.status === 'FECHADO' && <Cartao titulo="Conferência do fechamento" className="mb-6"><Conferencia sessao={s} /></Cartao>}
      <Cartao titulo="Movimentos" className="overflow-hidden [&>div:last-child]:p-0">
        <Tabela colunas={[{ titulo: 'Hora' }, { titulo: 'Tipo' }, { titulo: 'Forma' }, { titulo: 'Valor', direita: true }, { titulo: 'Detalhe' }]}>
          {s.movimentos.map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-2 tabular-nums">{new Date(m.criadoEm).toLocaleTimeString('pt-BR')}</td>
              <td className="px-4 py-2">{TIPOS_CAIXA[m.tipo]}</td>
              <td className="px-4 py-2">{NOMES[m.forma as keyof typeof NOMES] ?? m.forma}</td>
              <td className={`px-4 py-2 text-right tabular-nums ${m.valor < 0 ? 'text-red-700' : ''}`}>{formatarReais(m.valor)}</td>
              <td className="px-4 py-2">{m.vendaId ? <Link className="text-marca-700 underline" to={`/vendas/${m.vendaId}`}>Venda nº {m.vendaId}</Link> : m.motivo}</td>
            </tr>
          ))}
        </Tabela>
      </Cartao>
    </>
  );
}
