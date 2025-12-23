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
  Chip,
  TableContainer,
} from '@mui/material';
import { BoxStyleRematricula, tableHeaderStyle, tableRowHoverStyle } from '@/utils/Styles';
import {v4 as uuidv4} from 'uuid';
import ResponsiveAppBar from '@/components/TopBarComponents/TopBar';
interface ExtraDestino {
  modalidadeDestino?: string;
  turmaDestino?: string;
  id?:string
}

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
  turmasExtrasDestino?: ExtraDestino[];
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

    // --- CORREÇÃO AQUI ---
    // Vamos percorrer os dados e adicionar ID onde faltar
    const dadosTratados = (data as RematriculaRegistro[]).map((registro) => ({
      ...registro,
      // Se houver turmas extras, percorre elas
      turmasExtrasDestino: registro.turmasExtrasDestino?.map((extra) => ({
        ...extra,
        // Usa o ID que veio do banco OU gera um novo fixo agora
       id: extra.id || uuidv4()

      }))
    }));

    setRematriculas(dadosTratados); // Salva os dados já com IDs
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
      .filter((r) => r.resposta === 'sim' && (r.status === 'respondida' || (r.status === 'pendente' && r.timestamp)))      .map((r) => r.id);
    setSelecionados(ids);
  };

  const handleAplicarSelecionados = async () => {
    setErro(null);
    setInfo(null);

    if (!selecionados.length) {
      setErro('Nenhuma rematrícula selecionada.');
      return;
    }
    console.log('idsSelecionados:', selecionados);
    console.log('tem JWT?', selecionados.some((x) => String(x).includes('.')));

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

  // Função auxiliar para renderizar o Chip de Resposta
const renderRespostaChip = (resposta?: string | null) => {
  const r = (resposta || '').toString().toLowerCase();

  if (r === 'sim') {
    return (
      <Chip
        label="Sim"
        color="success"
        variant="filled"
        size="small"
        sx={{ fontWeight: 'bold', minWidth: 90 }}
      />
    );
  }

  if (r === 'nao') {
    return (
      <Chip
        label="Não"
        color="error"
        variant="outlined"
        size="small"
        sx={{ fontWeight: 'bold', minWidth: 90 }}
      />
    );
  }

  return (
    <Chip
      label="Sem resposta"
      color="default"
      variant="outlined"
      size="small"
      sx={{ fontWeight: 'bold', minWidth: 120 }}
    />
  );
};


  const renderStatusChip = (status: string) => {
    let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
    
    if (status === 'pendente') color = 'warning';
    if (status === 'concluido' || status === 'aprovado') color = 'success';
    
    return (
      <Chip 
        label={status} 
        color={color} 
        size="small" 
        sx={{ textTransform: 'capitalize' }}       
      />
    );
  };


  
  const handleExcluirRematriculasPendentes = async () => {
  setErro(null);
  setInfo(null);

  if (!selecionados.length) {
    setErro('Nenhuma rematrícula selecionada para exclusão.');
    return;
  }

  try {
    setAplicando(true);
    const res = await fetch('/api/rematricula/excluirPendentes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anoLetivo: anoLetivoPadrao,
        idsSelecionados: selecionados,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao excluir rematrículas pendentes.');
    }

    setInfo(
      `Rematrículas excluídas: ${data.deleted}. Registros ignorados (já aplicados ou inexistentes): ${data.skipped}.`,
    );
    await carregarRematriculas();
  } catch (error: any) {
    console.error(error);
    setErro(error.message || 'Erro ao excluir rematrículas pendentes.');
  } finally {
    setAplicando(false);
  }
};

  
  return (
    <>
     <ResponsiveAppBar />
  
    <Box sx={BoxStyleRematricula}>
      <Typography variant="h5" sx={{ fontWeight: '800', mb: 1, color: "#333" }}>
        Rematrículas {anoLetivoPadrao}
      </Typography>

      <Typography sx={{ mb: 4, color: "#666", lineHeight: 1.6 }}>
        Aqui você vê todas as respostas de rematrícula. Você pode filtrar pelo nome do
        aluno, aplicar as rematrículas de quem respondeu <b>"sim"</b> e ainda excluir
        da base quem respondeu <b>"não"</b>.
      </Typography>

      {/* --- BARRA DE AÇÕES --- */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 4,
          alignItems: 'center',
          flexWrap: 'wrap',
          backgroundColor: '#f9fafb', // Fundo sutil na área de ações
          padding: 2,
          borderRadius: 2,
        }}
      >
        <Button variant="outlined" onClick={carregarRematriculas} disabled={carregando || aplicando}>
          Recarregar Lista de rematriculas
        </Button>

        <Button
           variant="contained"
           color="info"
           onClick={selecionarTodosPendentesSim}
           disabled={carregando || aplicando || !rematriculasFiltradas.length}
           sx={{ boxShadow: 'none' }}
        >
           Selecionar Rematriculas Pendentes
        </Button>

        <Button
          variant="contained"
          color="success"
          onClick={handleAplicarSelecionados}
          disabled={carregando || aplicando || !selecionados.length}
          sx={{ boxShadow: 'none' }}
        >
          {aplicando ? 'Rematriculando...' : '✅ Confirmar Rematriculas'}
        </Button>


        {(carregando || aplicando) && <CircularProgress size={24} />}

              <Button
        variant="contained"
        color="error"
        onClick={handleExcluirRematriculasPendentes}
        disabled={carregando || aplicando || !selecionados.length}
      >
       🗑️ Excluir rematrículas selecionadas (apenas pendentes)
      </Button>


        <TextField
          label="Buscar aluno"
          variant="outlined"
          size="small"
          value={buscaNome}
          onChange={(e) => setBuscaNome(e.target.value)}
          sx={{ minWidth: 280, marginLeft: 'auto', backgroundColor: 'white' }}
        />
      </Box>

      {erro && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{erro}</Alert>}
      {info && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{info}</Alert>}

      {/* --- TABELA MODERNA --- */}
      <TableContainer 
        component={Paper} 
        elevation={0} 
        sx={{ 
          mt: 2, 
          border: '1px solid #e0e0e0', 
          borderRadius: 2,
          overflow: 'hidden' // Garante que as bordas arredondadas cortem o conteúdo
        }}
      >
        <Table sx={{ minWidth: 650 }}> {/* Removemos size="small" para dar espaco */}
          <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={tableHeaderStyle}></TableCell>
                
                <TableCell sx={tableHeaderStyle}>Nome do Aluno</TableCell>
                <TableCell sx={tableHeaderStyle}>Modalidade e Turma de Origem</TableCell>
                <TableCell sx={tableHeaderStyle}>Modalidade e Turma de Destino</TableCell>
                <TableCell sx={tableHeaderStyle}>Horários Extras</TableCell>
                <TableCell sx={tableHeaderStyle} align="center">Deseja Rematricular-se?</TableCell>
                <TableCell sx={tableHeaderStyle} align="center">Status da Rematricula</TableCell>
                <TableCell sx={tableHeaderStyle} align="right">Data da Rematricula</TableCell>
              </TableRow>
            </TableHead>


          <TableBody>
            {rematriculasFiltradas.map((r) => {
              const podeSelecionar = r.status === 'pendente';
              const selecionado = selecionados.includes(r.id);
              const data = new Date(r.timestamp || 0);
             const dataStr =
              r.timestamp && r.timestamp > 0
                ? new Date(r.timestamp).toLocaleDateString('pt-BR')
                : '-';

              
              // Formatação combinada para economizar colunas e melhorar leitura
              const origemStr = `${r.modalidadeOrigem} - ${r.nomeDaTurmaOrigem}`;
              const destinoStr = `${r.modalidadeDestino || r.modalidadeOrigem} - ${r.turmaDestino || '-'}`;

              return (
                <TableRow 
                  key={r.id} 
                  hover 
                  selected={selecionado}
                  sx={tableRowHoverStyle}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      color="primary"
                      disabled={!podeSelecionar || aplicando}
                      checked={selecionado}
                      onChange={() => toggleSelecionado(r.id)}
                    />
                  </TableCell>
                  
                   
                  <TableCell sx={{ fontWeight: 500, color: '#000' }}>
                    {r.alunoNome || '-'}
                  </TableCell>
                  
                  {/* Agrupamos Modalidade e Turma para limpar visualmente */}
                  <TableCell>{origemStr}</TableCell>
                  <TableCell>{destinoStr}</TableCell>

                  <TableCell>
                    {r.turmasExtrasDestino && r.turmasExtrasDestino.length > 0
                      ? r.turmasExtrasDestino.map((e) => (
                          <div key={e.id} style={{ fontSize: '0.8rem', color: '#666' }}>
                            • {e.modalidadeDestino} {e.turmaDestino}
                          </div>
                        ))
                      : <Typography variant="caption" color="text.disabled">-</Typography>}
                  </TableCell>

                  <TableCell align="center">
                    {renderRespostaChip(r.resposta)}
                  </TableCell>
                  
                  <TableCell align="center">
                    {renderStatusChip(r.status)}
                  </TableCell>
                  
                  <TableCell align="right" sx={{ color: '#999' }}>
                    {dataStr}
                  </TableCell>

                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
      </>
  );
};

export default AdminRematriculas2026Page;
