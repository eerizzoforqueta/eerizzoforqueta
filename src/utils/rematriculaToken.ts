// src/utils/rematriculaToken.ts
import jwt from 'jsonwebtoken';

const REMATRICULA_SECRET = process.env.REMATRICULA_SECRET as string;
if (!REMATRICULA_SECRET) {
  throw new Error('REMATRICULA_SECRET não definido no .env');
}

export interface RematriculaTokenPayload {
  identificadorUnico: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  anoLetivo: number; // ex: 2026
}

export function gerarTokenRematricula(payload: RematriculaTokenPayload): string {
  return jwt.sign(payload, REMATRICULA_SECRET, {
    expiresIn: '60d', // link válido por 60 dias (ajuste se quiser)
  });
}

export function validarTokenRematricula(token: string): RematriculaTokenPayload {
  const decoded = jwt.verify(token, REMATRICULA_SECRET);
  return decoded as RematriculaTokenPayload;
}
