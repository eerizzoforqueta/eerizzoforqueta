import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { Alert, Box, Button, CircularProgress, Container, Paper, Typography } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Layout from '@/components/TopBarComponents/Layout';
import { authOptions } from './api/auth/[...nextauth]';

interface StatsResponse {
  summary: {
    alunosAtivos: number;
    alunosArquivados: number | null;
    treinam1x: number;
    treinam2x: number;
    treinam3x: number;
    futebol: number;
    futsal: number;
    volei: number;
    filhosJBS: number;
    filhosMarcopolo: number;
  };
  categories: {
    sub07: number;
    sub09: number;
    sub11: number;
    sub13: number;
    sub15: number;
    sub17: number;
    voleiSub13: number;
    voleiSub17: number;
  };
  futsalByNucleo: Record<string, number>;
  voleiByNucleo: Record<string, number>;
  archivedCountError: string | null;
  generatedAt: string;
}

interface MetricRow {
  id: string;
  grupo: string;
  indicador: string;
  valor: number | string;
  valorNumerico: number | null;
}

export default function StudentSystemStatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/GetStudentSystemStats', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message || 'Falha ao carregar estatísticas');
      }

      const data = (await response.json()) as StatsResponse;
      setStats(data);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar as estatísticas dos alunos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats().catch(console.error);
  }, [loadStats]);

  const generatedAtLabel = useMemo(() => {
    if (!stats?.generatedAt) return '';
    return new Date(stats.generatedAt).toLocaleString('pt-BR');
  }, [stats?.generatedAt]);

  const rows = useMemo<MetricRow[]>(() => {
    if (!stats) return [];

    const createRow = (
      grupo: string,
      indicador: string,
      valor: number | string
    ): MetricRow => ({
      id: `${grupo}__${indicador}`,
      grupo,
      indicador,
      valor,
      valorNumerico: typeof valor === 'number' ? valor : null,
    });

    const futsalNucleos = Object.entries(stats.futsalByNucleo).sort(([a], [b]) =>
      a.localeCompare(b, 'pt-BR')
    );
    const voleiNucleos = Object.entries(stats.voleiByNucleo).sort(([a], [b]) =>
      a.localeCompare(b, 'pt-BR')
    );

    return [
      createRow(
        'Resumo geral',
        'Alunos arquivados',
        stats.summary.alunosArquivados === null ? 'Indisponível' : stats.summary.alunosArquivados
      ),

      createRow('Frequência semanal', 'Treinam 1x na semana', stats.summary.treinam1x),
      createRow('Frequência semanal', 'Treinam 2x na semana', stats.summary.treinam2x),
      createRow('Frequência semanal', 'Treinam 3x na semana', stats.summary.treinam3x),

      createRow('Modalidades', 'Alunos que treinam futebol', stats.summary.futebol),
      createRow('Modalidades', 'Alunos que treinam futsal', stats.summary.futsal),
      createRow('Modalidades', 'Alunos que treinam vôlei', stats.summary.volei),

      ...futsalNucleos.map(([nucleo, valor]) =>
        createRow('Futsal por núcleo', nucleo, valor)
      ),
      ...voleiNucleos.map(([nucleo, valor]) =>
        createRow('Vôlei por núcleo', nucleo, valor)
      ),

      createRow('Categorias gerais', 'Alunos da categoria SUB07', stats.categories.sub07),
      createRow('Categorias gerais', 'Alunos da categoria SUB09', stats.categories.sub09),
      createRow('Categorias gerais', 'Alunos da categoria SUB11', stats.categories.sub11),
      createRow('Categorias gerais', 'Alunos da categoria SUB13', stats.categories.sub13),
      createRow('Categorias gerais', 'Alunos da categoria SUB15', stats.categories.sub15),
      createRow('Categorias gerais', 'Alunos da categoria SUB17', stats.categories.sub17),

      createRow('Categorias do vôlei', 'Vôlei SUB13', stats.categories.voleiSub13),
      createRow('Categorias do vôlei', 'Vôlei SUB17', stats.categories.voleiSub17),

      createRow('Vínculos', 'Filhos de funcionários da JBS', stats.summary.filhosJBS),
      createRow('Vínculos', 'Filhos de funcionários da Marcopolo', stats.summary.filhosMarcopolo),
    ];
  }, [stats]);

  const columns = useMemo<GridColDef<MetricRow>[]>(
    () => [
      {
        field: 'grupo',
        headerName: 'Grupo',
        flex: 1,
        minWidth: 180,
      },
      {
        field: 'indicador',
        headerName: 'Indicador',
        flex: 1.8,
        minWidth: 280,
      },
      {
        field: 'valorNumerico',
        headerName: 'Quantidade',
        type: 'number',
        minWidth: 140,
        flex: 0.6,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params: GridRenderCellParams<MetricRow, number | null>) => (
          <Box sx={{ width: '100%', textAlign: 'right', fontWeight: 600 }}>
            {params.row.valor}
          </Box>
        ),
        sortComparator: (v1, v2) => {
          const n1 = typeof v1 === 'number' ? v1 : -1;
          const n2 = typeof v2 === 'number' ? v2 : -1;
          return n1 - n2;
        },
      },
    ],
    []
  );

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Paper sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
              mb: 3,
            }}
          >
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Estatísticas de Alunos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Indicadores consolidados de alunos ativos, arquivados, modalidades, núcleos e categorias.
              </Typography>
            </Box>

            <Button variant="contained" onClick={loadStats} disabled={loading}>
              Atualizar dados
            </Button>
          </Box>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          )}

          {!loading && error && <Alert severity="error">{error}</Alert>}

          {!loading && !error && stats && (
            <>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 2,
                  backgroundColor: 'rgba(25, 118, 210, 0.04)',
                  borderColor: 'rgba(25, 118, 210, 0.2)',
                }}
              >
                <Typography variant="h6" fontWeight={700}>
                  Total de alunos ativos no sistema em {generatedAtLabel}: {stats.summary.alunosAtivos} alunos
                </Typography>
              </Paper>

              {stats.archivedCountError && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {stats.archivedCountError}
                </Alert>
              )}

              <Box
                sx={{
                  width: '100%',
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: 'rgba(0, 0, 0, 0.03)',
                  },
                }}
              >
                <DataGrid
                  autoHeight
                  rows={rows}
                  columns={columns}
                  loading={loading}
                  disableRowSelectionOnClick
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{
                    pagination: {
                      paginationModel: { pageSize: 25, page: 0 },
                    },
                    sorting: {
                      sortModel: [{ field: 'grupo', sort: 'asc' }],
                    },
                  }}
                  
                  sx={{
                    backgroundColor: '#fff',
                    borderRadius: 2,
                  }}
                />
              </Box>
            </>
          )}
        </Paper>
      </Container>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session || (session.user.role !== 'admin')) {
    return {
      redirect: {
        destination: '/NotAllowPage',
        permanent: false,
      },
    };
  }

  return { props: {} };
};