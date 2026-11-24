import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';

export interface RegistroAuditoria {
  usuarioId?: number | null;
  entidade?: string;
  entidadeId?: string | number;
  detalhes?: unknown;
  ip?: string;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(acao: string, r: RegistroAuditoria = {}) {
    await this.prisma.auditoria.create({
      data: {
        acao,
        usuarioId: r.usuarioId ?? null,
        entidade: r.entidade,
        entidadeId: r.entidadeId?.toString(),
        detalhes: r.detalhes === undefined ? undefined : JSON.stringify(r.detalhes),
        ip: r.ip,
      },
    });
  }

  listar(pagina: number, porPagina: number) {
    return this.prisma.$transaction([
      this.prisma.auditoria.findMany({
        orderBy: { id: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: { usuario: { select: { nome: true, login: true } } },
      }),
      this.prisma.auditoria.count(),
    ]);
  }
}
