// pages/admin/rematriculas-2026.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  CircularProgress,
  Alert,
  Checkbox,
  TextField,
} from '@mui/material';
import { BoxStyleRematricula } from '@/utils/Styles';

interface RematriculaRegistro {
  id: string;
  identificadorUnico: string;
  alunoNome: string | null;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  modalidadeDestino: string | null;
  turmaDestino: string | null;
  resposta: 'sim' | 'nao' | string;
  anoLetivo: number;
  timestamp: number;
  status: string;
}

const anoLetivoPadrao = 2026;

// helper para busca: lower case, sem acentos
const normalizar = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const AdminRematriculas2026Page: React.FC = () => {
  const [rematriculas, setRematriculas] = useState<RematriculaRegistro[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [buscaNome, setBuscaNome] = useState<string>(''); // 🔍 novo estado

  const carregarRematriculas = async () => {
    setErro(null);
    setInfo(null);
    setCarregando(true);
    try {
      const res = await fetch(`/api/rematricula/list?anoLetivo=${anoLetivoPadrao}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar rematrículas.');
      }
      setRematriculas(data as RematriculaRegistro[]);
      setSelecionados([]);
    } catch (error: any) {
      console.error(error);
      setErro(error.message || 'Erro ao carregar rematrículas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregarRematriculas();
  }, []);

  // Lista filtrada pelo nome do aluno
  const rematriculasFiltradas = useMemo(() => {
    const termo = buscaNome.trim();
    if (!termo) return rematriculas;

    const termoNorm = normalizar(termo);
    return rematriculas.filter((r) => {
      const nome = r.alunoNome || '';
      return normalizar(nome).includes(termoNorm);
    });
  }, [rematriculas, buscaNome]);

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Agora usa a lista filtrada: "selecionar todos" leva em conta o filtro
  const selecionarTodosPendentesSim = () => {
    const ids = rematriculasFiltradas
      .filter((r) => r.resposta === 'sim' && r.status === 'pendente')
      .map((r) => r.id);
    setSelecionados(ids);
  };

  const handleAplicarSelecionados = async () => {
    setErro(null);
    setInfo(null);

    if (!selecionados.length) {
      setErro('Nenhuma rematrícula selecionada.');
      return;
    }

    try {
      setAplicando(true);
      const res = await fetch('/api/rematricula/aplicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anoLetivo: anoLetivoPadrao,
          idsSelecionados: selecionados,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao aplicar rematrículas.');
      }

      setInfo(
        `Rematrículas aplicadas: ${data.moved}. Registros ignorados: ${data.skipped}.`,
      );
      await carregarRematriculas();
    } catch (error: any) {
      console.error(error);
      setErro(error.message || 'Erro ao aplicar rematrículas.');
    } finally {
      setAplicando(false);
    }
  };

  // Botão para excluir todos que responderam "não" (pendentes)
  const handleExcluirNao = async () => {
    setErro(null);
    setInfo(null);

    const idsNao = rematriculas
      .filter((r) => r.resposta === 'nao' && r.status === 'pendente')
      .map((r) => r.id);

    if (!idsNao.length) {
      setErro('Nenhum aluno com resposta "não" e status pendente para excluir.');
      return;
    }

    try {
      setAplicando(true);
      const res = await fetch('/api/rematricula/excluirNao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anoLetivo: anoLetivoPadrao,
          idsSelecionados: idsNao,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir alunos (resposta não).');
      }

      setInfo(
        `Alunos excluídos: ${data.deleted}. Registros ignorados: ${data.skipped}.`,
      );
      await carregarRematriculas();
    } catch (error: any) {
      console.error(error);
      setErro(error.message || 'Erro ao excluir alunos (resposta não).');
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Box sx={BoxStyleRematricula}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2,color:"black" }}>
        Rematrículas {anoLetivoPadrao}
      </Typography>


      <Typography sx={{ mb: 2, color:"black" }}>
        Aqui você vê todas as respostas de rematrícula. Você pode filtrar pelo nome do
        aluno, aplicar as rematrículas de quem respondeu <b>"sim"</b> e ainda excluir
        da base quem respondeu <b>"não"</b>.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="outlined"
          onClick={carregarRematriculas}
          disabled={carregando || aplicando}
        >
          Recarregar lista
        </Button>

        <Button
           variant="contained"
           color="warning"
          onClick={selecionarTodosPendentesSim}
          disabled={carregando || aplicando || !rematriculasFiltradas.length}
        >
          ✅ Selecionar alunos com "staus" pendente 
        </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={handleAplicarSelecionados}
          disabled={carregando || aplicando || !selecionados.length}
        >
          {aplicando
            ? 'Aplicando rematrículas...'
            : 'Aplicar rematrículas selecionadas'}
        </Button>

        <Button
          variant="contained"
          color="error"
          onClick={handleExcluirNao}
          disabled={carregando || aplicando}
        >
          🗑️ Excluir alunos que selecionaram "Não" para rematricula
        </Button>

        {(carregando || aplicando) && <CircularProgress size={24} />}

        {/* Campo de busca por nome */}
        <TextField
          label="Buscar aluno pelo nome"
          variant="outlined"
          size="small"
          value={buscaNome}
          onChange={(e) => setBuscaNome(e.target.value)}
          sx={{ minWidth: 280, marginLeft: 'auto' }}
        />
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      {info && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {info}
        </Alert>
      )}

      <Paper sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox"></TableCell>
              <TableCell>Aluno</TableCell>
              <TableCell>Identificador único</TableCell>
              <TableCell>Modalidade origem</TableCell>
              <TableCell>Turma origem</TableCell>
              <TableCell>Modalidade destino</TableCell>
              <TableCell>Turma destino</TableCell>
              <TableCell>Resposta</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Data/Hora</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rematriculasFiltradas.map((r) => {
              const podeSelecionar =
                r.resposta === 'sim' && r.status === 'pendente';
              const selecionado = selecionados.includes(r.id);
              const data = new Date(r.timestamp || 0);
              const dataStr = isNaN(data.getTime())
                ? '-'
                : data.toLocaleString('pt-BR');

              return (
                <TableRow key={r.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      disabled={!podeSelecionar || aplicando}
                      checked={selecionado}
                      onChange={() => toggleSelecionado(r.id)}
                    />
                  </TableCell>
                  <TableCell>{r.alunoNome || '-'}</TableCell>
                  <TableCell>{r.identificadorUnico}</TableCell>
                  <TableCell>{r.modalidadeOrigem}</TableCell>
                  <TableCell>{r.nomeDaTurmaOrigem}</TableCell>
                  <TableCell>{r.modalidadeDestino || r.modalidadeOrigem}</TableCell>
                  <TableCell>{r.turmaDestino || '-'}</TableCell>
                  <TableCell>{r.resposta}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{dataStr}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default AdminRematriculas2026Page;
