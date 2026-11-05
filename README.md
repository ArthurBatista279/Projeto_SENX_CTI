# SENX — CTI · 1.0.0.0

Interface HTML/CSS/JS em `Aplicacao/SenxCti.Web/wwwroot`, servida pela API C#/.NET 10 em `BackEnd/SenxCti.Api`. PostgreSQL com Npgsql e EF Core. Solução: `BackEnd/Projeto.SENX.CTI.slnx`.

## Executar

No Windows, abra `Instalar-SENX.cmd` na raiz. Ele verifica .NET 10 SDK/PostgreSQL 18, prepara usuário/banco, solicita senhas, importa somente banco vazio, faz backup, aplica migrações e salva a conexão privada. A opção 2 apenas inicia uma máquina já preparada. Os dois arquivos `Instalar-SENX.cmd` e `Instalar-SENX.ps1` devem acompanhar o projeto completo. Programas ausentes precisam ser instalados pelos links indicados na tela. Banco existente exige confirmação antes das migrações.

1. Configure `SENX_DB_CONNECTION` no ambiente ou em `BackEnd/SenxCti.Api/appsettings.Local.json` (somente Development; ignorado pelo Git).
2. Banco novo: utilize o schema consolidado `Banco_De_Dados/recriar-banco-1.0.0.ps1 -Database NOME_DO_BANCO` ou importe `Banco_De_Dados/senx.sql` seguido de `Banco_De_Dados/atualizar-0.1.4.ps1` e `Banco_De_Dados/atualizar-0.1.5.ps1`. Os scripts fazem backup antes de cada migração/reset.
3. Execute `npm start` e abra `http://localhost:5080`.
4. Sem contas cadastradas, a tela oferece criação do primeiro administrador. Demais contas são criadas por administradores.

## Entrega integrada (1.0.0.0)

- **Sessão, acesso e cadastros:** Perfil, senha, equipes, usuários, critérios e **clientes (`DadosCliente`)** com persistência PostgreSQL e autorização por perfil (`Administrador` e `Colaborador`).
- **Gestão de Clientes (`#clientes` e `#administracao/clientes`):** Cadastro e edição de clientes (`POST/PUT /api/data/customers`) com e-mail, telefone, atendente responsável, situação e consentimento de gravação, além de filtro rápido para consultar todas as ligações vinculadas ao cliente.
- **Autenticação segura:** Lembre-me opcional (sessão persistente por até 14 dias quando marcado; cookie de sessão de 8 horas quando desmarcado). Logout, troca de senha e desativação revogam o acesso imediatamente. Suporte híbrido a hashes Identity PBKDF2 e BCrypt (custo 12).
- **Ingestão de áudio (`Services/Audio`):** Upload de WAV/MP3/OGG/M4A (até 20 MiB) em **Ligações → Enviar gravação**, com seleção ou cadastro rápido de cliente (`+ Cadastrar cliente`), preenchimento automático de telefone, análise automática e reprodução protegida (`HTTP Range`). `SENX_AUDIO_ROOT` aceita uma pasta absoluta (padrão privado: `BackEnd/SenxCti.Api/App_Data/Audio`). Importação administrativa de arquivo dessa pasta via `POST /api/ligacoes/import`. Projeto educativo do CTI, sem fornecedor PABX externo.
- **Inteligência Artificial integrada (`Services/Ai`):** Usa Google Gemini (ex.: `gemini-3.5-flash`) com fallback de modelo e reserva Groq (ASR Whisper + análise LLM). Configure `GEMINI_API_KEY` (ou `Gemini:ApiKey` e `Gemini:AnalysisModel` em `appsettings.Local.json`) e opcionalmente `GROQ_API_KEY`, nunca no Git. Sem chaves, funciona uma demonstração explicitamente simulada, excluída das médias reais. Com chaves inválidas ou serviço indisponível, retorna falha controlada.
- **Revisão humana e relatórios:** Revisão e validação humanas separadas da saída original da IA, com controle de conflito entre sessões por UUID. Relatórios descritivos persistidos por equipe e período (Qualidade, Retenção, Desenvolvimento e Conformidade).
- **Consulta e paginação:** Consulta inicial de 200 ligações, com carregamento progressivo até 10 mil. Ranking aguarda fórmula e elegibilidade aprovadas; a tela explica essa pendência.

Para banco vazio com seed mínimo: `Banco_De_Dados/recriar-banco-1.0.0.ps1 -Database NOME_DO_BANCO`; a senha inicial de `admin@senx.com` é solicitada de forma oculta e armazenada com BCrypt. Banco existente só é apagado com `-Reset -ConfirmReset NOME_DO_BANCO`, após backup. Não execute reset para apenas atualizar a aplicação.

## Publicar

`dotnet publish BackEnd/SenxCti.Api -c Release`. Em Production, configure `SENX_DB_CONNECTION` e `Jwt__Key` (pelo menos 32 bytes), use HTTPS e mantenha o banco/arquivos privados. As rotas da interface funcionam também em Production. Para restringir a API ao próprio computador, configure `SENX_LOCAL_ONLY=true`.

## Verificar

- `npm test`: testes de interface, clientes, sessão e diagnóstico (13/13).
- `dotnet build BackEnd/Projeto.SENX.CTI.slnx -c Release`: compilação sem avisos ou erros.
- `dotnet run --project BackEnd/SenxCti.Tests`: suíte isolada (1471 verificações), incluindo carga em memória.
- `dotnet run --project BackEnd/SenxCti.Tests -- --ai-service-checks`: parser, fallback offline, compatibilidade de senhas e adaptadores HTTP interceptados (15 verificações).
- `dotnet run --project BackEnd/SenxCti.Tests -- --audio-integration`: exige `SENX_TEST_DB_CONNECTION` explícita para QA; upload/importação, análise simulada, revisão e relatório com limpeza dos IDs criados (18 verificações).
- `dotnet run --project BackEnd/SenxCti.Tests -- --delivery-integration`: integração real com registros temporários identificados por UUID, removidos ao finalizar.
- Diagnóstico separado: `npm run diagnostico`, `http://localhost:4174`.

Consulte também: [Documentacao/README.md](Documentacao/README.md), [APIs/README.md](APIs/README.md), [Banco_De_Dados/README.md](Banco_De_Dados/README.md) e [Aplicacao/SenxCti.Web/README.md](Aplicacao/SenxCti.Web/README.md).
