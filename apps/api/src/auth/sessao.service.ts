import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Perfil } from '../generated/prisma/enums.ts';
import { ConfiguracaoService } from '../configuracao/configuracao.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

export const COOKIE_SESSAO = 'sid';
/** Duração máxima de uma sessão, mesmo com uso contínuo (um turno de trabalho). */
export const DURACAO_MAXIMA_MS = 12 * 60 * 60 * 1000;
/** Evita gravar no banco a cada requisição: atualiza "último acesso" no máximo 1x/minuto. */
const INTERVALO_TOQUE_MS = 60 * 1000;

export interface UsuarioSessao {
  id: number;
  nome: string;
  login: string;
  perfil: Perfil;
  trocarSenha: boolean;
  sessaoId: string;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class SessaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracaoService,
  ) {}

  async criar(usuarioId: number, ip?: string, userAgent?: string) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.sessao.create({
      data: {
        id: hashToken(token),
        usuarioId,
        expiraEm: new Date(Date.now() + DURACAO_MAXIMA_MS),
        ip,
        userAgent: userAgent?.slice(0, 255),
      },
    });
    return token;
  }

  /** Valida o token do cookie e devolve o usuário, ou null se inválido/expirado. */
  async validar(token: string): Promise<UsuarioSessao | null> {
    const id = hashToken(token);
    const sessao = await this.prisma.sessao.findUnique({ where: { id }, include: { usuario: true } });
    if (!sessao) return null;

    const agora = Date.now();
    const { sessaoInatividadeMin } = await this.config.obter();
    const inativa = agora - sessao.ultimoAcesso.getTime() > sessaoInatividadeMin * 60_000;
    if (sessao.expiraEm.getTime() < agora || inativa || !sessao.usuario.ativo) {
      await this.prisma.sessao.deleteMany({ where: { id } });
      return null;
    }

    if (agora - sessao.ultimoAcesso.getTime() > INTERVALO_TOQUE_MS) {
      await this.prisma.sessao.update({ where: { id }, data: { ultimoAcesso: new Date(agora) } });
    }

    const u = sessao.usuario;
    return { id: u.id, nome: u.nome, login: u.login, perfil: u.perfil, trocarSenha: u.trocarSenha, sessaoId: id };
  }

  encerrar(sessaoId: string) {
    return this.prisma.sessao.deleteMany({ where: { id: sessaoId } });
  }

  /** Derruba todas as sessões do usuário (ex.: senha trocada, usuário desativado). */
  encerrarTodas(usuarioId: number, excetoSessaoId?: string) {
    return this.prisma.sessao.deleteMany({
      where: { usuarioId, ...(excetoSessaoId ? { id: { not: excetoSessaoId } } : {}) },
    });
  }

  limparExpiradas() {
    return this.prisma.sessao.deleteMany({ where: { expiraEm: { lt: new Date() } } });
  }
}
