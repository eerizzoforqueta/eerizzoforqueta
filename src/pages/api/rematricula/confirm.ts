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

type RespostaTipo = 'sim' | 'nao';

interface ExtraDestino {
  modalidadeDestino: string;
  turmaDestino: string;
  turmaDestinoUuid?: string;
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
  resposta: RespostaTipo;
  modalidadeDestino?: string | null;
  turmaDestino?: string | null;
  dadosAtualizados?: DadosAtualizados;
  turmasExtrasDestino?: ExtraDestino[];
};

type Data = { ok: true } | { error: string };

// ---------------- helpers ----------------

function isValidDbKey(key: string): boolean {
  return !!key && !/[.#$\[\]\/]/.test(key);
}

function toArrayMaybe(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'object') return Object.values(val).filter(Boolean);
  return [];
}

function digitsOnly(v: any): string {
  return String(v ?? '').replace(/\D/g, '');
}

function normalizeCpf11(v: any): string {
  const d = digitsOnly(v);
  if (!d) return '';
  if (d.length === 11) return d;
  if (d.length > 11) return d.slice(-11);
  return d.padStart(11, '0');
}

function resolveRematriculaKey(tokenOrId: string): string | null {
  if (!tokenOrId) return null;
  const isJwt = tokenOrId.split('.').length === 3;
  if (!isJwt) return tokenOrId;

  try {
    const payload = jwt.verify(tokenOrId, JWT_SECRET) as any;
    const rematriculaId = payload?.rematriculaId;
    return typeof rematriculaId === 'string' ? rematriculaId : null;
  } catch {
    return null;
  }
}

function birthToYYYYMMDD(birthRaw: any): { yyyymmdd: string; dd: string; mm: string; yyyy: string } | null {
  const s = String(birthRaw || '').trim();

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return { yyyymmdd: `${yyyy}${mm}${dd}`, dd, mm, yyyy };
  }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const yyyy = m[1];
    const mm = m[2];
    const dd = m[3];
    return { yyyymmdd: `${yyyy}${mm}${dd}`, dd, mm, yyyy };
  }

  const digits = s.replace(/\D/g, '');
  if (digits.length === 8) {
    if (digits.startsWith('19') || digits.startsWith('20')) {
      const yyyy = digits.slice(0, 4);
      const mm = digits.slice(4, 6);
      const dd = digits.slice(6, 8);
      return { yyyymmdd: digits, dd, mm, yyyy };
    }
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    return { yyyymmdd: `${yyyy}${mm}${dd}`, dd, mm, yyyy };
  }

  return null;
}

function makeAlunoKeySafe(cpfDigits11: string, yyyymmdd: string) {
  return `${cpfDigits11}_${yyyymmdd}`;
}

function makeAlunoKeyLegacy(cpfDigits11: string, dd: string, mm: string, yyyy: string) {
  return `${cpfDigits11}|${dd}/${mm}/${yyyy}`;
}

async function resolveTurmaUuid(modalidade: string, nomeDaTurma: string): Promise<string | null> {
  const turmasSnap = await db.ref(`modalidades/${modalidade}/turmas`).once('value');
  const turmasArr = toArrayMaybe(turmasSnap.val());
  const turma = turmasArr.find((t) => t && t.nome_da_turma === nomeDaTurma);
  const uuid = turma?.uuidTurma;
  return typeof uuid === 'string' && uuid ? uuid : null;
}

async function isTurmaHabilitadaByUuid(ano: number, uuidTurma: string): Promise<boolean> {
  const enabledSnap = await db.ref(`rematriculaConfig/${ano}/turmas/${uuidTurma}/enabled`).once('value');
  const enabledVal = enabledSnap.val();
  if (enabledVal === null || enabledVal === undefined) return false;
  return enabledVal === true;
}

/**
 * Fallback antigo: tenta ler identidade na turma de origem (pode falhar se faltam campos naquela turma)
 */
async function getAlunoIdentityFromOrigem(
  modalidadeOrigem: string,
  nomeDaTurmaOrigem: string,
  identificadorUnico: string,
) {
  const turmasSnap = await db.ref(`modalidades/${modalidadeOrigem}/turmas`).once('value');
  const turmasArr = toArrayMaybe(turmasSnap.val());

  const turma = turmasArr.find((t) => t && t.nome_da_turma === nomeDaTurmaOrigem);
  if (!turma) return null;

  const alunosArr = toArrayMaybe(turma?.alunos);
  const aluno = alunosArr.find((a) => a?.informacoesAdicionais?.IdentificadorUnico === identificadorUnico);
  if (!aluno) return null;

  const cpfDigits = normalizeCpf11(aluno?.informacoesAdicionais?.pagadorMensalidades?.cpf);
  const parsed = birthToYYYYMMDD(aluno?.anoNascimento);

  if (!cpfDigits || !parsed) return null;

  return {
    cpfDigits,
    ...parsed,
  };
}

