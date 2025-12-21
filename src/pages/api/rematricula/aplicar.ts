// src/pages/api/rematricula/aplicar.ts
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

interface RematriculaNode {
  identificadorUnico: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;

  modalidadeDestino?: string | null;
  turmaDestino?: string | null;
  turmasExtrasDestino?: ExtraDestino[] | null;

  resposta?: 'sim' | 'nao' | string | null;
  status?: string;

  timestampResposta?: number | null;
  dadosAtualizados?: any;
}

type Body = {
  anoLetivo?: number;
  idsSelecionados: string[];
};

type Data = { moved: number; skipped: number } | { error: string };

// --- Helper: sempre retorna alunos como array ---
function normalizeAlunosToArray(alunosRaw: any): any[] {
  if (!alunosRaw) return [];
  if (Array.isArray(alunosRaw)) return alunosRaw.filter(Boolean);
  if (typeof alunosRaw === 'object') return Object.values(alunosRaw).filter(Boolean);
  return [];
}

// --- Helper: aplica dadosAtualizados em cima do aluno base ---
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

// --- resolve UUID mesmo se vier JWT ---
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

// --- valida key segura (evita caracteres proibidos) ---
function isValidDbKey(key: string): boolean {
  return !!key && !/[.#$\[\]]/.test(key);
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
    const { anoLetivo, idsSelecionados } = req.body as Body;

    if (!idsSelecionados || !Array.isArray(idsSelecionados) || !idsSelecionados.length) {
      return res.status(400).json({ error: 'Nenhuma rematrícula selecionada.' });
    }

    const ano = Number(anoLetivo || ANO_PADRAO);

    let moved = 0;
    let skipped = 0;

    for (const incomingId of idsSelecionados) {
      const id = resolveRematriculaKey(String(incomingId || ''));
      if (!id || !isValidDbKey(id)) {
        skipped++;
        continue;
      }

      const remRef = db.ref(`rematriculas${ano}/${id}`);
      const remSnap = await remRef.once('value');

      if (!remSnap.exists()) {
        skipped++;
        continue;
      }

      const rem = remSnap.val() as RematriculaNode;

      const status = (rem.status || '').toString();
      const resposta = (rem.resposta || '').toString().toLowerCase();
      const respondeu = !!rem.timestampResposta;

      // Regra final:
      // - Só aplica se já respondeu "sim" e ainda estiver pendente (ou legado "respondida")
      const statusAceito = status === 'pendente' || status === 'respondida';
      if (!statusAceito || resposta !== 'sim' || !respondeu) {
        skipped++;
        continue;
      }

      const {
        identificadorUnico,
        modalidadeOrigem,
        nomeDaTurmaOrigem,
        modalidadeDestino,
        turmaDestino,
        turmasExtrasDestino,
        dadosAtualizados,
      } = rem;

      if (!identificadorUnico || !modalidadeOrigem || !nomeDaTurmaOrigem) {
        skipped++;
        continue;
      }

      // 1) Localizar turma de origem
      const turmasOrigSnap = await db.ref(`modalidades/${modalidadeOrigem}/turmas`).once('value');
      const turmasOrigVal = turmasOrigSnap.val() || [];
      const turmasOrigArr: any[] = Array.isArray(turmasOrigVal)
        ? turmasOrigVal
        : Object.values(turmasOrigVal);

      const idxOrig = turmasOrigArr.findIndex(
        (t) => t && t.nome_da_turma === nomeDaTurmaOrigem,
      );

      if (idxOrig === -1) {
        skipped++;
        continue;
      }

      const turmaOrigAtual = turmasOrigArr[idxOrig];
      const alunosOrigArr = normalizeAlunosToArray(turmaOrigAtual.alunos);

      const alunoIndex = alunosOrigArr.findIndex(
        (a) => a?.informacoesAdicionais?.IdentificadorUnico === identificadorUnico,
      );

      if (alunoIndex === -1) {
        skipped++;
        continue;
      }

      const alunoBase = alunosOrigArr[alunoIndex];
      const alunoAtualizado = aplicarDadosAtualizados(alunoBase, dadosAtualizados);

      // 2) Remover da origem (exceto se destino principal for a mesma turma)
      const manterNaOrigem =
        modalidadeDestino === modalidadeOrigem &&
        turmaDestino === nomeDaTurmaOrigem;

      let novosAlunosOrig = alunosOrigArr;

      if (!manterNaOrigem) {
        novosAlunosOrig = alunosOrigArr.filter(
          (a) => a?.informacoesAdicionais?.IdentificadorUnico !== identificadorUnico,
        );
      }

      await db.ref(`modalidades/${modalidadeOrigem}/turmas/${idxOrig}`).update({
        alunos: novosAlunosOrig,
        capacidade_atual_da_turma: novosAlunosOrig.length,
        contadorAlunos: novosAlunosOrig.length,
      });

      // 3) Destinos (principal + extras)
      const destinos: ExtraDestino[] = [];

      if (modalidadeDestino && turmaDestino) {
        destinos.push({ modalidadeDestino, turmaDestino });
      }

      if (Array.isArray(turmasExtrasDestino)) {
        for (const extra of turmasExtrasDestino) {
          if (extra?.modalidadeDestino && extra?.turmaDestino) {
            destinos.push({
              modalidadeDestino: extra.modalidadeDestino,
              turmaDestino: extra.turmaDestino,
            });
          }
        }
      }

      // Dedup (principal/extras repetidos)
      const vistos = new Set<string>();
      const destinosUnicos = destinos.filter((d) => {
        const key = `${d.modalidadeDestino}:::${d.turmaDestino}`;
        if (vistos.has(key)) return false;
        vistos.add(key);
        return true;
      });

      // 4) Inserir em cada destino
      for (const dest of destinosUnicos) {
        const turmasDestSnap = await db.ref(`modalidades/${dest.modalidadeDestino}/turmas`).once('value');
        const turmasDestVal = turmasDestSnap.val() || [];
        const turmasDestArr: any[] = Array.isArray(turmasDestVal)
          ? turmasDestVal
          : Object.values(turmasDestVal);

        const idxDest = turmasDestArr.findIndex(
          (t) => t && t.nome_da_turma === dest.turmaDestino,
        );

        if (idxDest === -1) continue;

        const turmaDestAtual = turmasDestArr[idxDest];
        const alunosDestArr = normalizeAlunosToArray(turmaDestAtual.alunos);

        const jaExiste = alunosDestArr.some(
          (a) => a?.informacoesAdicionais?.IdentificadorUnico === identificadorUnico,
        );

        if (!jaExiste) alunosDestArr.push(alunoAtualizado);

        await db.ref(`modalidades/${dest.modalidadeDestino}/turmas/${idxDest}`).update({
          alunos: alunosDestArr,
          capacidade_atual_da_turma: alunosDestArr.length,
          contadorAlunos: alunosDestArr.length,
        });
      }

      // 5) Finaliza rematrícula
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
