import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../config/firebaseAdmin';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

const database = admin.database();

const ARCHIVED_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/12-sp8d0HSalZTwP2lzpZKb2Ww7VCFMTK6OpXWlLsUz4/export?format=csv&gid=934558352';

const EXCLUDED_MODALIDADES = new Set(['arquivados', 'excluidos', 'temporarios']);
const TRACKED_CATEGORY_LABELS = ['SUB07', 'SUB09', 'SUB11', 'SUB13', 'SUB15', 'SUB17'] as const;

const EXACT_CATEGORY_KEYS = [
  'SUB07',
  'SUB08',
  'SUB09',
  'SUB10',
  'SUB11',
  'SUB12',
  'SUB13',
  'SUB14',
  'SUB15_17',
  'SUB11_SUB13',
  'SUB07_SUB09',
  'SUB09_SUB11',
  'SUB13_SUB15',
] as const;

type CategoryLabel = (typeof TRACKED_CATEGORY_LABELS)[number];
type ExactCategoryKey = (typeof EXACT_CATEGORY_KEYS)[number];

interface StudentAdditionalInfoDB {
  IdentificadorUnico?: string;
  filhofuncionarioJBS?: string;
  filhofuncionariomarcopolo?: string;
}

interface StudentDB {
  nome?: string;
  anoNascimento?: string;
  telefoneComWhatsapp?: string | number;
  informacoesAdicionais?: StudentAdditionalInfoDB;
}

interface TurmaDB {
  uuidTurma?: string;
  nome_da_turma?: string;
  modalidade?: string;
  nucleo?: string;
  categoria?: string;
  alunos?: StudentDB[] | Record<string, StudentDB | null>;
}

interface ModalidadeDB {
  turmas?: TurmaDB[] | Record<string, TurmaDB | null>;
}

type ModalidadesDB = Record<string, ModalidadeDB | null>;

interface StudentAccumulator {
  id: string;
  weeklyEnrollmentKeys: Set<string>;
  modalitySet: Set<string>;
  nucleiByModalidade: Map<string, Set<string>>;
  categories: Set<string>;
  exactCategories: Set<string>;
  categoriesByModalidade: Map<string, Set<string>>;
  filhoJBS: boolean;
  filhoMarcopolo: boolean;
}

interface StatsResponse {
  summary: {
    alunosAtivos: number;
    alunosArquivados: number | null;
    treinam1x: number;
    treinam2x: number;
    treinam3x: number;
    futebol: number;
    futsal: number;
    volei: number;
    filhosJBS: number;
    filhosMarcopolo: number;
  };
  categories: {
    sub07: number;
    sub09: number;
    sub11: number;
    sub13: number;
    sub15: number;
    sub17: number;
    voleiSub13: number;
    voleiSub17: number;
  };
  exactCategoryCounts: Record<ExactCategoryKey, number>;
  futsalByNucleo: Record<string, number>;
  voleiByNucleo: Record<string, number>;
  archivedCountError: string | null;
  generatedAt: string;
}

function normalizeText(value: string | number | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeCategoryExact(value: string | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function toArray<T>(value: T[] | Record<string, T | null> | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is T => Boolean(item));
  }
  return Object.values(value).filter((item): item is T => Boolean(item));
}

function isAffirmative(value: string | null | undefined): boolean {
  const normalized = normalizeText(value);
  return normalized === 'sim' || normalized === 'true' || normalized === 'yes';
}

function getStudentUniqueId(aluno: StudentDB): string {
  const uniqueId = aluno.informacoesAdicionais?.IdentificadorUnico?.trim();
  if (uniqueId) return uniqueId;

  const fallback = [
    normalizeText(aluno.nome),
    normalizeText(aluno.telefoneComWhatsapp),
    normalizeText(aluno.anoNascimento),
  ]
    .filter(Boolean)
    .join('__');

  return fallback || `fallback__${Math.random().toString(36).slice(2)}`;
}

function extractCategoryLabels(category: string | undefined): Set<string> {
  const normalized = normalizeCategoryExact(category);
  const matches = normalized.match(/\d{2}/g) ?? [];
  return new Set(matches.map((item) => `SUB${item}`));
}

function ensureSetRecord(record: Record<string, Set<string>>, key: string): Set<string> {
  if (!record[key]) {
    record[key] = new Set<string>();
  }
  return record[key];
}

