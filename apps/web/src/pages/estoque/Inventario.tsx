import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao, Selecao, Tabela, Vazio } from '../../components/ui';
import { api } from '../../lib/api';
import { useCategorias } from '../../lib/consultas';
import { formatarQtd, formatarReais, lerDecimal } from '../../lib/formato';
import { usePode } from '../../lib/sessao';
import type { Pagina, Produto } from '../../lib/tipos';

interface Resultado {
  contados: number;
  diferencas: { produtoId: number; codigo: string; descricao: string; sistema: number; contado: number; diferenca: number; valor: number }[];
  valorDiferenca: number;
}

export function Inventario() {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const verCusto = usePode()('produto.ver_custo');
  const { data: categorias } = useCategorias();
  const [categoriaId, setCategoriaId] = useState('');
  const [cega, setCega] = useState(true);
  const [contagem, setContagem] = useState<Record<number, string>>({});
  const [observacao, setObservacao] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState('');

  const qs = new URLSearchParams({ situacao: 'ativos', porPagina: '2000', ...(categoriaId ? { categoriaId } : {}) });
  const { data, isLoading } = useQuery({ queryKey: ['inventario', qs.toString()], queryFn: () => api<Pagina<Produto>>(`/produtos?${qs}`) });

  const gravar = useMutation({
    mutationFn: (corpo: unknown) => api<Resultado>('/estoque/inventario', { method: 'POST', body: corpo }),
    onSuccess: async (r) => {
      setResultado(r);
      setContagem({});
      await qc.invalidateQueries({ queryKey: ['produtos'] });
      await qc.invalidateQueries({ queryKey: ['inventario'] });
      await qc.invalidateQueries({ queryKey: ['estoque-resumo'] });
    },
    onError: (e) => setErro(e.message),
  });

  function confirmar() {
    setErro('');
    const itens: { produtoId: number; contado: number }[] = [];
    for (const [id, txt] of Object.entries(contagem)) {
      if (!txt.trim()) continue;
      const v = lerDecimal(txt, 3);
      if (v === null) return setErro(`Quantidade inválida: "${txt}".`);
      itens.push({ produtoId: Number(id), contado: v });
    }
    if (!itens.length) return setErro('Preencha a quantidade contada de pelo menos um produto.');
    gravar.mutate({ itens, observacao: observacao || null });
  }

  const preenchidos = Object.values(contagem).filter((v) => v.trim()).length;

  return (
    <>
      <Cabecalho
        titulo="Inventário"
        descricao="Conte o que há fisicamente na loja. Só os produtos preenchidos são considerados, e as diferenças viram ajustes."
        acoes={<Botao variante="secundario" onClick={() => navegar('/estoque')}><ArrowLeft className="size-4" aria-hidden /> Estoque</Botao>}
      />

      {resultado && (
        <Cartao titulo="Resultado do inventário" className="mb-6 overflow-hidden [&>div:last-child]:p-0">
          <div className="px-5 pt-4">
            <Alerta tipo="sucesso">
              {resultado.contados} produto(s) contado(s), {resultado.diferencas.length} com diferença
              {verCusto && <> · impacto de {formatarReais(resultado.valorDiferenca)} a custo</>}.
            </Alerta>
          </div>
          {resultado.diferencas.length > 0 && (
            <Tabela colunas={[{ titulo: 'Produto' }, { titulo: 'Sistema', direita: true }, { titulo: 'Contado', direita: true }, { titulo: 'Diferença', direita: true }, ...(verCusto ? [{ titulo: 'Valor', direita: true }] : [])]}>
              {resultado.diferencas.map((d) => (
                <tr key={d.produtoId}>
                  <td className="px-4 py-2">{d.descricao} <span className="font-mono text-xs text-stone-500">{d.codigo}</span></td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatarQtd(d.sistema)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatarQtd(d.contado)}</td>
                  <td className={`px-4 py-2 text-right font-medium tabular-nums ${d.diferenca < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{d.diferenca > 0 ? '+' : ''}{formatarQtd(d.diferenca)}</td>
                  {verCusto && <td className="px-4 py-2 text-right tabular-nums">{formatarReais(d.valor)}</td>}
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      )}

      <Cartao className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <Selecao rotulo="Categoria a contar" value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); setContagem({}); }} className="w-64">
            <option value="">Todas</option>
            {categorias?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Selecao>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={cega} onChange={(e) => setCega(e.target.checked)} className="size-4 rounded accent-marca-600" />
            Contagem cega (esconde o saldo do sistema)
          </label>
          <Campo rotulo="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: inventário mensal" className="min-w-64 flex-1" />
        </div>
      </Cartao>

      <Cartao className="overflow-hidden [&>div]:p-0">
        {isLoading ? <Carregando /> : (
          <Tabela
            colunas={[{ titulo: 'Código' }, { titulo: 'Produto' }, { titulo: 'Local' }, ...(cega ? [] : [{ titulo: 'Sistema', direita: true }]), { titulo: 'Contado', direita: true }]}
            vazio={!data?.itens.length && <Vazio>Nenhum produto ativo nesta categoria.</Vazio>}
          >
            {data?.itens.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-mono text-xs">{p.codigo}</td>
                <td className="px-4 py-2">{p.descricao}</td>
                <td className="px-4 py-2 text-stone-500">{p.localizacao ?? '—'}</td>
                {!cega && <td className="px-4 py-2 text-right tabular-nums">{formatarQtd(p.estoqueAtual)} {p.unidade.sigla}</td>}
                <td className="w-40 px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`Quantidade contada de ${p.descricao}`}
                      inputMode="decimal"
                      value={contagem[p.id] ?? ''}
                      onChange={(e) => setContagem((c) => ({ ...c, [p.id]: e.target.value }))}
                      className="w-full rounded-md border-0 py-1.5 text-right text-sm tabular-nums ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-marca-600"
                    />
                    <span className="w-8 text-xs text-stone-500">{p.unidade.sigla}</span>
                  </div>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-4 border-t border-stone-200 bg-stone-100/95 py-3 backdrop-blur">
        {erro && <Alerta>{erro}</Alerta>}
        <span className="text-sm text-stone-600">{preenchidos} produto(s) preenchido(s)</span>
        <Botao onClick={confirmar} carregando={gravar.isPending} disabled={!preenchidos}>Gravar inventário</Botao>
      </div>
    </>
  );
}
