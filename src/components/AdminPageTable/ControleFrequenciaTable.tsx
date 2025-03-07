import {
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Box,
  Typography,
  useTheme,
  useMediaQuery,
  MenuItem,
  Select,
  SelectChangeEvent,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import { AdminTableProps, Aluno } from '@/interface/interfaces';
import Modal from '@mui/material/Modal';
import React, { useState,useMemo } from 'react';
// Props adicionais para o modal
interface ControleFrequenciaTableProps extends AdminTableProps {
  isOpen: boolean;
  onClose: () => void;
}

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'];

export default function ControleFrequenciaTable({
  alunosDaTurma,
  nomeDaTurma,
  isOpen,
  onClose,
}: ControleFrequenciaTableProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

  // Estado para o semestre selecionado: "primeiro" (janeiro a junho) ou "segundo" (julho a dezembro)
  const [selectedSemester, setSelectedSemester] = useState<'primeiro' | 'segundo'>('primeiro');

  // Define os meses de acordo com o semestre selecionado
  const semesterMonths = useMemo(() => {
    return selectedSemester === 'primeiro'
      ? ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho']
      : ['julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  }, [selectedSemester]);

  // Função para contar as faltas de um aluno em um determinado mês.
  // Apenas os dias cujo valor é exatamente false (indicando ausência) são contados.
  const countAbsencesForStudent = (aluno: Aluno, month: string): number => {
    if (!aluno.presencas || !aluno.presencas[month]) return 0;
    const monthData = aluno.presencas[month];
    return Object.values(monthData).filter(value => value === false).length;
  };

  // Gera os dados da tabela: para cada aluno, cria um objeto com o nome e, para cada mês do semestre, o total de faltas.
  const tableData = useMemo(() => {
    return alunosDaTurma
      .filter(Boolean)
      .map((aluno) => {
        // Definindo um objeto que tem uma propriedade "nome" e permite outras chaves string com valores numéricos
        const row: { nome: string; [key: string]: number | string } = { nome: aluno.nome };
        semesterMonths.forEach((month) => {
          row[month] = countAbsencesForStudent(aluno, month);
        });
        return row;
      });
  }, [alunosDaTurma, semesterMonths]);

  // Função para alterar o semestre selecionado
  const handleSemesterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedSemester(event.target.value as 'primeiro' | 'segundo');
  };

  return (
    <Modal open={isOpen} onClose={onClose} aria-labelledby="modal-title">
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: fullScreen ? '90%' : '80%',
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          overflowY: 'auto',
          maxHeight: '90vh',
          borderRadius: 2,
        }}
      >
        <Typography id="modal-title" variant="h6" gutterBottom sx={{ color: 'black', mb: 2 }}>
          Faltas mensais na turma: {nomeDaTurma}
        </Typography>

        {/* Controle para seleção do semestre */}
        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Selecione o Semestre:</Typography>
          <RadioGroup row value={selectedSemester} onChange={handleSemesterChange}>
            <FormControlLabel value="primeiro" control={<Radio />} label="1º Semestre" />
            <FormControlLabel value="segundo" control={<Radio />} label="2º Semestre" />
          </RadioGroup>
        </FormControl>

        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table stickyHeader aria-label="Tabela de Faltas Mensais por Aluno">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: theme.palette.primary.main, color: theme.palette.primary.contrastText }}>
                  Aluno
                </TableCell>
                {semesterMonths.map((month) => (
                  <TableCell key={month} align="center" sx={{ fontWeight: 'bold', bgcolor: theme.palette.primary.main, color: theme.palette.primary.contrastText }}>
                    {month.charAt(0).toUpperCase() + month.slice(1)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableData.length > 0 ? (
                tableData.map((row, index) => (
                  <TableRow key={index} sx={{ bgcolor: index % 2 === 0 ? 'background.default' : 'grey.100' }}>
                    <TableCell>{row.nome}</TableCell>
                    {semesterMonths.map((month) => (
                      <TableCell key={month} align="center">
                        {row[month]} faltas
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={semesterMonths.length + 1} align="center">
                    Nenhum aluno encontrado nesta turma.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button onClick={onClose} variant="contained" color="error">
            Fechar
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};