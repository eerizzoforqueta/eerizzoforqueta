// src/pages/api/rematricula/config/list-turmas.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

const db = admin.database();
const ANO_PADRAO = 2026;

type ConfigMap = Record<string, { enabled?: boolean; updatedAt?: number }>;

type Data =
  | { config: ConfigMap }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const anoLetivo = Number(req.query.anoLetivo || ANO_PADRAO);

    const snap = await db
      .ref(`rematriculaConfig/${anoLetivo}/turmas`)
      .once('value');

    const val = (snap.val() as ConfigMap) || {};

    return res.status(200).json({ config: val });
  } catch (error) {
    console.error('Erro em /api/rematricula/config/list:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao carregar config de rematrícula.' });
  }
}
