export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public codigo?: string,
    /** Corpo completo da resposta de erro (ex.: motivos da autorização). */
    public dados?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Disparado quando a sessão expira no servidor; o App volta para a tela de login. */
export const EVENTO_SESSAO_EXPIRADA = 'sessao-expirada';
const ROTAS_SEM_AVISO = new Set(['/auth/eu', '/auth/entrar', '/auth/trocar-senha', '/auth/sair']);

export async function api<T = void>(caminho: string, opcoes: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    method: opcoes.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      // Exigido pelo servidor em toda alteração (proteção CSRF).
      'X-Requested-With': 'XMLHttpRequest',
      ...(opcoes.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined,
  });

  if (r.status === 204) return undefined as T;
  const dados = await r.json().catch(() => ({}));

  if (!r.ok) {
    // "/auth/eu" responde 401 quando simplesmente não há ninguém logado — não é expiração.
    if (r.status === 401 && !ROTAS_SEM_AVISO.has(caminho)) {
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
    }
    const msg = Array.isArray(dados.message) ? dados.message.join('; ') : dados.message;
    throw new ApiError(msg ?? 'Erro inesperado. Tente novamente.', r.status, dados.codigo, dados);
  }
  return dados as T;
}
