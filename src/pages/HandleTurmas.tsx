'use client';

import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from 'react';
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

const INITIAL_FORM_VALUES: EditableTurmaFields = {
  modalidade: '',
  nucleo: '',
  categoria: '',
  diaDaSemana: '',
  horario: '',
  capacidade_maxima_da_turma: 1,
  isFeminina: false,
};

export default function ManageTurmas() {
  const { fetchModalidades } = useData();

  const [tabIndex, setTabIndex] = useState(0);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [selectedModalidade, setSelectedModalidade] = useState<string>('');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<Turma | undefined>(undefined);

  const [formValues, setFormValues] = useState<EditableTurmaFields>(INITIAL_FORM_VALUES);

  const [nomeTurma, setNomeTurma] = useState<string>('');
  const [autoNome, setAutoNome] = useState<boolean>(true);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
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
      'SUB07_SUB09',
      'SUB09_SUB11',
      'SUB13_SUB15',
    ],
    []
  );

  useEffect(() => {
    fetchModalidades().then((data) => {
      const valid = data.filter((m) => m.nome !== 'arquivados' && m.nome !== 'excluidos');
      setModalidades(valid);
    });
  }, [fetchModalidades]);

  useEffect(() => {
    if (!selectedModalidade) {
      setTurmas([]);
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
    setCapacidadeInvalida(formValues.capacidade_maxima_da_turma < selectedTurma.capacidade_atual_da_turma);
  }, [formValues.capacidade_maxima_da_turma, selectedTurma]);

  const buildNomeTurma = (values: EditableTurmaFields) => {
    const { categoria, nucleo, diaDaSemana, horario, isFeminina } = values;

    // Evita "____" quando o usuário ainda não preencheu tudo
    const parts = [categoria, nucleo, diaDaSemana, horario].filter(Boolean);
    const base = parts.join('_');

    if (!base) return '';
    return isFeminina ? `${base} - FEMININO` : base;
  };

  const applyAutoNomeIfEnabled = (values: EditableTurmaFields) => {
    if (!autoNome) return;
    setNomeTurma(buildNomeTurma(values));
  };

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
    const uuid = event.target.value as string;
    const turma = turmas.find((t) => t.uuidTurma === uuid);

    if (!turma) {
      setSelectedTurma(undefined);
      setFormValues(INITIAL_FORM_VALUES);
      setNomeTurma('');
      setAutoNome(true);
      return;
    }

    setSelectedTurma(turma);

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

    // ✅ Para atualizar, default é permitir editar o nome existente
    setAutoNome(false);
    setNomeTurma(turma.nome_da_turma);
  };

  const handleAutoNomeToggle = (checked: boolean) => {
    setAutoNome(checked);
    if (checked) {
      // Recalcula imediatamente quando ligar
      setNomeTurma(buildNomeTurma(formValues));
    }
  };

   const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (selectedTurma) {
        await axios.put('/api/HandleNewTurmas', {
          uuidTurma: selectedTurma.uuidTurma,
          modalidade: selectedTurma.modalidade,

          nucleo: formValues.nucleo,
          categoria: formValues.categoria,
          diaDaSemana: formValues.diaDaSemana,
          horario: formValues.horario,
          capacidade_maxima_da_turma: formValues.capacidade_maxima_da_turma,
          isFeminina: formValues.isFeminina,

          ...(autoNome ? {} : { nome_da_turma: nomeTurma }),
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
        setSuccessMessage('Turma criada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao realizar operação:', error);
    } finally {
      setLoading(false);
      setFormValues(INITIAL_FORM_VALUES);
      setNomeTurma('');
      setSelectedTurma(undefined);
      setAutoNome(true);
    }
  };

  const handleDelete = async () => {
    setLoading(true);

    try {
      if (selectedTurma && selectedTurma.uuidTurma) {
        await axios.delete('/api/HandleNewTurmas', {
          data: { uuidTurma: selectedTurma.uuidTurma, modalidade: selectedTurma.modalidade },
        });
        setSuccessMessage('Turma deletada com sucesso!');
        setTurmas((prev) => prev.filter((t) => t.uuidTurma !== selectedTurma.uuidTurma));
      }
    } catch (error) {
      console.error('Erro ao deletar turma:', error);
    } finally {
      setLoading(false);
      setFormValues(INITIAL_FORM_VALUES);
      setNomeTurma('');
      setSelectedTurma(undefined);
      setAutoNome(true);
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

          {/* CRIAR TURMA */}
          <TabPanel value={tabIndex} index={0}>
            <form onSubmit={handleSubmit}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Modalidade</InputLabel>
                <Select name="modalidade" value={formValues.modalidade} onChange={handleSelectChange} required>
                  {modalidades.map((m) => (
                    <MenuItem key={m.nome} value={m.nome}>
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
                  {categorias.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>Dia da Semana</InputLabel>
                <Select name="diaDaSemana" value={formValues.diaDaSemana} onChange={handleSelectChange} required>
                  {['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'].map((dia) => (
                    <MenuItem key={dia} value={dia}>
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
                control={
                  <Checkbox
                    checked={autoNome}
                    onChange={(e) => handleAutoNomeToggle(e.target.checked)}
                  />
                }
                label="Gerar nome automaticamente"
                sx={{ color: 'black' }}
              />

              {capacidadeInvalida && (
                <Typography color="error" variant="body2">
                  A capacidade máxima não pode ser menor que o número atual de alunos (
                  {selectedTurma?.capacidade_atual_da_turma}).
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
                helperText={autoNome ? 'Desmarque "Gerar nome automaticamente" para editar.' : 'Digite o nome desejado.'}
              />

              <Button type="submit" variant="contained" color="primary" disabled={loading || capacidadeInvalida || !nomeTurma}>
                Criar Turma
              </Button>
            </form>
          </TabPanel>

          {/* ATUALIZAR TURMA */}
          <TabPanel value={tabIndex} index={1}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Modalidade</InputLabel>
              <Select
                value={selectedModalidade}
                onChange={(e) => setSelectedModalidade(e.target.value as string)}
                required
              >
                {modalidades.map((m) => (
                  <MenuItem key={m.nome} value={m.nome}>
                    {m.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ my: 2 }} />

            <FormControl fullWidth margin="normal">
              <InputLabel>Turma</InputLabel>
              <Select value={selectedTurma ? selectedTurma.uuidTurma : ''} onChange={handleTurmaSelectChange} required>
                {turmas.map((t) => (
                  <MenuItem key={t.uuidTurma} value={t.uuidTurma}>
                    {t.nome_da_turma}
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
                    {categorias.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth margin="normal">
                  <InputLabel>Dia da Semana</InputLabel>
                  <Select name="diaDaSemana" value={formValues.diaDaSemana} onChange={handleSelectChange} required>
                    {['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'].map((dia) => (
                      <MenuItem key={dia} value={dia}>
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
                  control={
                    <Checkbox
                      checked={autoNome}
                      onChange={(e) => handleAutoNomeToggle(e.target.checked)}
                    />
                  }
                  label="Gerar nome automaticamente"
                  sx={{ color: 'black' }}
                />

                {capacidadeInvalida && (
                  <Typography color="error" variant="body2">
                    A capacidade máxima não pode ser menor que o número atual de alunos (
                    {selectedTurma.capacidade_atual_da_turma}).
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
                  helperText={autoNome ? 'Desmarque "Gerar nome automaticamente" para editar.' : 'Digite o nome desejado.'}
                />

                <Button type="submit" variant="contained" color="primary" disabled={loading || capacidadeInvalida || !nomeTurma}>
                  Atualizar Turma
                </Button>
              </form>
            )}
          </TabPanel>

          {/* EXCLUIR TURMA */}
          <TabPanel value={tabIndex} index={2}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Modalidade</InputLabel>
              <Select
                value={selectedModalidade}
                onChange={(e) => setSelectedModalidade(e.target.value as string)}
                required
              >
                {modalidades.map((m) => (
                  <MenuItem key={m.nome} value={m.nome}>
                    {m.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ my: 2 }} />

            <FormControl fullWidth margin="normal">
              <InputLabel>Turma</InputLabel>
              <Select value={selectedTurma ? selectedTurma.uuidTurma : ''} onChange={handleTurmaSelectChange} required>
                {turmas.map((t) => (
                  <MenuItem key={t.uuidTurma} value={t.uuidTurma}>
                    {t.nome_da_turma}
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

          {/* MESCLAR TURMAS */}
          <TabPanel value={tabIndex} index={3}>
            <MergeTurmasForm />
          </TabPanel>

          <Snackbar open={!!successMessage} autoHideDuration={6000} onClose={() => setSuccessMessage('')}>
            <Alert onClose={() => setSuccessMessage('')} severity="success" sx={{ width: '100%' }}>
              {successMessage}
            </Alert>
          </Snackbar>
        </Box>
      </Container>
    </Layout>
  );
}

export { ManageTurmas };