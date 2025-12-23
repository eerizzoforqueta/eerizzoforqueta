// src/pages/api/rematricula/portalLookup.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const db = admin.database();

const ANO_PADRAO = 2026;

const JWT_SECRET =
  process.env.REMATRICULA_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'rematricula-dev-secret';

type Body = {
  anoLetivo?: number;
  cpfPagador: string;        // só dígitos
  dataNascimento: string;    // "DD/MM/AAAA"
};

type RematriculaResumo = {
  token: string;
  alunoNome: string | null;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  status: string;            // pendente | aplicada | ...
  resposta?: string | null;  // sim | nao | null
};

type Data =
  | { rematriculas: RematriculaResumo[] }
  | { error: string };

// -------------------- helpers --------------------

function onlyDigits(v: string) {
  return (v || '').replace(/\D/g, '');
}

function isValidDateBR(v: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(v);
}

function signToken(rematriculaId: string, anoLetivo: number) {
  return jwt.sign({ rematriculaId, anoLetivo }, JWT_SECRET, { expiresIn: '120d' });
}

// RTDB: turmas pode estar em array ou objeto
function toArrayMaybe(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'object') return Object.values(val).filter(Boolean);
  return [];
}

function keyOrigem(mod: string, turma: string) {
  return `${mod}:::${turma}`;
}

function hasResposta(rr: any) {
  return rr?.resposta === 'sim' || rr?.resposta === 'nao' || !!rr?.timestampResposta;
}

// monta um índice: (modalidade:::nomeTurma) -> uuidTurma
function buildTurmaUuidIndex(modalidadesVal: any): Record<string, string> {
  const idx: Record<string, string> = {};

  for (const modNome of Object.keys(modalidadesVal || {})) {
    const mod = modalidadesVal[modNome];
    const turmasArr = toArrayMaybe(mod?.turmas);

    for (const turma of turmasArr) {
      const nome = String(turma?.nome_da_turma || '');
      const uuid = String(turma?.uuidTurma || '');
      if (!nome || !uuid) continue;

      const k = keyOrigem(modNome, nome);
      if (!idx[k]) idx[k] = uuid;
    }
  }

  return idx;
}

