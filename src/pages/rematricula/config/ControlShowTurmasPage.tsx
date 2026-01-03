import React, { useEffect, useMemo, useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';


import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Switch,
  Alert,
  CircularProgress,
} from '@mui/material';

import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useData } from '@/context/context';
import { Modalidade, Turma } from '@/interface/interfaces';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import ResponsiveAppBar from '@/components/TopBarComponents/TopBar';

const ANO = 2026;

type ConfigMap = Record<string, { enabled?: boolean; updatedAt?: number }>;

type TurmaRow = {
  id: string; // uuidTurma
  modalidade: string;
  nome_da_turma: string;
  nucleo?: string;
  categoria?: string;
  capacidade_maxima?: number;
  capacidade_atual?: number;
  enabled: boolean;
};

export default function AdminRematriculaTurmasPage() {
  const { fetchModalidades } = useData();

  const [rows, setRows] = useState<TurmaRow[]>([]);
  const [baseConfig, setBaseConfig] = useState<ConfigMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [filtroModalidade, setFiltroModalidade] = useState('');
  const [busca, setBusca] = useState('');

  const carregarTudo = async () => {
    setErro(null);
    setInfo(null);
    setLoading(true);

    try {
      const [mods, cfgRes] = await Promise.all([
        fetchModalidades(),
        fetch(`/api/rematricula/config/list-turmas?anoLetivo=${ANO}`),
      ]);

      const cfgJson = await cfgRes.json();
      if (!cfgRes.ok) throw new Error(cfgJson.error || 'Erro ao carregar config.');

      const cfg: ConfigMap = cfgJson.config || {};
      setBaseConfig(cfg);

      const modalidadesValidas = (mods || []).filter(
        (m) => !['arquivados', 'excluidos', 'temporarios'].includes(m.nome?.toLowerCase()),
      );

      const flat: TurmaRow[] = [];

      for (const mod of modalidadesValidas) {
        const turmas: Turma[] = mod.turmas || [];
        for (const t of turmas) {
          const uuid = (t as any).uuidTurma as string | undefined;
          if (!uuid) continue; // importante: turma sem uuid -> não dá para controlar bem

          const enabled = cfg[uuid]?.enabled !== false; // default true

          flat.push({
            id: uuid,
            modalidade: mod.nome,
            nome_da_turma: t.nome_da_turma,
            nucleo: (t as any).nucleo,
            categoria: (t as any).categoria,
            capacidade_maxima: (t as any).capacidade_maxima_da_turma,
            capacidade_atual: (t as any).capacidade_atual_da_turma,
            enabled,
          });
        }
      }

      setRows(flat);
      setInfo(`Carregado: ${flat.length} turmas (ano ${ANO}).`);
    } catch (e: any) {
      console.error(e);
      setErro(e.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modalidadesDisponiveis = useMemo(() => {
    const setMods = new Set(rows.map((r) => r.modalidade));
    return Array.from(setMods).sort();
  }, [rows]);

  const rowsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtroModalidade && r.modalidade !== filtroModalidade) return false;
      if (!termo) return true;
      const hay = `${r.modalidade} ${r.nome_da_turma} ${r.nucleo || ''} ${r.categoria || ''}`.toLowerCase();
      return hay.includes(termo);
    });
  }, [rows, filtroModalidade, busca]);

  const marcarTodas = (enabled: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, enabled })));
  };

  const salvar = async () => {
    setErro(null);
    setInfo(null);

    // gera diff: só envia o que mudou em relação ao baseConfig
    const updates = rows
      .filter((r) => {
        const before = baseConfig[r.id]?.enabled !== false; // default true
        return r.enabled !== before;
      })
      .map((r) => ({ uuidTurma: r.id, enabled: r.enabled }));

    if (updates.length === 0) {
      setInfo('Nenhuma alteração para salvar.');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/rematricula/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anoLetivo: ANO, updates }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');

      setInfo(`Config salva. Turmas atualizadas: ${data.updated}.`);

      // Recarrega baseConfig para refletir o novo estado
      await carregarTudo();
    } catch (e: any) {
      console.error(e);
      setErro(e.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColDef[] = [
    { field: 'modalidade', headerName: 'Modalidade', width: 140 },
    { field: 'nucleo', headerName: 'Núcleo', width: 160 },
    { field: 'categoria', headerName: 'Categoria', width: 110 },
    { field: 'nome_da_turma', headerName: 'Turma', flex: 1, minWidth: 280 },
    { field: 'capacidade_maxima', headerName: 'Cap. Máx', width: 100 },
    { field: 'capacidade_atual', headerName: 'Cap. Atual', width: 100 },
    {
      field: 'enabled',
      headerName: 'Visível na Rematrícula',
      width: 190,
      sortable: false,
      renderCell: (params) => {
        const checked = Boolean(params.value);
        return (
          <Switch
            checked={checked}
            onChange={(e) => {
              const v = e.target.checked;
              setRows((prev) =>
                prev.map((r) => (r.id === params.row.id ? { ...r, enabled: v } : r)),
              );
            }}
          />
        );
      },
    },
  ];

  return (
    <>
     <ResponsiveAppBar />
   
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        Controle de Turmas da Rematrícula (Ano {ANO})
      </Typography>

      <Typography sx={{ mb: 2, color: 'text.secondary' }}>
        Aqui você define exatamente quais turmas aparecem para o aluno escolher durante a rematrícula.
       
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="outlined" onClick={carregarTudo} disabled={loading || saving}>
            Recarregar
          </Button>

          <Button variant="outlined" color="success" onClick={() => marcarTodas(true)} disabled={loading || saving}>
            Habilitar todas
          </Button>

          <Button variant="outlined" color="warning" onClick={() => marcarTodas(false)} disabled={loading || saving}>
            Desabilitar todas
          </Button>

          <Button variant="contained" onClick={salvar} disabled={loading || saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>

          {(loading || saving) && <CircularProgress size={22} />}

          <FormControl size="small" sx={{ minWidth: 200, marginLeft: 'auto' }}>
            <InputLabel>Modalidade</InputLabel>
            <Select
              label="Modalidade"
              value={filtroModalidade}
              onChange={(e) => setFiltroModalidade(e.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              {modalidadesDisponiveis.map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Buscar turma"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ minWidth: 260 }}
          />
        </Box>

        {erro && <Alert severity="error" sx={{ mt: 2 }}>{erro}</Alert>}
        {info && <Alert severity="success" sx={{ mt: 2 }}>{info}</Alert>}
      </Paper>

      <Paper sx={{ height: 680 }}>
        <DataGrid
          rows={rowsFiltradas}
          columns={columns}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
        />
      </Paper>
    </Box>
     </>
  );
}

// Protege a rota (admin)
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session || (session as any).user?.role !== 'admin') {
    return {
      redirect: { destination: '/NotAllowPage', permanent: false },
    };
  }

  return { props: {} };
};
