import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { BuscaProduto, type BuscaProdutoRef } from '../../components/BuscaProduto';
import { Alerta, AreaTexto, Botao, Cabecalho, Campo, Cartao, Selecao, Tabela, Vazio } from '../../components/ui';
import { api } from '../../lib/api';
import { custoMedio, ratear, valorDe } from '../../lib/calculosEstoque';
import { useFornecedores } from '../../lib/consultas';
import { decimalParaTexto, formatarQtd, formatarReais, lerDecimal } from '../../lib/formato';
import type { Produto } from '../../lib/tipos';

interface Linha {
  chave: number;
  produto: Produto;
  unidadeId: number;
  quantidade: string;
  custo: string;
}

const inputLinha = 'w-full rounded-md border-0 py-1.5 text-right text-sm tabular-nums ring-1 ring-stone-300 ring-inset focus:ring-2 focus:ring-marca-600';

/** Unidades possíveis para o item: a de venda + as de compra cadastradas. */
function unidadesDo(p: Produto) {
  return [
    { id: p.unidadeId, sigla: p.unidade.sigla, fator: 1000 },
    ...(p.conversoes ?? []).map((c) => ({ id: c.unidadeId, sigla: c.unidade.sigla, fator: c.fator })),
  ];
}

export function EntradaNova() {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const busca = useRef<BuscaProdutoRef>(null);
  const { data: fornecedores } = useFornecedores();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [extras, setExtras] = useState({ frete: '', outrasDespesas: '', desconto: '' });
  const [erro, setErro] = useState('');

  async function adicionar(resumo: Produto) {
    // A busca traz um resumo; as conversões e o custo vêm do cadastro completo.
    const p = await api<Produto>(`/produtos/${resumo.id}`);
    const compra = p.conversoes?.[0];
    setLinhas((l) => [...l, { chave: Date.now(), produto: p, unidadeId: compra?.unidadeId ?? p.unidadeId, quantidade: '', custo: '' }]);
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-ultima-qtd]`)?.focus(), 0);
  }
  const alterar = (chave: number, mudanca: Partial<Linha>) => setLinhas((l) => l.map((x) => (x.chave === chave ? { ...x, ...mudanca } : x)));

  // Prévia: os mesmos cálculos que o servidor fará.
  const calc = linhas.map((l) => {
    const u = unidadesDo(l.produto).find((x) => x.id === l.unidadeId)!;
    const qtd = lerDecimal(l.quantidade || '0', 3) ?? 0;
    const custo = lerDecimal(l.custo || '0', 2) ?? 0;
    return { u, qtd, custo, qtdEstoque: Math.round((qtd * u.fator) / 1000), valor: valorDe(qtd, custo) };
  });
  const totalProdutos = calc.reduce((a, c) => a + c.valor, 0);
  const n = (s: string) => lerDecimal(s || '0', 2) ?? 0;
  const extra = n(extras.frete) + n(extras.outrasDespesas) - n(extras.desconto);
  const rateio = ratear(calc.map((c) => c.valor), extra);

  const salvar = useMutation({
    mutationFn: (corpo: unknown) => api<{ entrada: { id: number }; alertasMargem: unknown[] }>('/entradas', { method: 'POST', body: corpo }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['produtos'] });
      await qc.invalidateQueries({ queryKey: ['estoque-resumo'] });
      await qc.invalidateQueries({ queryKey: ['entradas'] });
      navegar(`/entradas/${r.entrada.id}`, { replace: true, state: { alertasMargem: r.alertasMargem, nova: true } });
    },
    onError: (e) => setErro(e.message),
  });

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro('');
    if (!linhas.length) return setErro('Adicione pelo menos um produto.');
    const invalida = calc.findIndex((c) => c.qtd <= 0);
    if (invalida >= 0) return setErro(`Informe a quantidade de "${linhas[invalida].produto.descricao}".`);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    salvar.mutate({
      fornecedorId: f.fornecedorId ? Number(f.fornecedorId) : null,
      numeroNota: f.numeroNota || null,
      dataEmissao: f.dataEmissao || null,
      observacoes: f.observacoes || null,
      frete: n(extras.frete), outrasDespesas: n(extras.outrasDespesas), desconto: n(extras.desconto),
      itens: linhas.map((l, i) => ({ produtoId: l.produto.id, unidadeId: l.unidadeId, quantidade: calc[i].qtd, custoUnitario: calc[i].custo })),
    });
  }

  return (
    <form onSubmit={enviar} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT' && e.preventDefault()}>
      <Cabecalho
        titulo="Entrada de mercadoria"
        descricao="Lance a nota do fornecedor. O estoque e o custo médio são atualizados ao confirmar."
        acoes={<Botao type="button" variante="secundario" onClick={() => navegar(-1)}><ArrowLeft className="size-4" aria-hidden /> Voltar</Botao>}
      />

      <Cartao titulo="Nota" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-6">
          <Selecao rotulo="Fornecedor" name="fornecedorId" className="sm:col-span-3">
            <option value="">Não informado</option>
            {fornecedores?.filter((f) => f.ativo).map((f) => <option key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</option>)}
          </Selecao>
          <Campo rotulo="Nº da nota" name="numeroNota" className="sm:col-span-1" />
          <Campo rotulo="Data de emissão" name="dataEmissao" type="date" className="sm:col-span-2" />
        </div>
      </Cartao>

      <Cartao titulo="Produtos" className="mb-6 overflow-visible [&>div:last-child]:p-0">
        <div className="border-b border-stone-200 p-4">
          <BuscaProduto ref={busca} aoEscolher={adicionar} autoFocus />
        </div>
        <Tabela
          colunas={[
            { titulo: 'Produto' }, { titulo: 'Unidade' }, { titulo: 'Qtd.', direita: true }, { titulo: 'Custo un. (R$)', direita: true },
            { titulo: 'Total', direita: true }, { titulo: 'Entra no estoque', direita: true }, { titulo: 'Custo médio', direita: true }, { titulo: '' },
          ]}
          vazio={!linhas.length && <Vazio>Busque acima os produtos da nota.</Vazio>}
        >
          {linhas.map((l, i) => {
            const c = calc[i];
            const custoFinal = c.qtdEstoque > 0 ? Math.round(((c.valor + rateio[i]) * 1000) / c.qtdEstoque) : 0;
            const novoMedio = c.qtdEstoque > 0 ? custoMedio(l.produto.estoqueAtual, l.produto.custo ?? 0, c.qtdEstoque, custoFinal) : null;
            const ultimo = i === linhas.length - 1;
            return (
              <tr key={l.chave} className="align-top">
                <td className="px-4 py-2">
                  <span className="font-medium">{l.produto.descricao}</span>
                  <span className="block font-mono text-xs text-stone-500">{l.produto.codigo}</span>
                </td>
                <td className="px-2 py-2">
                  <select
                    aria-label="Unidade da nota"
                    value={l.unidadeId}
                    onChange={(e) => alterar(l.chave, { unidadeId: Number(e.target.value) })}
                    className="rounded-md border-0 py-1.5 text-sm ring-1 ring-stone-300 ring-inset"
                  >
                    {unidadesDo(l.produto).map((u) => (
                      <option key={u.id} value={u.id}>{u.sigla}{u.fator !== 1000 ? ` (${formatarQtd(u.fator)} ${l.produto.unidade.sigla})` : ''}</option>
                    ))}
                  </select>
                </td>
                <td className="w-24 px-2 py-2">
                  <input aria-label="Quantidade" inputMode="decimal" value={l.quantidade} {...(ultimo ? { 'data-ultima-qtd': true } : {})}
                    onChange={(e) => alterar(l.chave, { quantidade: e.target.value })} className={inputLinha} />
                </td>
                <td className="w-32 px-2 py-2">
                  <input aria-label="Custo unitário" inputMode="decimal" value={l.custo} placeholder={decimalParaTexto(Math.round(((l.produto.custo ?? 0) * c.u.fator) / 1000), 2)}
                    onChange={(e) => alterar(l.chave, { custo: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && busca.current?.focar()} className={inputLinha} />
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{formatarReais(c.valor)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-stone-600">
                  {c.qtdEstoque > 0 ? <>+{formatarQtd(c.qtdEstoque)} {l.produto.unidade.sigla}<span className="block text-xs">a {formatarReais(custoFinal)}</span></> : '—'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-xs">
                  <span className="text-stone-500">{formatarReais(l.produto.custo ?? 0)}</span>
                  {novoMedio != null && novoMedio !== l.produto.custo && <span className="block font-medium text-stone-900">→ {formatarReais(novoMedio)}</span>}
                </td>
                <td className="px-2 py-2">
                  <button type="button" onClick={() => setLinhas((x) => x.filter((y) => y.chave !== l.chave))} className="rounded p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-700" aria-label="Remover item">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </Tabela>
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Cartao titulo="Observações">
          <AreaTexto rotulo="Observações (opcional)" name="observacoes" />
        </Cartao>
        <Cartao titulo="Totais">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Total dos produtos</span><span className="tabular-nums">{formatarReais(totalProdutos)}</span></div>
            {(['frete', 'outrasDespesas', 'desconto'] as const).map((k) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <label htmlFor={k} className="whitespace-nowrap">{k === 'frete' ? '(+) Frete' : k === 'outrasDespesas' ? '(+) Outras despesas' : '(−) Desconto'}</label>
                <input id={k} inputMode="decimal" placeholder="0,00" value={extras[k]} onChange={(e) => setExtras((x) => ({ ...x, [k]: e.target.value }))} className={inputLinha.replace('w-full', 'w-32')} />
              </div>
            ))}
            <div className="flex justify-between border-t border-stone-200 pt-3 text-base font-semibold">
              <span>Total da nota</span><span className="tabular-nums">{formatarReais(totalProdutos + extra)}</span>
            </div>
            <p className="text-xs text-stone-500">Frete, despesas e desconto são rateados entre os itens pelo valor de cada um e entram no custo.</p>
          </div>
          <div className="mt-4 space-y-3">
            <Alerta>{erro}</Alerta>
            <Botao type="submit" className="w-full" carregando={salvar.isPending} disabled={!linhas.length}>Confirmar entrada</Botao>
          </div>
        </Cartao>
      </div>
    </form>
  );
}
