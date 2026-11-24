import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LockOpen, Pencil, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Janela, Selecao } from '../components/ui';
import { api } from '../lib/api';
import { NOMES_PERFIL, type Perfil } from '../lib/formato';
import { useUsuario } from '../lib/sessao';

interface Usuario {
  id: number;
  nome: string;
  login: string;
  perfil: Perfil;
  ativo: boolean;
  trocarSenha: boolean;
  bloqueadoAte: string | null;
}

type Acao = { tipo: 'novo' } | { tipo: 'editar'; usuario: Usuario } | { tipo: 'senha'; usuario: Usuario } | null;

const DESCRICAO_PERFIL: Record<Perfil, string> = {
  VENDEDOR: 'Vendas, orçamentos e o próprio caixa. Não vê preço de custo.',
  FINANCEIRO: 'Cadastros, preços, custos e relatórios financeiros.',
  GERENTE: 'Tudo da operação, autoriza descontos e cancelamentos acima do limite.',
  ADMIN: 'Acesso total, inclusive gerenciar usuários.',
};

function OpcoesPerfil() {
  return (Object.keys(NOMES_PERFIL) as Perfil[]).map((p) => (
    <option key={p} value={p}>
      {NOMES_PERFIL[p]}
    </option>
  ));
}

export function Usuarios() {
  const eu = useUsuario();
  const qc = useQueryClient();
  const [acao, setAcao] = useState<Acao>(null);
  const [erro, setErro] = useState('');
  const { data: usuarios, isLoading } = useQuery({ queryKey: ['usuarios'], queryFn: () => api<Usuario[]>('/usuarios') });

  const salvar = useMutation({
    mutationFn: ({ caminho, method, body }: { caminho: string; method: string; body?: unknown }) => api(caminho, { method, body }),
    onSuccess: () => {
      setAcao(null);
      setErro('');
      return qc.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (e) => setErro(e.message),
  });

  const abrir = (a: Acao) => {
    setErro('');
    setAcao(a);
  };

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (acao?.tipo === 'novo') salvar.mutate({ caminho: '/usuarios', method: 'POST', body: { nome: f.nome, login: f.login, perfil: f.perfil, senha: f.senha } });
    if (acao?.tipo === 'editar')
      salvar.mutate({ caminho: `/usuarios/${acao.usuario.id}`, method: 'PATCH', body: { nome: f.nome, perfil: f.perfil, ativo: f.ativo === 'sim' } });
    if (acao?.tipo === 'senha') salvar.mutate({ caminho: `/usuarios/${acao.usuario.id}/redefinir-senha`, method: 'POST', body: { senha: f.senha } });
  }

  const bloqueado = (u: Usuario) => !!u.bloqueadoAte && new Date(u.bloqueadoAte) > new Date();

  return (
    <>
      <Cabecalho
        titulo="Usuários"
        descricao="Quem pode acessar o sistema e o que cada um pode fazer."
        acoes={
          <Botao onClick={() => abrir({ tipo: 'novo' })}>
            <UserPlus className="size-4" aria-hidden /> Novo usuário
          </Botao>
        }
      />

      <Cartao className="overflow-hidden [&>div]:p-0">
        {isLoading ? (
          <Carregando />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Login</th>
                <th className="px-5 py-3">Perfil</th>
                <th className="px-5 py-3">Situação</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {usuarios?.map((u) => (
                <tr key={u.id} className={u.ativo ? '' : 'text-stone-400'}>
                  <td className="px-5 py-3 font-medium">
                    {u.nome} {u.id === eu.id && <span className="font-normal text-stone-400">(você)</span>}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{u.login}</td>
                  <td className="px-5 py-3">{NOMES_PERFIL[u.perfil]}</td>
                  <td className="space-x-1 px-5 py-3">
                    {!u.ativo ? <Etiqueta>Inativo</Etiqueta> : bloqueado(u) ? <Etiqueta cor="vermelho">Bloqueado</Etiqueta> : <Etiqueta cor="verde">Ativo</Etiqueta>}
                    {u.ativo && u.trocarSenha && <Etiqueta cor="laranja">Senha provisória</Etiqueta>}
                  </td>
                  <td className="px-5 py-2 text-right whitespace-nowrap">
                    {bloqueado(u) && (
                      <Botao variante="fantasma" title="Desbloquear" onClick={() => salvar.mutate({ caminho: `/usuarios/${u.id}/desbloquear`, method: 'POST' })}>
                        <LockOpen className="size-4" aria-hidden /> Desbloquear
                      </Botao>
                    )}
                    <Botao variante="fantasma" title="Redefinir senha" onClick={() => abrir({ tipo: 'senha', usuario: u })}>
                      <KeyRound className="size-4" aria-hidden /> <span className="sr-only">Redefinir senha</span>
                    </Botao>
                    <Botao variante="fantasma" title="Editar" onClick={() => abrir({ tipo: 'editar', usuario: u })}>
                      <Pencil className="size-4" aria-hidden /> <span className="sr-only">Editar</span>
                    </Botao>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>

      <Janela
        aberta={!!acao}
        aoFechar={() => setAcao(null)}
        titulo={acao?.tipo === 'novo' ? 'Novo usuário' : acao?.tipo === 'editar' ? `Editar ${acao.usuario.nome}` : `Redefinir senha de ${acao?.usuario.nome ?? ''}`}
      >
        <form onSubmit={enviar} className="space-y-4">
          {acao?.tipo !== 'senha' && (
            <>
              <Campo rotulo="Nome" name="nome" required defaultValue={acao?.tipo === 'editar' ? acao.usuario.nome : ''} autoFocus />
              {acao?.tipo === 'novo' && <Campo rotulo="Login" name="login" required autoCapitalize="none" ajuda="Letras minúsculas, sem espaços. Ex.: joao.silva" />}
              <PerfilComDescricao inicial={acao?.tipo === 'editar' ? acao.usuario.perfil : 'VENDEDOR'} />
            </>
          )}
          {acao?.tipo === 'editar' && (
            <Selecao rotulo="Situação" name="ativo" defaultValue={acao.usuario.ativo ? 'sim' : 'nao'}>
              <option value="sim">Ativo</option>
              <option value="nao">Inativo (não consegue entrar)</option>
            </Selecao>
          )}
          {acao?.tipo !== 'editar' && (
            <Campo
              rotulo="Senha provisória"
              name="senha"
              type="text"
              required
              minLength={8}
              autoComplete="off"
              ajuda="Mínimo de 8 caracteres. O usuário vai criar a própria senha no próximo acesso."
            />
          )}
          <Alerta>{erro}</Alerta>
          <div className="flex justify-end gap-2 pt-2">
            <Botao type="button" variante="secundario" onClick={() => setAcao(null)}>
              Cancelar
            </Botao>
            <Botao type="submit" carregando={salvar.isPending}>
              Salvar
            </Botao>
          </div>
        </form>
      </Janela>
    </>
  );
}

function PerfilComDescricao({ inicial }: { inicial: Perfil }) {
  const [perfil, setPerfil] = useState<Perfil>(inicial);
  return (
    <div>
      <Selecao rotulo="Perfil" name="perfil" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
        <OpcoesPerfil />
      </Selecao>
      <p className="mt-1 text-xs text-stone-500">{DESCRICAO_PERFIL[perfil]}</p>
    </div>
  );
}
