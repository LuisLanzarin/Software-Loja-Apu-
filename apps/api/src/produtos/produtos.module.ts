import { Module } from '@nestjs/common';
import { ProdutosController } from './produtos.controller.ts';
import { ProdutosService } from './produtos.service.ts';

@Module({ controllers: [ProdutosController], providers: [ProdutosService] })
export class ProdutosModule {}
