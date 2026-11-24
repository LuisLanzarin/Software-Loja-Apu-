import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Configuração comum ao servidor e aos testes. */
export function configurarApp(app: INestApplication) {
  const seguro = process.env.COOKIE_SECURE === 'true';
  (app as NestExpressApplication).disable('x-powered-by');
  app.use(
    helmet({
      // Na rede local sem HTTPS, essas duas opções quebrariam o acesso pelos outros PCs.
      hsts: seguro,
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: seguro ? [] : null } },
    }),
  );
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
}
