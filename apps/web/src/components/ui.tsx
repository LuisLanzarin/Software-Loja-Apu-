import { Loader2, X } from 'lucide-react';
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca-600 text-white hover:bg-marca-700 focus-visible:outline-marca-600',
  secundario: 'bg-white text-stone-800 ring-1 ring-inset ring-stone-300 hover:bg-stone-50',
  perigo: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
  fantasma: 'text-stone-700 hover:bg-stone-200/70',
};

export function Botao({
  variante = 'primario',
  carregando,
  className,
  children,
  disabled,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      {...p}
      disabled={disabled || carregando}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTES[variante],
        className,
      )}
    >
      {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const estiloCampo =
  'block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-stone-900 ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-marca-600 disabled:bg-stone-100';

export function Campo({
  rotulo,
  ajuda,
  erro,
  className,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; ajuda?: ReactNode; erro?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-700">
        {rotulo}
      </label>
      <input id={id} {...p} aria-invalid={!!erro} className={cx(estiloCampo, erro && 'ring-red-500')} />
      {erro ? (
        <p className="mt-1 text-xs text-red-600">{erro}</p>
      ) : (
        ajuda && <p className="mt-1 text-xs text-stone-500">{ajuda}</p>
      )}
    </div>
  );
}

export function Selecao({
  rotulo,
  children,
  className,
  ...p
}: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-700">
        {rotulo}
      </label>
      <select id={id} {...p} className={estiloCampo}>
        {children}
      </select>
    </div>
  );
}

export function Alerta({ tipo = 'erro', children }: { tipo?: 'erro' | 'info' | 'sucesso'; children: ReactNode }) {
  if (!children) return null;
  const cores = {
    erro: 'bg-red-50 text-red-800 ring-red-200',
    info: 'bg-sky-50 text-sky-800 ring-sky-200',
    sucesso: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  };
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={cx('rounded-md px-3 py-2 text-sm ring-1 ring-inset', cores[tipo])}>
      {children}
    </div>
  );
}

export function Etiqueta({ cor = 'cinza', children }: { cor?: 'cinza' | 'verde' | 'vermelho' | 'laranja' | 'azul'; children: ReactNode }) {
  const cores = {
    cinza: 'bg-stone-100 text-stone-700 ring-stone-300',
    verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    vermelho: 'bg-red-50 text-red-700 ring-red-200',
    laranja: 'bg-marca-50 text-marca-800 ring-marca-100',
    azul: 'bg-sky-50 text-sky-700 ring-sky-200',
  };
  return <span className={cx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', cores[cor])}>{children}</span>;
}

export function Cartao({ titulo, acoes, children, className }: { titulo?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg bg-white shadow-sm ring-1 ring-stone-200', className)}>
      {(titulo || acoes) && (
        <header className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-3.5">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <div className="flex gap-2">{acoes}</div>
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-stone-600">{descricao}</p>}
      </div>
      <div className="flex gap-2">{acoes}</div>
    </div>
  );
}

/** Janela modal usando o <dialog> nativo (foco e tecla Esc já tratados pelo navegador). */
export function Janela({ aberta, aoFechar, titulo, children }: { aberta: boolean; aoFechar: () => void; titulo: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);

  return (
    <dialog ref={ref} onClose={aoFechar} className="m-auto w-full max-w-md rounded-lg p-0 shadow-xl">
      {aberta && (
        <div>
          <header className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5">
            <h2 className="text-base font-semibold">{titulo}</h2>
            <button onClick={aoFechar} className="rounded p-1 text-stone-500 hover:bg-stone-100" aria-label="Fechar">
              <X className="size-4" />
            </button>
          </header>
          <div className="p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function Carregando() {
  return (
    <div className="flex h-full min-h-40 items-center justify-center text-stone-500">
      <Loader2 className="size-6 animate-spin" aria-label="Carregando" />
    </div>
  );
}
