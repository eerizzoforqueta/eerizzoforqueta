// src/pages/rematricula/index.tsx. /api/rematricula/CreateLinkRematricula
import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  Stack,
} from '@mui/material';
import { useRouter } from 'next/router';
import { HeaderForm } from '@/components/HeaderDefaultForm';
import SchoolIcon from '@mui/icons-material/School';
interface RematriculaResumo {
  token: string;
  alunoNome: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  status: string;
  resposta?: string;
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
  // transforma "27101993" -> "27/10/1993"
  const clean = digits.slice(0, 8);
  const d = clean.slice(0, 2);
  const m = clean.slice(2, 4);
  const y = clean.slice(4, 8);
  let result = d;
  if (m) result += '/' + m;
  if (y) result += '/' + y;
  return result;
};

const PortalDaRematriculaPage: React.FC = () => {
  const router = useRouter();

  const [cpfPagador, setCpfPagador] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rematriculas, setRematriculas] = useState<RematriculaResumo[]>([]);

  const handleChangeCpf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, '');
    setCpfPagador(formatCPF(onlyDigits));
  };

  const handleChangeDataNascimento = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
    } catch (error: any) {
      console.error(error);
      setErro(
        error.message || 'Erro ao buscar rematrícula. Tente novamente.',
      );
    } finally {
      setCarregando(false);
    }
  };

  const handleIrParaRematricula = (token: string) => {
    router.push(`/rematricula/${encodeURIComponent(token)}`);
  };

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
         <HeaderForm titulo={"Rematricula"} />
          <br/>
        <Typography sx={{ mb: 2 }}>
          Informe o <b>a data de nascimento do aluno e o CPF do responsável financeiro</b> para
          realizar a rematricula.
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

        {/* Lista de vínculos quando há mais de uma matrícula */}
        {rematriculas.length > 0 && (
  <Box sx={{ mt: 4 }}>
    <Typography variant="h6" component="h3" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
      Encontramos as seguintes rematrículas:
    </Typography>
    
    <Stack spacing={2}>
      {rematriculas.map((r) => (
        <Paper
          key={r.token}
          elevation={0}
          variant="outlined" // ou elevation={1} se preferir sombras
          sx={{
            p: 2,
            borderRadius: 2,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              boxShadow: 2
            }
          }}
        >
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' }, // Coluna no celular, Linha no PC
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 2 
            }}
          >
            {/* Bloco de Informações */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  {r.alunoNome}
                </Typography>
                {/* Chip de Status dinâmico */}
                <Chip 
                  label={r.status} 
                  size="small" 
                  color={r.status === 'Pendente' ? 'warning' : 'default'} // Exemplo de lógica de cor
                  variant="outlined"
                />
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SchoolIcon fontSize="inherit" /> {/* Ícone ilustrativo */}
                {r.modalidadeOrigem} — {r.nomeDaTurmaOrigem}
              </Typography>

              {r.resposta && (
                <Typography variant="caption" display="block" sx={{ mt: 1, color: 'info.main' }}>
                  Resposta: {r.resposta}
                </Typography>
              )}
            </Box>

            {/* Botão de Ação */}
            <Button
              variant="contained"
              disableElevation
              onClick={() => handleIrParaRematricula(r.token)}
              sx={{
                whiteSpace: 'nowrap',
                minWidth: '160px', // Garante um tamanho uniforme
                alignSelf: { xs: 'stretch', sm: 'center' } // Botão esticado no mobile
              }}
            >
              Fazer rematrícula
            </Button>
          </Box>
        </Paper>
      ))}
    </Stack>
  </Box>
        )}

        <Typography sx={{ mt: 3, fontSize: 12, color: 'text.secondary' }}>
          Caso os dados não sejam encontrados ou estejam incorretos, entre em
          contato com a direção da escola para atualizar o cadastro.
        </Typography>
      </Paper>
    </Box>
  );
};

export default PortalDaRematriculaPage
