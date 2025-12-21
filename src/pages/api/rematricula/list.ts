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

  resposta?: string | null;
  status?: string;

  timestamp?: number | null;
  timestampResposta?: number | null;
  createdAt?: number | null;

  turmasExtrasDestino?: ExtraDestino[] | null;
  dadosAtualizados?: any;
}

interface RespItem {
  id: string; // UUID (key do node)
  identificadorUnico: string;
  alunoNome: string | null;

  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;

  modalidadeDestino: string | null;
  turmaDestino: string | null;

  resposta: string | null; // null = sem resposta
  status: string;          // pendente | aplicada (e talvez legado)
  timestamp: number;       // para ordenar/exibir
  turmasExtrasDestino: ExtraDestino[];

  // extras úteis (não obrigatórios no front)
  respondida: boolean;
  respondidaEm: number | null;
}

type RespData = RespItem[] | { error: string };

function toArrayMaybe(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'object') return Object.values(val).filter(Boolean);
  return [];
}

function buildAlunoNomeIndex(modalidadesVal: any): Record<string, string> {
  const index: Record<string, string> = {};

  for (const modNome of Object.keys(modalidadesVal || {})) {
    const mod = modalidadesVal[modNome];
    const turmasArr = toArrayMaybe(mod?.turmas);

    for (const turma of turmasArr) {
      const alunosArr = toArrayMaybe(turma?.alunos);

      for (const a of alunosArr) {
        const idUnico = a?.informacoesAdicionais?.IdentificadorUnico;
        const nome = a?.nome;

        if (idUnico && nome && !index[idUnico]) {
          index[idUnico] = nome;
        }
      }
    }
  }

  return index;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RespData>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const ano = Number(req.query.anoLetivo || ANO_PADRAO);

    // 1) rematrículas
    const snap = await db.ref(`rematriculas${ano}`).once('value');
    const val = (snap.val() as Record<string, RematriculaRecordFromDB>) || {};

    // 2) modalidades (para index de nomes)
    const modalidadesSnap = await db.ref('modalidades').once('value');
    const modalidadesVal = modalidadesSnap.val() || {};
    const nomeIndex = buildAlunoNomeIndex(modalidadesVal);

    const result: RespItem[] = [];

    for (const [id, raw] of Object.entries(val)) {
      const r = raw as RematriculaRecordFromDB;

      const alunoNome = nomeIndex[r.identificadorUnico] || null;

      const resposta = r.resposta ?? null;
      const respondida = !!r.timestampResposta || resposta === 'sim' || resposta === 'nao';

      const timestamp =
        (r.timestampResposta ?? null) ??
        (r.createdAt ?? null) ??
        (r.timestamp ?? null) ??
        0;

      result.push({
        id,
        identificadorUnico: r.identificadorUnico,
        alunoNome,

        modalidadeOrigem: r.modalidadeOrigem,
        nomeDaTurmaOrigem: r.nomeDaTurmaOrigem,

        modalidadeDestino: r.modalidadeDestino ?? null,
        turmaDestino: r.turmaDestino ?? null,

        resposta,
        status: r.status ?? 'pendente',
        timestamp: Number(timestamp || 0),

        turmasExtrasDestino: (r.turmasExtrasDestino || []).filter(
          (e) => e?.modalidadeDestino && e?.turmaDestino,
        ) as ExtraDestino[],

        respondida,
        respondidaEm: r.timestampResposta ?? null,
      });
    }

    // mais recente primeiro
    result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro em /api/rematricula/list:', error);
    return res.status(500).json({ error: 'Erro ao listar rematrículas.' });
  }
}
