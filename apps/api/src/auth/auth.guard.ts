import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { temPermissao, type Permissao } from '../common/permissoes.ts';
import { LIBERADO_TROCA_SENHA, PERMISSAO, PUBLICO } from './decorators.ts';
import { COOKIE_SESSAO, SessaoService } from './sessao.service.ts';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guard global: aplica, em ordem,
 *  1. proteção CSRF (cabeçalho obrigatório em requisições que alteram dados),
 *  2. autenticação por cookie de sessão,
 *  3. troca de senha obrigatória,
 *  4. permissão por perfil.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessoes: SessaoService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { usuario?: unknown }>();
    const alvo = [ctx.getHandler(), ctx.getClass()];

    // Navegadores não deixam outro site enviar cabeçalhos customizados sem CORS,
    // então este cabeçalho + cookie SameSite=Strict bloqueia CSRF.
    if (!METODOS_SEGUROS.has(req.method) && req.get('x-requested-with') !== 'XMLHttpRequest') {
      throw new ForbiddenException('Requisição recusada (CSRF).');
    }

    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvo)) return true;

    const token: string | undefined = req.cookies?.[COOKIE_SESSAO];
    const usuario = token ? await this.sessoes.validar(token) : null;
    if (!usuario) throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    req.usuario = usuario;

    if (usuario.trocarSenha && !this.reflector.getAllAndOverride<boolean>(LIBERADO_TROCA_SENHA, alvo)) {
      throw new ForbiddenException({ message: 'Troque sua senha para continuar.', codigo: 'TROCAR_SENHA' });
    }

    const permissao = this.reflector.getAllAndOverride<Permissao>(PERMISSAO, alvo);
    if (permissao && !temPermissao(usuario.perfil, permissao)) {
      throw new ForbiddenException('Você não tem permissão para esta ação.');
    }
    return true;
  }
}
