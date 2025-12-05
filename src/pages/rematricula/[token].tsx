// src/pages/rematricula/[token].tsx
import React, { useState, ChangeEvent, FormEvent, useMemo } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import admin from '@/config/firebaseAdmin';
import {
  Box,
  Button,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Paper,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Modalidade, Turma } from '@/interface/interfaces';
import jwt from 'jsonwebtoken';

const JWT_SECRET =
  process.env.REMATRICULA_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'rematricula-dev-secret';

const ANO_PADRAO = 2026;

type RespostaTipo = 'sim' | 'nao';

interface ExtraDestinoForm {
  modalidadeDestino: string;
  nucleoDestino: string;
  turmaDestino: string;
}

interface RematriculaRecord {
  anoLetivo: number;
  identificadorUnico: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  resposta?: RespostaTipo | string;
  status: string;
  modalidadeDestino?: string | null;
  turmaDestino?: string | null;
  dadosAtualizados?: any;
  turmasExtrasDestino?: ExtraDestinoForm[];
}

interface AlunoFromDB {
  nome: string;
  anoNascimento?: string;
  telefoneComWhatsapp?: string | number;
  informacoesAdicionais?: {
    pagadorMensalidades?: {
      nomeCompleto?: string;
      email?: string;
      celularWhatsapp?: string | number;
      cpf?: string | number;
    };
  };
}

interface PageProps {
  token: string;
  anoLetivo: number;
  invalid: boolean;
  rematricula: RematriculaRecord | null;
  aluno: AlunoFromDB | null;
  modalidades: Modalidade[]; // { nome, turmas: Turma[] }
}

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

