/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// atualizado
'use client'
import {
  Modalidade,
  FormValuesStudent,
  ModalidadesData,
  AlunoPresencaUpdate,
  MoveStudentsPayload,
  IIAlunoUpdate,
  DeleteStudants,
  TemporaryMoveStudentsPayload,
  Turma,
  IIAvisos
} from '../interface/interfaces'
import axios from 'axios'
import React, {
  createContext,
  useState,
  ReactNode,
  useContext,
  useCallback,
} from 'react'
interface ChildrenProps {
  children: ReactNode
}

interface DataContextType {
  ContextData: FormValuesStudent[]
  sendDataToApi: (data: FormValuesStudent[]) => Promise<{ resultados: any[] }>
  updateDataInApi: (data: IIAlunoUpdate) => Promise<void>
  modalidades: Modalidade[] // Adicione esta linha
  fetchModalidades: (filtro?: string) => Promise<Modalidade[]> 
  fetchStudantsTableData: (filtro?: string, limit?: number, offset?: number) => Promise<Modalidade[]>
  updateAttendanceInApi: (data: AlunoPresencaUpdate) => Promise<void>
  moveStudentTemp: (payload: TemporaryMoveStudentsPayload) => Promise<void>
  copyStudentTemp: (payload: TemporaryMoveStudentsPayload) => Promise<void>
  updateUniformeInApi: (data: { modalidade: string; nomeDaTurma: string; alunoNome: string; hasUniforme: boolean }) => Promise<void>;
  deleteStudentFromApi:(payload: DeleteStudants) => Promise<void>
  avisoStudent: (payload: IIAvisos, method: 'POST' | 'PUT' | 'DELETE') => Promise<void>;
}

const DataContext = createContext<DataContextType>({
  ContextData: [],
  sendDataToApi: async (data: FormValuesStudent[]) => {
    // simplesmente retorne um objeto vazio ou dados mock
    return { resultados: [] }
  },
  updateDataInApi: async () => {},
  modalidades: [],
  fetchModalidades: async (filtro?: string): Promise<Modalidade[]> => {
   // simplesmente retorne um objeto vazio ou dados mock
    return []
  },
  fetchStudantsTableData: async () => [],
  updateAttendanceInApi: async (data: AlunoPresencaUpdate) => {},
  
  updateUniformeInApi: async (data: { modalidade: string; nomeDaTurma: string; alunoNome: string; hasUniforme: boolean }) => {
    console.warn('updateUniformeInApi not implemented', data);
  },
  deleteStudentFromApi: async (payload: DeleteStudants) => {
    console.warn('moveStudentInApi not implemented', payload)
  },
  moveStudentTemp: async (payload: TemporaryMoveStudentsPayload) => {
    console.warn('moveStudentInApi not implemented', payload)
  },
  copyStudentTemp: async (payload: TemporaryMoveStudentsPayload) => {
    console.warn('moveStudentInApi not implemented', payload)
  },
  avisoStudent: async (payload: IIAvisos) => {
    console.warn('moveStudentInApi not implemented', payload)
  },

})

const useData = () => {
  const context = useContext(DataContext)
  return context
}

