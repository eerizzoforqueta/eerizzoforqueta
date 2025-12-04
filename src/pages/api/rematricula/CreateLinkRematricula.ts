// src/pages/api/createLink.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const db = admin.database();
const ANO_PADRAO = 2026;

// use uma env na produção
const JWT_SECRET =
  process.env.REMATRICULA_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'rematricula-dev-secret';

type Body = {
  identificadorUnico: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  anoLetivo?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const {
      identificadorUnico,
      modalidadeOrigem,
      nomeDaTurmaOrigem,
      anoLetivo,
    } = req.body as Body;

    if (
      !identificadorUnico ||
      !modalidadeOrigem ||
      !nomeDaTurmaOrigem
    ) {
      return res.status(400).json({
        error:
          'identificadorUnico, modalidadeOrigem e nomeDaTurmaOrigem são obrigatórios.',
      });
    }

    const ano = Number(anoLetivo || ANO_PADRAO);

    // ID seguro para usar como chave no Realtime Database
    const rematriculaId = uuidv4(); // contém apenas letras, números e "-"

    // cria o registro de rematrícula (pendente) na base
    const remRef = db.ref(`rematriculas${ano}/${rematriculaId}`);
    await remRef.set({
      anoLetivo: ano,
      identificadorUnico,
      modalidadeOrigem,
      nomeDaTurmaOrigem,
      status: 'pendente',
      resposta: null,
      createdAt: Date.now(),
    });

    // token JWT só para URL / segurança
    const token = jwt.sign(
      {
        rematriculaId,
        anoLetivo: ano,
      },
      JWT_SECRET,
      {
        expiresIn: '120d', // ajuste se quiser
      },
    );

    const url = `/rematricula/${token}`;

    return res.status(200).json({ url });
  } catch (error) {
    console.error('Erro em /api/createLink:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao criar link de rematrícula.' });
  }
}
