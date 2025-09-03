import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Autocomplete, Button, TextField, Typography, Box, Container } from '@mui/material';
import { DataContext } from "@/context/context";
import { ArchiveAluno } from "@/interface/interfaces";
import Layout from '@/components/TopBarComponents/Layout';
import { BoxStyleCadastro } from '@/utils/Styles';
import axios from 'axios';
import { HeaderForm } from '@/components/HeaderDefaultForm';
import { v4 as uuidv4 } from 'uuid';
import { CorrigirDadosDefinitivos } from '@/utils/CorrigirDadosTurmasEmComponetes';

export default function ArquivarAlunos() {
    const { deleteStudentFromApi, modalidades, fetchModalidades,archiveAndDeleteStudent } = useContext(DataContext);
    const { handleSubmit, control } = useForm();
    const [selectedAluno, setSelectedAluno] = useState<ArchiveAluno | null>(null);
    const [alunosOptions, setAlunosOptions] = useState<ArchiveAluno[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);

    useEffect(() => {
        if (!dataLoaded) {
            fetchModalidades().then(() => {
                setDataLoaded(true);
            }).catch(console.error);
        }
    }, [dataLoaded, fetchModalidades]);

    useEffect(() => {
        if (modalidades.length > 0 && dataLoaded) {
          const alunosExtraidos = modalidades
            .filter(Boolean) // Filtra modalidades nulas (se existirem)
            .flatMap((modalidade) => {
              // Se não houver turmas, retorna array vazio
              if (!modalidade.turmas) return []
      
              // Filtra quaisquer turmas que sejam nulas ou indefinidas
              return modalidade.turmas
                .filter(Boolean)
                .flatMap((turma) => {
                  // Se turma.alunos não for array, retorna array vazio
                  if (!Array.isArray(turma.alunos)) return []
      
                  // Filtra alunos nulos/undefined
                  return turma.alunos
                    .filter(Boolean)
                    .map(aluno => {
                      let identificadorUnico = aluno.informacoesAdicionais?.IdentificadorUnico;
                      if (!identificadorUnico) {
                        identificadorUnico = uuidv4();
                        aluno.informacoesAdicionais = {
                          ...aluno.informacoesAdicionais,
                          IdentificadorUnico: identificadorUnico,
                        };
                      }
                      return {
                        ...aluno,
                        alunoId: identificadorUnico,
                        nome: aluno.nome ?? "",
                        anoNascimento: aluno.anoNascimento ?? "",
                        telefoneComWhatsapp: aluno.telefoneComWhatsapp ?? "",
                        informacoesAdicionais: aluno.informacoesAdicionais ?? {},
                        modalidade: modalidade.nome,
                        nomeDaTurma: turma.nome_da_turma,
                        dataMatricula: aluno.dataMatricula ?? "",
                        foto: aluno.foto ?? "",
                        IdentificadorUnico: identificadorUnico,
                      };
                    });
                });
            });
      
          setAlunosOptions(alunosExtraidos);
        }
      }, [modalidades, dataLoaded]);
      

    const onSubmit = useCallback(async () => {
        if (!selectedAluno) {
            alert("Selecione um aluno para arquivar.");
            return;
        }

        // Verifica se os dados necessários estão presentes
        if (!selectedAluno.IdentificadorUnico || !selectedAluno.modalidade || !selectedAluno.nomeDaTurma) {
            alert("Dados do aluno incompletos. Não é possível arquivar.");
            console.log('IdentificadorUnico:', selectedAluno.IdentificadorUnico);
            console.log('Modalidade:', selectedAluno.modalidade);
            console.log('Nome da Turma:', selectedAluno.nomeDaTurma);
            return;
        }

        setIsDeleting(true);
        try {
            // Envia os dados do aluno para serem salvos na planilha do Google Sheets
            const response = await axios.post('/api/ArquivarAlunos', selectedAluno);
            const data = response.data;
            if (data.status === 'Success') {
                try {
                    await archiveAndDeleteStudent(selectedAluno) 
                } catch (error) {
                    console.error('Erro ao remover aluno:', error);
                    console.log(selectedAluno.IdentificadorUnico)
                    console.log(selectedAluno.modalidade)
                    console.log( selectedAluno.nomeDaTurma)
                }

                try {
                    // Corrige os dados das turmas após a remoção do aluno
                    await CorrigirDadosDefinitivos();
                } catch (error) {
                    console.error('Erro ao corrigir dados da turma:', error);
                }

                // Atualiza a lista de alunos disponíveis para arquivamento
                setAlunosOptions(prev => prev.filter(aluno => aluno.IdentificadorUnico !== selectedAluno.IdentificadorUnico));
                alert("Aluno arquivado com sucesso.");
            } else {
                throw new Error('Falha ao arquivar o aluno');
            }
        } catch (error: any) {
            console.error(error);
            alert(`Ocorreu um erro ao arquivar o aluno: ${error.message}`);
        } finally {
            setIsDeleting(false);
            setSelectedAluno(null);
        }
    }, [selectedAluno, deleteStudentFromApi]);

    return (
        <Layout>
            <Container>
                <Box component="form" sx={BoxStyleCadastro} onSubmit={handleSubmit(onSubmit)} noValidate>
                    <HeaderForm titulo={"Arquivar Alunos"} />
                    <Typography sx={{ color: "black", fontWeight: "bold" }}>
                        Ao arquivar os alunos, eles serão deletados do banco de dados, mas os seus dados serão salvos em uma planilha do Google que pode ser acessada por esse link:<br />
                        <a href="https://docs.google.com/spreadsheets/d/1RPYA67-ycJAypRlN_GDwNtqpx0sKhyjF7NfDLTbshG8/edit#gid=0">Acessar Planilha de Alunos Arquivados</a>
                    </Typography>
                    <br />
                    <Controller
                        name="alunoId"
                        control={control}
                        render={({ field }) => (
                            <Autocomplete
                                {...field}
                                value={selectedAluno}
                                options={alunosOptions}
                                getOptionLabel={(option) => `${option.nome} - ${option.nomeDaTurma}`}
                                onChange={(_, value) => setSelectedAluno(value)}
                                renderInput={(params) => <TextField {...params} label="Selecione o Aluno" variant="outlined" fullWidth />}
                                isOptionEqualToValue={(option, value) => option.alunoId === value?.alunoId}
                                filterSelectedOptions
                                autoComplete
                                autoHighlight
                            />
                        )}
                    />

                    <Button type="submit" fullWidth variant="contained" color="primary" sx={{ mt: 3, mb: 2 }} disabled={isDeleting}>
                        {isDeleting ? "Arquivando estudante e atualizando turmas... aguarde..." : "Arquivar Aluno"}
                    </Button>
                </Box>
            </Container>
        </Layout>
    );
}
