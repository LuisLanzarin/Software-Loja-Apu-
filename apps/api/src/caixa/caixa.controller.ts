import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { centavos, textoOpcional } from '../common/esquemas.ts';
import { temPermissao } from '../common/permissoes.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { CaixaService } from './caixa.service.ts';

const abrirSchema = z.object({ fundoTroco: centavos });
const movSchema = z.object({
  tipo: z.enum(['SANGRIA', 'SUPRIMENTO']),
  valor: centavos.refine((v) => v > 0, 'Informe o valor'),
  motivo: z.string().trim().min(3, 'Informe o motivo').max(200),
});
const fecharSchema = z.object({
  informado: z.object({ DINHEIRO: centavos, PIX: centavos, DEBITO: centavos, CREDITO: centavos }),
  observacao: textoOpcional(500),
});

@Controller('caixa')
export class CaixaController {
  constructor(
    private readonly caixa: CaixaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Caixa aberto do usuário logado. Sem o "esperado": a conferência é cega. */
  @Get('atual')
  async atual(@UsuarioAtual() u: UsuarioSessao) {
    const s = await this.caixa.sessaoAberta(u.id);
    if (!s) return { sessao: null };
    const { esperado: _, ...r } = await this.caixa.resumo(s.id);
    return { sessao: r };
  }

  @Post('abrir')
  @RequerPermissao('caixa.operar')
  async abrir(@Body(new ZodPipe(abrirSchema)) b: z.infer<typeof abrirSchema>, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const s = await this.caixa.abrir(u.id, b.fundoTroco);
    await this.auditoria.registrar('caixa.aberto', { usuarioId: u.id, entidade: 'CaixaSessao', entidadeId: s.id, detalhes: b, ip: req.ip });
    return s;
  }

  @Post('movimentos')
  @RequerPermissao('caixa.operar')
  async movimento(@Body(new ZodPipe(movSchema)) b: z.infer<typeof movSchema>, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const m = await this.caixa.movimentar(u.id, b.tipo, b.valor, b.motivo);
    await this.auditoria.registrar(`caixa.${b.tipo.toLowerCase()}`, { usuarioId: u.id, entidade: 'CaixaSessao', entidadeId: m.sessaoId, detalhes: b, ip: req.ip });
    return m;
  }

  @Post('fechar')
  @RequerPermissao('caixa.operar')
  async fechar(@Body(new ZodPipe(fecharSchema)) b: z.infer<typeof fecharSchema>, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const r = await this.caixa.fechar(u.id, b.informado, b.observacao);
    const diferenca = r.fechamento.reduce((a, f) => a + f.diferenca, 0);
    await this.auditoria.registrar('caixa.fechado', { usuarioId: u.id, entidade: 'CaixaSessao', entidadeId: r.id, detalhes: { diferenca }, ip: req.ip });
    return r;
  }

  @Get('sessoes')
  async listar(@Query('pagina') pagina = '1', @UsuarioAtual() u: UsuarioSessao) {
    const p = Math.max(1, Number.parseInt(pagina, 10) || 1);
    const verTodos = temPermissao(u.perfil, 'caixa.ver_todos');
    const [itens, total] = await this.caixa.listar(verTodos ? undefined : u.id, p);
    return { itens, total, pagina: p, porPagina: 30 };
  }

  @Get('sessoes/:id')
  obter(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() u: UsuarioSessao) {
    return this.caixa.obterVisivel(id, u.id, temPermissao(u.perfil, 'caixa.ver_todos'));
  }
}
