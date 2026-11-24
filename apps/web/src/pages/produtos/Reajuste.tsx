import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Alerta, Botao, Cabecalho, Campo, Cartao, Selecao, Tabela, Vazio } from '../../components/ui';
import { api } from '../../lib/api';
import { useCategorias, useFornecedores } from '../../lib/consultas';
import { formatarReais, lerDecimal } from '../../lib/formato';

const TIPOS = {
  CUSTO_PERCENTUAL: 'O fornecedor reajustou: subir custo e preço no mesmo % (mantém a margem atual de cada produto)',
  CUSTO_PERCENTUAL_SUGERIDO: 'O fornecedor reajustou: mudar o custo em % e usar o preço sugerido pela margem desejada',
  PRECO_PERCENTUAL: 'Mudar só o preço de venda em %',
  PRECO_SUGERIDO: 'Aplicar o preço sugerido pela margem desejada (sem mudar o custo)',
} as const;
type Tipo = keyof typeof TIPOS;

interface Resultado {
  itens: { id: number; codigo: string; descricao: string; custoAntes: number; custoDepois: number; precoAntes: number; precoDepois: number }[];
  ignorados: number;
  totalAnalisados: number;
}

const variacao = (antes: number, depois: number) => {
  if (!antes) return '';
  const v = ((depois - antes) / antes) * 100;
  return `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
};

export function Reajuste() {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const { data: categorias } = useCategorias();
  const { data: fornecedores } = useFornecedores();
  const [tipo, setTipo] = useState<Tipo>('CUSTO_PERCENTUAL');
  const [pedido, setPedido] = useState<object | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [aplicado, setAplicado] = useState(false);
  const [erro, setErro] = useState('');

  const simular = useMutation({
    mutationFn: (corpo: object) => api<Resultado>('/produtos/reajuste/simular', { method: 'POST', body: corpo }),
    onSuccess: (r, corpo) => {
      setResultado(r);
      setPedido(corpo);
      setAplicado(false);
    },
    onError: (e) => setErro(e.message),
  });

  const aplicar = useMutation({
    mutationFn: () => api<Resultado>('/produtos/reajuste/aplicar', { method: 'POST', body: pedido }),
    onSuccess: async () => {
      setAplicado(true);
      await qc.invalidateQueries({ queryKey: ['produtos'] });
    },
    onError: (e) => setErro(e.message),
  });

  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErro('');
    setResultado(null);
    const f = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>;
    let percentual: number | null = null;
    if (tipo !== 'PRECO_SUGERIDO') {
      percentual = lerDecimal(f.percentual.replace('-', ''), 2);
      if (percentual === null || percentual === 0) return setErro('Informe o percentual. Ex.: 8,5 (aumento) ou -5 (redução).');
      if (f.percentual.trim().startsWith('-')) percentual = -percentual;
    }
    simular.mutate({ categoriaId: f.categoriaId ? Number(f.categoriaId) : null, fornecedorId: f.fornecedorId ? Number(f.fornecedorId) : null, tipo, percentual });
  }

  return (
    <>
      <Cabecalho
        titulo="Reajuste de preços"
        descricao="Simule primeiro, confira a lista e só então aplique. Tudo fica no histórico de cada produto."
        acoes={<Botao variante="secundario" onClick={() => navegar('/produtos')}><ArrowLeft className="size-4" aria-hidden /> Voltar</Botao>}
      />
      <Cartao className="mb-6">
        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-6">
          <Selecao rotulo="O que fazer" value={tipo} onChange={(e) => { setTipo(e.target.value as Tipo); setResultado(null); }} className="sm:col-span-6">
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selecao>
          <Selecao rotulo="Fornecedor" name="fornecedorId" className="sm:col-span-2" onChange={() => setResultado(null)}>
            <option value="">Todos</option>
            {fornecedores?.filter((f) => f.ativo).map((f) => <option key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</option>)}
          </Selecao>
          <Selecao rotulo="Categoria" name="categoriaId" className="sm:col-span-2" onChange={() => setResultado(null)}>
            <option value="">Todas</option>
            {categorias?.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Selecao>
          {tipo !== 'PRECO_SUGERIDO' && (
            <Campo rotulo="Percentual (%)" name="percentual" inputMode="decimal" placeholder="Ex.: 8,5 ou -5" className="sm:col-span-2" onChange={() => setResultado(null)} />
          )}
          <div className="flex items-end justify-end sm:col-span-6">
            <Botao type="submit" variante="secundario" carregando={simular.isPending}>Simular</Botao>
          </div>
        </form>
        {erro && <div className="mt-4"><Alerta>{erro}</Alerta></div>}
      </Cartao>

      {resultado && (
        <Cartao
          titulo={`${resultado.itens.length} produto(s) serão alterados`}
          className="overflow-hidden [&>div:last-child]:p-0"
          acoes={
            aplicado ? null : (
              <Botao disabled={!resultado.itens.length} carregando={aplicar.isPending} onClick={() => aplicar.mutate()}>
                Aplicar reajuste
              </Botao>
            )
          }
        >
          <div className="space-y-2 px-5 pt-4">
            {aplicado && <Alerta tipo="sucesso">Reajuste aplicado em {resultado.itens.length} produto(s).</Alerta>}
            {resultado.ignorados > 0 && (
              <Alerta tipo="info">{resultado.ignorados} produto(s) sem custo cadastrado foram ignorados.</Alerta>
            )}
          </div>
          <Tabela
            colunas={[{ titulo: 'Código' }, { titulo: 'Descrição' }, { titulo: 'Custo', direita: true }, { titulo: 'Preço atual', direita: true }, { titulo: 'Novo preço', direita: true }, { titulo: 'Variação', direita: true }]}
            vazio={!resultado.itens.length && <Vazio>Nenhum produto muda com esse reajuste.</Vazio>}
          >
            {resultado.itens.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2 font-mono text-xs">{i.codigo}</td>
                <td className="px-4 py-2">{i.descricao}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {i.custoAntes !== i.custoDepois && <span className="mr-1 text-stone-400 line-through">{formatarReais(i.custoAntes)}</span>}
                  {formatarReais(i.custoDepois)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-stone-500">{formatarReais(i.precoAntes)}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatarReais(i.precoDepois)}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${i.precoDepois < i.precoAntes ? 'text-red-700' : 'text-emerald-700'}`}>
                  {variacao(i.precoAntes, i.precoDepois)}
                </td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
      )}
    </>
  );
}
