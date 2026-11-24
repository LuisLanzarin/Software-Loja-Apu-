import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Janela, Paginacao, Selecao, Tabela, Vazio } from '../../components/ui';
import { api } from '../../lib/api';
import { formatarDataHora, formatarQtd, formatarReais, lerDecimal } from '../../lib/formato';
import { usePode } from '../../lib/sessao';
import type { Pagina, Produto } from '../../lib/tipos';
import { SituacaoEstoque } from './Estoque';
import { TIPOS_MOV } from './rotulos';

interface Mov {
  id: number;
  tipo: string;
  quantidade: number;
  saldoApos: number;
  custoUnitario?: number;
  motivo: string | null;
  criadoEm: string;
  usuario: { nome: string } | null;
  entrada: { id: number; numeroNota: string | null } | null;
}

export function EstoqueProduto() {
  const { id } = useParams();
  const pode = usePode();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [ajustando, setAjustando] = useState(false);
  const [erro, setErro] = useState('');

  const { data: p } = useQuery({ queryKey: ['produto', id], queryFn: () => api<Produto>(`/produtos/${id}`) });
  const { data: movs, isLoading } = useQuery({
    queryKey: ['movimentacoes', id, pagina],
    queryFn: () => api<Pagina<Mov>>(`/estoque/movimentacoes?produtoId=${id}&pagina=${pagina}`),
    placeholderData: keepPreviousData,
  });

  const ajustar = useMutation({
    mutationFn: (corpo: unknown) => api('/estoque/ajustes', { method: 'POST', body: corpo }),
    onSuccess: async () => {
      setAjustando(false);
      await qc.invalidateQueries({ queryKey: ['produto', id] });
      await qc.invalidateQueries({ queryKey: ['movimentacoes', id] });
      await qc.invalidateQueries({ queryKey: ['produtos'] });
      await qc.invalidateQueries({ queryKey: ['estoque-resumo'] });
    },
    onError: (e) => setErro(e.message),
  });

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const quantidade = lerDecimal(f.quantidade, 3);
    if (!quantidade) return setErro('Informe a quantidade.');
    ajustar.mutate({ produtoId: Number(id), tipo: f.tipo, quantidade, motivo: f.motivo });
  }

  if (!p) return <Carregando />;
  const verCusto = pode('produto.ver_custo');

  return (
    <>
      <Cabecalho
        titulo={p.descricao}
        descricao={`Código ${p.codigo}${p.localizacao ? ` · ${p.localizacao}` : ''}`}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => navegar('/estoque')}><ArrowLeft className="size-4" aria-hidden /> Voltar</Botao>
            {pode('estoque.ajustar') && (
              <Botao onClick={() => { setErro(''); setAjustando(true); }}><SlidersHorizontal className="size-4" aria-hidden /> Ajustar estoque</Botao>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Cartao><p className="text-sm text-stone-600">Saldo atual</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatarQtd(p.estoqueAtual)} <span className="text-base font-normal text-stone-500">{p.unidade.sigla}</span></p></Cartao>
        <Cartao><p className="text-sm text-stone-600">Estoque mínimo</p><p className="mt-1 text-2xl font-semibold tabular-nums">{p.estoqueMinimo ? formatarQtd(p.estoqueMinimo) : '—'}</p></Cartao>
        <Cartao><p className="text-sm text-stone-600">Situação</p><p className="mt-2"><SituacaoEstoque p={p} /></p></Cartao>
        {verCusto && <Cartao><p className="text-sm text-stone-600">Custo médio</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatarReais(p.custo ?? 0)}</p></Cartao>}
      </div>

      <Cartao titulo="Movimentações" className="overflow-hidden [&>div:last-child]:p-0">
        {isLoading ? <Carregando /> : (
          <Tabela
            colunas={[
              { titulo: 'Data' }, { titulo: 'Tipo' }, { titulo: 'Quantidade', direita: true }, { titulo: 'Saldo', direita: true },
              ...(verCusto ? [{ titulo: 'Custo un.', direita: true }] : []), { titulo: 'Usuário' }, { titulo: 'Motivo' },
            ]}
            vazio={!movs?.itens.length && <Vazio>Nenhuma movimentação ainda. O estoque começa com uma entrada de mercadoria ou um inventário.</Vazio>}
          >
            {movs?.itens.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 whitespace-nowrap tabular-nums text-stone-600">{formatarDataHora(m.criadoEm)}</td>
                <td className="px-4 py-2"><Etiqueta cor={TIPOS_MOV[m.tipo]?.cor}>{TIPOS_MOV[m.tipo]?.rotulo ?? m.tipo}</Etiqueta></td>
                <td className={`px-4 py-2 text-right font-medium tabular-nums ${m.quantidade < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {m.quantidade > 0 ? '+' : ''}{formatarQtd(m.quantidade)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatarQtd(m.saldoApos)}</td>
                {verCusto && <td className="px-4 py-2 text-right tabular-nums text-stone-600">{formatarReais(m.custoUnitario ?? 0)}</td>}
                <td className="px-4 py-2">{m.usuario?.nome ?? '—'}</td>
                <td className="px-4 py-2 text-stone-600">
                  {m.entrada && pode('estoque.entrada') ? <Link className="text-marca-700 underline" to={`/entradas/${m.entrada.id}`}>{m.motivo}</Link> : m.motivo}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
      {movs && <Paginacao pagina={pagina} total={movs.total} porPagina={movs.porPagina} aoMudar={setPagina} />}

      <Janela aberta={ajustando} aoFechar={() => setAjustando(false)} titulo="Ajustar estoque">
        <form onSubmit={enviar} className="space-y-4">
          <p className="text-sm text-stone-600">Saldo atual: <strong>{formatarQtd(p.estoqueAtual)} {p.unidade.sigla}</strong>. Use para correções pontuais; para contagem geral use o Inventário.</p>
          <Selecao rotulo="Tipo" name="tipo" defaultValue="PERDA">
            <option value="PERDA">Perda / avaria (sai do estoque)</option>
            <option value="AJUSTE_SAIDA">Ajuste de saída (outro motivo)</option>
            <option value="AJUSTE_ENTRADA">Ajuste de entrada</option>
          </Selecao>
          <Campo rotulo={`Quantidade (${p.unidade.sigla})`} name="quantidade" inputMode="decimal" required autoFocus />
          <Campo rotulo="Motivo" name="motivo" required minLength={3} placeholder="Ex.: saco rasgado na descarga" />
          <Alerta>{erro}</Alerta>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setAjustando(false)}>Cancelar</Botao>
            <Botao type="submit" carregando={ajustar.isPending}>Confirmar ajuste</Botao>
          </div>
        </form>
      </Janela>
    </>
  );
}
