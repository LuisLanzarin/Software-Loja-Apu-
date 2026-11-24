import { config } from 'dotenv';
import { resolve } from 'node:path';
import { API_ROOT } from './paths.ts';
config({ path: resolve(API_ROOT, '.env'), quiet: true });

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { networkInterfaces } from 'node:os';
import { AppModule } from './app.module.ts';
import { configurarApp } from './configurar-app.ts';
import { SessaoService } from './auth/sessao.service.ts';

async function main() {
  const app = await NestFactory.create(AppModule);
  configurarApp(app);

  const porta = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(porta, host);

  // Limpeza de sessões expiradas na inicialização e a cada hora.
  const sessoes = app.get(SessaoService);
  await sessoes.limparExpiradas();
  setInterval(() => void sessoes.limparExpiradas(), 60 * 60 * 1000).unref();

  const log = new Logger('Loja');
  log.log(`Sistema no ar: http://localhost:${porta}`);
  if (host === '0.0.0.0') {
    for (const rede of Object.values(networkInterfaces()).flat()) {
      if (rede && rede.family === 'IPv4' && !rede.internal) {
        log.log(`Outros PCs da loja: http://${rede.address}:${porta}`);
      }
    }
  }
}

void main();
