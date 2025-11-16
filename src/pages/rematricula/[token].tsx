// pages/rematricula/[token].tsx
import { GetServerSideProps, NextPage } from 'next';
import { useMemo, useState } from 'react';
import admin from '@/config/firebaseAdmin';
import {
  validarTokenRematricula,
  RematriculaTokenPayload,
} from '@/utils/rematriculaToken';
import {
  Container,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  FormHelperText,
  CircularProgress,
  Grid,
} from '@mui/material'; // <-- Componentes Material UI importados
import { BoxStyleCadastro } from '@/utils/Styles';
import { HeaderForm } from '@/components/HeaderDefaultForm';

interface DadosContatoResumo {
  telefoneComWhatsapp?: string;
  pagadorNomeCompleto?: string;
  pagadorEmail?: string;
  pagadorCelularWhatsapp?: string;
}

interface AlunoResumo {
  nome: string;
  anoNascimento: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  identificadorUnico: string;
  dadosContato: DadosContatoResumo;
}

interface TurmaResumo {
  modalidade: string;
  nome_da_turma: string;
  categoria?: string;
  nucleo?: string;
  capacidade_maxima?: number;
  rematriculasConfirmadas: number; // rematrículas 2026 já pedidas pra essa turma
  temVaga: boolean;                // baseado em capacidade_maxima x rematriculasConfirmadas
}

interface RematriculaPageProps {
  valido: boolean;
  erro?: string;
  aluno?: AlunoResumo;
  turmasDisponiveis?: TurmaResumo[];
  token?: string;
  anoLetivo?: number;
}

