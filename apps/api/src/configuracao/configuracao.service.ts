import { Injectable } from '@nestjs/common';
import type { Configuracao } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

export type DadosConfiguracao = Partial<
  Omit<Configuracao, 'id' | 'atualizadoEm'>
>;

/** Configuração única da loja (linha id=1), mantida em cache na memória. */
@Injectable()
export class ConfiguracaoService {
  private cache: Configuracao | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<Configuracao> {
    this.cache ??= await this.prisma.configuracao.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    return this.cache;
  }

  async atualizar(dados: DadosConfiguracao): Promise<Configuracao> {
    this.cache = await this.prisma.configuracao.upsert({
      where: { id: 1 },
      create: { id: 1, ...dados },
      update: dados,
    });
    return this.cache;
  }
}
