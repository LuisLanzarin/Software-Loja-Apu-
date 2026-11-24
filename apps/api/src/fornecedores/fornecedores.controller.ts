import { Body, ConflictException, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { filtroAtivo, situacaoSchema, textoOpcional } from '../common/esquemas.ts';
import { documentoValido, limparDocumento, normalizarBusca } from '../common/texto.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

const schema = z.object({
  razaoSocial: z.string().trim().min(2, 'Informe a razão social ou nome').max(120),
  nomeFantasia: textoOpcional(120),
  documento: z
    .string()
    .nullish()
    .transform((v) => (v ? limparDocumento(v) : null))
    .refine((v) => v === null || documentoValido(v), 'CNPJ ou CPF inválido'),
  telefone: textoOpcional(30),
  email: textoOpcional(120).refine((v) => v === null || z.email().safeParse(v).success, 'E-mail inválido'),
  contato: textoOpcional(80),
  cidade: textoOpcional(80),
  uf: textoOpcional(2)
    .transform((v) => v?.toUpperCase() ?? null)
    .refine((v) => v === null || UFS.includes(v), 'UF inválida'),
  prazoEntregaDias: z.number().int().min(0).max(365).nullish().transform((v) => v ?? null),
  observacoes: textoOpcional(1000),
  ativo: z.boolean().default(true),
});
type Dados = z.infer<typeof schema>;

const filtroSchema = z.object({ q: z.string().optional(), situacao: situacaoSchema });

@Controller('fornecedores')
export class FornecedoresController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  @RequerPermissao('fornecedor.ver')
  async listar(@Query(new ZodPipe(filtroSchema)) f: z.infer<typeof filtroSchema>) {
    const lista = await this.prisma.fornecedor.findMany({
      where: filtroAtivo(f.situacao),
      orderBy: { razaoSocial: 'asc' },
      include: { _count: { select: { produtos: true } } },
    });
    const termo = f.q ? normalizarBusca(f.q) : '';
    const doc = f.q ? limparDocumento(f.q) : '';
    return lista
      .filter(
        (x) =>
          !termo ||
          normalizarBusca(`${x.razaoSocial} ${x.nomeFantasia ?? ''} ${x.cidade ?? ''}`).includes(termo) ||
          (doc.length >= 3 && x.documento?.includes(doc)),
      )
      .map(({ _count, ...x }) => ({ ...x, totalProdutos: _count.produtos }));
  }

  @Get(':id')
  @RequerPermissao('fornecedor.ver')
  async obter(@Param('id', ParseIntPipe) id: number) {
    const f = await this.prisma.fornecedor.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Fornecedor não encontrado.');
    return f;
  }

  @Post()
  @RequerPermissao('fornecedor.editar')
  async criar(@Body(new ZodPipe(schema)) b: Dados, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    await this.documentoLivre(b.documento);
    const f = await this.prisma.fornecedor.create({ data: b });
    await this.auditoria.registrar('fornecedor.criado', { usuarioId: u.id, entidade: 'Fornecedor', entidadeId: f.id, detalhes: { razaoSocial: f.razaoSocial }, ip: req.ip });
    return f;
  }

  @Patch(':id')
  @RequerPermissao('fornecedor.editar')
  async editar(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(schema)) b: Dados, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    await this.obter(id);
    await this.documentoLivre(b.documento, id);
    const f = await this.prisma.fornecedor.update({ where: { id }, data: b });
    await this.auditoria.registrar('fornecedor.alterado', { usuarioId: u.id, entidade: 'Fornecedor', entidadeId: id, detalhes: b, ip: req.ip });
    return f;
  }

  private async documentoLivre(documento: string | null, exceto?: number) {
    if (!documento) return;
    const e = await this.prisma.fornecedor.findUnique({ where: { documento } });
    if (e && e.id !== exceto) throw new ConflictException(`Este documento já está cadastrado para "${e.razaoSocial}".`);
  }
}
