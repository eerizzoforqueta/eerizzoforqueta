'use client';

import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent, useCallback } from 'react';
import {
  Container,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Box,
  AppBar,
  Tabs,
  Tab,
  Snackbar,
  Alert,
  Divider,
  SelectChangeEvent,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import axios from 'axios';
import { Modalidade, Turma } from '@/interface/interfaces';
import { useData } from '@/context/context';
import { BoxStyleCadastro } from '@/utils/Styles';
import Layout from '@/components/TopBarComponents/Layout';
import MergeTurmasForm from '@/components/MergeTurmasForm';

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tab-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3, bgcolor: 'background.paper' }}>{children}</Box>}
    </div>
  );
}

type EditableTurmaFields = Omit<
  Turma,
  'uuidTurma' | 'nome_da_turma' | 'capacidade_atual_da_turma' | 'alunos'
>;

type TurmaOption = {
  value: string;
  turma: Turma;
  turmaKey: string;
};

const INITIAL_FORM_VALUES: EditableTurmaFields = {
  modalidade: '',
  nucleo: '',
  categoria: '',
  diaDaSemana: '',
  horario: '',
  capacidade_maxima_da_turma: 1,
  isFeminina: false,
};

function normalizeString(value: string | undefined | null): string {
  return String(value ?? '').trim();
}

function buildTurmaName(
  values: Pick<EditableTurmaFields, 'categoria' | 'nucleo' | 'diaDaSemana' | 'horario' | 'isFeminina'>
): string {
  const parts = [
    normalizeString(values.categoria),
    normalizeString(values.nucleo),
    normalizeString(values.diaDaSemana),
    normalizeString(values.horario),
  ].filter(Boolean);

  const base = parts.join('_');
  if (!base) return '';

  return values.isFeminina ? `${base} - FEMININO` : base;
}

function buildTurmaOptionValue(turma: Turma, turmaKey: string): string {
  if (turma.uuidTurma) {
    return `uuid:${turma.uuidTurma}`;
  }
  return `key:${turmaKey}`;
}

type MutationResponse = {
  turma?: Turma;
  turmaKey?: string;
};

