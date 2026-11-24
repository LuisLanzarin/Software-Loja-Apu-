import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { formatarDocumento } from '../lib/formato';
import type { Cliente } from '../lib/tipos';
import { Alerta, AreaTexto, Botao, Campo, Selecao } from './ui';

/** Formulário de cliente: usado na tela de clientes e no cadastro rápido do PDV. */
export function ClienteForm({ cliente, completo = true, aoSalvar, aoCancelar }: { cliente?: Cliente | null; completo?: boolean; aoSalvar: (c: Cliente) => void; aoCancelar: () => void }) {
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setErro('');
    setEnviando(true);
    try {
      const corpo = { ...f, ativo: f.ativo !== 'nao' };
      const c = cliente
        ? await api<Cliente>(`/clientes/${cliente.id}`, { method: 'PATCH', body: corpo })
        : await api<Cliente>('/clientes', { method: 'POST', body: corpo });
      aoSalvar(c);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const v = (k: keyof Cliente) => (cliente?.[k] as string | null) ?? '';
  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-6">
      <Campo rotulo="Nome / Razão social" name="nome" required autoFocus defaultValue={v('nome')} className="sm:col-span-4" />
      <Campo rotulo="CPF / CNPJ" name="documento" defaultValue={formatarDocumento(cliente?.documento ?? null)} className="sm:col-span-2" ajuda={completo ? undefined : 'Obrigatório para boleto.'} />
      <Campo rotulo="Telefone / WhatsApp" name="telefone" type="tel" defaultValue={v('telefone')} className="sm:col-span-3" />
      <Campo rotulo="E-mail" name="email" type="email" defaultValue={v('email')} className="sm:col-span-3" />
      {completo && (
        <>
          <Campo rotulo="CEP" name="cep" defaultValue={v('cep')} className="sm:col-span-2" />
          <Campo rotulo="Endereço" name="logradouro" defaultValue={v('logradouro')} className="sm:col-span-3" />
          <Campo rotulo="Número" name="numero" defaultValue={v('numero')} className="sm:col-span-1" />
          <Campo rotulo="Complemento" name="complemento" defaultValue={v('complemento')} className="sm:col-span-2" />
          <Campo rotulo="Bairro" name="bairro" defaultValue={v('bairro')} className="sm:col-span-2" />
          <Campo rotulo="Cidade" name="cidade" defaultValue={v('cidade')} className="sm:col-span-1" />
          <Campo rotulo="UF" name="uf" maxLength={2} defaultValue={v('uf')} className="sm:col-span-1" />
          <AreaTexto rotulo="Observações" name="observacoes" defaultValue={v('observacoes')} className="sm:col-span-6" />
          {cliente && (
            <Selecao rotulo="Situação" name="ativo" defaultValue={cliente.ativo ? 'sim' : 'nao'} className="sm:col-span-2">
              <option value="sim">Ativo</option>
              <option value="nao">Inativo</option>
            </Selecao>
          )}
        </>
      )}
      <div className="sm:col-span-6"><Alerta>{erro}</Alerta></div>
      <div className="flex justify-end gap-2 sm:col-span-6">
        <Botao type="button" variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
        <Botao type="submit" carregando={enviando}>Salvar cliente</Botao>
      </div>
    </form>
  );
}
