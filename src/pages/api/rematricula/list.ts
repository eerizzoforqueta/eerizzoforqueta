// src/pages/api/rematricula/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

const db = admin.database();
const ANO_PADRAO = 2026;

interface ExtraDestino {
  modalidadeDestino: string;
  turmaDestino: string;
}

interface RematriculaRecordFromDB {
  anoLetivo: number;
  identificadorUnico: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  modalidadeDestino?: string | null;
  turmaDestino?: string | null;
  resposta?: string;
  status?: string;
  timestamp?: number;
  timestampResposta?: number;
  createdAt?: number;
  turmasExtrasDestino?: ExtraDestino[];
  dadosAtualizados?: any;
}

interface RespItem {
  id: string;
  identificadorUnico: string;
  alunoNome: string | null;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  modalidadeDestino: string | null;
  turmaDestino: string | null;
  resposta: string;
  status: string;
  timestamp: number;
  turmasExtrasDestino: ExtraDestino[];
}

type RespData = RespItem[] | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RespData>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res
      .status(405)
      .json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const anoLetivoParam = req.query.anoLetivo;
    const ano = Number(anoLetivoParam || ANO_PADRAO);

    // 1) Carrega rematrículas
    const snap = await db.ref(`rematriculas${ano}`).once('value');
    const val = (snap.val() as Record<string, RematriculaRecordFromDB>) || {};

    // 2) Carrega modalidades uma vez só, para descobrir o nome do aluno
    const modalidadesSnap = await db.ref('modalidades').once('value');
    const modalidadesVal = modalidadesSnap.val() || {};

    function getAlunoNome(identificadorUnico: string): string | null {
      for (const modNome of Object.keys(modalidadesVal)) {
        const mod = modalidadesVal[modNome];
        const turmasObj = mod.turmas || {};
        for (const turmaKey of Object.keys(turmasObj)) {
          const turma = turmasObj[turmaKey];
          const alunosObj = turma.alunos || {};
          for (const aKey of Object.keys(alunosObj)) {
            const a = alunosObj[aKey];
            if (
              a?.informacoesAdicionais?.IdentificadorUnico ===
              identificadorUnico
            ) {
              return a.nome || null;
            }
          }
        }
      }
      return null;
    }

    const result: RespItem[] = [];

    for (const [id, raw] of Object.entries(val)) {
      const r = raw as RematriculaRecordFromDB;

      const alunoNome = getAlunoNome(r.identificadorUnico);

      // usa timestampResposta em primeiro lugar
      const timestamp =
        r.timestampResposta ??
        r.timestamp ??
        r.createdAt ??
        0;

      result.push({
        id,
        identificadorUnico: r.identificadorUnico,
        alunoNome,
        modalidadeOrigem: r.modalidadeOrigem,
        nomeDaTurmaOrigem: r.nomeDaTurmaOrigem,
        modalidadeDestino: r.modalidadeDestino ?? null,
        turmaDestino: r.turmaDestino ?? null,
        resposta: r.resposta ?? '',
        status: r.status ?? '',
        timestamp,
        turmasExtrasDestino: r.turmasExtrasDestino || [],
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro em /api/rematricula/list:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao listar rematrículas.' });
  }
}
