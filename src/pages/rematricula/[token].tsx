// src/pages/rematricula/[token].tsx
import React, { useMemo, useState, ChangeEvent, FormEvent } from 'react';
import type { GetServerSideProps } from 'next';
import admin from '@/config/firebaseAdmin';
import jwt from 'jsonwebtoken';

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
  Alert,
  IconButton,
  CircularProgress,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

import { AlunoFromDB, ExtraDestinoForm, Modalidade, Mode, PageProps, RematriculaRecord, RespostaTipo, Turma } from '@/interface/interfaces';

const JWT_SECRET =
  process.env.REMATRICULA_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'rematricula-dev-secret';

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

const keyOf = (mod: string, turma: string) => `${mod}:::${turma}`;

function isJwtLike(v: string) {
  return typeof v === 'string' && v.split('.').length === 3;
}

function resolveRematriculaId(tokenOrId: string): string | null {
  if (!tokenOrId) return null;
  if (!isJwtLike(tokenOrId)) return tokenOrId;

  try {
    const payload = jwt.verify(tokenOrId, JWT_SECRET) as any;
    return typeof payload?.rematriculaId === 'string' ? payload.rematriculaId : null;
  } catch {
    return null;
  }
}

// RTDB não aceita esses chars em keys
function isValidDbKey(key: string): boolean {
  return !!key && !/[.#$\[\]]/.test(key);
}

const RematriculaTokenPage: React.FC<PageProps> = ({
  token,
  anoLetivo,
  invalid,
  mode,
  rematricula,
  aluno,
  modalidades,
  blockedTurmaKeys,
}) => {
  // --------- Guarda de tela inválida ----------
  if (invalid || !rematricula || !aluno) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)',
          p: 2,
        }}
      >
        <Typography variant="h4" color="white" sx={{ textAlign: 'center' }}>
          Link inválido ou expirado.
        </Typography>
      </Box>
    );
  }

  // --------- Sets / helpers ----------
  const blockedSet = useMemo(() => new Set(blockedTurmaKeys || []), [blockedTurmaKeys]);

  const inferNucleoFrom = (modalidadeNome: string, turmaNome: string): string => {
    const mod = modalidades.find((m) => m.nome === modalidadeNome);
    const turma = mod?.turmas?.find((t) => t?.nome_da_turma === turmaNome);
    return turma?.nucleo || '';
  };

  const getVagas = (t: Turma) =>
    (t.capacidade_maxima_da_turma || 0) - (t.capacidade_atual_da_turma || 0);

  const isLotada = (t: Turma) => getVagas(t) <= 0;

  // --------- Readonly e bloqueio global ----------
  const isReadOnly = mode !== 'form';

  // “globalNoOptions”: não existe nenhuma turma disponível (não bloqueada e não lotada) no banco inteiro
  const globalNoOptions = useMemo(() => {
    let available = 0;
    for (const m of modalidades) {
      for (const t of m.turmas || []) {
        const turmaNome = t?.nome_da_turma;
        if (!turmaNome) continue;
        const k = keyOf(m.nome, turmaNome);
        if (blockedSet.has(k)) continue;
        if (isLotada(t)) continue;
        available++;
        if (available > 0) return false;
      }
    }
    return true;
  }, [modalidades, blockedSet]);

  // Se não tem nenhuma opção no sistema, trava tudo
  const disableAllFields = isReadOnly || globalNoOptions;

  // --------- Estado do formulário ----------
  const [resposta, setResposta] = useState<RespostaTipo>(() => {
    const r = (rematricula.resposta || '').toString().toLowerCase();
    return r === 'nao' ? 'nao' : 'sim';
  });

  // principal
  const [modalidadeDestino, setModalidadeDestino] = useState<string>(() => {
    return (
      rematricula?.modalidadeDestino ||
      rematricula?.modalidadeOrigem ||
      ''
    );
  });

  const [nucleoDestino, setNucleoDestino] = useState<string>(() => {
    if (rematricula?.modalidadeDestino && rematricula?.turmaDestino) {
      return inferNucleoFrom(rematricula.modalidadeDestino, rematricula.turmaDestino);
    }
    return '';
  });

  const [turmaDestino, setTurmaDestino] = useState<string>(() => {
    return rematricula?.turmaDestino || '';
  });

  // extras
  const [extras, setExtras] = useState<ExtraDestinoForm[]>(() => {
    const raw = rematricula?.turmasExtrasDestino || [];
    return raw.map((e) => ({
      modalidadeDestino: e.modalidadeDestino || '',
      nucleoDestino: e.modalidadeDestino && e.turmaDestino ? inferNucleoFrom(e.modalidadeDestino, e.turmaDestino) : '',
      turmaDestino: e.turmaDestino || '',
    }));
  });

  // dados de contato
  const [telefoneAluno, setTelefoneAluno] = useState<string>(
    aluno?.telefoneComWhatsapp ? String(aluno.telefoneComWhatsapp) : '',
  );
  const [nomePagador, setNomePagador] = useState<string>(
    aluno?.informacoesAdicionais?.pagadorMensalidades?.nomeCompleto || '',
  );
  const [emailPagador, setEmailPagador] = useState<string>(
    aluno?.informacoesAdicionais?.pagadorMensalidades?.email || '',
  );
  const [telefonePagador, setTelefonePagador] = useState<string>(
    aluno?.informacoesAdicionais?.pagadorMensalidades?.celularWhatsapp
      ? String(aluno.informacoesAdicionais.pagadorMensalidades.celularWhatsapp)
      : '',
  );
  const [cpfPagador, setCpfPagador] = useState<string>(() => {
    const cpfRaw = aluno?.informacoesAdicionais?.pagadorMensalidades?.cpf;
    if (!cpfRaw) return '';
    return formatCPF(String(cpfRaw).replace(/\D/g, ''));
  });

  const [carregandoSubmit, setCarregandoSubmit] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // --------- Derivados: opções principal ----------
  const modalidadeAtual = useMemo(
    () => modalidades.find((m) => m.nome === modalidadeDestino),
    [modalidades, modalidadeDestino],
  );

  const nucleosPrincipal = useMemo(() => {
    if (!modalidadeAtual) return [];
    const setNucs = new Set<string>();
    (modalidadeAtual.turmas || []).forEach((t) => {
      if (t?.nucleo) setNucs.add(t.nucleo);
    });
    return Array.from(setNucs);
  }, [modalidadeAtual]);

  const selectedExtraKeys = useMemo(() => {
    const set = new Set<string>();
    extras.forEach((e) => {
      if (e.modalidadeDestino && e.turmaDestino) {
        set.add(keyOf(e.modalidadeDestino, e.turmaDestino));
      }
    });
    return set;
  }, [extras]);

  const principalKey = useMemo(() => {
    if (!modalidadeDestino || !turmaDestino) return '';
    return keyOf(modalidadeDestino, turmaDestino);
  }, [modalidadeDestino, turmaDestino]);

  // Turmas “visíveis” no select (remove bloqueadas; remove lotadas)
  const turmasPrincipalVisiveis = useMemo(() => {
    if (!modalidadeAtual) return [];

    return (modalidadeAtual.turmas || []).filter((t) => {
      if (!t?.nome_da_turma) return false;
      if (nucleoDestino && t.nucleo !== nucleoDestino) return false;

      const k = keyOf(modalidadeAtual.nome, t.nome_da_turma);

      // Remove bloqueadas SSR
      if (blockedSet.has(k)) return false;

      // Evita duplicar com extras já selecionados (para o usuário “nem enxergar”)
      if (selectedExtraKeys.has(k)) return false;

      // Remove lotadas do select (nem exibe)
      if (isLotada(t)) return false;

      return true;
    });
  }, [modalidadeAtual, nucleoDestino, blockedSet, selectedExtraKeys]);

  const principalHasAvailable = useMemo(() => {
    if (!modalidadeDestino) return true; // ainda não escolheu
    return turmasPrincipalVisiveis.length > 0;
  }, [modalidadeDestino, turmasPrincipalVisiveis.length]);

  // Se o usuário já tinha uma turma salva, mas agora ela está bloqueada/lotada/inexistente,
  // exibimos um “item especial” (disabled) para não deixar o select “vazio sem explicação”.
  const principalSelectionIsInvalidNow = useMemo(() => {
    if (!modalidadeDestino || !turmaDestino) return false;
    const mod = modalidades.find((m) => m.nome === modalidadeDestino);
    const t = mod?.turmas?.find((x) => x?.nome_da_turma === turmaDestino);
    if (!t) return true;

    const k = keyOf(modalidadeDestino, turmaDestino);
    if (blockedSet.has(k)) return true;
    if (selectedExtraKeys.has(k)) return true;
    if (isLotada(t)) return true;
    if (nucleoDestino && t.nucleo !== nucleoDestino) return true;

    // Se não aparece na lista visível, é inválida no contexto atual
    const isVisible = turmasPrincipalVisiveis.some((x) => x.nome_da_turma === turmaDestino);
    return !isVisible;
  }, [
    modalidades,
    modalidadeDestino,
    turmaDestino,
    nucleoDestino,
    blockedSet,
    selectedExtraKeys,
    turmasPrincipalVisiveis,
  ]);

  // --------- Derivados: opções extras ----------
  const getNucleosForExtra = (modalidadeNome: string) => {
    const mod = modalidades.find((m) => m.nome === modalidadeNome);
    if (!mod) return [];
    const setNucs = new Set<string>();
    (mod.turmas || []).forEach((t) => t?.nucleo && setNucs.add(t.nucleo));
    return Array.from(setNucs);
  };

  const getTurmasVisiveisForExtra = (index: number) => {
    const extra = extras[index];
    const mod = modalidades.find((m) => m.nome === extra.modalidadeDestino);
    if (!mod) return [];

    const otherExtraKeys = new Set<string>();
    extras.forEach((e, i) => {
      if (i === index) return;
      if (e.modalidadeDestino && e.turmaDestino) otherExtraKeys.add(keyOf(e.modalidadeDestino, e.turmaDestino));
    });

    return (mod.turmas || []).filter((t) => {
      if (!t?.nome_da_turma) return false;
      if (extra.nucleoDestino && t.nucleo !== extra.nucleoDestino) return false;

      const k = keyOf(mod.nome, t.nome_da_turma);

      // Remove bloqueadas SSR
      if (blockedSet.has(k)) return false;

      // Remove lotadas do select
      if (isLotada(t)) return false;

      // Não permitir repetir a turma principal
      if (principalKey && k === principalKey) return false;

      // Não permitir repetir outra extra já selecionada
      if (otherExtraKeys.has(k)) return false;

      return true;
    });
  };

  const extraHasAvailable = (index: number) => {
    const extra = extras[index];
    if (!extra.modalidadeDestino) return true; // ainda não escolheu
    return getTurmasVisiveisForExtra(index).length > 0;
  };

  const extraSelectionIsInvalidNow = (index: number) => {
    const extra = extras[index];
    if (!extra.modalidadeDestino || !extra.turmaDestino) return false;

    const mod = modalidades.find((m) => m.nome === extra.modalidadeDestino);
    const t = mod?.turmas?.find((x) => x?.nome_da_turma === extra.turmaDestino);
    if (!t) return true;

    const k = keyOf(extra.modalidadeDestino, extra.turmaDestino);

    // Regras
    if (blockedSet.has(k)) return true;
    if (principalKey && k === principalKey) return true;

    // duplicada com outra extra
    const duplicatesOtherExtra = extras.some((e, i) => {
      if (i === index) return false;
      return e.modalidadeDestino && e.turmaDestino && keyOf(e.modalidadeDestino, e.turmaDestino) === k;
    });
    if (duplicatesOtherExtra) return true;

    if (isLotada(t)) return true;
    if (extra.nucleoDestino && t.nucleo !== extra.nucleoDestino) return true;

    const visible = getTurmasVisiveisForExtra(index).some((x) => x.nome_da_turma === extra.turmaDestino);
    return !visible;
  };

  // --------- Handlers ----------
  const handleChangeResposta = (e: ChangeEvent<HTMLInputElement>, value: string) => {
    if (disableAllFields) return;
    setResposta(value as RespostaTipo);
  };

  const handleCpfChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (disableAllFields) return;
    const onlyDigits = e.target.value.replace(/\D/g, '');
    setCpfPagador(formatCPF(onlyDigits));
  };

  const handleAddExtra = () => {
    if (disableAllFields) return;
    setExtras((prev) => [...prev, { modalidadeDestino: '', nucleoDestino: '', turmaDestino: '' }]);
  };

  const handleChangeExtra = (index: number, field: keyof ExtraDestinoForm, value: string) => {
    if (disableAllFields) return;

    setExtras((prev) =>
      prev.map((e, i) =>
        i === index
          ? {
              ...e,
              [field]: value,
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
    if (disableAllFields) return;
    setExtras((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setInfo(null);

    if (disableAllFields) {
      setErro('Este formulário está bloqueado no momento.');
      return;
    }

    if (resposta === 'sim') {
      if (!modalidadeDestino || !turmaDestino) {
        setErro('Selecione a modalidade e a turma principal desejada.');
        return;
      }

      // Se a seleção principal estiver inválida (bloqueada/lotada/duplicada), barra
      if (principalSelectionIsInvalidNow) {
        setErro('A turma principal selecionada não está disponível. Selecione outra turma.');
        return;
      }

      // Se a modalidade escolhida não tiver nenhuma turma disponível, barra
      if (!principalHasAvailable) {
        setErro('Não há turmas disponíveis para este aluno na modalidade/núcleo selecionados.');
        return;
      }
    }

    try {
      setCarregandoSubmit(true);

      // Extras válidos:
      // - modalidade+turma preenchidos
      // - não repetem principal
      // - não repetem outra extra
      // - não bloqueados SSR
      // - não lotados (já removidos do select, mas revalida aqui)
      const extrasValidos: Array<{ modalidadeDestino: string; turmaDestino: string }> = [];
      const seen = new Set<string>();

      for (let i = 0; i < extras.length; i++) {
        const ex = extras[i];
        if (!ex.modalidadeDestino || !ex.turmaDestino) continue;

        const k = keyOf(ex.modalidadeDestino, ex.turmaDestino);
        if (principalKey && k === principalKey) continue;
        if (blockedSet.has(k)) continue;
        if (seen.has(k)) continue;

        const mod = modalidades.find((m) => m.nome === ex.modalidadeDestino);
        const t = mod?.turmas?.find((x) => x?.nome_da_turma === ex.turmaDestino);
        if (!t) continue;
        if (isLotada(t)) continue;

        // também não aceita se a seleção atual virou inválida
        if (extraSelectionIsInvalidNow(i)) continue;

        seen.add(k);
        extrasValidos.push({ modalidadeDestino: ex.modalidadeDestino, turmaDestino: ex.turmaDestino });
      }

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
        body.turmasExtrasDestino = extrasValidos;
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
          ? 'Rematrícula registrada com sucesso! A administração irá conferir e aplicar as mudanças.'
          : 'Sua opção de NÃO rematricular foi registrada com sucesso.',
      );
    } catch (error: any) {
      console.error(error);
      setErro(error.message || 'Erro ao enviar rematrícula.');
    } finally {
      setCarregandoSubmit(false);
    }
  };

  // --------- UI ----------
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        background: 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)',
        p: 2,
      }}
    >
      <Paper elevation={4} sx={{ maxWidth: 900, width: '100%', p: 3, mt: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, textAlign: 'center' }}>
          Rematrícula {anoLetivo}
        </Typography>

        <Typography sx={{ mb: 1 }}>
          <b>Aluno:</b> {aluno.nome}
        </Typography>
        <Typography sx={{ mb: 1 }}>
          <b>Turma atual:</b> {rematricula.nomeDaTurmaOrigem} ({rematricula.modalidadeOrigem})
        </Typography>

        {aluno.anoNascimento && (
          <Typography sx={{ mb: 2 }}>
            <b>Ano de nascimento:</b> {aluno.anoNascimento}
          </Typography>
        )}

        {/* Mensagens de modo */}
        {mode === 'respondida' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Esta rematrícula já foi enviada e está aguardando conferência da administração.
            O formulário está em modo somente leitura. Caso precise corrigir, solicite à administração.
          </Alert>
        )}

        {mode === 'aplicada' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Esta rematrícula já foi aplicada pela administração. O formulário está em modo somente leitura.
          </Alert>
        )}

        {mode === 'nao-rematriculado' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Este registro está marcado como “não rematriculado”. O formulário está em modo somente leitura.
          </Alert>
        )}

        {globalNoOptions && mode === 'form' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Não há turmas disponíveis para este aluno no momento. Isso pode ocorrer por bloqueios
            (já matriculado, já escolhido em outra rematrícula, turmas desabilitadas pela direção)
            ou porque todas as turmas estão lotadas. Por segurança, o formulário foi desabilitado.
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Typography sx={{ mt: 1, mb: 1 }}>
            Deseja fazer a rematrícula para {anoLetivo}?
          </Typography>

          <RadioGroup row value={resposta} onChange={handleChangeResposta}>
            <FormControlLabel value="sim" control={<Radio />} label="Sim" disabled={disableAllFields} />
            <FormControlLabel value="nao" control={<Radio />} label="Não" disabled={disableAllFields} />
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
                disabled={disableAllFields}
                onChange={(e) => {
                  if (disableAllFields) return;
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
                disabled={disableAllFields || !modalidadeDestino}
                onChange={(e) => {
                  if (disableAllFields) return;
                  setNucleoDestino(e.target.value);
                  setTurmaDestino('');
                }}
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

              {/* Mensagem amigável quando não há turmas para principal */}
              {modalidadeDestino && !principalHasAvailable && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Não há turmas disponíveis para este aluno nesta modalidade/núcleo como turma principal.
                  Isso pode ocorrer por bloqueios (já matriculado, já escolhido em outra rematrícula,
                  ou turmas desabilitadas pela direção) ou turmas lotadas.
                </Alert>
              )}

              <TextField
                select
                fullWidth
                label="Turma principal"
                margin="normal"
                value={turmaDestino}
                disabled={disableAllFields || !modalidadeDestino || !principalHasAvailable}
                onChange={(e) => {
                  if (disableAllFields) return;
                  setTurmaDestino(e.target.value);
                }}
              >
                <MenuItem value="">
                  <em>Selecione...</em>
                </MenuItem>

                {/* Se havia seleção salva, mas agora está inválida, mostramos uma opção “somente leitura” */}
                {turmaDestino && principalSelectionIsInvalidNow && (
                  <MenuItem value={turmaDestino} disabled>
                    {turmaDestino} — (Selecionada anteriormente, mas indisponível)
                  </MenuItem>
                )}

                {turmasPrincipalVisiveis.map((t) => {
                  const vagas = getVagas(t);
                  return (
                    <MenuItem key={t.nome_da_turma} value={t.nome_da_turma}>
                      {t.nome_da_turma} — Vagas disponíveis: {vagas}
                    </MenuItem>
                  );
                })}
              </TextField>

              <Divider sx={{ my: 2 }} />

              {/* HORÁRIOS EXTRAS */}
              <Typography sx={{ mt: 2, mb: 1 }}>
                <b>Horários extras (opcional)</b>
              </Typography>
              <Typography sx={{ mb: 1, fontSize: 14 }}>
                Se o aluno vai treinar mais de uma vez por semana em {anoLetivo}, você pode adicionar outros horários
                (modalidade/turma) aqui.
              </Typography>

              <Button
                variant="outlined"
                size="small"
                onClick={handleAddExtra}
                sx={{ mb: 2 }}
                disabled={disableAllFields}
              >
                Adicionar mais um horário
              </Button>

              {extras.map((extra, index) => {
                const nucleosExtra = getNucleosForExtra(extra.modalidadeDestino);
                const turmasExtraVisiveis = getTurmasVisiveisForExtra(index);
                const hasAvailable = extraHasAvailable(index);
                const invalidSelectionNow = extraSelectionIsInvalidNow(index);

                return (
                  <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 1,
                      }}
                    >
                      <Typography>Horário extra {index + 1}</Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveExtra(index)}
                        disabled={disableAllFields}
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
                      disabled={disableAllFields}
                      onChange={(e) => handleChangeExtra(index, 'modalidadeDestino', e.target.value)}
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
                      disabled={disableAllFields || !extra.modalidadeDestino}
                      onChange={(e) => handleChangeExtra(index, 'nucleoDestino', e.target.value)}
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

                    {/* Mensagem amigável quando não há turmas para extra */}
                    {extra.modalidadeDestino && !hasAvailable && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Não há turmas disponíveis para este aluno nesta modalidade/núcleo como horário extra.
                        Isso pode ocorrer por bloqueios (já matriculado, já escolhido em outra rematrícula,
                        ou turmas desabilitadas pela direção) ou turmas lotadas.
                      </Alert>
                    )}

                    <TextField
                      select
                      fullWidth
                      label="Turma extra"
                      margin="normal"
                      value={extra.turmaDestino}
                      disabled={disableAllFields || !extra.modalidadeDestino || !hasAvailable}
                      onChange={(e) => handleChangeExtra(index, 'turmaDestino', e.target.value)}
                    >
                      <MenuItem value="">
                        <em>Selecione...</em>
                      </MenuItem>

                      {/* Se havia seleção salva, mas agora está inválida, mostramos uma opção “somente leitura” */}
                      {extra.turmaDestino && invalidSelectionNow && (
                        <MenuItem value={extra.turmaDestino} disabled>
                          {extra.turmaDestino} — (Selecionada anteriormente, mas indisponível)
                        </MenuItem>
                      )}

                      {turmasExtraVisiveis.map((t) => {
                        const vagas = getVagas(t);
                        return (
                          <MenuItem key={t.nome_da_turma} value={t.nome_da_turma}>
                            {t.nome_da_turma} — Vagas disponíveis: {vagas}
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  </Paper>
                );
              })}

              <Divider sx={{ my: 2 }} />

              {/* DADOS DE CONTATO */}
              <Typography sx={{ mt: 2, mb: 1 }}>
                <b>Atualização de dados de contato</b>
              </Typography>

              <TextField
                fullWidth
                margin="normal"
                label="Telefone/WhatsApp do aluno ou responsável"
                value={telefoneAluno}
                disabled={disableAllFields}
                onChange={(e) => {
                  if (disableAllFields) return;
                  setTelefoneAluno(e.target.value);
                }}
              />

              <TextField
                fullWidth
                margin="normal"
                label="Nome do pagador das mensalidades"
                value={nomePagador}
                disabled={disableAllFields}
                onChange={(e) => {
                  if (disableAllFields) return;
                  setNomePagador(e.target.value);
                }}
              />

              <TextField
                fullWidth
                margin="normal"
                label="E-mail do pagador"
                value={emailPagador}
                disabled={disableAllFields}
                onChange={(e) => {
                  if (disableAllFields) return;
                  setEmailPagador(e.target.value);
                }}
              />

              <TextField
                fullWidth
                margin="normal"
                label="Telefone/WhatsApp do pagador"
                value={telefonePagador}
                disabled={disableAllFields}
                onChange={(e) => {
                  if (disableAllFields) return;
                  setTelefonePagador(e.target.value);
                }}
              />

              <TextField
                fullWidth
                margin="normal"
                label="CPF do pagador"
                placeholder="000.000.000-00"
                value={cpfPagador}
                disabled={disableAllFields}
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
              disabled={
                disableAllFields ||
                carregandoSubmit ||
                (resposta === 'sim' && (!modalidadeDestino || !turmaDestino || principalSelectionIsInvalidNow || !principalHasAvailable))
              }
              fullWidth
            >
              {carregandoSubmit ? (
                <>
                  <CircularProgress size={18} sx={{ mr: 1, color: 'inherit' }} />
                  Enviando rematrícula...
                </>
              ) : (
                'Confirmar rematrícula'
              )}
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
// + calcula blockedTurmaKeys (SSR)
// ---------------------------------------------
export const getServerSideProps: GetServerSideProps<PageProps> = async (context) => {
  const token = context.params?.token as string;
  const anoLetivo = ANO_PADRAO;

  const rematriculaId = resolveRematriculaId(token);

  if (!rematriculaId || !isValidDbKey(rematriculaId)) {
    return {
      props: {
        token,
        anoLetivo,
        invalid: true,
        mode: 'form',
        rematricula: null,
        aluno: null,
        modalidades: [],
        blockedTurmaKeys: [],
      },
    };
  }

  try {
    const db = admin.database();

    // 1) Carrega rematrícula
    const remRef = db.ref(`rematriculas${anoLetivo}/${rematriculaId}`);
    const remSnap = await remRef.once('value');

    if (!remSnap.exists()) {
      return {
        props: {
          token,
          anoLetivo,
          invalid: true,
          mode: 'form',
          rematricula: null,
          aluno: null,
          modalidades: [],
          blockedTurmaKeys: [],
        },
      };
    }

    const rem = remSnap.val() as RematriculaRecord;

    // Normaliza status: se tem resposta+timestampResposta, considere "respondida" mesmo se status for "pendente"
    const statusRaw = (rem.status || '').toString();
    const respLower = (rem.resposta || '').toString().toLowerCase();
    const jaTemResposta = (respLower === 'sim' || respLower === 'nao') && !!(rem.timestampResposta || 0);

    const status =
      statusRaw === 'pendente' && jaTemResposta ? 'respondida' : statusRaw;

    const mode: Mode =
      status === 'aplicada'
        ? 'aplicada'
        : status === 'respondida'
        ? 'respondida'
        : status === 'nao-rematriculado'
        ? 'nao-rematriculado'
        : 'form';

    // 2) Carrega modalidades
    const modalidadesSnap = await db.ref('modalidades').once('value');
    const modalidadesVal = modalidadesSnap.val() || {};

    const modalidades: Modalidade[] = Object.entries(modalidadesVal).map(([nome, valor]: any) => ({
      nome,
      turmas: valor?.turmas
        ? (Array.isArray(valor.turmas) ? valor.turmas : Object.values(valor.turmas))
        : [],
    }));

    // 3) Encontra o aluno pelo IdentificadorUnico (varre todas as modalidades/turmas)
    const identificadorUnico = rem.identificadorUnico;

    let alunoEncontrado: AlunoFromDB | null = null;

    outer: for (const modNome of Object.keys(modalidadesVal)) {
      const mod = modalidadesVal[modNome];
      const turmasRaw = mod?.turmas || [];
      const turmasArr: any[] = Array.isArray(turmasRaw) ? turmasRaw : Object.values(turmasRaw);

      for (const turma of turmasArr) {
        const alunosRaw = turma?.alunos || [];
        const alunosArr: any[] = Array.isArray(alunosRaw) ? alunosRaw : Object.values(alunosRaw);

        for (const a of alunosArr) {
          if (a?.informacoesAdicionais?.IdentificadorUnico === identificadorUnico) {
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
          token,
          anoLetivo,
          invalid: true,
          mode: 'form',
          rematricula: null,
          aluno: null,
          modalidades: [],
          blockedTurmaKeys: [],
        },
      };
    }

    // --- Helpers ---
    const turmaKey = (mod: string, turma: string) => keyOf(mod, turma);

    // 4) Turmas atuais do aluno (todas onde ele está hoje)
    const origemKey = turmaKey(rem.modalidadeOrigem, rem.nomeDaTurmaOrigem);
    const turmasAtuaisKeys = new Set<string>();

    for (const modNome of Object.keys(modalidadesVal)) {
      const mod = modalidadesVal[modNome];
      const turmasRaw = mod?.turmas || [];
      const turmasArr: any[] = Array.isArray(turmasRaw) ? turmasRaw : Object.values(turmasRaw);

      for (const turma of turmasArr) {
        const alunosRaw = turma?.alunos || [];
        const alunosArr: any[] = Array.isArray(alunosRaw) ? alunosRaw : Object.values(alunosRaw);

        const found = alunosArr.some((a) => a?.informacoesAdicionais?.IdentificadorUnico === identificadorUnico);
        if (found && turma?.nome_da_turma) {
          turmasAtuaisKeys.add(turmaKey(modNome, turma.nome_da_turma));
        }
      }
    }

    // 5) Turmas reservadas em OUTRAS rematrículas do mesmo aluno (respondida/aplicada)
    const turmasReservadasKeys = new Set<string>();

    const allRemSnap = await db.ref(`rematriculas${anoLetivo}`).once('value');
    const allRemVal = allRemSnap.val() || {};

    const isReservadaStatus = (rr: any) => {
      const sRaw = (rr?.status || '').toString();
      const rLower = (rr?.resposta || '').toString().toLowerCase();
      const hasTs = !!(rr?.timestampResposta || rr?.timestamp);
      const sNorm = sRaw === 'pendente' && (rLower === 'sim' || rLower === 'nao') && hasTs ? 'respondida' : sRaw;
      return sNorm === 'respondida' || sNorm === 'aplicada';
    };

    for (const [rid, rrAny] of Object.entries(allRemVal as Record<string, any>)) {
      if (rid === rematriculaId) continue;

      const rr = rrAny as any;
      if (rr?.identificadorUnico !== identificadorUnico) continue;

      const rLower = (rr?.resposta || '').toString().toLowerCase();
      if (rLower !== 'sim') continue;
      if (!isReservadaStatus(rr)) continue;

      if (rr?.modalidadeDestino && rr?.turmaDestino) {
        turmasReservadasKeys.add(turmaKey(rr.modalidadeDestino, rr.turmaDestino));
      }

      if (Array.isArray(rr?.turmasExtrasDestino)) {
        for (const ex of rr.turmasExtrasDestino) {
          if (ex?.modalidadeDestino && ex?.turmaDestino) {
            turmasReservadasKeys.add(turmaKey(ex.modalidadeDestino, ex.turmaDestino));
          }
        }
      }
    }

    // 6) Turmas desabilitadas pela direção (rematriculaConfig)
    const disabledKeys = new Set<string>();

    const configSnap = await db.ref(`rematriculaConfig/${anoLetivo}/turmas`).once('value');
    const configVal = configSnap.val() || {};

    // Para mapear uuidTurma -> (modalidade:::nome_da_turma), varremos todas as turmas do banco
    for (const modNome of Object.keys(modalidadesVal)) {
      const mod = modalidadesVal[modNome];
      const turmasRaw = mod?.turmas || [];
      const turmasArr: any[] = Array.isArray(turmasRaw) ? turmasRaw : Object.values(turmasRaw);

      for (const turma of turmasArr) {
        const uuidTurma = turma?.uuidTurma;
        const nomeDaTurma = turma?.nome_da_turma;
        if (!uuidTurma || !nomeDaTurma) continue;

        const cfg = configVal?.[uuidTurma];
        if (cfg && cfg.enabled === false) {
          disabledKeys.add(turmaKey(modNome, nomeDaTurma));
        }
      }
    }

    // 7) Monta bloqueios:
    // - HARD: turmas desabilitadas (não podem “desbloquear” nem se já estiver selecionada)
    // - SOFT: turmas atuais (exceto origem) + turmas reservadas por outra rematrícula
    const softBlocked = new Set<string>();

    for (const k of turmasAtuaisKeys) {
      if (k !== origemKey) softBlocked.add(k);
    }
    for (const k of turmasReservadasKeys) {
      softBlocked.add(k);
    }

    // 8) Não bloqueia escolhas já feitas NESTA rematrícula (somente soft)
    const allowThisRem = new Set<string>();
    if (rem.modalidadeDestino && rem.turmaDestino) {
      allowThisRem.add(turmaKey(rem.modalidadeDestino, rem.turmaDestino));
    }
    if (Array.isArray(rem.turmasExtrasDestino)) {
      for (const ex of rem.turmasExtrasDestino) {
        if (ex?.modalidadeDestino && ex?.turmaDestino) {
          allowThisRem.add(turmaKey(ex.modalidadeDestino, ex.turmaDestino));
        }
      }
    }
    for (const k of allowThisRem) {
      softBlocked.delete(k);
    }

    // 9) União final
    const blocked = new Set<string>([...softBlocked, ...disabledKeys]);

    return {
      props: {
        token,
        anoLetivo,
        invalid: false,
        mode,
        rematricula: JSON.parse(JSON.stringify(rem)),
        aluno: JSON.parse(JSON.stringify(alunoEncontrado)),
        modalidades: JSON.parse(JSON.stringify(modalidades)),
        blockedTurmaKeys: Array.from(blocked),
      },
    };
  } catch (error) {
    console.error('Erro em getServerSideProps [token].tsx:', error);
    return {
      props: {
        token,
        anoLetivo,
        invalid: true,
        mode: 'form',
        rematricula: null,
        aluno: null,
        modalidades: [],
        blockedTurmaKeys: [],
      },
    };
  }
};
