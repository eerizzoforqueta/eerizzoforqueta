// pages/admin/rematricula-links.tsx
import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useData } from '@/context/context';
import { Modalidade, Turma, Aluno } from '@/interface/interfaces';
import { BoxStyleRematricula } from '@/utils/Styles';

// Tipo de cada linha gerada
interface LinkRematriculaRow {
  nomeAluno: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  identificadorUnico: string;
  url: string;
}

// Função que chama a API /api/CreateLinkRematricula
async function gerarLinkParaAluno(
  identificadorUnico: string,
  modalidadeOrigem: string,
  nomeDaTurmaOrigem: string,
  anoLetivo: number = 2026,
): Promise<string> {
  const res = await fetch('/api/rematricula/CreateLinkRematricula', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identificadorUnico,
      modalidadeOrigem,
      nomeDaTurmaOrigem,
      anoLetivo,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao gerar link de rematrícula.');
  }

  const data = await res.json();
  return data.url as string;
}

const AdminRematriculaLinksPage: React.FC = () => {
  const { modalidades, fetchModalidades } = useData();

  const [links, setLinks] = useState<LinkRematriculaRow[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const anoLetivo = 2026; // se quiser, pode transformar isso em seletor futuramente

  const handleGerarLinks = async () => {
    setErro(null);
    setInfo(null);
    setCarregando(true);
    setLinks([]);

    try {
      // Garante que temos as modalidades carregadas
      let mods: Modalidade[] = modalidades;
      if (!mods || mods.length === 0) {
        mods = await fetchModalidades();
      }

      if (!mods || mods.length === 0) {
        throw new Error('Nenhuma modalidade encontrada para gerar os links.');
      }

      const linhas: LinkRematriculaRow[] = [];

           // Loop por modalidade, turma e aluno
      for (const mod of mods) {
        const turmas: Turma[] = mod.turmas || [];
        for (const turma of turmas) {
          const alunosRaw = turma.alunos || [];

          // alunos pode ser array ou objeto, então normalizamos
          const alunosArray: Aluno[] = Array.isArray(alunosRaw)
            ? alunosRaw
            : Object.values(alunosRaw as Record<string, Aluno>);

          for (const aluno of alunosArray) {
            // pula entradas nulas/undefined
            if (!aluno) continue;

            const identificadorUnico =
              aluno.informacoesAdicionais?.IdentificadorUnico;

            // Se não tiver IdentificadorUnico, pulamos (pode depois criar rotina pra preencher)
            if (!identificadorUnico) continue;

            // Chama API para gerar o link individual
            const url = await gerarLinkParaAluno(
              identificadorUnico,
              mod.nome,
              turma.nome_da_turma,
              anoLetivo,
            );

            linhas.push({
              nomeAluno: aluno.nome,
              modalidadeOrigem: mod.nome,
              nomeDaTurmaOrigem: turma.nome_da_turma,
              identificadorUnico,
              url,
            });
          }
        }
      }
      setLinks(linhas);
      setInfo(`Foram gerados ${linhas.length} links de rematrícula para ${anoLetivo}.`);
    } catch (error: any) {
      console.error(error);
      setErro(error.message || 'Erro ao gerar links de rematrícula.');
    } finally {
      setCarregando(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!links.length) {
      setErro('Nenhum link gerado ainda. Clique em "Gerar links de rematrícula" primeiro.');
      return;
    }

    // Cabeçalho do CSV
    const header = [
      'Nome do aluno',
      'Modalidade',
      'Turma de origem',
      'Identificador único',
      'Link de rematrícula',
    ];

    // Linhas
    const rows = links.map((l) => [
      l.nomeAluno,
      l.modalidadeOrigem,
      l.nomeDaTurmaOrigem,
      l.identificadorUnico,
      l.url,
    ]);

    // Monta conteúdo CSV (usando ";" para ficar amigável com Excel/PT-BR)
    const csvContent =
      [header, ...rows]
        .map((row) =>
          row
            .map((field) =>
              `"${String(field).replace(/"/g, '""')}"`, // escapa aspas
            )
            .join(';'),
        )
        .join('\r\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `links-rematricula-${anoLetivo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
   <Box sx={BoxStyleRematricula}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2,color:"black" }}>
        Links de Rematrícula {anoLetivo}
      </Typography>

      <Typography sx={{ mb: 2,color:"black" }}>
        Esta página gera um link individual de rematrícula para cada aluno,após esse processo,você pode baixar tudo em uma planilha para envio por WhatsApp.
        <br/>
        Use o Libreoffice para abrir a planilha!
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleGerarLinks}
          disabled={carregando}
        >
          {carregando ? 'Gerando links...' : 'Gerar links de rematrícula'}
        </Button>

        <Button
          variant="outlined"
          color="secondary"
          onClick={handleDownloadCsv}
          disabled={carregando || !links.length}
        >
          Baixar Planilha
        </Button>

        {carregando && <CircularProgress size={24} />}
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

      {links.length > 0 && (
        <Paper sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome do aluno</TableCell>
                <TableCell>Modalidade</TableCell>
                <TableCell>Turma de origem</TableCell>
                <TableCell>Identificador único</TableCell>
                <TableCell>Link</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {links.map((row, index) => (
                <TableRow key={`${row.identificadorUnico}-${index}`}>
                  <TableCell>{row.nomeAluno}</TableCell>
                  <TableCell>{row.modalidadeOrigem}</TableCell>
                  <TableCell>{row.nomeDaTurmaOrigem}</TableCell>
                  <TableCell>{row.identificadorUnico}</TableCell>
                  <TableCell>
                    <a href={row.url} target="_blank" rel="noopener noreferrer">
                      Abrir
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
};

export default AdminRematriculaLinksPage;
