import { config } from 'dotenv';
import { resolve } from 'node:path';
import { API_ROOT } from './paths.ts';
config({ path: resolve(API_ROOT, '.env'), quiet: true });

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { AppModule } from './app.module.ts';
import { SessaoService } from './auth/sessao.service.ts';
import { aplicarRestauracaoPendente } from './backup/arquivos.ts';
import { configurarApp } from './configurar-app.ts';

const log = new Logger('Loja');

/** Aplica as migrações do banco (atualizações do sistema) antes de abrir. */
function migrarBanco() {
  const cli = createRequire(resolve(API_ROOT, 'package.json')).resolve('prisma/build/index.js');
  execFileSync(process.execPath, [cli, 'migrate', 'deploy'], { cwd: API_ROOT, stdio: 'pipe', env: process.env });
  log.log('Banco de dados atualizado.');
}

async function main() {
  // 1) Restauração de backup pedida pela tela (precisa acontecer com o banco fechado).
  aplicarRestauracaoPendente((m) => log.warn(m));
  // 2) Migrações.
  migrarBanco();

  const app = await NestFactory.create(AppModule);
  configurarApp(app);

  const porta = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(porta, host);

  // Limpeza de sessões expiradas na inicialização e a cada hora.
  const sessoes = app.get(SessaoService);
  await sessoes.limparExpiradas();
  setInterval(() => void sessoes.limparExpiradas(), 60 * 60 * 1000).unref();

  log.log(`Sistema no ar: http://localhost:${porta}`);
  if (host === '0.0.0.0') {
    for (const rede of Object.values(networkInterfaces()).flat()) {
      if (rede && rede.family === 'IPv4' && !rede.internal) {
        log.log(`Outros PCs da loja: http://${rede.address}:${porta}`);
      }
    }
  }
}

main().catch((e) => {
  log.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
