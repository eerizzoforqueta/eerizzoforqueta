import React, { useState, useEffect, useCallback } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import {
  Box,
  Grid,
  TextField,
  MenuItem,
  Button,
  List,
  Container,
  Modal,
} from "@mui/material";
import { useData } from "@/context/context";
import { Aluno, FormValuesStudent, Turma } from "@/interface/interfaces";
import { BoxStyleFrequencia, ListStyle } from "@/utils/Styles";
import { ListaDeChamada } from "@/components/ListaDeChamada";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]";
import { GetServerSideProps } from "next";
import { HeaderForm } from "@/components/HeaderDefaultForm";
import Layout from "@/components/TopBarComponents/Layout";
import TemporaryStudentRegistration from "@/components/TemporaryStudents/StudentTemporaryModalRegistration";

type GeneroTurma = "masculino" | "feminino";

export default function StudentPresenceTable() {
  const { modalidades, fetchModalidades } = useData();

  const { handleSubmit, watch, setValue } = useForm<FormValuesStudent>({
    defaultValues: {
      modalidade: "",
      turmaSelecionada: "",
    },
  });

  const [selectedNucleo, setSelectedNucleo] = useState<string>("");
  const [nucleosDisponiveis, setNucleosDisponiveis] = useState<string[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string>("");
  const [alunosDaTurma, setAlunosDaTurma] = useState<Aluno[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Novo: filtro de gênero (apenas futsal)
  const [selectedGenero, setSelectedGenero] = useState<GeneroTurma>("masculino");

  const watchedModalidade = watch("modalidade");
  const isFutsal =
    typeof watchedModalidade === "string" &&
    watchedModalidade.trim().toLowerCase() === "futsal";

  /**
   * Regra híbrida:
   * 1) Se turma.isFeminina estiver definido (boolean), ele é a fonte de verdade.
   * 2) Se estiver ausente, faz fallback por nome contendo "FEMININO" (legado).
   */
  const isTurmaFeminina = useCallback((turma: Turma) => {
    if (typeof turma?.isFeminina === "boolean") return turma.isFeminina;

    const nome = String(turma?.nome_da_turma ?? "");
    return nome.toUpperCase().includes("FEMININO");

    // Alternativa (se houver variações): includes("FEMININ")
  }, []);

  const filterTurmasByGenero = useCallback(
    (turmas: Turma[], genero: GeneroTurma) => {
      if (!isFutsal) return turmas;

      if (genero === "feminino") {
        return turmas.filter((t) => isTurmaFeminina(t));
      }

      // masculino = tudo que NÃO é feminino
      return turmas.filter((t) => !isTurmaFeminina(t));
    },
    [isFutsal, isTurmaFeminina]
  );

  // Carregar modalidades ao montar o componente
  useEffect(() => {
    fetchModalidades().catch(console.error);
  }, [fetchModalidades]);

  // Recalcular núcleos quando modalidade OU gênero mudar (gênero só afeta futsal)
  useEffect(() => {
    if (!watchedModalidade) return;

    const turmasBase =
      modalidades.find((m) => m.nome === watchedModalidade)?.turmas ?? [];

    const turmasFiltradas = filterTurmasByGenero(turmasBase, selectedGenero);

    const nucleos = new Set(
      turmasFiltradas
        .map((turma) => turma.nucleo)
        .filter((nucleo): nucleo is string => Boolean(nucleo))
    );

    setNucleosDisponiveis(Array.from(nucleos));

    // Reset seleções dependentes
    setTurmasDisponiveis([]);
    setSelectedNucleo("");
    setSelectedTurma("");
    setAlunosDaTurma([]);
    setValue("turmaSelecionada", "");
  }, [
    watchedModalidade,
    modalidades,
    selectedGenero,
    filterTurmasByGenero,
    setValue,
  ]);

  // Carregar turmas disponíveis quando o núcleo é selecionado (respeitando gênero no futsal)
  useEffect(() => {
    if (!selectedNucleo || !watchedModalidade) {
      setTurmasDisponiveis([]);
      return;
    }

    const turmasBase =
      modalidades.find((m) => m.nome === watchedModalidade)?.turmas ?? [];

    const turmasPorNucleo = turmasBase.filter(
      (turma) => turma.nucleo === selectedNucleo
    );

    const turmasFinal = filterTurmasByGenero(turmasPorNucleo, selectedGenero);
    setTurmasDisponiveis(turmasFinal);
  }, [
    selectedNucleo,
    watchedModalidade,
    modalidades,
    selectedGenero,
    filterTurmasByGenero,
  ]);

  const handleModalidadeChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      const value = event.target.value as string;
      setValue("modalidade", value);

      // Ao mudar modalidade, normaliza gênero default (apenas para futsal)
      if (value?.trim().toLowerCase() === "futsal") {
        setSelectedGenero("masculino");
      }
    },
    [setValue]
  );

  const handleGeneroChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      const value = event.target.value as GeneroTurma;
      setSelectedGenero(value);
    },
    []
  );

  const handleNucleoChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      const value = event.target.value as string;
      setSelectedNucleo(value);
    },
    []
  );

  const handleTurmaChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      const value = event.target.value as string;
      setSelectedTurma(value);
      setValue("turmaSelecionada", value);
    },
    [setValue]
  );

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const onSubmit: SubmitHandler<FormValuesStudent> = async (data) => {
    const turmaEscolhida = modalidades
      .find((m) => m.nome === data.modalidade)
      ?.turmas.find((t) => t.nome_da_turma === data.turmaSelecionada);

    if (turmaEscolhida && Array.isArray(turmaEscolhida.alunos)) {
      setAlunosDaTurma(turmaEscolhida.alunos);
    }
  };

  const refreshPage = () => {
    alert("Dados salvos com sucesso");
    window.location.reload();
  };

  return (
    <Layout>
      <Container>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={BoxStyleFrequencia}>
            <HeaderForm titulo={"Lista de Chamada"} />
            <List sx={ListStyle}>
              <Grid container spacing={2}>
                {/* Campo para selecionar a modalidade */}
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    required
                    label="Modalidade"
                    value={watchedModalidade}
                    onChange={handleModalidadeChange}
                    fullWidth
                    variant="outlined"
                    sx={{ marginBottom: 2 }}
                  >
                    {modalidades
                      .filter(
                        (modalidade) =>
                          modalidade.nome !== "arquivados" &&
                          modalidade.nome !== "excluidos"
                      )
                      .map((modalidade) => (
                        <MenuItem key={modalidade.nome} value={modalidade.nome}>
                          {modalidade.nome}
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>

                {/* Campo para selecionar gênero (apenas futsal) */}
                {isFutsal && (
                  <Grid item xs={12} sm={4}>
                    <TextField
                      select
                      label="Gênero"
                      value={selectedGenero}
                      onChange={handleGeneroChange}
                      fullWidth
                      variant="outlined"
                      sx={{ marginBottom: 2 }}
                    >
                      <MenuItem value="masculino">Masculino</MenuItem>
                      <MenuItem value="feminino">Feminino</MenuItem>
                    </TextField>
                  </Grid>
                )}

                {/* Campo para selecionar o núcleo */}
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Local de treinamento"
                    value={selectedNucleo}
                    onChange={handleNucleoChange}
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

                {/* Campo para selecionar a turma */}
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Turma"
                    value={selectedTurma}
                    onChange={handleTurmaChange}
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
              </Grid>

              {alunosDaTurma.length > 0 && (
                <ListaDeChamada
                  alunosDaTurma={alunosDaTurma}
                  setAlunosDaTurma={setAlunosDaTurma}
                  modalidade={watchedModalidade}
                  nomeDaTurma={selectedTurma}
                />
              )}
            </List>

            <Button
              sx={{ width: "100%", marginBottom: "8px" }}
              type="submit"
              variant="contained"
            >
              Pesquisar Turma
            </Button>

            <Button
              sx={{ fontSize: "12px" }}
              color="error"
              variant="contained"
              onClick={() => handleOpenModal()}
            >
              Adicionar aluno temporário
            </Button>

            <Button
              sx={{ fontSize: "12px", mt: "8px" }}
              color="success"
              variant="contained"
              onClick={refreshPage}
            >
              Salvar Dados/Atualizar Pagina
            </Button>
          </Box>
        </form>

        <Modal
          open={isModalOpen}
          onClose={handleCloseModal}
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
        >
          <TemporaryStudentRegistration handleCloseModal={handleCloseModal} />
        </Modal>
      </Container>
    </Layout>
  );
}


export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Permitir acesso se o usuário for admin, professor ou auxiliar
  if (
    !session ||
    (session.user.role !== "admin" &&
      session.user.role !== "professor" &&
      session.user.role !== "auxiliar")
  ) {
    return {
      redirect: {
        destination: "/NotAllowPage",
        permanent: false,
      },
    };
  }

  return { props: {} };
};
