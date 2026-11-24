import { Module } from '@nestjs/common';
import { FornecedoresController } from './fornecedores.controller.ts';

@Module({ controllers: [FornecedoresController] })
export class FornecedoresModule {}
