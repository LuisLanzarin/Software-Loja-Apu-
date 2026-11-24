import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PackagePlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Botao, Cabecalho, Carregando, Cartao, Etiqueta, Paginacao, Tabela, Vazio } from '../../components/ui';
import { api } from '../../lib/api';
import { formatarDataHora, formatarReais } from '../../lib/formato';
import type { Pagina } from '../../lib/tipos';

interface EntradaResumo {
  id: number;
  numeroNota: string | null;
  totalNota: number;
  status: 'FINALIZADA' | 'CANCELADA';
  criadoEm: string;
  fornecedor: { razaoSocial: string; nomeFantasia: string | null } | null;
  usuario: { nome: string } | null;
  _count: { itens: number };
}

export function Entradas() {
  const navegar = useNavigate();
  const [pagina, setPagina] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['entradas', pagina],
    queryFn: () => api<Pagina<EntradaResumo>>(`/entradas?pagina=${pagina}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <Cabecalho
        titulo="Entradas de mercadoria"
        descricao="Notas de compra lançadas no estoque."
        acoes={<Botao onClick={() => navegar('/entradas/nova')}><PackagePlus className="size-4" aria-hidden /> Nova entrada</Botao>}
      />
      <Cartao className="overflow-hidden [&>div]:p-0">
        {isLoading ? <Carregando /> : (
          <Tabela
            colunas={[{ titulo: 'Nº' }, { titulo: 'Data' }, { titulo: 'Fornecedor' }, { titulo: 'Nota' }, { titulo: 'Itens', direita: true }, { titulo: 'Total', direita: true }, { titulo: 'Lançada por' }, { titulo: '' }]}
            vazio={!data?.itens.length && <Vazio>Nenhuma entrada lançada ainda.</Vazio>}
          >
            {data?.itens.map((e) => (
              <tr key={e.id} onClick={() => navegar(`/entradas/${e.id}`)} className={`cursor-pointer hover:bg-marca-50/50 ${e.status === 'CANCELADA' ? 'text-stone-400' : ''}`}>
                <td className="px-4 py-2.5 font-mono text-xs">{e.id}</td>
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{formatarDataHora(e.criadoEm)}</td>
                <td className="px-4 py-2.5">{e.fornecedor ? e.fornecedor.nomeFantasia || e.fornecedor.razaoSocial : '—'}</td>
                <td className="px-4 py-2.5">{e.numeroNota ?? '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{e._count.itens}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatarReais(e.totalNota)}</td>
                <td className="px-4 py-2.5">{e.usuario?.nome ?? '—'}</td>
                <td className="px-4 py-2.5">{e.status === 'CANCELADA' && <Etiqueta cor="vermelho">Cancelada</Etiqueta>}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
      {data && <Paginacao pagina={pagina} total={data.total} porPagina={data.porPagina} aoMudar={setPagina} />}
    </>
  );
}
