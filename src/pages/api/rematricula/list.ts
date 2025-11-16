// pages/api/rematricula/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

interface RematriculaRegistro {
  id: string;
  identificadorUnico: string;
  alunoNome: string | null;           // 👈 novo
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  modalidadeDestino: string | null;
  turmaDestino: string | null;
  resposta: 'sim' | 'nao' | string;
  anoLetivo: number;
  timestamp: number;
  status: string;
}


type Data = RematriculaRegistro[] | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const anoLetivo = Number(req.query.anoLetivo || 2026);

    const db = admin.database();
    const snap = await db.ref(`rematriculas${anoLetivo}`).once('value');
    const val = snap.val() || {};

        const registros: RematriculaRegistro[] = Object.entries(val).map(
      ([id, reg]: any) => ({
        id,
        identificadorUnico: reg.identificadorUnico,
        alunoNome: reg.alunoNome ?? null,
        modalidadeOrigem: reg.modalidadeOrigem,
        nomeDaTurmaOrigem: reg.nomeDaTurmaOrigem,
        modalidadeDestino: reg.modalidadeDestino ?? null,
        turmaDestino: reg.turmaDestino ?? null,
        resposta: reg.resposta,
        anoLetivo: reg.anoLetivo,
        timestamp: reg.timestamp,
        status: reg.status,
      }),
    );


    return res.status(200).json(registros);
  } catch (error) {
    console.error('Erro ao listar rematrículas:', error);
    return res.status(500).json({ error: 'Erro ao listar rematrículas.' });
  }
}
