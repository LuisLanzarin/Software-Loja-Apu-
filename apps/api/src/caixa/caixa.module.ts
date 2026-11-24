import { Module } from '@nestjs/common';
import { CaixaController } from './caixa.controller.ts';
import { CaixaService } from './caixa.service.ts';

@Module({ controllers: [CaixaController], providers: [CaixaService], exports: [CaixaService] })
export class CaixaModule {}
