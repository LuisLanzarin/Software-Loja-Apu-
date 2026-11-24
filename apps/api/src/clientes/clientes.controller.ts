import { Body, ConflictException, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { filtroAtivo, situacaoSchema, textoOpcional } from '../common/esquemas.ts';
import { documentoValido, limparDocumento, normalizarBusca } from '../common/texto.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

export const clienteSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do cliente').max(120),
  documento: z
    .string()
    .nullish()
    .transform((v) => (v ? limparDocumento(v) : null))
    .refine((v) => v === null || documentoValido(v), 'CPF ou CNPJ inválido'),
  telefone: textoOpcional(30),
  email: textoOpcional(120).refine((v) => v === null || z.email().safeParse(v).success, 'E-mail inválido'),
  cep: textoOpcional(9).transform((v) => v?.replace(/\D/g, '') || null),
  logradouro: textoOpcional(120),
  numero: textoOpcional(20),
  complemento: textoOpcional(60),
  bairro: textoOpcional(60),
  cidade: textoOpcional(80),
  uf: textoOpcional(2).transform((v) => v?.toUpperCase() ?? null),
  observacoes: textoOpcional(1000),
  ativo: z.boolean().default(true),
});
type Dados = z.infer<typeof clienteSchema>;

const filtroSchema = z.object({
  q: z.string().max(120).optional(),
  situacao: situacaoSchema,
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(50),
});

@Controller('clientes')
export class ClientesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  async listar(@Query(new ZodPipe(filtroSchema)) f: z.infer<typeof filtroSchema>) {
    const where: Prisma.ClienteWhereInput = { ...filtroAtivo(f.situacao) };
    const q = f.q?.trim();
    if (q) {
      const doc = limparDocumento(q);
      where.OR = [
        { AND: normalizarBusca(q).split(' ').map((w) => ({ nomeBusca: { contains: w } })) },
        ...(doc.length >= 3 ? [{ documento: { contains: doc } }] : []),
        { telefone: { contains: q } },
      ];
    }
    const [itens, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({ where, orderBy: { nome: 'asc' }, skip: (f.pagina - 1) * f.porPagina, take: f.porPagina }),
      this.prisma.cliente.count({ where }),
    ]);
    return { itens, total, pagina: f.pagina, porPagina: f.porPagina };
  }

  @Get(':id')
  async obter(@Param('id', ParseIntPipe) id: number) {
    const c = await this.prisma.cliente.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    return c;
  }

  @Post()
  @RequerPermissao('cliente.editar')
  async criar(@Body(new ZodPipe(clienteSchema)) b: Dados, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    await this.documentoLivre(b.documento);
    const c = await this.prisma.cliente.create({ data: { ...b, nomeBusca: normalizarBusca(b.nome) } });
    await this.auditoria.registrar('cliente.criado', { usuarioId: u.id, entidade: 'Cliente', entidadeId: c.id, detalhes: { nome: c.nome }, ip: req.ip });
    return c;
  }

  @Patch(':id')
  @RequerPermissao('cliente.editar')
  async editar(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(clienteSchema)) b: Dados, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    await this.obter(id);
    await this.documentoLivre(b.documento, id);
    const c = await this.prisma.cliente.update({ where: { id }, data: { ...b, nomeBusca: normalizarBusca(b.nome) } });
    await this.auditoria.registrar('cliente.alterado', { usuarioId: u.id, entidade: 'Cliente', entidadeId: id, ip: req.ip });
    return c;
  }

  private async documentoLivre(documento: string | null, exceto?: number) {
    if (!documento) return;
    const e = await this.prisma.cliente.findUnique({ where: { documento } });
    if (e && e.id !== exceto) throw new ConflictException(`Este CPF/CNPJ já está cadastrado para "${e.nome}".`);
  }
}
