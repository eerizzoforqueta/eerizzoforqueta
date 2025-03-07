import React, { useState, useMemo } from 'react';
import {
  Box,
  Modal,
  Typography,
  Button,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  SelectChangeEvent,
} from '@mui/material';
import { Aluno, TurmaPresencaSemanalProps } from '@/interface/interfaces';

export const TurmaPresencaSemanal: React.FC<TurmaPresencaSemanalProps> = ({
  alunosDaTurma,
  nomeDaTurma,
  isOpen,
  onClose,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',"julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"];

  /**
   * Calcula as presenças diárias para o mês selecionado.
   * - Considera as chaves de presença no formato "dia-mês-ano" (por exemplo, "10-3-2025").
   * - Converte o valor de presença usando Boolean() (caso seja string ou número).
   * - Ignora a comparação do ano; se o mês extraído corresponder ao mês selecionado, conta.
   */
  const calculateDailyPresences = () => {
    const monthIndex = parseInt(selectedMonth, 10) + 1; // 0 -> janeiro equivale a 1
    // Para determinar os dias do mês, usamos o ano atual (não afeta a contagem se os registros tiverem outro ano)
    const currentYear = new Date().getFullYear();
    const daysInMonth = new Date(currentYear, monthIndex, 0).getDate();
    const dailyPresences = Array.from({ length: daysInMonth }, () => 0);

    alunosDaTurma.forEach((aluno) => {
      const presencas = aluno?.presencas || {};
      // Log para depuração: exibe as entradas de presenças do aluno
      // console.log(`Presenças do aluno ${aluno.nome}:`, presencas);
      Object.entries(presencas).forEach(([mesKey, dias]) => {
        Object.entries(dias).forEach(([dayKey, isPresentValue]) => {
          // Supondo que a chave esteja no formato "dia-mês-ano"
          const parts = dayKey.split('-');
          if (parts.length < 2) return; // formato inválido
          const day = Number(parts[0]);
          const month = Number(parts[1]);
          // Use Boolean() para converter isPresentValue
          const isPresent = Boolean(isPresentValue);
          if (month === monthIndex && isPresent) {
            dailyPresences[day - 1]++;
          }
        });
      });
    });

    // Para depuração, log do resultado calculado:
    // console.log('Daily presences:', dailyPresences);

    return dailyPresences
      .map((total, day) => ({ day: day + 1, total }))
      .filter((item) => item.total > 0);
  };

  // Evita recálculos desnecessários
  const dailyData = useMemo(() => (selectedMonth ? calculateDailyPresences() : []), [selectedMonth, alunosDaTurma]);

  const handleChangeMonth = (event: SelectChangeEvent) => {
    setSelectedMonth(event.target.value);
  };

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
        <Typography variant="h6" sx={{ color: 'black', mb: 2 }}>
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
            <Table sx={{ minWidth: 650 }} size="small" aria-label="Tabela de Presenças">
              <TableHead>
                <TableRow>
                  {dailyData.map(({ day }) => (
                    <TableCell key={day} align="center">
                      {`${String(day).padStart(2, '0')}/${String(monthIndex).padStart(2, '0')}`}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {dailyData.map(({ day, total }) => (
                    <TableCell key={day} align="center">
                      {total} alunos
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Button onClick={onClose} variant="contained" color="error" sx={{ alignSelf: 'center', mt: 1 }}>
          Fechar
        </Button>
      </Box>
    </Modal>
  );
};
