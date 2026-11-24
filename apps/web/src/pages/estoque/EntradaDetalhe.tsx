import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, PackagePlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Janela, Margem, Tabela } from '../../components/ui';
import { api } from '../../lib/api';
import { formatarDataHora, formatarDocumento, formatarQtd, formatarReais } from '../../lib/formato';
import { usePode } from '../../lib/sessao';

interface Entrada {
  id: number;
  numeroNota: string | null;
  dataEmissao: string | null;
  frete: number;
  outrasDespesas: number;
  desconto: number;
  totalProdutos: number;
  totalNota: number;
  observacoes: string | null;
  status: 'FINALIZADA' | 'CANCELADA';
  criadoEm: string;
  canceladaEm: string | null;
  motivoCancelamento: string | null;
  fornecedor: { razaoSocial: string; nomeFantasia: string | null; documento: string | null } | null;
  usuario: { nome: string } | null;
  canceladaPor: { nome: string } | null;
  itens: {
    id: number; quantidade: number; custoUnitario: number; quantidadeEstoque: number; custoTotal: number;
    custoMedioAntes: number; custoMedioDepois: number; unidade: { sigla: string };
    produto: { id: number; codigo: string; descricao: string; unidade: { sigla: string } };
  }[];
}

interface AlertaMargem { id: number; codigo: string; descricao: string; custo: number; precoVenda: number; margemDesejada: number; margemReal: number | null }

