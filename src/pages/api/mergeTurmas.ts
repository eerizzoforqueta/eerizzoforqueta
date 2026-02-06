// src/pages/api/mergeTurmas.ts
import type { NextApiRequest, NextApiResponse } from "next";
import admin from "@/config/firebaseAdmin";
import { v4 as uuidv4 } from "uuid";

type NewTurmaFields = {
  nome_da_turma: string;
  nucleo: string;
  categoria: string;
  capacidade_maxima_da_turma: number;
  diaDaSemana?: string;
  horario?: string;
};

type Body = {
  modalidadeOrigemA: string;
  nomeDaTurmaA: string;
  modalidadeOrigemB: string;
  nomeDaTurmaB: string;
  modalidadeDestino: string;
  novaTurma: NewTurmaFields;
};

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

// RTDB pode vir como array, objeto (com chaves numéricas) ou null
function toArrayMaybe<T = any>(val: any): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return (val as T[]).filter(Boolean);
  if (typeof val === "object") return (Object.values(val) as T[]).filter(Boolean);
  return [];
}

function removeByNames(turmas: any[], namesToRemove: string[]) {
  const set = new Set(namesToRemove.map((n) => norm(n)));
  return (Array.isArray(turmas) ? turmas : [])
    .filter(Boolean) // ✅ remove null/undefined
    .filter((t) => !set.has(norm(t?.nome_da_turma)));
}

function mergePresencas(
  a: Record<string, Record<string, boolean>> = {},
  b: Record<string, Record<string, boolean>> = {}
) {
  const out: Record<string, Record<string, boolean>> = JSON.parse(JSON.stringify(a || {}));
  for (const mes of Object.keys(b || {})) {
    out[mes] = out[mes] || {};
    for (const dia of Object.keys(b[mes] || {})) {
      const va = !!out[mes][dia];
      const vb = !!b[mes][dia];
      out[mes][dia] = va || vb;
    }
  }
  return out;
}

function dedupeAlunos(alunos: any[]) {
  const map = new Map<string, any>();

  for (const aluno of alunos.filter(Boolean)) {
    const idu = aluno?.informacoesAdicionais?.IdentificadorUnico?.toString()?.trim();
    const key =
      idu && idu.length > 0
        ? `IDU#${idu}`
        : `FALLBACK#${norm(aluno?.nome)}#${norm(aluno?.anoNascimento)}`;

    if (!map.has(key)) {
      map.set(key, aluno);
    } else {
      const prev = map.get(key);
      const merged = {
        ...prev,
        ...aluno,
        presencas: mergePresencas(prev?.presencas, aluno?.presencas),
      };
      map.set(key, merged);
    }
  }

  return Array.from(map.values());
}

