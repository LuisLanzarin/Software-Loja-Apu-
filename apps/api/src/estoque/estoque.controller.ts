import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { temPermissao } from '../common/permissoes.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { POR_PAGINA_ENTRADAS, EntradasService } from './entradas.service.ts';
import {
  ajusteSchema, cancelarEntradaSchema, entradaSchema, inventarioSchema, listarEntradasSchema, movimentacoesSchema,
  type DadosAjuste, type DadosEntrada, type DadosInventario,
} from './estoque.schemas.ts';
import { EstoqueService } from './estoque.service.ts';

@Controller('estoque')
export class EstoqueController {
  constructor(
    private readonly estoque: EstoqueService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get('resumo')
  async resumo(@UsuarioAtual() u: UsuarioSessao) {
    const r = await this.estoque.resumo();
    return temPermissao(u.perfil, 'produto.ver_custo') ? r : { ...r, valorEstoque: undefined };
  }

  @Get('movimentacoes')
  async movimentacoes(@Query(new ZodPipe(movimentacoesSchema)) f: z.infer<typeof movimentacoesSchema>, @UsuarioAtual() u: UsuarioSessao) {
    const r = await this.estoque.movimentacoes(f.produtoId, f.pagina);
    if (!temPermissao(u.perfil, 'produto.ver_custo')) {
      r.itens = r.itens.map(({ custoUnitario: _, ...m }) => m) as typeof r.itens;
    }
    return r;
  }

  @Post('ajustes')
  @RequerPermissao('estoque.ajustar')
  async ajustar(@Body(new ZodPipe(ajusteSchema)) b: DadosAjuste, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const r = await this.estoque.ajustar(b, u.id);
    await this.auditoria.registrar('estoque.ajuste', {
      usuarioId: u.id, entidade: 'Produto', entidadeId: b.produtoId,
      detalhes: { tipo: b.tipo, quantidade: b.quantidade, motivo: b.motivo, saldoAntes: r.saldoAntes, saldoDepois: r.saldoDepois }, ip: req.ip,
    });
    return r;
  }

  @Post('inventario')
  @RequerPermissao('estoque.ajustar')
  async inventario(@Body(new ZodPipe(inventarioSchema)) b: DadosInventario, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const r = await this.estoque.inventariar(b, u.id);
    await this.auditoria.registrar('estoque.inventario', {
      usuarioId: u.id, detalhes: { contados: r.contados, comDiferenca: r.diferencas.length, valorDiferenca: r.valorDiferenca }, ip: req.ip,
    });
    return r;
  }
}

@Controller('entradas')
@RequerPermissao('estoque.entrada')
export class EntradasController {
  constructor(
    private readonly entradas: EntradasService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  async listar(@Query(new ZodPipe(listarEntradasSchema)) f: z.infer<typeof listarEntradasSchema>) {
    const [itens, total] = await this.entradas.listar(f.fornecedorId, f.pagina);
    return { itens, total, pagina: f.pagina, porPagina: POR_PAGINA_ENTRADAS };
  }

  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.entradas.obter(id);
  }

  @Post()
  async criar(@Body(new ZodPipe(entradaSchema)) b: DadosEntrada, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const r = await this.entradas.criar(b, u.id);
    await this.auditoria.registrar('entrada.criada', {
      usuarioId: u.id, entidade: 'Entrada', entidadeId: r.entrada.id,
      detalhes: { numeroNota: b.numeroNota, itens: b.itens.length, totalNota: r.entrada.totalNota }, ip: req.ip,
    });
    return r;
  }

  @Post(':id/cancelar')
  @RequerPermissao('estoque.cancelar_entrada')
  async cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodPipe(cancelarEntradaSchema)) b: z.infer<typeof cancelarEntradaSchema>,
    @UsuarioAtual() u: UsuarioSessao,
    @Req() req: Request,
  ) {
    const r = await this.entradas.cancelar(id, b.motivo, u.id);
    await this.auditoria.registrar('entrada.cancelada', { usuarioId: u.id, entidade: 'Entrada', entidadeId: id, detalhes: { motivo: b.motivo }, ip: req.ip });
    return r;
  }
}
