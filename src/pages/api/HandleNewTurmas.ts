// src/pages/api/HandleNewTurmas.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../config/firebaseAdmin';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const database = admin.database();

/** -----------------------------
 *  Helpers
 *  -----------------------------
 */
function normalizeString(value: string | undefined | null): string {
  return String(value ?? '').trim();
}

function buildTurmaName(params: {
  categoria?: string;
  nucleo?: string;
  diaDaSemana?: string;
  horario?: string;
  isFeminina?: boolean;
}): string {
  const categoria = normalizeString(params.categoria);
  const nucleo = normalizeString(params.nucleo);
  const diaDaSemana = normalizeString(params.diaDaSemana);
  const horario = normalizeString(params.horario);

  const baseName = `${categoria}_${nucleo}_${diaDaSemana}_${horario}`;
  return params.isFeminina ? `${baseName} - FEMININO` : baseName;
}

type TurmaIdentity = {
  classKey: string;
  current: Record<string, any>;
};

async function findTurmaIdentity(params: {
  modalidade: string;
  uuidTurma?: string;
  turmaKey?: string;
}): Promise<TurmaIdentity | null> {
  const { modalidade, uuidTurma, turmaKey } = params;

  if (uuidTurma) {
    const classReference = database
      .ref(`modalidades/${modalidade}/turmas`)
      .orderByChild('uuidTurma')
      .equalTo(uuidTurma);

    const snapshot = await classReference.once('value');
    if (!snapshot.exists()) return null;

    const classKey = Object.keys(snapshot.val())[0];
    return {
      classKey,
      current: snapshot.val()[classKey],
    };
  }

  if (turmaKey !== undefined) {
    const turmaRef = database.ref(`modalidades/${modalidade}/turmas/${turmaKey}`);
    const snapshot = await turmaRef.once('value');
    if (!snapshot.exists()) return null;

    return {
      classKey: turmaKey,
      current: snapshot.val(),
    };
  }

  return null;
}

const WEEKDAY_TO_JS: Record<string, number> = {
  SEGUNDA: 1,
  TERCA: 2,
  'TERÇA': 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
  'SÁBADO': 6,
};

const MES_TO_INDEX: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  'março': 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

function sortDateKeysAsc(a: string, b: string): number {
  const [da, ma, ya] = a.split('-').map((item) => Number(item));
  const [db, mb, yb] = b.split('-').map((item) => Number(item));

  const timeA = new Date(ya, ma - 1, da).getTime();
  const timeB = new Date(yb, mb - 1, db).getTime();

  return timeA - timeB;
}

function inferYearFromDateKeys(dateKeys: string[]): number {
  for (const key of dateKeys) {
    const [, , year] = key.split('-').map((item) => Number(item));
    if (Number.isFinite(year) && year > 2000) {
      return year;
    }
  }
  return new Date().getFullYear();
}

function generateDateKeysForMonth(year: number, monthIndex: number, weekdayJs: number): string[] {
  const result: string[] = [];

  for (let day = 1; day <= new Date(year, monthIndex + 1, 0).getDate(); day += 1) {
    const current = new Date(year, monthIndex, day);
    if (current.getDay() === weekdayJs) {
      const dd = String(day).padStart(2, '0');
      const mm = String(monthIndex + 1).padStart(2, '0');
      result.push(`${dd}-${mm}-${year}`);
    }
  }

  return result;
}

function regeneratePresencasForNewWeekday(
  presencas: Record<string, Record<string, boolean>> | undefined,
  diaDaSemana: string
): Record<string, Record<string, boolean>> {
  if (!presencas) return {};

  const weekdayJs = WEEKDAY_TO_JS[normalizeString(diaDaSemana).toUpperCase()];
  if (weekdayJs === undefined) {
    return presencas;
  }

  const updatedPresencas: Record<string, Record<string, boolean>> = {};

  for (const [mes, valoresMes] of Object.entries(presencas)) {
    const monthIndex = MES_TO_INDEX[normalizeString(mes).toLowerCase()];
    if (monthIndex === undefined) {
      updatedPresencas[mes] = valoresMes ?? {};
      continue;
    }

    const oldKeys = Object.keys(valoresMes ?? {}).sort(sortDateKeysAsc);
    const oldValues = oldKeys.map((key) => Boolean(valoresMes[key]));
    const year = inferYearFromDateKeys(oldKeys);
    const newKeys = generateDateKeysForMonth(year, monthIndex, weekdayJs);

    const novoMes: Record<string, boolean> = {};
    newKeys.forEach((key, index) => {
      novoMes[key] = oldValues[index] ?? false;
    });

    updatedPresencas[mes] = novoMes;
  }

  return updatedPresencas;
}

