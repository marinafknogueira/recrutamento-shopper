require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const { pool, init, ensureAdmin, logAudit } = require('./db');

const {
  GOOGLE_CLIENT_ID,
  COMPANY_DOMAIN,
  ADMIN_EMAIL,
  JWT_SECRET,
  PORT = 3000,
  NODE_ENV = 'development',
} = process.env;

if (!GOOGLE_CLIENT_ID || !JWT_SECRET) {
  console.error('ERRO: configure GOOGLE_CLIENT_ID e JWT_SECRET no arquivo .env (veja .env.example)');
  process.exit(1);
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const app = express();

// CORS para produção no Vercel
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || NODE_ENV === 'development') {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// HTTPS redirect em produção (Vercel)
if (NODE_ENV === 'production' && process.env.VERCEL) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para API geral
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/', authLimiter);
app.use('/api/', apiLimiter);

// ---------- Utilities ----------

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || 'unknown';
}

// ---------- Auth ----------

function signSession(user) {
  return jwt.sign({ email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '12h' });
}

function authMiddleware(req, res, next) {
  const token = req.cookies.session;
  if (!token) return res.status(401).json({ error: 'Nao autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessao invalida ou expirada' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Voce nao tem permissao para esta acao' });
    }
    next();
  };
}

function asyncRoute(fn) {
  return (req, res) => fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  });
}

app.post('/api/auth/google', asyncRoute(async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Credencial ausente' });

  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID }).catch(() => null);
  if (!ticket) return res.status(401).json({ error: 'Falha ao validar login do Google' });

  const payload = ticket.getPayload();
  const email = (payload.email || '').toLowerCase();
  const domain = email.split('@')[1];

  if (COMPANY_DOMAIN && domain !== COMPANY_DOMAIN.toLowerCase()) {
    return res.status(403).json({ error: 'Use seu e-mail corporativo para entrar.' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) {
    return res.status(403).json({ error: 'Seu e-mail ainda nao tem acesso liberado. Fale com o administrador.' });
  }

  if (payload.name && payload.name !== user.name) {
    await pool.query('UPDATE users SET name = $1 WHERE email = $2', [payload.name, email]);
  }

  const token = signSession({ email: user.email, role: user.role, name: payload.name || user.name });
  res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 12 * 60 * 60 * 1000 });
  res.json({ email: user.email, role: user.role, name: payload.name || user.name });
}));

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

app.get('/api/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID, companyDomain: COMPANY_DOMAIN || null });
});

// ---------- Users (admin only) ----------

app.get('/api/users', authMiddleware, requireRole('admin'), asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT email, name, role, created_at FROM users ORDER BY created_at DESC');
  res.json(rows);
}));

app.post('/api/users', authMiddleware, requireRole('admin'), asyncRoute(async (req, res) => {
  const { email, role } = req.body;
  const validRoles = ['admin', 'ceo', 'gestor', 'talentos'];
  if (!email || !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Email e papel (admin/ceo/gestor/talentos) sao obrigatorios' });
  }
  const lower = email.toLowerCase();
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [lower]);
  const isNewUser = rows.length === 0;
  const oldRole = isNewUser ? null : rows[0].role;

  if (rows.length > 0) {
    await pool.query('UPDATE users SET role = $1 WHERE email = $2', [role, lower]);
    await logAudit('user_role_changed', req.user.email, lower, oldRole, role, `Role atualizada de ${oldRole} para ${role}`, getClientIp(req));
  } else {
    await pool.query('INSERT INTO users (email, role) VALUES ($1, $2)', [lower, role]);
    await logAudit('user_created', req.user.email, lower, null, role, `Novo usuário criado com role ${role}`, getClientIp(req));
  }
  res.json({ ok: true });
}));

