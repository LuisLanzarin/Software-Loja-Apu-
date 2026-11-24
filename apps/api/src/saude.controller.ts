import { Controller, Get } from '@nestjs/common';
import { Publico } from './auth/decorators.ts';
import { PrismaService } from './prisma/prisma.service.ts';

/** Verificação rápida de que o sistema e o banco estão respondendo. */
@Controller('saude')
export class SaudeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Publico()
  async saude() {
    await this.prisma.$queryRawUnsafe('SELECT 1');
    return { ok: true, versao: process.env.npm_package_version ?? null, horario: new Date().toISOString() };
  }
}
