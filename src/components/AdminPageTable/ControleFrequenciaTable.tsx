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
 // Lista de meses em português (usaremos sempre em minúsculas para buscar nas chaves de presenças)
 const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho'];

 /**
  * Calcula as faltas acumuladas para cada mês.
  * Para cada mês da lista, soma o número de ausências de todos os alunos.
  * Considera que a propriedade aluno.presencas possui chaves com o nome do mês (em minúsculas)
  * e que cada valor é um objeto cujas chaves estão no formato "dia-mês-ano".
  */
 const calculateMonthlyAbsences = (): { month: string; total: number }[] => {
   return months.map((month) => {
     let totalAbsences = 0;
     alunosDaTurma.forEach((aluno) => {
       if (aluno.presencas && aluno.presencas[month]) {
         // Contar as ausências (valores falsos) para o mês
         const absences = Object.values(aluno.presencas[month]).filter(
           (value) => !Boolean(value)
         ).length;
         totalAbsences += absences;
       }
     });
     return { month, total: totalAbsences };
   });
 };

 // Memorizamos os dados mensais para evitar recálculos a cada renderização
 const monthlyData = useMemo(() => calculateMonthlyAbsences(), [alunosDaTurma]);

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
       <Typography variant="h6" sx={{ color: 'black', mb: 2 }}>
         Total de faltas da turma: {nomeDaTurma}
       </Typography>
       <TableContainer component={Paper}>
         <Table sx={{ minWidth: 650 }} size="small" aria-label="Tabela de Faltas">
           <TableHead>
             <TableRow>
               {monthlyData.map(({ month }) => (
                 <TableCell key={month} align="center">
                   {month.charAt(0).toUpperCase() + month.slice(1)}
                 </TableCell>
               ))}
             </TableRow>
           </TableHead>
           <TableBody>
             <TableRow>
               {monthlyData.map(({ month, total }) => (
                 <TableCell key={month} align="center">
                   {total} faltas
                 </TableCell>
               ))}
             </TableRow>
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