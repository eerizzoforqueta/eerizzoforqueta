import { anoNascimentoSchema } from '@/utils/Constants'
import { Key } from 'react'
import { z } from 'zod'
// Definindo schema para os campos do formulario de registro

// Esquema para Endereço
const enderecoSchema = z.object({
  ruaAvenida: z
    .string()
    .min(5, { message: 'A rua deve ter pelo menos 5 caracteres.' })
    .transform((str) => str.trim()),
  numeroResidencia: z.union([
    z.string().min(1, { message: 'O número obrigatório' }),
    z.number().min(1, { message: 'O número obrigatório' }),
  ]),
  bairro: z
    .string()
    .min(3, { message: 'O bairro deve ter pelo menos 3 caracteres.' })
    .transform((str) => str.trim()),
  cep: z.union([
    z.string().min(8, { message: 'O CEP deve ter pelo menos 8 dígitos.' }),
    z.number().min(8, { message: 'O CEP deve ter pelo menos 8 dígitos.' }),
  ]),
  complemento: z.string().optional(),
})

// Esquema para Pagador de Mensalidades
const pagadorMensalidadesSchema = z.object({
  nomeCompleto: z
    .string()
    .min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' })
    .transform((str) => str.trim()),
  cpf: z.union([
    z
      .string()
      .min(11, { message: 'O CPF deve ter conter 11 dígitos.' })
      .transform((str) => str.trim()),
    z.number().min(11, { message: 'O CPF deve ter conter 11 dígitos.' }),
  ]),
  email: z
    .string()
    .email({ message: 'E-mail invalido' })
    .transform((str) => str.trim()),
  celularWhatsapp: z.union([
    z.string().min(11, { message: 'O telefone deve conter 11 dígitos.' }),
    z.number().min(11, { message: 'O telefone deve conter 11 dígitos.' }),
  ]),
})

// Esquema para Informações Adicionais, completo com todos os campos
const informacoesAdicionaisSchema = z.object({
  endereco: enderecoSchema,
  pagadorMensalidades: pagadorMensalidadesSchema,
  cobramensalidade: z.string().optional(),
  escolaEstuda: z.string().optional(),
  irmaos: z.string().min(3, { message: 'Escreva (sim) ou (não)' }),
  problemasaude: z.string().optional(),
  tipomedicacao: z.string().optional(),
  convenio: z.string().optional(),
  competicao: z.string().min(3, { message: 'Escreva (sim) ou (não)' }),
  imagem: z.string(),
  rg: z
    .string()
    .min(5, { message: 'O RG deve conter no mínimo 5 números' })
    .transform((str) => str.trim()),
  filhofuncionarioJBS: z
    .string()
    .min(3, { message: 'Escreva (sim) ou (não)' })
    .transform((str) => str.trim()),
  socioJBS: z
    .string()
    .min(3, { message: 'Escreva (sim) ou (não)' })
    .transform((str) => str.trim()),
  nomefuncionarioJBS: z
    .string()
    .min(3, { message: 'Escreva o nome do funcionário' })
    .transform((str) => str.trim()),
  filhofuncionariomarcopolo: z
    .string()
    .min(3, { message: 'Escreva (sim) ou (não)' })
    .transform((str) => str.trim()),
  nomefuncionariomarcopolo: z
    .string()
    .min(3, { message: 'Escreva o nome do funcionário' })
    .transform((str) => str.trim()),
  uniforme: z.string(),
})

// Esquema para Aluno, agora incluindo todos os campos
const alunoSchema = z.object({
  informacoesAdicionais: informacoesAdicionaisSchema, // Assumindo que este esquema já foi definido
  nome: z
    .string()
    .min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' })
    .transform((str) => str.trim()), // Transformação aplicada aqui
  anoNascimento: anoNascimentoSchema,
  telefoneComWhatsapp: z.union([
    z.string().min(11, { message: 'O telefone deve conter 11 dígitos.' }),
    z.number().min(11, { message: 'O telefone deve conter 11 dígitos.' }),
  ]),
})

// Esquema para FormValuesStudent, ajustado para a estrutura completa
export const formValuesStudentSchema = z.object({
  aluno: alunoSchema,
  modalidade: z.string(),
  turmaSelecionada: z.string(),
  // nucleoSelecionado: z.string()
})

// Definindo interfaces para os tipos de dados
interface Endereco {
  ruaAvenida: string
  numeroResidencia: number | string
  bairro: string
  cep: number | string
  complemento: string
}

interface PagadorMensalidades {
  nomeCompleto: string
  cpf: number | string
  email: string
  celularWhatsapp: number | string
}

export interface InformacoesAdicionais {
  endereco: Endereco
  pagadorMensalidades: PagadorMensalidades
  cobramensalidade: string
  escolaEstuda: string
  irmaos: string
  saude?: string
  problemasaude: string
  medicacao?: string
  tipomedicacao: string
  convenio: string
  nucleoTreinamento: string
  competicao: string
  comprometimentoMensalidade: string
  copiaDocumento: string
  imagem: string
  avisaAusencia: string
  desconto: string
  rg: string
  filhofuncionarioJBS: string
  socioJBS: string
  nomefuncionarioJBS: string
  filhofuncionariomarcopolo: string
  nomefuncionariomarcopolo: string
  uniforme: string
  hasUniforme?:boolean
  IdentificadorUnico?:string
}