function updateAlunosPresencasForNewWeekday(
  alunos: unknown,
  diaDaSemana: string
): unknown {
  if (!alunos) return alunos;

  if (Array.isArray(alunos)) {
    return alunos.map((aluno) => {
      if (!aluno || typeof aluno !== 'object') return aluno;
      const alunoObj = aluno as Record<string, any>;
      return {
        ...alunoObj,
        presencas: regeneratePresencasForNewWeekday(alunoObj.presencas, diaDaSemana),
      };
    });
  }

  if (typeof alunos === 'object') {
    const entries = Object.entries(alunos as Record<string, any>).map(([key, aluno]) => {
      if (!aluno || typeof aluno !== 'object') {
        return [key, aluno];
      }

      const alunoObj = aluno as Record<string, any>;
      return [
        key,
        {
          ...alunoObj,
          presencas: regeneratePresencasForNewWeekday(alunoObj.presencas, diaDaSemana),
        },
      ];
    });

    return Object.fromEntries(entries);
  }

  return alunos;
}

/** -----------------------------
 *  Esquemas de validação (Zod)
 *  -----------------------------
 */
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
  nome_da_turma: z.string().min(1).optional(),
  isFeminina: z.boolean().optional().default(false),
});

const updateTurmaSchema = z
  .object({
    uuidTurma: z.string().uuid({ message: 'O uuidTurma deve ser um UUID válido.' }).optional(),
    turmaKey: z
      .string()
      .min(1, { message: 'A turmaKey é obrigatória quando não houver uuidTurma.' })
      .optional(),
    modalidade: z.string().min(1, { message: 'A modalidade é obrigatória.' }),
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
  })
  .refine((data) => Boolean(data.uuidTurma || data.turmaKey), {
    message: 'É necessário informar uuidTurma ou turmaKey.',
    path: ['uuidTurma'],
  });

