import { Module } from '@nestjs/common';
import { CadastrosController } from './cadastros.controller.ts';

@Module({ controllers: [CadastrosController] })
export class CadastrosModule {}
