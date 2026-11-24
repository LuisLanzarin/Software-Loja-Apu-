import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { loginSchema, senhaSchema } from '../common/senha.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { Perfil } from '../generated/prisma/enums.ts';
import { UsuariosService } from './usuarios.service.ts';

const nome = z.string().trim().min(2, 'Informe o nome').max(80);
const perfil = z.enum(Perfil, { error: 'Perfil inválido' });
const criarSchema = z.object({ nome, login: loginSchema, perfil, senha: senhaSchema });
const atualizarSchema = z
  .object({ nome, perfil, ativo: z.boolean() })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nada para alterar');
const senhaBody = z.object({ senha: senhaSchema });

@Controller('usuarios')
@RequerPermissao('usuarios.gerenciar')
export class UsuariosController {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  listar() {
    return this.usuarios.listar();
  }

  @Post()
  async criar(
    @Body(new ZodPipe(criarSchema)) body: z.infer<typeof criarSchema>,
    @UsuarioAtual() autor: UsuarioSessao,
    @Req() req: Request,
  ) {
    const u = await this.usuarios.criar(body);
    await this.auditoria.registrar('usuario.criado', {
      usuarioId: autor.id, entidade: 'Usuario', entidadeId: u.id,
      detalhes: { login: u.login, perfil: u.perfil }, ip: req.ip,
    });
    return u;
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodPipe(atualizarSchema)) body: z.infer<typeof atualizarSchema>,
    @UsuarioAtual() autor: UsuarioSessao,
    @Req() req: Request,
  ) {
    const { antes, usuario } = await this.usuarios.atualizar(id, autor.id, body);
    await this.auditoria.registrar('usuario.alterado', {
      usuarioId: autor.id, entidade: 'Usuario', entidadeId: id,
      detalhes: { antes: { nome: antes.nome, perfil: antes.perfil, ativo: antes.ativo }, depois: body }, ip: req.ip,
    });
    return usuario;
  }

  @Post(':id/redefinir-senha')
  @HttpCode(204)
  async redefinirSenha(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodPipe(senhaBody)) body: z.infer<typeof senhaBody>,
    @UsuarioAtual() autor: UsuarioSessao,
    @Req() req: Request,
  ) {
    await this.usuarios.redefinirSenha(id, body.senha);
    await this.auditoria.registrar('usuario.senha_redefinida', {
      usuarioId: autor.id, entidade: 'Usuario', entidadeId: id, ip: req.ip,
    });
  }

  @Post(':id/desbloquear')
  @HttpCode(204)
  async desbloquear(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() autor: UsuarioSessao, @Req() req: Request) {
    await this.usuarios.desbloquear(id);
    await this.auditoria.registrar('usuario.desbloqueado', {
      usuarioId: autor.id, entidade: 'Usuario', entidadeId: id, ip: req.ip,
    });
  }
}
