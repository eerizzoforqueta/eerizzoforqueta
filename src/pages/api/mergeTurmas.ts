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
function toArrayMaybe(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "object") return Object.values(val).filter(Boolean);
  return [];
}

function listWithKeys(val: any): Array<{ key: string; value: any }> {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((v, i) => ({ key: String(i), value: v }))
      .filter((x) => x.value);
  }
  if (typeof val === "object") {
    return Object.entries(val)
      .map(([k, v]) => ({ key: k, value: v }))
      .filter((x) => x.value);
  }
  return [];
}

function findTurmaByName(turmasVal: any, nomeTurma: string) {
  const target = norm(nomeTurma);
  const list = listWithKeys(turmasVal);
  return (
    list.find((t) => norm(t.value?.nome_da_turma) === target) || null
  );
}

function nextNumericKey(turmasVal: any): string {
  const list = listWithKeys(turmasVal);
  const nums = list
    .map((x) => Number.parseInt(String(x.key), 10))
    .filter((n) => Number.isFinite(n));

  if (!nums.length) return "0";
  return String(Math.max(...nums) + 1);
}

function mergePresencas(
  a: Record<string, Record<string, boolean>> = {},
  b: Record<string, Record<string, boolean>> = {}
) {
  const out: Record<string, Record<string, boolean>> = JSON.parse(
    JSON.stringify(a || {})
  );

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

  for (const aluno of alunos) {
    const idu = aluno?.informacoesAdicionais?.IdentificadorUnico?.toString().trim();
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
    const modalidadesRef = admin.database().ref("modalidades");
    const snap = await modalidadesRef.once("value");
    const modalidades = snap.val() || {};

    const modA = modalidades[modalidadeOrigemA];
    const modB = modalidades[modalidadeOrigemB];
    const modDest = modalidades[modalidadeDestino];

    if (!modA?.turmas || !modB?.turmas) {
      return res.status(404).json({ error: "Turmas de origem não encontradas." });
    }
    if (!modDest) {
      return res.status(404).json({ error: "Modalidade destino não encontrada." });
    }

    const turmaAFound = findTurmaByName(modA.turmas, nomeDaTurmaA);
    const turmaBFound = findTurmaByName(modB.turmas, nomeDaTurmaB);

    if (!turmaAFound || !turmaBFound) {
      return res.status(404).json({ error: "Turma A ou B não encontrada." });
    }

    // Alunos podem ser array OU objeto
    const alunosA = toArrayMaybe(turmaAFound.value?.alunos);
    const alunosB = toArrayMaybe(turmaBFound.value?.alunos);
    const mergedAlunos = dedupeAlunos([...alunosA, ...alunosB]);

    // Evitar criar turma duplicada no destino (mesmo nome)
    const destTurmasArr = toArrayMaybe(modDest?.turmas);
    const jaExisteNoDestino = destTurmasArr.some(
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

    // Novo key numérico para compatibilidade com o resto do app
    const destKey = nextNumericKey(modDest.turmas);

    // Multi-location update: deletar A/B e criar nova no destino
    const updates: Record<string, any> = {};

    updates[`modalidades/${modalidadeOrigemA}/turmas/${turmaAFound.key}`] = null;
    updates[`modalidades/${modalidadeOrigemB}/turmas/${turmaBFound.key}`] = null;

    updates[`modalidades/${modalidadeDestino}/turmas/${destKey}`] = newTurmaObj;

    await rootRef.update(updates);

    return res.status(200).json({
      message: "Turmas fundidas com sucesso.",
      mergedCount: mergedAlunos.length,
      destinoKey: destKey,
      uuidTurma: newTurmaObj.uuidTurma,
    });
  } catch (error) {
    console.error("Erro ao fundir turmas:", error);
    return res.status(500).json({ error: "Erro interno ao fundir turmas." });
  }
}
