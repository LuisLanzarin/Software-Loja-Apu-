import { resolve } from 'node:path';

/** Pasta raiz da API (apps/api), tanto rodando de src/ quanto de dist/. */
export const API_ROOT = resolve(__dirname, '..');

/** Converte DATABASE_URL relativa em caminho absoluto a partir de apps/api. */
export function resolverCaminhoBanco(url = process.env.DATABASE_URL ?? 'file:./data/loja.db'): string {
  const caminho = url.replace(/^file:/, '');
  return caminho === ':memory:' ? caminho : resolve(API_ROOT, caminho);
}
