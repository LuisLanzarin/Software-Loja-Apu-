import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SessaoService } from '../auth/sessao.service.ts';
import { gerarHashSenha } from '../common/senha.ts';
import { Perfil } from '../generated/prisma/enums.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

/** Campos devolvidos pela API — nunca inclui o hash da senha. */
export const CAMPOS_PUBLICOS = {
  id: true,
  nome: true,
  login: true,
  perfil: true,
  ativo: true,
  trocarSenha: true,
  bloqueadoAte: true,
  criadoEm: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessoes: SessaoService,
  ) {}

  listar() {
    return this.prisma.usuario.findMany({ select: CAMPOS_PUBLICOS, orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] });
  }

  async criar(d: { nome: string; login: string; perfil: Perfil; senha: string }) {
    if (await this.prisma.usuario.findUnique({ where: { login: d.login } })) {
      throw new ConflictException('Já existe um usuário com este login.');
    }
    return this.prisma.usuario.create({
      data: { nome: d.nome, login: d.login, perfil: d.perfil, senhaHash: await gerarHashSenha(d.senha), trocarSenha: true },
      select: CAMPOS_PUBLICOS,
    });
  }

  async atualizar(id: number, autorId: number, d: { nome?: string; perfil?: Perfil; ativo?: boolean }) {
    const atual = await this.buscar(id);
    const deixaDeSerAdmin = atual.perfil === Perfil.ADMIN && ((d.perfil && d.perfil !== Perfil.ADMIN) || d.ativo === false);

    if (id === autorId && (d.ativo === false || deixaDeSerAdmin)) {
      throw new BadRequestException('Você não pode desativar nem rebaixar o seu próprio usuário.');
    }
    if (deixaDeSerAdmin && atual.ativo) {
      const admins = await this.prisma.usuario.count({ where: { perfil: Perfil.ADMIN, ativo: true } });
      if (admins <= 1) throw new BadRequestException('É preciso manter pelo menos um administrador ativo.');
    }

    const usuario = await this.prisma.usuario.update({ where: { id }, data: d, select: CAMPOS_PUBLICOS });
    // Mudou o perfil ou desativou: as sessões abertas são derrubadas na hora.
    if (d.ativo === false || (d.perfil && d.perfil !== atual.perfil)) await this.sessoes.encerrarTodas(id);
    return { antes: atual, usuario };
  }

  async redefinirSenha(id: number, senha: string) {
    await this.buscar(id);
    await this.prisma.usuario.update({
      where: { id },
      data: { senhaHash: await gerarHashSenha(senha), trocarSenha: true, tentativasFalhas: 0, bloqueadoAte: null },
    });
    await this.sessoes.encerrarTodas(id);
  }

  async desbloquear(id: number) {
    await this.buscar(id);
    await this.prisma.usuario.update({ where: { id }, data: { tentativasFalhas: 0, bloqueadoAte: null } });
  }

  private async buscar(id: number) {
    const u = await this.prisma.usuario.findUnique({ where: { id }, select: CAMPOS_PUBLICOS });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    return u;
  }
}
