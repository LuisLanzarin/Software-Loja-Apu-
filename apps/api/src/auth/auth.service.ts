import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { temPermissao, type Permissao } from '../common/permissoes.ts';
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
    const usuario = await this.verificarCredenciais(login, senha, ip);
    const token = await this.sessoes.criar(usuario.id, ip, userAgent);
    await this.auditoria.registrar('login.sucesso', { usuarioId: usuario.id, ip });
    return token;
  }

  /**
   * Autorização pontual do gerente (desconto acima do limite, venda sem estoque, cancelamento).
   * Usa as mesmas regras do login: senha errada conta para o bloqueio do usuário.
   */
  async autorizar(login: string, senha: string, permissao: Permissao, ip?: string) {
    // Senha errada do GERENTE não pode virar 401: a tela trataria como sessão expirada
    // e deslogaria o vendedor no meio da venda.
    const u = await this.verificarCredenciais(login.trim().toLowerCase(), senha, ip, 'autorizacao.falha').catch((e: unknown) => {
      if (e instanceof UnauthorizedException) {
        throw new ForbiddenException({ message: e.message, codigo: 'AUTORIZACAO_RECUSADA' });
      }
      throw e;
    });
    if (!temPermissao(u.perfil, permissao)) {
      throw new ForbiddenException(`${u.nome} não tem permissão para autorizar esta operação.`);
    }
    return u;
  }

  /** Confere login e senha aplicando bloqueio por tentativas. Não cria sessão. */
  private async verificarCredenciais(login: string, senha: string, ip?: string, acaoFalha = 'login.falha') {
    const erro = new UnauthorizedException('Login ou senha inválidos.');
    const usuario = await this.prisma.usuario.findUnique({ where: { login } });

    if (!usuario || !usuario.ativo) {
      await verificarSenha(await this.hashFicticio, senha);
      await this.auditoria.registrar(acaoFalha, { detalhes: { login }, ip });
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
      await this.auditoria.registrar(bloquear ? 'login.bloqueado' : acaoFalha, {
        usuarioId: usuario.id,
        ip,
      });
      throw erro;
    }

    if (usuario.tentativasFalhas > 0) {
      await this.prisma.usuario.update({ where: { id: usuario.id }, data: { tentativasFalhas: 0, bloqueadoAte: null } });
    }
    return usuario;
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
