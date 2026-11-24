import { Body, ConflictException, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { opcoesCookie } from '../auth/auth.controller.ts';
import { Publico } from '../auth/decorators.ts';
import { COOKIE_SESSAO, SessaoService } from '../auth/sessao.service.ts';
import { gerarHashSenha, loginSchema, senhaSchema } from '../common/senha.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { ConfiguracaoService } from '../configuracao/configuracao.service.ts';
import { Perfil } from '../generated/prisma/enums.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const schema = z.object({
  nomeLoja: z.string().trim().min(1, 'Informe o nome da loja').max(80),
  nome: z.string().trim().min(2, 'Informe seu nome').max(80),
  login: loginSchema,
  senha: senhaSchema,
});

/**
 * Primeira execução: sem senha padrão. Enquanto não existir nenhum usuário,
 * a tela inicial pede para criar o administrador.
 */
@Controller('setup')
@Publico()
export class SetupController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracaoService,
    private readonly sessoes: SessaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  async status() {
    return { necessario: (await this.prisma.usuario.count()) === 0 };
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async configurar(
    @Body(new ZodPipe(schema)) body: z.infer<typeof schema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const senhaHash = await gerarHashSenha(body.senha);
    const admin = await this.prisma.$transaction(async (tx) => {
      if ((await tx.usuario.count()) > 0) throw new ConflictException('O sistema já foi configurado.');
      return tx.usuario.create({ data: { nome: body.nome, login: body.login, senhaHash, perfil: Perfil.ADMIN } });
    });
    await this.config.atualizar({ nomeLoja: body.nomeLoja });
    await this.auditoria.registrar('setup.concluido', { usuarioId: admin.id, ip: req.ip });
    res.cookie(COOKIE_SESSAO, await this.sessoes.criar(admin.id, req.ip, req.get('user-agent')), opcoesCookie());
    return { ok: true };
  }
}
