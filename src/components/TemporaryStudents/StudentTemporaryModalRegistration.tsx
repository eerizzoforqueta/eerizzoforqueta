import React, { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { Button, Container, Grid, TextField, Typography, MenuItem, Paper, CircularProgress, Snackbar } from "@mui/material";
import { v4 as uuidv4 } from 'uuid';
import {
  TituloSecaoStyle,
  modalStyleTemporaly,
} from "@/utils/Styles";
import { extrairDiaDaSemana, gerarPresencasParaAluno } from "@/utils/Constants";
import { useData } from "@/context/context";
import { FormValuesStudent, Turma } from "@/interface/interfaces";
import { CorrigirDadosDefinitivos } from "@/utils/CorrigirDadosTurmasEmComponetes";


interface TemporaryStudentRegistrationProps {
  handleCloseModal: () => void;
}

export default function TemporaryStudentRegistration({
  handleCloseModal,
}: TemporaryStudentRegistrationProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormValuesStudent>();
  const { modalidades, fetchModalidades, sendDataToApi } = useData();
  const [selectedNucleo, setSelectedNucleo] = useState<string>("");
  const [nucleosDisponiveis, setNucleosDisponiveis] = useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<Turma[]>([]);
  const [studentName, setStudentName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchModalidades();
  }, [fetchModalidades]);

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    setStudentName(newName);
  };

  const onSubmit: SubmitHandler<FormValuesStudent> = async (data) => {
    setIsUpdating(true);
    const currentDate = new Date().toLocaleDateString();
    const presencas = gerarPresencasParaAluno(extrairDiaDaSemana(data.turmaSelecionada));

    // Construindo o objeto aluno com valores padrão e adicionando todos os campos necessários
    data.aluno = {
      ...data.aluno,
      nome: studentName,
      dataMatricula: currentDate,
      anoNascimento: "01/01/1900",
      telefoneComWhatsapp: "-",
      informacoesAdicionais: {
        IdentificadorUnico: uuidv4(),
        cobramensalidade: "Ciente",
        competicao: "Sim",
        convenio: "Nenhum",
        endereco: {
          bairro: "-",
          cep: "0000000",
          complemento: "-",
          numeroResidencia: "-",
          ruaAvenida: "-"
        },
        escolaEstuda: "-",
        filhofuncionarioJBS: "Não",
        filhofuncionariomarcopolo: "Não",
        hasUniforme: false,
        imagem: "Ciente",
        irmaos: "Não",
        nomefuncionarioJBS: "Não",
        nomefuncionariomarcopolo: "Não",
        pagadorMensalidades: {
          celularWhatsapp: "-",
          cpf: "0000000000",
          email: "temporario@gmail.com",
          nomeCompleto: "-"
        },
        problemasaude: "Não",
        rg: "-",
        socioJBS: "Não",
        tipomedicacao: "Nenhum",
        uniforme: "G adulto",
        nucleoTreinamento: selectedNucleo,
        comprometimentoMensalidade: "Não",
        copiaDocumento: "Não",
        avisaAusencia: "Não",
        desconto: "Não aplicável"
      },
      presencas: presencas,
      foto: "-"
    };

    try {
      console.log(data);
      await sendDataToApi([data]); // Enviando os dados do aluno

      // Chamar o endpoint para ajustar os dados da turma
     //CorrigirDadosDefinitivos();

      setSuccessMessage("Aluno temporário adicionado com sucesso.");
      reset(); // Resetando o formulário após o envio
    } catch (error) {
      console.error("Erro ao enviar os dados do formulário", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getNucleosForModalidade = (modalidade: string) => {
    const turmas = modalidades.find((m) => m.nome === modalidade)?.turmas;
    if (!turmas) return [];
    const nucleos = new Set(turmas.map((turma) => turma.nucleo));
    return Array.from(nucleos);
  };

  useEffect(() => {
    const nucleos = getNucleosForModalidade(watch("modalidade"));
    setNucleosDisponiveis(nucleos);
    setSelectedNucleo("");
  }, [watch("modalidade"), modalidades]);

  useEffect(() => {
    const turmasFiltradas = modalidades
      .find((m) => m.nome === watch("modalidade"))
      ?.turmas.filter((turma) => turma.nucleo === selectedNucleo);
    setTurmasDisponiveis(turmasFiltradas || []);
  }, [selectedNucleo, modalidades]);

  return (
    <Container>
     
      <Paper sx={modalStyleTemporaly}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Typography sx={TituloSecaoStyle}>
            Cadastro de Alunos Temporários
          </Typography>
          <Grid
            container
            spacing={2}
            justifyContent="center"
            alignItems="center"
          >
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome do Aluno"
                variant="standard"
                {...register("aluno.nome")}
                required
                onChange={handleNameChange} // Atualiza o nome quando o campo é alterado
              />
            </Grid>
            {/* Restante dos campos do formulário */}
            <Grid item xs={12} sm={4}>
              <TextField
                select
                required
                label="Modalidade"
                {...register("modalidade")}
                fullWidth
                variant="outlined"
                sx={{ marginBottom: 2 }}
              >
                {modalidades.map((modalidade) => (
                  <MenuItem key={modalidade.nome} value={modalidade.nome}>
                    {modalidade.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Local de treinamento"
                value={selectedNucleo ? selectedNucleo : ""}
                onChange={(event) =>
                  setSelectedNucleo(event.target.value as string)
                }
                fullWidth
                required
                variant="outlined"
                sx={{ marginBottom: 2 }}
              >
                {nucleosDisponiveis.map((nucleo) => (
                  <MenuItem key={nucleo} value={nucleo}>
                    {nucleo}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Turma"
                {...register("turmaSelecionada")}
                fullWidth
                required
                variant="outlined"
                sx={{ marginBottom: 2 }}
              >
                {turmasDisponiveis.map((turma) => (
                  <MenuItem
                    key={turma.nome_da_turma}
                    value={turma.nome_da_turma}
                  >
                    {turma.nome_da_turma}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {/* Botões */}
            <Grid item xs={12} sm={6}>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting || isUpdating}
                fullWidth
              >
                {isUpdating ? "Atualizando turma... aguarde" : "Cadastrar aluno"}
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                variant="contained"
                color="error"
                onClick={handleCloseModal}
                fullWidth
              >
                Fechar Cadastro
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage}
      />
    </Container>
  );
}
