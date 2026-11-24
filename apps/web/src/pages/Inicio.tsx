import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import type { Resumo } from '../lib/tipos';
import { Cabecalho, Cartao } from '../components/ui';
import { useUsuario } from '../lib/sessao';

const ETAPAS = [
  { nome: 'Login, usuários, perfis e configurações', feita: true },
  { nome: 'Produtos, fornecedores e formação de preço', feita: true },
  { nome: 'Entrada de mercadoria e controle de estoque', feita: true },
  { nome: 'Vendas, orçamentos e caixa', feita: true },
  { nome: 'Relatórios de fechamento e backup automático', feita: false },
];

export function Inicio() {
  const u = useUsuario();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <>
      <Cabecalho titulo={`${saudacao}, ${u.nome.split(' ')[0]}!`} descricao={u.loja.nome} />
      <AlertasEstoque />
      <Cartao titulo="Andamento do sistema" className="max-w-xl">
        <ol className="space-y-3">
          {ETAPAS.map((e, i) => (
            <li key={e.nome} className="flex items-center gap-3 text-sm">
              {e.feita ? (
                <CheckCircle2 className="size-5 text-emerald-600" aria-label="Concluída" />
              ) : (
                <Circle className="size-5 text-stone-300" aria-label="Pendente" />
              )}
              <span className={e.feita ? 'text-stone-900' : 'text-stone-500'}>
                Etapa {i + 1}: {e.nome}
              </span>
            </li>
          ))}
        </ol>
      </Cartao>
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
