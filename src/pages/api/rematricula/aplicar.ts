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

function birthToYYYYMMDD(birthRaw: string): { yyyymmdd: string; dd: string; mm: string; yyyy: string } | null {
  const s = String(birthRaw || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return { yyyymmdd: `${yyyy}${mm}${dd}`, dd, mm, yyyy };
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length === 8) {
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    return { yyyymmdd: `${yyyy}${mm}${dd}`, dd, mm, yyyy };
  }
  return null;
}

function makeAlunoKeySafe(cpfDigits: string, yyyymmdd: string) {
  return `${cpfDigits}_${yyyymmdd}`;
}

function makeAlunoKeyLegacy(cpfDigits: string, dd: string, mm: string, yyyy: string) {
  return `${cpfDigits}|${dd}/${mm}/${yyyy}`;
}

function alunoKeyFromAlunoObject(aluno: any): { safe: string; legacyPath: string } | null {
  const cpfDigits = digitsOnly(aluno?.informacoesAdicionais?.pagadorMensalidades?.cpf);
  const birthRaw = String(aluno?.anoNascimento || '').trim();
  if (!cpfDigits || !birthRaw) return null;
  const parsed = birthToYYYYMMDD(birthRaw);
  if (!parsed) return null;

  const safe = makeAlunoKeySafe(cpfDigits, parsed.yyyymmdd);
  const legacyPath = makeAlunoKeyLegacy(cpfDigits, parsed.dd, parsed.mm, parsed.yyyy);

  if (!isValidDbKey(safe)) return null;
  return { safe, legacyPath };
}

async function resolveTurmaUuid(modalidade: string, nomeDaTurma: string): Promise<string | null> {
  const turmasSnap = await db.ref(`modalidades/${modalidade}/turmas`).once('value');
  const turmasArr = toArrayMaybe(turmasSnap.val());
  const turma = turmasArr.find((t) => t && t.nome_da_turma === nomeDaTurma);
  const uuid = turma?.uuidTurma;
  return typeof uuid === 'string' && uuid ? uuid : null;
}

