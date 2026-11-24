import { useQueryClient } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alerta, Botao, Campo } from '../../components/ui';
import { api } from '../../lib/api';
import { lerDecimal } from '../../lib/formato';

export function AbrirCaixa({ compacto }: { compacto?: boolean }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fundo = lerDecimal(String(new FormData(e.currentTarget).get('fundo') || '0'), 2);
    if (fundo === null) return setErro('Valor inválido.');
    setEnviando(true);
    try {
      await api('/caixa/abrir', { method: 'POST', body: { fundoTroco: fundo } });
      await qc.invalidateQueries({ queryKey: ['caixa-atual'] });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className={`flex flex-wrap items-end gap-3 ${compacto ? '' : 'max-w-md'}`}>
      <Campo rotulo="Fundo de troco (R$)" name="fundo" inputMode="decimal" placeholder="0,00" autoFocus={!compacto} className="w-48" ajuda="Dinheiro na gaveta ao abrir." />
      <Botao type="submit" carregando={enviando} className="mb-5">
        <Wallet className="size-4" aria-hidden /> Abrir caixa
      </Botao>
      {erro && <div className="w-full"><Alerta>{erro}</Alerta></div>}
    </form>
  );
}
