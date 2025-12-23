// src/pages/rematricula/PortaldaRematricula.tsx
import React, { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import { useRouter } from 'next/router';
import { HeaderForm } from '@/components/HeaderDefaultForm';
import SchoolIcon from '@mui/icons-material/School';

interface RematriculaResumo {
  token: string;
  alunoNome: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  status: string; // "pendente" | "aplicada" | ...
  resposta?: string | null; // "sim" | "nao" | null
}

const ANO_PADRAO = 2026;

const formatCPF = (digits: string) => {
  const clean = digits.slice(0, 11);
  const p1 = clean.slice(0, 3);
  const p2 = clean.slice(3, 6);
  const p3 = clean.slice(6, 9);
  const p4 = clean.slice(9, 11);

  let result = p1;
  if (p2) result += '.' + p2;
  if (p3) result += '.' + p3;
  if (p4) result += '-' + p4;
  return result;
};

const formatDataNascimento = (digits: string) => {
  // "27101993" -> "27/10/1993"
  const clean = digits.slice(0, 8);
  const d = clean.slice(0, 2);
  const m = clean.slice(2, 4);
  const y = clean.slice(4, 8);
  let result = d;
  if (m) result += '/' + m;
  if (y) result += '/' + y;
  return result;
};

function normalizeStatusLabel(status: string) {
  const s = (status || '').toLowerCase().trim();
  if (s === 'pendente') return 'Pendente';
  if (s === 'aplicada') return 'Confirmada';
  if (!s) return '-';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isRespondida(r: RematriculaResumo) {
  const resp = (r.resposta ?? '').toString().toLowerCase().trim();
  return resp === 'sim' || resp === 'nao';
}

function chipColorFor(r: RematriculaResumo): 'default' | 'warning' | 'success' | 'info' {
  const status = (r.status || '').toLowerCase().trim();
  if (status === 'aplicada') return 'success';
  if (isRespondida(r)) return 'warning'; // respondida mas ainda pendente (aguardando admin)
  return 'info'; // não respondida
}

const PortalDaRematriculaPage: React.FC = () => {
  const router = useRouter();

  const [cpfPagador, setCpfPagador] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rematriculas, setRematriculas] = useState<RematriculaResumo[]>([]);

  // ✅ filtro (default: só não respondidas)
  const [somenteNaoRespondidas, setSomenteNaoRespondidas] = useState(true);

  const handleChangeCpf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, '');
    setCpfPagador(formatCPF(onlyDigits));
  };

  const handleChangeDataNascimento = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, '');
    setDataNascimento(formatDataNascimento(onlyDigits));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    setRematriculas([]);

    const cpfLimpo = cpfPagador.replace(/\D/g, '');
    const dataNascStr = dataNascimento.trim();

    if (cpfLimpo.length !== 11) {
      setErro('Informe um CPF válido (11 dígitos).');
      return;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataNascStr)) {
      setErro('Informe a data de nascimento no formato DD/MM/AAAA.');
      return;
    }

    try {
      setCarregando(true);

      const res = await fetch('/api/rematricula/portalLookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anoLetivo: ANO_PADRAO,
          cpfPagador: cpfLimpo,
          dataNascimento: dataNascStr,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao buscar rematrícula.');
      }

      if (!data.rematriculas || !data.rematriculas.length) {
        setInfo('Nenhuma rematrícula encontrada para esses dados.');
        return;
      }

      setRematriculas(data.rematriculas as RematriculaResumo[]);
      // mantém o filtro default ativo
      setSomenteNaoRespondidas(true);
    } catch (error: any) {
      console.error(error);
      setErro(error.message || 'Erro ao buscar rematrícula. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const handleIrParaRematricula = (token: string) => {
    router.push(`/rematricula/${encodeURIComponent(token)}`);
  };

  const rematriculasVisiveis = useMemo(() => {
    if (!somenteNaoRespondidas) return rematriculas;
    return rematriculas.filter((r) => !isRespondida(r));
  }, [rematriculas, somenteNaoRespondidas]);

  const temNaoRespondidas = useMemo(() => {
    return rematriculas.some((r) => !isRespondida(r));
  }, [rematriculas]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)',
        padding: 2,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          maxWidth: 520,
          width: '100%',
          padding: 3,
          textAlign: 'center',
        }}
      >
        <HeaderForm titulo={'Rematricula'} />
        <br />

        <Typography sx={{ mb: 2 }}>
          Informe <b>a data de nascimento do aluno e o CPF do responsável financeiro</b> para
          realizar a rematrícula.
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            fullWidth
            margin="normal"
            label="Data de nascimento do aluno"
            placeholder="DD/MM/AAAA"
            value={dataNascimento}
            onChange={handleChangeDataNascimento}
          />

          <TextField
            fullWidth
            margin="normal"
            label="CPF do responsável financeiro"
            placeholder="000.000.000-00"
            value={cpfPagador}
            onChange={handleChangeCpf}
          />

          <Box sx={{ mt: 2, mb: 1 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={carregando}
            >
              {carregando ? 'Buscando matrículas...' : 'Continuar'}
            </Button>
          </Box>

          {carregando && <CircularProgress size={24} />}

          {erro && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {erro}
            </Alert>
          )}

          {info && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {info}
            </Alert>
          )}
        </Box>

        {/* Lista quando há vínculos */}
        {rematriculas.length > 0 && (
          <Box sx={{ mt: 4, textAlign: 'left' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mb: 1.5,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="h6" component="h3" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Rematrículas encontradas
              </Typography>

              {/* ✅ Filtro */}
              <FormControlLabel
                control={
                  <Switch
                    checked={somenteNaoRespondidas}
                    onChange={(e) => setSomenteNaoRespondidas(e.target.checked)}
                  />
                }
                label="Mostrar apenas não respondidas"
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Total: <b>{rematriculas.length}</b> • Não respondidas:{' '}
              <b>{rematriculas.filter((r) => !isRespondida(r)).length}</b>
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {/* ✅ Mensagem quando não há pendentes/não respondidas */}
            {somenteNaoRespondidas && !temNaoRespondidas && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Não há rematrículas <b>não respondidas</b> para estes dados. <br />
                Se você quiser ver as rematrículas já respondidas (pendentes de confirmação ou confirmadas),
                desative o filtro “Mostrar apenas não respondidas”.
              </Alert>
            )}

            <Stack spacing={2}>
              {rematriculasVisiveis.map((r) => {
                const respondida = isRespondida(r);
                const statusLabel = normalizeStatusLabel(r.status);
                const chipColor = chipColorFor(r);

                return (
                  <Paper
                    key={r.token}
                    elevation={0}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderColor: 'divider',
                      backgroundColor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 2,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: 2,
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {r.alunoNome}
                          </Typography>

                          <Chip
                            label={statusLabel}
                            size="small"
                            color={chipColor}
                            variant="outlined"
                          />

                          {respondida && (
                            <Chip
                              label="Respondida"
                              size="small"
                              color="default"
                              variant="filled"
                              sx={{ opacity: 0.9 }}
                            />
                          )}
                        </Box>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                        >
                          <SchoolIcon fontSize="inherit" />
                          {r.modalidadeOrigem} — {r.nomeDaTurmaOrigem}
                        </Typography>

                        {respondida && (
                          <Typography
                            variant="caption"
                            display="block"
                            sx={{ mt: 1, color: 'text.secondary' }}
                          >
                            Resposta registrada: <b>{String(r.resposta).toUpperCase()}</b>
                          </Typography>
                        )}
                      </Box>

                      <Button
                        variant={respondida ? 'outlined' : 'contained'}
                        disableElevation
                        onClick={() => handleIrParaRematricula(r.token)}
                        sx={{
                          whiteSpace: 'nowrap',
                          minWidth: '170px',
                          alignSelf: { xs: 'stretch', sm: 'center' },
                        }}
                      >
                        {respondida ? 'Ver rematrícula' : 'Fazer rematrícula'}
                      </Button>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        )}

        <Typography sx={{ mt: 3, fontSize: 12, color: 'text.secondary' }}>
          Caso os dados não sejam encontrados ou estejam incorretos, entre em contato com a direção da
          escola para atualizar o cadastro.
        </Typography>
      </Paper>
    </Box>
  );
};

export default PortalDaRematriculaPage;
