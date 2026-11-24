import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { StrictMode, useEffect, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Carregando } from './components/ui';
import './index.css';
import { api, ApiError, EVENTO_SESSAO_EXPIRADA } from './lib/api';
import { limparSessao, useSessao, usePode, type Permissao } from './lib/sessao';
import { Auditoria } from './pages/Auditoria';
import { ConfiguracaoInicial } from './pages/ConfiguracaoInicial';
import { Configuracoes } from './pages/Configuracoes';
import { Entrar } from './pages/Entrar';
import { Inicio } from './pages/Inicio';
import { MinhaSenha, TrocarSenhaObrigatoria } from './pages/TrocarSenha';
import { Usuarios } from './pages/Usuarios';
import { Cadastros } from './pages/Cadastros';
import { Fornecedores } from './pages/Fornecedores';
import { ProdutoForm } from './pages/produtos/ProdutoForm';
import { Produtos } from './pages/produtos/Produtos';
import { Reajuste } from './pages/produtos/Reajuste';
import { EntradaDetalhe } from './pages/estoque/EntradaDetalhe';
import { EntradaNova } from './pages/estoque/EntradaNova';
import { Entradas } from './pages/estoque/Entradas';
import { Estoque } from './pages/estoque/Estoque';
import { EstoqueProduto } from './pages/estoque/EstoqueProduto';
import { Inventario } from './pages/estoque/Inventario';
import { Boletos } from './pages/Boletos';
import { Clientes } from './pages/Clientes';
import { Caixa } from './pages/caixa/Caixa';
import { CaixaSessao } from './pages/caixa/CaixaSessao';
import { PDV } from './pages/vendas/PDV';
import { Recibo } from './pages/vendas/Recibo';
import { VendaDetalhe } from './pages/vendas/VendaDetalhe';
import { Vendas } from './pages/vendas/Vendas';
import { Backup } from './pages/Backup';
import { Relatorios } from './pages/relatorios/Relatorios';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
    },
  },
});

function SoCom({ permissao, children }: { permissao: Permissao; children: ReactElement }) {
  return usePode()(permissao) ? children : <Navigate to="/" replace />;
}

/** Decide qual tela mostrar: configuração inicial, login, troca de senha ou o sistema. */
function App() {
  const qc = useQueryClient();
  const setup = useQuery({ queryKey: ['setup'], queryFn: () => api<{ necessario: boolean }>('/setup'), staleTime: Infinity });
  const sessao = useSessao();

  useEffect(() => {
    const expirou = () => {
      if (!qc.getQueryData(['sessao'])) return;
      sessionStorage.setItem('motivoSaida', 'Sua sessão expirou. Entre novamente.');
      limparSessao(qc);
    };
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, expirou);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, expirou);
  }, [qc]);

  if (setup.isLoading || sessao.isLoading) return <Carregando />;
  if (setup.data?.necessario) return <ConfiguracaoInicial />;
  if (!sessao.data) return <Entrar />;
  if (sessao.data.trocarSenha) return <TrocarSenhaObrigatoria />;

  return (
    <Routes>
      <Route path="vendas/:id/imprimir" element={<Recibo />} />
      <Route element={<Layout />}>
        <Route path="pdv" element={<SoCom permissao="venda.realizar"><PDV /></SoCom>} />
        <Route path="vendas" element={<Vendas />} />
        <Route path="vendas/:id" element={<VendaDetalhe />} />
        <Route path="caixa" element={<Caixa />} />
        <Route path="caixa/:id" element={<CaixaSessao />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="relatorios" element={<SoCom permissao="relatorio.ver"><Relatorios /></SoCom>} />
        <Route path="backup" element={<SoCom permissao="backup.gerenciar"><Backup /></SoCom>} />
        <Route path="boletos" element={<SoCom permissao="boleto.baixar"><Boletos /></SoCom>} />
        <Route index element={<Inicio />} />
        <Route path="minha-senha" element={<MinhaSenha />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="produtos/novo" element={<SoCom permissao="produto.editar"><ProdutoForm /></SoCom>} />
        <Route path="produtos/reajuste" element={<SoCom permissao="preco.reajustar"><Reajuste /></SoCom>} />
        <Route path="produtos/:id" element={<SoCom permissao="produto.editar"><ProdutoForm /></SoCom>} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="estoque/inventario" element={<SoCom permissao="estoque.ajustar"><Inventario /></SoCom>} />
        <Route path="estoque/:id" element={<EstoqueProduto />} />
        <Route path="entradas" element={<SoCom permissao="estoque.entrada"><Entradas /></SoCom>} />
        <Route path="entradas/nova" element={<SoCom permissao="estoque.entrada"><EntradaNova /></SoCom>} />
        <Route path="entradas/:id" element={<SoCom permissao="estoque.entrada"><EntradaDetalhe /></SoCom>} />
        <Route path="fornecedores" element={<SoCom permissao="fornecedor.ver"><Fornecedores /></SoCom>} />
        <Route path="cadastros" element={<SoCom permissao="cadastros.editar"><Cadastros /></SoCom>} />
        <Route path="usuarios" element={<SoCom permissao="usuarios.gerenciar"><Usuarios /></SoCom>} />
        <Route path="configuracoes" element={<SoCom permissao="configuracao.editar"><Configuracoes /></SoCom>} />
        <Route path="auditoria" element={<SoCom permissao="auditoria.ver"><Auditoria /></SoCom>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