export interface IIAvisos {
  alunoNome: string;
  modalidade: string;
  nomeDaTurma: string;
  textaviso: string;
  dataaviso: string; // Alterado de Date para string
  IsActive: boolean;
}


export interface Aluno {
  id: number
  informacoesAdicionais: InformacoesAdicionais
  nome: string
  anoNascimento: string
  telefoneComWhatsapp: number | string
  presencas: Record<string, Record<string, boolean>>
  foto?: string
  dataMatricula?: string
  avisos?:IIAvisos
}

export interface Turma {
  nome_da_turma: string
  modalidade: string
  nucleo: string
  categoria: string
  capacidade_maxima_da_turma: number
  capacidade_atual_da_turma: number
  alunos: Aluno[]
  uuidTurma?:string
  diaDaSemana?:string
  horario?:string
  isFeminina?: boolean
}

export interface AlunoComTurma {
  aluno: Aluno; 
  nomeDaTurma: string;
  categoria: string;
  modalidade: string;
  uniforme: boolean;
}

export interface IUpdateUniformeApiData {
  modalidade: string;
  nomeDaTurma: string;
  alunoNome: string;
  hasUniforme: boolean;
}

export interface Modalidade {
  nome: string // identificador da modalidade, como "futebol", "vôlei", etc.
  turmas: Turma[]
}
export interface AlunoPresencaUpdate extends Aluno {
  modalidade: string
  nomeDaTurma: string
  alunoId: string
}

export interface MoveStudentsPayload {
  alunosNomes: string[];
  alunosModalidadesOrigem: string[];
  alunosTurmasOrigem: string[];
  modalidadeDestino: string;
  nomeDaTurmaDestino: string;
}

export interface TemporaryMoveStudentsPayload {
  alunoNome: string;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  modalidadeDestino: string;
  nomeDaTurmaDestino: string;
}

export interface StudentPresenceTableProps {
  alunosDaTurma: Aluno[]
  setAlunosDaTurma: React.Dispatch<React.SetStateAction<Aluno[]>>
  modalidade: string
  nomeDaTurma: string
  alunoId?: number
}

export interface AdminTableProps {
  alunosDaTurma: Aluno[]
  modalidades?: Modalidade[]
  nomeDaTurma: string
}

// Tipagem para as props da página
export interface AdminPageProps {
  modalidades: Modalidade[]
}

export type FormValuesStudent = {
  aluno: AlunoPresencaUpdate
  modalidade: string // nome da modalidade selecionada
  turmaSelecionada: string // nome da turma selecionada
  nucleoSelecionado: string // nome do núcleo selecionado
}

export interface ModalidadesData {
  [modalidade: string]: {
    turmas: Turma[]
  }
}

export interface AttendanceModalContentProps {
  aluno: Aluno
  month: string
}

export interface IIAlunoUpdate extends Omit<Aluno, 'id' | 'presencas'> {
  modalidade: string // A modalidade do aluno
  nomeDaTurma: string // O nome da turma do aluno
  alunoId?: string | number // O ID do aluno
  anoNascimento: string // A data de nascimento a serem atualizada
  telefoneComWhatsapp: string | number
  nome: string
  informacoesAdicionais: InformacoesAdicionais;
  dataMatricula?:string
}

export interface ArchiveAluno extends Omit<Aluno, 'id' | 'presencas'> {
  IdentificadorUnico: string | undefined
  alunoId?: string | number
  modalidade: string, 
  nomeDaTurma: string
  anoNascimento: string // A data de nascimento a serem atualizada
  telefoneComWhatsapp: string | number
  nome: string
  informacoesAdicionais: InformacoesAdicionais;
  dataMatricula?:string;
  
}

export interface SelecaoModalidadeTurma {
  modalidade: string
  nucleo: string
  turma: string
  turmasDisponiveis?: Turma[] // Adicionando a propriedade turmasDisponiveis como opcional
}

export interface IIUpdateStudantModal {
  isOpen: boolean
  onClose: () => void
  alunosDaTurma: string
}

export interface Semana {
  start: number
  end: number
}

export interface TurmaPresencaSemanalProps {
  isOpen: boolean
  onClose: () => void
  alunosDaTurma: Aluno[]
  nomeDaTurma: string
}

export interface AlunoAutocompleteOption {
  [x: string]: Key | null | undefined
  id: string 
  nome: string;
  modalidade: string;
  turma: string;
  nucleo: string;
}

export interface DeleteStudants{
  alunoId: string 
  modalidade: string, 
  nomeDaTurma: string
  alunosNomes?:string
 }


export interface DeleteAlunoAutocompleteOption {
  [x: string]: Key | null | undefined
  alunoId: string 
  alunosNomes?:string;
  modalidade: string;
  nomeDaTurma: string;
}
