/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
  IIAvisos,
  ArchiveAluno
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

type SubmitApiResultado = {
  sucesso: boolean
  erro?: string
  aluno?: unknown
}

interface DataContextType {
  ContextData: FormValuesStudent[]
  sendDataToApi: (data: FormValuesStudent[]) => Promise<{ resultados: SubmitApiResultado[] }>
  updateDataInApi: (data: IIAlunoUpdate) => Promise<void>
  modalidades: Modalidade[]
  fetchModalidades: (filtro?: string) => Promise<Modalidade[]>
  fetchStudantsTableData: (filtro?: string, limit?: number, offset?: number) => Promise<Modalidade[]>
  updateAttendanceInApi: (data: AlunoPresencaUpdate) => Promise<void>
  moveStudentTemp: (payload: TemporaryMoveStudentsPayload) => Promise<void>
  copyStudentTemp: (payload: TemporaryMoveStudentsPayload) => Promise<void>
  updateUniformeInApi: (data: { modalidade: string; nomeDaTurma: string; alunoNome: string; hasUniforme: boolean }) => Promise<void>
  deleteStudentFromApi: (payload: DeleteStudants) => Promise<void>
  archiveAndDeleteStudent: (aluno: ArchiveAluno) => Promise<void>
  avisoStudent: (payload: IIAvisos, method: 'POST' | 'PUT' | 'DELETE') => Promise<void>
}

const DataContext = createContext<DataContextType>({
  ContextData: [],
  sendDataToApi: async () => ({ resultados: [] }),
  updateDataInApi: async () => {},
  modalidades: [],
  fetchModalidades: async (): Promise<Modalidade[]> => [],
  fetchStudantsTableData: async () => [],
  updateAttendanceInApi: async () => {},
  updateUniformeInApi: async (data) => {
    console.warn('updateUniformeInApi not implemented', data)
  },
  deleteStudentFromApi: async (payload) => {
    console.warn('deleteStudentFromApi not implemented', payload)
  },
  moveStudentTemp: async (payload) => {
    console.warn('moveStudentTemp not implemented', payload)
  },
  copyStudentTemp: async (payload) => {
    console.warn('copyStudentTemp not implemented', payload)
  },
  avisoStudent: async (payload) => {
    console.warn('avisoStudent not implemented', payload)
  },
  archiveAndDeleteStudent: async () => {}
})

const useData = () => {
  const context = useContext(DataContext)
  return context
}

