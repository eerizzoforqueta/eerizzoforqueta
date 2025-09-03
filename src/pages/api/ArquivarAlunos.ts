

// pages/api/ArquivarAlunos.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import admin from '@/config/firebaseAdmin'

const db = admin.database()


const APPS_SCRIPT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbw-wLWsu1RFgVTSU-n_hkcOVYdzlzZocN43xyrJnlF-SfsR2SE3me1b_OFHkghkTjYA7A/exec'

function norm(v: unknown) {
  return String(v ?? '').trim().toLowerCase()
}

async function removerAluno(modalidade: string, nomeDaTurma: string, identificadorUnico: string) {
  const turmasRef = db.ref(`modalidades/${modalidade}/turmas`)
  const snap = await turmasRef.once('value')

  if (!snap.exists()) throw new Error('Turmas não encontradas')

  const turmasData = snap.val() || {}
  const turmaKey = Object.keys(turmasData).find((key) => {
    const t = turmasData[key]
    return norm(t?.nome_da_turma) === norm(nomeDaTurma)
  })
  if (!turmaKey) throw new Error('Turma não encontrada')

  const turma = turmasData[turmaKey]
  const alunos = turma?.alunos || {}

  const alunoKey = Object.keys(alunos).find((k) => {
    const a = alunos[k]
    return a?.informacoesAdicionais?.IdentificadorUnico === identificadorUnico
  })
  if (!alunoKey) throw new Error('Aluno não encontrado')

  // remove aluno
  await db.ref(`modalidades/${modalidade}/turmas/${turmaKey}/alunos/${alunoKey}`).remove()

  // atualiza contagem (se existir)
  const atual = turma?.capacidade_atual_da_turma
  if (typeof atual === 'number' && atual > 0) {
    await db.ref(`modalidades/${modalidade}/turmas/${turmaKey}`)
      .update({ capacidade_atual_da_turma: atual - 1 })
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  try {
    const aluno = req.body
    // valida mínimos para excluir depois
    const identificador = aluno?.informacoesAdicionais?.IdentificadorUnico || aluno?.IdentificadorUnico || aluno?.alunoId
    const modalidade = aluno?.modalidade
    const nomeDaTurma = aluno?.nomeDaTurma

    if (!identificador || !modalidade || !nomeDaTurma) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes: IdentificadorUnico, modalidade, nomeDaTurma.' })
    }

    // 1) Copia para a planilha via Apps Script
    const resp = await fetch(APPS_SCRIPT_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // você pode enviar o aluno cru; o Apps Script já sabe lidar
      body: JSON.stringify(aluno),
    })
    const data = await resp.json().catch(() => ({}))

    if (!resp.ok || !data?.ok) {
      throw new Error(`Falha ao gravar na planilha: ${data?.error || resp.statusText}`)
    }

    // 2) Se deu certo, remove do Firebase
    await removerAluno(modalidade, nomeDaTurma, identificador)

    return res.status(200).json({ status: 'Success', archived: true, deleted: true })
  } catch (error: any) {
    console.error('[ArquivarAlunos] erro:', error)
    return res.status(500).json({ status: 'Failed', message: error?.message || 'Erro interno' })
  }
}
