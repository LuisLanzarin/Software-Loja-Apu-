import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alerta, Botao, Cabecalho, Campo, Carregando, Cartao, Etiqueta, Janela, Paginacao, Tabela, Vazio } from '../../components/ui';
import { api } from '../../lib/api';
import { useCaixaAtual, type SessaoCaixa } from '../../lib/caixa';
import { formatarDataHora, formatarReais, lerDecimal } from '../../lib/formato';
import { usePode } from '../../lib/sessao';
import type { Pagina } from '../../lib/tipos';
import { AbrirCaixa } from './AbrirCaixa';
import { Conferencia, NOMES, TIPOS_CAIXA } from './Conferencia';

const FORMAS = [['DINHEIRO', 'Dinheiro contado na gaveta'], ['PIX', 'PIX (extrato)'], ['DEBITO', 'Débito (maquininha)'], ['CREDITO', 'Crédito (maquininha)']] as const;

export function Caixa() {
  const pode = usePode();
  const { data: sessao, isLoading } = useCaixaAtual();
  const [fechado, setFechado] = useState<SessaoCaixa | null>(null);

  return (
    <>
      <Cabecalho titulo="Caixa" descricao="Abertura, sangrias, suprimentos e fechamento com conferência." />
      {fechado && (
        <Cartao titulo="Caixa fechado — conferência" className="mb-6">
          <Conferencia sessao={fechado} />
        </Cartao>
      )}
      {isLoading ? <Carregando /> : sessao ? <CaixaAberto sessao={sessao} podeOperar={pode('caixa.operar')} aoFechar={setFechado} /> : pode('caixa.operar') ? (
        <Cartao titulo="Abrir caixa" className="mb-6"><AbrirCaixa /></Cartao>
      ) : (
        <Cartao className="mb-6"><p className="text-sm text-stone-600">O caixa está fechado. Só o gerente abre e fecha o caixa.</p></Cartao>
      )}
      <Historico />
    </>
  );
}

