// src/pages/api/rematricula/excluirPendentes.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

const db = admin.database();
const ANO_PADRAO = 2026;

type Body = {
  anoLetivo?: number;
  idsSelecionados?: string[];
};

type Data =
  | { deleted: number; skipped: number }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { anoLetivo, idsSelecionados } = req.body as Body;

    if (!idsSelecionados || !Array.isArray(idsSelecionados) || !idsSelecionados.length) {
      return res
        .status(400)
        .json({ error: 'idsSelecionados é obrigatório.' });
    }

    const ano = Number(anoLetivo || ANO_PADRAO);
    const baseRef = db.ref(`rematriculas${ano}`);

    let deleted = 0;
    let skipped = 0;

    for (const id of idsSelecionados) {
      const ref = baseRef.child(id);
      const snap = await ref.once('value');

      if (!snap.exists()) {
        skipped++;
        continue;
      }

      const val = snap.val();

      // Só exclui se estiver pendente
      if (val.status && val.status !== 'pendente') {
        skipped++;
        continue;
      }

      await ref.remove();
      deleted++;
    }

    return res.status(200).json({ deleted, skipped });
  } catch (error) {
    console.error('Erro em /api/rematricula/excluirPendentes:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao excluir rematrículas pendentes.' });
  }
}
