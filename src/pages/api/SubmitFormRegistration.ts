import type { NextApiRequest, NextApiResponse } from "next";
import admin from "../../config/firebaseAdmin";
import {
  extrairDiaDaSemana,
  gerarPresencasParaAlunoSemestre,
  normalizeName,
} from "@/utils/Constants";

const db = admin.database();

type ResultadoItem =
  | { sucesso: true; aluno: unknown }
  | { sucesso: false; erro: string; aluno: unknown };

type TurmaRegistro = {
  nome_da_turma?: string;
  capacidade_atual_da_turma?: number;
  capacidade_maxima_da_turma?: number;
  contadorAlunos?: number;
  diaDaSemana?: string;
};

function safeString(v: unknown): string {
  return String(v ?? "").trim();
}

function getAnoAtual(): number {
  return new Date().getFullYear();
}

function getSemestreAtual(): "primeiro" | "segundo" {
  const mes = new Date().getMonth() + 1;
  return mes < 7 ? "primeiro" : "segundo";
}

function nextNumericKey(obj: Record<string, unknown>): number {
  const keys = Object.keys(obj || {});
  let max = 0;
  for (const k of keys) {
    const n = Number(k);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

export default async function submitForm(
  req: NextApiRequest,
  res: NextApiResponse<{ resultados: ResultadoItem[] } | { message: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const alunosPayload = Array.isArray(req.body) ? req.body : [req.body];
  const resultados: ResultadoItem[] = [];

  const anoLetivo = getAnoAtual();
  const semestre = getSemestreAtual();

  for (const alunoData of alunosPayload) {
    try {
      const modalidade = safeString(alunoData?.modalidade);
      const turmaSelecionada = safeString(alunoData?.turmaSelecionada);
      const aluno = alunoData?.aluno as Record<string, unknown> | undefined;

      if (!modalidade) {
        resultados.push({
          sucesso: false,
          erro: "Modalidade não fornecida.",
          aluno,
        });
        continue;
      }

      if (!turmaSelecionada) {
        resultados.push({
          sucesso: false,
          erro: "Nome da turma não fornecido.",
          aluno,
        });
        continue;
      }

      if (!aluno || !safeString(aluno?.nome)) {
        resultados.push({
          sucesso: false,
          erro: "Dados do aluno inválidos (nome ausente).",
          aluno,
        });
        continue;
      }

      const turmaQuery = db
        .ref(`modalidades/${modalidade}/turmas`)
        .orderByChild("nome_da_turma")
        .equalTo(turmaSelecionada);

      const snapshot = await turmaQuery.once("value");

      if (!snapshot.exists()) {
        resultados.push({
          sucesso: false,
          erro: "Turma não encontrada.",
          aluno,
        });
        continue;
      }

      const turmaData = snapshot.val() as Record<string, TurmaRegistro>;
      const turmaKey = Object.keys(turmaData)[0];
      const turma = turmaData[turmaKey];

      if (!turma) {
        resultados.push({
          sucesso: false,
          erro: "Turma inválida (registro vazio).",
          aluno,
        });
        continue;
      }

      const capAtual = Number(turma.capacidade_atual_da_turma ?? 0);
      const capMax = Number(turma.capacidade_maxima_da_turma ?? 0);

      if (capMax > 0 && capAtual >= capMax) {
        resultados.push({
          sucesso: false,
          erro: `Não há vagas disponíveis na turma ${turma.nome_da_turma}.`,
          aluno,
        });
        continue;
      }

      const diaDaSemana =
        safeString(turma.diaDaSemana) ||
        safeString(extrairDiaDaSemana(turma.nome_da_turma ?? "")) ||
        "SEGUNDA";

      (aluno as Record<string, unknown>).presencas = gerarPresencasParaAlunoSemestre(
        diaDaSemana,
        semestre,
        anoLetivo
      );

      const alunosRef = db.ref(`modalidades/${modalidade}/turmas/${turmaKey}/alunos`);
      const alunosSnapshot = await alunosRef.once("value");
      const alunosExistem = (alunosSnapshot.val() || {}) as Record<string, Record<string, unknown>>;

      const informacoesAdicionais =
        (aluno.informacoesAdicionais as Record<string, unknown> | undefined) ?? {};
      const idu = safeString(informacoesAdicionais?.IdentificadorUnico);

      if (idu) {
        const duplicadoPorIdu = Object.values(alunosExistem).some((a) => {
          const info = (a?.informacoesAdicionais as Record<string, unknown> | undefined) ?? {};
          const otherIdu = safeString(info?.IdentificadorUnico);
          return otherIdu && otherIdu === idu;
        });

        if (duplicadoPorIdu) {
          resultados.push({
            sucesso: false,
            erro: "Aluno já cadastrado nesta turma (IdentificadorUnico).",
            aluno,
          });
          continue;
        }
      } else {
        const nomeAlunoNormalizado = normalizeName(safeString(aluno.nome));
        const nascNorm = normalizeName(safeString(aluno.anoNascimento));

        const duplicadoPorNome = Object.values(alunosExistem).some((alunoExistente) => {
          const nomeExistenteNormalizado = normalizeName(safeString(alunoExistente?.nome));
          const nascExist = normalizeName(safeString(alunoExistente?.anoNascimento));
          return (
            nomeExistenteNormalizado === nomeAlunoNormalizado &&
            nascExist === nascNorm
          );
        });

        if (duplicadoPorNome) {
          resultados.push({
            sucesso: false,
            erro: "Aluno já cadastrado nesta turma.",
            aluno,
          });
          continue;
        }
      }

      const novoIdAluno = nextNumericKey(alunosExistem);
      (aluno as Record<string, unknown>).id = novoIdAluno;

      const updates: Record<string, unknown> = {};
      updates[`modalidades/${modalidade}/turmas/${turmaKey}/alunos/${novoIdAluno}`] = aluno;
      updates[`modalidades/${modalidade}/turmas/${turmaKey}/capacidade_atual_da_turma`] = capAtual + 1;
      updates[`modalidades/${modalidade}/turmas/${turmaKey}/contadorAlunos`] = Math.max(
        Number(turma.contadorAlunos ?? 0),
        novoIdAluno
      );

      await db.ref().update(updates);

      resultados.push({ sucesso: true, aluno });
    } catch (err: unknown) {
      resultados.push({
        sucesso: false,
        erro:
          err instanceof Error
            ? err.message
            : "Erro inesperado ao cadastrar aluno.",
        aluno: alunoData?.aluno,
      });
    }
  }

  return res.status(200).json({ resultados });
}