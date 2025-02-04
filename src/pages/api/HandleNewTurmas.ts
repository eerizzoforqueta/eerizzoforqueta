// src/pages/api/HandleNewTurmas.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../config/firebaseAdmin';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const database = admin.database();

// Esquema de validação para exclusão de turma utilizando Zod
const deleteTurmaSchema = z.object({
  modalidade: z.string().min(1, { message: 'A modalidade é obrigatória.' }),
  uuidTurma: z.string().uuid({ message: 'O uuidTurma deve ser um UUID válido.' })
});

// Função handler que direciona a requisição de acordo com o método HTTP
export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  switch (request.method) {
    case 'POST':
      return handlePost(request, response);
    case 'PUT':
      return handlePut(request, response);
    case 'DELETE':
      return handleDelete(request, response);
    default:
      response.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
      return response.status(405).end('Method Not Allowed');
  }
}

// Função para criar uma nova turma (método POST)
async function handlePost(request: NextApiRequest, response: NextApiResponse) {
  try {
    // Extraindo e validando os dados da requisição (aqui assumimos que os dados já estão válidos)
    const newClassData = request.body;
    const { modalidade, nucleo, categoria, capacidade_maxima_da_turma, diaDaSemana, horario } = newClassData;
    
    // Cria o nome da turma com base na categoria, núcleo, dia da semana e horário
    const className = `${categoria}_${nucleo}_${diaDaSemana}_${horario}`;
    
    // Gera um identificador único para a turma
    const uuidDaTurma = uuidv4();
    
    // Obtém a referência para as turmas da modalidade informada
    const modalidadeReference = database.ref(`modalidades/${modalidade}/turmas`);
    const modalidadeSnapshot = await modalidadeReference.once('value');
    
    // Determina o novo índice da turma com base na quantidade de turmas existentes
    const newClassIndex = modalidadeSnapshot.exists() ? modalidadeSnapshot.numChildren() : 0;
    
    // Cria o objeto da nova turma com os dados informados
    const newClass = {
      nome_da_turma: className,
      modalidade: modalidade,
      nucleo: nucleo,
      categoria: categoria,
      capacidade_maxima_da_turma: capacidade_maxima_da_turma,
      capacidade_atual_da_turma: 0,
      alunos: [],
      uuidTurma: uuidDaTurma,
      contadorAlunos: 0
    };
    
    // Adiciona a nova turma na próxima posição disponível
    await modalidadeReference.child(newClassIndex.toString()).set(newClass);
    
    return response.status(200).json({ message: 'Turma adicionada com sucesso', turma: newClass });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    return response.status(500).json({ message: 'Erro no servidor' });
  }
}

// Função para atualizar os dados de uma turma (método PUT)
async function handlePut(request: NextApiRequest, response: NextApiResponse) {
  try {
    // Define um esquema de validação parcial para atualização
    const updateClassSchema = z.object({
      uuidTurma: z.string().uuid(),
      modalidade: z.string().min(1),
      nome_da_turma: z.string().min(1),
      capacidade_maxima_da_turma: z.number().min(1),
      nucleo: z.string().min(1),
      categoria: z.string().min(1)
    });
    const updateClassData = updateClassSchema.parse(request.body);
    const { uuidTurma, modalidade, nome_da_turma, capacidade_maxima_da_turma, nucleo, categoria } = updateClassData;
    
    // Procura a turma a ser atualizada usando o uuidTurma
    const classReference = database.ref(`modalidades/${modalidade}/turmas`)
      .orderByChild('uuidTurma')
      .equalTo(uuidTurma);
    const snapshot = await classReference.once('value');
    
    if (!snapshot.exists()) {
      return response.status(404).json({ message: 'Turma não encontrada' });
    }
    
    // Obtém a chave da turma encontrada
    const classKey = Object.keys(snapshot.val())[0];
    
    // Atualiza os campos desejados da turma
    await database.ref(`modalidades/${modalidade}/turmas/${classKey}`).update({
      nome_da_turma: nome_da_turma,
      capacidade_maxima_da_turma: capacidade_maxima_da_turma,
      nucleo: nucleo,
      categoria: categoria
    });
    
    return response.status(200).json({ message: 'Turma atualizada com sucesso' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    return response.status(500).json({ message: 'Erro no servidor' });
  }
}

// Função para excluir uma turma (método DELETE)
// Em vez de remover o item diretamente, a função filtra o array de turmas e regrava o array sem buracos.
async function handleDelete(request: NextApiRequest, response: NextApiResponse) {
  try {
    // Valida os dados recebidos para exclusão
    const { modalidade, uuidTurma } = deleteTurmaSchema.parse(request.body);
    
    // Obtém a referência para todas as turmas da modalidade
    const turmasReference = database.ref(`modalidades/${modalidade}/turmas`);
    const snapshot = await turmasReference.once('value');
    
    if (!snapshot.exists()) {
      return response.status(404).json({ message: 'Nenhuma turma encontrada para esta modalidade' });
    }
    
    // Converte os dados obtidos para um array, tratando tanto arrays quanto objetos
    const turmasData = snapshot.val();
    let arrayDeTurmas: any[] = Array.isArray(turmasData) ? turmasData : Object.values(turmasData);
    
    // Cria um novo array filtrando a turma com o uuidTurma especificado e removendo itens nulos
    const novoArrayDeTurmas = arrayDeTurmas.filter((turma) => {
      if (!turma) {
        return false;
      }
      return turma.uuidTurma !== uuidTurma;
    });
    
    // Regrava o array atualizado no banco de dados
    await turmasReference.set(novoArrayDeTurmas);
    
    return response.status(200).json({ message: 'Turma excluída com sucesso' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Erro ao remover turma:', error);
    return response.status(500).json({ message: 'Erro no servidor' });
  }
}
