'use client';
import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
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
  SelectChangeEvent
} from '@mui/material';
import axios from 'axios';
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Modalidade, Turma } from '@/interface/interfaces';
import { useData } from '@/context/context';
import { BoxStyleCadastro } from '@/utils/Styles';
import Layout from '@/components/TopBarComponents/Layout';

function TabPanel(props: any) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3, bgcolor: 'background.paper' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function ManageTurmas() {
  const { fetchModalidades } = useData();
  const [tabIndex, setTabIndex] = useState(0);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [selectedModalidade, setSelectedModalidade] = useState<string>('');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  // Usamos undefined em vez de null para selectedTurma
  const [selectedTurma, setSelectedTurma] = useState<Turma | undefined>(undefined);
  const [formValues, setFormValues] = useState<Omit<Turma, 'uuidTurma' | 'nome_da_turma' | 'capacidade_atual_da_turma' | 'contadorAlunos' | 'alunos'>>({
    modalidade: '',
    nucleo: '',
    categoria: '',
    diaDaSemana: '',
    horario: '',
    capacidade_maxima_da_turma: 1
  });
  const [nomeTurma, setNomeTurma] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [capacidadeInvalida, setCapacidadeInvalida] = useState(false);

  const categorias = ['SUB07', 'SUB08', 'SUB09', 'SUB10', 'SUB11', 'SUB12', 'SUB13', 'SUB14', 'SUB15_17'];

  useEffect(() => {
    fetchModalidades().then((data) => {
      const validModalidades = data.filter(
        (mod) => mod.nome !== 'arquivados' && mod.nome !== 'excluidos',
      );
      setModalidades(validModalidades);
    });
  }, [fetchModalidades]);

  useEffect(() => {
    if (selectedModalidade) {
      const modalidadeEscolhida = modalidades.find(
        (modalidade) => modalidade.nome === selectedModalidade
      );
      setTurmas(modalidadeEscolhida ? modalidadeEscolhida.turmas : []);
    }
  }, [selectedModalidade, modalidades]);

  useEffect(() => {
    if (selectedTurma) {
      setCapacidadeInvalida(formValues.capacidade_maxima_da_turma < selectedTurma.capacidade_atual_da_turma);
    }
  }, [formValues.capacidade_maxima_da_turma, selectedTurma]);

  useEffect(() => {
    updateNomeTurma(formValues);
  }, [formValues]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updatedValues = {
      ...formValues,
      [name]: name === 'capacidade_maxima_da_turma' ? Number(value) : value,
    };
    setFormValues(updatedValues);
    updateNomeTurma(updatedValues);
  };

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    const updatedValues = {
      ...formValues,
      [name]: value,
    };
    setFormValues(updatedValues);
    updateNomeTurma(updatedValues);
  };

  const handleTurmaSelectChange = (event: SelectChangeEvent<string>) => {
    const uuid = event.target.value as string;
    const turma = turmas.find(t => t.uuidTurma === uuid);
    if (turma) {
      setSelectedTurma(turma);
      const updatedValues = {
        modalidade: turma.modalidade,
        nucleo: turma.nucleo,
        categoria: turma.categoria,
        diaDaSemana: turma.diaDaSemana,
        horario: turma.horario,
        capacidade_maxima_da_turma: turma.capacidade_maxima_da_turma
      };
      setFormValues(updatedValues);
      setNomeTurma(turma.nome_da_turma);
    } else {
      // Se não encontrar, garantimos que o estado fique como undefined
      setSelectedTurma(undefined);
    }
  };

  const updateNomeTurma = (values: typeof formValues) => {
    const { categoria, nucleo, diaDaSemana, horario } = values;
    const nome_da_turma = `${categoria}_${nucleo}_${diaDaSemana}_${horario}`;
    setNomeTurma(nome_da_turma);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (selectedTurma) {
        await axios.put('/api/HandleNewTurmas', { 
          uuidTurma: selectedTurma.uuidTurma, 
          nome_da_turma: nomeTurma, 
          capacidade_maxima_da_turma: formValues.capacidade_maxima_da_turma, 
          modalidade: selectedTurma.modalidade,
          nucleo: formValues.nucleo,
          categoria: formValues.categoria,
        });
        setSuccessMessage('Turma atualizada com sucesso!');
      } else {
        await axios.post('/api/HandleNewTurmas', { ...formValues, nome_da_turma: nomeTurma });
        setSuccessMessage('Turma criada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao realizar operação:', error);
    } finally {
      setLoading(false);
      setFormValues({
        modalidade: '',
        nucleo: '',
        categoria: '',
        diaDaSemana: '',
        horario: '',
        capacidade_maxima_da_turma: 1
      });
      setNomeTurma('');
      setSelectedTurma(undefined);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      if (selectedTurma && selectedTurma.uuidTurma) {
        await axios.delete('/api/HandleNewTurmas', { data: { uuidTurma: selectedTurma.uuidTurma, modalidade: selectedTurma.modalidade } });
        setSuccessMessage('Turma deletada com sucesso!');
        setTurmas(turmas.filter(t => t.uuidTurma !== selectedTurma.uuidTurma));
      }
    } catch (error) {
      console.error('Erro ao deletar turma:', error);
    } finally {
      setLoading(false);
      setFormValues({
        modalidade: '',
        nucleo: '',
        categoria: '',
        diaDaSemana: '',
        horario: '',
        capacidade_maxima_da_turma: 1
      });
      setNomeTurma('');
      setSelectedTurma(undefined);
    }
  };

  return (
    <Layout>
      <Container sx={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 0 }}>
        <Box sx={BoxStyleCadastro}>
          <AppBar position="static" sx={{ backgroundColor: '#2e3b55', mt: "10px" }}>
            <Tabs
              value={tabIndex}
              onChange={handleTabChange}
              variant="fullWidth"
              textColor="inherit"
              indicatorColor="secondary"
            >
              <Tab label="Criar Turma" />
              <Tab label="Atualizar Turma" />
              <Tab label="Excluir Turma" />
            </Tabs>
          </AppBar>
          <TabPanel value={tabIndex} index={0}>
            <form onSubmit={handleSubmit}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Modalidade</InputLabel>
                <Select name="modalidade" value={formValues.modalidade} onChange={handleSelectChange} required>
                  {modalidades.map((modalidade) => (
                    <MenuItem key={modalidade.nome} value={modalidade.nome}>
                      {modalidade.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Núcleo" name="nucleo" value={formValues.nucleo} onChange={handleInputChange} required fullWidth margin="normal" />
              <FormControl fullWidth margin="normal">
                <InputLabel>Categoria</InputLabel>
                <Select name="categoria" value={formValues.categoria} onChange={handleSelectChange} required>
                  {categorias.map((categoria) => (
                    <MenuItem key={categoria} value={categoria}>
                      {categoria}
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
              <TextField label="Horário" name="horario" value={formValues.horario} onChange={handleInputChange} required fullWidth margin="normal" />
              <TextField type="number" label="Capacidade Máxima" name="capacidade_maxima_da_turma" value={formValues.capacidade_maxima_da_turma.toString()} onChange={handleInputChange} required fullWidth margin="normal" />
              {capacidadeInvalida && (
                <Typography color="error" variant="body2">
                  A capacidade máxima não pode ser menor que o número atual de alunos ({selectedTurma?.capacidade_atual_da_turma}).
                </Typography>
              )}
              <TextField label="Nome da Turma" value={nomeTurma} onChange={() => {}} fullWidth margin="normal" disabled />
              <Button type="submit" variant="contained" color="primary" disabled={loading || capacidadeInvalida}>
                Criar Turma
              </Button>
            </form>
          </TabPanel>
          <TabPanel value={tabIndex} index={1}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Modalidade</InputLabel>
              <Select value={selectedModalidade} onChange={(e) => setSelectedModalidade(e.target.value as string)} required>
                {modalidades.map((modalidade) => (
                  <MenuItem key={modalidade.nome} value={modalidade.nome}>
                    {modalidade.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Divider sx={{ my: 2 }} />
            <FormControl fullWidth margin="normal">
              <InputLabel>Turma</InputLabel>
              <Select value={selectedTurma ? selectedTurma.uuidTurma : ''} onChange={handleTurmaSelectChange} required>
                {turmas.map((turma) => (
                  <MenuItem key={turma.uuidTurma} value={turma.uuidTurma}>
                    {turma.nome_da_turma}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedTurma && (
              <form onSubmit={handleSubmit}>
                <TextField label="Núcleo" name="nucleo" value={formValues.nucleo} onChange={handleInputChange} required fullWidth margin="normal" />
                <FormControl fullWidth margin="normal">
                  <InputLabel>Categoria</InputLabel>
                  <Select name="categoria" value={formValues.categoria} onChange={handleSelectChange} required>
                    {categorias.map((categoria) => (
                      <MenuItem key={categoria} value={categoria}>
                        {categoria}
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
                <TextField label="Horário" name="horario" value={formValues.horario} onChange={handleInputChange} required fullWidth margin="normal" />
                <TextField type="number" label="Capacidade Máxima" name="capacidade_maxima_da_turma" value={formValues.capacidade_maxima_da_turma.toString()} onChange={handleInputChange} required fullWidth margin="normal" />
                {capacidadeInvalida && (
                  <Typography color="error" variant="body2">
                    A capacidade máxima não pode ser menor que o número atual de alunos ({selectedTurma.capacidade_atual_da_turma}).
                  </Typography>
                )}
                <TextField label="Nome da Turma" value={nomeTurma} onChange={() => {}} fullWidth margin="normal" disabled />
                <Button type="submit" variant="contained" color="primary" disabled={loading || capacidadeInvalida}>
                  Atualizar Turma
                </Button>
              </form>
            )}
          </TabPanel>
          <TabPanel value={tabIndex} index={2}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Modalidade</InputLabel>
              <Select value={selectedModalidade} onChange={(e) => setSelectedModalidade(e.target.value as string)} required>
                {modalidades.map((modalidade) => (
                  <MenuItem key={modalidade.nome} value={modalidade.nome}>
                    {modalidade.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Divider sx={{ my: 2 }} />
            <FormControl fullWidth margin="normal">
              <InputLabel>Turma</InputLabel>
              <Select value={selectedTurma ? selectedTurma.uuidTurma : ''} onChange={handleTurmaSelectChange} required>
                {turmas.map((turma) => (
                  <MenuItem key={turma.uuidTurma} value={turma.uuidTurma}>
                    {turma.nome_da_turma}
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

function TabPanel(props: any) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3, bgcolor: 'background.paper' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export { ManageTurmas };
