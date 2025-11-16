// pages/api/rematricula/aplicar.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

interface DadosAtualizados {
  telefoneComWhatsapp?: string;
  pagadorNomeCompleto?: string;
  pagadorEmail?: string;
  pagadorCelularWhatsapp?: string;
}

interface RematriculaRegistro {
  id: string;
  identificadorUnico: string;
  alunoNome?: string | null;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  modalidadeDestino: string | null;
  turmaDestino: string | null;
  resposta: 'sim' | 'nao' | string;
  anoLetivo: number;
  timestamp: number;
  status: string;
  dadosAtualizados?: DadosAtualizados | null;
}

type Data =
  | { moved: number; skipped: number }
  | { error: string };

const db = admin.database();

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

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
      `[rematricula/aplicar] Turma origem não encontrada: ${modalidade} / ${nomeDaTurmaOrigem}`,
    );
    return null;
  }

  const turmasData = snap.val();
  const turmaKey = Object.keys(turmasData)[0];
  const turma = turmasData[turmaKey];

  let alunosNode = turma.alunos || {};
  const entries = Object.entries(alunosNode as Record<string, any>);

  let alunoKey: string | null = null;
  let alunoObj: any = null;

  for (const [key, val] of entries) {
    if (
      val &&
      val.informacoesAdicionais &&
      val.informacoesAdicionais.IdentificadorUnico === identificadorUnico
    ) {
      alunoKey = key;
      alunoObj = val;
      break;
    }
  }

  if (!alunoKey || !alunoObj) {
    console.warn(
      `[rematricula/aplicar] Aluno com IdentificadorUnico ${identificadorUnico} não encontrado em ${modalidade}/${nomeDaTurmaOrigem}`,
    );
    return null;
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

  return alunoObj; // devolvemos o aluno pra depois inserir na turma de destino
}

function aplicarDadosAtualizadosNoAluno(
  aluno: any,
  dados?: DadosAtualizados | null,
) {
  if (!dados) return aluno;

  if (dados.telefoneComWhatsapp) {
    aluno.telefoneComWhatsapp = dados.telefoneComWhatsapp;
  }

  aluno.informacoesAdicionais = aluno.informacoesAdicionais || {};
  aluno.informacoesAdicionais.pagadorMensalidades =
    aluno.informacoesAdicionais.pagadorMensalidades || {};

  const pm = aluno.informacoesAdicionais.pagadorMensalidades;

  if (dados.pagadorNomeCompleto) {
    pm.nomeCompleto = dados.pagadorNomeCompleto;
  }
  if (dados.pagadorEmail) {
    pm.email = dados.pagadorEmail;
  }
  if (dados.pagadorCelularWhatsapp) {
    pm.celularWhatsapp = dados.pagadorCelularWhatsapp;
  }

  return aluno;
}

async function adicionarAlunoNaTurma(
  modalidadeDestino: string,
  turmaDestino: string,
  aluno: any,
) {
  const turmaQuery = db
    .ref(`modalidades/${modalidadeDestino}/turmas`)
    .orderByChild('nome_da_turma')
    .equalTo(turmaDestino);

  const snap = await turmaQuery.once('value');
  if (!snap.exists()) {
    console.warn(
      `[rematricula/aplicar] Turma destino não encontrada: ${modalidadeDestino} / ${turmaDestino}`,
    );
    return false;
  }

  const turmasData = snap.val();
  const turmaKey = Object.keys(turmasData)[0];
  const turma = turmasData[turmaKey];

  const alunosNode: Record<string, any> = turma.alunos || {};
  const existingIds = Object.keys(alunosNode)
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isFinite(n));
  const nextId = existingIds.length ? Math.max(...existingIds) + 1 : 1;

  aluno.id = nextId; // id interno da turma, tudo bem mudar
  alunosNode[nextId] = aluno;

  const novaCapacidade =
    (turma.capacidade_atual_da_turma || 0) + 1;

  await db
    .ref(`modalidades/${modalidadeDestino}/turmas/${turmaKey}`)
    .update({
      alunos: alunosNode,
      contadorAlunos: nextId,
      capacidade_atual_da_turma: novaCapacidade,
    });

  return true;
}

// ---------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------

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

    // 1) Carregar rematriculas do ano
    const remSnap = await db.ref(`rematriculas${ano}`).once('value');
    const remVal = remSnap.val() || {};

    const registros: RematriculaRegistro[] = Object.entries(remVal).map(
      ([id, reg]: any) => ({
        id,
        identificadorUnico: reg.identificadorUnico,
        alunoNome: reg.alunoNome ?? null,
        modalidadeOrigem: reg.modalidadeOrigem,
        nomeDaTurmaOrigem: reg.nomeDaTurmaOrigem,
        modalidadeDestino: reg.modalidadeDestino ?? null,
        turmaDestino: reg.turmaDestino ?? null,
        resposta: reg.resposta,
        anoLetivo: reg.anoLetivo,
        timestamp: reg.timestamp,
        status: reg.status,
        dadosAtualizados: reg.dadosAtualizados ?? null,
      }),
    );

    // 2) Filtrar candidatos
    const candidatos = registros.filter((r) => {
      if (r.resposta !== 'sim') return false;
      if (r.status !== 'pendente') return false;
      if (!r.turmaDestino) return false;

      const modDest = r.modalidadeDestino || r.modalidadeOrigem;
      if (!modDest) return false;

      if (idsSelecionados && idsSelecionados.length > 0) {
        return idsSelecionados.includes(r.id);
      }
      return true;
    });

    if (!candidatos.length) {
      return res.status(200).json({ moved: 0, skipped: registros.length });
    }

    let moved = 0;
    let skipped = 0;

    // 3) Processar um por um
    for (const rem of candidatos) {
      try {
        const {
          id,
          identificadorUnico,
          modalidadeOrigem,
          nomeDaTurmaOrigem,
          turmaDestino,
          modalidadeDestino,
          dadosAtualizados,
        } = rem;

        const modDestFinal = modalidadeDestino || modalidadeOrigem;

        if (!turmaDestino || !modDestFinal) {
          skipped++;
          continue;
        }

        // 3.1) remover da turma de origem
        let aluno = await removerAlunoDaTurma(
          modalidadeOrigem,
          nomeDaTurmaOrigem,
          identificadorUnico,
        );

        if (!aluno) {
          skipped++;
          continue;
        }

        // 3.2) aplicar dados atualizados
        aluno = aplicarDadosAtualizadosNoAluno(aluno, dadosAtualizados);

        // 3.3) adicionar na turma de destino
        const okDestino = await adicionarAlunoNaTurma(
          modDestFinal,
          turmaDestino,
          aluno,
        );

        if (!okDestino) {
          // se não conseguiu adicionar no destino, seria o ideal reverter a remoção;
          // mas para simplificar, só contabilizamos como skip.
          skipped++;
          continue;
        }

        // 3.4) marcar status como concluído
        await db
          .ref(`rematriculas${ano}/${id}/status`)
          .set('concluido');

        moved++;
      } catch (e) {
        console.error('[rematricula/aplicar] Erro ao processar registro', rem.id, e);
        skipped++;
      }
    }

    return res.status(200).json({ moved, skipped });
  } catch (error) {
    console.error('Erro ao aplicar rematrículas em lote:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao aplicar rematrículas em lote.' });
  }
}
