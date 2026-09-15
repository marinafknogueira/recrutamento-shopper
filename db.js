const { Pool } = require('pg');

// Em produção no Cloud Run, a conexão é feita via socket do Cloud SQL
// (INSTANCE_CONNECTION_NAME), sem precisar de host/porta.
// Em desenvolvimento local, use DATABASE_URL (ex: via Cloud SQL Auth Proxy).
const { DATABASE_URL, INSTANCE_CONNECTION_NAME, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

let pool;
if (INSTANCE_CONNECTION_NAME) {
  pool = new Pool({
    host: `/cloudsql/${INSTANCE_CONNECTION_NAME}`,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });
} else if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL });
} else {
  console.error('ERRO: configure DATABASE_URL (local) ou INSTANCE_CONNECTION_NAME + DB_USER + DB_PASSWORD + DB_NAME (Cloud Run) no .env');
  process.exit(1);
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT NOT NULL CHECK (role IN ('admin','ceo','gestor','talentos')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      cargo TEXT NOT NULL,
      senioridade TEXT NOT NULL,
      setor TEXT NOT NULL,
      centro_custo TEXT NOT NULL,
      gestor_email TEXT NOT NULL,
      requisitos TEXT NOT NULL,
      responsabilidades TEXT NOT NULL,
      pergunta_entrevista_1 TEXT NOT NULL,
      pergunta_entrevista_2 TEXT NOT NULL,
      pergunta_entrevista_3 TEXT NOT NULL,
      faixa_salarial TEXT NOT NULL,
      quantidade_vagas INTEGER NOT NULL DEFAULT 1,
      recrutamento TEXT NOT NULL CHECK (recrutamento IN ('interno','externo')),
      reporte_direto TEXT NOT NULL,
      unidade TEXT NOT NULL,
      tipo_vaga TEXT NOT NULL CHECK (tipo_vaga IN ('aumento_quadro','substituicao')),
      status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN (
        'rascunho',
        'aguardando_aprovacao_ceo',
        'reprovada',
        'aprovada_aguardando_priorizacao',
        'em_recrutamento',
        'preenchida',
        'encerrada'
      )),
      prioridade TEXT,
      responsavel_talentos TEXT,
      motivo_reprovacao TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS job_history (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id),
      status_from TEXT,
      status_to TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      comentario TEXT,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id SERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      target_email TEXT,
      old_value TEXT,
      new_value TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// Bootstrap: garante que o e-mail definido em ADMIN_EMAIL sempre exista como admin
async function ensureAdmin(email) {
  if (!email) return;
  const lower = email.toLowerCase();
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [lower]);
  if (rows.length === 0) {
    await pool.query('INSERT INTO users (email, role, name) VALUES ($1, $2, $3)', [lower, 'admin', 'Admin']);
  } else if (rows[0].role !== 'admin') {
    await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', lower]);
  }
}

async function logAudit(action, adminEmail, targetEmail, oldValue, newValue, details, ipAddress) {
  await pool.query(
    'INSERT INTO admin_audit_log (action, admin_email, target_email, old_value, new_value, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [action, adminEmail, targetEmail, oldValue, newValue, details, ipAddress]
  );
}

module.exports = { pool, init, ensureAdmin, logAudit };
