import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { TelaCentral } from '../components/TelaCentral';
import { Alerta, Botao, Cabecalho, Campo, Cartao } from '../components/ui';
import { api } from '../lib/api';
import { useSair } from '../lib/sessao';

function FormularioSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (f.novaSenha !== f.confirmacao) return setErro('A confirmação não confere com a nova senha.');
    setErro('');
    setEnviando(true);
    try {
      await api('/auth/trocar-senha', { method: 'POST', body: { senhaAtual: f.senhaAtual, novaSenha: f.novaSenha } });
      form.reset();
      aoConcluir();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo rotulo="Senha atual" name="senhaAtual" type="password" required autoComplete="current-password" autoFocus />
      <Campo rotulo="Nova senha" name="novaSenha" type="password" required minLength={8} autoComplete="new-password" ajuda="Mínimo de 8 caracteres." />
      <Campo rotulo="Confirme a nova senha" name="confirmacao" type="password" required autoComplete="new-password" />
      <Alerta>{erro}</Alerta>
      <Botao type="submit" carregando={enviando} className="w-full">
        Salvar nova senha
      </Botao>
    </form>
  );
}

/** Tela obrigatória no primeiro acesso ou após o admin redefinir a senha. */
export function TrocarSenhaObrigatoria() {
  const qc = useQueryClient();
  const sair = useSair();
  return (
    <TelaCentral titulo="Crie uma nova senha" subtitulo="Por segurança, troque a senha provisória antes de continuar.">
      <FormularioSenha aoConcluir={() => qc.invalidateQueries({ queryKey: ['sessao'] })} />
      <Botao variante="fantasma" className="mt-2 w-full" onClick={() => sair()}>
        Sair
      </Botao>
    </TelaCentral>
  );
}

export function MinhaSenha() {
  const [ok, setOk] = useState(false);
  return (
    <>
      <Cabecalho titulo="Minha senha" descricao="Ao trocar a senha, você é desconectado dos outros computadores." />
      <Cartao className="max-w-md">
        {ok && <div className="mb-4"><Alerta tipo="sucesso">Senha alterada com sucesso.</Alerta></div>}
        <FormularioSenha aoConcluir={() => setOk(true)} />
      </Cartao>
    </>
  );
}
