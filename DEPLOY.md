# Guia de Deploy 100% Gratuito — SENX CTI 1.0.0.0

Este guia ensina o passo a passo para colocar o **SENX CTI** online gratuitamente utilizando **Neon.tech** (PostgreSQL Grátis Permanente) e **Render.com** (Serviço Web Grátis com Docker).

---

## 1. Criar o Banco de Dados Gratuito no Neon

1. Acesse **[neon.tech](https://neon.tech)** e crie uma conta gratuita (pode entrar com sua conta do GitHub).
2. Crie um novo projeto (ex: `senx-cti-db`).
3. No painel do Neon, clique na aba **SQL Editor**.
4. Abra o arquivo [`Banco_De_Dados/neon-setup.sql`](Banco_De_Dados/neon-setup.sql) deste repositório, copie todo o seu conteúdo, cole no SQL Editor do Neon e clique no botão **Run**.
   - *Ele é 100% SQL puro, otimizado para o editor web, e criará todas as 14 tabelas, índices e relacionamentos em poucos segundos.*
5. No painel principal (**Dashboard**) do Neon, localize a **Connection Details**:
   - Selecione a opção **`.NET / Npgsql`** ou copie a Connection String completa.
   - Ela terá o formato:
     ```text
     Host=ep-xxxxxx.us-east-2.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=SUA_SENHA;SslMode=Require;
     ```
   - **Importante:** Certifique-se de que `SslMode=Require;` está presente no final da string.

---

## 2. Publicar a Aplicação no Render

1. Acesse **[render.com](https://render.com)** e crie sua conta gratuita com o GitHub.
2. No painel do Render, clique no botão **New +** e selecione **Web Service**.
3. Selecione a opção **"Build and deploy from a Git repository"** e clique em **Next**.
4. Conecte sua conta do GitHub e escolha o repositório **`Projeto_SENX_CTI`**.
5. Preencha as configurações do serviço:
   - **Name:** `senx-cti` *(ou outro nome de sua preferência)*
   - **Region:** `Ohio (US East)` *(recomendado escolher a mesma região do Neon para menor latência)*
   - **Branch:** `main`
   - **Runtime:** `Docker` *(o Render detectará o Dockerfile automaticamente)*
   - **Instance Type:** `Free` ($0/mês)
6. Role a página até a seção **Environment Variables** (Variáveis de Ambiente) e adicione as seguintes chaves:

| Nome da Chave | Valor |
| :--- | :--- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `SENX_DB_CONNECTION` | *A connection string completa que você copiou do Neon* |
| `Jwt__Key` | *Uma frase secreta com pelo menos 32 caracteres, ex:* `SenxCti_Chave_Super_Segura_2026_Prod_Key` |
| `GEMINI_API_KEY` | *A sua chave da Google AI Studio* |
| `SENX_AUDIO_ROOT` | `/app/audio` |

7. Clique no botão **Create Web Service** no final da página.

---

## 3. Primeiro Acesso

O Render iniciará a compilação e, em cerca de 3 a 4 minutos, exibirá o status `Live` com a sua URL pública:
👉 `https://senx-cti.onrender.com`

1. Abra a URL no seu navegador.
2. Como o banco do Neon estará limpo e sem usuários, a tela inicial apresentará automaticamente o formulário para você **criar a conta do Administrador principal**.
3. Defina seu nome, e-mail e senha.
4. Pronto! O sistema já estará 100% funcional, conectado ao banco de dados na nuvem e com a inteligência artificial do Gemini ativa.