async function fetchArchivedCount(): Promise<{ count: number | null; error: string | null }> {
  try {
    const response = await fetch(ARCHIVED_SHEET_CSV_URL, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const rows = csvText
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter((row) => row.length > 0);

    const dataRows = rows.length > 0 ? rows.length - 1 : 0;
    return { count: dataRows, error: null };
  } catch (error) {
    console.error('Erro ao contar alunos arquivados:', error);
    return {
      count: null,
      error: 'Não foi possível ler a planilha pública de arquivados.',
    };
  }
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<StatsResponse | { message: string }>
) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', ['GET']);
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = await getServerSession(request, response, authOptions);
  if (!session || session.user.role !== 'admin') {
    return response.status(401).json({ message: 'Não autorizado' });
  }

  try {
    const snapshot = await database.ref('modalidades').once('value');
    const modalidadesData = (snapshot.val() as ModalidadesDB | null) ?? {};

    const students = new Map<string, StudentAccumulator>();
    const futsalByNucleoIds: Record<string, Set<string>> = {};
    const voleiByNucleoIds: Record<string, Set<string>> = {};
    const categoryIds: Record<CategoryLabel, Set<string>> = {
      SUB07: new Set<string>(),
      SUB09: new Set<string>(),
      SUB11: new Set<string>(),
      SUB13: new Set<string>(),
      SUB15: new Set<string>(),
      SUB17: new Set<string>(),
    };

    const exactCategoryIds: Record<ExactCategoryKey, Set<string>> = {
      SUB07: new Set<string>(),
      SUB08: new Set<string>(),
      SUB09: new Set<string>(),
      SUB10: new Set<string>(),
      SUB11: new Set<string>(),
      SUB12: new Set<string>(),
      SUB13: new Set<string>(),
      SUB14: new Set<string>(),
      SUB15_17: new Set<string>(),
      SUB11_SUB13: new Set<string>(),
      SUB07_SUB09: new Set<string>(),
      SUB09_SUB11: new Set<string>(),
      SUB13_SUB15: new Set<string>(),
    };

    const voleiCategoryIds = {
      SUB13: new Set<string>(),
      SUB17: new Set<string>(),
    };

    for (const [modalidadeNome, modalidadeValue] of Object.entries(modalidadesData)) {
      if (!modalidadeValue) continue;

      const modalidadeNormalized = normalizeText(modalidadeNome);
      if (EXCLUDED_MODALIDADES.has(modalidadeNormalized)) continue;

      const turmas = toArray(modalidadeValue.turmas);

      for (const turma of turmas) {
        const alunos = toArray(turma.alunos);
        const nucleo = String(turma.nucleo ?? 'Sem núcleo').trim() || 'Sem núcleo';
        const categoryLabels = extractCategoryLabels(turma.categoria);
        const exactCategory = normalizeCategoryExact(turma.categoria);
        const turmaKey =
          turma.uuidTurma?.trim() ||
          `${modalidadeNome}__${String(turma.nome_da_turma ?? turma.categoria ?? nucleo)}`;

        for (const aluno of alunos) {
          const studentId = getStudentUniqueId(aluno);

          if (!students.has(studentId)) {
            students.set(studentId, {
              id: studentId,
              weeklyEnrollmentKeys: new Set<string>(),
              modalitySet: new Set<string>(),
              nucleiByModalidade: new Map<string, Set<string>>(),
              categories: new Set<string>(),
              exactCategories: new Set<string>(),
              categoriesByModalidade: new Map<string, Set<string>>(),
              filhoJBS: false,
              filhoMarcopolo: false,
            });
          }

          const accumulator = students.get(studentId)!;
          accumulator.weeklyEnrollmentKeys.add(turmaKey);
          accumulator.modalitySet.add(modalidadeNormalized);

          if (!accumulator.nucleiByModalidade.has(modalidadeNormalized)) {
            accumulator.nucleiByModalidade.set(modalidadeNormalized, new Set<string>());
          }
          accumulator.nucleiByModalidade.get(modalidadeNormalized)!.add(nucleo);

          if (!accumulator.categoriesByModalidade.has(modalidadeNormalized)) {
            accumulator.categoriesByModalidade.set(modalidadeNormalized, new Set<string>());
          }

          for (const label of categoryLabels) {
            accumulator.categories.add(label);
            accumulator.categoriesByModalidade.get(modalidadeNormalized)!.add(label);
          }

          if (EXACT_CATEGORY_KEYS.includes(exactCategory as ExactCategoryKey)) {
            accumulator.exactCategories.add(exactCategory);
          }

          if (isAffirmative(aluno.informacoesAdicionais?.filhofuncionarioJBS)) {
            accumulator.filhoJBS = true;
          }
          if (isAffirmative(aluno.informacoesAdicionais?.filhofuncionariomarcopolo)) {
            accumulator.filhoMarcopolo = true;
          }
        }
      }
    }

    let treinam1x = 0;
    let treinam2x = 0;
    let treinam3x = 0;
    let futebol = 0;
    let futsal = 0;
    let volei = 0;
    let filhosJBS = 0;
    let filhosMarcopolo = 0;

    for (const accumulator of students.values()) {
      const frequency = accumulator.weeklyEnrollmentKeys.size;

      if (frequency === 1) treinam1x += 1;
      if (frequency === 2) treinam2x += 1;
      if (frequency === 3) treinam3x += 1;

      if (accumulator.modalitySet.has('futebol')) {
        futebol += 1;
      }

      if (accumulator.modalitySet.has('futsal')) {
        futsal += 1;
        const nuclei = accumulator.nucleiByModalidade.get('futsal') ?? new Set<string>();
        for (const nucleo of nuclei) {
          ensureSetRecord(futsalByNucleoIds, nucleo).add(accumulator.id);
        }
      }

      if (accumulator.modalitySet.has('volei')) {
        volei += 1;
        const nuclei = accumulator.nucleiByModalidade.get('volei') ?? new Set<string>();
        for (const nucleo of nuclei) {
          ensureSetRecord(voleiByNucleoIds, nucleo).add(accumulator.id);
        }
      }

      for (const label of accumulator.categories) {
        if ((TRACKED_CATEGORY_LABELS as readonly string[]).includes(label)) {
          categoryIds[label as CategoryLabel].add(accumulator.id);
        }
      }

      for (const exactCategory of accumulator.exactCategories) {
        if (EXACT_CATEGORY_KEYS.includes(exactCategory as ExactCategoryKey)) {
          exactCategoryIds[exactCategory as ExactCategoryKey].add(accumulator.id);
        }
      }

      const voleiLabels = accumulator.categoriesByModalidade.get('volei') ?? new Set<string>();
      if (voleiLabels.has('SUB13')) voleiCategoryIds.SUB13.add(accumulator.id);
      if (voleiLabels.has('SUB17')) voleiCategoryIds.SUB17.add(accumulator.id);

      if (accumulator.filhoJBS) filhosJBS += 1;
      if (accumulator.filhoMarcopolo) filhosMarcopolo += 1;
    }

    const archived = await fetchArchivedCount();

    const payload: StatsResponse = {
      summary: {
        alunosAtivos: students.size,
        alunosArquivados: archived.count,
        treinam1x,
        treinam2x,
        treinam3x,
        futebol,
        futsal,
        volei,
        filhosJBS,
        filhosMarcopolo,
      },
      categories: {
        sub07: categoryIds.SUB07.size,
        sub09: categoryIds.SUB09.size,
        sub11: categoryIds.SUB11.size,
        sub13: categoryIds.SUB13.size,
        sub15: categoryIds.SUB15.size,
        sub17: categoryIds.SUB17.size,
        voleiSub13: voleiCategoryIds.SUB13.size,
        voleiSub17: voleiCategoryIds.SUB17.size,
      },
      exactCategoryCounts: {
        SUB07: exactCategoryIds.SUB07.size,
        SUB08: exactCategoryIds.SUB08.size,
        SUB09: exactCategoryIds.SUB09.size,
        SUB10: exactCategoryIds.SUB10.size,
        SUB11: exactCategoryIds.SUB11.size,
        SUB12: exactCategoryIds.SUB12.size,
        SUB13: exactCategoryIds.SUB13.size,
        SUB14: exactCategoryIds.SUB14.size,
        SUB15_17: exactCategoryIds.SUB15_17.size,
        SUB11_SUB13: exactCategoryIds.SUB11_SUB13.size,
        SUB07_SUB09: exactCategoryIds.SUB07_SUB09.size,
        SUB09_SUB11: exactCategoryIds.SUB09_SUB11.size,
        SUB13_SUB15: exactCategoryIds.SUB13_SUB15.size,
      },
      futsalByNucleo: Object.fromEntries(
        Object.entries(futsalByNucleoIds).map(([key, value]) => [key, value.size])
      ),
      voleiByNucleo: Object.fromEntries(
        Object.entries(voleiByNucleoIds).map(([key, value]) => [key, value.size])
      ),
      archivedCountError: archived.error,
      generatedAt: new Date().toISOString(),
    };

    return response.status(200).json(payload);
  } catch (error) {
    console.error('Erro ao gerar estatísticas dos alunos:', error);
    return response.status(500).json({ message: 'Erro ao gerar estatísticas' });
  }
}