export function EntradaDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const pode = usePode();
  const qc = useQueryClient();
  const estado = useLocation().state as { alertasMargem?: AlertaMargem[]; nova?: boolean } | null;
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState('');
  const { data: e } = useQuery({ queryKey: ['entrada', id], queryFn: () => api<Entrada>(`/entradas/${id}`) });

  const cancelar = useMutation({
    mutationFn: (motivo: string) => api(`/entradas/${id}/cancelar`, { method: 'POST', body: { motivo } }),
    onSuccess: async () => {
      setCancelando(false);
      await qc.invalidateQueries();
    },
    onError: (x) => setErro(x.message),
  });

  if (!e) return <Carregando />;

  return (
    <>
      <Cabecalho
        titulo={`Entrada nº ${e.id}`}
        descricao={`${formatarDataHora(e.criadoEm)} · lançada por ${e.usuario?.nome ?? '—'}`}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => navegar('/entradas')}><ArrowLeft className="size-4" aria-hidden /> Entradas</Botao>
            {e.status === 'FINALIZADA' && pode('estoque.cancelar_entrada') && (
              <Botao variante="perigo" onClick={() => { setErro(''); setCancelando(true); }}><Ban className="size-4" aria-hidden /> Cancelar entrada</Botao>
            )}
            {estado?.nova && <Botao onClick={() => navegar('/entradas/nova')}><PackagePlus className="size-4" aria-hidden /> Nova entrada</Botao>}
          </>
        }
      />

      <div className="mb-6 space-y-3">
        {estado?.nova && <Alerta tipo="sucesso">Entrada registrada. O estoque e o custo médio dos produtos foram atualizados.</Alerta>}
        {e.status === 'CANCELADA' && (
          <Alerta>Cancelada em {formatarDataHora(e.canceladaEm!)} por {e.canceladaPor?.nome}: {e.motivoCancelamento}</Alerta>
        )}
        {!!estado?.alertasMargem?.length && e.status === 'FINALIZADA' && (
          <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            <p className="font-medium">Com o novo custo, estes produtos ficaram abaixo da margem desejada:</p>
            <ul className="mt-2 space-y-1">
              {estado.alertasMargem.map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <Link to={`/produtos/${a.id}`} className="underline">{a.descricao}</Link>
                  <span className="tabular-nums">custo {formatarReais(a.custo)} · preço {formatarReais(a.precoVenda)} · margem <Margem real={a.margemReal} desejada={a.margemDesejada} /></span>
                </li>
              ))}
            </ul>
            <p className="mt-2">Revise o preço no produto ou use <Link to="/produtos/reajuste" className="underline">Reajustar preços</Link>.</p>
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Cartao>
          <p className="text-sm text-stone-600">Fornecedor</p>
          <p className="mt-1 font-medium">{e.fornecedor ? e.fornecedor.nomeFantasia || e.fornecedor.razaoSocial : 'Não informado'}</p>
          {e.fornecedor?.documento && <p className="text-xs text-stone-500">{formatarDocumento(e.fornecedor.documento)}</p>}
        </Cartao>
        <Cartao>
          <p className="text-sm text-stone-600">Nota</p>
          <p className="mt-1 font-medium">{e.numeroNota ?? '—'}</p>
          {e.dataEmissao && <p className="text-xs text-stone-500">Emitida em {new Date(e.dataEmissao).toLocaleDateString('pt-BR')}</p>}
        </Cartao>
        <Cartao>
          <p className="text-sm text-stone-600">Total da nota</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatarReais(e.totalNota)}</p>
          {e.status === 'CANCELADA' && <Etiqueta cor="vermelho">Cancelada</Etiqueta>}
        </Cartao>
      </div>

      <Cartao titulo="Itens" className="overflow-hidden [&>div:last-child]:p-0">
        <Tabela colunas={[{ titulo: 'Produto' }, { titulo: 'Na nota', direita: true }, { titulo: 'Custo un.', direita: true }, { titulo: 'No estoque', direita: true }, { titulo: 'Custo final', direita: true }, { titulo: 'Custo médio', direita: true }]}>
          {e.itens.map((i) => (
            <tr key={i.id}>
              <td className="px-4 py-2.5"><Link to={`/estoque/${i.produto.id}`} className="font-medium hover:underline">{i.produto.descricao}</Link><span className="block font-mono text-xs text-stone-500">{i.produto.codigo}</span></td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatarQtd(i.quantidade)} {i.unidade.sigla}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatarReais(i.custoUnitario)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatarQtd(i.quantidadeEstoque)} {i.produto.unidade.sigla}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatarReais(Math.round((i.custoTotal * 1000) / i.quantidadeEstoque))}<span className="block text-xs text-stone-500">/{i.produto.unidade.sigla} c/ rateio</span></td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatarReais(i.custoMedioAntes)} → <strong>{formatarReais(i.custoMedioDepois)}</strong></td>
            </tr>
          ))}
        </Tabela>
        <div className="flex justify-end border-t border-stone-200 px-5 py-3 text-sm">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 tabular-nums">
            <dt>Produtos</dt><dd className="text-right">{formatarReais(e.totalProdutos)}</dd>
            {e.frete > 0 && <><dt>(+) Frete</dt><dd className="text-right">{formatarReais(e.frete)}</dd></>}
            {e.outrasDespesas > 0 && <><dt>(+) Outras despesas</dt><dd className="text-right">{formatarReais(e.outrasDespesas)}</dd></>}
            {e.desconto > 0 && <><dt>(−) Desconto</dt><dd className="text-right">{formatarReais(e.desconto)}</dd></>}
            <dt className="font-semibold">Total</dt><dd className="text-right font-semibold">{formatarReais(e.totalNota)}</dd>
          </dl>
        </div>
      </Cartao>
      {e.observacoes && <Cartao titulo="Observações" className="mt-6"><p className="text-sm whitespace-pre-line">{e.observacoes}</p></Cartao>}

      <Janela aberta={cancelando} aoFechar={() => setCancelando(false)} titulo={`Cancelar entrada nº ${e.id}`}>
        <form
          onSubmit={(ev: FormEvent<HTMLFormElement>) => { ev.preventDefault(); cancelar.mutate(String(new FormData(ev.currentTarget).get('motivo'))); }}
          className="space-y-4"
        >
          <p className="text-sm text-stone-600">As quantidades saem do estoque e o custo médio volta ao que era. Só é possível se o material ainda estiver em estoque.</p>
          <Campo rotulo="Motivo" name="motivo" required minLength={5} autoFocus placeholder="Ex.: nota lançada em duplicidade" />
          <Alerta>{erro}</Alerta>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setCancelando(false)}>Voltar</Botao>
            <Botao type="submit" variante="perigo" carregando={cancelar.isPending}>Cancelar entrada</Botao>
          </div>
        </form>
      </Janela>
    </>
  );
}
