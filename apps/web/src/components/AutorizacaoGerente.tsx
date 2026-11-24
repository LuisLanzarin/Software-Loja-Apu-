import { ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import type { MotivoAutorizacao } from '../lib/tipos';
import { Alerta, Botao, Campo, Janela } from './ui';

export type Credenciais = { login: string; senha: string };

/** Erro 403 do servidor pedindo o gerente → devolve os motivos; senão, null. */
export function motivosDoErro(e: unknown): MotivoAutorizacao[] | null {
  if (e instanceof ApiError && e.codigo === 'AUTORIZACAO_NECESSARIA') return (e.dados?.motivos as MotivoAutorizacao[]) ?? [];
  return null;
}

/**
 * Janela em que o GERENTE digita o próprio login e senha para liberar a operação.
 * A senha vai direto para o servidor junto com a operação; nada fica guardado na tela.
 */
export function AutorizacaoGerente({
  motivos,
  aoFechar,
  aoConfirmar,
}: {
  motivos: MotivoAutorizacao[] | null;
  aoFechar: () => void;
  aoConfirmar: (c: Credenciais) => Promise<void>;
}) {
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setErro('');
    setEnviando(true);
    try {
      await aoConfirmar({ login: String(f.get('login')), senha: String(f.get('senha')) });
    } catch (err) {
      setErro((err as Error).message);
      (form.elements.namedItem('senha') as HTMLInputElement).value = '';
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Janela aberta={!!motivos} aoFechar={aoFechar} titulo="Autorização do gerente">
      {motivos && (
        <form onSubmit={enviar} className="space-y-4" autoComplete="off">
          <div className="flex gap-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
            <ul className="space-y-1">
              {motivos.map((m, i) => <li key={i}>{m.detalhe}</li>)}
            </ul>
          </div>
          <Campo rotulo="Login do gerente" name="login" required autoFocus autoCapitalize="none" />
          <Campo rotulo="Senha do gerente" name="senha" type="password" required autoComplete="off" />
          <Alerta>{erro}</Alerta>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={aoFechar}>Cancelar</Botao>
            <Botao type="submit" carregando={enviando}>Autorizar</Botao>
          </div>
        </form>
      )}
    </Janela>
  );
}
