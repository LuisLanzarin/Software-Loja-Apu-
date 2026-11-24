import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.ts';
import { AuthGuard } from './auth.guard.ts';
import { AuthService } from './auth.service.ts';
import { SessaoService } from './sessao.service.ts';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessaoService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [SessaoService],
})
export class AuthModule {}
