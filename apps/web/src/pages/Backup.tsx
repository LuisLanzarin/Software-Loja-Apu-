import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, HardDriveDownload, RotateCcw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Janela, Tabela, Vazio } from '../components/ui';
import { api } from '../lib/api';
import { formatarDataHora } from '../lib/formato';

interface Arquivo { nome: string; tamanho: number; criadoEm: string; tipo: 'automatico' | 'manual' | 'antes-restauracao' }
interface Status {
  pasta: string;
  backupHora: number;
  backupManterDias: number;
  backupPastaExtra: string | null;
  ultimoErro: { quando: string; mensagem: string } | null;
  ultimaCopiaExtra: { quando: string; ok: boolean; mensagem?: string } | null;
  arquivos: Arquivo[];
}

const TIPOS = { automatico: ['Automático', 'cinza'], manual: ['Manual', 'azul'], 'antes-restauracao': ['Antes de restaurar', 'laranja'] } as const;
const tamanho = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.ceil(b / 1024)} KB`);

export function Backup() {
  const qc = useQueryClient();
  const { data: s, isLoading } = useQuery({ queryKey: ['backup'], queryFn: () => api<Status>('/backup') });
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);
  const [fazendo, setFazendo] = useState(false);
  const [restaurar, setRestaurar] = useState<Arquivo | null>(null);
  const [reiniciando, setReiniciando] = useState(false);
  const [erroRest, setErroRest] = useState('');

  async function fazerAgora() {
    setFazendo(true);
    setMsg(null);
    try {
      const b = await api<Arquivo>('/backup', { method: 'POST' });
      setMsg({ tipo: 'sucesso', texto: `Backup criado e verificado: ${b.nome}` });
      await qc.invalidateQueries({ queryKey: ['backup'] });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: (e as Error).message });
    } finally {
      setFazendo(false);
    }
  }

  async function salvarConfig(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      await api('/backup/configuracao', { method: 'PUT', body: { backupHora: Number(f.hora), backupManterDias: Number(f.dias), backupPastaExtra: f.pastaExtra || null } });
      setMsg({ tipo: 'sucesso', texto: 'Configuração de backup salva.' });
      await qc.invalidateQueries({ queryKey: ['backup'] });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    }
  }

  async function confirmarRestauracao(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroRest('');
    try {
      await api('/backup/restaurar', { method: 'POST', body: { nome: restaurar!.nome, confirmacao: String(new FormData(e.currentTarget).get('confirmacao')) } });
      setReiniciando(true);
      // Espera o sistema desligar e voltar com o banco restaurado.
      await new Promise((ok) => setTimeout(ok, 3000));
      for (let i = 0; i < 60; i++) {
        if (await fetch('/api/saude').then((r) => r.ok).catch(() => false)) break;
        await new Promise((ok) => setTimeout(ok, 1000));
      }
      window.location.href = '/';
    } catch (err) {
      setErroRest((err as Error).message);
    }
  }

  if (isLoading || !s) return <Carregando />;
  const ultimoAuto = s.arquivos.find((a) => a.tipo === 'automatico');
  const atrasado = !ultimoAuto || Date.now() - new Date(ultimoAuto.criadoEm).getTime() > 26 * 3600_000;

  return (
    <>
      <Cabecalho
        titulo="Backup"
        descricao="Cópias de segurança do banco de dados. Sem backup, um defeito no computador apaga tudo."
        acoes={<Botao onClick={fazerAgora} carregando={fazendo}><HardDriveDownload className="size-4" aria-hidden /> Fazer backup agora</Botao>}
      />
      <div className="mb-6 space-y-3">
        {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
        {s.ultimoErro && <Alerta>Último backup automático falhou em {formatarDataHora(s.ultimoErro.quando)}: {s.ultimoErro.mensagem}</Alerta>}
        {s.ultimaCopiaExtra && !s.ultimaCopiaExtra.ok && <Alerta>A cópia para a pasta extra falhou em {formatarDataHora(s.ultimaCopiaExtra.quando)}: {s.ultimaCopiaExtra.mensagem}</Alerta>}
        {atrasado && !s.ultimoErro && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <AlertTriangle className="size-4" aria-hidden /> Nenhum backup automático nas últimas 24 horas. Ele roda a partir das {s.backupHora}h com o sistema ligado.
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Onde ficam">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-stone-600">Pasta principal (neste computador)</dt><dd className="font-mono text-xs break-all">{s.pasta}</dd></div>
            <div><dt className="text-stone-600">Cópia extra</dt><dd className="font-mono text-xs break-all">{s.backupPastaExtra ?? <span className="font-sans text-amber-700">Não configurada — recomendado: pen drive ou pasta do Google Drive/OneDrive</span>}</dd></div>
            <div><dt className="text-stone-600">Último backup automático</dt><dd>{ultimoAuto ? formatarDataHora(ultimoAuto.criadoEm) : 'Nenhum ainda'}</dd></div>
          </dl>
        </Cartao>
        <Cartao titulo="Configuração">
          <form onSubmit={salvarConfig} className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Backup automático a partir das (hora)" name="hora" type="number" min={0} max={23} required defaultValue={s.backupHora} ajuda="Ex.: 21 = 21h. Se o PC estiver desligado, faz ao ligar." />
            <Campo rotulo="Guardar backups por (dias)" name="dias" type="number" min={7} max={3650} required defaultValue={s.backupManterDias} ajuda="Os 7 mais recentes nunca são apagados." />
            <Campo rotulo="Pasta extra para cópia" name="pastaExtra" defaultValue={s.backupPastaExtra ?? ''} className="sm:col-span-2" placeholder="Ex.: E:\Backups Loja ou C:\Users\Loja\Google Drive\Backups" />
            <div className="flex justify-end sm:col-span-2"><Botao type="submit" variante="secundario">Salvar configuração</Botao></div>
          </form>
        </Cartao>
      </div>

      <Cartao titulo={`Backups disponíveis (${s.arquivos.length})`} className="overflow-hidden [&>div:last-child]:p-0">
        <Tabela colunas={[{ titulo: 'Data' }, { titulo: 'Tipo' }, { titulo: 'Tamanho', direita: true }, { titulo: '' }]} vazio={!s.arquivos.length && <Vazio>Nenhum backup ainda. Clique em “Fazer backup agora”.</Vazio>}>
          {s.arquivos.map((a) => (
            <tr key={a.nome}>
              <td className="px-4 py-2 tabular-nums">{formatarDataHora(a.criadoEm)}</td>
              <td className="px-4 py-2"><Etiqueta cor={TIPOS[a.tipo][1]}>{TIPOS[a.tipo][0]}</Etiqueta></td>
              <td className="px-4 py-2 text-right tabular-nums">{tamanho(a.tamanho)}</td>
              <td className="px-4 py-1.5 text-right whitespace-nowrap">
                <a href={`/api/backup/arquivos/${encodeURIComponent(a.nome)}`} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100" download>
                  <Download className="size-4" aria-hidden /> Baixar
                </a>
                <Botao variante="fantasma" onClick={() => { setErroRest(''); setRestaurar(a); }}><RotateCcw className="size-4" aria-hidden /> Restaurar</Botao>
              </td>
            </tr>
          ))}
        </Tabela>
      </Cartao>

      <Janela aberta={!!restaurar} aoFechar={() => !reiniciando && setRestaurar(null)} titulo="Restaurar backup">
        {restaurar && (reiniciando ? (
          <div className="space-y-2 py-4 text-center">
            <p className="font-medium">Restaurando e reiniciando o sistema…</p>
            <p className="text-sm text-stone-600">Isso leva alguns segundos. Todos os computadores precisarão entrar de novo.</p>
          </div>
        ) : (
          <form onSubmit={confirmarRestauracao} className="space-y-4">
            <Alerta>
              O sistema volta a como estava em <strong>{formatarDataHora(restaurar.criadoEm)}</strong>. Tudo o que foi feito depois disso
              (vendas, entradas, cadastros) <strong>deixa de existir</strong>. Antes, é feita uma cópia do banco atual, por segurança.
            </Alerta>
            <p className="text-sm text-stone-600">Peça para os outros computadores não usarem o sistema por alguns segundos.</p>
            <Campo rotulo='Digite RESTAURAR para confirmar' name="confirmacao" required autoComplete="off" autoFocus />
            <Alerta>{erroRest}</Alerta>
            <div className="flex justify-end gap-2">
              <Botao type="button" variante="secundario" onClick={() => setRestaurar(null)}>Cancelar</Botao>
              <Botao type="submit" variante="perigo">Restaurar este backup</Botao>
            </div>
          </form>
        ))}
      </Janela>
    </>
  );
}
