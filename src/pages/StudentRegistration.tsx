/* eslint-disable @typescript-eslint/no-unused-vars */
import { useForm, SubmitHandler } from "react-hook-form";
import {
  FormValuesStudent,
  SelecaoModalidadeTurma,
  Turma,
  formValuesStudentSchema,
} from "@/interface/interfaces";
import React, { useEffect, useMemo, useState } from "react";
import {
  fieldsDadosGeraisAtleta,
  fieldsEndereco,
  fieldsIdentificacao,
  fieldsResponsavelMensalidade,
  fieldsTermosAvisos,
  getErrorMessage,
  opcoesTermosAvisos,
  vinculosempresasparceiras,
} from "@/utils/Constants";
import {
  Box,
  Button,
  Checkbox,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  List,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import { BoxStyleCadastro, ListStyle, TituloSecaoStyle } from "@/utils/Styles";
import { useData } from "@/context/context";
import { HeaderForm } from "@/components/HeaderDefaultForm";
import Layout from "@/components/TopBarComponents/Layout";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import "react-image-crop/dist/ReactCrop.css";
import { storage } from "../config/firestoreConfig";
import resizeImage from "../utils/Constants";
import { v4 as uuidv4 } from "uuid";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { CorrigirDadosDefinitivos } from "@/utils/CorrigirDadosTurmasEmComponetes";

type SelecaoWithLock = SelecaoModalidadeTurma & { locked?: boolean };

const FORCED_FUTSAL_MODALIDADE = "futsal";
const FORCED_FUTSAL_NUCLEO = "Leonor Rosa";
const FORCED_FUTSAL_TURMA =
  "SUB13_SUB15_Leonor Rosa_QUARTA_19h45 - FEMININO";

export default function StudentRegistration() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormValuesStudent>({
    resolver: zodResolver(formValuesStudentSchema),
    defaultValues: {
      modalidade: "",
      turmaSelecionada: "",
      aluno: {
        informacoesAdicionais: {
          uniforme: "",
        },
      },
    },
  });

  const { modalidades, fetchModalidades, sendDataToApi } = useData();

  // upload de imagem----------------------------
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) return;

    try {
      const resizedImageUrl = await resizeImage(picked);
      setFile(new File([await (await fetch(resizedImageUrl)).blob()], picked.name));
      setAvatarUrl(resizedImageUrl);
    } catch (error) {
      console.error("onFileChange - Erro", error);
    }
  };

  useEffect(() => {
    fetchModalidades();
  }, [fetchModalidades]);

  // ----------------------------------------------------------------------------
  // seleção de modalidades
  const [selecoes, setSelecoes] = useState<SelecaoWithLock[]>([
    {
      modalidade: "",
      nucleo: "",
      turma: "",
      turmasDisponiveis: [],
    },
  ]);

  // Novo: checkbox para forçar turma feminina específica
  const [forceFutsalFeminino, setForceFutsalFeminino] = useState<boolean>(false);

  const forcedSelection = useMemo<SelecaoWithLock>(
    () => ({
      modalidade: FORCED_FUTSAL_MODALIDADE,
      nucleo: FORCED_FUTSAL_NUCLEO,
      turma: FORCED_FUTSAL_TURMA,
      turmasDisponiveis: [],
      locked: true,
    }),
    []
  );

  const isForced = (s: SelecaoWithLock) =>
    s.modalidade.trim().toLowerCase() === FORCED_FUTSAL_MODALIDADE &&
    s.turma === FORCED_FUTSAL_TURMA &&
    s.locked === true;

  const isEmptySelection = (s: SelecaoWithLock) =>
    !s.locked && s.modalidade === "" && s.nucleo === "" && s.turma === "";

  // Ao marcar/desmarcar: adiciona/remove linha travada
  useEffect(() => {
    setSelecoes((prev) => {
      const hasLockedForced = prev.some(isForced);

      if (forceFutsalFeminino) {
        const next = prev
          .filter((s) => !isEmptySelection(s)) // remove linhas vazias para não bloquear required à toa
          .map((s) => s);

        if (hasLockedForced) return next;

        // Se usuário já escolheu essa turma manualmente, "promove" para locked
        const idxManual = next.findIndex(
          (s) =>
            s.modalidade.trim().toLowerCase() === FORCED_FUTSAL_MODALIDADE &&
            s.turma === FORCED_FUTSAL_TURMA &&
            s.locked !== true
        );

        if (idxManual >= 0) {
          return next.map((s, i) =>
            i === idxManual
              ? {
                  ...s,
                  modalidade: FORCED_FUTSAL_MODALIDADE,
                  nucleo: FORCED_FUTSAL_NUCLEO,
                  turma: FORCED_FUTSAL_TURMA,
                  locked: true,
                }
              : s
          );
        }

        return [forcedSelection, ...next];
      }

      // desmarcado: remove apenas a seleção travada (se existir)
      const cleaned = prev.filter((s) => !isForced(s));

      // garante pelo menos 1 linha editável para o fluxo atual
      if (cleaned.length === 0) {
        return [
          { modalidade: "", nucleo: "", turma: "", turmasDisponiveis: [] },
        ];
      }
      return cleaned;
    });
  }, [forceFutsalFeminino, forcedSelection]);

  // Função para adicionar nova seleção de modalidade e turma
  const adicionarSelecao = () => {
    setSelecoes((prevSelecoes) => [
      ...prevSelecoes,
      {
        modalidade: "",
        nucleo: "",
        turma: "",
        turmasDisponiveis: [],
      },
    ]);
  };

  // Função para atualizar seleções de modalidade, núcleo e turma
  const atualizarSelecao = (
    index: number,
    campo: keyof SelecaoModalidadeTurma,
    valor: string | Turma[]
  ) => {
    setSelecoes((prevSelecoes) => {
      return prevSelecoes.map((selecao, idx) => {
        if (idx !== index) return selecao;

        // Não permite editar a seleção travada
        if (selecao.locked) return selecao;

        if (campo === "turmasDisponiveis" && Array.isArray(valor)) {
          return { ...selecao, [campo]: valor };
        }

        if (typeof valor === "string") {
          const novaSelecao: SelecaoWithLock = { ...selecao, [campo]: valor };

          if (campo === "nucleo") {
            const modalidadeSelecionada = novaSelecao.modalidade;
            const turmasFiltradas = atualizarTurmasDisponiveis(
              modalidadeSelecionada,
              valor
            );
            novaSelecao.turmasDisponiveis = turmasFiltradas;
          }

          if (campo === "modalidade") {
            novaSelecao.nucleo = "";
            novaSelecao.turma = "";
            novaSelecao.turmasDisponiveis = [];
          }

          return novaSelecao;
        }

        return selecao;
      });
    });
  };

  const atualizarTurmasDisponiveis = (modalidade: string, nucleo: string): Turma[] => {
    const turmas = modalidades.find((m) => m.nome === modalidade)?.turmas ?? [];
    return turmas.filter((turma) => turma.nucleo === nucleo);
  };

  const removerSelecao = (index: number) => {
    setSelecoes((prevSelecoes) => {
      const target = prevSelecoes[index];
      if (target?.locked) return prevSelecoes; // não remove travada
      return prevSelecoes.filter((_, idx) => idx !== index);
    });
  };

  // Função para gerar os seletores de modalidade, núcleo e turma
  const renderizarSeletores = () => {
    return selecoes.map((selecao, index) => (
      <Grid container spacing={2} key={index}>
        {/* Modalidade */}
        <Grid item xs={12} sm={4}>
          {selecao.locked ? (
            <TextField
              sx={{ marginTop: "12px" }}
              label="Modalidade"
              fullWidth
              variant="outlined"
              value={selecao.modalidade}
              disabled
            />
          ) : (
            <TextField
              sx={{ marginTop: "12px" }}
              select
              label="Modalidade"
              fullWidth
              variant="outlined"
              value={selecao.modalidade}
              onChange={(e) => atualizarSelecao(index, "modalidade", e.target.value)}
              required
            >
              {modalidades
                .filter(
                  (modalidade) =>
                    modalidade.nome !== "temporarios" &&
                    modalidade.nome !== "arquivados" &&
                    modalidade.nome !== "excluidos"
                )
                .map((modalidade) => (
                  <MenuItem key={modalidade.nome} value={modalidade.nome}>
                    {modalidade.nome}
                  </MenuItem>
                ))}
            </TextField>
          )}
        </Grid>

        {/* Núcleo */}
        <Grid item xs={12} sm={4}>
          {selecao.locked ? (
            <TextField
              sx={{ marginTop: "12px" }}
              label="Local de treinamento"
              fullWidth
              variant="outlined"
              value={selecao.nucleo}
              disabled
            />
          ) : (
            <TextField
              sx={{ marginTop: "12px" }}
              select
              label="Local de treinamento"
              fullWidth
              variant="outlined"
              value={selecao.nucleo}
              onChange={(e) => atualizarSelecao(index, "nucleo", e.target.value)}
              required
            >
              {selecao.modalidade &&
                modalidades
                  .find((m) => m.nome === selecao.modalidade)
                  ?.turmas.map((turma) => turma.nucleo)
                  .filter((value, idx, self) => self.indexOf(value) === idx)
                  .map((nucleo) => (
                    <MenuItem key={nucleo} value={nucleo}>
                      {nucleo}
                    </MenuItem>
                  ))}
            </TextField>
          )}
        </Grid>

        {/* Turma */}
        <Grid item xs={12} sm={4}>
          {selecao.locked ? (
            <TextField
              sx={{ marginTop: "12px" }}
              label="Turma"
              fullWidth
              variant="outlined"
              value={selecao.turma}
              disabled
            />
          ) : (
            <TextField
              sx={{ marginTop: "12px" }}
              select
              label="Turma"
              fullWidth
              variant="outlined"
              value={selecao.turma}
              onChange={(e) => atualizarSelecao(index, "turma", e.target.value)}
              required
            >
              {selecao.turmasDisponiveis?.map((turma, idx) => (
                <MenuItem key={`${turma.nome_da_turma}-${idx}`} value={turma.nome_da_turma}>
                  {turma.nome_da_turma}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Grid>

        <Grid item xs={2} sm={1}>
          <Button
            variant="contained"
            color="error"
            sx={{ mb: "5px" }}
            onClick={() => removerSelecao(index)}
            disabled={selecoes.length === 1 || Boolean(selecao.locked)}
          >
            Remover
          </Button>
        </Grid>

        {index < selecoes.length - 1 && <Divider sx={{ width: "100%", my: 2 }} />}
      </Grid>
    ));
  };

  const onSubmit: SubmitHandler<FormValuesStudent> = async (formData) => {
    if (selecoes.length === 0) {
      alert("Por favor, adicione pelo menos uma modalidade e turma.");
      return;
    }

    // Se checkbox marcado, valida (quando possível) se a turma fixa é feminina no dataset
    if (forceFutsalFeminino) {
      const futsal = modalidades.find((m) => m.nome === FORCED_FUTSAL_MODALIDADE);
      const turma = futsal?.turmas?.find((t) => t.nome_da_turma === FORCED_FUTSAL_TURMA);

      if (turma && turma.isFeminina !== true) {
        alert("Configuração inválida: a turma feminina selecionada não está marcada como isFeminina=true no banco.");
        return;
      }
    }

    let fotoUrl = "";
    if (file) {
      setIsUploading(true);
      try {
        const fileName = uuidv4() + file.name;
        const fileRef = ref(storage, fileName);
        const uploadTask = uploadBytesResumable(fileRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            () => {},
            (error) => {
              console.error("Erro no upload:", error);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setIsUploading(false);
              fotoUrl = downloadURL;
              resolve();
            }
          );
        });
      } catch (error) {
        console.error("Falha no upload:", error);
        setIsUploading(false);
        return;
      }
    }

    const mydate = new Date(Date.now()).toLocaleString().split(",")[0];
    const uniforme = false;

    formData.aluno.dataMatricula = mydate;
    formData.aluno.informacoesAdicionais.hasUniforme = uniforme;
    formData.aluno.informacoesAdicionais.IdentificadorUnico = uuidv4();

    // Seleções efetivas: remove linhas vazias e garante forced se marcado
    const baseSelecoes = selecoes
      .filter((s) => s.modalidade && s.turma)
      .map((s) => ({
        modalidade: s.modalidade,
        turma: s.turma,
      }));

    const ensuredSelecoes = (() => {
      if (!forceFutsalFeminino) return baseSelecoes;

      const alreadyHas = baseSelecoes.some(
        (s) =>
          s.modalidade.trim().toLowerCase() === FORCED_FUTSAL_MODALIDADE &&
          s.turma === FORCED_FUTSAL_TURMA
      );

      if (alreadyHas) return baseSelecoes;

      return [
        { modalidade: FORCED_FUTSAL_MODALIDADE, turma: FORCED_FUTSAL_TURMA },
        ...baseSelecoes,
      ];
    })();

    const dataParaProcessar = ensuredSelecoes.map((selecao) => ({
      ...formData,
      modalidade: selecao.modalidade,
      turmaSelecionada: selecao.turma,
      aluno: {
        ...formData.aluno,
        foto: fotoUrl,
      },
    }));

    try {
      const { resultados } = await sendDataToApi(dataParaProcessar);
      const todosSucessos = resultados.every((resultado) => resultado.sucesso);

      if (todosSucessos) {
        alert("Todos os cadastros foram efetuados com sucesso!");
        resetFormulario();
      } else {
        const mensagensErro = resultados
          .filter((resultado) => !resultado.sucesso)
          .map((resultado) => resultado.erro)
          .join("\n");
        alert(`O cadastro falhou, motivo:\n${mensagensErro}`);
      }
    } catch (error) {
      console.error("Erro ao enviar dados dos alunos: ", error);
      alert("Ocorreu um erro ao tentar realizar o cadastro. Por favor, tente novamente.");
    }
  };

  // Função para resetar o formulário e estados relacionados
  const resetFormulario = () => {
    reset();
    setSelecoes([{ modalidade: "", nucleo: "", turma: "", turmasDisponiveis: [] }]);
    setForceFutsalFeminino(false);
    setFile(null);
    setAvatarUrl("");
    setIsUploading(false);
    setUploadProgress(0);
    CorrigirDadosDefinitivos();
  };

  return (
    <Layout>
      <Container>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={BoxStyleCadastro}>
            <Box sx={{ display: "table", width: "100%" }}>
              <HeaderForm titulo={"Cadastro de Atletas"} />
            </Box>

            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 1 - Identificação do Aluno
              </Typography>
              <Grid container spacing={2}>
                {fieldsIdentificacao.map(({ label, id }) => (
                  <Grid item xs={12} sm={6} key={id}>
                    <TextField
                      fullWidth
                      label={label}
                      variant="standard"
                      error={Boolean(getErrorMessage(errors, id))}
                      helperText={getErrorMessage(errors, id)}
                      {...register(id as keyof FormValuesStudent)}
                    />
                  </Grid>
                ))}

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      border: "1px dashed grey",
                      borderRadius: "4px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      height: "200px",
                      overflow: "hidden",
                      position: "relative",
                      "&:hover": { backgroundColor: "#f0f0f0", cursor: "pointer" },
                    }}
                  >
                    {avatarUrl ? (
                      <>
                        <img
                          src={avatarUrl}
                          alt="Avatar"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            width: "100%",
                            backgroundColor: "rgba(0, 0, 0, 0.5)",
                            color: "white",
                            textAlign: "center",
                            p: "8px",
                          }}
                        >
                          <Button variant="contained" component="label" size="small" color="primary">
                            Alterar Foto do Atleta
                            <input type="file" hidden accept="image/*" onChange={onFileChange} />
                          </Button>
                        </Box>
                      </>
                    ) : (
                      <Button variant="contained" component="label" size="small" color="primary">
                        Carregar Foto do Atleta
                        <input type="file" hidden accept="image/*" onChange={onFileChange} />
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </List>

            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 2 - Informações Pessoais e de Saúde do Aluno
              </Typography>
              <Grid container spacing={2}>
                {fieldsDadosGeraisAtleta.map(({ label, id }) => (
                  <Grid item xs={12} sm={6} key={id}>
                    <TextField
                      fullWidth
                      id={id}
                      label={label}
                      variant="standard"
                      sx={{ borderRadius: "4px" }}
                      error={Boolean(getErrorMessage(errors, id))}
                      helperText={getErrorMessage(errors, id)}
                      {...register(id as keyof FormValuesStudent)}
                    />
                  </Grid>
                ))}
              </Grid>
            </List>

            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 3 - Endereço Residencial do Aluno
              </Typography>
              <Grid container spacing={2}>
                {fieldsEndereco.map(({ label, id }) => (
                  <Grid item xs={12} sm={6} key={id}>
                    <TextField
                      fullWidth
                      id={id}
                      label={label}
                      variant="standard"
                      sx={{ borderRadius: "4px" }}
                      required
                      error={Boolean(getErrorMessage(errors, id))}
                      helperText={getErrorMessage(errors, id)}
                      {...register(id as keyof FormValuesStudent)}
                    />
                  </Grid>
                ))}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Complemento"
                    variant="standard"
                    sx={{ borderRadius: "4px" }}
                    {...register("aluno.informacoesAdicionais.endereco.complemento")}
                  />
                </Grid>
              </Grid>
            </List>

            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 4 - Informações do Responsável Financeiro
              </Typography>
              <Grid container spacing={2}>
                {fieldsResponsavelMensalidade.map(({ label, id }) => (
                  <Grid item xs={12} sm={6} key={id}>
                    <TextField
                      fullWidth
                      id={id}
                      label={label}
                      variant="standard"
                      sx={{ borderRadius: "4px" }}
                      error={Boolean(getErrorMessage(errors, id))}
                      helperText={getErrorMessage(errors, id)}
                      required
                      {...register(id as keyof FormValuesStudent)}
                    />
                  </Grid>
                ))}
              </Grid>
            </List>

            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 5 - Conexões com Empresas Parceiras
              </Typography>
              <Grid container spacing={2}>
                {vinculosempresasparceiras.map(({ label, id }) => (
                  <Grid item xs={12} sm={6} key={id}>
                    <TextField
                      fullWidth
                      id={id}
                      label={label}
                      variant="standard"
                      sx={{ borderRadius: "4px" }}
                      error={Boolean(getErrorMessage(errors, id))}
                      helperText={getErrorMessage(errors, id)}
                      required
                      {...register(id as keyof FormValuesStudent)}
                    />
                  </Grid>
                ))}
              </Grid>
            </List>

            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 6 - Especificações sobre o Uniforme
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    select
                    defaultValue={""}
                    label="Tamanho do Uniforme"
                    variant="outlined"
                    fullWidth
                    required
                    {...register("aluno.informacoesAdicionais.uniforme")}
                    helperText="Selecione o tamanho do uniforme"
                    error={!!errors.aluno?.informacoesAdicionais?.uniforme}
                  >
                    {[
                      { value: "Pi - 6", label: "Pi - 6" },
                      { value: "Mi - 8", label: "Mi - 8" },
                      { value: "Gi - 10", label: "Gi - 10" },
                      { value: "GGi - 12", label: "GGi - 12" },
                      { value: "PP - 14", label: "PP - 14" },
                      { value: "P adulto", label: "P adulto" },
                      { value: "M adulto", label: "M adulto" },
                      { value: "G adulto", label: "G adulto" },
                      { value: "GG adulto", label: "GG adulto" },
                      { value: "Outro", label: "Outro (informar pelo Whatsapp)" },
                    ].map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </List>

            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 8 - Escolha de Modalidades e Turmas
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={forceFutsalFeminino}
                        onChange={(e) => setForceFutsalFeminino(e.target.checked)}
                       
                      />
                    }
                    label="Turma Feminina (Marque essa opção cadastrar em turma feminina de futsal.)"
                     sx={{color:"black",fontWeight:"bold"}}
                  />
                </Grid>

                {renderizarSeletores()}

                <Divider sx={{ width: "100%", my: 2 }} />
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    onClick={adicionarSelecao}
                    disabled={selecoes.length >= 3}
                  >
                    Adicionar Modalidade/Turma
                  </Button>

                  {selecoes.length >= 3 && (
                    <Typography color="error" sx={{ mt: 2 }}>
                      Para mais de 3 horários, entre em contato conosco
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </List>

            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 9 - Acordos e Termos de Responsabilidade
              </Typography>
              <Grid container spacing={2}>
                {fieldsTermosAvisos.map(({ label, id }) => (
                  <Grid
                    item
                    xs={12}
                    key={id}
                    sx={{
                      padding: 2,
                      border: "1px solid #e0e0e0",
                      borderRadius: "4px",
                      boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: "bold",
                        color: "#333",
                        marginBottom: 1,
                        textAlign: "center",
                      }}
                    >
                      {label}
                    </Typography>
                    <RadioGroup
                      row
                      aria-labelledby={id}
                      {...register(id as keyof FormValuesStudent)}
                    >
                      {opcoesTermosAvisos[id.split(".")[2]].map((opcao, index) => (
                        <FormControlLabel
                          key={index}
                          value={opcao}
                          control={<Radio required />}
                          label={opcao}
                          sx={{ color: "#333", marginRight: 2, textAlign: "center" }}
                        />
                      ))}
                    </RadioGroup>
                  </Grid>
                ))}
              </Grid>
            </List>

            {avatarUrl === "" ? (
              <Button variant="contained" color="error" disabled>
                É necessário adicionar uma foto do atleta para concluir o cadastro!
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting || isUploading || avatarUrl === ""}
              >
                {isSubmitting || isUploading ? "Enviando dados, aguarde..." : "Cadastrar Atleta"}
              </Button>
            )}
          </Box>
        </form>
      </Container>
    </Layout>
  );
}
