# 🚀 Como Usar: Guia Rápido

Siga estes 3 caminhos:

---

## 📖 Cenário 1: Quero rodar LOCAL (no meu computador)

### Passo 1: Instalar Node.js
1. Acesse [nodejs.org](https://nodejs.org)
2. Baixe a versão LTS (ex: v20)
3. Instale e abra um novo terminal/PowerShell

### Passo 2: Preparar o projeto
```bash
cd "C:\Users\marina.nogueira\Desktop\claude planilhas\recrutamento-shopper"
npm install
```

### Passo 3: Criar arquivo `.env`
Copie `.env.example` para `.env`:
```bash
cp .env.example .env
```

Abra `.env` e preencha com valores **de teste** (pode usar fictícios):
```
GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
COMPANY_DOMAIN=shopper.com.br
ADMIN_EMAIL=seu.email@shopper.com.br
JWT_SECRET=abc123def456ghi789jkl000 (qualquer coisa aleatória)
DATABASE_URL=postgresql://usuario:senha@localhost:5432/recrutamento
PORT=3000
NODE_ENV=development
```

### Passo 4: Preparar Banco de Dados Local (opcional)

Se tiver PostgreSQL instalado:
```bash
psql -U postgres
CREATE DATABASE recrutamento;
\q
```

Se NÃO tiver, use Supabase (pule para Cenário 2).

### Passo 5: Rodar o app
```bash
npm run dev
```

Deve aparecer:
```
Servidor rodando na porta 3000
```

Abra: **http://localhost:3000**

---

## 🌍 Cenário 2: Quero colocar NA INTERNET (Supabase + Vercel)

### Passo 1: Criar conta Supabase (5 min)

1. Vá para [supabase.com](https://supabase.com)
2. Clique **Sign Up** com GitHub/Google
3. Clique **New Project**
4. Preencha:
   - **Project name**: `esteira-recrutamento`
   - **Password**: Crie uma senha forte (ex: `K9$mLp2#xQw8@nR`)
   - **Region**: Choose Brazil (São Paulo)
5. Clique **Create new project** (espera ~2 minutos)

### Passo 2: Criar Tabelas no Supabase (5 min)

1. Clique em **SQL Editor** (lado esquerdo)
2. Clique **New Query**
3. Cole isto:

```sql
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

INSERT INTO users (email, role, name) 
VALUES ('marina@shopper.com.br', 'admin', 'Marina Admin')
ON CONFLICT (email) DO NOTHING;
```

4. Clique **Run** (triângulo verde)
5. ✅ Pronto!

### Passo 3: Copiar URL do Banco

1. Clique em **Settings** (engrenagem)
2. Vá em **Database**
3. Procure por **Connection String**
4. Clique na aba **URI**
5. Copie a URL (começa com `postgresql://`)
6. **Guarde essa URL!**

### Passo 4: Configurar Google OAuth (10 min)

1. Vá para [console.cloud.google.com](https://console.cloud.google.com)
2. No topo, clique em **Select a Project** → **New Project**
3. Nome: `esteira-recrutamento`
4. Clique **Create**
5. Espera carregar, depois:
6. Procure por **Google+ API** (search bar)
7. Clique nela → **Enable**
8. Volte para **APIs & Services → Credentials**
9. Clique **+ Create Credentials** → **OAuth client ID**
10. Se pedir "Create OAuth consent screen", clique e complete (depois volta aqui)
11. Tipo: **Web application**
12. Nome: `esteira-recrutamento`
13. Em **Authorized JavaScript origins**, clique **Add URI**:
    - `http://localhost:3000` (para teste)
    - (Depois você adiciona a URL do Vercel)
14. Clique **Create**
15. **Copie o Client ID** (vai parecer com: `123456789-abc.apps.googleusercontent.com`)
16. **Copie o Client Secret** também

### Passo 5: Subir Código no GitHub (5 min)

1. Abra PowerShell/Terminal na pasta do projeto:
```bash
cd "C:\Users\marina.nogueira\Desktop\claude planilhas\recrutamento-shopper"
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

2. Crie um repositório no GitHub:
   - Vá para [github.com/new](https://github.com/new)
   - Nome: `recrutamento-shopper`
   - Clique **Create repository**

3. Copie os comandos que aparecem (algo como):
```bash
git remote add origin https://github.com/SEU_USER/recrutamento-shopper.git
git push -u origin main
```

4. Cole no terminal e execute

### Passo 6: Deploy no Vercel (3 min)

1. Vá para [vercel.com](https://vercel.com)
2. Faça login com GitHub
3. Clique **Add New** → **Project**
4. Escolha `recrutamento-shopper`
5. Clique **Import**
6. Em **Environment Variables**, preencha:

```
GOOGLE_CLIENT_ID = (seu Client ID)
GOOGLE_CLIENT_SECRET = (seu Client Secret)
COMPANY_DOMAIN = shopper.com.br
ADMIN_EMAIL = marina@shopper.com.br
JWT_SECRET = (copie a URL do Supabase e mude a senha)
DATABASE_URL = postgresql://postgres:SUA_SENHA@db.xxx.supabase.co:5432/postgres
NODE_ENV = production
```

7. Clique **Deploy**
8. Espera ~2 minutos
9. Vai aparecer uma URL como: `https://esteira-recrutamento-xyz.vercel.app`
10. **Copie essa URL!**

### Passo 7: Finalizar Google OAuth

1. Volte para [console.cloud.google.com](https://console.cloud.google.com)
2. Vá em **Credentials**
3. Clique na credencial OAuth que criou
4. Em **Authorized JavaScript origins**, adicione:
   - `https://esteira-recrutamento-xyz.vercel.app` (sua URL real)
5. Em **Authorized redirect URIs**, adicione:
   - `https://esteira-recrutamento-xyz.vercel.app`
6. Clique **Save**

### Passo 8: Testar! 🎉

1. Acesse `https://esteira-recrutamento-xyz.vercel.app`
2. Clique **Entrar com Google**
3. Use seu email `seu.email@shopper.com.br`
4. ✅ Você está dentro!

---

## 👥 Como Adicionar Outros Usuários

Você (admin) pode adicionar mais pessoas:

1. Dentro do app, clique **Usuários** (menu)
2. Preencha:
   - **Nome**: Nome da pessoa
   - **E-mail**: email@shopper.com.br
   - **Cargo**: Gerente de Operações (ou o que for)
   - **Nível de acesso**: Escolha um:
     - **Gestor** — Cria vagas (rascunho) e vê as suas
     - **CEO** — Aprova/reprova vagas
     - **Talentos** — Prioriza vagas e marca como preenchida
     - **Admin** — Controla tudo
3. Clique **Liberar acesso**

Agora essa pessoa consegue fazer login com seu email Google!

---

## 📝 Fluxo de Vagas: Como Funciona

### 1️⃣ **Gestor** cria vaga
- Menu: **Nova vaga**
- Preenche tudo
- Salva como **Rascunho**

### 2️⃣ **Gestor** envia para CEO
- Na vaga, clica **Enviar para aprovação do CEO**
- Status muda para **Aguardando aprovação**

### 3️⃣ **CEO** aprova ou reprova
- Menu: **Vagas**
- Abre a vaga
- Clica **Aprovar vaga** ou **Reprovar vaga**
- Se reprovar, deixa um motivo
- Status muda para **Aprovada — aguardando priorização** ou **Reprovada**

### 4️⃣ **Talentos** define prioridade
- Menu: **Vagas aprovadas e em andamento**
- Abre vaga
- Clica **Definir prioridade e responsável**
- Escolhe: Alta / Média / Baixa
- Escolhe: Quem vai fazer o recrutamento
- Status muda para **Em recrutamento**

### 5️⃣ **Talentos** marca como preenchida
- Clica **Marcar como preenchida** quando contratar
- OU **Encerrar vaga** se cancelar
- Status muda para **Preenchida** ou **Encerrada**

---

## 📊 Dashboard de Pontuação

**Talentos** podem ver:
- Menu: **Pontuação**
- Quantos pontos ELES ganharam (por vaga preenchida)
- Meta do time (800 pts por semestre)

**Admin** pode ver:
- Menu: **Pontuação**
- Pontos de TODOS do time
- Ranking completo

---

## 🔍 Auditoria (Admin)

Para ver tudo que foi feito:

1. Terminal/bash:
```bash
curl -X GET https://seu-app.vercel.app/api/audit-log \
  -H "Cookie: session=YOUR_JWT"
```

Ou acesse direto no código (Supabase SQL Editor):
```sql
SELECT * FROM admin_audit_log ORDER BY created_at DESC;
```

---

## 🆘 Problemas Comuns

### "Erro: Use seu e-mail corporativo para entrar"
- Seu email **NÃO** é `@shopper.com.br`
- OU a variável `COMPANY_DOMAIN` está errada
- Solução: Mude em Vercel Settings → Environment Variables

### "Seu e-mail ainda não tem acesso liberado"
- Você não está na tabela `users` como admin
- Solução: No Supabase, execute:
```sql
INSERT INTO users (email, role, name) 
VALUES ('seu.email@shopper.com.br', 'admin', 'Seu Nome');
```

### "Conectando ao banco de dados deu erro"
- DATABASE_URL está errado
- Ou a senha mudou
- Solução: Copie a URL correta do Supabase

### "Vercel diz erro 500"
- Log ruim
- Vá em Vercel → seu projeto → **Deployments** → último deploy → **Runtime Logs**
- Leia a mensagem de erro
- Geralmente é variável de ambiente errada

---

## 📱 Acessar de Outro Computador

Qualquer pessoa com email `@shopper.com.br` consegue:

1. Abra a URL: `https://seu-app.vercel.app`
2. Clique **Entrar com Google**
3. Pronto!

---

## ✅ Checklist Rápido

Local:
- [ ] `npm install` rodou sem erros?
- [ ] `.env` preenchido?
- [ ] `npm run dev` rodou?
- [ ] Conseguiu acessar `http://localhost:3000`?

Produção:
- [ ] Supabase criado?
- [ ] Tabelas criadas (SQL executado)?
- [ ] GitHub com código?
- [ ] Vercel importou GitHub?
- [ ] Google OAuth configurado?
- [ ] Conseguiu fazer login em produção?

---

**Dúvidas?** Revise:
- `SETUP.md` — Deploy detalhado
- `SECURITY.md` — Segurança
- Abra uma issue no GitHub
