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
  MenuItem,
  InputAdornment,
  IconButton,
  Switch,
  FormControlLabel,
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
  freq: 110,
  contato: 90,
  aviso: 90,
} as const;

type LinhaAviso = {
  id: string;                 // único por aluno+turma
  alunoNome: string;
  modalidade: string;
  turmaNome: string;
  categoria: string;
  nucleo: string;
  telefone?: string | number;
  datasSequencia: string[];   // as 3 datas detectadas
  faltasSeguidas: number;     // normalmente 3+
  freqMes: string;            // "54.5" etc
};

function normalizar(t: unknown) {
  return (t ?? '').toString().trim().toLowerCase();
}

function parseDayNumber(key: string): number {
  // key no formato "d-m-YYYY"
  const [d] = key.split('-');
  const n = parseInt(d, 10);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function sortByDayKeyAsc(a: string, b: string) {
  return parseDayNumber(a) - parseDayNumber(b);
}

function monthNameFromDate(d: Date): MesStr {
  return MESES_PT[d.getMonth()];
}

function cleanPhoneToWa(n: string | number | undefined): string | null {
  if (!n) return null;
  const onlyDigits = String(n).replace(/\D/g, '');
  // Brasil: tentar 11 dígitos (DD + 9 + número)
  if (onlyDigits.length < 10) return null;
  return `https://wa.me/55${onlyDigits}`;
}

export default function AvisosFaltasConsecutivas() {
  const { fetchModalidades } = useData();

  // mês padrão = mês atual
  const [mes, setMes] = useState<MesStr>(monthNameFromDate(new Date()));
  const [query, setQuery] = useState('');
  const [ignoreFuture, setIgnoreFuture] = useState(true);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchModalidades()
      .then((mods) => {
        if (!active) return;
        // filtra “arquivados / excluidos / temporarios”
        const valid = mods.filter(
          (m) =>
            !!m &&
            !['arquivados', 'excluidos', 'temporarios'].includes(
              m.nome.toLowerCase()
            )
        );
        setModalidades(valid);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [fetchModalidades]);

  const linhas: LinhaAviso[] = useMemo(() => {
    const hoje = new Date();
    const hojeDia = hoje.getDate();
    const hojeMes = monthNameFromDate(hoje);
    const hojeAno = hoje.getFullYear();

    const out: LinhaAviso[] = [];

    modalidades.forEach((mod) => {
      const turmasArr: Turma[] = Array.isArray(mod.turmas)
        ? mod.turmas
        : Object.values(mod.turmas || {}) as Turma[];

      turmasArr.forEach((turma) => {
        const alunosArr: Aluno[] = Array.isArray(turma.alunos)
          ? turma.alunos
          : Object.values(turma.alunos || {}) as Aluno[];

        alunosArr
          .filter(Boolean)
          .forEach((aluno, idx) => {
            const presMes = aluno.presencas?.[mes] || {};
            // pega as datas (chaves) existentes
            let dayKeys = Object.keys(presMes).sort(sortByDayKeyAsc);

            // opcional: ignorar dias futuros (apenas se o mês for o atual)
            if (ignoreFuture && mes === hojeMes) {
              dayKeys = dayKeys.filter((k) => {
                const [d, m, y] = k.split('-').map((n) => parseInt(n, 10));
                if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y))
                  return false;
                if (y > hojeAno) return false;
                if (y < hojeAno) return true;
                // mesmo ano
                if (m > hoje.getMonth() + 1) return false;
                if (m < hoje.getMonth() + 1) return true;
                // mesmo mês
                return d <= hojeDia;
              });
            }

            if (dayKeys.length === 0) return;

            // calcula frequência do mês (somente os dias considerados)
            let presentes = 0;
            let total = 0;
            dayKeys.forEach((k) => {
              const v = presMes[k];
              if (typeof v === 'boolean') {
                total += 1;
                if (v) presentes += 1;
              }
            });
            const freq = total > 0 ? ((presentes / total) * 100).toFixed(1) : '0.0';

            // encontra a MAIOR sequência de falses consecutivos
            let bestRunLen = 0;
            let bestRunEndIdx = -1;
            let curLen = 0;

            dayKeys.forEach((k, i) => {
              const v = !!presMes[k]; // true=presente, false=falta
              if (!v) {
                curLen += 1;
                if (curLen > bestRunLen) {
                  bestRunLen = curLen;
                  bestRunEndIdx = i;
                }
              } else {
                curLen = 0;
              }
            });

            if (bestRunLen >= 3) {
              // pega as 3 últimas datas dessa melhor sequência
              const datasSequencia: string[] = [];
              for (
                let i = bestRunEndIdx - 2;
                i <= bestRunEndIdx;
                i += 1
              ) {
                const k = dayKeys[i];
                if (k) datasSequencia.push(k);
              }

              out.push({
                id: `${aluno.nome}-${turma.uuidTurma || turma.nome_da_turma}-${idx}`,
                alunoNome: aluno.nome,
                modalidade: turma.modalidade || mod.nome,
                turmaNome: turma.nome_da_turma,
                categoria: turma.categoria,
                nucleo: turma.nucleo,
                telefone: aluno.telefoneComWhatsapp,
                datasSequencia,
                faltasSeguidas: bestRunLen,
                freqMes: freq,
              });
            }
          });
      });
    });

    // ordena por nome
    out.sort((a, b) => a.alunoNome.localeCompare(b.alunoNome));
    return out;
  }, [modalidades, mes, ignoreFuture]);

  const linhasFiltradas = useMemo(() => {
    const q = normalizar(query);
    if (!q) return linhas;
    return linhas.filter((l) => {
      return (
        normalizar(l.alunoNome).includes(q) ||
        normalizar(l.modalidade).includes(q) ||
        normalizar(l.turmaNome).includes(q) ||
        normalizar(l.categoria).includes(q) ||
        normalizar(l.nucleo).includes(q)
      );
    });
  }, [linhas, query]);

  return (
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
          Alunos com 3 faltas consecutivas ({linhasFiltradas.length})
        </Typography>

        <TextField
          select
          size="small"
          label="Mês"
          value={mes}
          onChange={(e) => setMes(e.target.value as MesStr)}
          sx={{ minWidth: 160 }}
        >
          {MESES_PT.map((m) => (
            <MenuItem key={m} value={m}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </MenuItem>
          ))}
        </TextField>

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

      {loading ? (
        <Typography>Carregando...</Typography>
      ) : linhasFiltradas.length === 0 ? (
        <Typography sx={{ color: 'text.secondary' }}>
          Nenhum aluno com 3+ faltas consecutivas no mês selecionado.
        </Typography>
      ) : (
        <TableContainer
          sx={{
            width: '100%',
            overflowX: 'auto', // scroll horizontal interno quando necessário
          }}
        >
          <Table
            size="small"
            stickyHeader
            sx={{
              tableLayout: 'fixed', // respeita larguras abaixo
              minWidth: 1000,
            }}
          >
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
                  Freq. mês (%)
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
                      <Chip color="error" size="small" label={l.faltasSeguidas} />
                    </TableCell>

                    <TableCell align="center" sx={{ p: 1 }}>
                      {l.freqMes}
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
  );
}
