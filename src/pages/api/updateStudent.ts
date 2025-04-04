// src/pages/api/updateStudent.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import admin from '../../config/firebaseAdmin'

export default async function updateStudent(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'PUT') {
    try {
      // Desestrutura o alunoId e os novosDados enviados no corpo da requisição
      const { alunoId, novosDados } = req.body

      if (!alunoId) {
        return res.status(400).json({ error: 'AlunoId não fornecido.' })
      }

      // Referência à seção de modalidades no banco de dados
      const modalidadesRef = admin.database().ref('modalidades')

      // Busca todas as modalidades
      const modalidadesSnapshot = await modalidadesRef.once('value')
      const modalidades = modalidadesSnapshot.val()

      // Itera por todas as modalidades e suas turmas para atualizar o aluno
      for (const modalidadeNome in modalidades) {
        const modalidade = modalidades[modalidadeNome]
        if (!modalidade.turmas) continue
        for (const turmaKey in modalidade.turmas) {
          const turma = modalidade.turmas[turmaKey]
          if (!turma.alunos) continue
          for (const alunoKey in turma.alunos) {
            const aluno = turma.alunos[alunoKey]
            // Compara o identificador único convertendo para string para evitar problemas de tipo
            if (aluno.alunoId && String(aluno.alunoId) === String(alunoId)) {
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

      return res.status(200).json({
        message: 'Aluno atualizado em todas as turmas com sucesso.',
      })
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
