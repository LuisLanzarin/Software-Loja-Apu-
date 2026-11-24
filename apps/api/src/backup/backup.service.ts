import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ConfiguracaoService } from '../configuracao/configuracao.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { agendarRestauracao, integridadeOk, NOME_BACKUP, pastaBackups } from './arquivos.ts';

export type TipoBackup = 'automatico' | 'manual' | 'antes-restauracao';
/** Código de saída que pede ao iniciar.bat / serviço para subir o sistema de novo. */
export const CODIGO_REINICIAR = 3;
const MANTER_SEMPRE = 7; // nunca apaga os 7 backups mais recentes

const dois = (n: number) => String(n).padStart(2, '0');
const carimbo = (d = new Date()) =>
  `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}_${dois(d.getHours())}${dois(d.getMinutes())}${dois(d.getSeconds())}`;

@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Backup');
  private timer?: NodeJS.Timeout;
  private emAndamento = false;
  ultimoErro: { quando: Date; mensagem: string } | null = null;
  ultimaCopiaExtra: { quando: Date; ok: boolean; mensagem?: string } | null = null;
  /** Encerra para o serviço/iniciar.bat subir de novo. Substituível nos testes. */
  sair = () => process.exit(CODIGO_REINICIAR);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracaoService,
  ) {}

  onModuleInit() {
    if (process.env.BACKUP_AUTOMATICO === 'desligado') return;
    // Verifica a cada 10 minutos; a primeira checagem é 1 minuto depois de ligar.
    setTimeout(() => void this.verificarAgendamento(), 60_000).unref();
    this.timer = setInterval(() => void this.verificarAgendamento(), 10 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  listar() {
    const pasta = pastaBackups();
    if (!existsSync(pasta)) return [];
    return readdirSync(pasta)
      .filter((n) => NOME_BACKUP.test(n))
      .map((nome) => {
        const st = statSync(join(pasta, nome));
        return { nome, tamanho: st.size, criadoEm: st.mtime, tipo: nome.match(NOME_BACKUP)![1] as TipoBackup };
      })
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
  }

  caminho(nome: string) {
    if (!NOME_BACKUP.test(nome)) throw new BadRequestException('Nome de backup inválido.');
    const c = join(pastaBackups(), nome);
    if (!existsSync(c)) throw new NotFoundException('Backup não encontrado.');
    return c;
  }

  /** Cópia consistente do banco com o sistema em uso (VACUUM INTO), verificada em seguida. */
  async fazer(tipo: TipoBackup) {
    if (this.emAndamento) throw new BadRequestException('Já há um backup em andamento.');
    this.emAndamento = true;
    const pasta = pastaBackups();
    const nome = `loja_${carimbo()}_${tipo}.db`;
    const destino = join(pasta, nome);
    try {
      mkdirSync(pasta, { recursive: true });
      await this.prisma.$executeRawUnsafe(`VACUUM INTO '${destino.replaceAll("'", "''")}'`);
      if (!integridadeOk(destino)) {
        rmSync(destino, { force: true });
        throw new Error('A cópia gerada não passou na verificação de integridade.');
      }
      this.ultimoErro = null;
      this.log.log(`Backup ${tipo} criado: ${nome}`);
      await this.copiarParaPastaExtra(destino, nome);
      await this.limparAntigos();
      return this.listar().find((b) => b.nome === nome)!;
    } catch (e) {
      this.ultimoErro = { quando: new Date(), mensagem: (e as Error).message };
      this.log.error(`Falha no backup: ${(e as Error).message}`);
      throw new BadRequestException(`Falha no backup: ${(e as Error).message}`);
    } finally {
      this.emAndamento = false;
    }
  }

  private async copiarParaPastaExtra(origem: string, nome: string) {
    const { backupPastaExtra } = await this.config.obter();
    if (!backupPastaExtra) return;
    try {
      if (!existsSync(backupPastaExtra)) throw new Error(`pasta "${backupPastaExtra}" não encontrada (pen drive desconectado?)`);
      copyFileSync(origem, join(backupPastaExtra, nome));
      this.ultimaCopiaExtra = { quando: new Date(), ok: true };
    } catch (e) {
      // A cópia extra falhar não invalida o backup principal, mas fica visível na tela.
      this.ultimaCopiaExtra = { quando: new Date(), ok: false, mensagem: (e as Error).message };
      this.log.warn(`Cópia extra falhou: ${(e as Error).message}`);
    }
  }

  private async limparAntigos() {
    const { backupManterDias } = await this.config.obter();
    const limite = Date.now() - backupManterDias * 864e5;
    this.listar()
      .slice(MANTER_SEMPRE)
      .filter((b) => b.criadoEm.getTime() < limite)
      .forEach((b) => rmSync(join(pastaBackups(), b.nome), { force: true }));
  }

  /** Faz o backup automático do dia a partir do horário configurado — ou na hora, se o último tem mais de 24 h. */
  async verificarAgendamento() {
    try {
      const { backupHora } = await this.config.obter();
      const agora = new Date();
      const automaticos = this.listar().filter((b) => b.tipo === 'automatico');
      const ultimo = automaticos[0]?.criadoEm;
      const hojeFeito = ultimo && ultimo.toDateString() === agora.toDateString();
      const atrasado = !ultimo || agora.getTime() - ultimo.getTime() > 24 * 3600_000;
      if ((!hojeFeito && agora.getHours() >= backupHora) || atrasado) await this.fazer('automatico');
    } catch {
      /* o erro já ficou registrado em ultimoErro */
    }
  }

  /** Valida o backup, guarda uma cópia do banco atual e reinicia o sistema para trocar o arquivo. */
  async restaurar(nome: string) {
    const caminho = this.caminho(nome);
    if (!integridadeOk(caminho)) throw new BadRequestException('Este backup está corrompido e não pode ser restaurado.');
    const seguranca = await this.fazer('antes-restauracao');
    agendarRestauracao(caminho);
    this.log.warn(`Restauração de ${nome} agendada. Reiniciando...`);
    setTimeout(() => this.sair(), 1500).unref();
    return { reiniciando: true, copiaDeSeguranca: seguranca.nome };
  }
}
