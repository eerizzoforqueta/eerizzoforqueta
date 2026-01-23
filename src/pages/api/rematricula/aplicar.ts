// src/pages/api/rematricula/aplicar.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

const db = admin.database();
const ANO_PADRAO = 2026;

interface ExtraDestino {
  modalidadeDestino: string;
  turmaDestino: string;
  turmaDestinoUuid?: string | null;
}

interface RematriculaNode {
  identificadorUnico: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;

  modalidadeDestino?: string | null;
  turmaDestino?: string | null;
  turmaDestinoUuid?: string | null;

  turmasExtrasDestino?: ExtraDestino[];

  resposta?: 'sim' | 'nao' | string | null;
  status?: string | null;

  timestampResposta?: number | null;
  dadosAtualizados?: any;

  alunoKey?: string | null;     // SAFE (cpf_yyyymmdd)
  alunoKeyRaw?: string | null;  // humano (cpf|dd/mm/yyyy)

  // (opcionais do schema novo, se existirem)
  alunoCpfPagador?: string | null;
  alunoNascimentoYYYYMMDD?: string | null;
  alunoAnoNascimento?: string | null;
}

type Body = {
  anoLetivo?: number;
  idsSelecionados: string[];
};

type Data = { moved: number; skipped: number } | { error: string };

function toArrayMaybe(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'object') return Object.values(val).filter(Boolean);
  return [];
}

function digitsOnly(v: any): string {
  return String(v ?? '').replace(/\D/g, '');
}

