// pages/api/rematricula/excluirNao.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';
import jwt from 'jsonwebtoken';

interface RematriculaRegistroFromDB {
  identificadorUnico: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  resposta?: 'sim' | 'nao' | string;
  status?: string;
  anoLetivo?: number;
}

type Data =
  | { deleted: number; skipped: number }
  | { error: string };

const db = admin.database();

const JWT_SECRET =
  process.env.REMATRICULA_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'rematricula-dev-secret';

function isValidDbKey(key: string): boolean {
  return !!key && !/[.#$\[\]]/.test(key);
}

/**
 * Aceita:
 * - UUID (rematriculaId)
 * - JWT (extrai payload.rematriculaId)
 */
function resolveRematriculaKey(idOrToken: string): string | null {
  if (!idOrToken) return null;

  const isJwt = idOrToken.split('.').length === 3;
  if (!isJwt) return idOrToken;

  try {
    const payload = jwt.verify(idOrToken, JWT_SECRET) as any;
    const rematriculaId = payload?.rematriculaId;
    return typeof rematriculaId === 'string' ? rematriculaId : null;
  } catch {
    return null;
  }
}

function normalizeAlunosToArray(alunosRaw: any): any[] {
  if (!alunosRaw) return [];
  if (Array.isArray(alunosRaw)) return alunosRaw.filter(Boolean);
  if (typeof alunosRaw === 'object') return Object.values(alunosRaw).filter(Boolean);
  return [];
}

/**
 * Remove o aluno da turma de origem, independente se alunos está como array ou objeto.
 * Grava de volta como ARRAY (padronizado).
 */
async function removerAlunoDaTurma(
  modalidade: string,
  nomeDaTurmaOrigem: string,
  identificadorUnico: string,
) {
  const turmaQuery = db
    .ref(`modalidades/${modalidade}/turmas`)
    .orderByChild('nome_da_turma')
    .equalTo(nomeDaTurmaOrigem);

  const snap = await turmaQuery.once('value');
  if (!snap.exists()) {
    console.warn(
      `[rematricula/excluirNao] Turma origem não encontrada: ${modalidade} / ${nomeDaTurmaOrigem}`,
    );
    return false;
  }

  const turmasData = snap.val() || {};
  const turmaKey = Object.keys(turmasData)[0];
  const turma = turmasData[turmaKey];

  const alunosArr = normalizeAlunosToArray(turma.alunos);

  const antes = alunosArr.length;
  const depoisArr = alunosArr.filter(
    (a) => a?.informacoesAdicionais?.IdentificadorUnico !== identificadorUnico,
  );

  if (depoisArr.length === antes) {
    console.warn(
      `[rematricula/excluirNao] Aluno ${identificadorUnico} não encontrado em ${modalidade}/${nomeDaTurmaOrigem}`,
    );
    return false;
  }

  await db.ref(`modalidades/${modalidade}/turmas/${turmaKey}`).update({
    alunos: depoisArr, // padroniza como array
    capacidade_atual_da_turma: depoisArr.length,
    contadorAlunos: depoisArr.length,
  });

  return true;
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
    const { anoLetivo, idsSelecionados } = req.body as {
      anoLetivo?: number;
      idsSelecionados?: string[];
    };

    const ano = Number(anoLetivo || 2026);

    // Se vier vazio, aplica a regra antiga: excluir todos "nao" pendentes.
    // Se vier com IDs, processa SOMENTE aqueles IDs.
    const idsParaProcessar: string[] = Array.isArray(idsSelecionados) ? idsSelecionados : [];

    let deleted = 0;
    let skipped = 0;

    // Caminho A: sem ids -> varre o nó todo (mantém compatibilidade)
    if (idsParaProcessar.length === 0) {
      const remSnap = await db.ref(`rematriculas${ano}`).once('value');
      const remVal = remSnap.val() || {};

      const entries = Object.entries(remVal) as Array<[string, RematriculaRegistroFromDB]>;

      for (const [rawId, reg] of entries) {
        const id = resolveRematriculaKey(rawId) ?? rawId; // aqui rawId já é key do nó (normalmente UUID)
        if (!isValidDbKey(id)) {
          skipped++;
          continue;
        }

        const resposta = reg?.resposta;
        const status = reg?.status;

        if (resposta !== 'nao' || status !== 'pendente') {
          skipped++;
          continue;
        }

        const ok = await removerAlunoDaTurma(
          reg.modalidadeOrigem,
          reg.nomeDaTurmaOrigem,
          reg.identificadorUnico,
        );

        if (!ok) {
          skipped++;
          continue;
        }

        await db.ref(`rematriculas${ano}/${id}`).update({
          status: 'nao-rematriculado',
          timestampAplicacao: Date.now(),
        });

        deleted++;
      }

      return res.status(200).json({ deleted, skipped });
    }

    // Caminho B: com ids -> resolve UUID/JWT e processa um a um
    for (const incoming of idsParaProcessar) {
      const id = resolveRematriculaKey(String(incoming || ''));

      if (!id || !isValidDbKey(id)) {
        skipped++;
        continue;
      }

      const remRef = db.ref(`rematriculas${ano}/${id}`);
      const snap = await remRef.once('value');

      if (!snap.exists()) {
        skipped++;
        continue;
      }

      const reg = snap.val() as RematriculaRegistroFromDB;

      if (reg?.resposta !== 'nao' || reg?.status !== 'pendente') {
        skipped++;
        continue;
      }

      const ok = await removerAlunoDaTurma(
        reg.modalidadeOrigem,
        reg.nomeDaTurmaOrigem,
        reg.identificadorUnico,
      );

      if (!ok) {
        skipped++;
        continue;
      }

      await remRef.update({
        status: 'nao-rematriculado',
        timestampAplicacao: Date.now(),
      });

      deleted++;
    }

    return res.status(200).json({ deleted, skipped });
  } catch (error) {
    console.error('Erro ao excluir alunos (resposta não):', error);
    return res.status(500).json({ error: 'Erro ao excluir alunos que responderam não.' });
  }
}
