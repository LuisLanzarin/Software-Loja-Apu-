import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { pontosBase } from '../common/esquemas.ts';
import { temPermissao } from '../common/permissoes.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { ConfiguracaoService } from './configuracao.service.ts';

const schema = z.object({
  nomeLoja: z.string().trim().min(1, 'Informe o nome da loja').max(80),
  /** Pontos-base: 500 = 5,00% */
  descontoMaxSemAutorizacao: z.number().int().min(0).max(10000, 'O desconto máximo é 100%'),
  /** Não é mais usado: cancelar exige gerente (mantido por compatibilidade). */
  cancelamentoMaxSemAutorizacao: z.number().int().min(0).max(100_000_000).optional(),
  sessaoInatividadeMin: z.number().int().min(5, 'Mínimo de 5 minutos').max(720, 'Máximo de 12 horas'),
  validadeOrcamentoDias: z.number().int().min(1).max(90).optional(),
  /** 0 = não usa taxa de serviço. Até 30%. */
  taxaServicoPct: z.number().int().min(0).max(3000, 'Taxa de serviço de no máximo 30%').optional(),
  taxaServicoPadrao: z.boolean().optional(),
});

const precificacaoSchema = z
  .object({
    impostosPct: pontosBase,
    despesasFixasPct: pontosBase,
    comissaoPct: pontosBase,
    margemPadraoPct: pontosBase,
  })
  .refine((p) => p.impostosPct + p.despesasFixasPct + p.comissaoPct + p.margemPadraoPct < 10000, {
    message: 'Impostos + despesas + comissão + margem precisam somar menos de 100%',
  });

const CAMPOS_PRECIFICACAO = ['impostosPct', 'despesasFixasPct', 'comissaoPct', 'margemPadraoPct'] as const;

@Controller('configuracao')
export class ConfiguracaoController {
  constructor(
    private readonly config: ConfiguracaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  async obter(@UsuarioAtual() u: UsuarioSessao) {
    const c: Record<string, unknown> = { ...(await this.config.obter()) };
    if (!temPermissao(u.perfil, 'produto.ver_custo')) for (const k of CAMPOS_PRECIFICACAO) delete c[k];
    return c;
  }

  @Put('precificacao')
  @RequerPermissao('precificacao.editar')
  async atualizarPrecificacao(
    @Body(new ZodPipe(precificacaoSchema)) body: z.infer<typeof precificacaoSchema>,
    @UsuarioAtual() u: UsuarioSessao,
    @Req() req: Request,
  ) {
    const antes = await this.config.obter();
    const depois = await this.config.atualizar(body);
    await this.auditoria.registrar('precificacao.alterada', {
      usuarioId: u.id,
      entidade: 'Configuracao',
      entidadeId: 1,
      detalhes: { antes: Object.fromEntries(CAMPOS_PRECIFICACAO.map((k) => [k, antes[k]])), depois: body },
      ip: req.ip,
    });
    return depois;
  }

  @Put()
  @RequerPermissao('configuracao.editar')
  async atualizar(
    @Body(new ZodPipe(schema)) body: z.infer<typeof schema>,
    @UsuarioAtual() u: UsuarioSessao,
    @Req() req: Request,
  ) {
    const antes = await this.config.obter();
    const depois = await this.config.atualizar(body);
    await this.auditoria.registrar('configuracao.alterada', {
      usuarioId: u.id,
      entidade: 'Configuracao',
      entidadeId: 1,
      detalhes: {
        antes: { nomeLoja: antes.nomeLoja, taxaServicoPct: antes.taxaServicoPct, descontoMaxSemAutorizacao: antes.descontoMaxSemAutorizacao, cancelamentoMaxSemAutorizacao: antes.cancelamentoMaxSemAutorizacao, sessaoInatividadeMin: antes.sessaoInatividadeMin },
        depois: body,
      },
      ip: req.ip,
    });
    return depois;
  }
}
