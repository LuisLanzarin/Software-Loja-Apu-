import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { gerarHashSenha, verificarSenha } from '../common/senha.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { SessaoService } from './sessao.service.ts';

export const MAX_TENTATIVAS = 5;
export const BLOQUEIO_MIN = 15;

@Injectable()
export class AuthService {
  /** Hash fictício: mantém o tempo de resposta igual quando o login não existe. */
  private hashFicticio = gerarHashSenha('senha-ficticia-para-tempo-constante');

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessoes: SessaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async entrar(login: string, senha: string, ip?: string, userAgent?: string) {
    const erro = new UnauthorizedException('Login ou senha inválidos.');
    const usuario = await this.prisma.usuario.findUnique({ where: { login } });

    if (!usuario || !usuario.ativo) {
      await verificarSenha(await this.hashFicticio, senha);
      await this.auditoria.registrar('login.falha', { detalhes: { login }, ip });
      throw erro;
    }

    if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
      const min = Math.ceil((usuario.bloqueadoAte.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Usuário bloqueado por excesso de tentativas. Tente em ${min} min.`);
    }

    if (!(await verificarSenha(usuario.senhaHash, senha))) {
      const tentativas = usuario.tentativasFalhas + 1;
      const bloquear = tentativas >= MAX_TENTATIVAS;
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          tentativasFalhas: bloquear ? 0 : tentativas,
          bloqueadoAte: bloquear ? new Date(Date.now() + BLOQUEIO_MIN * 60_000) : null,
        },
      });
      await this.auditoria.registrar(bloquear ? 'login.bloqueado' : 'login.falha', {
        usuarioId: usuario.id,
        ip,
      });
      throw erro;
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { tentativasFalhas: 0, bloqueadoAte: null },
    });
    const token = await this.sessoes.criar(usuario.id, ip, userAgent);
    await this.auditoria.registrar('login.sucesso', { usuarioId: usuario.id, ip });
    return token;
  }

  async trocarSenha(usuarioId: number, sessaoId: string, senhaAtual: string, novaSenha: string, ip?: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (!(await verificarSenha(usuario.senhaHash, senhaAtual))) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }
    if (senhaAtual === novaSenha) {
      throw new UnauthorizedException('A nova senha deve ser diferente da atual.');
    }
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { senhaHash: await gerarHashSenha(novaSenha), trocarSenha: false },
    });
    // Outras sessões abertas com a senha antiga são derrubadas.
    await this.sessoes.encerrarTodas(usuarioId, sessaoId);
    await this.auditoria.registrar('senha.trocada', { usuarioId, ip });
  }
}