function findTurmaInArrayByName(turmasArr: any[], nomeTurma: string) {
  const target = norm(nomeTurma);
  return turmasArr.find((t) => norm(t?.nome_da_turma) === target) || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      modalidadeOrigemA,
      nomeDaTurmaA,
      modalidadeOrigemB,
      nomeDaTurmaB,
      modalidadeDestino,
      novaTurma,
    } = req.body as Body;

    if (
      !modalidadeOrigemA ||
      !nomeDaTurmaA ||
      !modalidadeOrigemB ||
      !nomeDaTurmaB ||
      !modalidadeDestino ||
      !novaTurma?.nome_da_turma ||
      !novaTurma?.categoria ||
      !novaTurma?.nucleo
    ) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    // Evitar mesma turma 2x
    if (
      norm(modalidadeOrigemA) === norm(modalidadeOrigemB) &&
      norm(nomeDaTurmaA) === norm(nomeDaTurmaB)
    ) {
      return res.status(400).json({ error: "Selecione turmas diferentes para fundir." });
    }

    const rootRef = admin.database().ref();
    const snap = await admin.database().ref("modalidades").once("value");
    const modalidades = snap.val() || {};

    const modA = modalidades[modalidadeOrigemA];
    const modB = modalidades[modalidadeOrigemB];
    const modDest = modalidades[modalidadeDestino];

    if (!modA || !modB) {
      return res.status(404).json({ error: "Modalidade(s) de origem não encontrada(s)." });
    }
    if (!modDest) {
      return res.status(404).json({ error: "Modalidade destino não encontrada." });
    }

    // ✅ sempre trabalhar com ARRAYS compactados (sem null)
    const turmasA = toArrayMaybe<any>(modA.turmas);
    const turmasB = toArrayMaybe<any>(modB.turmas);
    const turmasDestOriginal = toArrayMaybe<any>(modDest.turmas);

    const sameOrigin = norm(modalidadeOrigemA) === norm(modalidadeOrigemB);

    const turmaObjA = findTurmaInArrayByName(turmasA, nomeDaTurmaA);
    const turmaObjB = sameOrigin
      ? findTurmaInArrayByName(turmasA, nomeDaTurmaB) // mesma lista
      : findTurmaInArrayByName(turmasB, nomeDaTurmaB);

    if (!turmaObjA || !turmaObjB) {
      return res.status(404).json({ error: "Turma A ou B não encontrada." });
    }

    const alunosA = toArrayMaybe<any>(turmaObjA?.alunos);
    const alunosB = toArrayMaybe<any>(turmaObjB?.alunos);
    const mergedAlunos = dedupeAlunos([...alunosA, ...alunosB]);

    // monta arrays removidos
    let turmasANew: any[] = [];
    let turmasBNew: any[] = [];

    if (sameOrigin) {
      // remove A e B do MESMO array
      turmasANew = removeByNames(turmasA, [nomeDaTurmaA, nomeDaTurmaB]);
      turmasBNew = turmasANew; // não será usado, mas mantém coerência
    } else {
      turmasANew = removeByNames(turmasA, [nomeDaTurmaA]);
      turmasBNew = removeByNames(turmasB, [nomeDaTurmaB]);
    }

    // destino base (importante: se destino é A ou B, usar o array já removido)
    let turmasDestBase: any[] = [];
    if (norm(modalidadeDestino) === norm(modalidadeOrigemA)) {
      turmasDestBase = turmasANew;
    } else if (norm(modalidadeDestino) === norm(modalidadeOrigemB)) {
      turmasDestBase = sameOrigin ? turmasANew : turmasBNew;
    } else {
      turmasDestBase = turmasDestOriginal;
    }

    // evita duplicar nome no destino
    const jaExisteNoDestino = turmasDestBase.some(
      (t) => norm(t?.nome_da_turma) === norm(novaTurma.nome_da_turma)
    );
    if (jaExisteNoDestino) {
      return res.status(400).json({
        error: `Já existe uma turma no destino com o nome "${novaTurma.nome_da_turma}".`,
      });
    }

    const newTurmaObj = {
      ...novaTurma,
      uuidTurma: uuidv4(),
      modalidade: modalidadeDestino,
      capacidade_atual_da_turma: mergedAlunos.length,
      contadorAlunos: mergedAlunos.length,
      alunos: mergedAlunos,
      createdAt: Date.now(),
      mergedFrom: [
        { modalidade: modalidadeOrigemA, turma: nomeDaTurmaA },
        { modalidade: modalidadeOrigemB, turma: nomeDaTurmaB },
      ],
    };

    const turmasDestNew = [...turmasDestBase.filter(Boolean), newTurmaObj]; // ✅ garante sem null

    // ✅ updates regravando o ARRAY COMPLETO (sem deletar por índice)
    const updates: Record<string, any> = {};

    // origem A sempre precisa ser gravada se:
    // - modalidades diferentes (removemos só de A)
    // - ou mesmoOrigin e destino NÃO é A (precisa remover as duas)
    const destIsA = norm(modalidadeDestino) === norm(modalidadeOrigemA);
    const destIsB = norm(modalidadeDestino) === norm(modalidadeOrigemB);

    if (sameOrigin) {
      // se destino é a própria origem, só grava 1 vez no destino (já removido + novo)
      if (destIsA) {
        updates[`modalidades/${modalidadeOrigemA}/turmas`] = turmasDestNew;
      } else {
        updates[`modalidades/${modalidadeOrigemA}/turmas`] = turmasANew;
        updates[`modalidades/${modalidadeDestino}/turmas`] = turmasDestNew;
      }
    } else {
      // origens diferentes
      if (destIsA) {
        updates[`modalidades/${modalidadeOrigemA}/turmas`] = turmasDestNew; // A removido + novo
        updates[`modalidades/${modalidadeOrigemB}/turmas`] = turmasBNew;    // B removido
      } else if (destIsB) {
        updates[`modalidades/${modalidadeOrigemA}/turmas`] = turmasANew;    // A removido
        updates[`modalidades/${modalidadeOrigemB}/turmas`] = turmasDestNew; // B removido + novo
      } else {
        updates[`modalidades/${modalidadeOrigemA}/turmas`] = turmasANew;
        updates[`modalidades/${modalidadeOrigemB}/turmas`] = turmasBNew;
        updates[`modalidades/${modalidadeDestino}/turmas`] = turmasDestNew;
      }
    }

    await rootRef.update(updates);

    return res.status(200).json({
      message: "Turmas fundidas com sucesso.",
      mergedCount: mergedAlunos.length,
      uuidTurma: newTurmaObj.uuidTurma,
    });
  } catch (error) {
    console.error("Erro ao fundir turmas:", error);
    return res.status(500).json({ error: "Erro interno ao fundir turmas." });
  }
}
