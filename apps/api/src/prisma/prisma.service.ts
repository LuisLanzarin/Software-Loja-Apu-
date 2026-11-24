import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.ts';
import { resolverCaminhoBanco } from '../paths.ts';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaBetterSqlite3({ url: resolverCaminhoBanco() }) });
  }

  async onModuleInit() {
    await this.$connect();
    // WAL: leituras não bloqueiam escritas — importante com vários PCs ao mesmo tempo.
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await this.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    await this.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
