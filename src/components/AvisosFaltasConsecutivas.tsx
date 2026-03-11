'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Stack,
  Chip,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  InputAdornment,
  IconButton,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useData } from '@/context/context';
import { Modalidade, Turma, Aluno } from '@/interface/interfaces';
import { AvisoStudents } from '@/components/AvisosModal/Avisos';

const MESES_PT = [
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
] as const;
type MesStr = (typeof MESES_PT)[number];

const COLS = {
  aluno: 220,
  modalidade: 120,
  turma: 320,
  categoria: 140,
  nucleo: 160,
  datas: 260,
  faltas: 110,
  freq: 140,
  treinos: 130,
  contato: 90,
  aviso: 90,
} as const;

type LinhaAviso = {
  id: string;
  alunoNome: string;
  modalidade: string;
  turmaNome: string;
  categoria: string;
  nucleo: string;
  telefone?: string | number;
  datasSequencia: string[];
  datasSequenciaCompleta: string[];
  faltasSeguidas: number;
  freqMesAtual: string;
  treinosSemana: number;
  primeiraFaltaData: string;
  primeiraFaltaTimestamp: number;
  ultimaFaltaData: string;
  ultimaFaltaTimestamp: number;
};

type AttendanceEntry = {
  dateKey: string;
  present: boolean;
  timestamp: number;
};

function normalizar(t: unknown) {
  return (t ?? '').toString().trim().toLowerCase();
}

function monthNameFromDate(d: Date): MesStr {
  return MESES_PT[d.getMonth()];
}

function parseDateKeyToTimestamp(key: string): number {
  const [d, m, y] = key.split('-').map((n) => parseInt(n, 10));
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) {
    return Number.POSITIVE_INFINITY;
  }
  return new Date(y, m - 1, d).getTime();
}

function parseFlexibleDateToTimestamp(dateValue: string, endOfDay = false): number | null {
  const value = dateValue.trim();
  if (!value) return null;

  let day: number;
  let month: number;
  let year: number;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split('/').map((n) => parseInt(n, 10));
    day = d;
    month = m;
    year = y;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map((n) => parseInt(n, 10));
    day = d;
    month = m;
    year = y;
  } else {
    return null;
  }

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }

  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date.getTime();
}

function isValidFlexibleDate(dateValue: string): boolean {
  if (!dateValue.trim()) return true;
  return parseFlexibleDateToTimestamp(dateValue) !== null;
}

function cleanPhoneToWa(n: string | number | undefined): string | null {
  if (!n) return null;
  const onlyDigits = String(n).replace(/\D/g, '');
  if (onlyDigits.length < 10) return null;
  return `https://wa.me/55${onlyDigits}`;
}

function flattenAttendances(
  presencas: Aluno['presencas'] | undefined,
  ignoreFuture: boolean,
  now: Date
): AttendanceEntry[] {
  if (!presencas) return [];

  const nowTs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  ).getTime();

  const entries: AttendanceEntry[] = [];

  Object.values(presencas).forEach((presMes) => {
    Object.entries(presMes || {}).forEach(([dateKey, value]) => {
      if (typeof value !== 'boolean') return;

      const timestamp = parseDateKeyToTimestamp(dateKey);
      if (!Number.isFinite(timestamp)) return;
      if (ignoreFuture && timestamp > nowTs) return;

      entries.push({
        dateKey,
        present: value,
        timestamp,
      });
    });
  });

  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

function getCurrentConsecutiveAbsenceRun(entries: AttendanceEntry[]): {
  faltasSeguidas: number;
  datasSequencia: string[];
  datasSequenciaCompleta: string[];
  primeiraFaltaData: string;
  primeiraFaltaTimestamp: number;
  ultimaFaltaData: string;
  ultimaFaltaTimestamp: number;
} | null {
  if (entries.length === 0) return null;

  let index = entries.length - 1;
  if (entries[index].present) return null;

  const currentRun: AttendanceEntry[] = [];

  while (index >= 0 && entries[index] && !entries[index].present) {
    currentRun.unshift(entries[index]);
    index -= 1;
  }

  if (currentRun.length < 3) return null;

  const primeira = currentRun[0];
  const ultima = currentRun[currentRun.length - 1];

  return {
    faltasSeguidas: currentRun.length,
    datasSequencia: currentRun.slice(-3).map((entry) => entry.dateKey),
    datasSequenciaCompleta: currentRun.map((entry) => entry.dateKey),
    primeiraFaltaData: primeira.dateKey,
    primeiraFaltaTimestamp: primeira.timestamp,
    ultimaFaltaData: ultima.dateKey,
    ultimaFaltaTimestamp: ultima.timestamp,
  };
}