const RematriculaPage: NextPage<RematriculaPageProps> = ({
  valido,
  erro,
  aluno,
  turmasDisponiveis = [],
  token,
  anoLetivo,
}) => {
  const [turmaDestino, setTurmaDestino] = useState('');
  const [resposta, setResposta] = useState<'sim' | 'nao' | ''>('');
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  // estados de dados pessoais
  const [telefone, setTelefone] = useState(
    aluno?.dadosContato.telefoneComWhatsapp ?? '',
  );
  const [pagadorNome, setPagadorNome] = useState(
    aluno?.dadosContato.pagadorNomeCompleto ?? '',
  );
  const [pagadorEmail, setPagadorEmail] = useState(
    aluno?.dadosContato.pagadorEmail ?? '',
  );
  const [pagadorCelular, setPagadorCelular] = useState(
    aluno?.dadosContato.pagadorCelularWhatsapp ?? '',
  );

  // ---- DESTINO: MODALIDADE / NÚCLEO / TURMA ----

  // lista de modalidades possíveis (de todas as turmas)
  const modalidadesLista = useMemo(
    () =>
      Array.from(new Set(turmasDisponiveis.map((t) => t.modalidade))).sort(),
    [turmasDisponiveis],
  );

  // modalidade de destino começa igual à de origem (but o usuário pode mudar)
  const [modalidadeDestino, setModalidadeDestino] = useState<string>(
    aluno?.modalidadeOrigem ?? '',
  );

  // núcleos disponíveis dentro da modalidade de destino
  const nucleos = useMemo(() => {
    return Array.from(
      new Set(
        turmasDisponiveis
          .filter((t) => t.modalidade === modalidadeDestino)
          .map((t) => t.nucleo)
          .filter((nucleo): nucleo is string => !!nucleo),
      ),
    );
  }, [turmasDisponiveis, modalidadeDestino]);

  // núcleo padrão: o núcleo da turma atual, se ainda estiver na mesma modalidade
  const nucleoPadrao = useMemo(() => {
    const atual = turmasDisponiveis.find(
      (t) =>
        t.modalidade === (aluno?.modalidadeOrigem ?? '') &&
        t.nome_da_turma === aluno?.nomeDaTurmaOrigem,
    );
    return (atual && atual.nucleo) || '';
  }, [turmasDisponiveis, aluno?.modalidadeOrigem, aluno?.nomeDaTurmaOrigem]);

  const [nucleoSelecionado, setNucleoSelecionado] = useState<string>(nucleoPadrao);

  // turmas filtradas por modalidadeDestino + núcleo + regra de vaga
  const turmasFiltradas = useMemo(() => {
    return turmasDisponiveis.filter((t) => {
      if (t.modalidade !== modalidadeDestino) return false;
      const nucleoOk = !nucleoSelecionado || t.nucleo === nucleoSelecionado;

      // a turma atual do aluno sempre aparece se for a mesma modalidade de origem
      const isCurrent =
        t.modalidade === aluno?.modalidadeOrigem &&
        t.nome_da_turma === aluno?.nomeDaTurmaOrigem;

      const podeEntrar = t.temVaga || isCurrent;

      return nucleoOk && podeEntrar;
    });
  }, [turmasDisponiveis, modalidadeDestino, nucleoSelecionado, aluno]);

  if (!valido || !aluno || !token || !anoLetivo) {
    return (
      <Container maxWidth="sm" sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Rematrícula
        </Typography>
        <Typography color="error">
          {erro || 'Link inválido ou expirado.'}
        </Typography>
      </Container>
    );
  }

   const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem(null);

    if (!resposta) {
      setMensagem('Por favor, informe se deseja ou não a rematrícula.');
      return;
    }

    if (resposta === 'sim') {
      if (!modalidadeDestino) {
        setMensagem('Selecione a modalidade de destino.');
        return;
      }
      if (!nucleoSelecionado) {
        setMensagem('Selecione o núcleo de destino.');
        return;
      }
      if (!turmaDestino) {
        setMensagem('Selecione a turma desejada para a rematrícula.');
        return;
      }
    }

    try {
      setEnviando(true);
      const res = await fetch('/api/rematricula/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          resposta,
          modalidadeDestino,
          turmaDestino,
          alunoNome: aluno.nome, // 👈 AQUI: mandando o nome do aluno
          dadosAtualizados: {
            telefoneComWhatsapp: telefone,
            pagadorNomeCompleto: pagadorNome,
            pagadorEmail,
            pagadorCelularWhatsapp: pagadorCelular,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar rematrícula.');
      }

      setMensagem('Formulário enviado com sucesso! Obrigado.');
    } catch (error: any) {
      console.error(error);
      setMensagem(error.message || 'Erro ao enviar rematrícula.');
    } finally {
      setEnviando(false);
    }
  };


  return (
    <Container maxWidth="sm" sx={{ my: 4 }}>
      <Box sx={BoxStyleCadastro}>
         <Box sx={{ display: "table", width: "100%" }}>
                      <HeaderForm titulo={"Rematricula " + anoLetivo}  />
                    </Box>
     

      <Box sx={{ mb: 3 }}>
        <Typography sx={{color:"black"}}>
          <Typography component="strong" fontWeight="bold" >
            Aluno:
          </Typography >{' '}
          {aluno.nome}
        </Typography>
         <Typography sx={{color:"black"}}>
          <Typography component="strong" fontWeight="bold" >
            Modalidade atual:
          </Typography>{' '}
           {aluno.modalidadeOrigem}
        </Typography>

        <Typography sx={{color:"black"}}>
          <Typography component="strong" fontWeight="bold" >
            Turma atual:
          </Typography>{' '}
          {aluno.nomeDaTurmaOrigem} 
        </Typography>
       
        <Typography sx={{color:"black"}}>
          <Typography component="strong" fontWeight="bold" color={"black"}>
            Ano de nascimento:
          </Typography>{' '}
          {aluno.anoNascimento}
        </Typography>
      </Box>

      {/* Seleção de modalidade de destino */}
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel id="modalidade-destino-label" sx={{color:"black"}}>
            Modalidade de destino
          </InputLabel>
          <Select
            labelId="modalidade-destino-label"
            id="modalidade-destino"
            value={modalidadeDestino}
            label="Modalidade de destino"
            sx={{color:"black"}}
            onChange={(e) => {
              setModalidadeDestino(e.target.value as string);
              setNucleoSelecionado('');
              setTurmaDestino('');
            }}
          >
            <MenuItem value="">-- Selecione --</MenuItem>
            {modalidadesLista.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText sx={{color:"black"}}>
            Você pode manter a mesma modalidade ou escolher outra (por exemplo, trocar
            futebol por vôlei).
          </FormHelperText>
        </FormControl>
      </Box>

      {/* Seleção de núcleo */}
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth disabled={!modalidadeDestino}>
          <InputLabel id="nucleo-label">Núcleo</InputLabel>
          <Select
            labelId="nucleo-label"
            id="nucleo"
            value={nucleoSelecionado}
            label="Núcleo"
            onChange={(e) => {
              setNucleoSelecionado(e.target.value as string);
              setTurmaDestino('');
            }}
          >
            <MenuItem value="">-- Selecione --</MenuItem>
            {nucleos.map((nucleo) => (
              <MenuItem key={nucleo} value={nucleo}>
                {nucleo}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText sx={{color:"black"}}>
            Selecione o núcleo desejado dentro da modalidade escolhida.
          </FormHelperText>
        </FormControl>
      </Box>

      <Box component="form" onSubmit={handleSubmit} noValidate>
        {/* 1) Pergunta se deseja rematricular */}
        <Box sx={{ mb: 3 }}>
          <FormControl component="fieldset">
            <Typography component="legend" fontWeight="bold" sx={{color:"black"}}>
              Deseja fazer a rematrícula para {anoLetivo}?
            </Typography>
            <RadioGroup
              row
              name="resposta"
              value={resposta}
              onChange={(e) =>
                setResposta(e.target.value as 'sim' | 'nao' | '')
              }
            >
              <FormControlLabel value="sim" sx={{color:"black"}}control={<Radio />} label="Sim" />
              <FormControlLabel value="nao" sx={{color:"black"}} control={<Radio />} label="Não" />
            </RadioGroup>
          </FormControl>
        </Box>

        {/* 2) Seleção de turma (se SIM) */}
        {resposta === 'sim' && (
          <Box sx={{ mb: 3 }}>
            <FormControl
              fullWidth
              disabled={!modalidadeDestino || (!nucleoSelecionado && nucleos.length > 0)}
            >
              <InputLabel id="turma-destino-label" sx={{color:"black"}}>
                Selecione a turma desejada
              </InputLabel>
              <Select
                labelId="turma-destino-label"
                id="turma-destino"
                value={turmaDestino}
                label="Selecione a turma desejada"
                onChange={(e) => setTurmaDestino(e.target.value as string)}
              >
                <MenuItem value="">-- Selecione --</MenuItem>
                {turmasFiltradas.map((t, idx) => {
                  const labelExtra: string[] = [];
                  if (t.categoria) labelExtra.push(t.categoria);
                  if (t.nucleo) labelExtra.push(t.nucleo);
                  const descricaoExtra = labelExtra.length
                    ? ` - ${labelExtra.join(' | ')}`
                    : '';

                  const infoVagas =
                    t.capacidade_maxima && t.capacidade_maxima > 0
                      ? ` (${t.rematriculasConfirmadas}/${t.capacidade_maxima} rematrículas)`
                      : '';

                  return (
                    <MenuItem key={idx} value={t.nome_da_turma}>
                      {t.nome_da_turma}
                      {descricaoExtra}
                      {infoVagas}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* 3) Atualização de dados pessoais */}
        <Box sx={{ mt: 4, mb: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom sx={{color:"black"}}>
            Atualização de dados de contato
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Telefone/WhatsApp do aluno ou responsável"
                type="tel"
                sx={{color:"black"}}
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome do Responsável Financeiro"
                type="text"
                sx={{color:"black"}}
                value={pagadorNome}
                onChange={(e) => setPagadorNome(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="E-mail do Responsável Financeiro"
                type="email"
                sx={{color:"black"}}
                value={pagadorEmail}
                onChange={(e) => setPagadorEmail(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Telefone/WhatsApp do Responsável Financeiro"
                type="tel"
                sx={{color:"black"}}
                value={pagadorCelular}
                onChange={(e) => setPagadorCelular(e.target.value)}
              />
            </Grid>
          </Grid>

          
        </Box>

        {/* Botão de envio */}
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={enviando}
          sx={{ py: 1.5, mt: 2 }}
          endIcon={enviando ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {enviando ? 'Enviando...' : 'Enviar formulário'}
        </Button>
      </Box>

      {/* Mensagem de status */}
      {mensagem && (
        <Box sx={{ mt: 3, p: 2, bgcolor: mensagem.includes('sucesso') ? 'success.light' : 'error.light', borderRadius: 1 }}>
          <Typography color={mensagem.includes('sucesso') ? 'success.dark' : 'error.dark'}>
            {mensagem}
          </Typography>
        </Box>
      )}
      </Box>
    </Container>
  );
};

export default RematriculaPage;

// -------------------
// SERVER-SIDE PROPS (CÓDIGO INALTERADO)
// -------------------

export const getServerSideProps: GetServerSideProps<RematriculaPageProps> = async (
  context,
) => {
  const { token } = context.query;

  if (!token || typeof token !== 'string') {
    return {
      props: {
        valido: false,
        erro: 'Token de rematrícula ausente.',
      },
    };
  }

  try {
    const payload: RematriculaTokenPayload = validarTokenRematricula(token);
    const { identificadorUnico, modalidadeOrigem, nomeDaTurmaOrigem, anoLetivo } =
      payload;

    const db = admin.database();

    // 1) Buscar TODAS as modalidades e turmas
    const modalidadesRef = db.ref('modalidades');
    const modalidadesSnap = await modalidadesRef.once('value');
    const modalidadesVal = modalidadesSnap.val();

    if (!modalidadesVal) {
      return {
        props: {
          valido: false,
          erro: 'Nenhuma modalidade encontrada.',
        },
      };
    }

    // 2) Buscar rematrículas do ano para calcular ocupação 2026
    const remRef = db.ref(`rematriculas${anoLetivo}`);
    const remSnap = await remRef.once('value');
    const remVal = remSnap.val() || {};

    // Mapa: `${modalidade}|||${turma}` -> contagem
    const rematriculasPorTurma: Record<string, number> = {};
    Object.values(remVal as any).forEach((reg: any) => {
      if (reg && reg.resposta === 'sim' && reg.turmaDestino) {
        const modDest = reg.modalidadeDestino || reg.modalidadeOrigem;
        const key = `${modDest}|||${reg.turmaDestino}`;
        rematriculasPorTurma[key] = (rematriculasPorTurma[key] || 0) + 1;
      }
    });

    let alunoEncontrado: AlunoResumo | null = null;
    const turmasDisponiveis: TurmaResumo[] = [];

    for (const [modNome, modVal] of Object.entries<any>(modalidadesVal)) {
      const turmasData = modVal.turmas;
      if (!turmasData) continue;

      const turmasArray: any[] = Array.isArray(turmasData)
        ? turmasData
        : Object.values(turmasData);

      for (const turmaObj of turmasArray) {
        if (!turmaObj) continue;

        const capacidadeMax = turmaObj.capacidade_maxima_da_turma ?? 0;
        const key = `${modNome}|||${turmaObj.nome_da_turma}`;
        const remCount = rematriculasPorTurma[key] ?? 0;
        const temVaga = capacidadeMax === 0 ? true : remCount < capacidadeMax;

        turmasDisponiveis.push({
          modalidade: modNome,
          nome_da_turma: turmaObj.nome_da_turma,
          categoria: turmaObj.categoria,
          nucleo: turmaObj.nucleo,
          capacidade_maxima: capacidadeMax,
          rematriculasConfirmadas: remCount,
          temVaga,
        });

        // procurar o aluno nessa turma
        const alunosRaw = turmaObj.alunos || [];
        const alunosArray: any[] = Array.isArray(alunosRaw)
          ? alunosRaw
          : Object.values(alunosRaw);

        for (const alunoObj of alunosArray) {
          if (
            alunoObj &&
            alunoObj.informacoesAdicionais &&
            alunoObj.informacoesAdicionais.IdentificadorUnico === identificadorUnico
          ) {
            const dadosContato: DadosContatoResumo = {
              telefoneComWhatsapp: alunoObj.telefoneComWhatsapp ?? '',
              pagadorNomeCompleto:
                alunoObj.informacoesAdicionais?.pagadorMensalidades?.nomeCompleto ??
                '',
              pagadorEmail:
                alunoObj.informacoesAdicionais?.pagadorMensalidades?.email ?? '',
              pagadorCelularWhatsapp:
                alunoObj.informacoesAdicionais?.pagadorMensalidades?.celularWhatsapp ??
                '',
            };

            alunoEncontrado = {
              nome: alunoObj.nome,
              anoNascimento: alunoObj.anoNascimento,
              modalidadeOrigem,
              nomeDaTurmaOrigem,
              identificadorUnico,
              dadosContato,
            };
            break;
          }
        }
      }
    }

    if (!alunoEncontrado) {
      return {
        props: {
          valido: false,
          erro: 'Aluno não encontrado para este link de rematrícula.',
        },
      };
    }

    return {
      props: {
        valido: true,
        aluno: alunoEncontrado,
        turmasDisponiveis,
        token,
        anoLetivo,
      },
    };
  } catch (error) {
    console.error('Erro ao validar token ou buscar aluno:', error);
    return {
      props: {
        valido: false,
        erro: 'Link inválido ou expirado.',
      },
    };
  }
};