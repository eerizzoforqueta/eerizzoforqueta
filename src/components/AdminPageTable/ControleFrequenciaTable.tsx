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

  // Lista de meses em minúsculas (para comparar com as chaves em 'presencas')
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho'];

  // Filtra os alunos válidos (evitando valores nulos)
  const validAlunos = useMemo(() => alunosDaTurma.filter(Boolean), [alunosDaTurma]);

  /**
   * Retorna o número total de faltas para um aluno em um determinado mês.
   * Considera que:
   * - Cada aluno possui um objeto `presencas` com chaves correspondentes aos meses (em minúsculas).
   * - Cada valor em `presencas[month]` é um objeto com chaves no formato "dia-mês-ano".
   * - Apenas os dias com valor exatamente false (indicação de ausência) são contados.
   *
   * @param aluno - Dados do aluno.
   * @param month - Nome do mês (ex.: "janeiro").
   */
  const countAbsencesForStudent = (aluno: Aluno, month: string): number => {
    if (!aluno.presencas || !aluno.presencas[month]) return 0;
    const days = aluno.presencas[month];
    // Apenas contar os dias cujo valor seja exatamente false
    return Object.values(days).filter((value) => value === false).length;
  };

  // Cria os dados para a tabela: para cada aluno, cria um objeto com a propriedade "nome" e, para cada mês, o total de faltas.
  const tableData = useMemo(() => {
    return validAlunos.map((aluno) => {
      const row: { nome: string; [key: string]: number | string } = { nome: aluno.nome };
      months.forEach((month) => {
        row[month] = countAbsencesForStudent(aluno, month);
      });
      return row;
    });
  }, [validAlunos]);

  return (
    <Modal open={isOpen} onClose={onClose}>
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
          '& .MuiTableCell-root': {
            padding: '8px',
            borderRight: '1px solid rgba(224, 224, 224, 1)',
          },
          '& .MuiTableCell-head': {
            backgroundColor: '#f5f5f5',
            fontWeight: 'bold',
          },
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ color: 'black', mb: 2 }}>
          Faltas mensais na turma: {nomeDaTurma}
        </Typography>
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table stickyHeader aria-label="Tabela de Faltas Mensais por Aluno">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Aluno</TableCell>
                {months.map((month) => (
                  <TableCell key={month} align="center" sx={{ fontWeight: 'bold' }}>
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
                    {months.map((month) => (
                      <TableCell key={month} align="center">
                        {row[month]} faltas
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={months.length + 1} align="center">
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