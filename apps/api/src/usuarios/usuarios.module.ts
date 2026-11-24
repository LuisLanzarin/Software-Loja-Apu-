import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller.ts';
import { UsuariosService } from './usuarios.service.ts';

@Module({ controllers: [UsuariosController], providers: [UsuariosService] })
export class UsuariosModule {}
