import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { RequerPermissao } from '../auth/decorators.ts';
import { ZodPipe } from '../common/zod.pipe.ts';
import { RelatoriosService } from './relatorios.service.ts';

const base = z.object({ de: z.iso.date('Data inicial inválida'), ate: z.iso.date('Data final inválida') });
const vendasSchema = base.extend({ agrupar: z.enum(['dia', 'semana', 'mes']).default('dia') });
const produtosSchema = base.extend({ categoriaId: z.coerce.number().int().positive().optional() });

@Controller('relatorios')
@RequerPermissao('relatorio.ver')
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get('vendas')
  vendas(@Query(new ZodPipe(vendasSchema)) f: z.infer<typeof vendasSchema>) {
    return this.relatorios.vendas(f.de, f.ate, f.agrupar);
  }

  @Get('produtos')
  produtos(@Query(new ZodPipe(produtosSchema)) f: z.infer<typeof produtosSchema>) {
    return this.relatorios.produtos(f.de, f.ate, f.categoriaId);
  }

  @Get('caixas')
  caixas(@Query(new ZodPipe(base)) f: z.infer<typeof base>) {
    return this.relatorios.caixas(f.de, f.ate);
  }
}
