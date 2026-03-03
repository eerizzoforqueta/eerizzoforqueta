import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm, SubmitHandler } from "react-hook-form";
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
import { extrairDiaDaSemana, gerarPresencasParaAlunoSemestre } from "@/utils/Constants";
import { useData } from "@/context/context";
import { FormValuesStudent, Turma } from "@/interface/interfaces";

interface TemporaryStudentRegistrationProps {
  handleCloseModal: () => void;
}

// semestre automático:
const SEMESTRE_PADRAO: "primeiro" | "segundo" =
  new Date().getMonth() + 1 <= 6 ? "primeiro" : "segundo";

type TemporaryFormValues = {
  alunoNome: string;
  modalidade: string;
  turmaSelecionada: string;
};

export default function TemporaryStudentRegistration({
  handleCloseModal,
}: TemporaryStudentRegistrationProps) {
  const { modalidades, fetchModalidades, sendDataToApi } = useData();

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm<TemporaryFormValues>({
    defaultValues: {
      alunoNome: "",
      modalidade: "",
      turmaSelecionada: "",
    },
  });

  const watchedModalidade = watch("modalidade");
  const watchedTurmaSelecionada = watch("turmaSelecionada");

  const [selectedNucleo, setSelectedNucleo] = useState<string>("");
  const [nucleosDisponiveis, setNucleosDisponiveis] = useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<Turma[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchModalidades().catch(console.error);
  }, [fetchModalidades]);

  const getNucleosForModalidade = (modalidade: string) => {
    const turmas = modalidades.find((m) => m.nome === modalidade)?.turmas ?? [];
    const nucleos = new Set(turmas.map((t) => t.nucleo).filter(Boolean));
    return Array.from(nucleos);
  };

  // Quando muda modalidade: atualiza núcleos e reseta nucleo/turma
  useEffect(() => {
    if (!watchedModalidade) {
      setNucleosDisponiveis([]);
      setSelectedNucleo("");
      setTurmasDisponiveis([]);
      setValue("turmaSelecionada", "");
      return;
    }

    const nucleos = getNucleosForModalidade(watchedModalidade);
    setNucleosDisponiveis(nucleos);
    setSelectedNucleo("");
    setTurmasDisponiveis([]);
    setValue("turmaSelecionada", "");
  }, [watchedModalidade, modalidades, setValue]);

  // Quando muda nucleo: filtra turmas disponíveis e reseta turma
  useEffect(() => {
    if (!watchedModalidade || !selectedNucleo) {
      setTurmasDisponiveis([]);
      setValue("turmaSelecionada", "");
      return;
    }

    const turmasFiltradas =
      modalidades
        .find((m) => m.nome === watchedModalidade)
        ?.turmas.filter((t) => t.nucleo === selectedNucleo) ?? [];

    setTurmasDisponiveis(turmasFiltradas);
    setValue("turmaSelecionada", "");
  }, [selectedNucleo, watchedModalidade, modalidades, setValue]);

  const onSubmit: SubmitHandler<TemporaryFormValues> = async (data) => {
    setIsUpdating(true);

    try {
      const currentDate = new Date().toLocaleDateString("pt-BR");
      const anoLetivo = new Date().getFullYear();

      const diaDaSemana = extrairDiaDaSemana(data.turmaSelecionada);
      const presencas = gerarPresencasParaAlunoSemestre(
        diaDaSemana,
        SEMESTRE_PADRAO,
        anoLetivo
      );

      // Monta payload final compatível com a API existente
      const payload: FormValuesStudent = {
        modalidade: data.modalidade,
        turmaSelecionada: data.turmaSelecionada,
        nucleoSelecionado: selectedNucleo,
        aluno: {
          // id: se seu backend atribui automaticamente, pode remover.
          // Mantido para compatibilidade caso a tipagem exija.
          id: Date.now(),
          nome: data.alunoNome.trim(),
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
        } as any, // Se sua interface Aluno exigir campos extras não usados aqui, ajuste e remova este cast.
      };

      await sendDataToApi([payload]);

      setSuccessMessage("Aluno temporário adicionado com sucesso.");

      // ✅ principal correção: limpar APENAS o nome, mantendo modalidade/núcleo/turma
      reset({
        alunoNome: "",
        modalidade: data.modalidade,
        turmaSelecionada: data.turmaSelecionada,
      });
      // mantém selectedNucleo e turmasDisponiveis para cadastro em sequência

    } catch (error) {
      console.error("Erro ao enviar os dados do formulário", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const canSubmit =
    !isSubmitting &&
    !isUpdating &&
    Boolean(watch("alunoNome")?.trim()) &&
    Boolean(watchedModalidade) &&
    Boolean(selectedNucleo) &&
    Boolean(watchedTurmaSelecionada);

  return (
    <Container>
      <Paper sx={modalStyleTemporaly}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Typography sx={TituloSecaoStyle}>
            Cadastro de Alunos Temporários
          </Typography>

          <Grid container spacing={2} justifyContent="center" alignItems="center">
            <Grid item xs={12}>
              <Controller
                name="alunoNome"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Nome do Aluno"
                    variant="standard"
                    required
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="modalidade"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    required
                    label="Modalidade"
                    fullWidth
                    variant="outlined"
                    sx={{ marginBottom: 2 }}
                  >
                    {modalidades
                      .filter(
                        (m) =>
                          m.nome !== "arquivados" &&
                          m.nome !== "excluidos"
                      )
                      .map((modalidade) => (
                        <MenuItem key={modalidade.nome} value={modalidade.nome}>
                          {modalidade.nome}
                        </MenuItem>
                      ))}
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Local de treinamento"
                value={selectedNucleo}
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
              <Controller
                name="turmaSelecionada"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Turma"
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
                )}
              />
            </Grid>

            {/* Botões */}
            <Grid item xs={12} sm={6}>
              <Button type="submit" variant="contained" disabled={!canSubmit} fullWidth>
                {isUpdating ? "Cadastrando... aguarde" : "Cadastrar aluno"}
              </Button>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Button variant="contained" color="error" onClick={handleCloseModal} fullWidth>
                Fechar Cadastro
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage}
      />
    </Container>
  );
}