const RematriculaTokenPage: React.FC<PageProps> = ({
  token,
  anoLetivo,
  invalid,
  rematricula,
  aluno,
  modalidades,
}) => {
  const router = useRouter();

  const [resposta, setResposta] = useState<RespostaTipo>('sim');

  // principal
  const [modalidadeDestino, setModalidadeDestino] = useState<string>(
    rematricula?.modalidadeDestino ||
      rematricula?.modalidadeOrigem ||
      '',
  );
  const [nucleoDestino, setNucleoDestino] = useState<string>('');
  const [turmaDestino, setTurmaDestino] = useState<string>(
    rematricula?.turmaDestino || '',
  );

  // extras
  const [extras, setExtras] = useState<ExtraDestinoForm[]>(
    rematricula?.turmasExtrasDestino || [],
  );

  // dados de contato
  const [telefoneAluno, setTelefoneAluno] = useState<string>(
    aluno?.telefoneComWhatsapp
      ? String(aluno.telefoneComWhatsapp)
      : '',
  );
  const [nomePagador, setNomePagador] = useState<string>(
    aluno?.informacoesAdicionais?.pagadorMensalidades?.nomeCompleto ||
      '',
  );
  const [emailPagador, setEmailPagador] = useState<string>(
    aluno?.informacoesAdicionais?.pagadorMensalidades?.email || '',
  );
  const [telefonePagador, setTelefonePagador] = useState<string>(
    aluno?.informacoesAdicionais?.pagadorMensalidades
      ?.celularWhatsapp
      ? String(
          aluno.informacoesAdicionais.pagadorMensalidades
            .celularWhatsapp,
        )
      : '',
  );

  const [cpfPagador, setCpfPagador] = useState<string>(() => {
    const cpfRaw =
      aluno?.informacoesAdicionais?.pagadorMensalidades?.cpf;
    if (!cpfRaw) return '';
    return formatCPF(String(cpfRaw).replace(/\D/g, ''));
  });

  const [carregandoSubmit, setCarregandoSubmit] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const modalidadeAtual = useMemo(
    () => modalidades.find((m) => m.nome === modalidadeDestino),
    [modalidades, modalidadeDestino],
  );

  const nucleosPrincipal = useMemo(() => {
    if (!modalidadeAtual) return [];
    const setNucs = new Set<string>();
    modalidadeAtual.turmas.forEach((t) => {
      if (t.nucleo) setNucs.add(t.nucleo);
    });
    return Array.from(setNucs);
  }, [modalidadeAtual]);

  const turmasPrincipal = useMemo(() => {
    if (!modalidadeAtual) return [];
    return modalidadeAtual.turmas.filter((t) => {
      if (nucleoDestino && t.nucleo !== nucleoDestino) return false;
      return true;
    });
  }, [modalidadeAtual, nucleoDestino]);

  const handleChangeResposta = (
    e: ChangeEvent<HTMLInputElement>,
    value: string,
  ) => {
    setResposta(value as RespostaTipo);
  };

  const handleCpfChange = (e: ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, '');
    setCpfPagador(formatCPF(onlyDigits));
  };

  const handleAddExtra = () => {
    setExtras((prev) => [
      ...prev,
      { modalidadeDestino: '', nucleoDestino: '', turmaDestino: '' },
    ]);
  };

  const handleChangeExtra = (
    index: number,
    field: keyof ExtraDestinoForm,
    value: string,
  ) => {
    setExtras((prev) =>
      prev.map((e, i) =>
        i === index
          ? {
              ...e,
              [field]: value,
              // se trocou modalidade, zera nucleo/turma para forçar escolha
              ...(field === 'modalidadeDestino'
                ? { nucleoDestino: '', turmaDestino: '' }
                : field === 'nucleoDestino'
                ? { turmaDestino: '' }
                : {}),
            }
          : e,
      ),
    );
  };

  const handleRemoveExtra = (index: number) => {
    setExtras((prev) => prev.filter((_, i) => i !== index));
  };

  const getNucleosForExtra = (modalidadeNome: string) => {
    const mod = modalidades.find((m) => m.nome === modalidadeNome);
    if (!mod) return [];
    const setNucs = new Set<string>();
    mod.turmas.forEach((t) => t.nucleo && setNucs.add(t.nucleo));
    return Array.from(setNucs);
  };

  const getTurmasForExtra = (
    modalidadeNome: string,
    nucleo: string,
  ) => {
    const mod = modalidades.find((m) => m.nome === modalidadeNome);
    if (!mod) return [];
    return mod.turmas.filter((t) => {
      if (nucleo && t.nucleo !== nucleo) return false;
      return true;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setInfo(null);

    if (resposta === 'sim') {
      if (!modalidadeDestino || !turmaDestino) {
        setErro(
          'Selecione a modalidade e a turma principal desejada para 2026.',
        );
        return;
      }
    }

    try {
      setCarregandoSubmit(true);

      const extrasValidos = extras
        .filter(
          (e) => e.modalidadeDestino && e.turmaDestino,
        )
        // evita que extra repita a turma principal
        .filter(
          (e) =>
            !(
              e.modalidadeDestino === modalidadeDestino &&
              e.turmaDestino === turmaDestino
            ),
        );

      const dadosAtualizados = {
        telefoneAlunoOuResponsavel: telefoneAluno || undefined,
        nomePagador: nomePagador || undefined,
        emailPagador: emailPagador || undefined,
        telefonePagador: telefonePagador || undefined,
        cpfPagador: cpfPagador.replace(/\D/g, '') || undefined,
      };

      const body: any = {
        token,
        anoLetivo,
        resposta,
      };

      if (resposta === 'sim') {
        body.modalidadeDestino = modalidadeDestino;
        body.turmaDestino = turmaDestino;
        body.dadosAtualizados = dadosAtualizados;
        body.turmasExtrasDestino = extrasValidos.map((e) => ({
          modalidadeDestino: e.modalidadeDestino,
          turmaDestino: e.turmaDestino,
        }));
      }

      const res = await fetch('/api/rematricula/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar rematrícula.');
      }

      setInfo(
        resposta === 'sim'
          ? 'Rematrícula registrada com sucesso! A direção da escola irá confirmar e aplicar as mudanças.'
          : 'Sua opção de NÃO rematricular foi registrada com sucesso.',
      );

      // opcional: redirecionar após alguns segundos
      // setTimeout(() => router.push('/'), 4000);
    } catch (error: any) {
      console.error(error);
      setErro(error.message || 'Erro ao enviar rematrícula.');
    } finally {
      setCarregandoSubmit(false);
    }
  };

  if (invalid || !rematricula || !aluno) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background:
            'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)',
        }}
      >
        <Typography variant="h4" color="white">
          Link inválido ou expirado.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        background:
          'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)',
        padding: 2,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          maxWidth: 800,
          width: '100%',
          padding: 3,
          mt: 4,
        }}
      >
        <Typography
          variant="h4"
          sx={{ fontWeight: 'bold', mb: 1, textAlign: 'center' }}
        >
          Rematrícula {anoLetivo}
        </Typography>

        <Typography sx={{ mb: 1 }}>
          <b>Aluno:</b> {aluno.nome}
        </Typography>
        <Typography sx={{ mb: 1 }}>
          <b>Turma atual:</b> {rematricula.nomeDaTurmaOrigem} (
          {rematricula.modalidadeOrigem})
        </Typography>
        {aluno.anoNascimento && (
          <Typography sx={{ mb: 2 }}>
            <b>Ano de nascimento:</b> {aluno.anoNascimento}
          </Typography>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Typography sx={{ mt: 2, mb: 1 }}>
            Deseja fazer a rematrícula para {anoLetivo}?
          </Typography>

          <RadioGroup
            row
            value={resposta}
            onChange={handleChangeResposta}
          >
            <FormControlLabel
              value="sim"
              control={<Radio />}
              label="Sim"
            />
            <FormControlLabel
              value="nao"
              control={<Radio />}
              label="Não"
            />
          </RadioGroup>

          {resposta === 'sim' && (
            <>
              {/* TURMA PRINCIPAL */}
              <Typography sx={{ mt: 3, mb: 1 }}>
                <b>Selecione a turma principal desejada para {anoLetivo}:</b>
              </Typography>

              <TextField
                select
                fullWidth
                label="Modalidade"
                margin="normal"
                value={modalidadeDestino}
                onChange={(e) => {
                  setModalidadeDestino(e.target.value);
                  setNucleoDestino('');
                  setTurmaDestino('');
                }}
              >
                <MenuItem value="">
                  <em>Selecione...</em>
                </MenuItem>
                {modalidades.map((m) => (
                  <MenuItem key={m.nome} value={m.nome}>
                    {m.nome}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                fullWidth
                label="Núcleo"
                margin="normal"
                value={nucleoDestino}
                onChange={(e) => {
                  setNucleoDestino(e.target.value);
                  setTurmaDestino('');
                }}
                disabled={!modalidadeDestino}
              >
                <MenuItem value="">
                  <em>Todos</em>
                </MenuItem>
                {nucleosPrincipal.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                fullWidth
                label="Turma principal"
                margin="normal"
                value={turmaDestino}
                onChange={(e) => setTurmaDestino(e.target.value)}
                disabled={!modalidadeDestino}
              >
                <MenuItem value="">
                  <em>Selecione...</em>
                </MenuItem>
                {turmasPrincipal.map((t) => {
                  const vagas =
                    (t.capacidade_maxima_da_turma || 0) -
                    (t.capacidade_atual_da_turma || 0);
                  const lotada = vagas <= 0;
                  return (
                    <MenuItem
                      key={t.nome_da_turma}
                      value={t.nome_da_turma}
                      disabled={lotada}
                    >
                      {t.nome_da_turma}{' '}
                      {lotada
                        ? ' - (Turma cheia)'
                        : ` - Vagas disponíveis: ${vagas}`}
                    </MenuItem>
                  );
                })}
              </TextField>

              {/* HORÁRIOS EXTRAS */}
              <Typography sx={{ mt: 3, mb: 1 }}>
                <b>Horários extras (opcional)</b>
              </Typography>
              <Typography sx={{ mb: 1, fontSize: 14 }}>
                Se o aluno vai treinar mais de uma vez por semana em{' '}
                {anoLetivo}, você pode adicionar outros horários
                (modalidade/turma) aqui.
              </Typography>

              <Button
                variant="outlined"
                size="small"
                onClick={handleAddExtra}
                sx={{ mb: 2 }}
              >
                Adicionar mais um horário
              </Button>

              {extras.map((extra, index) => {
                const nucleosExtra = getNucleosForExtra(
                  extra.modalidadeDestino,
                );
                const turmasExtra = getTurmasForExtra(
                  extra.modalidadeDestino,
                  extra.nucleoDestino,
                );

                return (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{ p: 2, mb: 2 }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 1,
                      }}
                    >
                      <Typography>
                        Horário extra {index + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveExtra(index)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <TextField
                      select
                      fullWidth
                      label="Modalidade"
                      margin="normal"
                      value={extra.modalidadeDestino}
                      onChange={(e) =>
                        handleChangeExtra(
                          index,
                          'modalidadeDestino',
                          e.target.value,
                        )
                      }
                    >
                      <MenuItem value="">
                        <em>Selecione...</em>
                      </MenuItem>
                      {modalidades.map((m) => (
                        <MenuItem key={m.nome} value={m.nome}>
                          {m.nome}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      fullWidth
                      label="Núcleo"
                      margin="normal"
                      value={extra.nucleoDestino}
                      onChange={(e) =>
                        handleChangeExtra(
                          index,
                          'nucleoDestino',
                          e.target.value,
                        )
                      }
                      disabled={!extra.modalidadeDestino}
                    >
                      <MenuItem value="">
                        <em>Todos</em>
                      </MenuItem>
                      {nucleosExtra.map((n) => (
                        <MenuItem key={n} value={n}>
                          {n}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      fullWidth
                      label="Turma extra"
                      margin="normal"
                      value={extra.turmaDestino}
                      onChange={(e) =>
                        handleChangeExtra(
                          index,
                          'turmaDestino',
                          e.target.value,
                        )
                      }
                      disabled={!extra.modalidadeDestino}
                    >
                      <MenuItem value="">
                        <em>Selecione...</em>
                      </MenuItem>
                      {turmasExtra.map((t) => {
                        const vagas =
                          (t.capacidade_maxima_da_turma || 0) -
                          (t.capacidade_atual_da_turma || 0);
                        const lotada = vagas <= 0;
                        return (
                          <MenuItem
                            key={t.nome_da_turma}
                            value={t.nome_da_turma}
                            disabled={lotada}
                          >
                            {t.nome_da_turma}{' '}
                            {lotada
                              ? ' - (Turma cheia)'
                              : ` - Vagas disponíveis: ${vagas}`}
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  </Paper>
                );
              })}

              {/* DADOS DE CONTATO */}
              <Typography sx={{ mt: 3, mb: 1 }}>
                <b>Atualização de dados de contato</b>
              </Typography>

              <TextField
                fullWidth
                margin="normal"
                label="Telefone/WhatsApp do aluno ou responsável"
                value={telefoneAluno}
                onChange={(e) => setTelefoneAluno(e.target.value)}
              />

              <TextField
                fullWidth
                margin="normal"
                label="Nome do pagador das mensalidades"
                value={nomePagador}
                onChange={(e) => setNomePagador(e.target.value)}
              />

              <TextField
                fullWidth
                margin="normal"
                label="E-mail do pagador"
                value={emailPagador}
                onChange={(e) => setEmailPagador(e.target.value)}
              />

              <TextField
                fullWidth
                margin="normal"
                label="Telefone/WhatsApp do pagador"
                value={telefonePagador}
                onChange={(e) => setTelefonePagador(e.target.value)}
              />

              <TextField
                fullWidth
                margin="normal"
                label="CPF do pagador"
                placeholder="000.000.000-00"
                value={cpfPagador}
                onChange={handleCpfChange}
              />
            </>
          )}

          {erro && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {erro}
            </Alert>
          )}

          {info && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {info}
            </Alert>
          )}

          <Box sx={{ mt: 3 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={carregandoSubmit}
              fullWidth
            >
              {carregandoSubmit
                ? 'Enviando rematrícula...'
                : 'Confirmar rematrícula'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default RematriculaTokenPage;

// ---------------------------------------------
// getServerSideProps: carrega rematricula, aluno e modalidades
// ---------------------------------------------
export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context,
) => {
  const tokenParam = context.params?.token as string | undefined;

  if (!tokenParam) {
    return {
      props: {
        token: '',
        anoLetivo: ANO_PADRAO,
        invalid: true,
        rematricula: null,
        aluno: null,
        modalidades: [],
      },
    };
  }

  // 1) Decodificar/verificar JWT da URL
  let payload: any;
  try {
    payload = jwt.verify(tokenParam, JWT_SECRET) as any;
  } catch (err) {
    console.error(
      'Erro ao verificar token de rematrícula (JWT inválido ou expirado):',
      err,
    );
    return {
      props: {
        token: '',
        anoLetivo: ANO_PADRAO,
        invalid: true,
        rematricula: null,
        aluno: null,
        modalidades: [],
      },
    };
  }

  const anoLetivo = Number(payload.anoLetivo || ANO_PADRAO);
  const rematriculaId = String(payload.rematriculaId || '');

  if (!rematriculaId) {
    console.error(
      'Payload do token não contém rematriculaId válido:',
      payload,
    );
    return {
      props: {
        token: '',
        anoLetivo,
        invalid: true,
        rematricula: null,
        aluno: null,
        modalidades: [],
      },
    };
  }

  try {
    const db = admin.database();

    // 2) Carregar o registro de rematrícula usando rematriculaId (chave segura)
    const remRef = db.ref(
      `rematriculas${anoLetivo}/${rematriculaId}`,
    );
    const remSnap = await remRef.once('value');

    if (!remSnap.exists()) {
      return {
        props: {
          token: rematriculaId,
          anoLetivo,
          invalid: true,
          rematricula: null,
          aluno: null,
          modalidades: [],
        },
      };
    }

    const rem = remSnap.val() as RematriculaRecord;

    // se já foi concluída ou marcada como nao-rematriculado, bloqueia
    if (rem.status && rem.status !== 'pendente') {
      return {
        props: {
          token: rematriculaId,
          anoLetivo,
          invalid: true,
          rematricula: null,
          aluno: null,
          modalidades: [],
        },
      };
    }

    // 3) carregar modalidades completas
    const modalidadesSnap = await db.ref('modalidades').once('value');
    const modalidadesVal = modalidadesSnap.val() || {};

    const modalidades: Modalidade[] = Object.entries(
      modalidadesVal,
    ).map(([nome, valor]: any) => ({
      nome,
      turmas: valor.turmas
        ? (Array.isArray(valor.turmas)
            ? valor.turmas
            : Object.values(valor.turmas)) as Turma[]
        : [],
    }));

    // 4) achar aluno pelo IdentificadorUnico
    let alunoEncontrado: AlunoFromDB | null = null;
    const identificadorUnico = rem.identificadorUnico;

    outer: for (const modNome of Object.keys(modalidadesVal)) {
      const mod = modalidadesVal[modNome];
      const turmasObj = mod.turmas || {};
      for (const turmaKey of Object.keys(turmasObj)) {
        const turma = turmasObj[turmaKey];
        const alunosObj = turma.alunos || {};
        for (const alunoKey of Object.keys(alunosObj)) {
          const a = alunosObj[alunoKey];
          if (
            a?.informacoesAdicionais?.IdentificadorUnico ===
            identificadorUnico
          ) {
            alunoEncontrado = {
              nome: a.nome,
              anoNascimento: a.anoNascimento,
              telefoneComWhatsapp: a.telefoneComWhatsapp,
              informacoesAdicionais: a.informacoesAdicionais,
            };
            break outer;
          }
        }
      }
    }

    if (!alunoEncontrado) {
      return {
        props: {
          token: rematriculaId,
          anoLetivo,
          invalid: true,
          rematricula: null,
          aluno: null,
          modalidades: [],
        },
      };
    }

    return {
      props: {
        // ATENÇÃO: aqui o "token" que o componente recebe é o rematriculaId (chave do DB),
        // não o JWT da URL. Isso é exatamente o que /api/rematricula/confirm espera.
        token: rematriculaId,
        anoLetivo,
        invalid: false,
        rematricula: rem,
        aluno: alunoEncontrado,
        modalidades,
      },
    };
  } catch (error) {
    console.error('Erro em getServerSideProps [token].tsx:', error);
    return {
      props: {
        token: '',
        anoLetivo,
        invalid: true,
        rematricula: null,
        aluno: null,
        modalidades: [],
      },
    };
  }
};
