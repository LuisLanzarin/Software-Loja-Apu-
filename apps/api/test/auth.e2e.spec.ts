import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

// Banco temporário e isolado para os testes.
const pasta = mkdtempSync(join(tmpdir(), 'loja-teste-'));
process.env.DATABASE_URL = `file:${join(pasta, 'teste.db')}`;
process.env.LIMITE_REQUISICOES = 'desligado';
execSync('npx prisma migrate deploy', { cwd: join(__dirname, '..'), env: process.env, stdio: 'ignore' });

import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';

const XHR = { 'X-Requested-With': 'XMLHttpRequest' };
let app: INestApplication;
let http: ReturnType<typeof request>;

async function entrar(login: string, senha: string) {
  const r = await request(app.getHttpServer()).post('/api/auth/entrar').set(XHR).send({ login, senha });
  const cookie = r.headers['set-cookie']?.[0]?.split(';')[0];
  return { status: r.status, cookie: cookie ?? '', setCookie: r.headers['set-cookie']?.[0] ?? '' };
}

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication({ logger: false });
  configurarApp(app);
  await app.init();
  http = request(app.getHttpServer());
});

afterAll(async () => {
  await app.close();
  rmSync(pasta, { recursive: true, force: true });
});

describe('Primeira execução', () => {
  it('exige criar o administrador e depois não permite repetir', async () => {
    expect((await http.get('/api/setup')).body).toEqual({ necessario: true });

    const dados = { nomeLoja: 'Loja Teste', nome: 'Admin', login: 'Admin', senha: 'senha-admin-1' };
    const r = await request(app.getHttpServer()).post('/api/setup').set(XHR).send(dados);
    expect(r.status).toBe(201);

    const r2 = await request(app.getHttpServer()).post('/api/setup').set(XHR).send({ ...dados, login: 'outro' });
    expect(r2.status).toBe(409);
    expect((await request(app.getHttpServer()).get('/api/setup')).body).toEqual({ necessario: false });
  });
});

describe('Login e sessão', () => {
  it('cookie é httpOnly e SameSite=Strict; login é case-insensitive', async () => {
    const { status, setCookie } = await entrar('ADMIN', 'senha-admin-1');
    expect(status).toBe(204);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
  });

  it('recusa senha errada com mensagem genérica', async () => {
    const r = await request(app.getHttpServer()).post('/api/auth/entrar').set(XHR).send({ login: 'admin', senha: 'x' });
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Login ou senha inválidos.');
    const r2 = await request(app.getHttpServer()).post('/api/auth/entrar').set(XHR).send({ login: 'naoexiste', senha: 'x' });
    expect(r2.body.message).toBe('Login ou senha inválidos.');
  });

  it('sem sessão, rotas protegidas respondem 401', async () => {
    expect((await request(app.getHttpServer()).get('/api/auth/eu')).status).toBe(401);
  });

  it('logout invalida a sessão no servidor', async () => {
    const { cookie } = await entrar('admin', 'senha-admin-1');
    expect((await request(app.getHttpServer()).get('/api/auth/eu').set('Cookie', cookie)).status).toBe(200);
    await request(app.getHttpServer()).post('/api/auth/sair').set(XHR).set('Cookie', cookie).expect(204);
    expect((await request(app.getHttpServer()).get('/api/auth/eu').set('Cookie', cookie)).status).toBe(401);
  });

  it('bloqueia requisições que alteram dados sem o cabeçalho anti-CSRF', async () => {
    const { cookie } = await entrar('admin', 'senha-admin-1');
    const r = await request(app.getHttpServer()).post('/api/usuarios').set('Cookie', cookie).send({});
    expect(r.status).toBe(403);
  });
});

