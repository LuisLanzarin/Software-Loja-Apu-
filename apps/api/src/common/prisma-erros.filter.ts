import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.ts';

/** Traduz erros do banco que escaparam das validações para respostas amigáveis. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErrosFilter implements ExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const mapa: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Já existe um cadastro com este valor.'],
      P2003: [HttpStatus.BAD_REQUEST, 'Um dos registros relacionados não existe.'],
      P2025: [HttpStatus.NOT_FOUND, 'Registro não encontrado.'],
    };
    const [status, message] = mapa[e.code] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Erro ao gravar no banco de dados.'];
    res.status(status).json({ statusCode: status, message });
  }
}