const DataProvider: React.FC<ChildrenProps> = ({ children }) => {
  const [DataStudents, setDataStudents] = useState<FormValuesStudent[]>([])
  const [modalidades, setModalidades] = useState<Modalidade[]>([])
  const [dataTable, setdataTable] = useState<Modalidade[]>([])

  const fetchStudantsTableData = useCallback(
    async (filtro?: string, limit: number = 10, offset: number = 0): Promise<Modalidade[]> => {
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

        const modalidadesArray: Modalidade[] = Object.entries(data).map(
          ([nome, valor]) => ({
            nome,
            turmas: (valor as any).turmas as Turma[]
          })
        )

        setdataTable(modalidadesArray)
        return modalidadesArray
      } catch (error) {
        console.error('Erro ao buscar modalidades:', error)
        return []
      }
    },
    []
  )

  const fetchModalidades = useCallback(
    async (filtro?: string): Promise<Modalidade[]> => {
      try {
        const url = filtro
          ? `/api/GetDataFirebase?modalidade=${filtro}`
          : '/api/GetDataFirebase'

        const response = await fetch(url)

        if (!response.ok) throw new Error('Falha ao buscar modalidades')

        const data: ModalidadesData = await response.json()

        const modalidadesArray: Modalidade[] = Object.entries(data).map(
          ([nome, valor]) => ({
            nome,
            turmas: valor.turmas,
          }),
        )

        setModalidades(modalidadesArray)
        return modalidadesArray
      } catch (error) {
        console.error('Erro ao buscar modalidades:', error)
        return []
      }
    },
    [],
  )

  const sendDataToApi = useCallback(
    async (data: FormValuesStudent[]): Promise<{ resultados: SubmitApiResultado[] }> => {
      try {
        const payload = Array.isArray(data) ? data : [data]

        const response = await axios.post<{ resultados: SubmitApiResultado[] }>(
          '/api/SubmitFormRegistration',
          payload,
          {
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )

        return {
          resultados: Array.isArray(response.data?.resultados)
            ? response.data.resultados
            : [],
        }
      } catch (error) {
        console.error('Ocorreu um erro ao enviar dados para a API:', error)
        throw new Error('Falha ao enviar dados para a API.')
      }
    },
    []
  )

  const updateDataInApi = async (data: IIAlunoUpdate) => {
    if (!data.informacoesAdicionais.IdentificadorUnico) {
      console.error("IdentificadorUnico não encontrado no aluno selecionado.")
      return
    }

    const payload = {
      identificadorUnico: data.informacoesAdicionais.IdentificadorUnico,
      novosDados: {
        anoNascimento: data.anoNascimento,
        telefoneComWhatsapp: data.telefoneComWhatsapp,
        nome: data.nome,
        informacoesAdicionais: data.informacoesAdicionais,
        foto: data.foto,
      },
    }

    try {
      const response = await fetch('/api/updateStudent', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } catch (error) {
      console.error('Erro ao atualizar informações do aluno em todas as turmas:', error)
    }
  }

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

  const moveStudentTemp = async (payload: TemporaryMoveStudentsPayload) => {
    try {
      const response = await fetch('/api/moveTempStudents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Falha ao mover aluno')
      }

      alert("Aluno movido com sucesso!")
    } catch (error: any) {
      console.error('Erro ao mover aluno:', error)
      alert("Erro ao mover aluno: " + error.message)
    }
  }

  const copyStudentTemp = async (payload: TemporaryMoveStudentsPayload) => {
    try {
      const response = await fetch('/api/CopyStudant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Falha ao mover aluno')
      }

      alert("Aluno movido com sucesso!")
    } catch (error: any) {
      console.error('Erro ao mover aluno:', error)
      alert("Erro ao mover aluno: " + error.message)
    }
  }

  const avisoStudent = async (
    payload: IIAvisos,
    method: 'POST' | 'PUT' | 'DELETE' = 'POST'
  ) => {
    try {
      const response = await fetch('/api/ApiAvisos', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Falha ao manipular aviso')
      }

      alert(`Aviso ${method === 'DELETE' ? 'deletado' : 'processado'} com sucesso!`)
    } catch (error: any) {
      console.error('Erro ao manipular aviso:', error)
      alert(`Erro ao manipular aviso: ${error.message}`)
    }
  }

  async function deleteStudentFromApi(data: {
    alunoId: string
    modalidade: string
    nomeDaTurma: string
  }) {
    if (!data.alunoId || !data.modalidade || !data.nomeDaTurma) {
      throw new Error('Dados incompletos para excluir o aluno.')
    }

    const response = await fetch('/api/DeleteStudents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Erro ao excluir o aluno.')
    }

    return response.json()
  }

  const archiveAndDeleteStudent = async (aluno: ArchiveAluno) => {
    const response = await fetch('/api/ArquivarAlunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aluno),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || data?.status !== 'Success') {
      throw new Error(data?.message || 'Falha ao arquivar/deletar o aluno.')
    }
  }

  const updateUniformeInApi = async (data: {
    modalidade: string
    nomeDaTurma: string
    alunoNome: string
    hasUniforme: boolean
  }) => {
    try {
      const payload = {
        modalidade: data.modalidade,
        nomeDaTurma: data.nomeDaTurma,
        alunoNome: data.alunoNome,
        hasUniforme: data.hasUniforme,
      }

      const response = await fetch('/api/updateUniforme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Falha ao atualizar o status do uniforme')
      }

      console.log('Status do uniforme atualizado com sucesso')
    } catch (error) {
      console.error('Erro ao atualizar o status do uniforme:', error)
    }
  }

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
        avisoStudent,
        archiveAndDeleteStudent,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export { DataContext, DataProvider, useData }