describe('Usuários e perfis', () => {
  let admin: string;
  beforeAll(async () => {
    admin = (await entrar('admin', 'senha-admin-1')).cookie;
  });

  const criar = (login: string, perfil: string) =>
    request(app.getHttpServer())
      .post('/api/usuarios').set(XHR).set('Cookie', admin)
      .send({ nome: `Usuário ${login}`, login, perfil, senha: 'temporaria1' });

  it('nunca expõe o hash da senha', async () => {
    const r = await criar('maria', 'FINANCEIRO');
    expect(r.status).toBe(201);
    expect(r.body).not.toHaveProperty('senhaHash');
    const lista = await request(app.getHttpServer()).get('/api/usuarios').set('Cookie', admin);
    expect(JSON.stringify(lista.body)).not.toContain('argon2');
  });

  it('novo usuário precisa trocar a senha antes de usar o sistema', async () => {
    await criar('joao', 'VENDEDOR');
    const { cookie } = await entrar('joao', 'temporaria1');
    const bloqueado = await request(app.getHttpServer()).get('/api/configuracao').set('Cookie', cookie);
    expect(bloqueado.body.codigo).toBe('TROCAR_SENHA');

    await request(app.getHttpServer())
      .post('/api/auth/trocar-senha').set(XHR).set('Cookie', cookie)
      .send({ senhaAtual: 'temporaria1', novaSenha: 'senha-do-joao' })
      .expect(204);
    expect((await request(app.getHttpServer()).get('/api/configuracao').set('Cookie', cookie)).status).toBe(200);
  });

  it('vendedor não acessa usuários, configuração nem auditoria', async () => {
    const { cookie } = await entrar('joao', 'senha-do-joao');
    expect((await request(app.getHttpServer()).get('/api/usuarios').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app.getHttpServer()).get('/api/auditoria').set('Cookie', cookie)).status).toBe(403);
    const cfg = await request(app.getHttpServer())
      .put('/api/configuracao').set(XHR).set('Cookie', cookie)
      .send({ nomeLoja: 'x', descontoMaxSemAutorizacao: 0, cancelamentoMaxSemAutorizacao: 0, sessaoInatividadeMin: 30 });
    expect(cfg.status).toBe(403);
  });

  it('gerente altera os limites de desconto e cancelamento', async () => {
    await criar('gerente', 'GERENTE');
    let { cookie } = await entrar('gerente', 'temporaria1');
    await request(app.getHttpServer()).post('/api/auth/trocar-senha').set(XHR).set('Cookie', cookie)
      .send({ senhaAtual: 'temporaria1', novaSenha: 'senha-gerente' }).expect(204);
    const r = await request(app.getHttpServer())
      .put('/api/configuracao').set(XHR).set('Cookie', cookie)
      .send({ nomeLoja: 'Loja Teste', descontoMaxSemAutorizacao: 1000, cancelamentoMaxSemAutorizacao: 50000, sessaoInatividadeMin: 20 });
    expect(r.status).toBe(200);
    expect(r.body.descontoMaxSemAutorizacao).toBe(1000);
  });

  it('desativar usuário derruba a sessão dele na hora', async () => {
    const { cookie } = await entrar('joao', 'senha-do-joao');
    const lista = await request(app.getHttpServer()).get('/api/usuarios').set('Cookie', admin);
    const joao = lista.body.find((u: { login: string }) => u.login === 'joao');
    await request(app.getHttpServer()).patch(`/api/usuarios/${joao.id}`).set(XHR).set('Cookie', admin)
      .send({ ativo: false }).expect(200);
    expect((await request(app.getHttpServer()).get('/api/auth/eu').set('Cookie', cookie)).status).toBe(401);
    expect((await entrar('joao', 'senha-do-joao')).status).toBe(401);
  });

  it('não permite remover o último administrador', async () => {
    const eu = await request(app.getHttpServer()).get('/api/auth/eu').set('Cookie', admin);
    const r = await request(app.getHttpServer()).patch(`/api/usuarios/${eu.body.id}`).set(XHR).set('Cookie', admin)
      .send({ perfil: 'GERENTE' });
    expect(r.status).toBe(400);
  });

  it('bloqueia o usuário após 5 senhas erradas, e o admin pode desbloquear', async () => {
    for (let i = 0; i < 5; i++) expect((await entrar('maria', 'errada')).status).toBe(401);
    const r = await request(app.getHttpServer()).post('/api/auth/entrar').set(XHR).send({ login: 'maria', senha: 'temporaria1' });
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/bloqueado/);

    const lista = await request(app.getHttpServer()).get('/api/usuarios').set('Cookie', admin);
    const maria = lista.body.find((u: { login: string }) => u.login === 'maria');
    await request(app.getHttpServer()).post(`/api/usuarios/${maria.id}/desbloquear`).set(XHR).set('Cookie', admin).expect(204);
    expect((await entrar('maria', 'temporaria1')).status).toBe(204);
  });

  it('registra as ações na auditoria', async () => {
    const r = await request(app.getHttpServer()).get('/api/auditoria').set('Cookie', admin);
    const acoes = r.body.itens.map((i: { acao: string }) => i.acao);
    expect(acoes).toEqual(expect.arrayContaining(['setup.concluido', 'login.sucesso', 'login.falha', 'login.bloqueado', 'usuario.criado', 'configuracao.alterada', 'logout']));
  });
});
