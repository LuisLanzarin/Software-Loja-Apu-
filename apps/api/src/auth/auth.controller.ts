import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import { permissoesDoPerfil } from '../common/permissoes.ts';
import { senhaSchema } from '../common/senha.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { ConfiguracaoService } from '../configuracao/configuracao.service.ts';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { AuthService } from './auth.service.ts';
import { LiberadoTrocaSenha, Publico, UsuarioAtual } from './decorators.ts';
import { COOKIE_SESSAO, DURACAO_MAXIMA_MS, SessaoService, type UsuarioSessao } from './sessao.service.ts';

const entrarSchema = z.object({
  login: z.string().trim().toLowerCase().min(1, 'Informe o login').max(40),
  senha: z.string().min(1, 'Informe a senha').max(128),
});
const trocarSenhaSchema = z.object({ senhaAtual: z.string().min(1).max(128), novaSenha: senhaSchema });

export function opcoesCookie(): CookieOptions {
  return {
    httpOnly: true, // JavaScript da página não consegue ler o cookie (protege contra XSS)
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: DURACAO_MAXIMA_MS,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessoes: SessaoService,
    private readonly config: ConfiguracaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Post('entrar')
  @Publico()
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async entrar(
    @Body(new ZodPipe(entrarSchema)) body: z.infer<typeof entrarSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.auth.entrar(body.login, body.senha, req.ip, req.get('user-agent'));
    res.cookie(COOKIE_SESSAO, token, opcoesCookie());
  }

  @Post('sair')
  @LiberadoTrocaSenha()
  @HttpCode(204)
  async sair(@UsuarioAtual() u: UsuarioSessao, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessoes.encerrar(u.sessaoId);
    await this.auditoria.registrar('logout', { usuarioId: u.id, ip: req.ip });
    const { maxAge: _, ...opcoes } = opcoesCookie();
    res.clearCookie(COOKIE_SESSAO, opcoes);
  }

  @Get('eu')
  @LiberadoTrocaSenha()
  async eu(@UsuarioAtual() u: UsuarioSessao) {
    const { nomeLoja, sessaoInatividadeMin } = await this.config.obter();
    return {
      id: u.id,
      nome: u.nome,
      login: u.login,
      perfil: u.perfil,
      trocarSenha: u.trocarSenha,
      permissoes: permissoesDoPerfil(u.perfil),
      loja: { nome: nomeLoja, sessaoInatividadeMin },
    };
  }

  @Post('trocar-senha')
  @LiberadoTrocaSenha()
  @HttpCode(204)
  async trocarSenha(
    @UsuarioAtual() u: UsuarioSessao,
    @Body(new ZodPipe(trocarSenhaSchema)) body: z.infer<typeof trocarSenhaSchema>,
    @Req() req: Request,
  ) {
    await this.auth.trocarSenha(u.id, u.sessaoId, body.senhaAtual, body.novaSenha, req.ip);
  }
}
