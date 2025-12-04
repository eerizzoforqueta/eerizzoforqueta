/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { Modalidade, Turma, Aluno } from '@/interface/interfaces';
import {
  TableRow,
  TableCell,
  Table,
  TableHead,
  TableBody,
  TableContainer,
  Paper,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
  Button,
} from '@mui/material';

import { ControleFrequenciaTableNoSSR } from './DynamicComponents';
import {
  BoxStyleTurmaInfoTable,
  TituloSecaoStyle,
} from '@/utils/Styles';
import { useData } from '@/context/context';
import { TurmaPresencaSemanal } from './TurmaPresencaSemanal';

const months = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

// ---- helper: total de presenças de uma turma em um mês (1–12) ----
function computeTotalPresencasTurma(
  alunos: Aluno[] | undefined,
  monthIndex: number,
): number {
  if (!alunos || !Array.isArray(alunos)) return 0;

  let total = 0;

  alunos.forEach((aluno) => {
    const presencas = (aluno as any)?.presencas || {};
    Object.entries(presencas).forEach(([mesKey, dias]) => {
      Object.entries(dias as Record<string, unknown>).forEach(
        ([dayKey, isPresentValue]) => {
          // "10-3-2025" -> [10, 3, 2025]
          const parts = dayKey.split('-');
          if (parts.length < 2) return;
          const month = Number(parts[1]);
          const isPresent = Boolean(isPresentValue);
          if (month === monthIndex && isPresent) {
            total++;
          }
        },
      );
    });
  });

  return total;
}