// -------------------- handler --------------------

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { anoLetivo, cpfPagador, dataNascimento } = req.body as Body;
    const ano = Number(anoLetivo || ANO_PADRAO);

    const cpf = onlyDigits(cpfPagador || '');
    const dn = (dataNascimento || '').trim();

    if (cpf.length !== 11) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }
    if (!isValidDateBR(dn)) {
      return res.status(400).json({ error: 'Data de nascimento inválida (use DD/MM/AAAA).' });
    }

    // ---- 1) carrega modalidades e encontra o aluno por (cpfPagador + dataNascimento) ----
    const modalidadesSnap = await db.ref('modalidades').once('value');
    const modalidadesVal = modalidadesSnap.val() || {};

    const turmaUuidIndex = buildTurmaUuidIndex(modalidadesVal);

    let alunoNome = '';
    let identificadorUnico = '';

    // turmas atuais do aluno (todas as ocorrências do mesmo aluno em diferentes turmas)
    const turmasAtuais: Array<{
      modalidade: string;
      nome_da_turma: string;
      uuidTurma?: string;
    }> = [];

    const turmasAtuaisSet = new Set<string>();

    for (const modNome of Object.keys(modalidadesVal)) {
      const mod = modalidadesVal[modNome];
      const turmasArr = toArrayMaybe(mod?.turmas);

      for (const turma of turmasArr) {
        const nomeTurma = String(turma?.nome_da_turma || '');
        if (!nomeTurma) continue;

        const alunosArr = toArrayMaybe(turma?.alunos);

        for (const a of alunosArr) {
          const cpfA = onlyDigits(String(a?.informacoesAdicionais?.pagadorMensalidades?.cpf ?? ''));
          const nascA = String(a?.anoNascimento ?? '').trim(); // "DD/MM/AAAA"

          if (!cpfA || !nascA) continue;

          if (cpfA === cpf && nascA === dn) {
            // aluno encontrado (pode aparecer em várias turmas)
            if (!alunoNome) alunoNome = String(a?.nome || '');
            if (!identificadorUnico) {
              identificadorUnico = String(a?.informacoesAdicionais?.IdentificadorUnico || '');
            }

            const uuid = String(turma?.uuidTurma || turmaUuidIndex[keyOrigem(modNome, nomeTurma)] || '');
            const uniqK = keyOrigem(modNome, nomeTurma);
            if (!turmasAtuaisSet.has(uniqK)) {
              turmasAtuaisSet.add(uniqK);
              turmasAtuais.push({
                modalidade: modNome,
                nome_da_turma: nomeTurma,
                uuidTurma: uuid || undefined,
              });
            }
          }
        }
      }
    }

    if (!identificadorUnico) {
      return res.status(200).json({ rematriculas: [] });
    }

    // conjunto de origens atuais (para filtragem de rematrículas existentes)
    const currentOrigemKeys = new Set<string>(
      turmasAtuais.map((t) => keyOrigem(t.modalidade, t.nome_da_turma)),
    );

    // ---- 2) carrega TODAS as rematrículas do ano e filtra só as do aluno ----
    const remSnap = await db.ref(`rematriculas${ano}`).once('value');
    const remVal = remSnap.val() || {};

    const remsDoAluno: Array<{ id: string; rr: any }> = [];

    for (const [remId, rr] of Object.entries(remVal as Record<string, any>)) {
      if (rr?.identificadorUnico !== identificadorUnico) continue;
      remsDoAluno.push({ id: remId, rr });
    }

    // ---- 3) calcula DESTINOS/EXTRAS “ocupados” (locks reais) a partir das rematrículas existentes ----
    // Isso substitui rematriculaLocks para listagem (evita lock stale quando você deleta rematrículas).
    const lockedDestUuids = new Set<string>();

    for (const { rr } of remsDoAluno) {
      if (rr?.resposta !== 'sim') continue;

      // considere ativo tanto pendente quanto aplicada
      const st = String(rr?.status || '');
      if (st !== 'pendente' && st !== 'aplicada') continue;

      // principal
      const modD = rr?.modalidadeDestino;
      const turmaD = rr?.turmaDestino;
      const uuidD =
        String(rr?.turmaDestinoUuid || '') ||
        (modD && turmaD ? turmaUuidIndex[keyOrigem(String(modD), String(turmaD))] : '');

      if (uuidD) lockedDestUuids.add(uuidD);

      // extras
      if (Array.isArray(rr?.turmasExtrasDestino)) {
        for (const ex of rr.turmasExtrasDestino) {
          const exMod = ex?.modalidadeDestino;
          const exTurma = ex?.turmaDestino;

          const exUuid =
            String(ex?.turmaDestinoUuid || '') ||
            (exMod && exTurma
              ? turmaUuidIndex[keyOrigem(String(exMod), String(exTurma))]
              : '');

          if (exUuid) lockedDestUuids.add(exUuid);
        }
      }
    }

    // ---- 4) escolhe a “melhor” rematrícula existente por origem (dedupe robusto) ----
    // Se existir bug com duplicadas no mesmo origem, pegamos a mais recente.
    const bestByOrigem = new Map<string, { id: string; rr: any; ts: number }>();

    for (const { id, rr } of remsDoAluno) {
      const modO = String(rr?.modalidadeOrigem || '');
      const turmaO = String(rr?.nomeDaTurmaOrigem || '');
      if (!modO || !turmaO) continue;

      const origemK = keyOrigem(modO, turmaO);
      const ts = Number(rr?.timestampResposta ?? rr?.createdAt ?? 0);

      const cur = bestByOrigem.get(origemK);
      if (!cur || ts >= cur.ts) {
        bestByOrigem.set(origemK, { id, rr, ts });
      }
    }

    // ---- 5) monta lista final (sem “pendentes fantasmas”) ----
    const byOrigem = new Map<string, RematriculaResumo>();

    // (A) inclui rematrículas existentes APENAS se:
    // - origem ainda é uma turma atual do aluno, OU
    // - já tem resposta/timestampResposta, OU
    // - já foi aplicada
    for (const [origemK, pack] of bestByOrigem.entries()) {
      const { id, rr } = pack;

      const origemEhAtual = currentOrigemKeys.has(origemK);
      const responded = hasResposta(rr);
      const aplicada = String(rr?.status || '') === 'aplicada';

      if (!origemEhAtual && !responded && !aplicada) {
        // pendente sem resposta e origem não atual -> “fantasma”, não lista
        continue;
      }

      byOrigem.set(origemK, {
        token: signToken(id, ano),
        alunoNome: alunoNome || null,
        modalidadeOrigem: String(rr?.modalidadeOrigem || ''),
        nomeDaTurmaOrigem: String(rr?.nomeDaTurmaOrigem || ''),
        status: String(rr?.status || 'pendente'),
        resposta: rr?.resposta ?? null,
      });
    }

    // (B) cria rematrículas faltantes para turmas atuais ELEGÍVEIS
    // Regra de elegibilidade: se a turma atual for um DESTINO/EXTRA já escolhido, não cria nem lista.
    for (const t of turmasAtuais) {
      const origemK = keyOrigem(t.modalidade, t.nome_da_turma);

      if (byOrigem.has(origemK)) continue;

      const uuid = String(t.uuidTurma || turmaUuidIndex[origemK] || '');
      if (uuid && lockedDestUuids.has(uuid)) {
        // evita aparecer “turma destino” como nova origem
        continue;
      }

      const rematriculaId = uuidv4();

      await db.ref(`rematriculas${ano}/${rematriculaId}`).set({
        anoLetivo: ano,
        identificadorUnico,
        modalidadeOrigem: t.modalidade,
        nomeDaTurmaOrigem: t.nome_da_turma,
        status: 'pendente',
        createdAt: Date.now(),
      });

      byOrigem.set(origemK, {
        token: signToken(rematriculaId, ano),
        alunoNome: alunoNome || null,
        modalidadeOrigem: t.modalidade,
        nomeDaTurmaOrigem: t.nome_da_turma,
        status: 'pendente',
        resposta: null,
      });
    }

    // resposta final (ordem estável por modalidade/turma)
    const list = Array.from(byOrigem.values()).sort((a, b) => {
      const ak = keyOrigem(a.modalidadeOrigem, a.nomeDaTurmaOrigem);
      const bk = keyOrigem(b.modalidadeOrigem, b.nomeDaTurmaOrigem);
      return ak.localeCompare(bk);
    });

    return res.status(200).json({ rematriculas: list });
  } catch (err) {
    console.error('Erro em /api/rematricula/portalLookup:', err);
    return res.status(500).json({ error: 'Erro ao buscar rematrículas.' });
  }
}
