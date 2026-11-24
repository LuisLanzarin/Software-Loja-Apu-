import { Module } from '@nestjs/common';
import { RelatoriosController } from './relatorios.controller.ts';
import { RelatoriosService } from './relatorios.service.ts';

@Module({ controllers: [RelatoriosController], providers: [RelatoriosService] })
export class RelatoriosModule {}