function CaixaAberto({ sessao, podeOperar, aoFechar }: { sessao: SessaoCaixa; podeOperar: boolean; aoFechar: (s: SessaoCaixa) => void }) {
  const qc = useQueryClient();
  const [janela, setJanela] = useState<'SANGRIA' | 'SUPRIMENTO' | 'FECHAR' | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setErro('');
    setEnviando(true);
    try {
      if (janela === 'FECHAR') {
        const informado: Record<string, number> = {};
        for (const [k] of FORMAS) {
          const v = lerDecimal(f[k] || '0', 2);
          if (v === null) throw new Error('Confira os valores informados.');
          informado[k] = v;
        }
        const r = await api<SessaoCaixa>('/caixa/fechar', { method: 'POST', body: { informado, observacao: f.observacao || null } });
        aoFechar(r);
      } else {
        const valor = lerDecimal(f.valor || '', 2);
        if (!valor) throw new Error('Informe o valor.');
        await api('/caixa/movimentos', { method: 'POST', body: { tipo: janela, valor, motivo: f.motivo } });
      }
      setJanela(null);
      await qc.invalidateQueries({ queryKey: ['caixa-atual'] });
      await qc.invalidateQueries({ queryKey: ['caixa-sessoes'] });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }
  const abrir = (j: typeof janela) => { setErro(''); setJanela(j); };
  const t = sessao.totais!;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Cartao><p className="text-sm text-stone-600">Aberto em</p><p className="mt-1 text-lg font-semibold">{formatarDataHora(sessao.abertoEm)}</p><p className="text-xs text-stone-500">por {sessao.usuario.nome}</p></Cartao>
        <Cartao><p className="text-sm text-stone-600">Fundo de troco</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatarReais(sessao.fundoTroco)}</p></Cartao>
        <Cartao><p className="text-sm text-stone-600">Vendas</p><p className="mt-1 text-lg font-semibold tabular-nums">{t.quantidadeVendas} · {formatarReais(t.faturamento)}</p></Cartao>
        <Cartao><p className="text-sm text-stone-600">Sangrias / suprimentos</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatarReais(-t.sangrias)} / {formatarReais(t.suprimentos)}</p></Cartao>
      </div>

      <Cartao
        titulo="Movimentos deste caixa"
        className="mb-6 overflow-hidden [&>div:last-child]:p-0"
        acoes={
          podeOperar && <>
            <Botao variante="secundario" onClick={() => abrir('SANGRIA')}><ArrowUpCircle className="size-4" aria-hidden /> Sangria</Botao>
            <Botao variante="secundario" onClick={() => abrir('SUPRIMENTO')}><ArrowDownCircle className="size-4" aria-hidden /> Suprimento</Botao>
            <Botao onClick={() => abrir('FECHAR')}><Lock className="size-4" aria-hidden /> Fechar caixa</Botao>
          </>
        }
      >
        <Tabela colunas={[{ titulo: 'Hora' }, { titulo: 'Tipo' }, { titulo: 'Forma' }, { titulo: 'Valor', direita: true }, { titulo: 'Detalhe' }]} vazio={!sessao.movimentos.length && <Vazio>Nenhum movimento ainda.</Vazio>}>
          {[...sessao.movimentos].reverse().map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-2 tabular-nums text-stone-600">{new Date(m.criadoEm).toLocaleTimeString('pt-BR')}</td>
              <td className="px-4 py-2">{TIPOS_CAIXA[m.tipo]}</td>
              <td className="px-4 py-2 text-stone-600">{NOMES[m.forma as keyof typeof NOMES] ?? m.forma}</td>
              <td className={`px-4 py-2 text-right font-medium tabular-nums ${m.valor < 0 ? 'text-red-700' : ''}`}>{formatarReais(m.valor)}</td>
              <td className="px-4 py-2 text-stone-600">{m.vendaId ? <Link to={`/vendas/${m.vendaId}`} className="text-marca-700 underline">Venda nº {m.vendaId}</Link> : m.motivo}</td>
            </tr>
          ))}
        </Tabela>
      </Cartao>

      <Janela aberta={!!janela} aoFechar={() => setJanela(null)} titulo={janela === 'FECHAR' ? 'Fechar caixa' : janela === 'SANGRIA' ? 'Sangria (retirada de dinheiro)' : 'Suprimento (reforço de troco)'}>
        <form key={janela} onSubmit={enviar} className="space-y-4">
          {janela === 'FECHAR' ? (
            <>
              <p className="text-sm text-stone-600">Conte o dinheiro e confira os relatórios da maquininha e do PIX. Informe os valores <strong>sem olhar o sistema</strong>: a diferença aparece depois.</p>
              {FORMAS.map(([k, rotulo], i) => <Campo key={k} rotulo={`${rotulo} (R$)`} name={k} inputMode="decimal" placeholder="0,00" autoFocus={i === 0} />)}
              <Campo rotulo="Observação" name="observacao" />
            </>
          ) : (
            <>
              <Campo rotulo="Valor (R$)" name="valor" inputMode="decimal" required autoFocus />
              <Campo rotulo="Motivo" name="motivo" required minLength={3} placeholder={janela === 'SANGRIA' ? 'Ex.: depósito no banco' : 'Ex.: troco extra'} />
            </>
          )}
          <Alerta>{erro}</Alerta>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setJanela(null)}>Voltar</Botao>
            <Botao type="submit" carregando={enviando}>{janela === 'FECHAR' ? 'Fechar e conferir' : 'Confirmar'}</Botao>
          </div>
        </form>
      </Janela>
    </>
  );
}

function Historico() {
  const navegar = useNavigate();
  const [pagina, setPagina] = useState(1);
  const { data } = useQuery({
    queryKey: ['caixa-sessoes', pagina],
    queryFn: () => api<Pagina<SessaoCaixa>>(`/caixa/sessoes?pagina=${pagina}`),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <Cartao titulo="Caixas anteriores" className="overflow-hidden [&>div:last-child]:p-0">
        <Tabela colunas={[{ titulo: 'Nº' }, { titulo: 'Operador' }, { titulo: 'Abertura' }, { titulo: 'Fechamento' }, { titulo: 'Diferença', direita: true }]} vazio={!data?.itens.length && <Vazio>Nenhum caixa ainda.</Vazio>}>
          {data?.itens.map((s) => {
            const dif = s.fechamento.reduce((a, f) => a + f.diferenca, 0);
            return (
              <tr key={s.id} onClick={() => navegar(`/caixa/${s.id}`)} className="cursor-pointer hover:bg-marca-50/50">
                <td className="px-4 py-2.5 font-mono text-xs">{s.id}</td>
                <td className="px-4 py-2.5">{s.usuario.nome}</td>
                <td className="px-4 py-2.5 tabular-nums">{formatarDataHora(s.abertoEm)}</td>
                <td className="px-4 py-2.5 tabular-nums">{s.fechadoEm ? formatarDataHora(s.fechadoEm) : <Etiqueta cor="verde">Aberto</Etiqueta>}</td>
                <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${dif < 0 ? 'text-red-700' : dif > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{s.status === 'FECHADO' ? formatarReais(dif) : '—'}</td>
              </tr>
            );
          })}
        </Tabela>
      </Cartao>
      {data && <Paginacao pagina={pagina} total={data.total} porPagina={data.porPagina} aoMudar={setPagina} />}
    </>
  );
}
