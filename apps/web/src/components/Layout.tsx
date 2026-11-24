import { BarChart3, ClipboardList, DatabaseBackup, FileText, Home, KeyRound, LogOut, Package, Receipt, Settings, PackagePlus, ShoppingCart, Tags, Truck, Warehouse, UserCog, Users, Wallet, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router';
import { NOMES_PERFIL } from '../lib/formato';
import { useSair, useUsuario, type Permissao } from '../lib/sessao';

interface ItemMenu {
  para: string;
  rotulo: string;
  icone: LucideIcon;
  permissao?: Permissao;
  emBreve?: boolean;
}

const MENU: { grupo: string; itens: ItemMenu[] }[] = [
  { grupo: '', itens: [{ para: '/', rotulo: 'Início', icone: Home }] },
  {
    grupo: 'Operação',
    itens: [
      { para: '/pdv', rotulo: 'Vender', icone: ShoppingCart, permissao: 'venda.realizar' },
      { para: '/vendas', rotulo: 'Vendas e orçamentos', icone: Receipt },
      { para: '/caixa', rotulo: 'Caixa', icone: Wallet, permissao: 'caixa.ver_todos' },
      { para: '/clientes', rotulo: 'Clientes', icone: Users, permissao: 'cliente.editar' },
      { para: '/boletos', rotulo: 'Boletos a receber', icone: FileText, permissao: 'boleto.baixar' },
      { para: '/produtos', rotulo: 'Produtos', icone: Package },
      { para: '/estoque', rotulo: 'Estoque', icone: Warehouse },
      { para: '/entradas', rotulo: 'Entradas', icone: PackagePlus, permissao: 'estoque.entrada' },
      { para: '/fornecedores', rotulo: 'Fornecedores', icone: Truck, permissao: 'fornecedor.ver' },
      { para: '/relatorios', rotulo: 'Relatórios', icone: BarChart3, permissao: 'relatorio.ver' },
    ],
  },
  {
    grupo: 'Administração',
    itens: [
      { para: '/usuarios', rotulo: 'Usuários', icone: UserCog, permissao: 'usuarios.gerenciar' },
      { para: '/cadastros', rotulo: 'Categorias e unidades', icone: Tags, permissao: 'cadastros.editar' },
      { para: '/configuracoes', rotulo: 'Configurações', icone: Settings, permissao: 'configuracao.editar' },
      { para: '/auditoria', rotulo: 'Auditoria', icone: ClipboardList, permissao: 'auditoria.ver' },
      { para: '/backup', rotulo: 'Backup', icone: DatabaseBackup, permissao: 'backup.gerenciar' },
    ],
  },
];

/** Logout automático no navegador após o tempo de inatividade configurado. */
function useLogoutPorInatividade(minutos: number) {
  const sair = useSair();
  useEffect(() => {
    let timer: number;
    const reiniciar = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => sair('Você foi desconectado por inatividade.'), minutos * 60_000);
    };
    const eventos = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const;
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    reiniciar();
    return () => {
      window.clearTimeout(timer);
      eventos.forEach((e) => window.removeEventListener(e, reiniciar));
    };
  }, [minutos, sair]);
}

export function Layout() {
  const usuario = useUsuario();
  const sair = useSair();
  useLogoutPorInatividade(usuario.loja.sessaoInatividadeMin);

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col bg-noite text-stone-300">
        <div className="px-3 pt-2 pb-1">
          <img src="/logo-king.jpg" alt={usuario.loja.nome} className="mx-auto w-44" />
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-2">
          {MENU.map(({ grupo, itens }) => {
            const visiveis = itens.filter((i) => !i.permissao || usuario.permissoes.includes(i.permissao));
            if (!visiveis.length) return null;
            return (
              <div key={grupo || 'principal'}>
                {grupo && <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{grupo}</p>}
                <ul className="space-y-0.5">
                  {visiveis.map(({ para, rotulo, icone: Icone, emBreve }) => (
                    <li key={para}>
                      {emBreve ? (
                        <span className="flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-stone-500" title="Disponível nas próximas etapas">
                          <Icone className="size-4" aria-hidden /> {rotulo}
                          <span className="ml-auto rounded bg-stone-800 px-1.5 text-[10px] uppercase">em breve</span>
                        </span>
                      ) : (
                        <NavLink
                          to={para}
                          end={para === '/'}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                              isActive ? 'bg-marca-400 font-medium text-stone-950' : 'hover:bg-stone-800 hover:text-white'
                            }`
                          }
                        >
                          <Icone className="size-4" aria-hidden /> {rotulo}
                        </NavLink>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-stone-800 p-3">
          <p className="truncate text-sm font-medium text-white">{usuario.nome}</p>
          <p className="text-xs text-stone-400">{NOMES_PERFIL[usuario.perfil]}</p>
          <div className="mt-2 flex gap-1">
            <NavLink to="/minha-senha" className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-stone-800 hover:text-white">
              <KeyRound className="size-3.5" aria-hidden /> Senha
            </NavLink>
            <button onClick={() => sair()} className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-stone-800 hover:text-white">
              <LogOut className="size-3.5" aria-hidden /> Sair
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
