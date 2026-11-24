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