export default function TurmasInfoTable() {
  const { fetchModalidades } = useData();
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [selectedModalidade, setSelectedModalidade] = useState<string>('');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPresencaSemanalModalOpen, setIsPresencaSemanalModalOpen] =
    useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // novo: mês selecionado para o relatório CSV (todas as modalidades)
  const [selectedMonthCsv, setSelectedMonthCsv] = useState<string>('');

  const handleOpenModal = (turma: Turma) => {
    if (turma.capacidade_atual_da_turma > 0) {
      setSelectedTurma(turma);
      setIsModalOpen(true);
    } else {
      alert('Essa turma não possui alunos');
    }
  };

  const handleOpenPresencaSemanalModal = (turma: Turma) => {
    if (turma.capacidade_atual_da_turma > 0) {
      setSelectedTurma(turma);
      setIsPresencaSemanalModalOpen(true);
    } else {
      alert('Esta turma não possui alunos');
    }
  };

  const filteredTurmas = turmas.filter((turma) =>
    turma.nome_da_turma.toLowerCase().includes(searchTerm),
  );

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
  };

  useEffect(() => {
    fetchModalidades().then((data) => {
      const validModalidades = data.filter(
        (mod) => mod.nome !== 'arquivados' && mod.nome !== 'excluidos',
      );
      setModalidades(validModalidades);
    });
  }, [fetchModalidades]);

  // continua usando selectedModalidade apenas para a TABELA da tela
  useEffect(() => {
    if (selectedModalidade) {
      const modalidadeEscolhida = modalidades.find(
        (modalidade) => modalidade.nome === selectedModalidade,
      );

      setTurmas(modalidadeEscolhida ? modalidadeEscolhida.turmas : []);
    } else {
      setTurmas([]);
    }
  }, [selectedModalidade, modalidades]);

  const handleModalidadeChange = (event: SelectChangeEvent<string>) => {
    setSelectedModalidade(event.target.value);
  };

  const handleMonthCsvChange = (event: SelectChangeEvent<string>) => {
    setSelectedMonthCsv(event.target.value);
  };

  // ---- Gera o CSV mensal COM TODAS AS MODALIDADES / TURMAS ----
  const handleGenerateMonthlyCsv = () => {
    if (!selectedMonthCsv) {
      alert('Selecione um mês antes de gerar o relatório.');
      return;
    }

    const monthIdx = parseInt(selectedMonthCsv, 10) + 1; // 1..12
    const monthName = months[parseInt(selectedMonthCsv, 10)];

    const header = [
      'Modalidade',
      'Turma',
      'Núcleo',
      'Categoria',
      `Total de presenças em ${monthName}`,
    ];

    const rows: (string | number)[][] = [];

    modalidades.forEach((mod) => {
      const turmasMod = mod.turmas || [];
      turmasMod.forEach((turma) => {
        const alunos = (Array.isArray(turma.alunos)
          ? turma.alunos
          : []) as Aluno[];
        const total = computeTotalPresencasTurma(alunos, monthIdx);
        rows.push([
          mod.nome,
          turma.nome_da_turma,
          turma.nucleo || '',
          turma.categoria || '',
          total,
        ]);
      });
    });

    // Se quiser excluir turmas com 0 presença, descomente:
    // const rowsFiltradas = rows.filter((r) => (r[4] as number) > 0);
    const rowsFiltradas = rows;

    if (!rowsFiltradas.length) {
      alert('Nenhum dado de presença encontrado para este mês.');
      return;
    }

    const csvContent = [header, ...rowsFiltradas]
      .map((row) =>
        row
          .map((field) =>
            `"${String(field).replace(/"/g, '""')}"`, // escapa aspas
          )
          .join(';'),
      )
      .join('\r\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-presencas-todas-modalidades-${monthName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={BoxStyleTurmaInfoTable}>
      <Typography sx={TituloSecaoStyle}>
        Informações Gerais das Turmas
      </Typography>

      {/* Filtro de modalidade e busca continuam só para a TABELA visual */}
      <FormControl fullWidth margin="normal">
        <InputLabel id="modalidade-select-label">Modalidade (opcional)</InputLabel>
        <Select
          labelId="modalidade-select-label"
          id="modalidade-select"
          value={selectedModalidade}
          label="Modalidade (opcional)"
          onChange={handleModalidadeChange}
        >
          <MenuItem value="">
            <em>Todas (apenas para o relatório)</em>
          </MenuItem>
          {modalidades.map((modalidade) => (
            <MenuItem key={modalidade.nome} value={modalidade.nome}>
              {modalidade.nome}
            </MenuItem>
          ))}
        </Select>

        <TextField
          label="Pesquisar pelo nome da turma (apenas na modalidade selecionada)"
          variant="outlined"
          fullWidth
          value={searchTerm}
          onChange={handleSearchChange}
          margin="normal"
        />

        {/* Seleção do mês + botão de gerar CSV (todas as modalidades) */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel id="mes-select-label">Mês do relatório</InputLabel>
            <Select
              labelId="mes-select-label"
              value={selectedMonthCsv}
              label="Mês do relatório"
              onChange={handleMonthCsvChange}
            >
              {months.map((month, index) => (
                <MenuItem key={index} value={index.toString()}>
                  {month}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateMonthlyCsv}
            disabled={!selectedMonthCsv || !modalidades.length}
          >
            Gerar Quantitativo Mensal de todas as turmas
          </Button>
        </Box>
      </FormControl>

      <Divider sx={{ my: 2 }} />

      {/* Tabela segue mostrando apenas a modalidade escolhida, para consulta visual */}
      <TableContainer component={Paper} sx={{ boxShadow: 3, borderRadius: 2 }}>
        <Table aria-label="simple table">
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'primary.contrastText' }}>
                Nome da Turma
              </TableCell>
              <TableCell
                sx={{ color: 'primary.contrastText', textAlign: 'center' }}
              >
                Núcleo
              </TableCell>
              <TableCell
                sx={{ color: 'primary.contrastText', textAlign: 'center' }}
              >
                Categoria
              </TableCell>
              <TableCell
                sx={{ color: 'primary.contrastText', textAlign: 'center' }}
              >
                Capacidade Máxima
              </TableCell>
              <TableCell
                sx={{ color: 'primary.contrastText', textAlign: 'center' }}
              >
                Capacidade Atual
              </TableCell>
              <TableCell
                sx={{ color: 'primary.contrastText', textAlign: 'center' }}
              >
                Presença Semanal
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTurmas.map((turma, index) => {
              const modalidade = selectedModalidade;
              let nomeDaTurmaDisplay = turma.nome_da_turma;

              if (
                modalidade &&
                !turma.nome_da_turma
                  .toLowerCase()
                  .includes(modalidade.toLowerCase())
              ) {
                nomeDaTurmaDisplay = `${modalidade}_${turma.nome_da_turma}`;
              }

              return (
                <TableRow
                  key={nomeDaTurmaDisplay}
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    bgcolor:
                      index % 2 === 0 ? 'background.default' : 'grey.100',
                  }}
                >
                  <TableCell
                    component="th"
                    scope="row"
                    onClick={() => handleOpenModal(turma)}
                    sx={{ cursor: 'pointer', color: 'text.primary' }}
                  >
                    {nomeDaTurmaDisplay}
                  </TableCell>
                  <TableCell
                    sx={{ color: 'text.primary', textAlign: 'center' }}
                  >
                    {turma.nucleo}
                  </TableCell>
                  <TableCell
                    sx={{ color: 'text.primary', textAlign: 'center' }}
                  >
                    {turma.categoria}
                  </TableCell>
                  <TableCell
                    sx={{ color: 'text.primary', textAlign: 'center' }}
                  >
                    {turma.capacidade_maxima_da_turma}
                  </TableCell>
                  <TableCell
                    sx={{ color: 'text.primary', textAlign: 'center' }}
                  >
                    {turma.capacidade_atual_da_turma}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={() => handleOpenPresencaSemanalModal(turma)}
                    >
                      Presença Semanal
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedTurma && (
        <ControleFrequenciaTableNoSSR
          alunosDaTurma={selectedTurma.alunos}
          nomeDaTurma={
            selectedModalidade &&
            !selectedTurma.nome_da_turma
              .toLowerCase()
              .includes(selectedModalidade.toLowerCase())
              ? `${selectedModalidade}_${selectedTurma.nome_da_turma}`
              : selectedTurma.nome_da_turma
          }
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {selectedTurma && isPresencaSemanalModalOpen && (
        <TurmaPresencaSemanal
          alunosDaTurma={selectedTurma.alunos}
          nomeDaTurma={
            selectedModalidade &&
            !selectedTurma.nome_da_turma
              .toLowerCase()
              .includes(selectedModalidade.toLowerCase())
              ? `${selectedModalidade}_${selectedTurma.nome_da_turma}`
              : selectedTurma.nome_da_turma
          }
          isOpen={isPresencaSemanalModalOpen}
          onClose={() => setIsPresencaSemanalModalOpen(false)}
        />
      )}
    </Box>
  );
}
