import { Body, Controller, Get, Param, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { textoOpcional } from '../common/esquemas.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { ConfiguracaoService } from '../configuracao/configuracao.service.ts';
import { pastaBackups } from './arquivos.ts';
import { BackupService } from './backup.service.ts';

const configSchema = z.object({
  backupHora: z.number().int().min(0).max(23),
  backupManterDias: z.number().int().min(7, 'Guarde pelo menos 7 dias').max(3650),
  backupPastaExtra: textoOpcional(300),
});
const restaurarSchema = z.object({
  nome: z.string(),
  confirmacao: z.literal('RESTAURAR', { error: 'Digite RESTAURAR para confirmar' }),
});

@Controller('backup')
@RequerPermissao('backup.gerenciar')
export class BackupController {
  constructor(
    private readonly backup: BackupService,
    private readonly config: ConfiguracaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  async status() {
    const c = await this.config.obter();
    return {
      pasta: pastaBackups(),
      backupHora: c.backupHora,
      backupManterDias: c.backupManterDias,
      backupPastaExtra: c.backupPastaExtra,
      ultimoErro: this.backup.ultimoErro,
      ultimaCopiaExtra: this.backup.ultimaCopiaExtra,
      arquivos: this.backup.listar(),
    };
  }

  @Post()
  async fazer(@UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const b = await this.backup.fazer('manual');
    await this.auditoria.registrar('backup.manual', { usuarioId: u.id, detalhes: { arquivo: b.nome }, ip: req.ip });
    return b;
  }

  @Put('configuracao')
  async configurar(@Body(new ZodPipe(configSchema)) b: z.infer<typeof configSchema>, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    await this.config.atualizar(b);
    await this.auditoria.registrar('backup.configurado', { usuarioId: u.id, detalhes: b, ip: req.ip });
    return this.status();
  }

  @Get('arquivos/:nome')
  baixar(@Param('nome') nome: string, @Res() res: Response) {
    res.download(this.backup.caminho(nome), nome);
  }

  @Post('restaurar')
  async restaurar(@Body(new ZodPipe(restaurarSchema)) b: z.infer<typeof restaurarSchema>, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    // Registra ANTES: o próprio registro de auditoria vai junto na cópia de segurança.
    await this.auditoria.registrar('backup.restaurado', { usuarioId: u.id, detalhes: { arquivo: b.nome }, ip: req.ip });
    return this.backup.restaurar(b.nome);
  }
}
