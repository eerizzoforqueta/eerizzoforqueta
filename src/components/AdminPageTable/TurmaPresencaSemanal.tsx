import React, { useState } from 'react';
import {
  Box,
  Modal,
  Typography,
  Button,
  Select,
  MenuItem,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
} from '@mui/material';
import { Aluno, TurmaPresencaSemanalProps } from '@/interface/interfaces';

export const TurmaPresencaSemanal: React.FC<TurmaPresencaSemanalProps> = ({
  alunosDaTurma,
  nomeDaTurma,
  isOpen,
  onClose,
}) => {
  // Estado para o mês selecionado (0 para janeiro, 1 para fevereiro, etc.)
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  // Lista de meses que serão mostrados no seletor
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho"];

  /**
   * Função que calcula o total de presenças (não faltas) para cada dia do mês selecionado.
   * Ela percorre cada aluno e, para cada entrada de presenças (os dias estão armazenados
   * com chaves no formato "dia-mês-ano"), se o mês corresponde ao mês selecionado e o aluno estava presente,
   * incrementa a contagem para aquele dia.
   *
   * Observação: Removemos a comparação do ano para que a contagem funcione mesmo que os dados estejam registrados para um ano diferente.
   */
  const calculateDailyPresences = () => {
    // Converte o selectedMonth para um número e ajusta para base 1 (0 => janeiro = 1)
    const monthIndex = parseInt(selectedMonth, 10) + 1;
    // Inicializa um array com zeros para cada dia do mês selecionado
    const daysInMonth = new Date(new Date().getFullYear(), monthIndex, 0).getDate();
    const dailyPresences = Array.from({ length: daysInMonth }, () => 0);

    // Para cada aluno na turma...
    alunosDaTurma.forEach((aluno) => {
      // Para cada chave no objeto 'presencas' do aluno (ex: "janeiro", "fevereiro", etc.)
      Object.entries(aluno?.presencas || {}).forEach(([monthKey, days]) => {
        // Para cada dia registrado nesse mês
        Object.entries(days).forEach(([dayKey, isPresent]) => {
          // dayKey esperado no formato "dia-mês-ano" (ex: "10-3-2025")
          const [day, month, year] = dayKey.split('-').map(Number);
          // Se o mês extraído for igual ao mês selecionado e o aluno estiver presente
          if (month === monthIndex && isPresent) {
            // Incrementa a contagem para o dia específico (ajustando o índice)
            dailyPresences[day - 1]++;
          }
        });
      });
    });

    // Converte o array de presenças em um array de objetos { day, total } apenas com dias que tiveram pelo menos 1 presença
    return dailyPresences
      .map((total, day) => ({
        day: day + 1,
        total,
      }))
      .filter((dayObj) => dayObj.total > 0);
  };

  // Atualiza o estado do mês selecionado
  const handleChangeMonth = (event: SelectChangeEvent) => {
    setSelectedMonth(event.target.value);
  };

  // Calcula o mês (base 1) a partir do valor selecionado
  const monthIndex = selectedMonth ? parseInt(selectedMonth, 10) + 1 : 0;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'fit-content',
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          overflowY: 'auto',
          maxHeight: '80vh',
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
        <Typography
          sx={{ color: 'black', mb: 2 }}
          variant="h6"
          gutterBottom
          component="div"
        >
          Total de presenças da turma: {nomeDaTurma} no mês de:
        </Typography>

        <Select
          fullWidth
          value={selectedMonth}
          onChange={handleChangeMonth}
          displayEmpty
          sx={{ mb: 3 }}
        >
          {months.map((month, index) => (
            <MenuItem key={index} value={index.toString()}>
              {month}
            </MenuItem>
          ))}
        </Select>

        {selectedMonth && (
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
              <TableHead>
                <TableRow>
                  {calculateDailyPresences().map(({ day }) => (
                    <TableCell key={day} align="center">
                      {`${String(day).padStart(2, '0')}/${String(monthIndex).padStart(2, '0')}`}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {calculateDailyPresences().map(({ day, total }) => (
                    <TableCell key={day} align="center">
                      {total} alunos
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Button
          onClick={onClose}
          variant="contained"
          color="error"
          sx={{ alignSelf: 'center', mt: '2px' }}
        >
          Fechar
        </Button>
      </Box>
    </Modal>
  );
};
