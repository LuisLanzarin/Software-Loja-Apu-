import { CheckCircle2, Circle } from 'lucide-react';
import { Cabecalho, Cartao } from '../components/ui';
import { useUsuario } from '../lib/sessao';

const ETAPAS = [
  { nome: 'Login, usuários, perfis e configurações', feita: true },
  { nome: 'Produtos, fornecedores e formação de preço', feita: true },
  { nome: 'Entrada de mercadoria e controle de estoque', feita: false },
  { nome: 'Vendas, orçamentos e caixa', feita: false },
  { nome: 'Relatórios de fechamento e backup automático', feita: false },
];

export function Inicio() {
  const u = useUsuario();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <>
      <Cabecalho titulo={`${saudacao}, ${u.nome.split(' ')[0]}!`} descricao={u.loja.nome} />
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
