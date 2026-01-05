// src/pages/api/rematricula/portalLookup.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '@/config/firebaseAdmin';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const db = admin.database();
const ANO_PADRAO = 2026;

const JWT_SECRET =
  process.env.REMATRICULA_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'rematricula-dev-secret';

type Body = {
  anoLetivo?: number;
  cpfPagador: string;
  dataNascimento: string; // DD/MM/AAAA
};

type RematriculaResumo = {
  token: string;
  alunoNome: string | null;
  modalidadeOrigem: string;
  nomeDaTurmaOrigem: string;
  status: string;
  resposta?: string | null;
};

type Data =
  | { rematriculas: RematriculaResumo[] }
  | { error: string };

// -------------------- helpers --------------------

function digitsOnly(v: any) {
  return String(v ?? '').replace(/\D/g, '');
}

function normalizeCpf11(v: any): string {
  const d = digitsOnly(v);
  if (!d) return '';
  if (d.length === 11) return d;
  if (d.length > 11) return d.slice(-11);
  return d.padStart(11, '0');
}

function isValidDateBR(v: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(String(v || '').trim());
}

function birthToYYYYMMDD(birthRaw: any): string {
  const s = String(birthRaw || '').trim();

  // DD/MM/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}${mm}${dd}`;
  }

  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}${m[2]}${m[3]}`;

  // fallback dígitos
  const d = s.replace(/\D/g, '');
  if (d.length === 8) {
    if (d.startsWith('19') || d.startsWith('20')) return d; // yyyymmdd
    // ddmmyyyy
    const dd = d.slice(0, 2);
    const mm = d.slice(2, 4);
    const yyyy = d.slice(4, 8);
    return `${yyyy}${mm}${dd}`;
  }

  return '';
}

function signToken(rematriculaId: string, anoLetivo: number) {
  return jwt.sign({ rematriculaId, anoLetivo }, JWT_SECRET, { expiresIn: '120d' });
}

function toArrayMaybe(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'object') return Object.values(val).filter(Boolean);
  return [];
}

function keyOrigem(mod: string, turma: string) {
  return `${mod}:::${turma}`;
}

function hasResposta(rr: any) {
  return rr?.resposta === 'sim' || rr?.resposta === 'nao' || !!rr?.timestampResposta;
}

// índice: (modalidade:::nomeTurma) -> uuidTurma
function buildTurmaUuidIndex(modalidadesVal: any): Record<string, string> {
  const idx: Record<string, string> = {};

  for (const modNome of Object.keys(modalidadesVal || {})) {
    const mod = modalidadesVal[modNome];
    const turmasArr = toArrayMaybe(mod?.turmas);

    for (const turma of turmasArr) {
      const nome = String(turma?.nome_da_turma || '');
      const uuid = String(turma?.uuidTurma || '');
      if (!nome || !uuid) continue;

      const k = keyOrigem(modNome, nome);
      if (!idx[k]) idx[k] = uuid;
    }
  }

  return idx;
}

function matchRemAsAluno(rr: any, identificadorUnico: string, alunoKey: string, cpf11: string, yyyymmdd: string) {
  const rrIdent = String(rr?.identificadorUnico || '');
  const rrAlunoKey = String(rr?.alunoKey || '');
  const rrCpf = normalizeCpf11(rr?.alunoCpfPagador || rr?.cpfPagador);
  const rrBirth = birthToYYYYMMDD(rr?.alunoAnoNascimento || rr?.alunoDataNascimento || rr?.dataNascimento);

  if (identificadorUnico && rrIdent === identificadorUnico) return true;
  if (rrAlunoKey && rrAlunoKey === alunoKey) return true;
  if (rrCpf === cpf11 && rrBirth === yyyymmdd) return true;

  return false;
}

// -------------------- handler --------------------

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { anoLetivo, cpfPagador, dataNascimento } = req.body as Body;
    const ano = Number(anoLetivo || ANO_PADRAO);

    const cpf11 = normalizeCpf11(cpfPagador || '');
    const dn = String(dataNascimento || '').trim();

    if (cpf11.length !== 11) return res.status(400).json({ error: 'CPF inválido.' });
    if (!isValidDateBR(dn)) return res.status(400).json({ error: 'Data de nascimento inválida (use DD/MM/AAAA).' });

    const dnYYYYMMDD = birthToYYYYMMDD(dn);
    if (!dnYYYYMMDD) return res.status(400).json({ error: 'Data de nascimento inválida.' });

    // ---- 1) carrega modalidades e encontra o aluno por (cpf+data) ----
    const modalidadesSnap = await db.ref('modalidades').once('value');
    const modalidadesVal = modalidadesSnap.val() || {};

    const turmaUuidIndex = buildTurmaUuidIndex(modalidadesVal);

    let alunoNome = '';
    let identificadorUnico = '';
    let rgDigits = '';

    // achou pelo cpf/data em alguma turma
    let foundAny = false;

    for (const modNome of Object.keys(modalidadesVal)) {
      const mod = modalidadesVal[modNome];
      const turmasArr = toArrayMaybe(mod?.turmas);

      for (const turma of turmasArr) {
        const alunosArr = toArrayMaybe(turma?.alunos);

        for (const a of alunosArr) {
          const cpfA = normalizeCpf11(a?.informacoesAdicionais?.pagadorMensalidades?.cpf);
          const nascA = birthToYYYYMMDD(a?.anoNascimento);

          if (!cpfA || !nascA) continue;

          if (cpfA === cpf11 && nascA === dnYYYYMMDD) {
            foundAny = true;

            if (!alunoNome) alunoNome = String(a?.nome || '');
            if (!identificadorUnico) {
              identificadorUnico = String(a?.informacoesAdicionais?.IdentificadorUnico || '');
            }
            if (!rgDigits) rgDigits = digitsOnly(a?.informacoesAdicionais?.rg);

            break;
          }
        }
        if (foundAny) break;
      }
      if (foundAny) break;
    }

    if (!foundAny) {
      return res.status(200).json({ rematriculas: [] });
    }

    const alunoKey = `${cpf11}_${dnYYYYMMDD}`;

    // ---- 1b) coleta TODAS as turmas do aluno ----
    // Preferência: IdentificadorUnico; fallback: (nome + rg + nasc)
    const turmasAtuais: Array<{ modalidade: string; nome_da_turma: string; uuidTurma?: string }> = [];
    const turmasAtuaisSet = new Set<string>();

    for (const modNome of Object.keys(modalidadesVal)) {
      const mod = modalidadesVal[modNome];
      const turmasArr = toArrayMaybe(mod?.turmas);

      for (const turma of turmasArr) {
        const nomeTurma = String(turma?.nome_da_turma || '');
        if (!nomeTurma) continue;

        const alunosArr = toArrayMaybe(turma?.alunos);

        let foundHere = false;

        for (const a of alunosArr) {
          const identA = String(a?.informacoesAdicionais?.IdentificadorUnico || '');
          const nomeA = String(a?.nome || '');
          const rgA = digitsOnly(a?.informacoesAdicionais?.rg);
          const nascA = birthToYYYYMMDD(a?.anoNascimento);

          if (identificadorUnico) {
            if (identA && identA === identificadorUnico) {
              foundHere = true;
              break;
            }
          } else {
            // fallback: tenta bater por nome+rg+nasc (melhor do que só nome)
            if (nomeA && alunoNome && nomeA === alunoNome && rgDigits && rgA === rgDigits && nascA === dnYYYYMMDD) {
              foundHere = true;
              break;
            }
            // fallback extra: se não tem RG, ainda tenta nome+nasc (menos seguro)
            if (!rgDigits && nomeA && alunoNome && nomeA === alunoNome && nascA === dnYYYYMMDD) {
              foundHere = true;
              break;
            }
          }
        }

        if (foundHere) {
          const origemK = keyOrigem(modNome, nomeTurma);
          if (!turmasAtuaisSet.has(origemK)) {
            turmasAtuaisSet.add(origemK);

            const uuid = String(turma?.uuidTurma || turmaUuidIndex[origemK] || '');
            turmasAtuais.push({
              modalidade: modNome,
              nome_da_turma: nomeTurma,
              uuidTurma: uuid || undefined,
            });
          }
        }
      }
    }

    if (!turmasAtuais.length) {
      // achou o aluno, mas não conseguiu coletar turmas (caso estranho)
      return res.status(200).json({ rematriculas: [] });
    }

    const currentOrigemKeys = new Set<string>(turmasAtuais.map((t) => keyOrigem(t.modalidade, t.nome_da_turma)));

    // ---- 2) carrega rematrículas do ano e filtra “do aluno” ----
    const remSnap = await db.ref(`rematriculas${ano}`).once('value');
    const remVal = remSnap.val() || {};

    const remsDoAluno: Array<{ id: string; rr: any }> = [];

    for (const [remId, rr] of Object.entries(remVal as Record<string, any>)) {
      if (!matchRemAsAluno(rr, identificadorUnico, alunoKey, cpf11, dnYYYYMMDD)) continue;
      remsDoAluno.push({ id: remId, rr });
    }

    // ---- 3) calcula destinos ocupados (para não criar “origem fantasma”) ----
    const lockedDestUuids = new Set<string>();

    for (const { rr } of remsDoAluno) {
      if (rr?.resposta !== 'sim') continue;

      const st = String(rr?.status || '');
      if (st !== 'pendente' && st !== 'aplicada') continue;

      const uuidD = String(rr?.turmaDestinoUuid || '');
      if (uuidD) lockedDestUuids.add(uuidD);

      if (Array.isArray(rr?.turmasExtrasDestino)) {
        for (const ex of rr.turmasExtrasDestino) {
          const exUuid = String(ex?.turmaDestinoUuid || '');
          if (exUuid) lockedDestUuids.add(exUuid);
        }
      }
    }

    // ---- 4) dedupe por origem: pega a mais recente ----
    const bestByOrigem = new Map<string, { id: string; rr: any; ts: number }>();

    for (const { id, rr } of remsDoAluno) {
      const modO = String(rr?.modalidadeOrigem || '');
      const turmaO = String(rr?.nomeDaTurmaOrigem || '');
      if (!modO || !turmaO) continue;

      const origemK = keyOrigem(modO, turmaO);
      const ts = Number(rr?.timestampResposta ?? rr?.createdAt ?? 0);

      const cur = bestByOrigem.get(origemK);
      if (!cur || ts >= cur.ts) bestByOrigem.set(origemK, { id, rr, ts });
    }

    // ---- 5) monta lista final ----
    const byOrigem = new Map<string, RematriculaResumo>();

    // inclui existentes se origem atual OU já respondida/aplicada
    for (const [origemK, pack] of bestByOrigem.entries()) {
      const { id, rr } = pack;

      const origemEhAtual = currentOrigemKeys.has(origemK);
      const responded = hasResposta(rr);
      const aplicada = String(rr?.status || '') === 'aplicada';

      if (!origemEhAtual && !responded && !aplicada) continue;

      byOrigem.set(origemK, {
        token: signToken(id, ano),
        alunoNome: alunoNome || null,
        modalidadeOrigem: String(rr?.modalidadeOrigem || ''),
        nomeDaTurmaOrigem: String(rr?.nomeDaTurmaOrigem || ''),
        status: String(rr?.status || 'pendente'),
        resposta: rr?.resposta ?? null,
      });
    }

    // cria faltantes para turmas atuais elegíveis
    for (const t of turmasAtuais) {
      const origemK = keyOrigem(t.modalidade, t.nome_da_turma);
      if (byOrigem.has(origemK)) continue;

      const uuid = String(t.uuidTurma || turmaUuidIndex[origemK] || '');
      if (uuid && lockedDestUuids.has(uuid)) continue;

      const rematriculaId = uuidv4();

      await db.ref(`rematriculas${ano}/${rematriculaId}`).set({
        anoLetivo: ano,

        // pode estar vazio, mas não quebra mais
        identificadorUnico: identificadorUnico || null,

        // ✅ identidade fallback
        alunoKey,
        alunoCpfPagador: cpf11,
        alunoAnoNascimento: dn, // DD/MM/AAAA (como o usuário digitou)
        alunoNascimentoYYYYMMDD: dnYYYYMMDD,

        modalidadeOrigem: t.modalidade,
        nomeDaTurmaOrigem: t.nome_da_turma,
        status: 'pendente',
        createdAt: Date.now(),
      });

      byOrigem.set(origemK, {
        token: signToken(rematriculaId, ano),
        alunoNome: alunoNome || null,
        modalidadeOrigem: t.modalidade,
        nomeDaTurmaOrigem: t.nome_da_turma,
        status: 'pendente',
        resposta: null,
      });
    }

    const list = Array.from(byOrigem.values()).sort((a, b) => {
      const ak = keyOrigem(a.modalidadeOrigem, a.nomeDaTurmaOrigem);
      const bk = keyOrigem(b.modalidadeOrigem, b.nomeDaTurmaOrigem);
      return ak.localeCompare(bk);
    });

    return res.status(200).json({ rematriculas: list });
  } catch (err) {
    console.error('Erro em /api/rematricula/portalLookup:', err);
    return res.status(500).json({ error: 'Erro ao buscar rematrículas.' });
  }
}