export default function ManageTurmas() {
  const { fetchModalidades } = useData();

  const [tabIndex, setTabIndex] = useState(0);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [selectedModalidade, setSelectedModalidade] = useState<string>('');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<Turma | undefined>(undefined);
  const [selectedTurmaOption, setSelectedTurmaOption] = useState<string>('');
  const [selectedTurmaKey, setSelectedTurmaKey] = useState<string>('');

  const [formValues, setFormValues] = useState<EditableTurmaFields>(INITIAL_FORM_VALUES);
  const [nomeTurma, setNomeTurma] = useState<string>('');
  const [autoNome, setAutoNome] = useState<boolean>(true);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [capacidadeInvalida, setCapacidadeInvalida] = useState(false);

  const categorias = useMemo(
    () => [
      'SUB07',
      'SUB08',
      'SUB09',
      'SUB10',
      'SUB11',
      'SUB12',
      'SUB13',
      'SUB14',
      'SUB15_17',
      'SUB11_SUB13',
      'SUB07_SUB09',
      'SUB09_SUB11',
      'SUB13_SUB15',
      "ADULTO_(LIVRE)"
    ],
    []
  );

  const turmaOptions = useMemo<TurmaOption[]>(() => {
    return turmas.map((turma, index) => {
      const turmaKey = String(index);
      return {
        value: buildTurmaOptionValue(turma, turmaKey),
        turma,
        turmaKey,
      };
    });
  }, [turmas]);

  const loadModalidades = useCallback(async () => {
    const data = await fetchModalidades();
    const valid = data.filter((m) => m.nome !== 'arquivados' && m.nome !== 'excluidos');
    setModalidades(valid);
    return valid;
  }, [fetchModalidades]);

  useEffect(() => {
    loadModalidades().catch(console.error);
  }, [loadModalidades]);

  useEffect(() => {
    if (!selectedModalidade) {
      setTurmas([]);
      setSelectedTurma(undefined);
      setSelectedTurmaOption('');
      setSelectedTurmaKey('');
      return;
    }

    const modalidadeEscolhida = modalidades.find((m) => m.nome === selectedModalidade);
    const turmasArray = modalidadeEscolhida?.turmas
      ? Array.isArray(modalidadeEscolhida.turmas)
        ? modalidadeEscolhida.turmas
        : (Object.values(modalidadeEscolhida.turmas) as Turma[])
      : [];

    setTurmas(turmasArray);
  }, [selectedModalidade, modalidades]);

  useEffect(() => {
    if (!selectedTurma) {
      setCapacidadeInvalida(false);
      return;
    }

    setCapacidadeInvalida(
      formValues.capacidade_maxima_da_turma < selectedTurma.capacidade_atual_da_turma
    );
  }, [formValues.capacidade_maxima_da_turma, selectedTurma]);

  const applyAutoNomeIfEnabled = useCallback(
    (values: EditableTurmaFields) => {
      if (!autoNome) return;
      setNomeTurma(buildTurmaName(values));
    },
    [autoNome]
  );

  const resetEditorState = useCallback(() => {
    setFormValues(INITIAL_FORM_VALUES);
    setNomeTurma('');
    setSelectedTurma(undefined);
    setSelectedTurmaOption('');
    setSelectedTurmaKey('');
    setAutoNome(true);
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const fieldName = name as keyof EditableTurmaFields;

    let parsedValue: EditableTurmaFields[keyof EditableTurmaFields];
    if (fieldName === 'capacidade_maxima_da_turma') {
      parsedValue = Number(value) as EditableTurmaFields[keyof EditableTurmaFields];
    } else if (type === 'checkbox') {
      parsedValue = checked as EditableTurmaFields[keyof EditableTurmaFields];
    } else {
      parsedValue = value as EditableTurmaFields[keyof EditableTurmaFields];
    }

    setFormValues((prev) => {
      const next = { ...prev, [fieldName]: parsedValue } as EditableTurmaFields;
      applyAutoNomeIfEnabled(next);
      return next;
    });
  };

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    const fieldName = name as keyof EditableTurmaFields;

    setFormValues((prev) => {
      const next = { ...prev, [fieldName]: value } as EditableTurmaFields;
      applyAutoNomeIfEnabled(next);
      return next;
    });
  };

  const handleTurmaSelectChange = (event: SelectChangeEvent<string>) => {
    const optionValue = event.target.value as string;
    const option = turmaOptions.find((item) => item.value === optionValue);

    if (!option) {
      resetEditorState();
      return;
    }

    const turma = option.turma;
    setSelectedTurma(turma);
    setSelectedTurmaOption(optionValue);
    setSelectedTurmaKey(option.turmaKey);

    const updatedValues: EditableTurmaFields = {
      modalidade: turma.modalidade,
      nucleo: turma.nucleo,
      categoria: turma.categoria,
      diaDaSemana: turma.diaDaSemana ?? '',
      horario: turma.horario ?? '',
      capacidade_maxima_da_turma: turma.capacidade_maxima_da_turma,
      isFeminina: !!turma.isFeminina,
    };

    setFormValues(updatedValues);

    // Para corrigir nomes legados inconsistentes, inicia update com autoNome ligado.
    setAutoNome(true);
    setNomeTurma(buildTurmaName(updatedValues));
  };

  const handleAutoNomeToggle = (checked: boolean) => {
    setAutoNome(checked);
    if (checked) {
      setNomeTurma(buildTurmaName(formValues));
    }
  };

  const refreshAfterMutation = async (
    modalidadeToKeep?: string,
    identity?: { uuidTurma?: string; turmaKey?: string }
  ) => {
    const updatedModalidades = await loadModalidades();

    if (!modalidadeToKeep) {
      resetEditorState();
      return;
    }

    setSelectedModalidade(modalidadeToKeep);

    const modalidadeAtualizada = updatedModalidades.find((m) => m.nome === modalidadeToKeep);
    const turmasAtualizadas = modalidadeAtualizada?.turmas
      ? Array.isArray(modalidadeAtualizada.turmas)
        ? modalidadeAtualizada.turmas
        : (Object.values(modalidadeAtualizada.turmas) as Turma[])
      : [];

    setTurmas(turmasAtualizadas);

    if (!identity?.uuidTurma && identity?.turmaKey === undefined) {
      resetEditorState();
      return;
    }

    let turmaAtualizada: Turma | undefined;
    let turmaKeyAtualizada = '';

    if (identity?.uuidTurma) {
      const index = turmasAtualizadas.findIndex((t) => t.uuidTurma === identity.uuidTurma);
      if (index >= 0) {
        turmaAtualizada = turmasAtualizadas[index];
        turmaKeyAtualizada = String(index);
      }
    }

    if (!turmaAtualizada && identity?.turmaKey !== undefined) {
      const index = Number(identity.turmaKey);
      if (Number.isInteger(index) && index >= 0 && index < turmasAtualizadas.length) {
        turmaAtualizada = turmasAtualizadas[index];
        turmaKeyAtualizada = String(index);
      }
    }

    if (!turmaAtualizada) {
      resetEditorState();
      return;
    }

    setSelectedTurma(turmaAtualizada);
    setSelectedTurmaKey(turmaKeyAtualizada);
    setSelectedTurmaOption(buildTurmaOptionValue(turmaAtualizada, turmaKeyAtualizada));

    const updatedValues: EditableTurmaFields = {
      modalidade: turmaAtualizada.modalidade,
      nucleo: turmaAtualizada.nucleo,
      categoria: turmaAtualizada.categoria,
      diaDaSemana: turmaAtualizada.diaDaSemana ?? '',
      horario: turmaAtualizada.horario ?? '',
      capacidade_maxima_da_turma: turmaAtualizada.capacidade_maxima_da_turma,
      isFeminina: !!turmaAtualizada.isFeminina,
    };

    setFormValues(updatedValues);
    setAutoNome(true);
    setNomeTurma(buildTurmaName(updatedValues));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (selectedTurma) {
        const payload: Record<string, unknown> = {
          modalidade: selectedTurma.modalidade,
          nucleo: formValues.nucleo,
          categoria: formValues.categoria,
          diaDaSemana: formValues.diaDaSemana,
          horario: formValues.horario,
          capacidade_maxima_da_turma: formValues.capacidade_maxima_da_turma,
          isFeminina: formValues.isFeminina,
          ...(autoNome ? {} : { nome_da_turma: nomeTurma }),
        };

        if (selectedTurma.uuidTurma) {
          payload.uuidTurma = selectedTurma.uuidTurma;
        } else {
          payload.turmaKey = selectedTurmaKey;
        }

        const response = await axios.put<MutationResponse>('/api/HandleNewTurmas', payload);

        await refreshAfterMutation(selectedTurma.modalidade, {
          uuidTurma: response.data.turma?.uuidTurma,
          turmaKey: response.data.turmaKey ?? selectedTurmaKey,
        });

        setSuccessMessage('Turma atualizada com sucesso!');
      } else {
        await axios.post('/api/HandleNewTurmas', {
          modalidade: formValues.modalidade,
          nucleo: formValues.nucleo,
          categoria: formValues.categoria,
          diaDaSemana: formValues.diaDaSemana,
          horario: formValues.horario,
          capacidade_maxima_da_turma: formValues.capacidade_maxima_da_turma,
          isFeminina: formValues.isFeminina,
          ...(autoNome ? {} : { nome_da_turma: nomeTurma }),
        });

        await refreshAfterMutation(formValues.modalidade);
        setSuccessMessage('Turma criada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao realizar operação:', error);
      setErrorMessage('Não foi possível salvar a turma.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTurma) return;

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload: Record<string, unknown> = {
        modalidade: selectedTurma.modalidade,
      };

      if (selectedTurma.uuidTurma) {
        payload.uuidTurma = selectedTurma.uuidTurma;
      } else {
        payload.turmaKey = selectedTurmaKey;
      }

      await axios.delete('/api/HandleNewTurmas', { data: payload });

      await refreshAfterMutation(selectedTurma.modalidade);
      setSuccessMessage('Turma deletada com sucesso!');
    } catch (error) {
      console.error('Erro ao deletar turma:', error);
      setErrorMessage('Não foi possível deletar a turma.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Container sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 0 }}>
        <Box sx={BoxStyleCadastro}>
          <AppBar position="static" sx={{ backgroundColor: '#2e3b55', mt: '10px' }}>
            <Tabs
              value={tabIndex}
              onChange={(_, v) => setTabIndex(v)}
              variant="fullWidth"
              textColor="inherit"
              indicatorColor="secondary"
            >
              <Tab label="Criar Turma" />
              <Tab label="Atualizar Turma" />
              <Tab label="Excluir Turma" />
              <Tab label="Mesclar Turmas" />
            </Tabs>
          </AppBar>

          <TabPanel value={tabIndex} index={0}>
            <form onSubmit={handleSubmit}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Modalidade</InputLabel>
                <Select name="modalidade" value={formValues.modalidade} onChange={handleSelectChange} required>
                  {modalidades.map((m, index) => (
                    <MenuItem key={`${m.nome}-${index}`} value={m.nome}>
                      {m.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Núcleo"
                name="nucleo"
                value={formValues.nucleo}
                onChange={handleInputChange}
                required
                fullWidth
                margin="normal"
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Categoria</InputLabel>
                <Select name="categoria" value={formValues.categoria} onChange={handleSelectChange} required>
                  {categorias.map((c, index) => (
                    <MenuItem key={`${c}-${index}`} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>Dia da Semana</InputLabel>
                <Select name="diaDaSemana" value={formValues.diaDaSemana} onChange={handleSelectChange} required>
                  {['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'].map((dia, index) => (
                    <MenuItem key={`${dia}-${index}`} value={dia}>
                      {dia}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Horário"
                name="horario"
                value={formValues.horario}
                onChange={handleInputChange}
                required
                fullWidth
                margin="normal"
              />

              <TextField
                type="number"
                label="Capacidade Máxima"
                name="capacidade_maxima_da_turma"
                value={String(formValues.capacidade_maxima_da_turma)}
                onChange={handleInputChange}
                required
                fullWidth
                margin="normal"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    name="isFeminina"
                    checked={!!formValues.isFeminina}
                    onChange={handleInputChange}
                  />
                }
                label="Turma Feminina (todas as idades)"
                sx={{ color: 'black' }}
              />

              <FormControlLabel
                control={<Checkbox checked={autoNome} onChange={(e) => handleAutoNomeToggle(e.target.checked)} />}
                label="Gerar nome automaticamente"
                sx={{ color: 'black' }}
              />

              {capacidadeInvalida && (
                <Typography color="error" variant="body2">
                  A capacidade máxima não pode ser menor que o número atual de alunos ({selectedTurma?.capacidade_atual_da_turma}).
                </Typography>
              )}

              <TextField
                label="Nome da Turma"
                value={nomeTurma}
                onChange={(e) => {
                  if (!autoNome) setNomeTurma(e.target.value);
                }}
                fullWidth
                margin="normal"
                disabled={autoNome}
                helperText={
                  autoNome
                    ? 'Desmarque "Gerar nome automaticamente" para editar.'
                    : 'Digite o nome desejado.'
                }
              />

              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading || capacidadeInvalida || !nomeTurma}
              >
                Criar Turma
              </Button>
            </form>
          </TabPanel>

          <TabPanel value={tabIndex} index={1}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Modalidade</InputLabel>
              <Select
                value={selectedModalidade}
                onChange={(e) => {
                  setSelectedModalidade(e.target.value as string);
                  resetEditorState();
                }}
                required
              >
                {modalidades.map((m, index) => (
                  <MenuItem key={`${m.nome}-${index}`} value={m.nome}>
                    {m.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ my: 2 }} />

            <FormControl fullWidth margin="normal">
              <InputLabel>Turma</InputLabel>
              <Select value={selectedTurmaOption} onChange={handleTurmaSelectChange} required>
                {turmaOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.turma.nome_da_turma}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedTurma && (
              <form onSubmit={handleSubmit}>
                <TextField
                  label="Núcleo"
                  name="nucleo"
                  value={formValues.nucleo}
                  onChange={handleInputChange}
                  required
                  fullWidth
                  margin="normal"
                />

                <FormControl fullWidth margin="normal">
                  <InputLabel>Categoria</InputLabel>
                  <Select name="categoria" value={formValues.categoria} onChange={handleSelectChange} required>
                    {categorias.map((c, index) => (
                      <MenuItem key={`${c}-${index}`} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth margin="normal">
                  <InputLabel>Dia da Semana</InputLabel>
                  <Select name="diaDaSemana" value={formValues.diaDaSemana} onChange={handleSelectChange} required>
                    {['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'].map((dia, index) => (
                      <MenuItem key={`${dia}-${index}`} value={dia}>
                        {dia}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Horário"
                  name="horario"
                  value={formValues.horario}
                  onChange={handleInputChange}
                  required
                  fullWidth
                  margin="normal"
                />

                <TextField
                  type="number"
                  label="Capacidade Máxima"
                  name="capacidade_maxima_da_turma"
                  value={String(formValues.capacidade_maxima_da_turma)}
                  onChange={handleInputChange}
                  required
                  fullWidth
                  margin="normal"
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      name="isFeminina"
                      checked={!!formValues.isFeminina}
                      onChange={handleInputChange}
                    />
                  }
                  label="Turma Feminina (todas as idades)"
                  sx={{ color: 'black' }}
                />

                <FormControlLabel
                  control={<Checkbox checked={autoNome} onChange={(e) => handleAutoNomeToggle(e.target.checked)} />}
                  label="Gerar nome automaticamente"
                  sx={{ color: 'black' }}
                />

                {capacidadeInvalida && (
                  <Typography color="error" variant="body2">
                    A capacidade máxima não pode ser menor que o número atual de alunos ({selectedTurma.capacidade_atual_da_turma}).
                  </Typography>
                )}

                <TextField
                  label="Nome da Turma"
                  value={nomeTurma}
                  onChange={(e) => {
                    if (!autoNome) setNomeTurma(e.target.value);
                  }}
                  fullWidth
                  margin="normal"
                  disabled={autoNome}
                  helperText={
                    autoNome
                      ? 'Desmarque "Gerar nome automaticamente" para editar.'
                      : 'Digite o nome desejado.'
                  }
                />

                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={loading || capacidadeInvalida || !nomeTurma}
                >
                  Atualizar Turma
                </Button>
              </form>
            )}
          </TabPanel>

          <TabPanel value={tabIndex} index={2}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Modalidade</InputLabel>
              <Select
                value={selectedModalidade}
                onChange={(e) => {
                  setSelectedModalidade(e.target.value as string);
                  resetEditorState();
                }}
                required
              >
                {modalidades.map((m, index) => (
                  <MenuItem key={`${m.nome}-${index}`} value={m.nome}>
                    {m.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ my: 2 }} />

            <FormControl fullWidth margin="normal">
              <InputLabel>Turma</InputLabel>
              <Select value={selectedTurmaOption} onChange={handleTurmaSelectChange} required>
                {turmaOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.turma.nome_da_turma}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedTurma && (
              <Button variant="contained" color="secondary" onClick={handleDelete} disabled={loading}>
                {loading ? 'Aguarde, deletando turma' : 'Deletar Turma'}
              </Button>
            )}
          </TabPanel>

          <TabPanel value={tabIndex} index={3}>
            <MergeTurmasForm />
          </TabPanel>

          <Snackbar open={!!successMessage} autoHideDuration={6000} onClose={() => setSuccessMessage('')}>
            <Alert onClose={() => setSuccessMessage('')} severity="success" sx={{ width: '100%' }}>
              {successMessage}
            </Alert>
          </Snackbar>

          <Snackbar open={!!errorMessage} autoHideDuration={6000} onClose={() => setErrorMessage('')}>
            <Alert onClose={() => setErrorMessage('')} severity="error" sx={{ width: '100%' }}>
              {errorMessage}
            </Alert>
          </Snackbar>
        </Box>
      </Container>
    </Layout>
  );
}

export { ManageTurmas };