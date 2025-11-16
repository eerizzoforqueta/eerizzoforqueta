// src/pages/rematricula/index.tsx
import React, {
  useState,
  ChangeEvent,
  FormEvent,
  useCallback,
} from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import { HeaderForm } from '@/components/HeaderDefaultForm';

const formatCPF = (digits: string) => {
  const clean = digits.slice(0, 11); // máximo 11 dígitos
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

interface Match {
  identificadorUnico: string;
  nomeAluno: string;
  modalidade: string;
  turma: string;
}

const anoLetivo = 2026;

const PortalRematriculaPage: React.FC = () => {
  const router = useRouter();
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);

  const handleCpfChange = (e: ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, '');
    const formatted = formatCPF(onlyDigits);
    setCpf(formatted);
  };

  // função que realmente cria o link e redireciona
  const handleRematricularMatch = useCallback(
    async (match: Match) => {
      try {
        setCarregando(true);
        setErro(null);
        setInfo(
          `Preparando rematrícula de ${match.nomeAluno} (${match.modalidade} - ${match.turma})...`,
        );

        const resLink = await fetch('/api/rematricula/CreateLinkRematricula', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identificadorUnico: match.identificadorUnico,
            modalidadeOrigem: match.modalidade,
            nomeDaTurmaOrigem: match.turma,
            anoLetivo,
          }),
        });

        const dataLink = await resLink.json();
        if (!resLink.ok) {
          throw new Error(
            dataLink.error || 'Erro ao gerar link de rematrícula.',
          );
        }

        const url = dataLink.url as string;
        // vai para /rematricula/[token] normalmente
        await router.push(url);
      } catch (error: any) {
        console.error(error);
        setErro(error.message || 'Erro ao abrir rematrícula desta turma.');
      } finally {
        setCarregando(false);
      }
    },
    [router],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    setMatches(null); // limpa resultados anteriores

    const telefoneTrim = telefone.trim();
    const cpfDigits = cpf.replace(/\D/g, '');

    if (!telefoneTrim) {
      setErro('Informe o telefone WhatsApp do responsável.');
      return;
    }

    if (cpfDigits.length !== 11) {
      setErro('Informe um CPF válido do responsável (11 dígitos).');
      return;
    }

    try {
      setCarregando(true);
      const params = new URLSearchParams({
        telefone: telefoneTrim,
        cpf: cpfDigits,
      });

      const res = await fetch(
        `/api/rematricula/findByContato?${params.toString()}`,
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao localizar aluno.');
      }

      const lista: Match[] = data.matches || [];
      if (!lista.length) {
        throw new Error(
          'Nenhuma matrícula encontrada para esse telefone/CPF.',
        );
      }

      if (lista.length === 1) {
        // um vínculo só → já vai direto
        await handleRematricularMatch(lista[0]);
      } else {
        // vários vínculos → usuário escolhe
        setMatches(lista);
        setInfo(
          `Encontramos ${lista.length} matrículas. Escolha abaixo qual deseja rematricular.`,
        );
      }
    } catch (error: any) {
      console.error(error);
      setErro(error.message || 'Erro ao localizar aluno.');
    } finally {
      setCarregando(false);
    }
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
         <HeaderForm titulo={"Rematricula "+ anoLetivo} />
          <br/>
        <Typography sx={{ mb: 2 }}>
          Informe o <b>telefone e o CPF do responsável financeiro</b> para
          realizar a rematricula do aluno(a)
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            fullWidth
            label="Telefone WhatsApp do responsável financeiro"
            placeholder="Ex: 54999999999"
            margin="normal"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            inputProps={{
              inputMode: 'tel',
            }}
          />

          <TextField
            fullWidth
            label="CPF do responsável financeiro"
            placeholder="000.000.000-00"
            margin="normal"
            value={cpf}
            onChange={handleCpfChange}
            inputProps={{
              inputMode: 'numeric',
              pattern: '\\d*',
            }}
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
        {matches && matches.length > 1 && (
          <Box sx={{ mt: 3, textAlign: 'left' }}>
            {matches.map((m, idx) => (
              <Paper
                key={`${m.identificadorUnico}-${m.modalidade}-${m.turma}-${idx}`}
                sx={{ p: 2, mb: 2 }}
                variant="outlined"
              >
                <Typography>
                  <b>Aluno:</b> {m.nomeAluno}
                </Typography>
                <Typography>
                  <b>Modalidade:</b> {m.modalidade}
                </Typography>
                <Typography>
                  <b>Turma atual:</b> {m.turma}
                </Typography>

                <Button
                  sx={{ mt: 1 }}
                  variant="contained"
                  size="small"
                  onClick={() => handleRematricularMatch(m)}
                  disabled={carregando}
                >
                  Rematricular esta turma
                </Button>
              </Paper>
            ))}
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

export default PortalRematriculaPage;
