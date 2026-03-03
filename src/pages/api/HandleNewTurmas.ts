// src/pages/api/HandleNewTurmas.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../config/firebaseAdmin';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const database = admin.database();

/** -----------------------------
 *  Esquemas de validação (Zod)
 *  -----------------------------
 */

// POST (criar turma)
const createTurmaSchema = z.object({
  modalidade: z.string().min(1, { message: 'A modalidade é obrigatória.' }),
  nucleo: z.string().min(1, { message: 'O núcleo é obrigatório.' }),
  categoria: z.string().min(1, { message: 'A categoria é obrigatória.' }),
  capacidade_maxima_da_turma: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .pipe(z.number().min(1)),
  diaDaSemana: z.string().min(1, { message: 'O dia da semana é obrigatório.' }),
  horario: z.string().min(1, { message: 'O horário é obrigatório.' }),
  // NOVO: permitir nome custom no CREATE (opcional)
  nome_da_turma: z.string().min(1).optional(),
  // marca turma como feminina (todas as idades)
  isFeminina: z.boolean().optional().default(false),
});

// PUT (atualizar turma)
const updateTurmaSchema = z.object({
  uuidTurma: z.string().uuid({ message: 'O uuidTurma deve ser um UUID válido.' }),
  modalidade: z.string().min(1, { message: 'A modalidade é obrigatória.' }),
  // os demais campos são opcionais; se não vierem, mantemos o antigo
  nome_da_turma: z.string().min(1).optional(),
  capacidade_maxima_da_turma: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .optional(),
  nucleo: z.string().min(1).optional(),
  categoria: z.string().min(1).optional(),
  diaDaSemana: z.string().min(1).optional(),
  horario: z.string().min(1).optional(),
  isFeminina: z.boolean().optional(),
});

// DELETE (excluir turma)
const deleteTurmaSchema = z.object({
  modalidade: z.string().min(1, { message: 'A modalidade é obrigatória.' }),
  uuidTurma: z.string().uuid({ message: 'O uuidTurma deve ser um UUID válido.' }),
});

/** -----------------------------
 *  Handler principal
 *  -----------------------------
 */
export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  switch (request.method) {
    case 'POST':
      return handlePost(request, response);
    case 'PUT':
      return handlePut(request, response);
    case 'DELETE':
      return handleDelete(request, response);
    default:
      response.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
      return response.status(405).end('Method Not Allowed');
  }
}

/** -----------------------------
 *  POST: criar turma
 *  -----------------------------
 */
async function handlePost(request: NextApiRequest, response: NextApiResponse) {
  try {
    const {
      modalidade,
      nucleo,
      categoria,
      capacidade_maxima_da_turma,
      diaDaSemana,
      horario,
      nome_da_turma,
      isFeminina = false,
    } = createTurmaSchema.parse(request.body);

    // Nome padrão + sufixo FEMININO quando necessário
    const baseName = `${categoria}_${nucleo}_${diaDaSemana}_${horario}`;
    const computedName = isFeminina ? `${baseName} - FEMININO` : baseName;

    // Se veio nome custom, respeita; senão usa o computed
    const finalName = nome_da_turma?.trim().length ? nome_da_turma.trim() : computedName;

    const uuidDaTurma = uuidv4();

    const modalidadeReference = database.ref(`modalidades/${modalidade}/turmas`);
    const modalidadeSnapshot = await modalidadeReference.once('value');

    const newClassIndex = modalidadeSnapshot.exists() ? modalidadeSnapshot.numChildren() : 0;

    const newClass = {
      nome_da_turma: finalName,
      modalidade: modalidade,
      nucleo: nucleo,
      categoria: categoria,
      capacidade_maxima_da_turma: capacidade_maxima_da_turma,
      capacidade_atual_da_turma: 0,
      alunos: [],
      uuidTurma: uuidDaTurma,
      contadorAlunos: 0,
      diaDaSemana: diaDaSemana,
      horario: horario,
      isFeminina: isFeminina,
    };

    // Mantém seu formato original (array por índice)
    await modalidadeReference.child(newClassIndex.toString()).set(newClass);

    return response.status(200).json({ message: 'Turma adicionada com sucesso', turma: newClass });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro no POST HandleNewTurmas:', error);
    return response.status(500).json({ message: 'Erro no servidor' });
  }
}

/** -----------------------------
 *  PUT: atualizar turma
 *  -----------------------------
 */
async function handlePut(request: NextApiRequest, response: NextApiResponse) {
  try {
    const {
      uuidTurma,
      modalidade,
      nome_da_turma,
      capacidade_maxima_da_turma,
      nucleo,
      categoria,
      diaDaSemana,
      horario,
      isFeminina,
    } = updateTurmaSchema.parse(request.body);

    const classReference = database
      .ref(`modalidades/${modalidade}/turmas`)
      .orderByChild('uuidTurma')
      .equalTo(uuidTurma);

    const snapshot = await classReference.once('value');
    if (!snapshot.exists()) {
      return response.status(404).json({ message: 'Turma não encontrada' });
    }

    const classKey = Object.keys(snapshot.val())[0];
    const current = snapshot.val()[classKey];

    const nextNucleo = nucleo ?? current.nucleo;
    const nextCategoria = categoria ?? current.categoria;
    const nextDia = diaDaSemana ?? current.diaDaSemana;
    const nextHora = horario ?? current.horario;
    const nextIsFeminina = typeof isFeminina === 'boolean' ? isFeminina : !!current.isFeminina;

    const computedBase = `${nextCategoria}_${nextNucleo}_${nextDia}_${nextHora}`;
    const computedName = nextIsFeminina ? `${computedBase} - FEMININO` : computedBase;

    const finalName = nome_da_turma?.trim().length ? nome_da_turma.trim() : computedName;

    const updatePayload: Record<string, unknown> = {
      nome_da_turma: finalName,
      nucleo: nextNucleo,
      categoria: nextCategoria,
      isFeminina: nextIsFeminina,
      diaDaSemana: nextDia,
      horario: nextHora,
    };

    if (typeof capacidade_maxima_da_turma === 'number' && !Number.isNaN(capacidade_maxima_da_turma)) {
      updatePayload.capacidade_maxima_da_turma = capacidade_maxima_da_turma;
    }

    await database.ref(`modalidades/${modalidade}/turmas/${classKey}`).update(updatePayload);

    return response.status(200).json({ message: 'Turma atualizada com sucesso' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro no PUT HandleNewTurmas:', error);
    return response.status(500).json({ message: 'Erro no servidor' });
  }
}

/** -----------------------------
 *  DELETE: excluir turma
 *  -----------------------------
 */
async function handleDelete(request: NextApiRequest, response: NextApiResponse) {
  try {
    const { modalidade, uuidTurma } = deleteTurmaSchema.parse(request.body);

    const turmasReference = database.ref(`modalidades/${modalidade}/turmas`);
    const snapshot = await turmasReference.once('value');

    if (!snapshot.exists()) {
      return response.status(404).json({ message: 'Nenhuma turma encontrada para esta modalidade' });
    }

    const turmasData = snapshot.val();
    const arrayDeTurmas: any[] = Array.isArray(turmasData) ? turmasData : Object.values(turmasData);

    const novoArrayDeTurmas = arrayDeTurmas.filter((turma) => turma && turma.uuidTurma !== uuidTurma);

    await turmasReference.set(novoArrayDeTurmas);

    return response.status(200).json({ message: 'Turma excluída com sucesso' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao remover turma:', error);
    return response.status(500).json({ message: 'Erro no servidor' });
  }
}