app.delete('/api/users/:email', authMiddleware, requireRole('admin'), asyncRoute(async (req, res) => {
  const email = req.params.email.toLowerCase();
  if (email === ADMIN_EMAIL.toLowerCase()) {
    return res.status(400).json({ error: 'Nao e possivel remover o admin principal' });
  }
  const { rows } = await pool.query('SELECT role FROM users WHERE email = $1', [email]);
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
  await logAudit('user_deleted', req.user.email, email, rows[0]?.role || null, null, `Usuário removido do sistema`, getClientIp(req));
  res.json({ ok: true });
}));

// Audit log (admin only)
app.get('/api/audit-log', authMiddleware, requireRole('admin'), asyncRoute(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || 100), 1000);
  const { rows } = await pool.query(
    'SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  res.json(rows);
}));

// ---------- Jobs ----------

const JOB_FIELDS = [
  'cargo', 'senioridade', 'setor', 'centro_custo', 'requisitos', 'responsabilidades',
  'pergunta_entrevista_1', 'pergunta_entrevista_2', 'pergunta_entrevista_3',
  'faixa_salarial', 'quantidade_vagas', 'recrutamento', 'reporte_direto', 'unidade', 'tipo_vaga',
];

async function logHistory(jobId, from, to, changedBy, comentario = null) {
  await pool.query(
    'INSERT INTO job_history (job_id, status_from, status_to, changed_by, comentario) VALUES ($1, $2, $3, $4, $5)',
    [jobId, from, to, changedBy, comentario]
  );
}

async function getJob(id) {
  const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
  return rows[0];
}

// Criar vaga (gestor ou admin) - comeca como rascunho
app.post('/api/jobs', authMiddleware, requireRole('gestor', 'admin'), asyncRoute(async (req, res) => {
  const body = req.body;
  for (const f of JOB_FIELDS) {
    if (body[f] === undefined || body[f] === '') {
      return res.status(400).json({ error: `Campo obrigatorio ausente: ${f}` });
    }
  }
  const gestorEmail = req.user.role === 'gestor' ? req.user.email : (body.gestor_email || req.user.email);

  const { rows } = await pool.query(
    `INSERT INTO jobs (
      cargo, senioridade, setor, centro_custo, gestor_email, requisitos, responsabilidades,
      pergunta_entrevista_1, pergunta_entrevista_2, pergunta_entrevista_3,
      faixa_salarial, quantidade_vagas, recrutamento, reporte_direto, unidade, tipo_vaga, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'rascunho')
    RETURNING *`,
    [
      body.cargo, body.senioridade, body.setor, body.centro_custo, gestorEmail, body.requisitos, body.responsabilidades,
      body.pergunta_entrevista_1, body.pergunta_entrevista_2, body.pergunta_entrevista_3,
      body.faixa_salarial, body.quantidade_vagas, body.recrutamento, body.reporte_direto, body.unidade, body.tipo_vaga,
    ]
  );
  const job = rows[0];
  await logHistory(job.id, null, 'rascunho', req.user.email, 'Vaga criada');
  res.json(job);
}));

// Editar vaga (dono gestor, apenas em rascunho/reprovada, ou admin a qualquer momento)
app.put('/api/jobs/:id', authMiddleware, asyncRoute(async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga nao encontrada' });

  const isOwner = req.user.role === 'gestor' && job.gestor_email === req.user.email;
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && !(isOwner && ['rascunho', 'reprovada'].includes(job.status))) {
    return res.status(403).json({ error: 'Voce nao pode editar esta vaga neste momento' });
  }

  const body = req.body;
  const fieldsToUpdate = JOB_FIELDS.filter((f) => body[f] !== undefined);
  if (fieldsToUpdate.length > 0) {
    const setClause = fieldsToUpdate.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = fieldsToUpdate.map((f) => body[f]);
    await pool.query(
      `UPDATE jobs SET ${setClause}, updated_at = now() WHERE id = $${fieldsToUpdate.length + 1}`,
      [...values, job.id]
    );
  }
  res.json(await getJob(job.id));
}));

