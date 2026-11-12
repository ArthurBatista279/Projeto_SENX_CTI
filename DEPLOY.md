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
| `Gemini__AnalysisModel` | Padrão `gemini-3.5-flash-lite`. Atualize também a variável do Render se ela estiver definida, pois sobrescreve o arquivo. |
| `Gemini__FallbackAnalysisModel` | Padrão `gemini-3.5-flash`. Reserva sujeita à disponibilidade do provedor. |
| `SENX_AUDIO_ROOT` | `/app/audio` |

7. Clique no botão **Create Web Service** no final da página.

---

## 3. Primeiro Acesso

Quando o deploy estiver em `Live`, copie a URL pública exibida no painel do seu **Web Service**. O domínio depende do serviço criado. Abra a raiz e teste `/api/health` nesse mesmo domínio. Se ambos retornarem 404 com o cabeçalho `x-render-routing: no-server`, confira o endereço e o estado do serviço no painel do Render.

Serviço atual: [SENX CTI](https://projeto-senx-cti.onrender.com/). A branch `production` existe no GitHub como base de release. Confira o commit ativo no Render antes de trocar a branch vinculada ao serviço.

1. Abra a URL no seu navegador.
2. Em uma instalação nova com banco sem usuários, a tela inicial apresenta o formulário para criar o primeiro administrador. Em uma instalação existente, use a conta já cadastrada.
3. Defina seu nome, e-mail e senha.
4. Verifique login e consulta dos dados. O endpoint `/api/health` indica que a API está respondendo. A verificação do banco em `/api/database/health` exige sessão de administrador.

## 4. Preservar gravações e dados em atualizações

- O Neon guarda os registros das ligações e o caminho das gravações. Os arquivos ficam no diretório indicado por `SENX_AUDIO_ROOT`. O armazenamento local padrão do Render é temporário e pode ser perdido ao reiniciar ou publicar.
- Com disco persistente no Render, monte-o em `/app/audio` e mantenha `SENX_AUDIO_ROOT=/app/audio` para reaproveitar os caminhos relativos e a reprodução autenticada. Antes de mudar o serviço, copie os áudios que ainda estiverem disponíveis. Valide o acesso de administrador e do colaborador responsável após o próximo deploy. A alternativa sem disco no serviço exige integrar armazenamento privado de objetos.
- No plano gratuito escolhido para este serviço, a persistência de gravações depende dessa integração com um bucket privado. A configuração atual em `/app/audio` continua temporária. Preserve os arquivos que ainda estiverem disponíveis antes de publicar.
- Para alterações de esquema, valide uma migração incremental em um banco isolado. Confirme a janela de restauração do Neon e prepare um backup antes de aplicar em produção. Reserve `neon-setup.sql` e os scripts de recriação para instalações novas ou resets deliberados.
