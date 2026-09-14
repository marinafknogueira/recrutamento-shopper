# Esteira de Recrutamento — Shopper

Aplicação web própria (não depende de planilha) para centralizar a abertura, aprovação, priorização e acompanhamento de vagas. Login feito com a conta Google corporativa (Workspace); os dados ficam em um banco de dados real (PostgreSQL) dentro da própria aplicação — pronta para rodar na nuvem, no Google Cloud Run.

## Como funciona o fluxo

1. **Gestor** cria a vaga preenchendo o job description completo → fica como *Rascunho*.
2. Gestor envia a vaga → status *Aguardando aprovação do CEO*.
3. **CEO** aprova ou reprova (com motivo). Se reprovada, volta para o gestor editar e reenviar.
4. Vaga aprovada → **Talentos** define prioridade e responsável → status *Em recrutamento*.
5. Talentos marca a vaga como *Preenchida* ou *Encerrada* ao final.
6. **Admin** (você) enxerga e pode agir em todas as etapas, além de controlar quem tem acesso e em qual nível pelo painel de Usuários.

Cada vaga guarda um histórico completo de todas as mudanças de status, com quem fez e quando.

## Passo 1 — Criar as credenciais de login com Google

Como todos na empresa usam Google Workspace, o login é feito com "Entrar com Google", sem senha própria no sistema.

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) com uma conta do Workspace da empresa.
2. Crie um projeto novo (ou use um existente).
3. Vá em **APIs e Serviços > Tela de consentimento OAuth**. Escolha "Interno" (assim só e-mails do domínio da empresa conseguem logar) e preencha nome do app e e-mail de suporte.
4. Vá em **APIs e Serviços > Credenciais > Criar credenciais > ID do cliente OAuth**.
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Em **Origens JavaScript autorizadas**, adicione o endereço onde o app vai rodar (ex: `https://recrutamento-shopper-xxxxx.run.app`, o endereço que o Cloud Run vai gerar).
5. Copie o **Client ID** gerado (termina em `.apps.googleusercontent.com`).

## Passo 2 — Banco de dados (PostgreSQL / Cloud SQL)

O sistema usa PostgreSQL como banco de dados — não é mais SQLite, porque no Cloud Run cada execução do app pode rodar em uma máquina diferente e um arquivo local se perderia. O guia completo de como criar o banco no Google Cloud SQL está no documento **GUIA-COMPLETO-do-zero-ao-sistema-no-ar.docx**, feito para ser seguido do zero, sem experiência técnica.

## Passo 3 — Configurar o projeto

1. Copie o arquivo `.env.example` e renomeie para `.env`.
2. Preencha:
   - `GOOGLE_CLIENT_ID`: o Client ID do passo 1.
   - `COMPANY_DOMAIN`: o domínio de e-mail da empresa (ex: `shopper.com.br`) — qualquer login fora desse domínio é bloqueado automaticamente.
   - `ADMIN_EMAIL`: o seu e-mail corporativo. Esse e-mail é sempre cadastrado como Admin automaticamente ao iniciar o servidor.
   - `JWT_SECRET`: qualquer texto longo e aleatório (usado só para assinar a sessão de login).
   - As variáveis do banco de dados (`INSTANCE_CONNECTION_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` para Cloud Run, ou `DATABASE_URL` para rodar local) — ver comentários no próprio `.env.example`.

## Passo 4 — Publicar no Google Cloud Run

Siga o documento **GUIA-COMPLETO-do-zero-ao-sistema-no-ar.docx**, que cobre clique por clique: criar o projeto no Google Cloud, criar o banco de dados no Cloud SQL, publicar o app no Cloud Run pelo Cloud Shell (sem instalar nada no seu computador), ligar o app ao banco, configurar as variáveis de ambiente, atualizar as credenciais do Google com o endereço final, cadastrar as pessoas e resolver os erros mais comuns.

Este ambiente de construção não tem acesso à internet para baixar pacotes (`npm install`) nem para rodar comandos do Google Cloud, então a publicação é feita pelo **Google Cloud Shell**, que já roda direto no navegador com tudo pré-instalado — sem precisar instalar nada na sua máquina.

## Passo 5 — Cadastrar os primeiros usuários

Só o Admin (você) consegue acessar a aba **Usuários**. Lá você adiciona cada e-mail corporativo e escolhe o nível: `admin`, `ceo`, `gestor` ou `talentos`. Quem não estiver cadastrado recebe uma mensagem de acesso negado ao tentar entrar.

## Estrutura do projeto

```
recrutamento-shopper/
  server.js       -> backend (API, autenticação, regras de negócio)
  db.js           -> definição do banco de dados (PostgreSQL)
  public/         -> frontend (HTML/CSS/JS)
  .env.example    -> modelo de configuração
```

## Observações importantes

- O banco de dados roda separado do app (Cloud SQL), então ele não se perde mesmo que o Cloud Run reinicie ou escale para várias instâncias — diferente do SQLite em arquivo, que não é seguro nesse cenário.
- Hoje, um gestor vê apenas as vagas em que ele é o gestor responsável. Se preferir que todo gestor veja todas as vagas (não só as suas), me avise que ajusto essa regra.
- O código não pôde ser testado rodando de ponta a ponta neste ambiente de construção (sem acesso à internet para instalar pacotes/rodar comandos gcloud). A sintaxe de todos os arquivos foi verificada, mas o primeiro teste real acontece quando você seguir o guia de publicação.
