import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { TelaCentral } from '../components/TelaCentral';
import { Alerta, Botao, Campo } from '../components/ui';
import { api } from '../lib/api';

export function Entrar({ nomeLoja }: { nomeLoja?: string }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [motivo] = useState(() => {
    const m = sessionStorage.getItem('motivoSaida');
    sessionStorage.removeItem('motivoSaida');
    return m;
  });

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErro('');
    setEnviando(true);
    try {
      await api('/auth/entrar', { method: 'POST', body: { login: f.get('login'), senha: f.get('senha') } });
      await qc.invalidateQueries({ queryKey: ['sessao'] });
    } catch (err) {
      setErro((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <TelaCentral titulo={nomeLoja ?? 'Sistema de gestão'} subtitulo="Entre com seu login e senha.">
      <form onSubmit={enviar} className="space-y-4">
        {motivo && <Alerta tipo="info">{motivo}</Alerta>}
        <Campo rotulo="Login" name="login" required autoFocus autoComplete="username" autoCapitalize="none" />
        <Campo rotulo="Senha" name="senha" type="password" required autoComplete="current-password" />
        <Alerta>{erro}</Alerta>
        <Botao type="submit" carregando={enviando} className="w-full">
          Entrar
        </Botao>
      </form>
    </TelaCentral>
  );
}
