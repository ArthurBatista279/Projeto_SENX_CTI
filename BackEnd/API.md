# API: login, rotas da aplicação e Swagger · 1.0.0.0

Execute `dotnet run --project SenxCti.Api`. No perfil Development, acesse `http://localhost:5080` para a interface integrada ou `http://localhost:5080/swagger` para a documentação OpenAPI dos controllers REST.

## Configuração

- **Banco PostgreSQL:** variável `SENX_DB_CONNECTION` ou `SenxCti.Api/appsettings.Local.json` (carregado em Development e ignorado pelo Git).
- **Schema 1.0.0.0:** para banco novo, execute `../Banco_De_Dados/recriar-banco-1.0.0.ps1 -Database NOME_DO_BANCO` (aplica `senx-1.0.0-limpo.sql`). Para bancos criados em versões anteriores, aplique `../Banco_De_Dados/atualizar-0.1.4.ps1` e `../Banco_De_Dados/atualizar-0.1.5.ps1`.
<<<<<<< HEAD
- **Inteligência Artificial (`Services/Ai`):** configure `Gemini:ApiKey` e `Gemini:AnalysisModel` (ex.: `gemini-3.5-flash`) em `appsettings.Local.json` ou variável de ambiente `GEMINI_API_KEY` (e opcionalmente `GROQ_API_KEY`). Sem chave configurada, o processamento retorna erro de configuração. Demonstração simulada somente com `Ai:AllowSimulation=true`, explicitamente habilitada para testes.
=======
- **Inteligência Artificial (`Services/Ai`):** configure `Gemini:ApiKey` e `Gemini:AnalysisModel` (ex.: `gemini-3.5-flash`) em `appsettings.Local.json` ou variável de ambiente `GEMINI_API_KEY` (e opcionalmente `GROQ_API_KEY`). A simulação requer `Ai__AllowSimulation=true`.
>>>>>>> main
- **Produção:** configure `Jwt__Key` com segredo aleatório de pelo menos 32 bytes, `SENX_DB_CONNECTION` e HTTPS.
- O primeiro administrador pode ser criado pelo seed do schema `1.0.0.0` (`admin@senx.com` com BCrypt custo 12) ou pelo fluxo inicial `/api/auth/setup` quando a tabela `Usuario` está vazia.

## Rotas da Aplicação Web (Cookie HttpOnly + CSRF)

- `/api/auth/*`: `status`, `csrf`, `setup`, `login`, `session`, `profile`, `logout`.
- `GET /api/data/snapshot?limit=200`: carrega chamadas, clientes, equipes, colaboradores, critérios e relatórios conforme o perfil do usuário conectado.
- `POST /api/data/customers` e `PUT /api/data/customers/{id}`: cadastro e edição de clientes (`DadosCliente`).
- `POST /api/data/users` e `PUT /api/data/users/{id}/active`: gestão administrativa de colaboradores.
- `POST /api/data/teams` e `PUT /api/data/teams/{id}`: gestão administrativa de equipes.
- `POST /api/data/criteria` e `PUT /api/data/criteria/{id}`: gestão administrativa de critérios.
- `PUT /api/data/calls/{id}/review`: revisão e validação humana da análise da ligação.
- `POST /api/data/reports`: geração e persistência de relatórios descritivos.
- `GET /api/ligacoes/upload-options`, `POST /api/ligacoes/upload` e `POST /api/ligacoes/import`: ingestão de áudio e análise com IA integrada.
- `GET /api/data/calls/{id}/audio`: streaming protegido (`HTTP Range`) de arquivos dentro de `SENX_AUDIO_ROOT`.

## Uso dos Controllers REST (JWT no Swagger)

1. Envie `POST /api/Login` com `{"email":"...","senha":"..."}`.
2. Copie o campo `token` e cole em **Authorize** no Swagger.
3. Os controllers `/api/{Alerta,Analise,Assunto,DadosCliente,Equipe,Ligacao,Registro,Resultado,Usuario}` exigem JWT de `Administrador` (`Criterio` permite leitura de ativos para `Colaborador`).

Veja também [APIs/README.md](../APIs/README.md) e [SenxCti.Tests/README.md](SenxCti.Tests/README.md).
