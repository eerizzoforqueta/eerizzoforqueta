import React, { useCallback, useContext, useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { TextField, Button, Box, Autocomplete, Container, Typography, Modal } from "@mui/material";

import { DataContext } from "@/context/context";
import { Aluno, Modalidade, TemporaryMoveStudentsPayload, Turma } from "@/interface/interfaces";
import { BoxStyleCadastro } from "@/utils/Styles";


import { HeaderForm } from "@/components/HeaderDefaultForm";
import axios from "axios";



function MoveAllStudents({ alunoNome, nomeDaTurmaOrigem, modalidadeOrigem }: { alunoNome: string, nomeDaTurmaOrigem: string, modalidadeOrigem: string }) {
    const { moveStudentTemp, modalidades, fetchModalidades } = useContext(DataContext);
    const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting, errors } } = useForm<TemporaryMoveStudentsPayload>();
    const [alunosComTurma, setAlunosComTurma] = useState<{ aluno: string; nomeDaTurma: string; modalidadeOrigem: string }[]>([]);
    const [turmasDestinoOptions, setTurmasDestinoOptions] = useState<Turma[]>([]);
    const [modalidadesOptions, setModalidadesOptions] = useState<Modalidade[]>([]);
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
        const modalidadeSelecionada = modalidades.find(mod => mod.nome === watch("modalidadeDestino"));
        setTurmasDestinoOptions(modalidadeSelecionada?.turmas || []);
    }, [watch("modalidadeDestino"), modalidades]);


    useEffect(() => {
        fetchModalidades().then((modalidadesFetched) => {
            const modalidadeAluno = modalidadesFetched.find((modalidade) => modalidade.nome.toLowerCase() !== "temporarios");
            if (modalidadeAluno && Array.isArray(modalidadeAluno.turmas)) {
                const alunosComTurma = modalidadeAluno.turmas.flatMap((turma) => {
                    const alunosArray = Array.isArray(turma.alunos) ? turma.alunos : [];
                    return alunosArray.filter(Boolean).map((aluno) => ({
                        aluno: aluno.nome,
                        nomeDaTurma: turma.nome_da_turma,
                        modalidadeOrigem: turma.modalidade
                    }));
                });


                //console.log(alunosComTurmaTemp)
                setAlunosComTurma(alunosComTurma);
            }
        });
    }, []);




    const onSubmit: SubmitHandler<TemporaryMoveStudentsPayload> = useCallback(async (data) => {
        console.log(data)

        try {
            const payload: TemporaryMoveStudentsPayload = {
                alunoNome: data.alunoNome,
                modalidadeOrigem: data.modalidadeOrigem,
                nomeDaTurmaOrigem: data.nomeDaTurmaOrigem,
                modalidadeDestino: watch('modalidadeDestino'),
                nomeDaTurmaDestino: watch('nomeDaTurmaDestino'),
            };
            await moveStudentTemp(payload);
            await axios.post('/api/AjustarDadosTurma'); // Corrige os dados
            alert("Aluno movido com sucesso.");
            reset();
        } catch (error) {
            console.error("Erro ao mover aluno", error);
        }
    }, [moveStudentTemp, reset]);

    return (
        <>
            <Button variant="contained" color='error' onClick={handleOpen}>Trocar turma</Button>
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
                    <HeaderForm titulo={"Mudança de Turma"} />
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Nome"
                        value={alunoNome}
                        {...register("alunoNome")}
                        InputLabelProps={{
                            shrink: true,
                        }}


                    />

                    <TextField
                        margin="normal"
                        fullWidth
                        {...register("modalidadeOrigem")}
                        label="Turmas de Origem"
                        value={modalidadeOrigem}  // Usar o valor diretamente para exibição
                        InputLabelProps={{
                            shrink: true,
                        }}

                        helperText="Turmas de origem dos alunos selecionados"
                    />

                    <TextField
                        margin="normal"
                        fullWidth
                        {...register("nomeDaTurmaOrigem")}
                        label="Turmas de Origem"
                        value={nomeDaTurmaOrigem}  // Usar o valor diretamente para exibição
                        InputLabelProps={{
                            shrink: true,
                        }}

                        helperText="Turmas de origem dos alunos selecionados"
                    />



                    {/* Campo Autocomplete para Nome da Turma de Destino */}
                    <Autocomplete
                        options={modalidadesOptions}
                        getOptionLabel={(option) => option.nome}
                        onChange={(_, newValue) => {
                            setValue("modalidadeDestino", newValue?.nome ?? "");
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                {...register("modalidadeDestino")}
                                label="Modalidade de Destino"
                                margin="normal"
                                required
                                fullWidth
                                error={!!errors.modalidadeDestino}
                                helperText={errors.modalidadeDestino?.message || "Selecione a modalidade de destino"}
                            />
                        )}
                    />

                    <Autocomplete
                        options={turmasDestinoOptions}
                        getOptionLabel={(option) => option.nome_da_turma}
                        onChange={(_, newValue) => {
                            setValue("nomeDaTurmaDestino", newValue?.nome_da_turma ?? "");
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                {...register("nomeDaTurmaDestino")}
                                label="Nome da Turma de Destino"
                                margin="normal"
                                required
                                fullWidth
                                error={!!errors.nomeDaTurmaDestino}
                                helperText={errors.nomeDaTurmaDestino?.message || "Selecione a turma de destino"}
                            />
                        )}
                    />


                    <Button
                        type="submit"
                        variant="contained"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Enviando dados, aguarde..." : " Mudar turma"}
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
function areEqual(prevProps: MoveAllStudentsProps, nextProps: MoveAllStudentsProps) {
    return prevProps.alunoNome === nextProps.alunoNome &&
        prevProps.nomeDaTurmaOrigem === nextProps.nomeDaTurmaOrigem &&
        prevProps.modalidadeOrigem === nextProps.modalidadeOrigem;
}

export const MoveAllStudentsMemo = React.memo(MoveAllStudents, areEqual);
