// src/pages/api/rematricula/confirm.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';
import jwt from 'jsonwebtoken';

const db = admin.database();
const ANO_PADRAO = 2026;

const JWT_SECRET =
  process.env.REMATRICULA_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'rematricula-dev-secret';

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

interface RematriculaRecord {
  identificadorUnico: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  status?: string;
  resposta?: string | null;
  timestampResposta?: number | null;
  modalidadeDestino?: string | null;
  turmaDestino?: string | null;
  turmasExtrasDestino?: ExtraDestino[] | null;
}

type Body = {
  token: string; // JWT (ou UUID)
  anoLetivo?: number;
  resposta: 'sim' | 'nao';

  modalidadeDestino?: string | null;
  turmaDestino?: string | null;

  dadosAtualizados?: DadosAtualizados;
  turmasExtrasDestino?: ExtraDestino[];
};

type Data = { ok: true } | { error: string };

// RTDB não aceita esses chars em keys
function isValidDbKey(key: string): boolean {
  return !!key && !/[.#$\[\]]/.test(key);
}

function isJwtLike(v: string): boolean {
  return typeof v === 'string' && v.split('.').length === 3;
}

// token/JWT -> rematriculaId (UUID). Se vier UUID direto, aceita.
function resolveRematriculaKey(tokenOrId: string): string | null {
  if (!tokenOrId) return null;

  if (!isJwtLike(tokenOrId)) return tokenOrId;

  try {
    const payload = jwt.verify(tokenOrId, JWT_SECRET) as any;
    const rematriculaId = payload?.rematriculaId;
    return typeof rematriculaId === 'string' ? rematriculaId : null;
  } catch {
    return null;
  }
}

async function isTurmaHabilitada(
  ano: number,
  modalidade: string,
  nomeDaTurma: string,
): Promise<boolean> {
  const turmasSnap = await db.ref(`modalidades/${modalidade}/turmas`).once('value');
  const turmasVal = turmasSnap.val() || {};
  const turmasArr: any[] = Array.isArray(turmasVal) ? turmasVal : Object.values(turmasVal);

  const turma = turmasArr.find((t) => t && t.nome_da_turma === nomeDaTurma);
  const uuidTurma = turma?.uuidTurma;

  if (!uuidTurma) return false;

  const enabledSnap = await db
    .ref(`rematriculaConfig/${ano}/turmas/${uuidTurma}/enabled`)
    .once('value');

  const enabledVal = enabledSnap.val();

  // Se não houver config, considera habilitado (política atual)
  if (enabledVal === null || enabledVal === undefined) return true;

  return enabledVal === true;
}

async function alunoJaEstaNaTurma(
  identificadorUnico: string,
  modalidade: string,
  nomeDaTurma: string,
): Promise<boolean> {
  const turmasSnap = await db.ref(`modalidades/${modalidade}/turmas`).once('value');
  const turmasVal = turmasSnap.val() || {};
  const turmasArr: any[] = Array.isArray(turmasVal) ? turmasVal : Object.values(turmasVal);

  const turma = turmasArr.find((t) => t && t.nome_da_turma === nomeDaTurma);
  if (!turma) return false;

  const alunosRaw = turma.alunos || [];
  const alunosArr: any[] = Array.isArray(alunosRaw) ? alunosRaw : Object.values(alunosRaw);

  return alunosArr.some((a) => a?.informacoesAdicionais?.IdentificadorUnico === identificadorUnico);
}

async function turmaJaReservadaPorOutraRematricula(
  ano: number,
  rematriculaIdAtual: string,
  identificadorUnico: string,
  modalidade: string,
  nomeDaTurma: string,
): Promise<boolean> {
  const alvoKey = `${modalidade}:::${nomeDaTurma}`;

  const allSnap = await db.ref(`rematriculas${ano}`).once('value');
  const allVal = allSnap.val() || {};

  for (const [rid, rrAny] of Object.entries(allVal as Record<string, any>)) {
    if (rid === rematriculaIdAtual) continue;

    const rr = rrAny as any;
    if (rr?.identificadorUnico !== identificadorUnico) continue;

    const resp = (rr?.resposta || '').toString().toLowerCase();
    const status = (rr?.status || '').toString();
    const temResposta = !!rr?.timestampResposta;

    // Considera "reservada" se:
    // - aplicada OU (pendente + já respondeu)
    const reservada = status === 'aplicada' || (status === 'pendente' && temResposta && resp === 'sim');
    if (!reservada) continue;

    if (rr?.modalidadeDestino && rr?.turmaDestino) {
      const k = `${rr.modalidadeDestino}:::${rr.turmaDestino}`;
      if (k === alvoKey) return true;
    }

    if (Array.isArray(rr?.turmasExtrasDestino)) {
      for (const ex of rr.turmasExtrasDestino) {
        if (ex?.modalidadeDestino && ex?.turmaDestino) {
          const k = `${ex.modalidadeDestino}:::${ex.turmaDestino}`;
          if (k === alvoKey) return true;
        }
      }
    }
  }

  return false;
}

function validarDuplicidadesInternas(
  modalidadeDestino: string,
  turmaDestino: string,
  extras?: ExtraDestino[],
): { ok: true } | { ok: false; error: string } {
  const seen = new Set<string>();
  seen.add(`${modalidadeDestino}:::${turmaDestino}`);

  if (Array.isArray(extras)) {
    for (const ex of extras) {
      if (!ex?.modalidadeDestino || !ex?.turmaDestino) continue;
      const k = `${ex.modalidadeDestino}:::${ex.turmaDestino}`;
      if (seen.has(k)) {
        return { ok: false, error: 'Você selecionou a mesma turma mais de uma vez (principal e/ou extras).' };
      }
      seen.add(k);
    }
  }

  return { ok: true };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
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
    const rematriculaId = resolveRematriculaKey(token);

    if (!rematriculaId || !isValidDbKey(rematriculaId)) {
      return res.status(400).json({ error: 'Token/ID de rematrícula inválido.' });
    }

    const ref = db.ref(`rematriculas${ano}/${rematriculaId}`);
    const snap = await ref.once('value');

    if (!snap.exists()) {
      return res.status(404).json({ error: 'Link de rematrícula não encontrado.' });
    }

    const atual = snap.val() as RematriculaRecord;

    // 1) Se já aplicada, não permite editar
    if (atual?.status === 'aplicada') {
      return res.status(400).json({
        error: 'Esta rematrícula já foi aplicada pela administração e não pode ser alterada.',
      });
    }

    // 2) Se já respondeu (timestampResposta setado), trava edição
    if (atual?.timestampResposta) {
      return res.status(400).json({
        error:
          'Esta rematrícula já foi enviada e não pode ser editada. Caso precise corrigir, solicite à administração.',
      });
    }

    // -----------------------------
    // Validações quando resposta = "sim"
    // -----------------------------
    if (resposta === 'sim') {
      if (!modalidadeDestino || !turmaDestino) {
        return res.status(400).json({ error: 'Selecione modalidade e turma destino.' });
      }

      // A) duplicidade (principal vs extras / extras repetidos)
      const dup = validarDuplicidadesInternas(modalidadeDestino, turmaDestino, turmasExtrasDestino);
      if (!dup.ok) return res.status(400).json({ error: dup.error });

      // B) turmas habilitadas (principal e extras)
      const okPrincipal = await isTurmaHabilitada(ano, modalidadeDestino, turmaDestino);
      if (!okPrincipal) {
        return res.status(400).json({
          error: 'A turma principal selecionada não está habilitada para rematrícula.',
        });
      }

      if (Array.isArray(turmasExtrasDestino)) {
        for (const extra of turmasExtrasDestino) {
          if (!extra?.modalidadeDestino || !extra?.turmaDestino) continue;

          const okExtra = await isTurmaHabilitada(ano, extra.modalidadeDestino, extra.turmaDestino);
          if (!okExtra) {
            return res.status(400).json({
              error: `A turma extra "${extra.turmaDestino}" não está habilitada para rematrícula.`,
            });
          }
        }
      }

      // C) não permitir escolher turma que o aluno já está matriculado
      //    exceção: permitir manter a turma origem DESTE link como principal
      const identificadorUnico = atual.identificadorUnico;
      const origemMod = atual.modalidadeOrigem;
      const origemTurma = atual.nomeDaTurmaOrigem;

      const principalEhOrigem = modalidadeDestino === origemMod && turmaDestino === origemTurma;

      if (!principalEhOrigem) {
        const ja = await alunoJaEstaNaTurma(identificadorUnico, modalidadeDestino, turmaDestino);
        if (ja) {
          return res.status(400).json({
            error: 'Você já está matriculado nesta turma. Selecione outra turma principal.',
          });
        }
      }

      if (Array.isArray(turmasExtrasDestino)) {
        for (const extra of turmasExtrasDestino) {
          if (!extra?.modalidadeDestino || !extra?.turmaDestino) continue;

          const ja = await alunoJaEstaNaTurma(identificadorUnico, extra.modalidadeDestino, extra.turmaDestino);
          if (ja) {
            return res.status(400).json({
              error: `Você já está matriculado na turma extra "${extra.turmaDestino}". Escolha outra.`,
            });
          }
        }
      }

      // D) não permitir turma já reservada por outra rematrícula (pendente já respondida ou aplicada)
      const principalReservada = await turmaJaReservadaPorOutraRematricula(
        ano,
        rematriculaId,
        identificadorUnico,
        modalidadeDestino,
        turmaDestino,
      );
      if (principalReservada) {
        return res.status(400).json({
          error: 'Esta turma já foi escolhida em outra rematrícula deste aluno. Selecione outra turma.',
        });
      }

      if (Array.isArray(turmasExtrasDestino)) {
        for (const extra of turmasExtrasDestino) {
          if (!extra?.modalidadeDestino || !extra?.turmaDestino) continue;

          const reservada = await turmaJaReservadaPorOutraRematricula(
            ano,
            rematriculaId,
            identificadorUnico,
            extra.modalidadeDestino,
            extra.turmaDestino,
          );
          if (reservada) {
            return res.status(400).json({
              error: `A turma extra "${extra.turmaDestino}" já foi escolhida em outra rematrícula deste aluno. Escolha outra.`,
            });
          }
        }
      }
    }

    // -----------------------------
    // Atualização no RTDB:
    // status permanece "pendente"
    // e timestampResposta trava futuras edições
    // -----------------------------
    const updatePayload: any = {
      resposta,
      status: 'pendente',
      timestampResposta: Date.now(),
    };

    if (resposta === 'sim') {
      updatePayload.modalidadeDestino = modalidadeDestino;
      updatePayload.turmaDestino = turmaDestino;

      updatePayload.turmasExtrasDestino = Array.isArray(turmasExtrasDestino)
        ? turmasExtrasDestino.filter((e) => e?.modalidadeDestino && e?.turmaDestino)
        : null;

      updatePayload.dadosAtualizados = dadosAtualizados ?? null;
    } else {
      updatePayload.modalidadeDestino = null;
      updatePayload.turmaDestino = null;
      updatePayload.turmasExtrasDestino = null;
      updatePayload.dadosAtualizados = null;
    }

    await ref.update(updatePayload);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Erro em /api/rematricula/confirm:', error);
    return res.status(500).json({ error: 'Erro ao salvar a resposta de rematrícula.' });
  }
}
