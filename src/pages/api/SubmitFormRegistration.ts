// src/pages/api/submitForm.ts
import type { NextApiRequest, NextApiResponse } from "next";
import admin from "../../config/firebaseAdmin";
import {
  extrairDiaDaSemana,
  gerarPresencasParaAlunoSemestre,
  normalizeName,
} from "@/utils/Constants";

const db = admin.database();

type ResultadoItem =
  | { sucesso: true; aluno: any }
  | { sucesso: false; erro: string; aluno: any };

function safeString(v: any) {
  return String(v ?? "").trim();
}

function getAnoAtual() {
  return new Date().getFullYear();
}

function getSemestreAtual(): "primeiro" | "segundo" {
  const mes = new Date().getMonth() + 1; // 1..12
  return mes < 7 ? "primeiro" : "segundo";
}

function nextNumericKey(obj: Record<string, any>): number {
  const keys = Object.keys(obj || {});
  let max = 0;
  for (const k of keys) {
    const n = Number(k);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

export default async function submitForm(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const alunos = Array.isArray(req.body) ? req.body : [req.body];
  const resultados: ResultadoItem[] = [];

  const anoLetivo = getAnoAtual(); // ✅ ano automático
  const semestre = getSemestreAtual(); // ✅ semestre automático

  for (const alunoData of alunos) {
    try {
      const modalidade = safeString(alunoData?.modalidade);
      const turmaSelecionada = safeString(alunoData?.turmaSelecionada);
      const aluno = alunoData?.aluno;

      if (!modalidade) {
        resultados.push({ sucesso: false, erro: "Modalidade não fornecida.", aluno });
        continue;
      }

      if (!turmaSelecionada) {
        resultados.push({ sucesso: false, erro: "Nome da turma não fornecido.", aluno });
        continue;
      }

      if (!aluno || !safeString(aluno?.nome)) {
        resultados.push({ sucesso: false, erro: "Dados do aluno inválidos (nome ausente).", aluno });
        continue;
      }

      // ✅ Presenças geradas conforme dia da semana da turma + ano atual
      const diaDaSemana = (extrairDiaDaSemana(turmaSelecionada) ?? "SEGUNDA") as string;
      aluno.presencas = gerarPresencasParaAlunoSemestre(diaDaSemana, semestre, anoLetivo);

      // 1) achar a turma pelo nome
      const turmaQuery = db
        .ref(`modalidades/${modalidade}/turmas`)
        .orderByChild("nome_da_turma")
        .equalTo(turmaSelecionada);

      const snapshot = await turmaQuery.once("value");

      if (!snapshot.exists()) {
        resultados.push({ sucesso: false, erro: "Turma não encontrada.", aluno });
        continue;
      }

      const turmaData = snapshot.val() || {};
      const turmaKey = Object.keys(turmaData)[0];
      const turma = turmaData[turmaKey];

      if (!turma) {
        resultados.push({ sucesso: false, erro: "Turma inválida (registro vazio).", aluno });
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

      // 2) carregar alunos existentes
      const alunosRef = db.ref(`modalidades/${modalidade}/turmas/${turmaKey}/alunos`);
      const alunosSnapshot = await alunosRef.once("value");
      const alunosExistem: Record<string, any> = alunosSnapshot.val() || {};

      // 3) verificação de duplicidade (prioriza IdentificadorUnico se existir)
      const idu = safeString(aluno?.informacoesAdicionais?.IdentificadorUnico);

      if (idu) {
        const duplicadoPorIdu = Object.values(alunosExistem).some((a: any) => {
          const otherIdu = safeString(a?.informacoesAdicionais?.IdentificadorUnico);
          return otherIdu && otherIdu === idu;
        });

        if (duplicadoPorIdu) {
          resultados.push({ sucesso: false, erro: "Aluno já cadastrado nesta turma (IdentificadorUnico).", aluno });
          continue;
        }
      } else {
        // fallback: nome + nascimento
        const nomeAlunoNormalizado = normalizeName(aluno.nome);
        const nascNorm = normalizeName(aluno.anoNascimento);

        const duplicadoPorNome = Object.values(alunosExistem).some((alunoExistente: any) => {
          const nomeExistenteNormalizado = normalizeName(alunoExistente?.nome);
          const nascExist = normalizeName(alunoExistente?.anoNascimento);
          return nomeExistenteNormalizado === nomeAlunoNormalizado && nascExist === nascNorm;
        });

        if (duplicadoPorNome) {
          resultados.push({ sucesso: false, erro: "Aluno já cadastrado nesta turma.", aluno });
          continue;
        }
      }

      // 4) novo id numérico seguro
      const novoIdAluno = nextNumericKey(alunosExistem);
      aluno.id = novoIdAluno;

      // 5) grava aluno e atualiza contadores
      await alunosRef.child(String(novoIdAluno)).set(aluno);

      await db.ref(`modalidades/${modalidade}/turmas/${turmaKey}`).update({
        capacidade_atual_da_turma: capAtual + 1,
        contadorAlunos: novoIdAluno,
      });

      resultados.push({ sucesso: true, aluno });
    } catch (err: any) {
      resultados.push({
        sucesso: false,
        erro: err?.message || String(err) || "Erro inesperado ao cadastrar aluno.",
        aluno: alunoData?.aluno,
      });
    }
  }

  return res.status(200).json({ resultados });
}
