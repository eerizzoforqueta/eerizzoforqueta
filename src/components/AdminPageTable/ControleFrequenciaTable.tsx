import React, { useState, useMemo } from 'react';
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
  // Estado para o mês selecionado (valor será o índice do mês como string: "0" para janeiro, "1" para fevereiro, etc.)
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  
  // Lista de meses em português (em minúsculas, para combinar com as chaves geradas pelo sistema)
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho'];

  /**
   * Função para contar as ausências diárias (faltas) no mês selecionado.
   * Assume que o objeto aluno.presencas possui chaves com nomes de meses em minúsculas (ex: "janeiro")
   * e que cada entrada é um objeto com chaves no formato "dia-mês-ano" (ex: "10-3-2025").
   * Se o valor associado a um dia for falsy (ou seja, o aluno estava ausente), a contagem é incrementada.
   */
  const calculateDailyAbsences = (): { day: number; total: number }[] => {
    const monthIndex = parseInt(selectedMonth, 10) + 1; // Converte para base 1 (0 -> janeiro equivale a 1)
    // Obter o número de dias no mês selecionado (usando o ano atual para calcular)
    const currentYear = new Date().getFullYear();
    const daysInMonth = new Date(currentYear, monthIndex, 0).getDate();
    const dailyAbsences = Array.from({ length: daysInMonth }, () => 0);

    alunosDaTurma.forEach((aluno) => {
      const presencas = aluno?.presencas || {};
      // Para cada mês registrado no objeto de presenças do aluno
      Object.entries(presencas).forEach(([mesKey, dias]) => {
        // Comparar a chave do mês convertida para minúsculas com o mês selecionado
        if (mesKey.toLowerCase() === months[parseInt(selectedMonth, 10)]) {
          Object.entries(dias).forEach(([diaKey, isPresentValue]) => {
            // Espera-se que diaKey esteja no formato "dia-mês-ano", por exemplo, "10-3-2025"
            const partes = diaKey.split('-');
            if (partes.length < 2) return; // formato inválido
            const dia = Number(partes[0]);
            const mes = Number(partes[1]);
            // Se o mês na chave for igual ao mês selecionado, e o valor for falso (ausência), incrementa
            if (mes === monthIndex && !Boolean(isPresentValue)) {
              dailyAbsences[dia - 1]++;
            }
          });
        }
      });
    });

    return dailyAbsences
      .map((total, idx) => ({ day: idx + 1, total }))
      .filter((item) => item.total > 0);
  };

  // useMemo para evitar recalcular a cada renderização
  const dailyData = useMemo(() => {
    return selectedMonth ? calculateDailyAbsences() : [];
  }, [selectedMonth, alunosDaTurma]);

  // Função para atualizar o mês selecionado
  const handleChangeMonth = (event: SelectChangeEvent) => {
    setSelectedMonth(event.target.value);
  };

  // Para exibir no cabeçalho, converte o índice para número e para string com formatação
  const displayMonthNumber = selectedMonth ? parseInt(selectedMonth, 10) + 1 : 0;

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
          Total de faltas da turma: {nomeDaTurma} no mês de:{' '}
          {selectedMonth ? months[parseInt(selectedMonth, 10)].charAt(0).toUpperCase() + months[parseInt(selectedMonth, 10)].slice(1) : ""}
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
              {month.charAt(0).toUpperCase() + month.slice(1)}
            </MenuItem>
          ))}
        </Select>

        {selectedMonth && (
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} size="small" aria-label="Tabela de Faltas">
              <TableHead>
                <TableRow>
                  {dailyData.map(({ day }) => (
                    <TableCell key={day} align="center">
                      {`${String(day).padStart(2, '0')}/${String(displayMonthNumber).padStart(2, '0')}`}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {dailyData.map(({ day, total }) => (
                    <TableCell key={day} align="center">
                      {total} faltas
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Button onClick={onClose} variant="contained" color="error" sx={{ alignSelf: 'center', mt: 2 }}>
          Fechar
        </Button>
      </Box>
    </Modal>
  );
};
