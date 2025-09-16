// src/pages/alerta-faltas-mensal.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Container,
  Paper,
  Select,
  MenuItem,
  SelectChangeEvent,
  InputLabel,
  FormControl,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  IconButton,
  Stack,
  Divider,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import Layout from '@/components/TopBarComponents/Layout';
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

// ====== Helpers ======
function monthNameNow(): string {
  const now = new Date();
  return MESES_PT[now.getMonth()];
}

function normalizeAlunos(alunos: unknown): Aluno[] {
  if (!alunos) return [];
  const arr = Array.isArray(alunos) ? alunos : Object.values(alunos as Record<string, unknown>);
  return (arr as Aluno[]).filter(Boolean);
}

function ordenarPorDia(a: string, b: string) {
  const da = parseInt(a.split('-')[0], 10);
  const db = parseInt(b.split('-')[0], 10);
  return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
}

function parseDateKey(dayKey: string): Date | null {
  // esperado: "D-M-YYYY" (ex.: "12-4-2025")
  const [d, m, y] = dayKey.split('-').map((n) => parseInt(n, 10));
  if (!d || !m || !y) return null;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

type TurmaContexto = {
  modalidade: string;
  turma: Turma;
  alunos: Aluno[];
};

// ====== Página ======
export default function AlertaFaltasMensalGlobal() {
  const { fetchModalidades } = useData();

  // UI: mês + limite
  const [mesSel, setMesSel] = useState<string>(monthNameNow());
  const [limiteFaltas, setLimiteFaltas] = useState<number>(3);

  // dados
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);

  // Regras fixas (para simplificar a vida do prof):
  const IGNORAR_FUTURO = true;
  const SOMENTE_DIAS_REGISTRADOS = true;

  // Carrega todas as modalidades (exclui "arquivados", "excluidos" e "temporarios")
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

  // Flatten: todas as turmas com seu contexto (modalidade + turma + alunos normalizados)
  const todasTurmas: TurmaContexto[] = useMemo(() => {
    const itens: TurmaContexto[] = [];
    modalidades.forEach((mod) => {
      const turmas = mod.turmas
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

  // Para cada turma, calcula os "dias válidos" no mês selecionado:
  // - Ignora dias futuros
  // - Se SOMENTE_DIAS_REGISTRADOS: só conta dias em que pelo menos 1 aluno marcou presença (true)
  const diasValidosPorTurma = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const map = new Map<string, string[]>(); // chave = uuidTurma (ou nome) => dias válidos

    todasTurmas.forEach(({ turma, alunos }) => {
      const setDias = new Set<string>();
      // junta todos os dayKeys do mês nos alunos da turma
      alunos.forEach((aluno) => {
        const mes = aluno.presencas?.[mesSel] ?? {};
        Object.keys(mes).forEach((k) => setDias.add(k));
      });

      let keys = Array.from(setDias);

      if (IGNORAR_FUTURO) {
        keys = keys.filter((k) => {
          const dt = parseDateKey(k);
          return dt !== null && dt.getTime() <= today.getTime();
        });
      }

      if (SOMENTE_DIAS_REGISTRADOS) {
        keys = keys.filter((k) =>
          alunos.some((a) => a.presencas?.[mesSel]?.[k] === true)
        );
      }

      keys.sort(ordenarPorDia);
      const turmaId = turma.uuidTurma ?? turma.nome_da_turma; // fallback seguro
      map.set(turmaId, keys);
    });

    return map;
  }, [todasTurmas, mesSel]);

  // Computa faltas/presenças por aluno usando os dias válidos da turma dele.
  type Linha = {
    alunoNome: string;
    modalidade: string;
    turmaNome: string;
    faltas: number;
    presencas: number;
    freq: string;
    telefone?: string | number;
  };

  const linhasComMuitasFaltas: Linha[] = useMemo(() => {
    const out: Linha[] = [];

    todasTurmas.forEach(({ modalidade, turma, alunos }) => {
      const turmaId = turma.uuidTurma ?? turma.nome_da_turma;
      const diasValidos = diasValidosPorTurma.get(turmaId) ?? [];

      if (diasValidos.length === 0) return;

      alunos.forEach((aluno) => {
        const mes = aluno.presencas?.[mesSel] ?? {};
        let pres = 0;
        let falt = 0;
        diasValidos.forEach((dia) => {
          const v = mes[dia];
          if (v === true) pres++;
          else if (v === false) falt++; // undefined não conta
        });
        const total = pres + falt;
        if (falt >= limiteFaltas) {
          const freq = total > 0 ? ((pres / total) * 100).toFixed(1) : '0.0';
          out.push({
            alunoNome: aluno.nome,
            modalidade,
            turmaNome: turma.nome_da_turma,
            faltas: falt,
            presencas: pres,
            freq,
            telefone: aluno.telefoneComWhatsapp,
          });
        }
      });
    });

    // Ordena: mais faltas primeiro, depois por nome
    out.sort((a, b) => (b.faltas - a.faltas) || a.alunoNome.localeCompare(b.alunoNome));
    return out;
  }, [todasTurmas, diasValidosPorTurma, mesSel, limiteFaltas]);

  function waLink(raw: string | number | undefined) {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return null;
    const msg = encodeURIComponent(
      `Olá! Notamos ${limiteFaltas}+ faltas neste mês. Está tudo bem? Contamos com a presença nos próximos treinos.`
    );
    return `https://wa.me/55${digits}?text=${msg}`;
  }

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
          Alerta Mensal de Faltas — Visão Geral (todas as turmas)
        </Typography>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <FormControl fullWidth>
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
              label="Limite de faltas"
              type="number"
              inputProps={{ min: 1 }}
              value={limiteFaltas}
              onChange={(e) => setLimiteFaltas(Math.max(1, Number(e.target.value || 1)))}
              fullWidth
            />
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`Total de turmas analisadas: ${todasTurmas.length}`}
              variant="outlined"
            />
            <Chip
              color={linhasComMuitasFaltas.length > 0 ? 'error' : 'default'}
              label={`Alunos com ${limiteFaltas}+ faltas: ${linhasComMuitasFaltas.length}`}
            />
            <Chip
              label="Regra: ignora dias futuros e conta só dias com chamada."
              size="small"
              variant="outlined"
            />
          </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
          {linhasComMuitasFaltas.length === 0 ? (
            <Typography>Nenhum aluno atingiu o limite no mês selecionado.</Typography>
          ) : (
            <>
              <Typography sx={{ mb: 1, fontWeight: 'bold' }}>
                Resultado ({linhasComMuitasFaltas.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Aluno</TableCell>
                    <TableCell>Modalidade</TableCell>
                    <TableCell>Turma</TableCell>
                    <TableCell align="center">Faltas</TableCell>
                    <TableCell align="center">Presenças</TableCell>
                    <TableCell align="center">Frequência (%)</TableCell>
                    <TableCell align="center">Contato</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linhasComMuitasFaltas.map((linha, idx) => {
                    const link = waLink(linha.telefone);
                    return (
                      <TableRow key={`${linha.alunoNome}-${linha.turmaNome}-${idx}`}>
                        <TableCell>{linha.alunoNome}</TableCell>
                        <TableCell>{linha.modalidade}</TableCell>
                        <TableCell>{linha.turmaNome}</TableCell>
                        <TableCell align="center">
                          <Chip color="error" label={linha.faltas} size="small" />
                        </TableCell>
                        <TableCell align="center">{linha.presencas}</TableCell>
                        <TableCell align="center">{linha.freq}</TableCell>
                        <TableCell align="center">
                          {link ? (
                            <IconButton
                              size="small"
                              component="a"
                              href={link}
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </Paper>
      </Container>
    </Layout>
  );
}
