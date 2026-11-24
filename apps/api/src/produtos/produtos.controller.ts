import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { temPermissao } from '../common/permissoes.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { filtroProdutosSchema, produtoSchema, reajusteSchema, type DadosProduto, type DadosReajuste, type FiltroProdutos } from './produtos.schemas.ts';
import { POR_PAGINA, ProdutosService } from './produtos.service.ts';

@Controller('produtos')
export class ProdutosController {
  constructor(
    private readonly produtos: ProdutosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Todos os perfis consultam produtos; custo e margem só aparecem para quem pode ver. */
  @Get()
  async listar(@Query(new ZodPipe(filtroProdutosSchema)) f: FiltroProdutos, @UsuarioAtual() u: UsuarioSessao) {
    const { itens, total } = await this.produtos.listar(f);
    return { itens: await this.produtos.apresentar(itens, temPermissao(u.perfil, 'produto.ver_custo')), total, pagina: f.pagina, porPagina: POR_PAGINA };
  }

  @Get('parametros-preco')
  @RequerPermissao('produto.ver_custo')
  parametros() {
    return this.produtos.parametros();
  }

  @Get(':id')
  async obter(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() u: UsuarioSessao) {
    const [p] = await this.produtos.apresentar([await this.produtos.obter(id)], temPermissao(u.perfil, 'produto.ver_custo'));
    return p;
  }

  @Get(':id/historico-precos')
  @RequerPermissao('produto.ver_custo')
  historico(@Param('id', ParseIntPipe) id: number) {
    return this.produtos.historico(id);
  }

  @Post()
  @RequerPermissao('produto.editar')
  async criar(@Body(new ZodPipe(produtoSchema)) b: DadosProduto, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const { depois } = await this.produtos.salvar(null, b, u.id);
    await this.auditoria.registrar('produto.criado', {
      usuarioId: u.id, entidade: 'Produto', entidadeId: depois.id,
      detalhes: { codigo: depois.codigo, descricao: depois.descricao, custo: b.custo, precoVenda: b.precoVenda }, ip: req.ip,
    });
    return (await this.produtos.apresentar([depois], true))[0];
  }

  @Patch(':id')
  @RequerPermissao('produto.editar')
  async editar(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(produtoSchema)) b: DadosProduto, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const { antes, depois } = await this.produtos.salvar(id, b, u.id);
    const mudou = Object.fromEntries(
      (['descricao', 'custo', 'precoVenda', 'margemPct', 'ativo', 'unidadeId', 'categoriaId', 'codigo', 'codigoBarras'] as const)
        .filter((k) => antes?.[k] !== depois[k])
        .map((k) => [k, { de: antes?.[k], para: depois[k] }]),
    );
    await this.auditoria.registrar('produto.alterado', { usuarioId: u.id, entidade: 'Produto', entidadeId: id, detalhes: mudou, ip: req.ip });
    return (await this.produtos.apresentar([depois], true))[0];
  }

  @Post('reajuste/simular')
  @RequerPermissao('preco.reajustar')
  simular(@Body(new ZodPipe(reajusteSchema)) b: DadosReajuste, @UsuarioAtual() u: UsuarioSessao) {
    return this.produtos.reajustar(b, false, u.id);
  }

  @Post('reajuste/aplicar')
  @RequerPermissao('preco.reajustar')
  async aplicar(@Body(new ZodPipe(reajusteSchema)) b: DadosReajuste, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    const r = await this.produtos.reajustar(b, true, u.id);
    await this.auditoria.registrar('preco.reajuste_lote', {
      usuarioId: u.id, entidade: 'Produto', detalhes: { ...b, produtosAlterados: r.itens.length }, ip: req.ip,
    });
    return r;
  }
}
