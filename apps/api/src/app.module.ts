import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditoriaModule } from './auditoria/auditoria.module.ts';
import { AuthModule } from './auth/auth.module.ts';
import { CadastrosModule } from './cadastros/cadastros.module.ts';
import { FornecedoresModule } from './fornecedores/fornecedores.module.ts';
import { ProdutosModule } from './produtos/produtos.module.ts';
import { ConfiguracaoModule } from './configuracao/configuracao.module.ts';
import { API_ROOT } from './paths.ts';
import { PrismaModule } from './prisma/prisma.module.ts';
import { SetupModule } from './setup/setup.module.ts';
import { UsuariosModule } from './usuarios/usuarios.module.ts';

/** Telas já compiladas (apps/web/dist). Em desenvolvimento o Vite serve as telas. */
const WEB_DIST = resolve(API_ROOT, '..', 'web', 'dist');

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 600 }],
      skipIf: () => process.env.LIMITE_REQUISICOES === 'desligado',
    }),
    ...(existsSync(WEB_DIST)
      ? [ServeStaticModule.forRoot({ rootPath: WEB_DIST, exclude: ['/api/{*caminho}'] })]
      : []),
    PrismaModule,
    ConfiguracaoModule,
    AuditoriaModule,
    AuthModule,
    SetupModule,
    UsuariosModule,
    CadastrosModule,
    FornecedoresModule,
    ProdutosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
