import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../config/firebaseAdmin';
import {
  extrairDiaDaSemana,
  gerarPresencasParaAlunoSemestre
} from '@/utils/Constants';

const db = admin.database();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Espera-se que o body contenha { ano, semestre, modalidade }
  const { ano, semestre, modalidade } = req.body;
  if (!modalidade || !ano || !semestre) {
    return res.status(400).json({ error: 'Dados incompletos. Ex: { ano, semestre, modalidade }' });
  }

  try {
    console.log('Processando modalidade:', modalidade.nome);

    for (const turma of modalidade.turmas) {
      console.log('Processando turma:', turma.nome_da_turma);

      // Extrai o dia da semana a partir do nome da turma
     const diaDaSemana = extrairDiaDaSemana(turma.nome_da_turma);

      if (!diaDaSemana) {
        console.error("Não foi possível extrair dia da semana da turma:", turma.nome_da_turma);
        continue; // NÃO gera presenças erradas
      }

      const novasPresencas = gerarPresencasParaAlunoSemestre(diaDaSemana, semestre, Number(ano));

      
      // Busca a turma no Firebase usando o nome_da_turma (normalizado)
      const turmaSnapshot = await db.ref(`modalidades/${modalidade.nome}/turmas`)
        .orderByChild('nome_da_turma')
        .equalTo(turma.nome_da_turma)
        .once('value');
      const turmaData = turmaSnapshot.val();

      if (!turmaData) {
        console.error('Turma não encontrada:', turma.nome_da_turma);
        continue;
      }

      const turmaKey = Object.keys(turmaData)[0];
      console.log('Turma encontrada com key:', turmaKey);

      // Obtém os alunos da turma como objeto – mesmo se armazenado como array, o Firebase transforma em objeto
      const alunosObj = turmaData[turmaKey].alunos || {};
      console.log('Chaves dos alunos:', Object.keys(alunosObj));
      console.log("Turma:", turma.nome_da_turma, "Dia extraído:", diaDaSemana);
      // Itera sobre todas as chaves dos alunos
      for (const alunoKey of Object.keys(alunosObj)) {
        const aluno = alunosObj[alunoKey];
        if (aluno) {
          console.log('Atualizando presenças para o aluno:', aluno.nome, 'Chave:', alunoKey);
          await db.ref(`modalidades/${modalidade.nome}/turmas/${turmaKey}/alunos/${alunoKey}/presencas`)
  .set(novasPresencas);

        }
      }
    }
    
    res.status(200).json({ message: "Presenças atualizadas com sucesso!" });
  } catch (error: any) {
    console.error('Erro ao atualizar presenças:', error);
    res.status(500).json({ error: error.message || 'Erro ao atualizar presenças' });
  }
}
