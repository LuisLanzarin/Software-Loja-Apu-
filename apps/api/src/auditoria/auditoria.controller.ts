import { Controller, Get, Query } from '@nestjs/common';
import { RequerPermissao } from '../auth/decorators.ts';
import { AuditoriaService } from './auditoria.service.ts';

@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @RequerPermissao('auditoria.ver')
  async listar(@Query('pagina') pagina = '1') {
    const p = Math.max(1, Number.parseInt(pagina, 10) || 1);
    const [itens, total] = await this.auditoria.listar(p, 50);
    return { itens, total, pagina: p, porPagina: 50 };
  }
}
