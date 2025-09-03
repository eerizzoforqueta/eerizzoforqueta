// src/components/MergeTurmasForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Container,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { useData } from "@/context/context";
import { Modalidade, Turma } from "@/interface/interfaces";

type NewTurmaFields = {
  nome_da_turma: string;
  nucleo: string;
  categoria: string;
  capacidade_maxima_da_turma: number;
  diaDaSemana?: string;
  horario?: string;
};

export default function MergeTurmasForm() {
  const { fetchModalidades } = useData();

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loadingModalidades, setLoadingModalidades] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // seleção de origem A
  const [modalidadeOrigemA, setModalidadeOrigemA] = useState<string>("");
  const [turmaA, setTurmaA] = useState<string>("");

  // seleção de origem B
  const [modalidadeOrigemB, setModalidadeOrigemB] = useState<string>("");
  const [turmaB, setTurmaB] = useState<string>("");

  // seleção de destino + campos da nova turma
  const [modalidadeDestino, setModalidadeDestino] = useState<string>("");
  const [novaTurma, setNovaTurma] = useState<NewTurmaFields>({
    nome_da_turma: "",
    nucleo: "",
    categoria: "",
    capacidade_maxima_da_turma: 40,
    diaDaSemana: "",
    horario: "",
  });

  // carregar modalidades
  useEffect(() => {
    (async () => {
      setLoadingModalidades(true);
      try {
        const mods = await fetchModalidades();
        setModalidades(mods || []);
      } catch (e) {
        console.error(e);
        setErrorMsg("Falha ao carregar modalidades.");
      } finally {
        setLoadingModalidades(false);
      }
    })();
  }, [fetchModalidades]);

  const turmasDaModalidadeA: Turma[] = useMemo(() => {
    return modalidades.find((m) => m.nome === modalidadeOrigemA)?.turmas || [];
  }, [modalidades, modalidadeOrigemA]);

  const turmasDaModalidadeB: Turma[] = useMemo(() => {
    return modalidades.find((m) => m.nome === modalidadeOrigemB)?.turmas || [];
  }, [modalidades, modalidadeOrigemB]);

  const turmasDaModalidadeDestino: Turma[] = useMemo(() => {
    return modalidades.find((m) => m.nome === modalidadeDestino)?.turmas || [];
  }, [modalidades, modalidadeDestino]);

  function handleChangeNovaTurma<K extends keyof NewTurmaFields>(
    key: K,
    value: NewTurmaFields[K]
  ) {
    setNovaTurma((prev) => ({ ...prev, [key]: value }));
  }

  async function handleMerge() {
    setErrorMsg(null);
    setResultMsg(null);

    // validações
    if (
      !modalidadeOrigemA ||
      !turmaA ||
      !modalidadeOrigemB ||
      !turmaB ||
      !modalidadeDestino ||
      !novaTurma.nome_da_turma ||
      !novaTurma.categoria ||
      !novaTurma.nucleo
    ) {
      setErrorMsg("Preencha todos os campos obrigatórios.");
      return;
    }

    // evitar mesma turma escolhida 2x
    if (
      modalidadeOrigemA === modalidadeOrigemB &&
      turmaA === turmaB
    ) {
      setErrorMsg("Selecione turmas diferentes para fundir.");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch("/api/mergeTurmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modalidadeOrigemA,
          nomeDaTurmaA: turmaA,
          modalidadeOrigemB,
          nomeDaTurmaB: turmaB,
          modalidadeDestino,
          novaTurma,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "Erro ao fundir turmas.");
      }

      setResultMsg(
        `Turmas fundidas com sucesso! Nova turma: "${novaTurma.nome_da_turma}". Alunos mesclados: ${data.mergedCount}.`
      );

      // reset leve (mantém modalidades já carregadas)
      setTurmaA("");
      setTurmaB("");
      setNovaTurma((p) => ({ ...p, nome_da_turma: "" }));

    } catch (e: any) {
      setErrorMsg(e.message || "Falha na fusão das turmas.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container maxWidth="md" sx={{ my: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: "bold",textAlign:"center" }}>
         Mesclar Turmas
        </Typography>
         <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
         Instruções:
        </Typography>
  <ol>
            <li>Selecione as turmas para unir(busque as turmas selecionado primeiro a modalidade)</li>
            <li>Digite os dados da nova turma e clique em "fundir turmas" </li>
         </ol>
         <br/>

        {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
        {resultMsg && <Alert severity="success" sx={{ mb: 2 }}>{resultMsg}</Alert>}

        <Grid container spacing={2}>
          {/* Origem A */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Origem A</Typography>
            <TextField
              select
              label="Modalidade (A)"
              fullWidth
              value={modalidadeOrigemA}
              onChange={(e) => setModalidadeOrigemA(e.target.value)}
              disabled={loadingModalidades}
              sx={{ mb: 1 }}
            >
              {modalidades.map((m) => (
                <MenuItem key={m.nome} value={m.nome}>
                  {m.nome}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Turma (A)"
              fullWidth
              value={turmaA}
              onChange={(e) => setTurmaA(e.target.value)}
              disabled={!modalidadeOrigemA}
            >
              {turmasDaModalidadeA.map((t) => (
                <MenuItem key={`${t.nome_da_turma}`} value={t.nome_da_turma}>
                  {t.nome_da_turma}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Origem B */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Origem B</Typography>
            <TextField
              select
              label="Modalidade (B)"
              fullWidth
              value={modalidadeOrigemB}
              onChange={(e) => setModalidadeOrigemB(e.target.value)}
              disabled={loadingModalidades}
              sx={{ mb: 1 }}
            >
              {modalidades.map((m) => (
                <MenuItem key={m.nome} value={m.nome}>
                  {m.nome}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Turma (B)"
              fullWidth
              value={turmaB}
              onChange={(e) => setTurmaB(e.target.value)}
              disabled={!modalidadeOrigemB}
            >
              {turmasDaModalidadeB.map((t) => (
                <MenuItem key={`${t.nome_da_turma}`} value={t.nome_da_turma}>
                  {t.nome_da_turma}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Destino */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Nova Turma (Destino)
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              select
              label="Modalidade Destino"
              fullWidth
              value={modalidadeDestino}
              onChange={(e) => setModalidadeDestino(e.target.value)}
            >
              {modalidades.map((m) => (
                <MenuItem key={m.nome} value={m.nome}>
                  {m.nome}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Nome da Nova Turma"
              fullWidth
              value={novaTurma.nome_da_turma}
              onChange={(e) => handleChangeNovaTurma("nome_da_turma", e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              label="Núcleo"
              fullWidth
              value={novaTurma.nucleo}
              onChange={(e) => handleChangeNovaTurma("nucleo", e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              label="Categoria"
              fullWidth
              value={novaTurma.categoria}
              onChange={(e) => handleChangeNovaTurma("categoria", e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              label="Capacidade Máxima"
              type="number"
              fullWidth
              value={novaTurma.capacidade_maxima_da_turma}
              onChange={(e) =>
                handleChangeNovaTurma("capacidade_maxima_da_turma", Number(e.target.value) || 0)
              }
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Dia da Semana (opcional)"
              fullWidth
              value={novaTurma.diaDaSemana}
              onChange={(e) => handleChangeNovaTurma("diaDaSemana", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Horário (opcional)"
              fullWidth
              value={novaTurma.horario}
              onChange={(e) => handleChangeNovaTurma("horario", e.target.value)}
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleMerge}
                disabled={submitting}
              >
                {submitting ? "Processando..." : "Fundir Turmas"}
              </Button>
              <Button variant="outlined" onClick={() => {
                setResultMsg(null); setErrorMsg(null);
              }}>
                Limpar formulário
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}
