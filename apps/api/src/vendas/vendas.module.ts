import { Module } from '@nestjs/common';
import { CaixaModule } from '../caixa/caixa.module.ts';
import { BoletosController } from './boletos.controller.ts';
import { VendasController } from './vendas.controller.ts';
import { VendasService } from './vendas.service.ts';

@Module({ imports: [CaixaModule], controllers: [VendasController, BoletosController], providers: [VendasService] })
export class VendasModule {}
