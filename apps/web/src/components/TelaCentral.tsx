import type { ReactNode } from 'react';

/** Layout das telas sem menu: primeira configuração, login e troca de senha obrigatória. */
export function TelaCentral({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center bg-noite p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo-king.jpg" alt="King Pub e Restaurante" className="mb-2 w-72" />
          <h1 className="text-xl font-semibold tracking-tight text-white">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-stone-300">{subtitulo}</p>}
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-stone-200">{children}</div>
      </div>
    </main>
  );
}
