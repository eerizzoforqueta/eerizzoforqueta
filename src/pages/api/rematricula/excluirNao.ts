// pages/api/rematricula/excluirNao.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

interface RematriculaRegistro {
  id: string;
  identificadorUnico: string;
  alunoNome?: string | null;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  resposta: 'sim' | 'nao' | string;
  anoLetivo: number;
  timestamp: number;
  status: string;
}

type Data =
  | { deleted: number; skipped: number }
  | { error: string };

const db = admin.database();

// helper: remove aluno da turma de origem (igual lógica da aplicar.ts)
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

  const turmasData = snap.val();
  const turmaKey = Object.keys(turmasData)[0];
  const turma = turmasData[turmaKey];

  let alunosNode = turma.alunos || {};
  const entries = Object.entries(alunosNode as Record<string, any>);

  let alunoKey: string | null = null;

  for (const [key, val] of entries) {
    if (
      val &&
      val.informacoesAdicionais &&
      val.informacoesAdicionais.IdentificadorUnico === identificadorUnico
    ) {
      alunoKey = key;
      break;
    }
  }

  if (!alunoKey) {
    console.warn(
      `[rematricula/excluirNao] Aluno ${identificadorUnico} não encontrado em ${modalidade}/${nomeDaTurmaOrigem}`,
    );
    return false;
  }

  // remove do objeto/array
  delete alunosNode[alunoKey];

  const novaCapacidade = Math.max(
    0,
    (turma.capacidade_atual_da_turma || 0) - 1,
  );

  await db
    .ref(`modalidades/${modalidade}/turmas/${turmaKey}`)
    .update({
      alunos: alunosNode,
      capacidade_atual_da_turma: novaCapacidade,
    });

  return true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { anoLetivo, idsSelecionados } = req.body as {
      anoLetivo?: number;
      idsSelecionados?: string[];
    };

    const ano = Number(anoLetivo || 2026);

    // 1) Buscar rematriculas do ano
    const remSnap = await db.ref(`rematriculas${ano}`).once('value');
    const remVal = remSnap.val() || {};

    const registros: RematriculaRegistro[] = Object.entries(remVal).map(
      ([id, reg]: any) => ({
        id,
        identificadorUnico: reg.identificadorUnico,
        alunoNome: reg.alunoNome ?? null,
        modalidadeOrigem: reg.modalidadeOrigem,
        nomeDaTurmaOrigem: reg.nomeDaTurmaOrigem,
        resposta: reg.resposta,
        anoLetivo: reg.anoLetivo,
        timestamp: reg.timestamp,
        status: reg.status,
      }),
    );

    // 2) Candidatos: resposta "nao" + status pendente (e, se IDs enviados, só esses)
    const candidatos = registros.filter((r) => {
      if (r.resposta !== 'nao') return false;
      if (r.status !== 'pendente') return false;
      if (idsSelecionados && idsSelecionados.length > 0) {
        return idsSelecionados.includes(r.id);
      }
      return true;
    });

    if (!candidatos.length) {
      return res.status(200).json({ deleted: 0, skipped: registros.length });
    }

    let deleted = 0;
    let skipped = 0;

    for (const rem of candidatos) {
      try {
        const {
          id,
          identificadorUnico,
          modalidadeOrigem,
          nomeDaTurmaOrigem,
        } = rem;

        const ok = await removerAlunoDaTurma(
          modalidadeOrigem,
          nomeDaTurmaOrigem,
          identificadorUnico,
        );

        if (!ok) {
          skipped++;
          continue;
        }

        // Atualiza status da rematrícula
        await db
          .ref(`rematriculas${ano}/${id}/status`)
          .set('nao-rematriculado'); // ou "cancelado", como preferir

        deleted++;
      } catch (e) {
        console.error(
          '[rematricula/excluirNao] Erro ao processar registro',
          rem.id,
          e,
        );
        skipped++;
      }
    }

    return res.status(200).json({ deleted, skipped });
  } catch (error) {
    console.error('Erro ao excluir alunos (resposta não):', error);
    return res
      .status(500)
      .json({ error: 'Erro ao excluir alunos que responderam não.' });
  }
}
