// src/pages/api/rematricula/portalLookup.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const db = admin.database();
const ANO_PADRAO = 2026;

const JWT_SECRET =
  process.env.REMATRICULA_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'rematricula-dev-secret';

interface RematriculaResumo {
  token: string;               // 👈 JWT para /rematricula/[token]
  alunoNome: string;
  identificadorUnico: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  status: string;
  resposta?: string | null;
}

// Normaliza datas do tipo "1/3/2018" -> "01/03/2018"
function normalizarDataNascimento(input: string | undefined | null): string | null {
  if (!input) return null;
  const clean = String(input).trim();

  const m = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;

  let [, d, mm, yy] = m;
  if (d.length === 1) d = '0' + d;
  if (mm.length === 1) mm = '0' + mm;
  if (yy.length === 2) {
    // regra simples: anos >= 30 vão para 19xx, resto 20xx
    const n = parseInt(yy, 10);
    yy = (n >= 30 ? '19' : '20') + yy;
  }

  return `${d}/${mm}/${yy}`;
}

type Data =
  | { rematriculas: RematriculaResumo[] }
  | { error: string };

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
    const {
      cpfPagador,
      dataNascimento,
      anoLetivo,
    } = req.body as {
      cpfPagador?: string;
      dataNascimento?: string;
      anoLetivo?: number;
    };

    if (!cpfPagador || !dataNascimento) {
      return res
        .status(400)
        .json({ error: 'CPF e data de nascimento são obrigatórios.' });
    }

    const cpfClean = cpfPagador.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      return res
        .status(400)
        .json({ error: 'CPF inválido. Informe 11 dígitos.' });
    }

    const dataNascNorm = normalizarDataNascimento(dataNascimento);
    if (!dataNascNorm) {
      return res
        .status(400)
        .json({ error: 'Data de nascimento inválida. Use DD/MM/AAAA.' });
    }

    const ano = Number(anoLetivo || ANO_PADRAO);

    // 1) Buscar ALUNOS que batem CPF (pagador) + dataNascimento (aluno)
    const modalidadesSnap = await db.ref('modalidades').once('value');
    const modalidadesVal = modalidadesSnap.val() || {};

    type MatchAluno = {
      identificadorUnico: string;
      alunoNome: string;
      modalidadeOrigem: string;
      nomeDaTurmaOrigem: string;
    };

    const matches: MatchAluno[] = [];

    for (const [modalidadeNome, modalidadeVal] of Object.entries<any>(
      modalidadesVal,
    )) {
      const turmasRaw = modalidadeVal.turmas || {};
      const turmasArray = Array.isArray(turmasRaw)
        ? turmasRaw
        : Object.values(turmasRaw);

      for (const turma of turmasArray) {
        if (!turma) continue;
        const nomeDaTurma = turma.nome_da_turma;

        const alunosRaw = turma.alunos || {};
        const alunosArray = Array.isArray(alunosRaw)
          ? alunosRaw
          : Object.values(alunosRaw);

        for (const aluno of alunosArray) {
          if (!aluno) continue;

          const infoAd = aluno.informacoesAdicionais || {};
          const pagador = infoAd.pagadorMensalidades || {};

          const cpfDb = pagador.cpf
            ? String(pagador.cpf).replace(/\D/g, '')
            : '';
          const nascDbNorm = normalizarDataNascimento(aluno.anoNascimento);

          if (cpfDb === cpfClean && nascDbNorm === dataNascNorm) {
            const ident = infoAd.IdentificadorUnico;
            if (!ident) continue;

            matches.push({
              identificadorUnico: ident,
              alunoNome: aluno.nome,
              modalidadeOrigem: modalidadeNome,
              nomeDaTurmaOrigem: nomeDaTurma,
            });
          }
        }
      }
    }

    // Se nenhum aluno bateu CPF + dataNascimento -> nada a fazer
    if (!matches.length) {
      return res.json({ rematriculas: [] });
    }

    // 2) Buscar/criar REMATRÍCULAS para esses alunos
    const rematriculasRef = db.ref(`rematriculas${ano}`);
    const rematriculasSnap = await rematriculasRef.once('value');
    const rematriculasVal = rematriculasSnap.val() || {};

    // transforma rematriculas em array [rematriculaId, rem]
    const remEntries = Object.entries<any>(rematriculasVal);

    const resultados: RematriculaResumo[] = [];

    for (const m of matches) {
      // Tentar achar rematrícula já existente p/ este identificador + origem
      let rematriculaId: string | null = null;
      let remRecord: any = null;

      for (const [key, rem] of remEntries) {
        if (
          rem.identificadorUnico === m.identificadorUnico &&
          rem.modalidadeOrigem === m.modalidadeOrigem &&
          rem.nomeDaTurmaOrigem === m.nomeDaTurmaOrigem &&
          Number(rem.anoLetivo) === ano
        ) {
          rematriculaId = key;
          remRecord = rem;
          break;
        }
      }

      // Se não existir, cria uma nova agora (como o /api/createLink faria)
      if (!rematriculaId) {
        const newId = uuidv4();
        const now = Date.now();
        const novo = {
          anoLetivo: ano,
          identificadorUnico: m.identificadorUnico,
          modalidadeOrigem: m.modalidadeOrigem,
          nomeDaTurmaOrigem: m.nomeDaTurmaOrigem,
          status: 'pendente',
          resposta: null,
          createdAt: now,
        };

        await rematriculasRef.child(newId).set(novo);
        rematriculaId = newId;
        remRecord = novo;
      }

      // Gerar o JWT que será usado em /rematricula/[token]
      const tokenJwt = jwt.sign(
        {
          rematriculaId,
          anoLetivo: ano,
        },
        JWT_SECRET,
        {
          expiresIn: '120d',
        },
      );

      resultados.push({
        token: tokenJwt,
        alunoNome: m.alunoNome,
        identificadorUnico: m.identificadorUnico,
        modalidadeOrigem: m.modalidadeOrigem,
        nomeDaTurmaOrigem: m.nomeDaTurmaOrigem,
        status: remRecord.status || 'pendente',
        resposta: remRecord.resposta ?? null,
      });
    }

    return res.json({ rematriculas: resultados });
  } catch (error) {
    console.error('Erro em /api/rematricula/portalLookup:', error);
    return res
      .status(500)
      .json({ error: 'Erro interno ao buscar rematrículas.' });
  }
}
