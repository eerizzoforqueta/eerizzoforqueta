// src/pages/api/rematricula/confirm.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

const db = admin.database();
const ANO_PADRAO = 2026;

interface ExtraDestino {
  modalidadeDestino: string;
  turmaDestino: string;
}

interface DadosAtualizados {
  telefoneAlunoOuResponsavel?: string;
  nomePagador?: string;
  emailPagador?: string;
  telefonePagador?: string;
  cpfPagador?: string;
  [key: string]: any;
}

type Body = {
  token: string;
  anoLetivo?: number;
  resposta: 'sim' | 'nao';
  modalidadeDestino?: string | null;
  turmaDestino?: string | null;
  dadosAtualizados?: DadosAtualizados;
  turmasExtrasDestino?: ExtraDestino[];
};

type Data =
  | { ok: true }
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
    const {
      token,
      anoLetivo,
      resposta,
      modalidadeDestino,
      turmaDestino,
      dadosAtualizados,
      turmasExtrasDestino,
    } = req.body as Body;

    if (!token || (resposta !== 'sim' && resposta !== 'nao')) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }

    const ano = Number(anoLetivo || ANO_PADRAO);
    const ref = db.ref(`rematriculas${ano}/${token}`);
    const snap = await ref.once('value');

    if (!snap.exists()) {
      return res
        .status(404)
        .json({ error: 'Link de rematrícula não encontrado.' });
    }

    const atual = snap.val();

    if (atual.status && atual.status !== 'pendente') {
      return res
        .status(400)
        .json({ error: 'Este link de rematrícula já foi processado.' });
    }

    const updatePayload: any = {
      resposta,
      timestampResposta: Date.now(),
    };

    if (resposta === 'sim') {
      updatePayload.status = 'pendente'; // aguardando aplicação no painel admin

      if (modalidadeDestino) updatePayload.modalidadeDestino = modalidadeDestino;
      if (turmaDestino) updatePayload.turmaDestino = turmaDestino;

      if (Array.isArray(turmasExtrasDestino)) {
        updatePayload.turmasExtrasDestino = turmasExtrasDestino.filter(
          (e) => e.modalidadeDestino && e.turmaDestino,
        );
      }

      if (dadosAtualizados) {
        updatePayload.dadosAtualizados = dadosAtualizados;
      }
    } else {
      // "não" -> continua pendente até o admin rodar a rotina de exclusão
      updatePayload.status = 'pendente';
      updatePayload.modalidadeDestino = null;
      updatePayload.turmaDestino = null;
      updatePayload.turmasExtrasDestino = null;
    }

    await ref.update(updatePayload);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Erro em /api/rematricula/confirm:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao salvar a resposta de rematrícula.' });
  }
}