const deleteTurmaSchema = z
  .object({
    modalidade: z.string().min(1, { message: 'A modalidade é obrigatória.' }),
    uuidTurma: z.string().uuid({ message: 'O uuidTurma deve ser um UUID válido.' }).optional(),
    turmaKey: z
      .string()
      .min(1, { message: 'A turmaKey é obrigatória quando não houver uuidTurma.' })
      .optional(),
  })
  .refine((data) => Boolean(data.uuidTurma || data.turmaKey), {
    message: 'É necessário informar uuidTurma ou turmaKey.',
    path: ['uuidTurma'],
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

    const computedName = buildTurmaName({
      categoria,
      nucleo,
      diaDaSemana,
      horario,
      isFeminina,
    });

    const finalName = normalizeString(nome_da_turma) || computedName;
    const uuidDaTurma = uuidv4();

    const modalidadeReference = database.ref(`modalidades/${modalidade}/turmas`);
    const modalidadeSnapshot = await modalidadeReference.once('value');

    const newClassIndex = modalidadeSnapshot.exists() ? modalidadeSnapshot.numChildren() : 0;

    const newClass = {
      nome_da_turma: finalName,
      modalidade,
      nucleo,
      categoria,
      capacidade_maxima_da_turma,
      capacidade_atual_da_turma: 0,
      alunos: [],
      uuidTurma: uuidDaTurma,
      contadorAlunos: 0,
      diaDaSemana,
      horario,
      isFeminina,
    };

    await modalidadeReference.child(newClassIndex.toString()).set(newClass);

    return response.status(200).json({
      message: 'Turma adicionada com sucesso',
      turma: newClass,
      turmaKey: newClassIndex.toString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro no POST HandleNewTurmas:', error);
    return response.status(500).json({ message: 'Erro no servidor' });
  }
}

async function handlePut(request: NextApiRequest, response: NextApiResponse) {
  try {
    const {
      uuidTurma,
      turmaKey,
      modalidade,
      nome_da_turma,
      capacidade_maxima_da_turma,
      nucleo,
      categoria,
      diaDaSemana,
      horario,
      isFeminina,
    } = updateTurmaSchema.parse(request.body);

    const turmaIdentity = await findTurmaIdentity({
      modalidade,
      uuidTurma,
      turmaKey,
    });

    if (!turmaIdentity) {
      return response.status(404).json({ message: 'Turma não encontrada' });
    }

    const { classKey, current } = turmaIdentity;

    const nextNucleo = normalizeString(nucleo) || normalizeString(current.nucleo);
    const nextCategoria = normalizeString(categoria) || normalizeString(current.categoria);
    const nextDia = normalizeString(diaDaSemana) || normalizeString(current.diaDaSemana);
    const nextHora = normalizeString(horario) || normalizeString(current.horario);
    const nextIsFeminina =
      typeof isFeminina === 'boolean' ? isFeminina : !!current.isFeminina;

    const currentComputedName = buildTurmaName({
      categoria: current.categoria,
      nucleo: current.nucleo,
      diaDaSemana: current.diaDaSemana,
      horario: current.horario,
      isFeminina: !!current.isFeminina,
    });

    const nextComputedName = buildTurmaName({
      categoria: nextCategoria,
      nucleo: nextNucleo,
      diaDaSemana: nextDia,
      horario: nextHora,
      isFeminina: nextIsFeminina,
    });

    const incomingName = normalizeString(nome_da_turma);
    const currentStoredName = normalizeString(current.nome_da_turma);

    let finalName = nextComputedName;

    if (incomingName) {
      const currentNameWasAutoGenerated = currentStoredName === currentComputedName;
      const incomingIsSameAsCurrentStored = incomingName === currentStoredName;

      if (currentNameWasAutoGenerated && incomingIsSameAsCurrentStored) {
        finalName = nextComputedName;
      } else {
        finalName = incomingName;
      }
    }

    const ensuredUuid = normalizeString(current.uuidTurma) || uuidTurma || uuidv4();

    const updatePayload: Record<string, unknown> = {
      uuidTurma: ensuredUuid,
      nome_da_turma: finalName,
      nucleo: nextNucleo,
      categoria: nextCategoria,
      isFeminina: nextIsFeminina,
      diaDaSemana: nextDia,
      horario: nextHora,
    };

    if (
      typeof capacidade_maxima_da_turma === 'number' &&
      !Number.isNaN(capacidade_maxima_da_turma)
    ) {
      updatePayload.capacidade_maxima_da_turma = capacidade_maxima_da_turma;
    }

    // Sempre que o front enviar diaDaSemana, sincroniza as presenças dos alunos
    // para corrigir turmas legadas que já estavam marcadas com o dia certo,
    // mas ainda carregavam datas antigas.
    if (diaDaSemana && current.alunos) {
      updatePayload.alunos = updateAlunosPresencasForNewWeekday(current.alunos, nextDia);
    }

    await database.ref(`modalidades/${modalidade}/turmas/${classKey}`).update(updatePayload);

    return response.status(200).json({
      message: 'Turma atualizada com sucesso',
      turmaKey: classKey,
      turma: {
        ...current,
        ...updatePayload,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro no PUT HandleNewTurmas:', error);
    return response.status(500).json({ message: 'Erro no servidor' });
  }
}

async function handleDelete(request: NextApiRequest, response: NextApiResponse) {
  try {
    const { modalidade, uuidTurma, turmaKey } = deleteTurmaSchema.parse(request.body);

    const turmasReference = database.ref(`modalidades/${modalidade}/turmas`);
    const snapshot = await turmasReference.once('value');

    if (!snapshot.exists()) {
      return response.status(404).json({ message: 'Nenhuma turma encontrada para esta modalidade' });
    }

    const turmasData = snapshot.val();
    const arrayDeTurmas: any[] = Array.isArray(turmasData)
      ? turmasData
      : Object.values(turmasData);

    const novoArrayDeTurmas = arrayDeTurmas.filter((turma, index) => {
      if (!turma) return false;
      if (uuidTurma && turma.uuidTurma === uuidTurma) return false;
      if (!uuidTurma && turmaKey !== undefined && String(index) === String(turmaKey)) return false;
      return true;
    });

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