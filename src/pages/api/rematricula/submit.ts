// pages/api/rematricula/submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';
import { validarTokenRematricula } from '@/utils/rematriculaToken';

type Data = { status: 'ok' } | { error: string };

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
  resposta,
  modalidadeDestino,
  turmaDestino,
  dadosAtualizados,
  alunoNome,
} = req.body;


    if (!token || !resposta) {
      return res
        .status(400)
        .json({ error: 'Token ou resposta ausentes.' });
    }

    const payload = validarTokenRematricula(token);
    const { identificadorUnico, modalidadeOrigem, nomeDaTurmaOrigem, anoLetivo } =
      payload;

    const db = admin.database();

    let modalidadeDestinoFinal: string | null = null;

    if (resposta === 'sim') {
      if (!modalidadeDestino) {
        return res
          .status(400)
          .json({ error: 'Modalidade de destino é obrigatória.' });
      }
      if (!turmaDestino) {
        return res
          .status(400)
          .json({ error: 'Turma de destino é obrigatória.' });
      }
      modalidadeDestinoFinal = modalidadeDestino;
    }

    // Se quer rematricular, verificar vaga usando rematriculas2026
    if (resposta === 'sim' && modalidadeDestinoFinal && turmaDestino) {
      // 1) pegar capacidade máxima da turma de destino
      const turmasRef = db.ref(`modalidades/${modalidadeDestinoFinal}/turmas`);
      const turmasSnap = await turmasRef.once('value');
      const turmasVal = turmasSnap.val() || {};

      const turmasArray: any[] = Array.isArray(turmasVal)
        ? turmasVal
        : Object.values(turmasVal);

      let capacidadeMax = 0;
      let turmaExiste = false;

      for (const turmaObj of turmasArray) {
        if (turmaObj && turmaObj.nome_da_turma === turmaDestino) {
          turmaExiste = true;
          capacidadeMax = turmaObj.capacidade_maxima_da_turma ?? 0;
          break;
        }
      }

      if (!turmaExiste) {
        return res
          .status(400)
          .json({ error: 'Turma de destino não encontrada.' });
      }

      // 2) Se capacidadeMax = 0 → sem limite / não configurado
      if (capacidadeMax > 0) {
        const remRef = db.ref(`rematriculas${anoLetivo}`);
        const remSnap = await remRef.once('value');
        const remVal = remSnap.val() || {};

        let jaRematriculados = 0;
        Object.values(remVal as any).forEach((reg: any) => {
          if (
            reg &&
            reg.resposta === 'sim' &&
            reg.turmaDestino === turmaDestino &&
            (reg.modalidadeDestino || reg.modalidadeOrigem) ===
              modalidadeDestinoFinal
          ) {
            jaRematriculados++;
          }
        });

        const temVaga = jaRematriculados < capacidadeMax;
        if (!temVaga) {
          return res.status(400).json({
            error:
              'Turma escolhida já atingiu o limite de rematrículas para 2026.',
          });
        }
      }
    }

    // Registrar rematrícula (sem aplicar ainda)
    const ref = db.ref(`rematriculas${anoLetivo}`);

        const registro = {
      identificadorUnico,
      alunoNome: alunoNome || null, // 👈 novo campo
      modalidadeOrigem,
      nomeDaTurmaOrigem,
      resposta,
      modalidadeDestino: resposta === 'sim' ? modalidadeDestinoFinal : null,
      turmaDestino: resposta === 'sim' ? turmaDestino : null,
      anoLetivo,
      timestamp: Date.now(),
      status: 'pendente',
      dadosAtualizados: dadosAtualizados || null,
    };


    await ref.child(identificadorUnico).set(registro);

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Erro ao registrar rematrícula:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao registrar rematrícula.' });
  }
}
