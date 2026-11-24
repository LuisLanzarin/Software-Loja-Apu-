import { Global, Module } from '@nestjs/common';
import { ConfiguracaoController } from './configuracao.controller.ts';
import { ConfiguracaoService } from './configuracao.service.ts';

@Global()
@Module({ controllers: [ConfiguracaoController], providers: [ConfiguracaoService], exports: [ConfiguracaoService] })
export class ConfiguracaoModule {}
