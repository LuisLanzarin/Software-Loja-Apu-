export interface Unidade {
  id: number;
  sigla: string;
  nome: string;
  fracionavel: boolean;
  ativo: boolean;
}

export interface Categoria {
  id: number;
  nome: string;
  margemPct: number | null;
  ativo: boolean;
  totalProdutos: number;
}

export interface Fornecedor {
  id: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  contato: string | null;
  cidade: string | null;
  uf: string | null;
  prazoEntregaDias: number | null;
  observacoes: string | null;
  ativo: boolean;
  totalProdutos?: number;
}

export interface Produto {
  id: number;
  codigo: string;
  codigoBarras: string | null;
  descricao: string;
  marca: string | null;
  categoriaId: number | null;
  categoria: { nome: string; margemPct: number | null } | null;
  unidadeId: number;
  unidade: { sigla: string; fracionavel: boolean };
  precoVenda: number;
  estoqueMinimo: number;
  estoqueAtual: number;
  localizacao: string | null;
  observacoes: string | null;
  ativo: boolean;
  conversoes?: { unidadeId: number; fator: number; unidade: Unidade }[];
  // Só para quem pode ver custo:
  custo?: number;
  margemPct?: number | null;
  margemEfetiva?: number;
  precoSugerido?: number | null;
  margemReal?: number | null;
  fornecedores?: { fornecedorId: number; codigoFornecedor: string | null; fornecedor: { razaoSocial: string; nomeFantasia: string | null } }[];
}

export interface ParametrosPreco {
  impostosPct: number;
  despesasFixasPct: number;
  comissaoPct: number;
  margemPadraoPct: number;
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface Resumo {
  ativos: number;
  abaixoMinimo: number;
  semEstoque: number;
  valorEstoque?: number;
}

export interface Cliente {
  id: number;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  ativo: boolean;
}

export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'BOLETO';
export const NOMES_FORMA: Record<FormaPagamento, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  BOLETO: 'Boleto',
};

export type StatusVenda = 'ORCAMENTO' | 'CONVERTIDO' | 'FINALIZADA' | 'CANCELADA';

export interface Venda {
  id: number;
  status: StatusVenda;
  cliente: Cliente | null;
  clienteId: number | null;
  vendedor: { id: number; nome: string };
  subtotal: number;
  descontoItens: number;
  descontoGeral: number;
  taxaServico: number;
  total: number;
  troco: number;
  validoAte: string | null;
  observacoes: string | null;
  motivosAutorizacao: string | null;
  autorizadoPor: { nome: string } | null;
  canceladaPor: { nome: string } | null;
  motivoCancelamento: string | null;
  canceladaEm: string | null;
  criadoEm: string;
  finalizadaEm: string | null;
  orcamentoOrigemId: number | null;
  vendaGerada: { id: number } | null;
  itens: { id: number; produtoId: number; descricao: string; unidadeSigla: string; quantidade: number; precoUnitario: number; desconto: number; total: number }[];
  pagamentos: { id: number; forma: FormaPagamento; valor: number; parcelas: number }[];
  boletos: { id: number; parcela: number; totalParcelas: number; valor: number; vencimento: string; status: 'ABERTO' | 'PAGO' | 'CANCELADO' }[];
}

export interface MotivoAutorizacao {
  tipo: 'DESCONTO' | 'SEM_ESTOQUE' | 'CANCELAMENTO';
  detalhe: string;
}
