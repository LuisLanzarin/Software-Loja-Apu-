import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao } from '../components/ui';
import { api } from '../lib/api';
import { decimalParaTexto, lerDecimal } from '../lib/formato';

interface Configuracao {
  nomeLoja: string;
  descontoMaxSemAutorizacao: number; // pontos-base
  cancelamentoMaxSemAutorizacao: number; // centavos
  sessaoInatividadeMin: number;
}

export function Configuracoes() {
  const { data, isLoading } = useQuery({ queryKey: ['configuracao'], queryFn: () => api<Configuracao>('/configuracao') });
  if (isLoading || !data) return <Carregando />;
  return <Formulario inicial={data} />;
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
