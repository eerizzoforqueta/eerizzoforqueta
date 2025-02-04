import { FieldValues, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
export const fieldsIdentificacao = [
  { label: "Nome Completo do Aluno(a)", id: "aluno.nome" },
  { label: "Data de Nascimento do Aluno(a)", id: "aluno.anoNascimento" },
  { label: "Número de Telefone com WhatsApp", id: "aluno.telefoneComWhatsapp" },
  {
    label: "Número do RG (ou Certidão de Nascimento, temporariamente).",
    id: "aluno.informacoesAdicionais.rg",
  },
];
export const fieldsEndereco = [
  { label: "Rua/Avenida", id: "aluno.informacoesAdicionais.endereco.ruaAvenida" },
  {
    label: "Nº da Residência:",
    id: "aluno.informacoesAdicionais.endereco.numeroResidencia",
  },
  { label: "Bairro", id: "aluno.informacoesAdicionais.endereco.bairro" },
  { label: "CEP", id: "aluno.informacoesAdicionais.endereco.cep" },
  
];
//pagadorMensalidades
export const fieldsResponsavelMensalidade = [
  {
    label: "Nome completo",
    id: "aluno.informacoesAdicionais.pagadorMensalidades.nomeCompleto",
  },
  { label: "CPF", id: "aluno.informacoesAdicionais.pagadorMensalidades.cpf" },
  {
    label: "Endereço de E-mail do Responsável",
    id: "aluno.informacoesAdicionais.pagadorMensalidades.email",
  },
  {
    label: "Telefone para emergências",
    id: "aluno.informacoesAdicionais.pagadorMensalidades.celularWhatsapp",
  },
];

//Informe se possui irmão(s) que também treinam conosco e seus nomes.

export const fieldsDadosGeraisAtleta = [
  {
    label: "Escola em que o Aluno(a) estuda atualmente",
    id: "aluno.informacoesAdicionais.escolaEstuda",
  },
  { label: "Possui irmãos que treinam conosco?.", id: "aluno.informacoesAdicionais.irmaos" },
  {
    label: "Possui problemas de saúde? Quais? ",
    id: "aluno.informacoesAdicionais.problemasaude",
  },

  {
    label: "Quais medicamentos utiliza?",
    id: "aluno.informacoesAdicionais.tipomedicacao",
  },
  {
    label: "Qual convênio/ plano de saúde?",
    id: "aluno.informacoesAdicionais.convenio",
  },
  {
    label:
      "Está autorizado a participar de competições?",
    id: "aluno.informacoesAdicionais.competicao",
  },
 
 
];
export const vinculosempresasparceiras = [
  {
    label: "O aluno(a) é filho(a) de funcionário(a) da JBS?",
    id: "aluno.informacoesAdicionais.filhofuncionarioJBS",
  },
  {
    label: "O responsável é sócio da sede da JBS?",
    id: "aluno.informacoesAdicionais.socioJBS",
  },
  {
    label: "Nome do Funcionário(a) da JBS (Pai/Mãe do Aluno):",
    id: "aluno.informacoesAdicionais.nomefuncionarioJBS",
  },
  {
    label: "O aluno(a) é filho(a) de funcionário(a) da Marcopolo?",
    id: "aluno.informacoesAdicionais.filhofuncionariomarcopolo",
  },
  {
    label: "Nome do Funcionário(a) da Marcopolo (Pai/Mãe do Aluno):",
    id: "aluno.informacoesAdicionais.nomefuncionariomarcopolo",
  }
];

export const fieldsUniforme = [
  {
    label:
      "Uniforme Obrigatório: R$ 110,00 para futsal e vôlei masculino (calção, camiseta e meia), R$ 150,00 para vôlei feminino (short, camiseta e meia). Pagamento à vista ou parcelado em 1+2 vezes. Por favor, informe o tamanho do uniforme do seu filho(a) abaixo:",
    id: "aluno.informacoesAdicionais.uniforme",
  },
];


//
export const fieldsTermosAvisos = [
  {
    label:
      "A cobrança da mensalidade será interrompida somente após o comunicado formal de cancelamento da matrícula, que deve ser realizado até o dia 28 do mês corrente para evitar cobranças no mês seguinte.",
    id: "aluno.informacoesAdicionais.cobramensalidade",
  },
  {
    label:
      "Você se compromete a avisar antecipadamente a ausência de seu filho(a) aos treinos, bem como a informar sobre possíveis problemas de saúde?",
    id: "aluno.informacoesAdicionais.avisaAusencia",
  },
  {
    label:
      "Comprometo-me a pagar a mensalidade dos treinos até o dia 10 de cada mês e, em caso de cancelamento, a comunicar até o dia 28 do mês corrente para evitar cobranças futuras.",
    id: "aluno.informacoesAdicionais.comprometimentoMensalidade",
  },
  {
    label:
      "Concordo com: desconto de R$ 5,00 seja dado SOMENTE para pagamentos até dia 10, independentemente do dia da semana; não devolução ou isenção de pagamento de mensalidades ou valores parciais correspondentes a treinos não realizados, exceto em situações em que o afastamento for justificado por atestado médico; em caso de faltas, o aluno terá o direito a recuperar o treino perdido. Treinos que coincidam com dias de feriado não serão recuperados.",
    id: "aluno.informacoesAdicionais.desconto",
  },
  {
    label:
      "Você declara que o pré-mencionado menor está em perfeitas condições de saúde, podendo participar de treinos e competições?",
    id: "aluno.informacoesAdicionais.condicaosaude",
  },
    {
    label:
      "O uso da imagem e nome do(a) atleta será utilizado para fins legítimos de divulgação e promoção da marca, sem ônus",
      id: "aluno.informacoesAdicionais.imagem",
  },
];

type OpcoesTermosAvisos = {
  [key: string]: string[];
};

export const opcoesTermosAvisos: OpcoesTermosAvisos = {
  cobramensalidade: ["Ciente"],
  avisaAusencia: ["Sim, avisarei sobre ausências aos treinos."],
  comprometimentoMensalidade: [
    "Concordo em realizar o pagamento antecipado até dia 10 de cada mês.",
  ],
  copiaDocumento: [
    "Comprometo-me a providenciar cópia autenticada do RG e atestado médico.",
  ],
  desconto: ["Estou de acordo com o desconto"],
  condicaosaude: ["Sim, declaro."],
  imagem:["Ciente"]
};

//----------------------------------------------------------------------------------------------
// src/utils/Constants.ts

export interface Presencas {
  [mes: string]: {
    [data: string]: boolean;
  };
}

interface DiasDaSemanaMap {
  [dia: string]: number;
}

/**
 * Extrai o dia da semana de um nome de turma que contém algo como
 * "SUB09_AZ_QUARTA_17H30".
 * Se não encontrar, retorna "SEGUNDA" por padrão.
 */
export function extrairDiaDaSemana(nomeDaTurma: string): string {
  const partes = nomeDaTurma.split("_");
  const diasValidos = [
    "SEGUNDA",
    "TERÇA",
    "QUARTA",
    "QUINTA",
    "SEXTA",
    "SÁBADO",
    "DOMINGO",
  ];

  const diaEncontrado = partes.find((parte) =>
    diasValidos.includes(parte.toUpperCase())
  );

  return diaEncontrado?.toUpperCase() || "SEGUNDA";
}

/**
 * Gera uma lista de datas (dd-mm-aaaa) para um determinado diaDaSemana,
 * em um determinado mês e ano.
 * Usado na função gerarPresencasParaAluno (ano corrente / mesAtual).
 */
export function gerarDiasDoMes(
  ano: number,
  mes: number,
  diaDaSemana: number
): string[] {
  let datas: string[] = [];
  let data = new Date(ano, mes - 1, 1);

  // Ajusta para o primeiro "diaDaSemana" do mês
  while (data.getDay() !== diaDaSemana) {
    data.setDate(data.getDate() + 1);
  }

  // Enquanto ainda estiver no mesmo mês, avança de 7 em 7 dias
  while (data.getMonth() === mes - 1) {
    const diaFormatado = `${data.getDate()}-${mes}-${ano}`;
    datas.push(diaFormatado);
    data.setDate(data.getDate() + 7);
  }
  return datas;
}

/**
 * Gera um objeto de presenças para um aluno, considerando:
 *  - Ano corrente (new Date().getFullYear()).
 *  - Se o mês atual < 7 => gera de janeiro a junho.
 *  - Caso contrário => gera de julho a dezembro.
 */
export function gerarPresencasParaAluno(diaDaSemana: string): Presencas {
  const ano = new Date().getFullYear(); // Ano corrente
  const diasDaSemana: DiasDaSemanaMap = {
    SEGUNDA: 1,
    TERÇA: 2,
    QUARTA: 3,
    QUINTA: 4,
    SEXTA: 5,
    SÁBADO: 6,
    DOMINGO: 0,
  };

  let presencas: Presencas = {};
  const mesAtual = new Date().getMonth() + 1; // 1..12

  if (mesAtual < 7) {
    // Gera de janeiro(1) a junho(6)
    for (let mes = 1; mes <= 6; mes++) {
      const nomeMes = new Date(ano, mes - 1, 1).toLocaleString("pt-BR", {
        month: "long",
      });
      presencas[nomeMes] = {};

      const dias = gerarDiasDoMes(
        ano,
        mes,
        diasDaSemana[diaDaSemana.toUpperCase()]
      );
      dias.forEach((data) => {
        presencas[nomeMes][data] = false;
      });
    }
  } else {
    // Gera de julho(7) a dezembro(12)
    for (let mes = 7; mes <= 12; mes++) {
      const nomeMes = new Date(ano, mes - 1, 1).toLocaleString("pt-BR", {
        month: "long",
      });
      presencas[nomeMes] = {};

      const dias = gerarDiasDoMes(
        ano,
        mes,
        diasDaSemana[diaDaSemana.toUpperCase()]
      );
      dias.forEach((data) => {
        presencas[nomeMes][data] = false;
      });
    }
  }

  return presencas;
}

/**
 * Gera um objeto de presenças para um aluno, considerando um semestre específico:
 *  - "primeiro": meses jan..jun
 *  - "segundo": meses jul..dez
 * Usa o ano fornecido no parâmetro (ou poderia usar new Date().getFullYear()).
 */
export function gerarPresencasParaAlunoSemestre(
  diaDaSemana: string,
  semestre: "primeiro" | "segundo",
  ano: number
): Presencas {
  const diasDaSemana: DiasDaSemanaMap = {
    SEGUNDA: 1,
    TERÇA: 2,
    QUARTA: 3,
    QUINTA: 4,
    SEXTA: 5,
    SÁBADO: 6,
    DOMINGO: 0,
  };

  let presencasSemestre: Presencas = {};

  // Ajuste conforme desejar (ex.: "Janeiro" etc.)
  const mesesPrimeiroSemestre = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
  ];
  const mesesSegundoSemestre = [
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const meses =
    semestre === "primeiro" ? mesesPrimeiroSemestre : mesesSegundoSemestre;

  meses.forEach((nomeMes, index) => {
    presencasSemestre[nomeMes] = {};
    // Ex.: no primeiro semestre, mesIndex = 1..6
    // no segundo, mesIndex = 7..12
    const mesIndex = semestre === "primeiro" ? index + 1 : index + 7;

    const dias = gerarDiasDoMesSemestre(
      ano,
      mesIndex,
      diasDaSemana[diaDaSemana.toUpperCase()]
    );
    dias.forEach((data) => {
      presencasSemestre[nomeMes][data] = false;
    });
  });

  return presencasSemestre;
}

/**
 * Gera datas (dd-mm-aaaa) para um mês específico (1..12), ano e diaDaSemana,
 * no contexto "semestre". Semelhante a gerarDiasDoMes, porém com outro nome
 * para evitar conflitos.
 */
export function gerarDiasDoMesSemestre(
  ano: number,
  mes: number,
  diaDaSemana: number
): string[] {
  let datas: string[] = [];
  let data = new Date(ano, mes - 1, 1);

  // Ajusta até achar o primeiro diaDaSemana do mês
  while (data.getDay() !== diaDaSemana) {
    data.setDate(data.getDate() + 1);
  }

  // Avança de 7 em 7 dias até mudar de mês
  while (data.getMonth() === mes - 1) {
    const diaFormatado = `${data.getDate()}-${mes}-${ano}`;
    datas.push(diaFormatado);
    data.setDate(data.getDate() + 7);
  }

  return datas;
}




//----------------------------------------------------------------------------------------------

const resizeImage = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const elem = document.createElement('canvas');
          const scaleFactor = Math.min(512 / img.width, 768 / img.height);
          elem.width = img.width * scaleFactor;
          elem.height = img.height * scaleFactor;
          const ctx = elem.getContext('2d');
          ctx?.drawImage(img, 0, 0, img.width * scaleFactor, img.height * scaleFactor);
          const url = elem.toDataURL('image/jpeg', 1);
          resolve(url);
        };
      };
      reader.onerror = error => reject(error);
    });
  };