const DataProvider: React.FC<ChildrenProps> = ({ children }) => {
  const [DataStudents, setDataStudents] = useState<FormValuesStudent[]>([])
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [dataTable, setdataTable] = useState<Modalidade[]>([])
  /// api/GetDataFirebase
  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


  // função para buscar dados para a tabela de forma otimizada
  const fetchStudantsTableData = useCallback(async (filtro?: string, limit: number = 10, offset: number = 0): Promise<Modalidade[]> => {
    try {
      const url = filtro
        ? `/api/GetStudantTableData?modalidade=${filtro}&limit=${limit}&offset=${offset}`
        : `/api/GetStudantTableData?limit=${limit}&offset=${offset}`
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (!response.ok) throw new Error('Falha ao buscar modalidades')
      const data: ModalidadesData = await response.json()
      // Convertendo o objeto data para um array de modalidades
      const modalidadesArray: Modalidade[] = Object.entries(data).map(
        ([nome, valor]) => ({
          nome,
          turmas: (valor as any).turmas as Turma[] // Definindo explicitamente o tipo de valor como Turma[]
        })
      )
      setdataTable(modalidadesArray)
      return modalidadesArray
    } catch (error) {
      console.error('Erro ao buscar modalidades:', error)
      return []
    }
  }, [])




  // buscar dados da api
  // Atualizar a função fetchModalidades para aceitar um parâmetro de filtro

  const fetchModalidades = useCallback(
    async (filtro?: string): Promise<Modalidade[]> => {
      try {
        const url = filtro
          ? `/api/GetDataFirebase?modalidade=${filtro}`
          : '/api/GetDataFirebase'
        const response = await fetch(url)
        if (!response.ok) throw new Error('Falha ao buscar modalidades')
        const data: ModalidadesData = await response.json()
        // Convertendo o objeto data para um array de modalidades
        const modalidadesArray: Modalidade[] = Object.entries(data).map(
          ([nome, valor]) => ({
            nome,
            turmas: valor.turmas,
          }),
        )
        setModalidades(modalidadesArray) // Atualiza o estado com todas as modalidades se necessário
        return modalidadesArray // Retorna as modalidades filtradas
      } catch (error) {
        console.error('Erro ao buscar modalidades:', error)
        return [] // Retorna um array vazia em caso de erro
      }
    },
    [],
  )

  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // cadastrar novo estudante
  
  const sendDataToApi = async (
    data: FormValuesStudent[],
  ): Promise<{ resultados: any[] }> => {
    try {
      const responses = await Promise.all(
        data.map((aluno) => axios.post('/api/SubmitFormRegistration', aluno)),
      )
      const combinedResults = responses.flatMap(
        (response) => response.data.resultados,
      )

      return { resultados: combinedResults }
    } catch (error) {
      console.error('Ocorreu um erro ao enviar dados para a API:', error)
      throw new Error('Falha ao enviar dados para a API.')
    }
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // Atualizar informações do estudante em todas as turmas em que ele está inscrito
  const updateDataInApi = async (data: IIAlunoUpdate) => {
  // Garante que o identificador único esteja presente
  if (!data.informacoesAdicionais.IdentificadorUnico) {
    console.error("IdentificadorUnico não encontrado no aluno selecionado.");
    return;
  }

  const payload = {
    identificadorUnico: data.informacoesAdicionais.IdentificadorUnico, // chave usada na API
    novosDados: {
      anoNascimento: data.anoNascimento,
      telefoneComWhatsapp: data.telefoneComWhatsapp,
      nome: data.nome,
      informacoesAdicionais: data.informacoesAdicionais,
      foto: data.foto,
    },
  };

  try {
    const response = await fetch('/api/updateStudent', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Erro ao atualizar informações do aluno em todas as turmas:', error);
  }
};


  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  // atualizar presenças do estudante
  const updateAttendanceInApi = async (data: AlunoPresencaUpdate) => {
    try {
     
      const payload = {
        modalidade: data.modalidade,
        nomeDaTurma: data.nomeDaTurma,
        alunoNome: data.nome, 
        presencas: data.presencas,
      }

     
      const response = await fetch('/api/updateAttendance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Falha ao atualizar dados de presença')
      }

     
    } catch (error) {
      console.error('Erro ao atualizar presença:', error)
    }
  }
  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

//Mover aluno de turma

const moveStudentTemp = async (payload:TemporaryMoveStudentsPayload ) => {
  try {
    const response = await fetch('/api/moveTempStudents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Falha ao mover aluno');
    }

    // Assumindo que a API cuida de tudo e apenas retorna sucesso/falha
    alert("Aluno movido com sucesso!");
  } catch (error:any) {
    console.error('Erro ao mover aluno:', error);
    alert("Erro ao mover aluno: " + error.message);
  }
}
//--------------------------------------------------------------------------
//função para copiar o aluno de uma turma para outra
const copyStudentTemp = async (payload:TemporaryMoveStudentsPayload ) => {
  try {
    const response = await fetch('/api/CopyStudant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Falha ao mover aluno');
    }

    // Assumindo que a API cuida de tudo e apenas retorna sucesso/falha
    alert("Aluno movido com sucesso!");
  } catch (error:any) {
    console.error('Erro ao mover aluno:', error);
    alert("Erro ao mover aluno: " + error.message);
  }
}

//----------- função para colocar aviso.

const avisoStudent = async (payload: IIAvisos, method: 'POST' | 'PUT' | 'DELETE' = 'POST') => {
  try {
    const response = await fetch('/api/ApiAvisos', {
      method: method, // Usando o método passado como parâmetro
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Falha ao manipular aviso');
    }

    alert(`Aviso ${method === 'DELETE' ? 'deletado' : 'processado'} com sucesso!`);
  } catch (error: any) {
    console.error('Erro ao manipular aviso:', error);
    alert(`Erro ao manipular aviso: ${error.message}`);
  }
}






//----------------------------------------------------------------------------
// Função para excluir um estudante
// No contexto (DataContext)

async function deleteStudentFromApi(data: { alunoId: string; modalidade: string; nomeDaTurma: string; }) {
  if (!data.alunoId || !data.modalidade || !data.nomeDaTurma) {
    throw new Error('Dados incompletos para excluir o aluno.');
  }

  const response = await fetch('/api/deleteStudent', {
    method: 'POST', // Alterado para POST
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao excluir o aluno.');
  }

  return response.json();
}




  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  
  
  //Atulizar Campo de uniforme
  const updateUniformeInApi = async (data: { modalidade: string; nomeDaTurma: string; alunoNome: string; hasUniforme: boolean }) => {
    try {
      // Constrói o corpo da requisição com os dados recebidos
      const payload = {
        modalidade: data.modalidade,
        nomeDaTurma: data.nomeDaTurma,
        alunoNome: data.alunoNome,
        hasUniforme: data.hasUniforme,
      };
  
      // Faz a chamada para a API
      const response = await fetch('/api/updateUniforme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.log( response)
        throw new Error(errorData.error || 'Falha ao atualizar o status do uniforme');
      }
  
     
      console.log('Status do uniforme atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar o status do uniforme:', error);
    }
  };
  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  return (
    <DataContext.Provider
      value={{
        ContextData: DataStudents,
        sendDataToApi,
        updateDataInApi,
        modalidades,
        fetchModalidades,
        fetchStudantsTableData,
        updateAttendanceInApi,
        updateUniformeInApi,
        deleteStudentFromApi, 
        moveStudentTemp,
        copyStudentTemp,
        avisoStudent 
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export { DataContext, DataProvider, useData }
