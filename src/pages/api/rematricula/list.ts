// src/pages/api/rematricula/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

const db = admin.database();
const ANO_PADRAO = 2026;

interface ExtraDestino {
  modalidadeDestino: string;
  turmaDestino: string;
  turmaDestinoUuid?: string | null;
}

interface RematriculaRecordFromDB {
  anoLetivo: number;
  identificadorUnico: string;

  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;

  modalidadeDestino?: string | null;
  turmaDestino?: string | null;

  resposta?: string | null;
  status?: string | null;

  timestamp?: number | null; // legado
  timestampResposta?: number | null;
  timestampAplicacao?: number | null;

  createdAt?: number | null;

  turmasExtrasDestino?: ExtraDestino[] | null;
  dadosAtualizados?: any;

  alunoKey?: string | null;
  alunoKeyRaw?: string | null;
}

interface RespItem {
  id: string; // UUID (key do node)
  identificadorUnico: string;
  alunoNome: string | null;

  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;

  modalidadeDestino: string | null;
  turmaDestino: string | null;

  resposta: string; // "sim" | "nao" (aqui não volta sem resposta)
  status: string;   // "pendente" | "aplicada" | etc
  timestamp: number;

  turmasExtrasDestino: ExtraDestino[];
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

    // 1) rematrículas do ano
    const snap = await db.ref(`rematriculas${ano}`).once('value');
    const val = (snap.val() as Record<string, RematriculaRecordFromDB>) || {};

    // 2) modalidades (para index de nomes)
    const modalidadesSnap = await db.ref('modalidades').once('value');
    const modalidadesVal = modalidadesSnap.val() || {};
    const nomeIndex = buildAlunoNomeIndex(modalidadesVal);

    const result: RespItem[] = [];

    for (const [id, raw] of Object.entries(val)) {
      const r = raw as RematriculaRecordFromDB;

      const resposta = (r.resposta ?? '').toString().toLowerCase().trim();
      const status = (r.status ?? '').toString().trim();

      const respondeu =
        !!r.timestampResposta ||
        resposta === 'sim' ||
        resposta === 'nao';

      const aplicada = status === 'aplicada';

      // ✅ FILTRO PRINCIPAL:
      // só aparece no painel se foi respondida OU aplicada
      if (!respondeu && !aplicada) {
        continue;
      }

      const alunoNome = nomeIndex[r.identificadorUnico] || null;

      const timestamp =
        (r.timestampAplicacao ?? null) ||
        (r.timestampResposta ?? null) ||
        (r.timestamp ?? null) ||
        (r.createdAt ?? null) ||
        0;

      result.push({
        id,
        identificadorUnico: r.identificadorUnico,
        alunoNome,
        modalidadeOrigem: r.modalidadeOrigem,
        nomeDaTurmaOrigem: r.nomeDaTurmaOrigem,
        modalidadeDestino: r.modalidadeDestino ?? null,
        turmaDestino: r.turmaDestino ?? null,
        resposta: resposta || '-', // aqui não deve mais vir vazio (mas fica seguro)
        status: status || '',
        timestamp,
        turmasExtrasDestino: Array.isArray(r.turmasExtrasDestino)
          ? r.turmasExtrasDestino
          : [],
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