// Gestor envia para aprovacao do CEO
app.post('/api/jobs/:id/submit', authMiddleware, requireRole('gestor', 'admin'), asyncRoute(async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga nao encontrada' });
  if (req.user.role === 'gestor' && job.gestor_email !== req.user.email) {
    return res.status(403).json({ error: 'Esta vaga nao e sua' });
  }
  if (!['rascunho', 'reprovada'].includes(job.status)) {
    return res.status(400).json({ error: 'Vaga nao esta em um estado que permite envio' });
  }
  await pool.query("UPDATE jobs SET status = 'aguardando_aprovacao_ceo', motivo_reprovacao = NULL, updated_at = now() WHERE id = $1", [job.id]);
  await logHistory(job.id, job.status, 'aguardando_aprovacao_ceo', req.user.email, 'Enviada para aprovacao do CEO');
  res.json(await getJob(job.id));
}));

// CEO aprova
app.post('/api/jobs/:id/approve', authMiddleware, requireRole('ceo', 'admin'), asyncRoute(async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga nao encontrada' });
  if (job.status !== 'aguardando_aprovacao_ceo') {
    return res.status(400).json({ error: 'Vaga nao esta aguardando aprovacao' });
  }
  await pool.query("UPDATE jobs SET status = 'aprovada_aguardando_priorizacao', updated_at = now() WHERE id = $1", [job.id]);
  await logHistory(job.id, job.status, 'aprovada_aguardando_priorizacao', req.user.email, 'Aprovada pelo CEO');
  res.json(await getJob(job.id));
}));

// CEO reprova
app.post('/api/jobs/:id/reject', authMiddleware, requireRole('ceo', 'admin'), asyncRoute(async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga nao encontrada' });
  if (job.status !== 'aguardando_aprovacao_ceo') {
    return res.status(400).json({ error: 'Vaga nao esta aguardando aprovacao' });
  }
  const motivo = req.body.motivo || null;
  await pool.query("UPDATE jobs SET status = 'reprovada', motivo_reprovacao = $1, updated_at = now() WHERE id = $2", [motivo, job.id]);
  await logHistory(job.id, job.status, 'reprovada', req.user.email, motivo);
  res.json(await getJob(job.id));
}));

// Talentos define prioridade e responsavel, movendo para em_recrutamento
app.post('/api/jobs/:id/priorizar', authMiddleware, requireRole('talentos', 'admin'), asyncRoute(async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga nao encontrada' });
  if (job.status !== 'aprovada_aguardando_priorizacao') {
    return res.status(400).json({ error: 'Vaga nao esta aguardando priorizacao' });
  }
  const { prioridade, responsavel_talentos } = req.body;
  if (!prioridade || !responsavel_talentos) {
    return res.status(400).json({ error: 'Prioridade e responsavel sao obrigatorios' });
  }
  await pool.query(
    "UPDATE jobs SET status = 'em_recrutamento', prioridade = $1, responsavel_talentos = $2, updated_at = now() WHERE id = $3",
    [prioridade, responsavel_talentos, job.id]
  );
  await logHistory(job.id, job.status, 'em_recrutamento', req.user.email, `Prioridade: ${prioridade}, Responsavel: ${responsavel_talentos}`);
  res.json(await getJob(job.id));
}));

// Talentos/admin marca como preenchida ou encerrada
app.post('/api/jobs/:id/status', authMiddleware, requireRole('talentos', 'admin'), asyncRoute(async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga nao encontrada' });
  const { status, comentario } = req.body;
  if (!['preenchida', 'encerrada'].includes(status)) {
    return res.status(400).json({ error: 'Status invalido' });
  }
  if (job.status !== 'em_recrutamento') {
    return res.status(400).json({ error: 'Vaga precisa estar em recrutamento' });
  }
  await pool.query('UPDATE jobs SET status = $1, updated_at = now() WHERE id = $2', [status, job.id]);
  await logHistory(job.id, job.status, status, req.user.email, comentario || null);
  res.json(await getJob(job.id));
}));

