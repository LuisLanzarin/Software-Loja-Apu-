import { Module } from '@nestjs/common';
import { ProdutosModule } from '../produtos/produtos.module.ts';
import { EntradasService } from './entradas.service.ts';
import { EntradasController, EstoqueController } from './estoque.controller.ts';
import { EstoqueService } from './estoque.service.ts';

@Module({ imports: [ProdutosModule], controllers: [EstoqueController, EntradasController], providers: [EstoqueService, EntradasService] })
export class EstoqueModule {}
