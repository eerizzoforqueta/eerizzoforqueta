// pages/api/rematricula/createLink.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { gerarTokenRematricula } from '@/utils/rematriculaToken';

type Data =
  | { url: string }
  | { error: string };

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { identificadorUnico, modalidadeOrigem, nomeDaTurmaOrigem, anoLetivo } = req.body;

    if (!identificadorUnico || !modalidadeOrigem || !nomeDaTurmaOrigem || !anoLetivo) {
      return res.status(400).json({ error: 'Dados incompletos para gerar o link de rematrícula.' });
    }

    const token = gerarTokenRematricula({
      identificadorUnico,
      modalidadeOrigem,
      nomeDaTurmaOrigem,
      anoLetivo: Number(anoLetivo),
    });

    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      return res.status(500).json({ error: 'APP_BASE_URL não configurado.' });
    }

    const url = `${baseUrl}/rematricula/${token}`;

    return res.status(200).json({ url });
  } catch (error) {
    console.error('Erro ao gerar link de rematrícula:', error);
    return res.status(500).json({ error: 'Erro ao gerar link de rematrícula.' });
  }
}
