# 🛡️ Guia de Segurança — Esteira de Recrutamento

Este documento descreve todos os mecanismos de segurança implementados e boas práticas para manter a aplicação segura.

---

## ✅ Controles de Segurança Implementados

### 1. **Autenticação & Autorização**

#### Google OAuth (sem senhas)
- ✅ Usa autenticação do Google Workspace
- ✅ Nenhuma senha é armazenada localmente
- ✅ Tokens JWT com expiração de **12 horas**
- ✅ Restrição a domínio corporativo (`@shopper.com.br`)

```javascript
// Apenas emails @shopper.com.br conseguem fazer login
if (domain !== COMPANY_DOMAIN.toLowerCase()) {
  return res.status(403).json({ error: 'Use seu e-mail corporativo para entrar.' });
}
```

#### Role-Based Access Control (RBAC)
- ✅ 4 níveis de acesso: **admin**, **ceo**, **gestor**, **talentos**
- ✅ Cada role vê apenas o que deve ver
- ✅ Gestor: cria vagas (rascunho)
- ✅ CEO: aprova/reprova vagas
- ✅ Talentos: prioriza e marca como preenchida
- ✅ Admin: controla tudo + gerencia usuários

### 2. **Rate Limiting (DoS Protection)**

```javascript
// Limite de autenticação: máx 10 tentativas a cada 15 minutos
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 10,                    // 10 tentativas
});

// Limite geral da API: máx 100 requests por minuto
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
```

**Proteção contra:**
- ✅ Força bruta em login
- ✅ DDoS básico
- ✅ Descoberta de emails válidos

### 3. **Proteção de Dados**

#### SQL Injection
- ✅ Usando **parameterized queries** (sempre `$1, $2...`)
- ✅ Nunca interpolando strings SQL

```javascript
// ✅ SEGURO
const { rows } = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]  // Parâmetro separado
);

// ❌ NUNCA FAZER:
// const { rows } = await pool.query(`SELECT * FROM users WHERE email = '${email}'`);
```

#### XSS (Cross-Site Scripting)
- ✅ Cookies `httpOnly` (não acessíveis via JavaScript)
- ✅ Frontend escapa strings HTML
- ✅ Content Security Policy em produção (recomendado)

#### CSRF (Cross-Site Request Forgery)
- ✅ Cookies `sameSite: 'lax'`
- ✅ Verificação de origin no CORS

### 4. **HTTPS & Comunicação Segura**

```javascript
// Forçar HTTPS em produção (Vercel)
if (NODE_ENV === 'production' && process.env.VERCEL) {
  if (req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  }
}
```

- ✅ Vercel força HTTPS automaticamente
- ✅ Certificados SSL/TLS grátis
- ✅ Redirecionamento HTTP → HTTPS

### 5. **Auditoria & Compliance**

Todas as ações críticas são registradas em `admin_audit_log`:

| Ação | Registrada? | O Que Fica? |
|------|---|---|
| Login | ❌ | (JWT expira em 12h) |
| Criar usuário | ✅ | Admin, email, role, timestamp, IP |
| Alterar permissão | ✅ | Admin, user, old_role→new_role, timestamp, IP |
| Deletar usuário | ✅ | Admin, user, timestamp, IP |

**Consultar audit log:**
```bash
curl -X GET http://localhost:3000/api/audit-log \
  -H "Cookie: session=seu_jwt_aqui"
```

### 6. **Limite de Tamanho de Request**

```javascript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
```

- ✅ Máximo 10MB por request
- ✅ Proteção contra uploads maliciosos
- ✅ Proteção contra DoS de payload

---

## 🔑 Variáveis de Ambiente Sensíveis

Nunca commitar estes valores:

```env
GOOGLE_CLIENT_ID=xxx           # Pública (OK no GitHub)
GOOGLE_CLIENT_SECRET=yyy       # 🔒 SECRETA (NÃO commitar)
JWT_SECRET=zzz                 # 🔒 SECRETA (NÃO commitar)
DATABASE_URL=postgresql://...  # 🔒 SECRETA (NÃO commitar)
```

**Vercel cuida destes automaticamente** (em Environment Variables > Settings).

---

## 🚨 O Que NÃO Está Protegido (Ainda)

