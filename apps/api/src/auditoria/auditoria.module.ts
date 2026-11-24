import { Global, Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller.ts';
import { AuditoriaService } from './auditoria.service.ts';

@Global()
@Module({ controllers: [AuditoriaController], providers: [AuditoriaService], exports: [AuditoriaService] })
export class AuditoriaModule {}
