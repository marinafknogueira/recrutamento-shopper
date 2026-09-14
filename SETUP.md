# 🚀 Deploy: Esteira de Recrutamento Shopper

Guia passo-a-passo para colocar a aplicação em produção com **Vercel** (frontend + backend) e **Supabase** (banco de dados PostgreSQL).

---

## 📋 Pré-requisitos

- Conta no GitHub/GitLab
- Conta no Supabase (gratuita)
- Conta no Vercel (gratuita)
- Credenciais do Google Cloud Console (OAuth 2.0)

---

## 🔧 Passo 1: Preparar Supabase (10 minutos)

### 1.1 Criar Projeto Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em **"New Project"**
3. Preencha:
   - **Project name**: `esteira-recrutamento` (ou seu nome preferido)
   - **Database password**: Gere uma senha forte (guarde bem!)
   - **Region**: Escolha uma região do Brasil (São Paulo se disponível)
4. Clique **"Create new project"** e aguarde ~2 minutos

### 1.2 Copiar Credenciais do Banco

1. No painel do Supabase, vá em **Settings → Database**
2. Procure por **"Connection string"**
3. Clique na aba **"URI"**
4. Copie a URL (formato: `postgresql://postgres:PASSWORD@host:5432/postgres`)
5. Substitua `[YOUR-PASSWORD]` pela senha que você criou
6. Guarde essa URL — você vai usar em breve

### 1.3 Criar as Tabelas no Banco

1. No Supabase, vá em **SQL Editor** (lado esquerdo)
2. Clique em **"New Query"**
3. Cole este SQL:

```sql
-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','ceo','gestor','talentos')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de vagas
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

-- Tabela de histórico
CREATE TABLE IF NOT EXISTS job_history (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  status_from TEXT,
  status_to TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  comentario TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insira um admin inicial (troque o e-mail)
INSERT INTO users (email, role, name) 
VALUES ('marina@shopper.com.br', 'admin', 'Marina Admin')
ON CONFLICT (email) DO NOTHING;
```

4. Clique **"Run"** (triângulo verde)
5. Pronto! Tabelas criadas.

---

## 🔑 Passo 2: Configurar Google OAuth (10 minutos)

### 2.1 Criar Projeto no Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. No topo, clique no dropdown e **"Create Project"**
3. Nome: `esteira-recrutamento`
4. Clique **"Create"** e aguarde

### 2.2 Ativar Google+ API

1. No painel, vá para **APIs & Services → Library**
2. Procure por **"Google+ API"** (ou "People API")
3. Clique nela e pressione **"Enable"**

### 2.3 Criar Credencial OAuth 2.0

1. Vá em **APIs & Services → Credentials**
2. Clique **"+ Create Credentials"** → **"OAuth client ID"**
3. Você verá um aviso "You need to create an OAuth consent screen first"
4. Clique em **"Create OAuth consent screen"**

### 2.4 Configurar OAuth Consent Screen

1. Escolha **"External"** e clique **"Create"**
2. Preencha:
   - **App name**: `Esteira de Recrutamento`
   - **User support email**: seu email
   - **Developer contact**: seu email
3. Clique **"Save and Continue"**
4. (Skip scopes, clique "Save and Continue" novamente)
5. (Skip test users, clique "Save and Continue")
6. Clique **"Back to Dashboard"**

### 2.5 Criar Credencial OAuth 2.0 (novamente)

1. Vá em **APIs & Services → Credentials**
2. Clique **"+ Create Credentials"** → **"OAuth client ID"**
3. Escolha **"Web application"**
4. Preencha:
   - **Name**: `Esteira de Recrutamento Web`
5. Em **"Authorized JavaScript origins"**, clique **"Add URI"** e adicione:
   - `http://localhost:3000` (desenvolvimento)
   - `https://seu-app.vercel.app` (você vai pegar essa URL depois)
6. Em **"Authorized redirect URIs"**, clique **"Add URI"** e adicione:
   - `http://localhost:3000` (desenvolvimento)
   - `https://seu-app.vercel.app` (você vai pegar essa URL depois)
7. Clique **"Create"**
8. Você verá um modal com **Client ID** e **Client Secret**
9. **Copie o Client ID** — você vai usar agora

---

## 📦 Passo 3: Preparar Repositório Git

### 3.1 Subir Código para GitHub

1. Abra terminal/PowerShell no diretório do projeto
2. Execute:

```bash
git init
git add .
git commit -m "Initial commit: Esteira de Recrutamento"
git branch -M main
git remote add origin https://github.com/SEU_USER/recrutamento-shopper.git
git push -u origin main
```

3. Guarde a URL do repositório (você vai usar no Vercel)

---

## 🚀 Passo 4: Deploy no Vercel (5 minutos)

### 4.1 Conectar Vercel com GitHub

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique **"Add New... → Project"**
3. Escolha o repositório `recrutamento-shopper`
4. Clique **"Import"**

### 4.2 Configurar Variáveis de Ambiente

Na tela de configuração do projeto Vercel:

1. Em **"Environment Variables"**, clique **"Add"** para cada variável:

```
GOOGLE_CLIENT_ID = (seu Client ID do Google)
GOOGLE_CLIENT_SECRET = (seu Client Secret do Google)
COMPANY_DOMAIN = shopper.com.br
ADMIN_EMAIL = marina@shopper.com.br (seu email)
JWT_SECRET = (execute: openssl rand -base64 32)
DATABASE_URL = (copie de Supabase)
NODE_ENV = production
```

2. Clique **"Deploy"**

### 4.3 Aguardar Deploy

- O Vercel vai compilar e fazer deploy automaticamente
- Quando terminar, você verá um link tipo: `https://esteira-recrutamento-xyzabc.vercel.app`
- **Copie esse URL** (você vai usar para finalizar Google OAuth)