/**
 * ✅ NOVO: obtém identidade direto do REGISTRO DA REMATRÍCULA
 * (resolve seu caso: aluno aparece em 3 turmas, mas 2 não têm cpf/data completos na turma de origem)
 */
function getAlunoIdentityFromRem(rem: any) {
  const cpf = normalizeCpf11(rem?.alunoCpfPagador || rem?.cpfPagador);
  const parsed =
    birthToYYYYMMDD(rem?.alunoNascimentoYYYYMMDD) ||
    birthToYYYYMMDD(rem?.alunoAnoNascimento) ||
    birthToYYYYMMDD(rem?.alunoDataNascimento) ||
    birthToYYYYMMDD(rem?.dataNascimento);

  if (!cpf || !parsed) return null;

  return { cpfDigits: cpf, ...parsed };
}

/**
 * Lock transacional no SAFE path:
 * rematriculaLocks/{ano}/{cpf_yyyymmdd}/{turmaUuid} = rematriculaId
 * e checa também legado (com /) só para bloquear dados antigos se existirem
 */
async function claimTurmaLock(
  ano: number,
  alunoKeySafe: string,
  alunoKeyLegacyPath: string,
  turmaUuid: string,
  rematriculaId: string,
): Promise<boolean> {
  const safeRef = db.ref(`rematriculaLocks/${ano}/${alunoKeySafe}/${turmaUuid}`);
  const legacyRef = db.ref(`rematriculaLocks/${ano}/${alunoKeyLegacyPath}/${turmaUuid}`);

  const legacySnap = await legacyRef.once('value');
  const legacyVal = legacySnap.val();
  if (legacyVal && String(legacyVal) !== rematriculaId) return false;

  const tx = await safeRef.transaction((current) => {
    if (current === null || current === undefined) return rematriculaId;
    if (String(current) === rematriculaId) return current;
    return; // abort
  });

  if (!tx.committed) return false;

  const legacySnap2 = await legacyRef.once('value');
  const legacyVal2 = legacySnap2.val();
  if (legacyVal2 && String(legacyVal2) !== rematriculaId) {
    const safeSnap = await safeRef.once('value');
    if (String(safeSnap.val() || '') === rematriculaId) await safeRef.remove();
    return false;
  }

  return true;
}

