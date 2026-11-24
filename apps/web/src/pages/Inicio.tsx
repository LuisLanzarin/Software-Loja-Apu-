import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, PackagePlus, ShoppingCart, Wallet } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import type { Resumo } from '../lib/tipos';
import { Cabecalho, Cartao, Margem } from '../components/ui';
import { formatarReais } from '../lib/formato';
import { usePode } from '../lib/sessao';
import { useUsuario } from '../lib/sessao';

export function Inicio() {
  const u = useUsuario();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <>
      <Cabecalho titulo={`${saudacao}, ${u.nome.split(' ')[0]}!`} descricao={u.loja.nome} />
      <AlertasEstoque />
      <ResumoDoDia />
      <Atalhos />
    </>
  );
}

function AlertasEstoque() {
  const { data } = useQuery({ queryKey: ['estoque-resumo'], queryFn: () => api<Resumo>('/estoque/resumo') });
  if (!data || (!data.abaixoMinimo && !data.semEstoque)) return null;
  return (
    <div className="mb-6 flex max-w-xl items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">Atenção ao estoque</p>
        <p className="mt-1">
          {data.abaixoMinimo > 0 && (
            <Link to="/estoque?filtro=abaixo_minimo" className="underline">{data.abaixoMinimo} produto(s) abaixo do mínimo</Link>
          )}
          {data.abaixoMinimo > 0 && data.semEstoque > 0 && ' · '}
          {data.semEstoque > 0 && <Link to="/estoque?filtro=sem_estoque" className="underline">{data.semEstoque} sem estoque</Link>}
        </p>
      </div>
    </div>
  );
}

function ResumoDoDia() {
  const pode = usePode();
  const hoje = new Date().toLocaleDateString('sv-SE');
  const { data } = useQuery({
    queryKey: ['rel-vendas', hoje, hoje, 'dia'],
    queryFn: () => api<{ totais: { quantidade: number; faturamento: number; ticketMedio: number; lucroBruto: number; margemBruta: number | null } }>(`/relatorios/vendas?de=${hoje}&ate=${hoje}&agrupar=dia`),
    enabled: pode('relatorio.ver'),
    refetchInterval: 60_000,
  });
  if (!data) return null;
  const t = data.totais;
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-4">
      <Cartao><p className="text-sm text-stone-600">Vendido hoje</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatarReais(t.faturamento)}</p></Cartao>
      <Cartao><p className="text-sm text-stone-600">Vendas hoje</p><p className="mt-1 text-2xl font-semibold tabular-nums">{t.quantidade}</p></Cartao>
      <Cartao><p className="text-sm text-stone-600">Ticket médio</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatarReais(t.ticketMedio)}</p></Cartao>
      <Cartao><p className="text-sm text-stone-600">Lucro bruto hoje</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatarReais(t.lucroBruto)}</p><p className="text-xs text-stone-500">Margem <Margem real={t.margemBruta} /></p></Cartao>
    </div>
  );
}

function Atalhos() {
  const pode = usePode();
  const itens = [
    { para: '/pdv', rotulo: 'Nova venda', icone: ShoppingCart, ok: pode('venda.realizar') },
    { para: '/caixa', rotulo: 'Caixa', icone: Wallet, ok: pode('caixa.operar') },
    { para: '/entradas/nova', rotulo: 'Entrada de mercadoria', icone: PackagePlus, ok: pode('estoque.entrada') },
    { para: '/relatorios', rotulo: 'Relatórios', icone: BarChart3, ok: pode('relatorio.ver') },
  ].filter((i) => i.ok);
  return (
    <div className="grid max-w-3xl gap-3 sm:grid-cols-4">
      {itens.map(({ para, rotulo, icone: Icone }) => (
        <Link key={para} to={para} className="flex flex-col items-center gap-2 rounded-lg bg-white p-5 text-sm font-medium shadow-sm ring-1 ring-stone-200 hover:ring-marca-500">
          <Icone className="size-6 text-marca-600" aria-hidden /> {rotulo}
        </Link>
      ))}
    </div>
  );
}
