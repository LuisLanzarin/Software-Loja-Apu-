import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { TelaCentral } from '../components/TelaCentral';
import { Alerta, Botao, Campo } from '../components/ui';
import { api } from '../lib/api';

export function ConfiguracaoInicial() {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (f.senha !== f.confirmacao) return setErro('As senhas não conferem.');
    setErro('');
    setEnviando(true);
    try {
      await api('/setup', { method: 'POST', body: { nomeLoja: f.nomeLoja, nome: f.nome, login: f.login, senha: f.senha } });
      await qc.invalidateQueries();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaCentral titulo="Bem-vindo!" subtitulo="Antes de começar, cadastre a loja e o usuário administrador.">
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="Nome da loja" name="nomeLoja" required autoFocus />
        <Campo rotulo="Seu nome" name="nome" required autoComplete="name" />
        <Campo rotulo="Login" name="login" required autoComplete="username" ajuda="Letras minúsculas, sem espaços. Ex.: carlos" />
        <Campo rotulo="Senha" name="senha" type="password" required minLength={8} autoComplete="new-password" ajuda="Mínimo de 8 caracteres." />
        <Campo rotulo="Confirme a senha" name="confirmacao" type="password" required autoComplete="new-password" />
        <Alerta>{erro}</Alerta>
        <Botao type="submit" carregando={enviando} className="w-full">
          Criar e entrar
        </Botao>
      </form>
    </TelaCentral>
  );
}
