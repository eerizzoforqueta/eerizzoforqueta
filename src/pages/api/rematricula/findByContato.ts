// src/pages/api/rematricula/findByContato.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';

const db = admin.database();

const apenasDigitos = (v: string) => v.replace(/\D/g, '');

function normalizarTelefone(v: string) {
  let digits = apenasDigitos(v);

  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  if (digits.length > 11) {
    digits = digits.slice(-11);
  }

  return digits;
}

function normalizarCpf(v: string) {
  const digits = apenasDigitos(v);
  if (digits.length !== 11) return '';
  return digits;
}

interface Match {
  identificadorUnico: string;
  nomeAluno: string;
  modalidade: string;
  turma: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res
      .status(405)
      .json({ error: `Method ${req.method} Not Allowed` });
  }

  const { telefone, cpf } = req.query;

  if (
    !telefone ||
    typeof telefone !== 'string' ||
    !cpf ||
    typeof cpf !== 'string'
  ) {
    return res
      .status(400)
      .json({ error: 'Telefone e CPF do responsável são obrigatórios.' });
  }

  const telefoneBusca = normalizarTelefone(telefone);
  const cpfBusca = normalizarCpf(cpf);

  if (!telefoneBusca || !cpfBusca) {
    return res
      .status(400)
      .json({ error: 'Telefone ou CPF inválidos. Verifique os dados.' });
  }

  try {
    const modalidadesSnap = await db.ref('modalidades').once('value');
    const modalidades = modalidadesSnap.val() || {};

    const matches: Match[] = [];

    for (const modalidadeNome of Object.keys(modalidades)) {
      const modalidade = modalidades[modalidadeNome];
      const turmas = modalidade.turmas || {};

      for (const turmaKey of Object.keys(turmas)) {
        const turma = turmas[turmaKey];
        const alunos = turma.alunos || {};

        for (const alunoKey of Object.keys(alunos)) {
          const aluno = alunos[alunoKey];

          const telAluno = aluno.telefoneComWhatsapp ?? '';
          const pagador =
            aluno?.informacoesAdicionais?.pagadorMensalidades || {};
          const telPagador = pagador.celularWhatsapp ?? '';
          const cpfPagador = pagador.cpf ?? '';

          const telAlunoNorm = normalizarTelefone(String(telAluno));
          const telPagadorNorm = normalizarTelefone(String(telPagador));
          const cpfPagadorNorm = normalizarCpf(String(cpfPagador));

          const matchTelefone =
            telefoneBusca === telAlunoNorm ||
            telefoneBusca === telPagadorNorm;
          const matchCpf = cpfBusca === cpfPagadorNorm;

          if (matchTelefone && matchCpf) {
            const identificadorUnico =
              aluno?.informacoesAdicionais?.IdentificadorUnico;

            if (!identificadorUnico) {
              // pula este vínculo, mas continua procurando outros
              console.warn(
                'Aluno encontrado sem IdentificadorUnico, ignorando:',
                aluno?.nome,
              );
              continue;
            }

            matches.push({
              identificadorUnico,
              nomeAluno: aluno.nome,
              modalidade: modalidadeNome,
              turma: turma.nome_da_turma,
            });
          }
        }
      }
    }

    if (!matches.length) {
      return res.status(404).json({
        error:
          'Nenhum aluno encontrado com esse telefone e CPF. Verifique os dados ou entre em contato com a coordenação.',
      });
    }

    return res.status(200).json({ matches });
  } catch (error) {
    console.error('Erro ao buscar aluno por telefone/CPF:', error);
    return res.status(500).json({
      error: 'Erro interno ao buscar aluno por telefone/CPF.',
    });
  }
}
