// src/pages/api/updateStudent.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import admin from '../../config/firebaseAdmin'

export default async function updateStudent(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'PUT') {
    try {
      // Tenta obter o identificador enviado, seja por "alunoId" ou "id"
      const alunoIdPayload = req.body.alunoId || req.body.id
      const { novosDados } = req.body

      if (!alunoIdPayload) {
        return res.status(400).json({ error: 'AlunoId não fornecido.' })
      }

      // Referência à seção de modalidades no banco de dados
      const modalidadesRef = admin.database().ref('modalidades')
      const modalidadesSnapshot = await modalidadesRef.once('value')
      const modalidades = modalidadesSnapshot.val()

      let alunoEncontrado = false

      // Itera por todas as modalidades e suas turmas
      for (const modalidadeNome in modalidades) {
        const modalidade = modalidades[modalidadeNome]
        if (!modalidade.turmas) continue
        for (const turmaKey in modalidade.turmas) {
          const turma = modalidade.turmas[turmaKey]
          if (!turma.alunos) continue
          for (const alunoKey in turma.alunos) {
            const aluno = turma.alunos[alunoKey]
            // Verifica se o aluno possui "alunoId" ou "id" que corresponda ao payload
            if (
              (aluno.alunoId && String(aluno.alunoId) === String(alunoIdPayload)) ||
              (aluno.id && String(aluno.id) === String(alunoIdPayload))
            ) {
              // Atualiza os dados do aluno com os novos dados enviados
              await admin
                .database()
                .ref(`modalidades/${modalidadeNome}/turmas/${turmaKey}/alunos/${alunoKey}`)
                .update(novosDados)
              alunoEncontrado = true
            }
          }
        }
      }

      if (!alunoEncontrado) {
        return res.status(404).json({ error: 'Aluno não encontrado.' })
      }

      return res.status(200).json({ message: 'Aluno atualizado em todas as turmas com sucesso.' })
    } catch (error) {
      console.error('Erro ao atualizar aluno em todas as turmas', error)
      return res.status(500).json({ error: 'Erro ao atualizar aluno em todas as turmas.' })
    }
  } else {
    res.setHeader('Allow', 'PUT')
    res.status(405).end('Method Not Allowed')
  }
}
