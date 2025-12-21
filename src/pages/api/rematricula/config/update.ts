import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

const db = admin.database();
const ANO_PADRAO = 2026;

type UpdateItem = {
  uuidTurma: string;
  enabled: boolean;
};

type Body = {
  anoLetivo?: number;
  updates: UpdateItem[];
};

type Data =
  | { ok: true; updated: number }
  | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { anoLetivo, updates } = req.body as Body;
    const ano = Number(anoLetivo || ANO_PADRAO);

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates é obrigatório.' });
    }

    const payload: Record<string, any> = {};
    const now = Date.now();

    for (const item of updates) {
      if (!item?.uuidTurma) continue;
      payload[`${item.uuidTurma}/enabled`] = Boolean(item.enabled);
      payload[`${item.uuidTurma}/updatedAt`] = now;
    }

    await db.ref(`rematriculaConfig/${ano}/turmas`).update(payload);

    return res.status(200).json({ ok: true, updated: Object.keys(payload).length / 2 });
  } catch (error) {
    console.error('Erro em /api/rematricula/config/update:', error);
    return res.status(500).json({ error: 'Erro ao atualizar config de rematrícula.' });
  }
}