export default resizeImage


export const normalizeText = (text?: string | number | null) => {
  // Garante que o valor seja convertido para string antes de chamar .normalize()
  const safeText = String(text || ''); // Convertendo para string e lidando com undefined ou null
  return safeText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};




// Função para validar se a data é válida
export const validateDate = (dateStr: string): boolean => {
  const [day, month, year] = dateStr.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

// Esquema para o campo anoNascimento com validação de formato e validade da data
export const anoNascimentoSchema = z.string()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, { message: "Preencha este campo no formato DD/MM/YYYY." })
  .refine(dateStr => validateDate(dateStr), { message: "Data de nascimento inválida." });



  // Função auxiliar para acessar de forma segura a mensagem de erro de campos aninhados
  export function getErrorMessage<FormValues extends FieldValues>(
    errors: FieldErrors<FormValues>,
    path: string
  ): string | undefined {
    const paths = path.split(".");
    let current: any = errors;

    for (const segment of paths) {
      if (current[segment] === undefined) {
        return undefined;
      }
      current = current[segment];
    }

    // Se chegamos a um objeto que contém a propriedade 'message', retornamos essa mensagem
    if (typeof current === "object" && "message" in current) {
      return current.message;
    }

    return undefined;
  }


  export function normalizeName(name:string) {
    return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  