function getCurrentMonthFrequency(
  presencas: Aluno['presencas'] | undefined,
  ignoreFuture: boolean,
  now: Date
): string {
  if (!presencas) return '0.0';

  const mesAtual = monthNameFromDate(now);
  const presMes = presencas[mesAtual] || {};
  const nowTs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  ).getTime();

  let presentes = 0;
  let total = 0;

  Object.entries(presMes).forEach(([dateKey, value]) => {
    if (typeof value !== 'boolean') return;

    const timestamp = parseDateKeyToTimestamp(dateKey);
    if (!Number.isFinite(timestamp)) return;
    if (ignoreFuture && timestamp > nowTs) return;

    total += 1;
    if (value) presentes += 1;
  });

  return total > 0 ? ((presentes / total) * 100).toFixed(1) : '0.0';
}

export default function AvisosFaltasConsecutivas() {
  const { fetchModalidades } = useData();

  const [query, setQuery] = useState('');
  const [ignoreFuture, setIgnoreFuture] = useState(true);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [linhaSelecionada, setLinhaSelecionada] = useState<LinhaAviso | null>(null);

  const [dataInicioInput, setDataInicioInput] = useState('');
  const [dataFimInput, setDataFimInput] = useState('');
  const [dataInicioAplicada, setDataInicioAplicada] = useState('');
  const [dataFimAplicada, setDataFimAplicada] = useState('');
  const [periodError, setPeriodError] = useState('');

  const dataInicioInvalida = !isValidFlexibleDate(dataInicioInput);
  const dataFimInvalida = !isValidFlexibleDate(dataFimInput);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetchModalidades()
      .then((mods) => {
        if (!active) return;
        const valid = mods.filter(
          (m) =>
            !!m &&
            !['arquivados', 'excluidos', 'temporarios'].includes(
              m.nome.toLowerCase()
            )
        );
        setModalidades(valid);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchModalidades]);

  const treinosPorAlunoNome = useMemo(() => {
    const map = new Map<string, number>();

    modalidades.forEach((mod) => {
      const turmasArr: Turma[] = Array.isArray(mod.turmas)
        ? mod.turmas
        : (Object.values(mod.turmas || {}) as Turma[]);

      turmasArr.forEach((turma) => {
        const alunosArr: Aluno[] = Array.isArray(turma.alunos)
          ? turma.alunos
          : (Object.values(turma.alunos || {}) as Aluno[]);

        alunosArr
          .filter(Boolean)
          .forEach((aluno) => {
            if (!aluno?.nome) return;
            const key = aluno.nome.trim();
            map.set(key, (map.get(key) || 0) + 1);
          });
      });
    });

    return map;
  }, [modalidades]);

  const linhas: LinhaAviso[] = useMemo(() => {
    const now = new Date();
    const out: LinhaAviso[] = [];

    modalidades.forEach((mod) => {
      const turmasArr: Turma[] = Array.isArray(mod.turmas)
        ? mod.turmas
        : (Object.values(mod.turmas || {}) as Turma[]);

      turmasArr.forEach((turma) => {
        const alunosArr: Aluno[] = Array.isArray(turma.alunos)
          ? turma.alunos
          : (Object.values(turma.alunos || {}) as Aluno[]);

        alunosArr
          .filter(Boolean)
          .forEach((aluno, idx) => {
            if (!aluno?.nome) return;

            const entries = flattenAttendances(aluno.presencas, ignoreFuture, now);
            if (entries.length === 0) return;

            const currentRun = getCurrentConsecutiveAbsenceRun(entries);
            if (!currentRun) return;

            const freqMesAtual = getCurrentMonthFrequency(
              aluno.presencas,
              ignoreFuture,
              now
            );

            out.push({
              id: `${aluno.nome}-${turma.uuidTurma || turma.nome_da_turma}-${idx}`,
              alunoNome: aluno.nome,
              modalidade: turma.modalidade || mod.nome,
              turmaNome: turma.nome_da_turma,
              categoria: turma.categoria,
              nucleo: turma.nucleo,
              telefone: aluno.telefoneComWhatsapp,
              datasSequencia: currentRun.datasSequencia,
              datasSequenciaCompleta: currentRun.datasSequenciaCompleta,
              faltasSeguidas: currentRun.faltasSeguidas,
              freqMesAtual,
              treinosSemana: treinosPorAlunoNome.get(aluno.nome.trim()) || 1,
              primeiraFaltaData: currentRun.primeiraFaltaData,
              primeiraFaltaTimestamp: currentRun.primeiraFaltaTimestamp,
              ultimaFaltaData: currentRun.ultimaFaltaData,
              ultimaFaltaTimestamp: currentRun.ultimaFaltaTimestamp,
            });
          });
      });
    });

    out.sort((a, b) => a.alunoNome.localeCompare(b.alunoNome));
    return out;
  }, [modalidades, ignoreFuture, treinosPorAlunoNome]);

  const linhasFiltradas = useMemo(() => {
    const q = normalizar(query);
    const inicioTs = parseFlexibleDateToTimestamp(dataInicioAplicada, false);
    const fimTs = parseFlexibleDateToTimestamp(dataFimAplicada, true);

    return linhas.filter((l) => {
      const matchTexto =
        !q ||
        normalizar(l.alunoNome).includes(q) ||
        normalizar(l.modalidade).includes(q) ||
        normalizar(l.turmaNome).includes(q) ||
        normalizar(l.categoria).includes(q) ||
        normalizar(l.nucleo).includes(q);

      if (!matchTexto) return false;
      if (inicioTs !== null && l.primeiraFaltaTimestamp < inicioTs) return false;
      if (fimTs !== null && l.primeiraFaltaTimestamp > fimTs) return false;

      return true;
    });
  }, [linhas, query, dataInicioAplicada, dataFimAplicada]);

  const aplicarPeriodo = () => {
    setPeriodError('');

    if (dataInicioInvalida || dataFimInvalida) {
      setPeriodError('Informe datas válidas no formato dd/mm/aaaa ou aaaa-mm-dd.');
      return;
    }

    const inicioTs = parseFlexibleDateToTimestamp(dataInicioInput, false);
    const fimTs = parseFlexibleDateToTimestamp(dataFimInput, true);

    if (inicioTs !== null && fimTs !== null && inicioTs > fimTs) {
      setPeriodError('A data inicial não pode ser maior que a data final.');
      return;
    }

    setDataInicioAplicada(dataInicioInput.trim());
    setDataFimAplicada(dataFimInput.trim());
  };

  const limparPeriodo = () => {
    setDataInicioInput('');
    setDataFimInput('');
    setDataInicioAplicada('');
    setDataFimAplicada('');
    setPeriodError('');
  };

  const periodoAplicadoLabel = useMemo(() => {
    if (!dataInicioAplicada && !dataFimAplicada) return '';
    return `Período aplicado: ${dataInicioAplicada || '...'} até ${dataFimAplicada || '...'}`;
  }, [dataInicioAplicada, dataFimAplicada]);

  return (
    <>
      <Paper sx={{ mt: 4, p: 2, width: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Alunos com 3 ou mais faltas consecutivas atuais ({linhasFiltradas.length})
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={ignoreFuture}
                onChange={(e) => setIgnoreFuture(e.target.checked)}
                color="primary"
              />
            }
            label="Ignorar dias futuros"
          />

          <TextField
            size="small"
            type="text"
            label="Data inicial"
            placeholder="dd/mm/aaaa"
            value={dataInicioInput}
            onChange={(e) => setDataInicioInput(e.target.value)}
            sx={{ minWidth: 170 }}
            error={dataInicioInvalida}
            helperText={dataInicioInvalida ? 'Data inválida' : ''}
            inputProps={{ inputMode: 'numeric' }}
          />

          <TextField
            size="small"
            type="text"
            label="Data final"
            placeholder="dd/mm/aaaa"
            value={dataFimInput}
            onChange={(e) => setDataFimInput(e.target.value)}
            sx={{ minWidth: 170 }}
            error={dataFimInvalida}
            helperText={dataFimInvalida ? 'Data inválida' : ''}
            inputProps={{ inputMode: 'numeric' }}
          />

          <Button variant="contained" onClick={aplicarPeriodo}>
            Procurar período
          </Button>

          <Button variant="outlined" onClick={limparPeriodo}>
            Limpar período
          </Button>

          <TextField
            size="small"
            label="Pesquisar (aluno, modalidade, turma, categoria ou núcleo)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1, minWidth: 260 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
          O filtro temporal considera a <strong>primeira falta da sequência atual</strong>. Assim, ao filtrar março, casos que começaram em fevereiro deixam de aparecer.
        </Typography>

        {periodoAplicadoLabel && (
          <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
            {periodoAplicadoLabel}
          </Typography>
        )}

        {periodError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {periodError}
          </Alert>
        )}

        {loading ? (
          <Typography>Carregando...</Typography>
        ) : linhasFiltradas.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>
            Nenhum aluno com 3+ faltas consecutivas atuais no período informado.
          </Typography>
        ) : (
          <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
            <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', minWidth: 1120 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: COLS.aluno }}>Aluno</TableCell>
                  <TableCell sx={{ width: COLS.modalidade }}>Modalidade</TableCell>
                  <TableCell sx={{ width: COLS.turma }}>Turma</TableCell>
                  <TableCell sx={{ width: COLS.categoria }}>Categoria</TableCell>
                  <TableCell sx={{ width: COLS.nucleo, display: { xs: 'none', md: 'table-cell' } }}>
                    Núcleo
                  </TableCell>
                  <TableCell sx={{ width: COLS.datas }} align="center">
                    Datas das 3 últimas faltas
                  </TableCell>
                  <TableCell sx={{ width: COLS.faltas }} align="center">
                    Faltas seguidas
                  </TableCell>
                  <TableCell sx={{ width: COLS.freq }} align="center">
                    Freq. mês atual (%)
                  </TableCell>
                  <TableCell sx={{ width: COLS.treinos }} align="center">
                    Treinos/semana
                  </TableCell>
                  <TableCell sx={{ width: COLS.contato }} align="center">
                    Contato
                  </TableCell>
                  <TableCell sx={{ width: COLS.aviso }} align="center">
                    Aviso
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {linhasFiltradas.map((l) => {
                  const wa = cleanPhoneToWa(l.telefone);

                  return (
                    <TableRow key={l.id}>
                      <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word', p: 1 }}>
                        {l.alunoNome}
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word', p: 1 }}>
                        {l.modalidade}
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word', p: 1 }}>
                        {l.turmaNome}
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word', p: 1 }}>
                        {l.categoria}
                      </TableCell>

                      <TableCell
                        sx={{
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          p: 1,
                          display: { xs: 'none', md: 'table-cell' },
                        }}
                      >
                        {l.nucleo}
                      </TableCell>

                      <TableCell align="center" sx={{ p: 1 }}>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="center"
                          sx={{ flexWrap: 'wrap' }}
                        >
                          {l.datasSequencia.map((d, idx) => (
                            <Chip key={`${d}-${idx}`} size="small" label={d} />
                          ))}
                        </Stack>
                      </TableCell>

                      <TableCell align="center" sx={{ p: 1 }}>
                        <Chip
                          color="error"
                          size="small"
                          label={l.faltasSeguidas}
                          onClick={() => setLinhaSelecionada(l)}
                          sx={{ cursor: 'pointer', fontWeight: 700 }}
                        />
                      </TableCell>

                      <TableCell align="center" sx={{ p: 1 }}>
                        {l.freqMesAtual}
                      </TableCell>

                      <TableCell align="center" sx={{ p: 1 }}>
                        <Chip size="small" label={l.treinosSemana} />
                      </TableCell>

                      <TableCell align="center" sx={{ p: 1 }}>
                        {wa ? (
                          <IconButton
                            size="small"
                            component="a"
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="WhatsApp"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        ) : (
                          '-'
                        )}
                      </TableCell>

                      <TableCell align="center" sx={{ p: 1 }}>
                        <AvisoStudents
                          alunoNome={l.alunoNome}
                          nomeDaTurma={l.turmaNome}
                          modalidade={l.modalidade}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog
        open={!!linhaSelecionada}
        onClose={() => setLinhaSelecionada(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Sequência atual de faltas</DialogTitle>

        <DialogContent dividers>
          {linhaSelecionada && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {linhaSelecionada.alunoNome}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {linhaSelecionada.modalidade} · {linhaSelecionada.turmaNome}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {linhaSelecionada.categoria} · {linhaSelecionada.nucleo}
                </Typography>
              </Box>

              <Divider />

              <Typography variant="body1">
                Total da sequência atual: <strong>{linhaSelecionada.faltasSeguidas}</strong> faltas consecutivas
              </Typography>

              <Typography variant="body2">
                Primeira falta da sequência: <strong>{linhaSelecionada.primeiraFaltaData}</strong>
              </Typography>

              <Typography variant="body2">
                Última falta da sequência: <strong>{linhaSelecionada.ultimaFaltaData}</strong>
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Datas que compõem essa sequência:
              </Typography>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {linhaSelecionada.datasSequenciaCompleta.map((data, idx) => (
                  <Chip key={`${data}-${idx}`} label={data} color="error" variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setLinhaSelecionada(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}