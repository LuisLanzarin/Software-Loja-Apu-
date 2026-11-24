import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface SessaoCaixa {
  id: number;
  status: 'ABERTO' | 'FECHADO';
  fundoTroco: number;
  abertoEm: string;
  fechadoEm: string | null;
  observacao: string | null;
  usuario: { id: number; nome: string };
  esperado?: Record<'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO', number>;
  fechamento: { forma: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO'; esperado: number; informado: number; diferenca: number }[];
  movimentos: { id: number; tipo: 'VENDA' | 'ESTORNO_VENDA' | 'SANGRIA' | 'SUPRIMENTO'; forma: string; valor: number; motivo: string | null; vendaId: number | null; criadoEm: string; usuario: { nome: string } | null }[];
  totais: { vendas: number; estornos: number; sangrias: number; suprimentos: number; quantidadeVendas: number; faturamento: number; boletos: number };
}

export const useCaixaAtual = () =>
  useQuery({ queryKey: ['caixa-atual'], queryFn: () => api<{ sessao: SessaoCaixa | null }>('/caixa/atual').then((r) => r.sessao) });
