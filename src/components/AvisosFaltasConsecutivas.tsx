// src/components/AvisosFaltasConsecutivas.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  InputAdornment,
  TextField,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { useData } from '@/context/context';
import { Aluno, Modalidade, Turma } from '@/interface/interfaces';

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
];

function monthNowPT(): string {
  const now = new Date();
  return MESES_PT[now.getMonth()];
}

function normalizeAlunos(alunos: unknown): Aluno[] {
  if (!alunos) return [];
  const arr = Array.isArray(alunos) ? alunos : Object.values(alunos as Record<string, unknown>);
  return (arr as Aluno[]).filter(Boolean);
}

function ordenarDiaKey(a: string, b: string) {
  // "D-M-YYYY"
  const pa = a.split('-').map((n) => parseInt(n, 10));
  const pb = b.split('-').map((n) => parseInt(n, 10));
  // ano, mês, dia – para ordenação robusta entre meses distintos se necessário
  const da = new Date(pa[2], pa[1] - 1, pa[0]).getTime();
  const db = new Date(pb[2], pb[1] - 1, pb[0]).getTime();
  return da - db;
}

function parseKeyToDate(key: string): Date | null {
  const [d, m, y] = key.split('-').map((n) => parseInt(n, 10));
  if (!d || !m || !y) return null;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function norm(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

type LinhaAviso = {
  id: string; // para key
  alunoNome: string;
  modalidade: string;
  turmaNome: string;
  nucleo?: string;
  categoria?: string;
  datasSequencia: string[]; // as 3 datas mais recentes da sequência
  faltasSeguidas: number;   // tamanho da sequência final (>=3)
  freqMes: string;          // frequência do mês em %
  telefone?: string | number;
};

export default function AvisosFaltasConsecutivas() {
  const { fetchModalidades } = useData();
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [mesSel, setMesSel] = useState<string>(monthNowPT());
  const [busca, setBusca] = useState<string>('');

  // Configurações
  const LIMIAR = 3;          // 3 faltas consecutivas
  const IGNORAR_FUTURO = true;

  useEffect(() => {
    fetchModalidades()
      .then((mods) => {
        const valid = mods.filter(
          (m) =>
            m.nome.toLowerCase() !== 'arquivados' &&
            m.nome.toLowerCase() !== 'excluidos' &&
            m.nome.toLowerCase() !== 'temporarios'
        );
        setModalidades(valid);
      })
      .catch(console.error);
  }, [fetchModalidades]);

  const todasTurmas = useMemo(() => {
    const itens: { modalidade: string; turma: Turma; alunos: Aluno[] }[] = [];
    modalidades.forEach((mod) => {
      const turmas =
        mod.turmas
          ? (Array.isArray(mod.turmas) ? mod.turmas : (Object.values(mod.turmas) as Turma[]))
          : [];
      turmas.forEach((turma) => {
        itens.push({
          modalidade: mod.nome,
          turma,
          alunos: normalizeAlunos(turma.alunos),
        });
      });
    });
    return itens;
  }, [modalidades]);

  // Gera linhas apenas para quem tem >= 3 faltas consecutivas (naquele mês, por turma)
  const linhas: LinhaAviso[] = useMemo(() => {
    const out: LinhaAviso[] = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    todasTurmas.forEach(({ modalidade, turma, alunos }) => {
      alunos.forEach((aluno) => {
        const presencasMes = aluno.presencas?.[mesSel];
        if (!presencasMes) return;

        // Dias registrados no mês (ordenados)
        let keys = Object.keys(presencasMes);
        if (IGNORAR_FUTURO) {
          keys = keys.filter((k) => {
            const dt = parseKeyToDate(k);
            return dt && dt.getTime() <= hoje.getTime();
          });
        }
        if (keys.length === 0) return;
        keys.sort(ordenarDiaKey);

        // Frequência do mês (considerando apenas dias existentes no mapa)
        let pres = 0;
        let falt = 0;
        keys.forEach((k) => {
          const v = presencasMes[k];
          if (v === true) pres++;
          else if (v === false) falt++;
        });
        const total = pres + falt;
        const freqMes = total > 0 ? ((pres / total) * 100).toFixed(1) : '0.0';

        // Detectar sequência de 3+ faltas consecutivas (F-F-F...)
        let streak = 0;
        const filaUltimasDatas: string[] = []; // guardará as últimas 3 datas da sequência
        let temSequencia = false;

        keys.forEach((k) => {
          const v = presencasMes[k];
          if (v === false) {
            streak += 1;
            filaUltimasDatas.push(k);
            if (filaUltimasDatas.length > 3) filaUltimasDatas.shift(); // manter só as 3 mais recentes
            if (streak >= LIMIAR) {
              temSequencia = true; // continua para ter a mais recente
            }
          } else if (v === true) {
            streak = 0;
            filaUltimasDatas.length = 0;
          }
        });

        if (temSequencia) {
          out.push({
            id: `${(aluno.informacoesAdicionais as any)?.IdentificadorUnico ?? aluno.id}-${turma.uuidTurma ?? turma.nome_da_turma}`,
            alunoNome: aluno.nome,
            modalidade,
            turmaNome: turma.nome_da_turma,
            nucleo: turma.nucleo,
            categoria: turma.categoria,
            datasSequencia: [...filaUltimasDatas], // as 3 últimas faltas dessa sequência
            faltasSeguidas: streak, // tamanho final da sequência (>=3)
            freqMes,
            telefone: aluno.telefoneComWhatsapp,
          });
        }
      });
    });

    // Ordena: mais faltas consecutivas primeiro; depois por nome
    out.sort((a, b) => (b.faltasSeguidas - a.faltasSeguidas) || a.alunoNome.localeCompare(b.alunoNome));
    return out;
  }, [todasTurmas, mesSel]);

  const linhasFiltradas = useMemo(() => {
    const q = norm(busca);
    if (!q) return linhas;
    return linhas.filter(
      (l) =>
        norm(l.alunoNome).includes(q) ||
        norm(l.modalidade).includes(q) ||
        norm(l.turmaNome).includes(q) ||
        norm(l.categoria || '').includes(q) ||
        norm(l.nucleo || '').includes(q)
    );
  }, [linhas, busca]);

  function waLink(raw: string | number | undefined) {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return null;
    const msg = encodeURIComponent(
      `Olá! Notamos ${3}+ faltas consecutivas neste mês. Está tudo bem? Contamos com a presença nos próximos treinos.`
    );
    return `https://wa.me/55${digits}?text=${msg}`;
  }

  return (
    <Paper sx={{ mt: 4, p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
        Avisos — Alunos com 3+ faltas consecutivas (todas as turmas)
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2 }}
      >
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel>Mês</InputLabel>
          <Select
            label="Mês"
            value={mesSel}
            onChange={(e: SelectChangeEvent<string>) => setMesSel(e.target.value)}
          >
            {MESES_PT.map((m) => (
              <MenuItem key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Pesquisar (aluno, modalidade, turma, categoria ou núcleo)"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Chip color="error" label={`Encontrados: ${linhas.length}`} />
          <Chip color="primary" variant="outlined" label={`Exibindo: ${linhasFiltradas.length}`} />
          <Chip size="small" label="Ignora dias futuros" variant="outlined" />
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {linhasFiltradas.length === 0 ? (
        <Typography>Nenhum aluno com 3+ faltas consecutivas no mês selecionado.</Typography>
      ) : (
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Aluno</TableCell>
             
              <TableCell>Turma</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell>Núcleo</TableCell>
              <TableCell align="center">Datas das 3 últimas faltas</TableCell>
              <TableCell align="center">Faltas seguidas</TableCell>
             
            </TableRow>
          </TableHead>
          <TableBody>
            {linhasFiltradas.map((l) => {
              const link = waLink(l.telefone);
              return (
                <TableRow key={l.id}>
                  <TableCell>{l.alunoNome}</TableCell>
                 
                  <TableCell>{l.turmaNome}</TableCell>
                  <TableCell>{l.categoria}</TableCell>
                  <TableCell>{l.nucleo}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center" sx={{ flexWrap: 'wrap' }}>
                      {l.datasSequencia.map((d, idx) => (
                        <Chip key={`${d}-${idx}`} label={d} size="small" />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Chip color="error" label={l.faltasSeguidas} size="small" />
                  </TableCell>
                 
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