async function ensureLockOwnedOrClaim(
  ano: number,
  alunoKeySafe: string,
  alunoKeyLegacyPath: string,
  turmaUuid: string,
  remId: string,
): Promise<boolean> {
  const safeRef = db.ref(`rematriculaLocks/${ano}/${alunoKeySafe}/${turmaUuid}`);
  const legacyRef = db.ref(`rematriculaLocks/${ano}/${alunoKeyLegacyPath}/${turmaUuid}`);

  // se legacy existe e não é meu => conflito
  const legacySnap = await legacyRef.once('value');
  const legacyVal = legacySnap.val();
  if (legacyVal && String(legacyVal) !== remId) return false;

  // claim/validate safe
  const tx = await safeRef.transaction((current) => {
    if (current === null || current === undefined) return remId;
    if (String(current) === remId) return current;
    return;
  });

  if (!tx.committed) return false;

  // pós-checagem legacy
  const legacySnap2 = await legacyRef.once('value');
  const legacyVal2 = legacySnap2.val();
  if (legacyVal2 && String(legacyVal2) !== remId) {
    const safeSnap = await safeRef.once('value');
    if (String(safeSnap.val() || '') === remId) await safeRef.remove();
    return false;
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

function sameAlunoByKey(aluno: any, alunoKeySafe: string): boolean {
  const k = alunoKeyFromAlunoObject(aluno);
  return !!k && k.safe === alunoKeySafe;
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
      if ((rem.status || '') !== 'pendente') {
        skipped++;
        continue;
      }
      if ((rem.resposta || '') !== 'sim') {
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

      // 1) localizar turma origem e aluno base
      const turmasOrigSnap = await db.ref(`modalidades/${modalidadeOrigem}/turmas`).once('value');
      const turmasOrigArr = toArrayMaybe(turmasOrigSnap.val());

      const idxOrig = turmasOrigArr.findIndex((t) => t && t.nome_da_turma === nomeDaTurmaOrigem);
      if (idxOrig === -1) {
        skipped++;
        continue;
      }

      const turmaOrigAtual = turmasOrigArr[idxOrig];
      const alunosOrigArr = toArrayMaybe(turmaOrigAtual.alunos);

      const alunoBase = alunosOrigArr.find(
        (a) => a?.informacoesAdicionais?.IdentificadorUnico === identificadorUnico,
      );

      if (!alunoBase) {
        skipped++;
        continue;
      }

      // alunoKey (preferir do rem, senão derivar do aluno)
      const alunoKeyObj = rem.alunoKey
        ? { safe: String(rem.alunoKey), legacyPath: String(rem.alunoKeyRaw || '') }
        : alunoKeyFromAlunoObject(alunoBase);

      const alunoKeySafe = alunoKeyObj?.safe || null;
      const alunoKeyLegacyPath =
        alunoKeyObj?.legacyPath ||
        (alunoKeyFromAlunoObject(alunoBase)?.legacyPath ?? '');

      if (!alunoKeySafe || !isValidDbKey(alunoKeySafe)) {
        // sem chave estável, não aplica (segurança)
        skipped++;
        continue;
      }

      // 2) montar destinos com UUID (resolve se faltar)
      const destinos: Array<{ modalidade: string; turma: string; uuid: string }> = [];

      if (modalidadeDestino && turmaDestino) {
        const uuid = turmaDestinoUuid || (await resolveTurmaUuid(modalidadeDestino, turmaDestino));
        if (uuid) destinos.push({ modalidade: modalidadeDestino, turma: turmaDestino, uuid });
      }

      if (Array.isArray(turmasExtrasDestino)) {
        for (const ex of turmasExtrasDestino) {
          if (!ex?.modalidadeDestino || !ex?.turmaDestino) continue;
          const uuid = ex.turmaDestinoUuid || (await resolveTurmaUuid(ex.modalidadeDestino, ex.turmaDestino));
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

      // 3) trava por lock: só aplica se lock é meu (ou eu consigo claimar)
      for (const d of destinosUnicos) {
        const okLock = await ensureLockOwnedOrClaim(
          ano,
          alunoKeySafe,
          alunoKeyLegacyPath || makeAlunoKeyLegacy(digitsOnly(alunoBase?.informacoesAdicionais?.pagadorMensalidades?.cpf), '01', '01', '1900'),
          d.uuid,
          remId,
        );

        if (!okLock) {
          // conflito: outro link já “reservou” essa turma para este aluno
          skipped++;
          // opcional: marcar status para revisão
          await remRef.update({ status: 'pendente_conflito' }).catch(() => {});
          // pula esta rematrícula inteira
          continue;
        }
      }

      // 4) aplicar dadosAtualizados sobre aluno base
      const alunoAtualizado = aplicarDadosAtualizados(alunoBase, dadosAtualizados);

      // 5) remover da turma origem (remover TODOS com mesma alunoKeySafe para evitar duplicata por IdentificadorUnico trocado)
      const novosAlunosOrig = alunosOrigArr.filter((a) => !sameAlunoByKey(a, alunoKeySafe));

      await db.ref(`modalidades/${modalidadeOrigem}/turmas/${idxOrig}`).update({
        alunos: novosAlunosOrig,
        capacidade_atual_da_turma: novosAlunosOrig.length,
        contadorAlunos: novosAlunosOrig.length,
      });

      // 6) inserir em cada destino (evitar duplicar por alunoKeySafe)
      for (const dest of destinosUnicos) {
        const turmasDestSnap = await db.ref(`modalidades/${dest.modalidade}/turmas`).once('value');
        const turmasDestArr = toArrayMaybe(turmasDestSnap.val());
        const idxDest = turmasDestArr.findIndex((t) => t && t.uuidTurma === dest.uuid);
        if (idxDest === -1) continue;

        const turmaDestAtual = turmasDestArr[idxDest];
        const alunosDestArr = toArrayMaybe(turmaDestAtual.alunos);

        const jaExiste = alunosDestArr.some((a) => sameAlunoByKey(a, alunoKeySafe));
        if (!jaExiste) {
          alunosDestArr.push(alunoAtualizado);
        }

        await db.ref(`modalidades/${dest.modalidade}/turmas/${idxDest}`).update({
          alunos: alunosDestArr,
          capacidade_atual_da_turma: alunosDestArr.length,
          contadorAlunos: alunosDestArr.length,
        });
      }

      // 7) finaliza
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
