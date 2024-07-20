import React, { useCallback, useContext, useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import {
  TextField,
  Button,
  Box,
  Autocomplete,
  Container,
  Typography,
  Modal,
} from "@mui/material";
import { DataContext } from "@/context/context";
import {
  Aluno,
  Modalidade,
  TemporaryMoveStudentsPayload,
  Turma,
} from "@/interface/interfaces";
import { BoxStyleCadastro } from "@/utils/Styles";
import axios from "axios";

function CopyStudent({
  alunoNome,
  nomeDaTurmaOrigem,
  modalidadeOrigem,
}: {
  alunoNome: string;
  nomeDaTurmaOrigem: string;
  modalidadeOrigem: string;
}) {
  const { copyStudentTemp, modalidades, fetchModalidades } =
    useContext(DataContext);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<TemporaryMoveStudentsPayload>();
  const [turmasDestinoOptions, setTurmasDestinoOptions] = useState<Turma[]>([]);
  const [modalidadesOptions, setModalidadesOptions] = useState<Modalidade[]>(
    []
  );
  const [open, setOpen] = useState<boolean>(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  useEffect(() => {
    fetchModalidades().catch(console.error);
  }, [fetchModalidades]);

  useEffect(() => {
    setModalidadesOptions(modalidades);
  }, [modalidades]);

  useEffect(() => {
    const modalidadeSelecionada = modalidades.find(
      (mod) => mod.nome === watch("modalidadeDestino")
    );
    setTurmasDestinoOptions(modalidadeSelecionada?.turmas || []);
  }, [watch("modalidadeDestino"), modalidades]);

  const onSubmit: SubmitHandler<TemporaryMoveStudentsPayload> = useCallback(
    async (data) => {
      try {
        const payload: TemporaryMoveStudentsPayload = {
          alunoNome: data.alunoNome,
          modalidadeOrigem: data.modalidadeOrigem,
          nomeDaTurmaOrigem: data.nomeDaTurmaOrigem,
          modalidadeDestino: watch("modalidadeDestino"),
          nomeDaTurmaDestino: watch("nomeDaTurmaDestino"),
        };
        await copyStudentTemp(payload);

        // Ajustar dados da turma de origem e destino
        await axios.post('/api/ajustardadosdaturma', {
          modalidadeNome: modalidadeOrigem,
          turmaNome: nomeDaTurmaOrigem
        });

        await axios.post('/api/ajustardadosdaturma', {
          modalidadeNome: payload.modalidadeDestino,
          turmaNome: payload.nomeDaTurmaDestino
        });

        reset();
        alert("Aluno copiado com sucesso.");
      } catch (error) {
        console.error("Erro ao mover aluno", error);
        alert("Erro ao copiar aluno.");
      }
    },
    [copyStudentTemp, reset, modalidadeOrigem, nomeDaTurmaOrigem, watch]
  );

  return (
    <>
      <Button variant="contained" color="success" onClick={handleOpen}>
        Copiar Aluno
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          sx={BoxStyleCadastro}
        >
          <Typography
            variant="h6"
            sx={{ color: "black", fontWeight: "bold", textAlign: "center" }}
          >
            COPIAR ALUNO PARA OUTRA TURMA
          </Typography>
          <TextField
            margin="normal"
            fullWidth
            label="Nome"
            value={alunoNome}
            {...register("alunoNome")}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            margin="normal"
            fullWidth
            {...register("modalidadeOrigem")}
            label="Modalidade de Origem(não alterar!)"
            value={modalidadeOrigem}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            margin="normal"
            fullWidth
            {...register("nomeDaTurmaOrigem")}
            label="Turma de Origem(não alterar!)"
            value={nomeDaTurmaOrigem}
            InputLabelProps={{ shrink: true }}
          />
          <Autocomplete
            options={modalidadesOptions}
            getOptionLabel={(option) => option.nome}
            onChange={(_, newValue) =>
              setValue("modalidadeDestino", newValue?.nome ?? "")
            }
            renderInput={(params) => (
              <TextField
                {...params}
                {...register("modalidadeDestino")}
                label="Modalidade de Destino"
                margin="normal"
                required
                fullWidth
                error={!!errors.modalidadeDestino}
                helperText={
                  errors.modalidadeDestino?.message ||
                  "Selecione a modalidade de destino"
                }
              />
            )}
          />
          <Autocomplete
            options={turmasDestinoOptions}
            getOptionLabel={(option) => option.nome_da_turma}
            onChange={(_, newValue) =>
              setValue("nomeDaTurmaDestino", newValue?.nome_da_turma ?? "")
            }
            renderInput={(params) => (
              <TextField
                {...params}
                {...register("nomeDaTurmaDestino")}
                label="Nome da Turma de Destino"
                margin="normal"
                required
                fullWidth
                error={!!errors.nomeDaTurmaDestino}
                helperText={
                  errors.nomeDaTurmaDestino?.message ||
                  "Selecione a turma de destino"
                }
              />
            )}
          />
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting
              ? "Enviando dados aguarde..."
              : "COPIAR ALUNO"}
          </Button>
        </Box>
      </Modal>
    </>
  );
}

interface MoveAllStudentsProps {
  alunoNome: string;
  nomeDaTurmaOrigem: string;
  modalidadeOrigem: string;
}

function areEqual(
  prevProps: MoveAllStudentsProps,
  nextProps: MoveAllStudentsProps
) {
  return (
    prevProps.alunoNome === nextProps.alunoNome &&
    prevProps.nomeDaTurmaOrigem === nextProps.nomeDaTurmaOrigem &&
    prevProps.modalidadeOrigem === nextProps.modalidadeOrigem
  );
}

export const CopyStudentMemo = React.memo(CopyStudent, areEqual);
