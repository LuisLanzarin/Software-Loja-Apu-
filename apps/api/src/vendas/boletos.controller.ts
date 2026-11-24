import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { RequerPermissao, UsuarioAtual } from '../auth/decorators.ts';
import type { UsuarioSessao } from '../auth/sessao.service.ts';
import { centavos } from '../common/esquemas.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const filtroSchema = z.object({
  situacao: z.enum(['abertos', 'vencidos', 'pagos', 'todos']).default('abertos'),
  clienteId: z.coerce.number().int().positive().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});
const baixaSchema = z.object({
  valorPago: centavos.refine((v) => v > 0, 'Informe o valor recebido'),
  pagoEm: z.iso.date(),
});

/** Boletos a receber (parcelas geradas nas vendas a prazo). */
@Controller('boletos')
@RequerPermissao('boleto.baixar')
export class BoletosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  async listar(@Query(new ZodPipe(filtroSchema)) f: z.infer<typeof filtroSchema>) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const where: Prisma.ContaReceberWhereInput = {
      ...(f.clienteId ? { clienteId: f.clienteId } : {}),
      ...(f.situacao === 'abertos' ? { status: 'ABERTO' } : {}),
      ...(f.situacao === 'vencidos' ? { status: 'ABERTO', vencimento: { lt: hoje } } : {}),
      ...(f.situacao === 'pagos' ? { status: 'PAGO' } : {}),
    };
    const [itens, total, aberto, vencido] = await this.prisma.$transaction([
      this.prisma.contaReceber.findMany({
        where,
        orderBy: f.situacao === 'pagos' ? { pagoEm: 'desc' } : { vencimento: 'asc' },
        skip: (f.pagina - 1) * 50,
        take: 50,
        include: { cliente: { select: { id: true, nome: true, telefone: true } }, baixadoPor: { select: { nome: true } } },
      }),
      this.prisma.contaReceber.count({ where }),
      this.prisma.contaReceber.aggregate({ where: { status: 'ABERTO' }, _sum: { valor: true } }),
      this.prisma.contaReceber.aggregate({ where: { status: 'ABERTO', vencimento: { lt: hoje } }, _sum: { valor: true }, _count: true }),
    ]);
    return {
      itens, total, pagina: f.pagina, porPagina: 50,
      totalAberto: aberto._sum.valor ?? 0, totalVencido: vencido._sum.valor ?? 0, quantidadeVencidos: vencido._count,
    };
  }

  @Post(':id/baixar')
  async baixar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodPipe(baixaSchema)) b: z.infer<typeof baixaSchema>,
    @UsuarioAtual() u: UsuarioSessao,
    @Req() req: Request,
  ) {
    const c = await this.prisma.contaReceber.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Boleto não encontrado.');
    if (c.status !== 'ABERTO') throw new BadRequestException('Este boleto não está em aberto.');
    const r = await this.prisma.contaReceber.update({
      where: { id },
      data: { status: 'PAGO', valorPago: b.valorPago, pagoEm: new Date(`${b.pagoEm}T12:00:00`), baixadoPorId: u.id },
    });
    await this.auditoria.registrar('boleto.baixado', { usuarioId: u.id, entidade: 'ContaReceber', entidadeId: id, detalhes: b, ip: req.ip });
    return r;
  }
}
