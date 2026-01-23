// src/scripts/migrateRematriculas2026.ts
import "dotenv/config";
import admin from "firebase-admin";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável ausente: ${name}`);
  return v;
}

const base64Key = mustEnv("FIREBASE_SERVICE_ACCOUNT_KEY");
const databaseURL = mustEnv("FIREBASE_DATABASE_URL");

// decodifica base64 -> string JSON -> objeto
const serviceAccount = JSON.parse(
  Buffer.from(base64Key, "base64").toString("utf8")
);

// normaliza a chave privada (comum vir com \\n)
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL,
});

const db = admin.database();
const ANO = 2026;

function pad2(n: string) {
  return n.padStart(2, '0');
}

function yyyymmddToBR(yyyymmdd: string) {
  const yyyy = yyyymmdd.slice(0, 4);
  const mm = yyyymmdd.slice(4, 6);
  const dd = yyyymmdd.slice(6, 8);
  return `${dd}/${mm}/${yyyy}`;
}

function parseFromAlunoKey(alunoKey?: string) {
  const s = String(alunoKey || '');
  const m = s.match(/^(\d{11})_(\d{8})$/);
  if (!m) return null;
  return { cpf: m[1], yyyymmdd: m[2] };
}

function parseFromAlunoKeyRaw(alunoKeyRaw?: string) {
  const s = String(alunoKeyRaw || '');
  // "CPF|DD/MM/YYYY"
  const m = s.match(/^(\d{11})\|(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const cpf = m[1];
  const dd = pad2(m[2]);
  const mm = pad2(m[3]);
  const yyyy = m[4];
  const yyyymmdd = `${yyyy}${mm}${dd}`;
  return { cpf, yyyymmdd };
}

async function main() {
  const ref = db.ref(`rematriculas${ANO}`);
  const snap = await ref.once('value');
  const val = snap.val() || {};

  let updated = 0;
  let scanned = 0;

  for (const [remId, rr] of Object.entries<any>(val)) {
    scanned++;

    const hasNew =
      !!rr?.alunoCpfPagador &&
      !!rr?.alunoNascimentoYYYYMMDD &&
      !!rr?.alunoAnoNascimento;

    if (hasNew) continue;

    // tenta derivar
    const fromKey = parseFromAlunoKey(rr?.alunoKey);
    const fromRaw = parseFromAlunoKeyRaw(rr?.alunoKeyRaw);

    const parsed = fromKey || fromRaw;
    if (!parsed) continue;

    const alunoCpfPagador = parsed.cpf;
    const alunoNascimentoYYYYMMDD = parsed.yyyymmdd;
    const alunoAnoNascimento = yyyymmddToBR(parsed.yyyymmdd);

    const alunoKey = `${alunoCpfPagador}_${alunoNascimentoYYYYMMDD}`;
    const alunoKeyRaw = `${alunoCpfPagador}|${alunoAnoNascimento}`;

    await ref.child(remId).update({
      alunoCpfPagador,
      alunoNascimentoYYYYMMDD,
      alunoAnoNascimento,
      alunoKey,
      alunoKeyRaw, // opcional, mas deixa consistente
    });

    updated++;
  }

  console.log(`Scanned: ${scanned}`);
  console.log(`Updated: ${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
