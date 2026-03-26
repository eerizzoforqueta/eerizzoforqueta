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
  Alert,
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
import axios, { AxiosError } from "axios";
import { CorrigirDadosDefinitivos } from "@/utils/CorrigirDadosTurmasEmComponetes";

type SelecaoWithLock = SelecaoModalidadeTurma & { locked?: boolean };

type ResultadoApi =
  | { sucesso: true; aluno: unknown }
  | { sucesso: false; erro: string; aluno: unknown };

type SubmitResponse = {
  resultados: ResultadoApi[];
};

const FORCED_FUTSAL_MODALIDADE = "futsal";
const FORCED_FUTSAL_NUCLEO = "Leonor Rosa";
const FORCED_FUTSAL_TURMA =
  "SUB13_SUB15_Leonor Rosa_QUARTA_19h45 - FEMININO";

const HIDDEN_NUCLEO = "INDO MAIS ALÉM";
const SUBMIT_TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 45000;

function getAxiosErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    if (axiosError.code === "ECONNABORTED") {
      return "Tempo excedido ao enviar o cadastro. Tente novamente.";
    }
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Erro inesperado ao enviar o cadastro.";
}

async function uploadFileWithTimeout(file: File, onProgress: (progress: number) => void): Promise<string> {
  const fileName = `${uuidv4()}_${file.name}`;
  const fileRef = ref(storage, fileName);
  const uploadTask = uploadBytesResumable(fileRef, file);

  return await new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      uploadTask.cancel();
      reject(new Error("Tempo excedido no upload da foto. Tente novamente."));
    }, UPLOAD_TIMEOUT_MS);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        onProgress(progress);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          window.clearTimeout(timeoutId);
          resolve(downloadURL);
        } catch (error) {
          window.clearTimeout(timeoutId);
          reject(error);
        }
      }
    );
  });
}

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

  const { modalidades, fetchModalidades } = useData();

  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) return;

    try {
      setSubmitError("");
      const resizedImageUrl = await resizeImage(picked);
      const blob = await (await fetch(resizedImageUrl)).blob();
      setFile(new File([blob], picked.name, { type: picked.type || "image/jpeg" }));
      setAvatarUrl(resizedImageUrl);
    } catch (error) {
      console.error("onFileChange - Erro", error);
      setSubmitError("Não foi possível processar a foto selecionada.");
    }
  };

  useEffect(() => {
    fetchModalidades().catch(console.error);
  }, [fetchModalidades]);

  const [selecoes, setSelecoes] = useState<SelecaoWithLock[]>([
    {
      modalidade: "",
      nucleo: "",
      turma: "",
      turmasDisponiveis: [],
    },
  ]);

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

  useEffect(() => {
    setSelecoes((prev) => {
      const hasLockedForced = prev.some(isForced);

      if (forceFutsalFeminino) {
        const next = prev.filter((s) => !isEmptySelection(s));

        if (hasLockedForced) return next;

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

      const cleaned = prev.filter((s) => !isForced(s));

      if (cleaned.length === 0) {
        return [
          { modalidade: "", nucleo: "", turma: "", turmasDisponiveis: [] },
        ];
      }

      return cleaned;
    });
  }, [forceFutsalFeminino, forcedSelection]);

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

  const atualizarTurmasDisponiveis = (modalidade: string, nucleo: string): Turma[] => {
    if (nucleo === HIDDEN_NUCLEO) return [];
    const turmas = modalidades.find((m) => m.nome === modalidade)?.turmas ?? [];
    return turmas.filter(
      (turma) => turma.nucleo === nucleo && turma.nucleo !== HIDDEN_NUCLEO
    );
  };

  const atualizarSelecao = (
    index: number,
    campo: keyof SelecaoModalidadeTurma,
    valor: string | Turma[]
  ) => {
    setSelecoes((prevSelecoes) => {
      return prevSelecoes.map((selecao, idx) => {
        if (idx !== index) return selecao;
        if (selecao.locked) return selecao;

        if (campo === "turmasDisponiveis" && Array.isArray(valor)) {
          return { ...selecao, [campo]: valor };
        }

        if (typeof valor === "string") {
          const novaSelecao: SelecaoWithLock = { ...selecao, [campo]: valor };

          if (campo === "nucleo") {
            if (valor === HIDDEN_NUCLEO) {
              novaSelecao.nucleo = "";
              novaSelecao.turma = "";
              novaSelecao.turmasDisponiveis = [];
              return novaSelecao;
            }

            const turmasFiltradas = atualizarTurmasDisponiveis(
              novaSelecao.modalidade,
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

  const removerSelecao = (index: number) => {
    setSelecoes((prevSelecoes) => {
      const target = prevSelecoes[index];
      if (target?.locked) return prevSelecoes;
      return prevSelecoes.filter((_, idx) => idx !== index);
    });
  };

  const renderizarSeletores = () => {
    return selecoes.map((selecao, index) => (
      <Grid container spacing={2} key={`${selecao.modalidade}-${selecao.turma}-${index}`}>
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
                  .filter((nucleo): nucleo is string => Boolean(nucleo))
                  .filter((nucleo, idx, self) => self.indexOf(nucleo) === idx)
                  .filter((nucleo) => nucleo !== HIDDEN_NUCLEO)
                  .map((nucleo) => (
                    <MenuItem key={nucleo} value={nucleo}>
                      {nucleo}
                    </MenuItem>
                  ))}
            </TextField>
          )}
        </Grid>

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
    setSubmitError("");
    setSubmitSuccess("");

    if (selecoes.length === 0) {
      setSubmitError("Por favor, adicione pelo menos uma modalidade e turma.");
      return;
    }

    if (forceFutsalFeminino) {
      const futsal = modalidades.find((m) => m.nome === FORCED_FUTSAL_MODALIDADE);
      const turma = futsal?.turmas?.find((t) => t.nome_da_turma === FORCED_FUTSAL_TURMA);

      if (turma && turma.isFeminina !== true) {
        setSubmitError(
          "Configuração inválida: a turma feminina selecionada não está marcada como isFeminina=true no banco."
        );
        return;
      }
    }

    let fotoUrl = "";
    if (file) {
      setIsUploading(true);
      setUploadProgress(0);

      try {
        fotoUrl = await uploadFileWithTimeout(file, setUploadProgress);
      } catch (error) {
        console.error("Falha no upload:", error);
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Falha no upload da foto. Tente novamente."
        );
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const mydate = new Date(Date.now()).toLocaleString().split(",")[0];
    formData.aluno.dataMatricula = mydate;
    formData.aluno.informacoesAdicionais.hasUniforme = false;
    formData.aluno.informacoesAdicionais.IdentificadorUnico = uuidv4();

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
      const response = await axios.post<SubmitResponse>(
        "/api/SubmitFormRegistration",
        dataParaProcessar,
        {
          timeout: SUBMIT_TIMEOUT_MS,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const { resultados } = response.data;
      const todosSucessos = resultados.every((resultado) => resultado.sucesso);

      if (todosSucessos) {
        setSubmitSuccess("Todos os cadastros foram efetuados com sucesso!");
        resetFormulario();
      } else {
        const mensagensErro = resultados
          .filter((resultado) => !resultado.sucesso)
          .map((resultado) => resultado.erro)
          .join("\n");

        setSubmitError(`O cadastro falhou:\n${mensagensErro}`);
      }
    } catch (error) {
      console.error("Erro ao enviar dados dos alunos:", error);
      setSubmitError(getAxiosErrorMessage(error));
    }
  };

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

  const submitButtonLabel = isUploading
    ? `Enviando foto (${uploadProgress}%)...`
    : isSubmitting
    ? "Enviando cadastro..."
    : "Cadastrar Atleta";

  return (
    <Layout>
      <Container>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={BoxStyleCadastro}>
            <Box sx={{ display: "table", width: "100%" }}>
              <HeaderForm titulo={"Cadastro de Atletas"} />
            </Box>

            {submitError && (
              <Alert severity="error" sx={{ mb: 2, whiteSpace: "pre-line" }}>
                {submitError}
              </Alert>
            )}

            {submitSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {submitSuccess}
              </Alert>
            )}

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
                    defaultValue=""
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
                    label="Turma feminina (Futsal - Leonor Rosa)"
                    sx={{ color: "black" }}
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
                    <RadioGroup row aria-labelledby={id} {...register(id as keyof FormValuesStudent)}>
                      {opcoesTermosAvisos[id.split(".")[2]].map((opcao, index) => (
                        <FormControlLabel
                          key={`${id}-${index}`}
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
                {submitButtonLabel}
              </Button>
            )}
          </Box>
        </form>
      </Container>
    </Layout>
  );
}