function isValidDbKey(key: string): boolean {
  return !!key && !/[.#$\[\]\/]/.test(key);
}

/**
 * Lê /modalidades/{mod}/turmas preservando as chaves reais (array index OU key de objeto).
 */
async function findTurmaByNome(modalidade: string, nomeDaTurma: string): Promise<{
  turmaKey: string | null;
  turmaVal: any | null;
}> {
  const snap = await db.ref(`modalidades/${modalidade}/turmas`).once('value');
  let turmaKey: string | null = null;
  let turmaVal: any | null = null;

  snap.forEach((child) => {
    const v = child.val();
    if (v && String(v?.nome_da_turma || '') === String(nomeDaTurma)) {
      turmaKey = child.key;
      turmaVal = v;
      return true; // stop
    }
    return false;
  });

  return { turmaKey, turmaVal };
}

async function findTurmaByUuid(modalidade: string, uuidTurma: string): Promise<{
  turmaKey: string | null;
  turmaVal: any | null;
}> {
  const snap = await db.ref(`modalidades/${modalidade}/turmas`).once('value');
  let turmaKey: string | null = null;
  let turmaVal: any | null = null;

  snap.forEach((child) => {
    const v = child.val();
    if (v && String(v?.uuidTurma || '') === String(uuidTurma)) {
      turmaKey = child.key;
      turmaVal = v;
      return true; // stop
    }
    return false;
  });

  return { turmaKey, turmaVal };
}

/**
 * Deriva legacyPath (cpf|dd/mm/yyyy) a partir do safe (cpf_yyyymmdd).
 * Isso evita o “01/01/1900”.
 */
function legacyPathFromSafe(alunoKeySafe: string): string | null {
  const m = String(alunoKeySafe || '').match(/^(\d{11})_(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const cpf = m[1];
  const yyyy = m[2];
  const mm = m[3];
  const dd = m[4];
  return `${cpf}|${dd}/${mm}/${yyyy}`;
}

async function resolveTurmaUuid(modalidade: string, nomeDaTurma: string): Promise<string | null> {
  const turmasSnap = await db.ref(`modalidades/${modalidade}/turmas`).once('value');
  const turmasArr = toArrayMaybe(turmasSnap.val());
  const turma = turmasArr.find((t) => t && String(t.nome_da_turma || '') === String(nomeDaTurma));
  const uuid = turma?.uuidTurma;
  return typeof uuid === 'string' && uuid ? uuid : null;
}

/**
 * Claim/valida lock no SAFE e checa LEGACY (se fornecido).
 */
async function ensureLockOwnedOrClaim(
  ano: number,
  alunoKeySafe: string,
  alunoKeyLegacyPath: string | null,
  turmaUuid: string,
  remId: string,
): Promise<boolean> {
  const safeRef = db.ref(`rematriculaLocks/${ano}/${alunoKeySafe}/${turmaUuid}`);

  // 1) checa legacy primeiro, se existir
  if (alunoKeyLegacyPath) {
    const legacyRef = db.ref(`rematriculaLocks/${ano}/${alunoKeyLegacyPath}/${turmaUuid}`);
    const legacySnap = await legacyRef.once('value');
    const legacyVal = legacySnap.val();
    if (legacyVal && String(legacyVal) !== remId) return false;
  }

  // 2) claim/validate safe
  const tx = await safeRef.transaction((current) => {
    if (current === null || current === undefined) return remId;
    if (String(current) === remId) return current;
    return; // abort
  });
  if (!tx.committed) return false;

  // 3) pós-checagem legacy (raro)
  if (alunoKeyLegacyPath) {
    const legacyRef2 = db.ref(`rematriculaLocks/${ano}/${alunoKeyLegacyPath}/${turmaUuid}`);
    const legacySnap2 = await legacyRef2.once('value');
    const legacyVal2 = legacySnap2.val();
    if (legacyVal2 && String(legacyVal2) !== remId) {
      // rollback safe
      const safeSnap = await safeRef.once('value');
      if (String(safeSnap.val() || '') === remId) await safeRef.remove();
      return false;
    }
  }

  return true;
}

function aplicarDadosAtualizados(alunoBase: any, dadosAtualizados: any): any {
  if (!dadosAtualizados) return alunoBase;

  const clone = { ...alunoBase };

  if (dadosAtualizados.telefoneAlunoOuResponsavel) {
    clone.telefoneComWhatsapp = dadosAtualizados.telefoneAlunoOuResponsavel;
  }

  clone.informacoesAdicionais = {
    ...(clone.informacoesAdicionais || {}),
    pagadorMensalidades: {
      ...(clone.informacoesAdicionais?.pagadorMensalidades || {}),
      nomeCompleto:
        dadosAtualizados.nomePagador ??
        clone.informacoesAdicionais?.pagadorMensalidades?.nomeCompleto,
      email:
        dadosAtualizados.emailPagador ??
        clone.informacoesAdicionais?.pagadorMensalidades?.email,
      celularWhatsapp:
        dadosAtualizados.telefonePagador ??
        clone.informacoesAdicionais?.pagadorMensalidades?.celularWhatsapp,
      cpf:
        dadosAtualizados.cpfPagador ??
        clone.informacoesAdicionais?.pagadorMensalidades?.cpf,
    },
  };

  return clone;
}

/**
 * Igualdade por IdentificadorUnico (fallback forte)
 */
function sameAlunoByIdentificador(aluno: any, identificadorUnico: string): boolean {
  return String(aluno?.informacoesAdicionais?.IdentificadorUnico || '') === String(identificadorUnico || '');
}

/**
 * Igualdade por alunoKeySafe (cpf_yyyymmdd) quando o aluno tem cpf+nascimento preenchidos.
 */
function alunoKeyFromAlunoObjectSafe(aluno: any): string | null {
  const cpfDigits = digitsOnly(aluno?.informacoesAdicionais?.pagadorMensalidades?.cpf);
  const birthRaw = String(aluno?.anoNascimento || '').trim();
  if (!cpfDigits || !birthRaw) return null;

  const m = birthRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3];
  const yyyymmdd = `${yyyy}${mm}${dd}`;

  return `${cpfDigits}_${yyyymmdd}`;
}

function sameAlunoByKeyOrIdent(aluno: any, alunoKeySafe: string, identificadorUnico: string): boolean {
  if (sameAlunoByIdentificador(aluno, identificadorUnico)) return true;
  const k = alunoKeyFromAlunoObjectSafe(aluno);
  return !!k && k === alunoKeySafe;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { anoLetivo, idsSelecionados } = req.body as Body;

    if (!idsSelecionados || !Array.isArray(idsSelecionados) || !idsSelecionados.length) {
      return res.status(400).json({ error: 'Nenhuma rematrícula selecionada.' });
    }

    const ano = Number(anoLetivo || ANO_PADRAO);

    let moved = 0;
    let skipped = 0;

    for (const remId of idsSelecionados.map(String)) {
      if (!remId || !isValidDbKey(remId)) {
        skipped++;
        continue;
      }

      const remRef = db.ref(`rematriculas${ano}/${remId}`);
      const remSnap = await remRef.once('value');
      if (!remSnap.exists()) {
        skipped++;
        continue;
      }

      const rem = remSnap.val() as RematriculaNode;

      // só aplica se: pendente + resposta sim + timestampResposta
      if (String(rem.status || '') !== 'pendente') {
        skipped++;
        continue;
      }
      if (String(rem.resposta || '') !== 'sim') {
        skipped++;
        continue;
      }
      if (!rem.timestampResposta) {
        skipped++;
        continue;
      }

      const {
        identificadorUnico,
        modalidadeOrigem,
        nomeDaTurmaOrigem,
        modalidadeDestino,
        turmaDestino,
        turmaDestinoUuid,
        turmasExtrasDestino,
        dadosAtualizados,
      } = rem;

      if (!identificadorUnico || !modalidadeOrigem || !nomeDaTurmaOrigem) {
        skipped++;
        continue;
      }

      // 1) localizar turma origem (por key real) e aluno base
      const { turmaKey: turmaOrigKey, turmaVal: turmaOrigVal } = await findTurmaByNome(
        modalidadeOrigem,
        nomeDaTurmaOrigem,
      );
      if (!turmaOrigKey || !turmaOrigVal) {
        skipped++;
        continue;
      }

      const alunosOrigArr = toArrayMaybe(turmaOrigVal?.alunos);

      const alunoBase = alunosOrigArr.find((a) => sameAlunoByIdentificador(a, identificadorUnico));
      if (!alunoBase) {
        // Se já não está na origem, não dá para “mover”; isso costuma acontecer quando a turma foi mexida manualmente.
        skipped++;
        continue;
      }

      // 2) alunoKeySafe e legacyPath (preferir rem, senão derivar do aluno)
      const alunoKeySafe = String(rem.alunoKey || '').trim();

      if (!alunoKeySafe || !isValidDbKey(alunoKeySafe)) {
        // sem chave estável, não aplica (segurança)
        skipped++;
        continue;
      }

      const alunoKeyLegacyPath =
        String(rem.alunoKeyRaw || '').trim() || legacyPathFromSafe(alunoKeySafe);

      // 3) montar destinos com UUID (resolve se faltar)
      const destinos: Array<{ modalidade: string; turma: string; uuid: string }> = [];

      if (modalidadeDestino && turmaDestino) {
        const uuid = String(turmaDestinoUuid || '').trim() || (await resolveTurmaUuid(modalidadeDestino, turmaDestino));
        if (uuid) destinos.push({ modalidade: modalidadeDestino, turma: turmaDestino, uuid });
      }

      if (Array.isArray(turmasExtrasDestino)) {
        for (const ex of turmasExtrasDestino) {
          if (!ex?.modalidadeDestino || !ex?.turmaDestino) continue;
          const uuid =
            String(ex.turmaDestinoUuid || '').trim() ||
            (await resolveTurmaUuid(ex.modalidadeDestino, ex.turmaDestino));
          if (!uuid) continue;
          destinos.push({ modalidade: ex.modalidadeDestino, turma: ex.turmaDestino, uuid });
        }
      }

      // dedup por uuid
      const seen = new Set<string>();
      const destinosUnicos = destinos.filter((d) => {
        if (seen.has(d.uuid)) return false;
        seen.add(d.uuid);
        return true;
      });

      if (!destinosUnicos.length) {
        skipped++;
        continue;
      }

      // 4) locks: se QUALQUER destino conflitar, ABORTA a rematrícula inteira
      let conflito = false;
      for (const d of destinosUnicos) {
        const okLock = await ensureLockOwnedOrClaim(
          ano,
          alunoKeySafe,
          alunoKeyLegacyPath || null,
          d.uuid,
          remId,
        );
        if (!okLock) {
          conflito = true;
          break;
        }
      }

      if (conflito) {
        skipped++;
        await remRef.update({ status: 'pendente_conflito' }).catch(() => {});
        continue; // aborta esta rematrícula (não move aluno)
      }

      // 5) aplica dadosAtualizados sobre aluno base
      const alunoAtualizado = aplicarDadosAtualizados(alunoBase, dadosAtualizados);

      // 6) remover da turma origem (por alunoKeySafe OU IdentificadorUnico)
      const novosAlunosOrig = alunosOrigArr.filter((a) => !sameAlunoByKeyOrIdent(a, alunoKeySafe, identificadorUnico));

      await db.ref(`modalidades/${modalidadeOrigem}/turmas/${turmaOrigKey}`).update({
        alunos: novosAlunosOrig,
        capacidade_atual_da_turma: novosAlunosOrig.length,
        contadorAlunos: novosAlunosOrig.length,
      });

      // 7) inserir em cada destino (evitar duplicar por alunoKeySafe OU IdentificadorUnico)
      for (const dest of destinosUnicos) {
        const { turmaKey: turmaDestKey, turmaVal: turmaDestVal } = await findTurmaByUuid(dest.modalidade, dest.uuid);
        if (!turmaDestKey || !turmaDestVal) continue;

        const alunosDestArr = toArrayMaybe(turmaDestVal?.alunos);

        const jaExiste = alunosDestArr.some((a) => sameAlunoByKeyOrIdent(a, alunoKeySafe, identificadorUnico));
        if (!jaExiste) {
          alunosDestArr.push(alunoAtualizado);
        }

        await db.ref(`modalidades/${dest.modalidade}/turmas/${turmaDestKey}`).update({
          alunos: alunosDestArr,
          capacidade_atual_da_turma: alunosDestArr.length,
          contadorAlunos: alunosDestArr.length,
        });
      }

      // 8) finaliza rematrícula
      await remRef.update({
        status: 'aplicada',
        timestampAplicacao: Date.now(),
      });

      moved++;
    }

    return res.status(200).json({ moved, skipped });
  } catch (error) {
    console.error('Erro em /api/rematricula/aplicar:', error);
    return res.status(500).json({ error: 'Erro ao aplicar rematrículas.' });
  }
}
