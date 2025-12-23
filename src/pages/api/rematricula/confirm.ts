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

function isValidDbKey(key: string): boolean {
  // RTDB key NÃO pode conter . # $ [ ] e também não pode conter /
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

/**
 * Normaliza data DD/MM/YYYY => YYYYMMDD (string).
 * Se vier qualquer outro formato, tenta extrair dígitos.
 */
function birthToYYYYMMDD(birthRaw: string): { yyyymmdd: string; dd: string; mm: string; yyyy: string } | null {
  const s = String(birthRaw || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return { yyyymmdd: `${yyyy}${mm}${dd}`, dd, mm, yyyy };
  }

  // fallback: pega dígitos e tenta inferir (bem conservador)
  const digits = s.replace(/\D/g, '');
  // se for ddmmyyyy (8)
  if (digits.length === 8) {
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    return { yyyymmdd: `${yyyy}${mm}${dd}`, dd, mm, yyyy };
  }

  return null;
}

function makeAlunoKeySafe(cpfDigits: string, yyyymmdd: string) {
  // somente dígitos e underscore
  return `${cpfDigits}_${yyyymmdd}`;
}

function makeAlunoKeyLegacy(cpfDigits: string, dd: string, mm: string, yyyy: string) {
  // ATENÇÃO: contém "/" e vai virar path segmentado (apenas para ler locks antigos)
  return `${cpfDigits}|${dd}/${mm}/${yyyy}`;
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
  if (enabledVal === null || enabledVal === undefined) return true; // política: sem config = habilitada
  return enabledVal === true;
}

/**
 * Busca aluno na turma de origem desta rematrícula e monta:
 * - alunoKeySafe (SEM /)
 * - alunoKeyLegacyPath (com / apenas para consultar locks antigos)
 * - alunoKeyRaw (humano)
 */
async function getAlunoIdentityFromOrigem(
  modalidadeOrigem: string,
  nomeDaTurmaOrigem: string,
  identificadorUnico: string,
): Promise<{
  cpfDigits: string;
  birthRaw: string;
  alunoKeySafe: string;
  alunoKeyRaw: string;
  alunoKeyLegacyPath: string;
} | null> {
  const turmasSnap = await db.ref(`modalidades/${modalidadeOrigem}/turmas`).once('value');
  const turmasArr = toArrayMaybe(turmasSnap.val());

  const turma = turmasArr.find((t) => t && t.nome_da_turma === nomeDaTurmaOrigem);
  if (!turma) return null;

  const alunosArr = toArrayMaybe(turma?.alunos);
  const aluno = alunosArr.find((a) => a?.informacoesAdicionais?.IdentificadorUnico === identificadorUnico);
  if (!aluno) return null;

  const cpfDigits = digitsOnly(aluno?.informacoesAdicionais?.pagadorMensalidades?.cpf);
  const birthRaw = String(aluno?.anoNascimento || '').trim();

  if (!cpfDigits || !birthRaw) return null;

  const parsed = birthToYYYYMMDD(birthRaw);
  if (!parsed) return null;

  const alunoKeySafe = makeAlunoKeySafe(cpfDigits, parsed.yyyymmdd);
  const alunoKeyRaw = `${cpfDigits}|${parsed.dd}/${parsed.mm}/${parsed.yyyy}`;
  const alunoKeyLegacyPath = makeAlunoKeyLegacy(cpfDigits, parsed.dd, parsed.mm, parsed.yyyy);

  if (!isValidDbKey(alunoKeySafe)) return null;

  return { cpfDigits, birthRaw, alunoKeySafe, alunoKeyRaw, alunoKeyLegacyPath };
}

/**
 * Lock transacional no SAFE path:
 * rematriculaLocks/{ano}/{alunoKeySafe}/{turmaUuid} = rematriculaId
 *
 * E também CHECA lock no LEGACY path (para bloquear dados antigos já gravados com "/").
 */
async function claimTurmaLock(
  ano: number,
  alunoKeySafe: string,
  alunoKeyLegacyPath: string,
  turmaUuid: string,
  rematriculaId: string,
): Promise<boolean> {
  const safeRef = db.ref(`rematriculaLocks/${ano}/${alunoKeySafe}/${turmaUuid}`);

  // legacy (pode virar path segmentado por causa do "/")
  const legacyRef = db.ref(`rematriculaLocks/${ano}/${alunoKeyLegacyPath}/${turmaUuid}`);

  // 1) checa legacy primeiro (se já existe e não é meu => bloqueia)
  const legacySnap = await legacyRef.once('value');
  const legacyVal = legacySnap.val();
  if (legacyVal && String(legacyVal) !== rematriculaId) return false;

  // 2) claim transacional no safe
  const tx = await safeRef.transaction((current) => {
    if (current === null || current === undefined) return rematriculaId;
    if (String(current) === rematriculaId) return current; // reentrância
    return; // abort
  });

  if (!tx.committed) return false;

  // 3) pós-checagem legacy (condição de corrida rara)
  const legacySnap2 = await legacyRef.once('value');
  const legacyVal2 = legacySnap2.val();
  if (legacyVal2 && String(legacyVal2) !== rematriculaId) {
    // rollback do safe
    const safeSnap = await safeRef.once('value');
    if (String(safeSnap.val() || '') === rematriculaId) await safeRef.remove();
    return false;
  }

  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
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

    const remRef = db.ref(`rematriculas${ano}/${rematriculaId}`);
    const remSnap = await remRef.once('value');

    if (!remSnap.exists()) {
      return res.status(404).json({ error: 'Link de rematrícula não encontrado.' });
    }

    const atual = remSnap.val() as any;

    // trava edição quando já enviou (enquanto pendente)
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

    if (!identificadorUnico || !modOrigem || !turmaOrigemNome) {
      return res.status(400).json({ error: 'Rematrícula inválida (dados incompletos).' });
    }

    const alunoIdentity = await getAlunoIdentityFromOrigem(modOrigem, turmaOrigemNome, identificadorUnico);
    if (!alunoIdentity) {
      return res.status(400).json({
        error:
          'Não foi possível validar CPF do pagador e data de nascimento do aluno no cadastro. ' +
          'Verifique se esses campos existem nesta turma de origem.',
      });
    }

    const { alunoKeySafe, alunoKeyLegacyPath, alunoKeyRaw } = alunoIdentity;

    // resposta "nao": só grava
    if (resposta === 'nao') {
      await remRef.update({
        resposta: 'nao',
        status: 'pendente',
        timestampResposta: Date.now(),
        alunoKey: alunoKeySafe,
        alunoKeyRaw,
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

    // dedup por UUID (principal + extras)
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

    // claim locks (SAFE) + checa legacy
    for (const uuid of Array.from(chosenUuids)) {
      const ok = await claimTurmaLock(ano, alunoKeySafe, alunoKeyLegacyPath, uuid, rematriculaId);
      if (!ok) {
        return res.status(400).json({
          error:
            'Conflito: uma das turmas selecionadas já foi escolhida em outra rematrícula pendente para este aluno.',
        });
      }
    }

    // grava rematrícula
    await remRef.update({
      resposta: 'sim',
      status: 'pendente',
      timestampResposta: Date.now(),
      alunoKey: alunoKeySafe,
      alunoKeyRaw,

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
