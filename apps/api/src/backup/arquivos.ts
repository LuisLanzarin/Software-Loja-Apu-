import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { API_ROOT, resolverCaminhoBanco } from '../paths.ts';

/** Pasta dos backups: BACKUP_DIR no .env, ou "backups" na raiz do sistema. */
export const pastaBackups = () => resolve(API_ROOT, process.env.BACKUP_DIR ?? '../../backups');
const arquivoPendente = () => join(dirname(resolverCaminhoBanco()), 'restauracao-pendente.json');

/** Só nomes gerados pelo próprio sistema — impede acessar arquivos fora da pasta. */
export const NOME_BACKUP = /^loja_\d{4}-\d{2}-\d{2}_\d{6}_(automatico|manual|antes-restauracao)\.db$/;

export function integridadeOk(caminho: string): boolean {
  const db = new Database(caminho, { readonly: true, fileMustExist: true });
  try {
    const r = db.pragma('integrity_check', { simple: true });
    const tabelas = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='Produto'").get() as { n: number };
    return r === 'ok' && tabelas.n === 1;
  } finally {
    db.close();
  }
}

export function agendarRestauracao(caminhoBackup: string) {
  writeFileSync(arquivoPendente(), JSON.stringify({ arquivo: caminhoBackup, pedidoEm: new Date().toISOString() }));
}

/**
 * Roda ANTES de o sistema abrir o banco (em main.ts): se houver uma restauração
 * pedida, troca o arquivo do banco pelo backup escolhido.
 */
export function aplicarRestauracaoPendente(log: (m: string) => void) {
  const pendente = arquivoPendente();
  if (!existsSync(pendente)) return;
  const { arquivo } = JSON.parse(readFileSync(pendente, 'utf8')) as { arquivo: string };
  rmSync(pendente);
  if (!NOME_BACKUP.test(basename(arquivo)) || !existsSync(arquivo) || !integridadeOk(arquivo)) {
    log(`Restauração ignorada: backup inválido (${arquivo}).`);
    return;
  }
  const banco = resolverCaminhoBanco();
  mkdirSync(dirname(banco), { recursive: true });
  for (const extra of ['-wal', '-shm']) rmSync(banco + extra, { force: true });
  copyFileSync(arquivo, banco);
  log(`Banco restaurado a partir de ${basename(arquivo)}.`);
}
