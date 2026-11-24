import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { cancelarSchema, listarVendasSchema, vendaSchema, type DadosVenda, type FiltroVendas } from './vendas.schemas.ts';
import { VendasService } from './vendas.service.ts';

@Controller('vendas')
export class VendasController {
  constructor(
    private readonly vendas: VendasService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  listar(@Query(new ZodPipe(listarVendasSchema)) f: FiltroVendas, @UsuarioAtual() u: UsuarioSessao) {
    return this.vendas.listar(f, u);
  }

  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() u: UsuarioSessao) {
    return this.vendas.obter(id, u);
  }

  @Post()
  @RequerPermissao('venda.realizar')
  async registrar(@Body(new ZodPipe(vendaSchema)) b: DadosVenda, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const { venda, autorizadoPor } = await this.vendas.registrar(b, u, req.ip);
    await this.auditoria.registrar(venda.status === 'ORCAMENTO' ? 'orcamento.criado' : 'venda.finalizada', {
      usuarioId: u.id, entidade: 'Venda', entidadeId: venda.id, ip: req.ip,
      detalhes: {
        total: venda.total,
        ...(autorizadoPor ? { autorizadoPor: autorizadoPor.nome, motivos: venda.motivosAutorizacao } : {}),
      },
    });
    return venda;
  }

  @Post(':id/cancelar')
  @RequerPermissao('venda.realizar')
  async cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodPipe(cancelarSchema)) b: z.infer<typeof cancelarSchema>,
    @UsuarioAtual() u: UsuarioSessao,
    @Req() req: Request,
  ) {
    const { venda, autorizadoPor } = await this.vendas.cancelar(id, b.motivo, b.autorizacao, u, req.ip);
    await this.auditoria.registrar('venda.cancelada', {
      usuarioId: u.id, entidade: 'Venda', entidadeId: id, ip: req.ip,
      detalhes: { motivo: b.motivo, total: venda.total, ...(autorizadoPor ? { autorizadoPor: autorizadoPor.nome } : {}) },
    });
    return venda;
  }

  @Post(':id/descartar-orcamento')
  @RequerPermissao('venda.realizar')
  @HttpCode(204)
  descartar(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() u: UsuarioSessao) {
    return this.vendas.cancelarOrcamento(id, u);
  }
}
