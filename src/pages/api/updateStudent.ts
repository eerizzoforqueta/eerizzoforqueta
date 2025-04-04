// src/pages/api/updateStudent.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import admin from '../../config/firebaseAdmin'

export default async function updateStudent(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'PUT') {
    try {
      // Extrai o identificador único e os novos dados do corpo da requisição.
      // O identificador deve ser enviado com a chave "identificadorUnico"
      const { identificadorUnico, novosDados } = req.body

      if (!identificadorUnico) {
        return res.status(400).json({ error: 'identificadorUnico não fornecido.' })
      }

      // Referência à raiz das modalidades no Firebase Realtime Database
      const modalidadesRef = admin.database().ref('modalidades')
      const modalidadesSnapshot = await modalidadesRef.once('value')
      const modalidades = modalidadesSnapshot.val()

      let alunoEncontrado = false

      // Itera por cada modalidade e suas turmas
      for (const modalidadeNome in modalidades) {
        const modalidade = modalidades[modalidadeNome]
        if (!modalidade.turmas) continue

        for (const turmaKey in modalidade.turmas) {
          const turma = modalidade.turmas[turmaKey]
          if (!turma.alunos) continue

          for (const alunoKey in turma.alunos) {
            const aluno = turma.alunos[alunoKey]
            // Verifica se o campo informacoesAdicionais existe e se o IdentificadorUnico bate com o enviado no payload
            if (
              aluno.informacoesAdicionais &&
              aluno.informacoesAdicionais.IdentificadorUnico === identificadorUnico
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

      return res.status(200).json({
        message: 'Aluno atualizado em todas as turmas com sucesso.',
      })
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error)
      return res.status(500).json({ error: 'Erro ao atualizar aluno.' })
    }
  } else {
    res.setHeader('Allow', 'PUT')
    res.status(405).end('Method Not Allowed')
  }
}