// ---------------- handler ----------------

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { token, anoLetivo, resposta, modalidadeDestino, turmaDestino, dadosAtualizados, turmasExtrasDestino } =
      req.body as Body;

    if (!token || (resposta !== 'sim' && resposta !== 'nao')) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }

    const ano = Number(anoLetivo || ANO_PADRAO);

    const rematriculaId = resolveRematriculaKey(token);
    if (!rematriculaId || !isValidDbKey(rematriculaId)) {
      return res.status(400).json({ error: 'Token/ID de rematrícula inválido.' });
    }

    const remRef = db.ref(`rematriculas${ano}/${rematriculaId}`);
    const remSnap = await remRef.once('value');

    if (!remSnap.exists()) {
      return res.status(404).json({ error: 'Link de rematrícula não encontrado.' });
    }

    const atual = remSnap.val() as any;

    if (atual?.timestampResposta) {
      return res.status(400).json({
        error: 'Esta rematrícula já foi enviada e está em análise. Não é possível editar.',
      });
    }

    if (String(atual?.status || '') === 'aplicada') {
      return res.status(400).json({ error: 'Esta rematrícula já foi aplicada.' });
    }

    const identificadorUnico = String(atual?.identificadorUnico || '');
    const modOrigem = String(atual?.modalidadeOrigem || '');
    const turmaOrigemNome = String(atual?.nomeDaTurmaOrigem || '');

    if (!modOrigem || !turmaOrigemNome) {
      return res.status(400).json({ error: 'Rematrícula inválida (dados incompletos).' });
    }

    // ✅ pega identidade preferencialmente do próprio registro (salvo no portalLookup)
    let identity = getAlunoIdentityFromRem(atual);

    // fallback antigo (apenas se precisar)
    if (!identity && identificadorUnico) {
      identity = await getAlunoIdentityFromOrigem(modOrigem, turmaOrigemNome, identificadorUnico);
    }

    if (!identity) {
      return res.status(400).json({
        error:
          'Não foi possível validar CPF do pagador e data de nascimento do aluno. ' +
          'Esse aluno provavelmente está sem IdentificadorUnico e/ou sem CPF/data em alguma turma.',
      });
    }

    const { cpfDigits, yyyymmdd, dd, mm, yyyy } = identity;

    const alunoKeySafe = makeAlunoKeySafe(cpfDigits, yyyymmdd);
    const alunoKeyLegacyPath = makeAlunoKeyLegacy(cpfDigits, dd, mm, yyyy);

    // resposta "nao"
    if (resposta === 'nao') {
      await remRef.update({
        resposta: 'nao',
        status: 'pendente',
        timestampResposta: Date.now(),

        // ✅ persistimos identidade
        alunoCpfPagador: cpfDigits,
        alunoNascimentoYYYYMMDD: yyyymmdd,
        alunoAnoNascimento: `${dd}/${mm}/${yyyy}`,
        alunoKey: alunoKeySafe,

        modalidadeDestino: null,
        turmaDestino: null,
        turmaDestinoUuid: null,
        turmasExtrasDestino: [],
        dadosAtualizados: null,
      });

      return res.status(200).json({ ok: true });
    }

    // resposta "sim": valida seleção principal
    if (!modalidadeDestino || !turmaDestino) {
      return res.status(400).json({ error: 'Selecione modalidade e turma principal.' });
    }

    const principalUuid = await resolveTurmaUuid(modalidadeDestino, turmaDestino);
    if (!principalUuid) {
      return res.status(400).json({ error: 'Turma principal inválida (uuidTurma não encontrado).' });
    }

    const okPrincipal = await isTurmaHabilitadaByUuid(ano, principalUuid);
    if (!okPrincipal) {
      return res.status(400).json({ error: 'A turma principal não está habilitada para rematrícula.' });
    }

    // extras: resolve uuid obrigatório
    const extrasNormalizados: ExtraDestino[] = [];
    if (Array.isArray(turmasExtrasDestino)) {
      for (const ex of turmasExtrasDestino) {
        if (!ex?.modalidadeDestino || !ex?.turmaDestino) continue;

        const exUuid = await resolveTurmaUuid(ex.modalidadeDestino, ex.turmaDestino);
        if (!exUuid) {
          return res.status(400).json({
            error: `Turma extra inválida (uuidTurma não encontrado): ${ex.modalidadeDestino} - ${ex.turmaDestino}`,
          });
        }

        const okExtra = await isTurmaHabilitadaByUuid(ano, exUuid);
        if (!okExtra) {
          return res.status(400).json({
            error: `Turma extra não habilitada: ${ex.modalidadeDestino} - ${ex.turmaDestino}`,
          });
        }

        extrasNormalizados.push({
          modalidadeDestino: ex.modalidadeDestino,
          turmaDestino: ex.turmaDestino,
          turmaDestinoUuid: exUuid,
        });
      }
    }

    // dedup por UUID
    const chosenUuids = new Set<string>();
    chosenUuids.add(principalUuid);

    for (const ex of extrasNormalizados) {
      const u = String(ex.turmaDestinoUuid || '');
      if (!u) continue;
      if (chosenUuids.has(u)) {
        return res.status(400).json({
          error: 'Você selecionou a mesma turma mais de uma vez (principal e/ou extras).',
        });
      }
      chosenUuids.add(u);
    }

    // claim locks
    for (const uuid of Array.from(chosenUuids)) {
      const ok = await claimTurmaLock(ano, alunoKeySafe, alunoKeyLegacyPath, uuid, rematriculaId);
      if (!ok) {
        return res.status(400).json({
          error:
            'Conflito: uma das turmas selecionadas já foi escolhida em outra rematrícula pendente para este aluno.',
        });
      }
    }

    // grava
    await remRef.update({
      resposta: 'sim',
      status: 'pendente',
      timestampResposta: Date.now(),

      // ✅ persistimos identidade
      alunoCpfPagador: cpfDigits,
      alunoNascimentoYYYYMMDD: yyyymmdd,
      alunoAnoNascimento: `${dd}/${mm}/${yyyy}`,
      alunoKey: alunoKeySafe,

      modalidadeDestino,
      turmaDestino,
      turmaDestinoUuid: principalUuid,

      turmasExtrasDestino: extrasNormalizados,
      dadosAtualizados: dadosAtualizados || null,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Erro em /api/rematricula/confirm:', error);
    return res.status(500).json({ error: 'Erro ao salvar a resposta de rematrícula.' });
  }
}
