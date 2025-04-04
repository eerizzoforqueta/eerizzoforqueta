/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useContext, useEffect, useState } from "react";
import {
  Autocomplete,
  TextField,
  Button,
  Box,
  Container,
  Grid,
  List,
  Typography,
} from "@mui/material";
import { v4 as uuidv4 } from "uuid";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { DataContext } from "@/context/context";
import { IIAlunoUpdate } from "@/interface/interfaces";
import { HeaderForm } from "@/components/HeaderDefaultForm";
import Layout from "@/components/TopBarComponents/Layout";
import { BoxStyleCadastro, ListStyle, TituloSecaoStyle } from "@/utils/Styles";
import axios from "axios";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]";
import { storage } from "../config/firestoreConfig";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export default function StudentUpdatePersonalInformation() {
  const { updateDataInApi, modalidades, fetchModalidades } =
    useContext(DataContext);
  const [selectedAluno, setSelectedAluno] = useState<IIAlunoUpdate | null>(
    null
  );
  const [alunosOptions, setAlunosOptions] = useState<IIAlunoUpdate[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    setSelectedFile(file);
    if (file) {
      const photoPreviewUrl = URL.createObjectURL(file);
      setPhotoURL(photoPreviewUrl); // Atualiza a visualização da foto na interface do usuário
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!selectedFile) return null; // Retorna null explicitamente se não houver arquivo selecionado

    const storageRef = ref(storage, `${selectedFile.name}`);
    const uploadTask = uploadBytesResumable(storageRef, selectedFile);

    return new Promise<string | null>((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Erro no upload da foto:", error);
          reject(error); // Rejeita a Promise no caso de erro
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL); // Resolve com a URL em caso de sucesso
            setPhotoURL(downloadURL);
          } catch (error) {
            console.error("Erro ao obter a URL da foto:", error);
            resolve(null); // Resolve com null em caso de erro ao obter a URL
          }
        }
      );
    });
  };

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { isSubmitting },
  } = useForm<IIAlunoUpdate>();

  useEffect(() => {
    // Carregar todas as modalidades ao montar o componente
    fetchModalidades().catch(console.error);
  }, [fetchModalidades]);

 useEffect(() => {
  // Cria um array com todas as instâncias dos alunos, sem filtrar duplicatas
  const alunosTemp: IIAlunoUpdate[] = [];
  modalidades.forEach((modalidade) => {
    modalidade.turmas.forEach((turma) => {
      const alunos = Array.isArray(turma.alunos) ? turma.alunos.filter(Boolean) : [];
      alunos.forEach((aluno) => {
        alunosTemp.push({
          ...aluno,
          nomeDaTurma: turma.nome_da_turma,
          modalidade: modalidade.nome,
        });
      });
    });
  });
  setAlunosOptions(alunosTemp);
}, [modalidades]);


  const onSubmit: SubmitHandler<IIAlunoUpdate> = async (data) => {
    console.log("Dados do formulário antes do upload:", data);

    try {
      let finalPhotoUrl = photoURL; // Use a URL atual do estado

      if (selectedFile) {
        console.log("Iniciando upload da foto...");
        finalPhotoUrl = await uploadPhoto(); // Aguarda o upload e atualiza a URL
        console.log("Foto carregada com sucesso, URL:", finalPhotoUrl);
      }

      const updatedData = {
        ...data,
        foto: finalPhotoUrl || data.foto, // Garante que a foto seja atualizada corretamente
      };

      console.log(
        "Atualizando dados do aluno com a nova URL da foto:",
        finalPhotoUrl
      );
      await updateDataInApi({
        ...updatedData,
        alunoId: selectedAluno?.alunoId,
        //dataMatricula: data.dataMatricula
      });

      console.log("Cadastro atualizado com sucesso");
      corrigirDados();
      alert("Cadastro atualizado com sucesso");
    } catch (error) {
      console.error("Erro ao enviar os dados do formulário", error);
    } finally {
      reset();
      setSelectedFile(null);
      setPhotoURL(null); // Limpa o estado após o envio
    }
  };

  const handleAlunoChange = (_event: any, value: IIAlunoUpdate | null) => {
    setSelectedAluno(value);
    if (value) {
      // Certifique-se de que informacoesAdicionais esteja presente e corretamente tipado
      if (!value.informacoesAdicionais) {
        value.informacoesAdicionais = {
          endereco: {
            ruaAvenida: "",
            numeroResidencia: "",
            bairro: "",
            cep: "",
            complemento: "",
          },
          pagadorMensalidades: {
            nomeCompleto: "",
            cpf: "",
            email: "",
            celularWhatsapp: "",
          },
          convenio: "",
          escolaEstuda: "",
          filhofuncionarioJBS: "",
          filhofuncionariomarcopolo: "",
          imagem: "",
          irmaos: "",
          medicacao: "",
          nomefuncionarioJBS: "",
          nomefuncionariomarcopolo: "",
          problemasaude: "",
          rg: "",
          saude: "",
          socioJBS: "",
          tipomedicacao: "",
          uniforme: "",
          cobramensalidade: "",
          nucleoTreinamento: "",

          competicao: "",
          comprometimentoMensalidade: "",
          copiaDocumento: "",
          avisaAusencia: "",
          desconto: "",
        };
      }

      // Atualiza o estado do formulário com os valores de informacoesAdicionais
      setValue("nome", value.nome);
      setValue("foto", value.foto || "");
      setValue("anoNascimento", value.anoNascimento);
      setValue(
        "telefoneComWhatsapp",
        value.telefoneComWhatsapp ? value.telefoneComWhatsapp.toString() : "-"
      );
       setValue("informacoesAdicionais.IdentificadorUnico", value.informacoesAdicionais.IdentificadorUnico);
      if (!value.informacoesAdicionais.endereco) {
        value.informacoesAdicionais.endereco = {
          ruaAvenida: "",
          numeroResidencia: "",
          bairro: "",
          cep: "",
          complemento: "",
          // ... inicialize outras propriedades conforme necessário
        };
      } else {
        setValue(
          "informacoesAdicionais.endereco.ruaAvenida",
          value.informacoesAdicionais.endereco.ruaAvenida
            ? value.informacoesAdicionais.endereco.ruaAvenida
            : "-"
        );
        setValue(
          "informacoesAdicionais.endereco.numeroResidencia",
          value.informacoesAdicionais.endereco.numeroResidencia.toString()
            ? value.informacoesAdicionais.endereco.numeroResidencia.toString()
            : "-"
        );
        setValue(
          "informacoesAdicionais.endereco.bairro",
          value.informacoesAdicionais.endereco.bairro
            ? value.informacoesAdicionais.endereco.bairro
            : "-"
        );
        setValue(
          "informacoesAdicionais.endereco.cep",
          value.informacoesAdicionais.endereco.cep
            ? value.informacoesAdicionais.endereco.cep
            : "-"
        );
        setValue(
          "informacoesAdicionais.endereco.complemento",
          value.informacoesAdicionais.endereco.complemento
            ? value.informacoesAdicionais.endereco.complemento
            : "-"
        );
      }

      // Garantindo que `pagadorMensalidades` esteja definido
      if (!value.informacoesAdicionais.pagadorMensalidades) {
        value.informacoesAdicionais.pagadorMensalidades = {
          nomeCompleto: "",
          cpf: "",
          email: "",
          celularWhatsapp: "",
        };
      } else {
        setValue(
          "informacoesAdicionais.pagadorMensalidades.nomeCompleto",
          value.informacoesAdicionais.pagadorMensalidades.nomeCompleto
            ? value.informacoesAdicionais.pagadorMensalidades.nomeCompleto
            : "-"
        );
        setValue(
          "informacoesAdicionais.pagadorMensalidades.cpf",
          value.informacoesAdicionais.pagadorMensalidades.cpf
            ? value.informacoesAdicionais.pagadorMensalidades.cpf
            : "-"
        );
        setValue(
          "informacoesAdicionais.pagadorMensalidades.email",
          value.informacoesAdicionais.pagadorMensalidades.email
            ? value.informacoesAdicionais.pagadorMensalidades.email
            : "-"
        );
        setValue(
          "informacoesAdicionais.pagadorMensalidades.celularWhatsapp",
          value.informacoesAdicionais.pagadorMensalidades.celularWhatsapp
            ? value.informacoesAdicionais.pagadorMensalidades.celularWhatsapp
            : "-"
        );
      }

      setValue(
        "informacoesAdicionais.convenio",
        value.informacoesAdicionais.convenio
          ? value.informacoesAdicionais.convenio
          : "-"
      );
      setValue(
        "informacoesAdicionais.escolaEstuda",
        value.informacoesAdicionais.escolaEstuda
          ? value.informacoesAdicionais.escolaEstuda
          : "-"
      );
      setValue(
        "informacoesAdicionais.filhofuncionarioJBS",
        value.informacoesAdicionais.filhofuncionarioJBS
          ? value.informacoesAdicionais.filhofuncionarioJBS
          : "-"
      );
      setValue(
        "informacoesAdicionais.filhofuncionariomarcopolo",
        value.informacoesAdicionais.filhofuncionariomarcopolo
          ? value.informacoesAdicionais.filhofuncionariomarcopolo
          : "-"
      );
      setValue(
        "informacoesAdicionais.imagem",
        value.informacoesAdicionais.imagem
      );
      setValue(
        "informacoesAdicionais.irmaos",
        value.informacoesAdicionais.irmaos
          ? value.informacoesAdicionais.irmaos
          : "-"
      );
      setValue(
        "informacoesAdicionais.medicacao",
        value.informacoesAdicionais.medicacao
          ? value.informacoesAdicionais.medicacao
          : "-"
      );
      setValue(
        "informacoesAdicionais.nomefuncionarioJBS",
        value.informacoesAdicionais.nomefuncionarioJBS
          ? value.informacoesAdicionais.nomefuncionarioJBS
          : "-"
      );
      setValue(
        "informacoesAdicionais.nomefuncionariomarcopolo",
        value.informacoesAdicionais.nomefuncionariomarcopolo
          ? value.informacoesAdicionais.nomefuncionariomarcopolo
          : "-"
      );
      setValue(
        "informacoesAdicionais.problemasaude",
        value.informacoesAdicionais.problemasaude
          ? value.informacoesAdicionais.problemasaude
          : "-"
      );
      setValue(
        "informacoesAdicionais.rg",
        value.informacoesAdicionais.rg ? value.informacoesAdicionais.rg : "-"
      );
      setValue(
        "informacoesAdicionais.saude",
        value.informacoesAdicionais.saude
          ? value.informacoesAdicionais.saude
          : "-"
      );
      setValue(
        "informacoesAdicionais.socioJBS",
        value.informacoesAdicionais.socioJBS
          ? value.informacoesAdicionais.socioJBS
          : "-"
      );
      setValue(
        "informacoesAdicionais.tipomedicacao",
        value.informacoesAdicionais.tipomedicacao
          ? value.informacoesAdicionais.tipomedicacao
          : "-"
      );
      setValue(
        "informacoesAdicionais.uniforme",
        value.informacoesAdicionais.uniforme
          ? value.informacoesAdicionais.uniforme
          : "-"
      );
      setValue(
        "informacoesAdicionais.cobramensalidade",
        value.informacoesAdicionais.cobramensalidade
          ? value.informacoesAdicionais.cobramensalidade
          : "-"
      );
      setValue(
        "informacoesAdicionais.nucleoTreinamento",
        value.informacoesAdicionais.nucleoTreinamento
          ? value.informacoesAdicionais.nucleoTreinamento
          : "-"
      );

      setValue(
        "informacoesAdicionais.competicao",
        value.informacoesAdicionais.competicao
          ? value.informacoesAdicionais.competicao
          : "-"
      );
      setValue(
        "informacoesAdicionais.comprometimentoMensalidade",
        value.informacoesAdicionais.comprometimentoMensalidade
          ? value.informacoesAdicionais.comprometimentoMensalidade
          : "-"
      );
      setValue(
        "informacoesAdicionais.copiaDocumento",
        value.informacoesAdicionais.copiaDocumento
          ? value.informacoesAdicionais.copiaDocumento
          : "-"
      );
      setValue(
        "informacoesAdicionais.avisaAusencia",
        value.informacoesAdicionais.avisaAusencia
          ? value.informacoesAdicionais.avisaAusencia
          : "-"
      );
      setValue(
        "informacoesAdicionais.desconto",
        value.informacoesAdicionais.desconto
          ? value.informacoesAdicionais.desconto
          : "-"
      );
    } else {
      reset(); // Limpa o formulário se nenhum aluno for selecionado
    }
  };

  async function corrigirDados() {
    try {
      const response = await axios.post("/api/ajustardadosdaturma");
      console.log("Dados da turma corrigidos com sucesso.");
    } catch (error) {
      console.error("Erro ao corrigir dados da turma.");
    }
  }

  return (
    <Layout>
      <Container>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={BoxStyleCadastro}>
            <Box sx={{ display: "table", width: "100%" }}>
              <HeaderForm titulo={"Atualização de dados dos Atletas"} />
              <Autocomplete
  options={alunosOptions}
  getOptionLabel={(option) => option.nome || ""}
  onChange={handleAlunoChange}
  renderInput={(params) => (
    <TextField
      {...params}
      label="Nome do Aluno"
      margin="normal"
      required
      fullWidth
    />
  )}
  renderOption={(props, option) => {
    // Cria uma chave única combinando o IdentificadorUnico com a turma (ou outro campo)
    const key = `${option.informacoesAdicionais?.IdentificadorUnico}-${option.nomeDaTurma}`;
    return (
      <li {...props} key={key}>
        {option.nome} – {option.nomeDaTurma} ({option.modalidade})
      </li>
    );
  }}
/>
            </Box>
            {/* ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ */}

            {/* ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            <List sx={ListStyle}>
              <input type="hidden" {...register("informacoesAdicionais.IdentificadorUnico")} />
              <Typography sx={TituloSecaoStyle}>
                Seção 1 - Identificação do Aluno
              </Typography>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid item xs={12} sm={6}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("nome", { required: true })}
                    label="Nome"
                    fullWidth
                    margin="normal"
                    variant="filled"
                   
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("anoNascimento", { required: true })}
                    label="Nascimento"
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("telefoneComWhatsapp", { required: true })}
                    label="Telefone"
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.rg", {})}
                    label="RG"
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Foto do Atleta
                  </Typography>
                  <Box
                    sx={{
                      border: "1px dashed grey",
                      padding: 2,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 200,
                      marginBottom: 2,
                    }}
                  >
                    {photoURL || selectedAluno?.foto ? (
                      <img
                        src={photoURL || selectedAluno?.foto}
                        alt="Foto do Aluno"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <Typography variant="body1">
                        Nenhuma foto selecionada
                      </Typography>
                    )}
                    <Button
                      variant="contained"
                      component="label"
                      sx={{ mt: 2 }}
                    >
                      {selectedAluno?.foto || photoURL
                        ? "Alterar Foto"
                        : "Carregar Foto"}
                      <input type="file" hidden onChange={handleFileChange} />
                    </Button>
                    <a href={photoURL || selectedAluno?.foto} download>
                      Donwload
                    </a>
                  </Box>
                </Grid>
              </Grid>
            </List>

            {/* ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 2 - Endereço Residencial do Aluno
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.endereco.ruaAvenida", {
                      required: true,
                    })}
                    label="Rua/Avenida"
                    fullWidth
                    margin="normal"
                    variant="filled"
                    value={
                      selectedAluno?.informacoesAdicionais?.endereco
                        ?.ruaAvenida || ""
                    }
                    onChange={(e) => {
                      if (
                        selectedAluno &&
                        selectedAluno.informacoesAdicionais &&
                        selectedAluno.informacoesAdicionais.endereco
                      ) {
                        setSelectedAluno({
                          ...selectedAluno,
                          informacoesAdicionais: {
                            ...selectedAluno.informacoesAdicionais,
                            endereco: {
                              ...selectedAluno.informacoesAdicionais.endereco,
                              ruaAvenida: e.target.value,
                            },
                          },
                        });
                        setValue(
                          "informacoesAdicionais.endereco.ruaAvenida",
                          e.target.value
                        );
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="informacoesAdicionais.endereco.numeroResidencia"
                    control={control} // certifique-se de extrair 'control' do useForm
                    render={({ field }) => (
                      <TextField
                        InputLabelProps={{ shrink: true }}
                        {...field}
                        label="Número da Residência"
                        fullWidth
                        margin="normal"
                        variant="filled"
                        required
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="informacoesAdicionais.endereco.cep"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        InputLabelProps={{ shrink: true }}
                        {...field}
                        label="CEP"
                        fullWidth
                        margin="normal"
                        variant="filled"
                        required
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="informacoesAdicionais.endereco.bairro"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        InputLabelProps={{ shrink: true }}
                        {...field}
                        label="Bairro"
                        fullWidth
                        margin="normal"
                        variant="filled"
                        required
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="informacoesAdicionais.endereco.complemento"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        InputLabelProps={{ shrink: true }}
                        {...field}
                        label="Complemento"
                        fullWidth
                        margin="normal"
                        variant="filled"
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </List>
            {/* ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 3 - Informações do Responsável Financeiro
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register(
                      "informacoesAdicionais.pagadorMensalidades.nomeCompleto",
                      {
                        required: true,
                      }
                    )}
                    label="Nome do Responsável"
                    fullWidth
                    margin="normal"
                    variant="filled"
                    value={
                      selectedAluno?.informacoesAdicionais?.pagadorMensalidades
                        ?.nomeCompleto || ""
                    }
                    onChange={(e) => {
                      if (
                        selectedAluno &&
                        selectedAluno.informacoesAdicionais &&
                        selectedAluno.informacoesAdicionais.pagadorMensalidades
                      ) {
                        setSelectedAluno({
                          ...selectedAluno,
                          informacoesAdicionais: {
                            ...selectedAluno.informacoesAdicionais,
                            pagadorMensalidades: {
                              ...selectedAluno.informacoesAdicionais
                                .pagadorMensalidades,
                              nomeCompleto: e.target.value,
                            },
                          },
                        });
                        setValue(
                          "informacoesAdicionais.pagadorMensalidades.nomeCompleto",
                          e.target.value
                        );
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register(
                      "informacoesAdicionais.pagadorMensalidades.cpf",
                      {
                        required: true,
                      }
                    )}
                    label="CPF do Responsável"
                    fullWidth
                    margin="normal"
                    variant="filled"
                    value={
                      selectedAluno?.informacoesAdicionais.pagadorMensalidades
                        .cpf || ""
                    }
                    onChange={(e) => {
                      if (
                        selectedAluno &&
                        selectedAluno.informacoesAdicionais &&
                        selectedAluno.informacoesAdicionais.pagadorMensalidades
                      ) {
                        setSelectedAluno({
                          ...selectedAluno,
                          informacoesAdicionais: {
                            ...selectedAluno.informacoesAdicionais,
                            pagadorMensalidades: {
                              ...selectedAluno.informacoesAdicionais
                                .pagadorMensalidades,
                              cpf: e.target.value,
                            },
                          },
                        });
                        setValue(
                          "informacoesAdicionais.pagadorMensalidades.cpf",
                          e.target.value
                        );
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register(
                      "informacoesAdicionais.pagadorMensalidades.celularWhatsapp",
                      {
                        required: true,
                      }
                    )}
                    label="Telefone do Responsável"
                    fullWidth
                    margin="normal"
                    variant="filled"
                    value={
                      selectedAluno?.informacoesAdicionais.pagadorMensalidades
                        .celularWhatsapp || ""
                    }
                    onChange={(e) => {
                      if (
                        selectedAluno &&
                        selectedAluno.informacoesAdicionais &&
                        selectedAluno.informacoesAdicionais.pagadorMensalidades
                      ) {
                        setSelectedAluno({
                          ...selectedAluno,
                          informacoesAdicionais: {
                            ...selectedAluno.informacoesAdicionais,
                            pagadorMensalidades: {
                              ...selectedAluno.informacoesAdicionais
                                .pagadorMensalidades,
                              celularWhatsapp: e.target.value,
                            },
                          },
                        });
                        setValue(
                          "informacoesAdicionais.pagadorMensalidades.celularWhatsapp",
                          e.target.value
                        );
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register(
                      "informacoesAdicionais.pagadorMensalidades.email",
                      {
                        required: true,
                      }
                    )}
                    label="Email do Responsável"
                    fullWidth
                    margin="normal"
                    variant="filled"
                    value={
                      selectedAluno?.informacoesAdicionais.pagadorMensalidades
                        .email || ""
                    }
                    onChange={(e) => {
                      if (
                        selectedAluno &&
                        selectedAluno.informacoesAdicionais &&
                        selectedAluno.informacoesAdicionais.pagadorMensalidades
                      ) {
                        setSelectedAluno({
                          ...selectedAluno,
                          informacoesAdicionais: {
                            ...selectedAluno.informacoesAdicionais,
                            pagadorMensalidades: {
                              ...selectedAluno.informacoesAdicionais
                                .pagadorMensalidades,
                              email: e.target.value,
                            },
                          },
                        });
                        setValue(
                          "informacoesAdicionais.pagadorMensalidades.email",
                          e.target.value
                        );
                      }
                    }}
                  />
                </Grid>
              </Grid>
            </List>

            {/* ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            <List sx={ListStyle}>
              <Typography sx={TituloSecaoStyle}>
                Seção 4 - informações Gerais do Atleta
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.escolaEstuda", {
                      required: true,
                    })}
                    fullWidth
                    label="Escola que estuda"
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.irmaos", {
                      required: true,
                    })}
                    fullWidth
                    label="Possui irmãos?"
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.saude", {
                      required: true,
                    })}
                    fullWidth
                    label="Possui problemas de saúde? "
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.problemasaude", {
                      required: true,
                    })}
                    label="Quais problemas de saúde possui? "
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.medicacao", {
                      required: true,
                    })}
                    label="Faz uso de medicação? "
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.tipomedicacao", {
                      required: true,
                    })}
                    label="Qual o nome da(s) medicação(es) que faz uso? "
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.convenio", {
                      required: true,
                    })}
                    label="Qual convenio Possui? "
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.imagem", {
                      required: true,
                    })}
                    label="Autoriza o uso de imagem? "
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.filhofuncionarioJBS", {
                      required: true,
                    })}
                    label="É filho(a) de funcionário(a) da JBS? "
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.socioJBS", {
                      required: true,
                    })}
                    label="É sócio da sede da JBS?"
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.nomefuncionarioJBS", {
                      required: true,
                    })}
                    label="Nome do Funcionário(a) da JBS"
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register(
                      "informacoesAdicionais.filhofuncionariomarcopolo",
                      {
                        required: true,
                      }
                    )}
                    label="É filho(a) de funcionário(a) da Marcopolo?"
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register(
                      "informacoesAdicionais.nomefuncionariomarcopolo",
                      {
                        required: true,
                      }
                    )}
                    label="Nome do Funcionário(a) da Marcopolo"
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    InputLabelProps={{ shrink: true }}
                    {...register("informacoesAdicionais.uniforme", {
                      required: true,
                    })}
                    label="Tamanho Escolhido para o uniforme"
                    fullWidth
                    margin="normal"
                    variant="filled"
                  />
                </Grid>
              </Grid>
            </List>

            {/* ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ */}

            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting
                ? "Enviando dados,aguarde..."
                : "Atualizar dados do Atleta"}
            </Button>
          </Box>
        </form>
      </Container>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Se não tiver sessão ou não for admin, redirecione para a página de login
  if (!session || session.user.role !== "admin") {
    return {
      redirect: {
        destination: "/NotAllowPage",
        permanent: false,
      },
    };
  }

  // Retornar props aqui se a permissão for válida
  return {
    props: {
      /* props adicionais aqui */
    },
  };
};
// update
//update2
