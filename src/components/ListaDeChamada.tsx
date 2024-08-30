import React, { useContext, useEffect, useState } from "react";
import {
  Box,
  Container,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Modal,
  TableContainer,
  Paper,
  useMediaQuery,
  useTheme,
  Button,
  Typography,
} from "@mui/material";
import Table from "@mui/joy/Table";
import { Aluno, StudentPresenceTableProps } from "@/interface/interfaces";
import { DataContext } from "@/context/context";
import { modalStyle } from "@/utils/Styles";
import { ListaDeChamadaModal } from "./ListaDeChamadaModal";

export const ListaDeChamada: React.FC<StudentPresenceTableProps> = ({
  alunosDaTurma,
  setAlunosDaTurma,
  modalidade,
  nomeDaTurma,
}) => {
  const { updateAttendanceInApi } = useContext(DataContext);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filteredAlunos, setFilteredAlunos] = useState<Aluno[]>([]);
  const [search, setSearch] = useState("");
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("xs"));

  const [alunosOrdenados, setAlunosOrdenados] = useState<Aluno[]>([]);

  useEffect(() => {
    const alunosOrdenados = [...alunosDaTurma]
      .filter(Boolean)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setAlunosOrdenados(alunosOrdenados);
  }, [alunosDaTurma]);

  const tableContainerStyles = {
    marginTop: 2,
    marginBottom: 2,
    overflowX: "auto",
    maxWidth: "100%",
    ...(isXs && {
      "& .MuiTableCell-sizeSmall": {
        padding: "6px 8px",
      },
      "& .MuiTypography-root": {
        fontSize: "0.75rem",
      },
    }),
  };

  const daysInMonth =
    alunosDaTurma.length > 0
      ? Object.keys(
          alunosDaTurma.find((aluno) => aluno !== null)?.presencas[
            selectedMonth
          ] || {}
        )
      : [];

  const handleOpenModal = (aluno: Aluno) => {
    setSelectedAluno(aluno);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAluno(null);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const filteredAlunosFind = alunosOrdenados.filter((aluno) =>
    aluno.nome.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const searchTermLowercased = search.toLowerCase();
    const filtered = filteredAlunosFind.filter(
      (aluno) =>
        aluno.nome.toLowerCase().includes(searchTermLowercased) ||
        nomeDaTurma.toLowerCase().includes(searchTermLowercased)
    );
    setFilteredAlunos(filtered);
  }, [search, filteredAlunosFind, nomeDaTurma]);

  const toggleAttendance = (alunoId: number, day: string) => {
    setAlunosDaTurma((current) =>
      current.map((student) => {
        if (student !== null && student.id === alunoId) {
          const updatedAttendance = {
            ...student.presencas,
            [selectedMonth]: {
              ...student.presencas[selectedMonth],
              [day]: !student.presencas[selectedMonth][day],
            },
          };

          const alunoUpdateData = {
            ...student,
            modalidade: modalidade,
            nomeDaTurma: nomeDaTurma,
            alunoId: alunoId.toString(),
            presencas: updatedAttendance,
          };

          updateAttendanceInApi(alunoUpdateData);

          return { ...student, presencas: updatedAttendance };
        }
        return student;
      })
    );
  };

  const countPresentStudents = () => {
    return alunosDaTurma.reduce((count, aluno) => {
      const isPresent =
        aluno &&
        aluno.presencas &&
        aluno.presencas[selectedMonth] &&
        aluno.presencas[selectedMonth][selectedDay];
      return count + (isPresent ? 1 : 0);
    }, 0);
  };

  const isAvisoValid = (aluno: Aluno) => {
    if (aluno.avisos && aluno.avisos.IsActive) {
      const avisoDate = new Date(aluno.avisos.dataaviso);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return avisoDate >= today;
    }
    return false;
  };

  return (
    <Container>
      <Box>
        <Modal
          open={isModalOpen}
          onClose={handleCloseModal}
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
        >
          <Box sx={modalStyle}>
            {selectedAluno && (
              <>
                {isAvisoValid(selectedAluno) && selectedAluno.avisos && (
                  <Box sx={{ backgroundColor: "#ffd700", padding: "8px", marginBottom: "16px" }}>
                    <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                      Aviso: {selectedAluno.avisos.textaviso}
                    </Typography>
                  </Box>
                )}
                <ListaDeChamadaModal
                  aluno={selectedAluno}
                  month={selectedMonth}
                />
              </>
            )}
            <Box sx={{ backgroundColor: "red" }}>
              <Typography
                sx={{
                  color: "black",
                  fontWeight: "bold",
                  textAlign: "center",
                  padding: "5px",
                }}
              >
                Telefone para Emergência: {selectedAluno?.telefoneComWhatsapp}
              </Typography>
            </Box>
          </Box>
        </Modal>

        <TextField
          select
          label="Selecionar Mês"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          fullWidth
        >
          <MenuItem value="fevereiro">Fevereiro</MenuItem>
          <MenuItem value="março">Março</MenuItem>
          <MenuItem value="abril">Abril</MenuItem>
          <MenuItem value="maio">Maio</MenuItem>
          <MenuItem value="junho">Junho</MenuItem>
          <MenuItem value="julho">Julho</MenuItem>
          <MenuItem value="agosto">Agosto</MenuItem>
          <MenuItem value="setembro">Setembro</MenuItem>
          <MenuItem value="outubro">Outubro</MenuItem>
          <MenuItem value="novembro">Novembro</MenuItem>
          <MenuItem value="dezembro">Dezembro</MenuItem>
        </TextField>

        {selectedMonth && (
          <TextField
            select
            label="Selecionar Dia"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            fullWidth
            margin="normal"
          >
            {daysInMonth.map((day) => (
              <MenuItem key={day} value={day}>
                {day}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField
          label="Pesquisar por nome do aluno"
          variant="outlined"
          fullWidth
          margin="normal"
          value={search}
          onChange={handleSearchChange}
        />

        {selectedDay && (
          <TableContainer component={Paper} sx={tableContainerStyles}>
            <Table
              borderAxis="both"
              size="sm"
              aria-label="tabela de presença"
              sx={{
                minWidth: 245,
                "& th, & td": {
                  fontSize: isXs ? "0.75rem" : "0.75rem",
                  padding: isXs ? "8px" : "16px",
                },
                "& tr": {
                  height: isXs ? "40px" : "60px",
                },
                "& thead th": {
                  fontWeight: "bold",
                  backgroundColor: "#eceff1",
                },
                "& tbody tr:nth-of-type(odd)": {
                  backgroundColor: "rgba(247, 247, 247, 1)",
                },
                
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "#eceff1",
                      textAlign: "center",
                    }}
                  >
                    Nome do Aluno
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "#eceff1",
                      textAlign: "center",
                    }}
                  >
                    Frequência
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "#eceff1",
                      textAlign: "center",
                    }}
                  >
                    Exibir Informações do Atleta
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAlunos.map((aluno, index) => {
                  const hasValidAviso = isAvisoValid(aluno);

                  return (
                    <TableRow
                      key={aluno.nome}
                      sx={{
                        "& > *": { borderBottom: "unset" },
                        backgroundColor: hasValidAviso ? "#ffeb3b" : "inherit",
                      }}
                    >
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: hasValidAviso ? "#b71c1c" : "inherit",
                        }}
                      >
                        {aluno.nome}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ color: "black", fontWeight: "bold" }}
                        onClick={() => toggleAttendance(aluno.id, selectedDay)}
                      >
                        {aluno.presencas[selectedMonth][selectedDay] ? "." : "F"}
                      </TableCell>
                      <TableCell onClick={() => handleOpenModal(aluno)}>
                        <Button
                          sx={{
                            width: "fit-content",
                            fontSize: "12px",
                            backgroundColor: hasValidAviso
                              ? "#d32f2f" // Cor vermelha para indicar um aviso
                              : "#1976d2", // Cor azul para botões normais
                            color: "white",
                            "&:hover": {
                              backgroundColor: hasValidAviso
                                ? "#b71c1c"
                                : "#1565c0",
                            },
                          }}
                          variant="contained"
                        >
                          {hasValidAviso ? "Ver Aviso" : "Ver Detalhes"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
      {selectedDay && (
        <Typography
          sx={{ color: "black", fontWeight: "bold" }}
          variant="subtitle1"
        >
          Número de alunos presentes: {countPresentStudents()}
        </Typography>
      )}
    </Container>
  );
};
