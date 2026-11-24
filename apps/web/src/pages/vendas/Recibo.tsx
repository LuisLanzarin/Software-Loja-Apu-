import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { api } from '../../lib/api';
import { formatarDataHora, formatarDocumento, formatarQtd, formatarReais } from '../../lib/formato';
import { useUsuario } from '../../lib/sessao';
import { NOMES_FORMA, type Venda } from '../../lib/tipos';

/** Comprovante NÃO fiscal, no formato de bobina (80 mm) — também imprime bem em A4. */
export function Recibo() {
  const { id } = useParams();
  const u = useUsuario();
  const { data: v } = useQuery({ queryKey: ['venda', id], queryFn: () => api<Venda>(`/vendas/${id}`) });

  useEffect(() => {
    if (v) setTimeout(() => window.print(), 300);
  }, [v]);
  if (!v) return null;
  const orcamento = v.status === 'ORCAMENTO';

  return (
    <div className="mx-auto max-w-[80mm] bg-white p-3 font-mono text-[11px] leading-snug text-black print:p-0">
      <style>{'@page { margin: 4mm; } body { background: white; }'}</style>
      <p className="text-center text-sm font-bold">{u.loja.nome}</p>
      <p className="text-center">{orcamento ? 'ORÇAMENTO' : 'COMPROVANTE DE VENDA'} Nº {v.id}</p>
      <p className="text-center">{formatarDataHora(v.criadoEm)}</p>
      {v.status === 'CANCELADA' && <p className="my-1 text-center font-bold">*** VENDA CANCELADA ***</p>}
      <hr className="my-2 border-dashed border-black" />
      {v.cliente && (
        <>
          <p>Cliente: {v.cliente.nome}</p>
          {v.cliente.documento && <p>CPF/CNPJ: {formatarDocumento(v.cliente.documento)}</p>}
          <hr className="my-2 border-dashed border-black" />
        </>
      )}
      {v.itens.map((i) => (
        <div key={i.id} className="mb-1">
          <p>{i.descricao}</p>
          <p className="flex justify-between">
            <span>{formatarQtd(i.quantidade)} {i.unidadeSigla} x {formatarReais(i.precoUnitario)}{i.desconto ? ` -${formatarReais(i.desconto)}` : ''}</span>
            <span>{formatarReais(i.total)}</span>
          </p>
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      <p className="flex justify-between"><span>Subtotal</span><span>{formatarReais(v.subtotal)}</span></p>
      {v.descontoItens + v.descontoGeral > 0 && <p className="flex justify-between"><span>Descontos</span><span>-{formatarReais(v.descontoItens + v.descontoGeral)}</span></p>}
      <p className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{formatarReais(v.total)}</span></p>
      {!orcamento && (
        <>
          <hr className="my-2 border-dashed border-black" />
          {v.pagamentos.map((p) => (
            <p key={p.id} className="flex justify-between"><span>{NOMES_FORMA[p.forma]}{p.parcelas > 1 ? ` ${p.parcelas}x` : ''}</span><span>{formatarReais(p.valor + (p.forma === 'DINHEIRO' ? v.troco : 0))}</span></p>
          ))}
          {v.troco > 0 && <p className="flex justify-between"><span>Troco</span><span>{formatarReais(v.troco)}</span></p>}
          {v.boletos.map((b) => (
            <p key={b.id} className="flex justify-between"><span>Boleto {b.parcela}/{b.totalParcelas} venc. {new Date(b.vencimento).toLocaleDateString('pt-BR')}</span><span>{formatarReais(b.valor)}</span></p>
          ))}
        </>
      )}
      <hr className="my-2 border-dashed border-black" />
      {orcamento && v.validoAte && <p className="text-center font-bold">Válido até {new Date(v.validoAte).toLocaleDateString('pt-BR')}</p>}
      <p className="text-center">Vendedor: {v.vendedor.nome}</p>
      <p className="mt-2 text-center">Documento sem valor fiscal</p>
    </div>
  );
}
