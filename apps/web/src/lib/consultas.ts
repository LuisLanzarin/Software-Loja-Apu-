import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Categoria, Fornecedor, ParametrosPreco, Unidade } from './tipos';

export const useUnidades = () => useQuery({ queryKey: ['unidades'], queryFn: () => api<Unidade[]>('/unidades'), staleTime: 60_000 });
export const useCategorias = () => useQuery({ queryKey: ['categorias'], queryFn: () => api<Categoria[]>('/categorias'), staleTime: 60_000 });
export const useFornecedores = (habilitado = true) =>
  useQuery({ queryKey: ['fornecedores', 'todos'], queryFn: () => api<Fornecedor[]>('/fornecedores?situacao=todos'), enabled: habilitado, staleTime: 60_000 });
export const useParametrosPreco = (habilitado = true) =>
  useQuery({ queryKey: ['parametros-preco'], queryFn: () => api<ParametrosPreco>('/produtos/parametros-preco'), enabled: habilitado });
