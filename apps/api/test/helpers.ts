import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

export const XHR = { 'X-Requested-With': 'XMLHttpRequest' };

/** Sobe a aplicação com um banco SQLite temporário e isolado. */
export async function criarAppDeTeste() {
  const pasta = mkdtempSync(join(tmpdir(), 'loja-teste-'));
  process.env.DATABASE_URL = `file:${join(pasta, 'teste.db')}`;
  process.env.LIMITE_REQUISICOES = 'desligado';
  execSync('npx prisma migrate deploy', { cwd: join(__dirname, '..'), env: process.env, stdio: 'ignore' });

  const { AppModule } = await import('../src/app.module');
  const { configurarApp } = await import('../src/configurar-app');
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = mod.createNestApplication({ logger: false });
  configurarApp(app);
  await app.init();

  const http = () => request(app.getHttpServer());
  const entrar = async (login: string, senha: string) => {
    const r = await http().post('/api/auth/entrar').set(XHR).send({ login, senha });
    return r.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  };

  return {
    app,
    http,
    entrar,
    /** Cria o admin e devolve funções autenticadas. */
    async comAdmin() {
      await http().post('/api/setup').set(XHR).send({ nomeLoja: 'Loja', nome: 'Admin', login: 'admin', senha: 'senha-admin-1' });
      return entrar('admin', 'senha-admin-1');
    },
    /** Cria um usuário já com a senha definitiva e devolve o cookie dele. */
    async criarUsuario(admin: string, login: string, perfil: string) {
      await http().post('/api/usuarios').set(XHR).set('Cookie', admin).send({ nome: login, login, perfil, senha: 'provisoria1' });
      const c = await entrar(login, 'provisoria1');
      await http().post('/api/auth/trocar-senha').set(XHR).set('Cookie', c).send({ senhaAtual: 'provisoria1', novaSenha: 'definitiva1' });
      return c;
    },
    async fechar() {
      await app.close();
      rmSync(pasta, { recursive: true, force: true });
    },
  };
}
