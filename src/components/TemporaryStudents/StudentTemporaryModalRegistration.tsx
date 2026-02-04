import React, { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import {
  Button,
  Container,
  Grid,
  TextField,
  Typography,
  MenuItem,
  Paper,
  Snackbar,
} from "@mui/material";
import { v4 as uuidv4 } from "uuid";
import { TituloSecaoStyle, modalStyleTemporaly } from "@/utils/Styles";
import {
  extrairDiaDaSemana,
  gerarPresencasParaAlunoSemestre,
} from "@/utils/Constants";
import { useData } from "@/context/context";
import { FormValuesStudent, Turma } from "@/interface/interfaces";

interface TemporaryStudentRegistrationProps {
  handleCloseModal: () => void;
}

// Se você quiser semestre automático:
const SEMESTRE_PADRAO: "primeiro" | "segundo" =
  (new Date().getMonth() + 1) <= 6 ? "primeiro" : "segundo";


export default function TemporaryStudentRegistration({
  handleCloseModal,
}: TemporaryStudentRegistrationProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValuesStudent>({
    defaultValues: {
      modalidade: "",
      turmaSelecionada: "",
      aluno: { nome: "" } as any,
    },
  });

  const { modalidades, fetchModalidades, sendDataToApi } = useData();

  const [selectedNucleo, setSelectedNucleo] = useState<string>("");
  const [nucleosDisponiveis, setNucleosDisponiveis] = useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<Turma[]>([]);
  const [studentName, setStudentName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const watchedModalidade = watch("modalidade");
  const watchedTurmaSelecionada = watch("turmaSelecionada");

  useEffect(() => {
    fetchModalidades().catch(console.error);
  }, [fetchModalidades]);

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setStudentName(event.target.value);
  };

  const getNucleosForModalidade = (modalidade: string) => {
    const turmas = modalidades.find((m) => m.nome === modalidade)?.turmas;
    if (!turmas) return [];
    const nucleos = new Set(
      turmas.map((turma) => turma.nucleo).filter(Boolean)
    );
    return Array.from(nucleos);
  };

  // quando muda modalidade: atualiza nucleos e reseta nucleo/turmas
  useEffect(() => {
    const nucleos = getNucleosForModalidade(watchedModalidade);
    setNucleosDisponiveis(nucleos);
    setSelectedNucleo("");
    setTurmasDisponiveis([]);
  }, [watchedModalidade, modalidades]);

  // quando muda nucleo: filtra turmas disponíveis
  useEffect(() => {
    if (!watchedModalidade || !selectedNucleo) {
      setTurmasDisponiveis([]);
      return;
    }

    const turmasFiltradas =
      modalidades
        .find((m) => m.nome === watchedModalidade)
        ?.turmas.filter((turma) => turma.nucleo === selectedNucleo) || [];

    setTurmasDisponiveis(turmasFiltradas);
  }, [selectedNucleo, watchedModalidade, modalidades]);

  const onSubmit: SubmitHandler<FormValuesStudent> = async (data) => {
    setIsUpdating(true);

    try {
      const currentDate = new Date().toLocaleDateString("pt-BR");

      // ✅ Ano letivo automático (ano atual)
      const anoLetivo = new Date().getFullYear();

      // ✅ Dia da semana a partir do nome da turma
      const diaDaSemana = extrairDiaDaSemana(data.turmaSelecionada);

      // ✅ Presenças geradas com ano atual
      const presencas = gerarPresencasParaAlunoSemestre(
        diaDaSemana,
        SEMESTRE_PADRAO,
        anoLetivo
      );

      // Construindo o objeto aluno com valores padrão
      data.aluno = {
        ...data.aluno,
        nome: studentName || data?.aluno?.nome || "",
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
            ruaAvenida: "-",
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
            nomeCompleto: "-",
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
          desconto: "Não aplicável",
        },
        presencas,
        foto: "-",
      };

      await sendDataToApi([data]);

      setSuccessMessage("Aluno temporário adicionado com sucesso.");
      reset();
      setSelectedNucleo("");
      setTurmasDisponiveis([]);
      setStudentName("");
    } catch (error) {
      console.error("Erro ao enviar os dados do formulário", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Container>
      <Paper sx={modalStyleTemporaly}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Typography sx={TituloSecaoStyle}>
            Cadastro de Alunos Temporários
          </Typography>

          <Grid container spacing={2} justifyContent="center" alignItems="center">
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome do Aluno"
                variant="standard"
                {...register("aluno.nome")}
                required
                value={studentName}
                onChange={handleNameChange}
              />
            </Grid>

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
                value={selectedNucleo || ""}
                onChange={(event) => setSelectedNucleo(event.target.value as string)}
                fullWidth
                required
                variant="outlined"
                sx={{ marginBottom: 2 }}
                disabled={!watchedModalidade}
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
                disabled={!selectedNucleo}
              >
                {turmasDisponiveis.map((turma) => (
                  <MenuItem key={turma.nome_da_turma} value={turma.nome_da_turma}>
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
                disabled={
                  isSubmitting ||
                  isUpdating ||
                  !watchedModalidade ||
                  !selectedNucleo ||
                  !watchedTurmaSelecionada
                }
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
