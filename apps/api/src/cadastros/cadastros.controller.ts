import { Body, ConflictException, Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { pontosBase } from '../common/esquemas.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const unidadeSchema = z.object({
  sigla: z.string().trim().toUpperCase().min(1, 'Informe a sigla').max(6).regex(/^[A-Z0-9]+$/, 'Sigla: só letras e números'),
  nome: z.string().trim().min(2, 'Informe o nome').max(40),
  fracionavel: z.boolean(),
  ativo: z.boolean().default(true),
});

const categoriaSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome').max(60),
  margemPct: pontosBase.nullish().transform((v) => v ?? null),
  ativo: z.boolean().default(true),
});

/** Cadastros auxiliares: unidades de medida e categorias de produto. */
@Controller()
export class CadastrosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get('unidades')
  unidades() {
    return this.prisma.unidade.findMany({ orderBy: { sigla: 'asc' } });
  }

  @Post('unidades')
  @RequerPermissao('cadastros.editar')
  async criarUnidade(@Body(new ZodPipe(unidadeSchema)) b: z.infer<typeof unidadeSchema>, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    await this.siglaLivre(b.sigla);
    const r = await this.prisma.unidade.create({ data: b });
    await this.auditoria.registrar('unidade.criada', { usuarioId: u.id, entidade: 'Unidade', entidadeId: r.id, detalhes: b, ip: req.ip });
    return r;
  }

  @Patch('unidades/:id')
  @RequerPermissao('cadastros.editar')
  async editarUnidade(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodPipe(unidadeSchema)) b: z.infer<typeof unidadeSchema>,
    @UsuarioAtual() u: UsuarioSessao,
    @Req() req: Request,
  ) {
    await this.siglaLivre(b.sigla, id);
    const r = await this.prisma.unidade.update({ where: { id }, data: b });
    await this.auditoria.registrar('unidade.alterada', { usuarioId: u.id, entidade: 'Unidade', entidadeId: id, detalhes: b, ip: req.ip });
    return r;
  }

  @Get('categorias')
  async categorias() {
    const lista = await this.prisma.categoria.findMany({ orderBy: { nome: 'asc' }, include: { _count: { select: { produtos: true } } } });
    return lista.map(({ _count, ...c }) => ({ ...c, totalProdutos: _count.produtos }));
  }

  @Post('categorias')
  @RequerPermissao('cadastros.editar')
  async criarCategoria(@Body(new ZodPipe(categoriaSchema)) b: z.infer<typeof categoriaSchema>, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    await this.nomeLivre(b.nome);
    const r = await this.prisma.categoria.create({ data: b });
    await this.auditoria.registrar('categoria.criada', { usuarioId: u.id, entidade: 'Categoria', entidadeId: r.id, detalhes: b, ip: req.ip });
    return r;
  }

  @Patch('categorias/:id')
  @RequerPermissao('cadastros.editar')
  async editarCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodPipe(categoriaSchema)) b: z.infer<typeof categoriaSchema>,
    @UsuarioAtual() u: UsuarioSessao,
    @Req() req: Request,
  ) {
    await this.nomeLivre(b.nome, id);
    const r = await this.prisma.categoria.update({ where: { id }, data: b });
    await this.auditoria.registrar('categoria.alterada', { usuarioId: u.id, entidade: 'Categoria', entidadeId: id, detalhes: b, ip: req.ip });
    return r;
  }

  private async siglaLivre(sigla: string, exceto?: number) {
    const e = await this.prisma.unidade.findUnique({ where: { sigla } });
    if (e && e.id !== exceto) throw new ConflictException(`Já existe a unidade ${sigla}.`);
  }

  private async nomeLivre(nome: string, exceto?: number) {
    const todas = await this.prisma.categoria.findMany({ select: { id: true, nome: true } });
    if (todas.some((c) => c.id !== exceto && c.nome.toLowerCase() === nome.toLowerCase())) {
      throw new ConflictException(`Já existe a categoria "${nome}".`);
    }
  }
}
