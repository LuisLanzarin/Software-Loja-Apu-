import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';

// Argon2id com os parâmetros recomendados pela OWASP (19 MiB, 2 iterações).
const OPCOES = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const gerarHashSenha = (senha: string) => hash(senha, OPCOES);
export const verificarSenha = (hashSenha: string, senha: string) =>
  verify(hashSenha, senha).catch(() => false);

export const senhaSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres');

export const loginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'O login deve ter pelo menos 3 caracteres')
  .max(40)
  .regex(/^[a-z0-9._-]+$/, 'O login aceita apenas letras, números, ponto, hífen e sublinhado');