// Listar vagas - visibilidade por papel
app.get('/api/jobs', authMiddleware, asyncRoute(async (req, res) => {
  let rows;
  if (req.user.role === 'admin' || req.user.role === 'ceo') {
    ({ rows } = await pool.query('SELECT * FROM jobs ORDER BY updated_at DESC'));
  } else if (req.user.role === 'gestor') {
    ({ rows } = await pool.query('SELECT * FROM jobs WHERE gestor_email = $1 ORDER BY updated_at DESC', [req.user.email]));
  } else if (req.user.role === 'talentos') {
    ({ rows } = await pool.query("SELECT * FROM jobs WHERE status != 'rascunho' ORDER BY updated_at DESC"));
  } else {
    rows = [];
  }
  res.json(rows);
}));

app.get('/api/jobs/:id', authMiddleware, asyncRoute(async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga nao encontrada' });
  if (req.user.role === 'gestor' && job.gestor_email !== req.user.email) {
    return res.status(403).json({ error: 'Sem permissao' });
  }
  const { rows: history } = await pool.query('SELECT * FROM job_history WHERE job_id = $1 ORDER BY changed_at ASC', [job.id]);
  res.json({ ...job, history });
}));

// ---------- Pontuação (metas de contratação do time de Talentos) ----------

const SENIORIDADES = ['Estagiário', 'Júnior', 'Pleno', 'Sênior', 'Especialista', 'Coordenação', 'Gerência', 'Diretoria'];
const META_EQUIPE_SEMESTRE = 800;

// Pontos por senioridade para vagas fora de Tecnologia
const PONTOS_OUTRAS_AREAS = {
  'Estagiário': 6, 'Júnior': 6, 'Pleno': 6, 'Sênior': 6,
  'Especialista': 15, 'Coordenação': 15, 'Gerência': 15, 'Diretoria': 15,
};
// Pontos por senioridade para vagas de Tecnologia
const PONTOS_TECNOLOGIA = {
  'Estagiário': 6, 'Júnior': 10, 'Pleno': 10, 'Sênior': 15,
  'Especialista': 15, 'Coordenação': 15, 'Gerência': 15, 'Diretoria': 15,
};

function pontosPorVaga(job) {
  const tabela = job.setor === 'Tecnologia' ? PONTOS_TECNOLOGIA : PONTOS_OUTRAS_AREAS;
  const base = tabela[job.senioridade] !== undefined ? tabela[job.senioridade] : 6;
  return base * (job.quantidade_vagas || 1);
}

// Só Talentos e Admin acessam pontuação. Individual só aparece para a própria pessoa e para o Admin.
app.get('/api/score', authMiddleware, requireRole('talentos', 'admin'), asyncRoute(async (req, res) => {
  const { rows: jobs } = await pool.query(
    "SELECT setor, senioridade, quantidade_vagas, responsavel_talentos FROM jobs WHERE status = 'preenchida'"
  );
  const mapa = {};
  for (const j of jobs) {
    if (!j.responsavel_talentos) continue;
    mapa[j.responsavel_talentos] = (mapa[j.responsavel_talentos] || 0) + pontosPorVaga(j);
  }
  const totalEquipe = Object.values(mapa).reduce((a, b) => a + b, 0);

  const result = {
    totalEquipe,
    metaEquipe: META_EQUIPE_SEMESTRE,
    pontosReferencia: {
      senioridades: SENIORIDADES,
      outrasAreas: PONTOS_OUTRAS_AREAS,
      tecnologia: PONTOS_TECNOLOGIA,
    },
  };

  if (req.user.role === 'talentos') {
    result.meuPontos = mapa[req.user.email] || 0;
  }

  if (req.user.role === 'admin') {
    const { rows: talentosUsers } = await pool.query("SELECT email, name FROM users WHERE role = 'talentos'");
    result.pontosPorPessoa = talentosUsers
      .map((u) => ({ email: u.email, name: u.name, pontos: mapa[u.email] || 0 }))
      .sort((a, b) => b.pontos - a.pontos);
  }

  res.json(result);
}));

// ---------- Start ----------

init()
  .then(() => ensureAdmin(ADMIN_EMAIL))
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao iniciar o servidor / conectar ao banco de dados:', err);
    process.exit(1);
  });
