import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao } from '../components/ui';
import { api } from '../lib/api';
import { decimalParaTexto, formatarPct, lerDecimal } from '../lib/formato';
import { precoSugerido } from '../lib/precificacao';
import { usePode } from '../lib/sessao';

interface Configuracao {
  nomeLoja: string;
  descontoMaxSemAutorizacao: number; // pontos-base
  cancelamentoMaxSemAutorizacao: number; // centavos
  sessaoInatividadeMin: number;
  impostosPct?: number;
  despesasFixasPct?: number;
  comissaoPct?: number;
  margemPadraoPct?: number;
}

export function Configuracoes() {
  const { data, isLoading } = useQuery({ queryKey: ['configuracao'], queryFn: () => api<Configuracao>('/configuracao') });
  const pode = usePode();
  if (isLoading || !data) return <Carregando />;
  return (
    <>
      <Formulario inicial={data} />
      {pode('precificacao.editar') && data.impostosPct !== undefined && <FormacaoPreco inicial={data} />}
    </>
  );
}

function Formulario({ inicial }: { inicial: Configuracao }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const desconto = lerDecimal(f.desconto, 2);
    const cancelamento = lerDecimal(f.cancelamento, 2);
    const inatividade = Number.parseInt(f.inatividade, 10);
    if (desconto === null || desconto > 10000) return setMsg({ tipo: 'erro', texto: 'Desconto inválido: use um número entre 0 e 100.' });
    if (cancelamento === null) return setMsg({ tipo: 'erro', texto: 'Valor de cancelamento inválido. Ex.: 150,00' });

    setEnviando(true);
    try {
      await api('/configuracao', {
        method: 'PUT',
        body: {
          nomeLoja: f.nomeLoja,
          descontoMaxSemAutorizacao: desconto,
          cancelamentoMaxSemAutorizacao: cancelamento,
          sessaoInatividadeMin: inatividade,
        },
      });
      await qc.invalidateQueries();
      setMsg({ tipo: 'sucesso', texto: 'Configurações salvas.' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Cabecalho titulo="Configurações" descricao="Regras gerais da loja. Alterações ficam registradas na auditoria." />
      <form onSubmit={enviar} className="max-w-2xl space-y-6">
        <Cartao titulo="Loja">
          <Campo rotulo="Nome da loja" name="nomeLoja" required defaultValue={inicial.nomeLoja} />
        </Cartao>

        <Cartao titulo="Autorização do gerente">
          <p className="mb-4 text-sm text-stone-600">
            Abaixo destes limites o vendedor faz sozinho. Acima, o sistema pede o login e a senha de um gerente.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Desconto máximo sem autorização (%)"
              name="desconto"
              inputMode="decimal"
              required
              defaultValue={decimalParaTexto(inicial.descontoMaxSemAutorizacao, 2)}
              ajuda="Percentual sobre o valor da venda. Ex.: 5,00"
            />
            <Campo
              rotulo="Cancelamento sem autorização até (R$)"
              name="cancelamento"
              inputMode="decimal"
              required
              defaultValue={decimalParaTexto(inicial.cancelamentoMaxSemAutorizacao, 2)}
              ajuda="Vendas acima deste valor só o gerente cancela. Ex.: 100,00"
            />
          </div>
        </Cartao>

        <Cartao titulo="Segurança">
          <Campo
            rotulo="Sair automaticamente após (minutos sem uso)"
            name="inatividade"
            type="number"
            min={5}
            max={720}
            required
            defaultValue={inicial.sessaoInatividadeMin}
            className="max-w-xs"
          />
        </Cartao>

        {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
        <div className="flex justify-end">
          <Botao type="submit" carregando={enviando}>
            Salvar configurações
          </Botao>
        </div>
      </form>
    </>
  );
}

const CAMPOS_PRECO = [
  ['impostosPct', 'Impostos sobre a venda (%)', 'Ex.: Simples Nacional da sua faixa.'],
  ['despesasFixasPct', 'Despesas fixas (%)', 'Aluguel, salários, luz… divididos pelo faturamento.'],
  ['comissaoPct', 'Comissão de venda (%)', 'Zero se não paga comissão.'],
  ['margemPadraoPct', 'Margem de lucro desejada (%)', 'Padrão para produtos e categorias sem margem própria.'],
] as const;

function FormacaoPreco({ inicial }: { inicial: Configuracao }) {
  const qc = useQueryClient();
  const [valores, setValores] = useState(() =>
    Object.fromEntries(CAMPOS_PRECO.map(([k]) => [k, decimalParaTexto(inicial[k] ?? 0, 2)])) as Record<(typeof CAMPOS_PRECO)[number][0], string>,
  );
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const n = Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, lerDecimal(v || '0', 2)])) as Record<keyof typeof valores, number | null>;
  const validos = Object.values(n).every((v) => v !== null);
  const exemplo = validos
    ? precoSugerido(10000, n.margemPadraoPct!, { impostosPct: n.impostosPct!, despesasFixasPct: n.despesasFixasPct!, comissaoPct: n.comissaoPct! })
    : null;
  const total = validos ? Object.values(n).reduce((a, b) => a! + b!, 0)! : 0;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!validos) return setMsg({ tipo: 'erro', texto: 'Confira os percentuais.' });
    setEnviando(true);
    try {
      await api('/configuracao/precificacao', { method: 'PUT', body: n });
      await qc.invalidateQueries();
      setMsg({ tipo: 'sucesso', texto: 'Parâmetros de preço salvos. Os preços atuais não mudam: use “Reajustar preços” se quiser aplicar.' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-6 max-w-2xl space-y-6">
      <Cartao titulo="Formação de preço">
        <p className="mb-4 text-sm text-stone-600">
          O preço sugerido é calculado por <strong>markup divisor</strong>: preço = custo ÷ (1 − impostos − despesas − comissão − margem).
          Assim a margem é garantida depois de pagar tudo que incide sobre a venda.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CAMPOS_PRECO.map(([k, rotulo, ajuda]) => (
            <Campo key={k} rotulo={rotulo} inputMode="decimal" required value={valores[k]} onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value }))} ajuda={ajuda} />
          ))}
        </div>
        <div className="mt-4 rounded-md bg-stone-50 p-3 text-sm ring-1 ring-stone-200">
          {exemplo != null ? (
            <>Exemplo: produto com custo de <strong>R$ 100,00</strong> → preço sugerido <strong>{(exemplo / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> (total dos percentuais: {formatarPct(total)}).</>
          ) : (
            <span className="text-red-700">A soma dos percentuais precisa ser menor que 100%.</span>
          )}
        </div>
      </Cartao>
      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
      <div className="flex justify-end">
        <Botao type="submit" carregando={enviando}>Salvar formação de preço</Botao>
      </div>
    </form>
  );
}
