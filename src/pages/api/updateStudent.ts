// pages/api/updateStudentEverywhere.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import admin from '../../config/firebaseAdmin'

export default async function updateStudentEverywhere(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'PUT') {
    try {
      const {
        nomeAluno, // O nome do aluno para a busca
        novosDados, // Os novos dados para atualizar
      } = req.body

      // Referência à seção de modalidades no banco de dados
      const modalidadesRef = admin.database().ref('modalidades')

      // Buscar todas as modalidades
      const modalidadesSnapshot = await modalidadesRef.once('value')
      const modalidades = modalidadesSnapshot.val()

      // Atualizar o aluno em todas as turmas onde ele está inscrito
      for (const modalidadeNome in modalidades) {
        for (const turmaKey in modalidades[modalidadeNome].turmas) {
          const turma = modalidades[modalidadeNome].turmas[turmaKey]
          for (const alunoKey in turma.alunos) {
            const aluno = turma.alunos[alunoKey]
            // Checa se o nome do aluno corresponde e atualiza seus dados
            if (aluno.id === alunoId) {
              await admin
                .database()
                .ref(
                  `modalidades/${modalidadeNome}/turmas/${turmaKey}/alunos/${alunoKey}`,
                )
                .update(novosDados)
            }
          }
        }
      }

      return res
        .status(200)
        .json({ message: 'Aluno atualizado em todas as turmas com sucesso.' })
    } catch (error) {
      console.error('Erro ao atualizar aluno em todas as turmas', error)
      return res
        .status(500)
        .json({ error: 'Erro ao atualizar aluno em todas as turmas.' })
    }
  } else {
    res.setHeader('Allow', 'PUT')
    res.status(405).end('Method Not Allowed')
  }
}
