import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permissao } from '../common/permissoes.ts';
import type { UsuarioSessao } from './sessao.service.ts';

export const PUBLICO = 'publico';
export const PERMISSAO = 'permissao';
export const LIBERADO_TROCA_SENHA = 'liberadoTrocaSenha';

/** Rota acessível sem login. */
export const Publico = () => SetMetadata(PUBLICO, true);
/** Rota exige esta permissão (ver common/permissoes.ts). */
export const RequerPermissao = (p: Permissao) => SetMetadata(PERMISSAO, p);
/** Rota acessível mesmo quando o usuário ainda precisa trocar a senha. */
export const LiberadoTrocaSenha = () => SetMetadata(LIBERADO_TROCA_SENHA, true);

export const UsuarioAtual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioSessao => ctx.switchToHttp().getRequest().usuario,
);
