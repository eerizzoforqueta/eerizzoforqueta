// src/pages/api/mergeTurmas.ts
import type { NextApiRequest, NextApiResponse } from "next";
import admin from "@/config/firebaseAdmin";

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

function removeByNames(turmas: any[], namesToRemove: string[]) {
  const set = new Set(namesToRemove.map((n) => norm(n)));
  return (Array.isArray(turmas) ? turmas : []).filter(
    (t) => !set.has(norm(t?.nome_da_turma))
  );
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

    const modalidadesRef = admin.database().ref("modalidades");
    const snap = await modalidadesRef.once("value");
    const modalidades = snap.val() || {};

    const modA = modalidades[modalidadeOrigemA];
    const modB = modalidades[modalidadeOrigemB];
    const modDest = modalidades[modalidadeDestino];

    if (!modA?.turmas || !modB?.turmas) {
      return res.status(404).json({ error: "Turmas de origem não encontradas." });
    }

    const turmaObjA = (modA.turmas as any[]).find(
      (t) => norm(t?.nome_da_turma) === norm(nomeDaTurmaA)
    );
    const turmaObjB = (modB.turmas as any[]).find(
      (t) => norm(t?.nome_da_turma) === norm(nomeDaTurmaB)
    );

    if (!turmaObjA || !turmaObjB) {
      return res.status(404).json({ error: "Turma A ou B não encontrada." });
    }

    const alunosA = Array.isArray(turmaObjA?.alunos) ? turmaObjA.alunos : [];
    const alunosB = Array.isArray(turmaObjB?.alunos) ? turmaObjB.alunos : [];
    const mergedAlunos = dedupeAlunos([...alunosA, ...alunosB]);

    const newTurmaObj = {
      ...novaTurma,
      modalidade: modalidadeDestino,
      capacidade_atual_da_turma: mergedAlunos.length,
      alunos: mergedAlunos,
    };

    // caminhos
    const pathA   = `modalidades/${modalidadeOrigemA}/turmas`;
    const pathB   = `modalidades/${modalidadeOrigemB}/turmas`;
    const pathDst = `modalidades/${modalidadeDestino}/turmas`;

    const sameOrigin = modalidadeOrigemA === modalidadeOrigemB;

    const updates: Record<string, any> = {};

    if (sameOrigin) {
      // ambas as turmas estão NO MESMO array
      const base = modA.turmas as any[];
      // remove A e B de uma vez
      const removedAB = removeByNames(base, [nomeDaTurmaA, nomeDaTurmaB]);

      if (modalidadeDestino === modalidadeOrigemA) {
        // destino é essa mesma modalidade: grava UMA VEZ com ambas removidas + nova
        updates[pathDst] = [...removedAB, newTurmaObj];
      } else {
        // destino é outra modalidade: grava origem sem A e B; destino com nova turma
        updates[pathA] = removedAB;
        const destBase = (modDest?.turmas as any[]) || [];
        updates[pathDst] = [...destBase, newTurmaObj];
      }
    } else {
      // origens em modalidades diferentes
      const baseA = modA.turmas as any[];
      const baseB = modB.turmas as any[];

      const removedA = removeByNames(baseA, [nomeDaTurmaA]);
      const removedB = removeByNames(baseB, [nomeDaTurmaB]);

      if (modalidadeDestino === modalidadeOrigemA) {
        // destino = A
        updates[pathA] = [...removedA, newTurmaObj];
        updates[pathB] = removedB;
      } else if (modalidadeDestino === modalidadeOrigemB) {
        // destino = B
        updates[pathA] = removedA;
        updates[pathB] = [...removedB, newTurmaObj];
      } else {
        // destino diferente de ambas
        updates[pathA] = removedA;
        updates[pathB] = removedB;
        const destBase = (modDest?.turmas as any[]) || [];
        updates[pathDst] = [...destBase, newTurmaObj];
      }
    }

    await admin.database().ref().update(updates);

    return res.status(200).json({
      message: "Turmas fundidas com sucesso.",
      mergedCount: mergedAlunos.length,
    });
  } catch (error) {
    console.error("Erro ao fundir turmas:", error);
    return res.status(500).json({ error: "Erro interno ao fundir turmas." });
  }
}
