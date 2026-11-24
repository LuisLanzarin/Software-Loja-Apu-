import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Janela, Selecao, Tabela, Vazio } from '../components/ui';
import { api } from '../lib/api';
import { useCategorias, useUnidades } from '../lib/consultas';
import { decimalParaTexto, formatarPct, lerDecimal } from '../lib/formato';
import type { Categoria, Unidade } from '../lib/tipos';

type Edicao = { tipo: 'categoria'; item: Categoria | null } | { tipo: 'unidade'; item: Unidade | null } | null;

export function Cadastros() {
  const qc = useQueryClient();
  const { data: categorias, isLoading: c1 } = useCategorias();
  const { data: unidades, isLoading: c2 } = useUnidades();
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [erro, setErro] = useState('');

  const salvar = useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body: unknown }) => api(url, { method, body }),
    onSuccess: () => {
      setEdicao(null);
      return qc.invalidateQueries({ queryKey: [edicao?.tipo === 'unidade' ? 'unidades' : 'categorias'] });
    },
    onError: (e) => setErro(e.message),
  });

  const abrir = (e: Edicao) => {
    setErro('');
    setEdicao(e);
  };

  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!edicao) return;
    const f = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>;
    const base = edicao.tipo === 'categoria' ? '/categorias' : '/unidades';
    let body: unknown;
    if (edicao.tipo === 'categoria') {
      const margem = f.margem.trim() ? lerDecimal(f.margem, 2) : null;
      if (f.margem.trim() && margem === null) return setErro('Margem inválida.');
      body = { nome: f.nome, margemPct: margem, ativo: f.ativo !== 'nao' };
    } else {
      body = { sigla: f.sigla, nome: f.nome, fracionavel: f.fracionavel === 'sim', ativo: f.ativo !== 'nao' };
    }
    salvar.mutate({ url: edicao.item ? `${base}/${edicao.item.id}` : base, method: edicao.item ? 'PATCH' : 'POST', body });
  }

  return (
    <>
      <Cabecalho titulo="Categorias e unidades" descricao="Cadastros de apoio usados no cadastro de produtos." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao
          titulo="Categorias"
          className="overflow-hidden [&>div:last-child]:p-0"
          acoes={<Botao variante="secundario" onClick={() => abrir({ tipo: 'categoria', item: null })}><Plus className="size-4" aria-hidden /> Nova</Botao>}
        >
          {c1 ? <Carregando /> : (
            <Tabela colunas={[{ titulo: 'Nome' }, { titulo: 'Margem' }, { titulo: 'Produtos', direita: true }, { titulo: '' }]} vazio={!categorias?.length && <Vazio>Ex.: Cimento e argamassa, Hidráulica, Elétrica, Pisos…</Vazio>}>
              {categorias?.map((c) => (
                <tr key={c.id} className={c.ativo ? '' : 'text-stone-400'}>
                  <td className="px-4 py-2.5 font-medium">{c.nome} {!c.ativo && <Etiqueta>Inativa</Etiqueta>}</td>
                  <td className="px-4 py-2.5 tabular-nums">{c.margemPct != null ? formatarPct(c.margemPct) : <span className="text-stone-400">padrão da loja</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.totalProdutos}</td>
                  <td className="px-2 py-1 text-right">
                    <Botao variante="fantasma" onClick={() => abrir({ tipo: 'categoria', item: c })}><Pencil className="size-4" aria-label="Editar" /></Botao>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao
          titulo="Unidades de medida"
          className="overflow-hidden [&>div:last-child]:p-0"
          acoes={<Botao variante="secundario" onClick={() => abrir({ tipo: 'unidade', item: null })}><Plus className="size-4" aria-hidden /> Nova</Botao>}
        >
          {c2 ? <Carregando /> : (
            <Tabela colunas={[{ titulo: 'Sigla' }, { titulo: 'Nome' }, { titulo: 'Fracionável' }, { titulo: '' }]}>
              {unidades?.map((u) => (
                <tr key={u.id} className={u.ativo ? '' : 'text-stone-400'}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{u.sigla}</td>
                  <td className="px-4 py-2.5">{u.nome} {!u.ativo && <Etiqueta>Inativa</Etiqueta>}</td>
                  <td className="px-4 py-2.5">{u.fracionavel ? 'Sim (ex.: 2,5)' : 'Não'}</td>
                  <td className="px-2 py-1 text-right">
                    <Botao variante="fantasma" onClick={() => abrir({ tipo: 'unidade', item: u })}><Pencil className="size-4" aria-label="Editar" /></Botao>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </div>

      <Janela
        aberta={!!edicao}
        aoFechar={() => setEdicao(null)}
        titulo={`${edicao?.item ? 'Editar' : 'Nova'} ${edicao?.tipo === 'unidade' ? 'unidade' : 'categoria'}`}
      >
        {edicao && (
          <form key={`${edicao.tipo}-${edicao.item?.id ?? 'nova'}`} onSubmit={enviar} className="space-y-4">
            {edicao.tipo === 'categoria' ? (
              <>
                <Campo rotulo="Nome" name="nome" required autoFocus defaultValue={edicao.item?.nome} />
                <Campo
                  rotulo="Margem desejada (%)"
                  name="margem"
                  inputMode="decimal"
                  defaultValue={edicao.item?.margemPct != null ? decimalParaTexto(edicao.item.margemPct, 2) : ''}
                  ajuda="Opcional. Em branco, os produtos usam a margem padrão da loja."
                />
              </>
            ) : (
              <>
                <Campo rotulo="Sigla" name="sigla" required autoFocus maxLength={6} defaultValue={edicao.item?.sigla} ajuda="Ex.: M2, SC, CX" />
                <Campo rotulo="Nome" name="nome" required defaultValue={edicao.item?.nome} />
                <Selecao rotulo="Aceita quantidade quebrada?" name="fracionavel" defaultValue={edicao.item?.fracionavel ? 'sim' : 'nao'}>
                  <option value="nao">Não — só inteiros (unidade, saco, caixa)</option>
                  <option value="sim">Sim — ex.: 2,5 metros, 0,75 m³</option>
                </Selecao>
              </>
            )}
            {edicao.item && (
              <Selecao rotulo="Situação" name="ativo" defaultValue={edicao.item.ativo ? 'sim' : 'nao'}>
                <option value="sim">Ativa</option>
                <option value="nao">Inativa</option>
              </Selecao>
            )}
            <Alerta>{erro}</Alerta>
            <div className="flex justify-end gap-2">
              <Botao type="button" variante="secundario" onClick={() => setEdicao(null)}>Cancelar</Botao>
              <Botao type="submit" carregando={salvar.isPending}>Salvar</Botao>
            </div>
          </form>
        )}
      </Janela>
    </>
  );
}