---

## ✅ Passo 5: Finalizar Google OAuth

### 5.1 Atualizar URIs no Google Cloud Console

Agora que você tem a URL final do Vercel:

1. Volte ao Google Cloud Console
2. Vá em **APIs & Services → Credentials**
3. Clique na credencial OAuth que criou
4. Em **"Authorized JavaScript origins"** e **"Authorized redirect URIs"**, adicione:
   - `https://esteira-recrutamento-xyzabc.vercel.app` (com sua URL real)
5. Clique **"Save"**

---

## 🎉 Testando a Aplicação

1. Acesse `https://seu-app.vercel.app`
2. Clique em **"Entrar com Google"**
3. Use seu email `@shopper.com.br`
4. Se tudo funcionou, você vai entrar como Admin!

---

## 📱 Acessar de Outro Computador

Basta acessar a URL do Vercel de qualquer navegador:
```
https://esteira-recrutamento-xyz.vercel.app
```

---

## ⚙️ Troubleshooting

### "Erro: Use seu e-mail corporativo para entrar"
- Verifique se `COMPANY_DOMAIN` está correto no Vercel
- Padrão: `shopper.com.br`

### "Seu e-mail ainda não tem acesso liberado"
- Você (seu email) precisa estar na tabela `users` como `admin`
- Na Supabase, execute:
```sql
INSERT INTO users (email, role, name) 
VALUES ('seu.email@shopper.com.br', 'admin', 'Seu Nome')
ON CONFLICT (email) DO NOTHING;
```

### Erro de conexão ao banco
- Verifique se `DATABASE_URL` está correto no Vercel
- Teste a URL localmente primeiro:
```bash
DATABASE_URL="sua-url-aqui" npm run dev
```

### CORS error
- Isso não deve acontecer, mas se acontecer, verifique se as URLs do Google estão corretas

---

## 🔐 Segurança

✅ Checklist de segurança implementado:
- [x] Google OAuth (sem senhas em texto)
- [x] HTTPS forçado em produção
- [x] Cookies `httpOnly` (CSRF protection)
- [x] Restrição a domínio corporativo
- [x] RBAC (role-based access control)
- [x] JWT sessions com expiração de 12h

---

## 💰 Custo

| Serviço | Plano Gratuito | Limite | Status |
|---------|---|---|---|
| **Supabase** | Free | 500 MB DB, 5 GB/mês | ✅ Suficiente |
| **Vercel** | Free | 100 GB/mês | ✅ Suficiente |
| **Google Cloud** | Free | 1M requests/dia | ✅ Suficiente |

**Total: R$ 0/mês**

---

---

## 🛡️ Segurança Implementada

✅ **Rate Limiting**: Máximo 10 tentativas de login a cada 15 minutos
✅ **Audit Log**: Todas as mudanças de usuário/permissão são registradas
✅ **Limite de Request**: Máximo 10MB por request (proteção contra DoS)
✅ **HTTPS Forçado**: Todas as conexões redirecionadas para HTTPS
✅ **Cookies HttpOnly**: Proteção contra XSS/CSRF
✅ **SQL Injection Prevention**: Usando parameterized queries

**Admin pode acessar logs de auditoria:**
```
GET /api/audit-log
```
(Retorna últimas 100 ações de admins)

---

## 💾 Backup & Disaster Recovery

### Backups Automáticos (Supabase)

Supabase faz backups automáticos **todos os dias**:
1. Acesse seu projeto Supabase
2. Vá em **Settings → Database → Backups**
3. Você verá backups diários (últimos 7 dias mantidos)

### Manual Backup (Recomendado - 1x/semana)

```bash
# Conecte via pgAdmin ou linha de comando:
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d).sql

# Depois comprima e guarde num lugar seguro:
gzip backup_*.sql
aws s3 cp backup_*.sql.gz s3://seu-bucket/backups/
```

### Restaurar do Backup

Se algo der muito errado:

1. **Supabase**: Go to **Settings → Database → Backups** → click "Restore"
2. **Manual**: `psql -h db.xxx.supabase.co -U postgres -d postgres < backup.sql`

⚠️ **Aviso**: Restaurar vai sobrescrever todos os dados atuais. Faça backup do backup antes!

### Disaster Recovery Checklist

- [x] Supabase faz backups automáticos
- [ ] (Opcional) Você fez primeiro backup manual?
- [ ] Você testou restaurar um backup (em staging)?
- [ ] Você tem a senha do Supabase em lugar seguro?
- [ ] Você sabe acessar `/api/audit-log` para ver quem fez o quê?

---

## 🔍 Auditoria & Compliance

Todas as ações de admin são registradas em `admin_audit_log`:
- **user_created** — Novo usuário adicionado
- **user_role_changed** — Permissão alterada
- **user_deleted** — Usuário removido

**O que fica registrado:**
- ✅ Quem fez (email)
- ✅ Quando fez (timestamp)
- ✅ O quê mudou (old_value → new_value)
- ✅ De onde fez (IP address)

**Para investigar um incidente:**
```bash
SELECT * FROM admin_audit_log 
WHERE admin_email = 'admin@shopper.com.br' 
ORDER BY created_at DESC;
```

---

## 📞 Próximos Passos

1. **Domínio customizado**: Compre um domínio e aponte para o Vercel
2. **Notificações por email**: Integre SendGrid ou Mailgun para alertas
3. **Monitoramento**: Adicione Sentry (sentry.io) para rastrear erros em produção
4. **2FA**: Considerar implementar autenticação em 2 fatores

---

**Dúvidas?** Verifique o arquivo `.env.example` para ter certeza que nenhuma variável foi perdida.