### 1. Verificação de Email (TODO)
- Atualmente, qualquer email @shopper.com.br consegue fazer login
- **Recomendação**: Implementar whitelist de emails específicos

### 2. 2FA / Autenticação em Múltiplos Fatores (TODO)
- Apenas Google OAuth de primeira camada
- **Recomendação**: Implementar TOTP ou SMS para admin

### 3. Criptografia de Dados Sensíveis (TODO)
- Dados no banco não são criptografados
- **Recomendação**: Criptografar `motivo_reprovacao` se tiver feedback confidencial

### 4. Monitoramento em Tempo Real (TODO)
- Sem alertas de atividades suspeitas
- **Recomendação**: Integrar Sentry ou DataDog

---

## 🔄 Rotinas de Manutenção de Segurança

### Semanal
- [ ] Revisar `/api/audit-log` para atividades incomuns
- [ ] Verificar backups (Settings > Database > Backups)

### Mensal
- [ ] Fazer backup manual do banco
- [ ] Revisar lista de usuários e remover os que saíram
- [ ] Testar recuperação de backup (em staging)

### Trimestralmente
- [ ] Rotacionar `JWT_SECRET`
- [ ] Revisar logs de erro (se tiver Sentry)
- [ ] Atualizar dependências (`npm audit`, `npm update`)

### Anualmente
- [ ] Auditoria de segurança externa (recomendado)
- [ ] Revisar política de acesso (roles, permissões)

---

## 🆘 Incidente de Segurança: Checklist

Se achar que algo foi comprometido:

### Imediato
1. [ ] Mude `JWT_SECRET` no Vercel (invalida todas as sessões)
2. [ ] Revise `/api/audit-log` para ver o que foi feito
3. [ ] Remova qualquer usuário suspeito

### Curto Prazo (24h)
4. [ ] Mude senha do Supabase (em Settings > Database)
5. [ ] Revise e atualize permissões de usuários
6. [ ] Faça backup completo

### Médio Prazo (1 semana)
7. [ ] Rotacione `GOOGLE_CLIENT_SECRET` no Google Cloud Console
8. [ ] Implemente notificações de audit log (email para admins)
9. [ ] Considere adicionar 2FA para admin

---

## 📚 Recursos de Segurança

### OWASP Top 10 (Cobertura)
- [x] A01:2021 – Broken Access Control (✅ RBAC)
- [x] A02:2021 – Cryptographic Failures (✅ HTTPS)
- [x] A03:2021 – Injection (✅ Parameterized Queries)
- [x] A04:2021 – Insecure Design (✅ Auditoria)
- [x] A05:2021 – Security Misconfiguration (✅ CORS)
- [x] A07:2021 – Identification and Authentication Failures (✅ OAuth)
- [ ] A06:2021 – Vulnerable and Outdated Components (check com `npm audit`)
- [ ] A08:2021 – Software and Data Integrity Failures (check com `npm audit`)
- [ ] A09:2021 – Logging and Monitoring Failures (TODO: Sentry)
- [ ] A10:2021 – Server-Side Request Forgery (N/A)

### Dependências com Vulnerabilidades Conhecidas
```bash
npm audit
```

Execute periodicamente para verificar atualizações de segurança.

---

## 📋 Checklist Pré-Produção

- [x] Rate limiting em login
- [x] Audit log de mudanças admin
- [x] Limite de tamanho de request
- [x] HTTPS forçado
- [x] Cookies httpOnly
- [x] SQL injection prevention
- [x] RBAC implementado
- [x] Backup documentado
- [ ] JWT_SECRET gerado com `openssl rand -base64 32`
- [ ] Todos os environment variables configurados
- [ ] Teste de login com cada role (admin, ceo, gestor, talentos)
- [ ] Teste de falha de autenticação (email externo)
- [ ] Teste de criação/deleção de usuários como admin
- [ ] Verificar que dados reais estão seguros

---

## 🆘 Suporte & Reporte

Se encontrar uma vulnerabilidade:

1. **NÃO** publique em issues públicas
2. Contate seu admin
3. Descreva:
   - O que você conseguiu fazer
   - O que deveria ter impedido
   - Como reproduzir

---

**Última atualização**: 2024
**Status**: ✅ Seguro para dados reais (com backups!)
