# SENX — CTI · 1.5.0.0

Interface HTML/CSS/JS em `Aplicacao/SenxCti.Web/wwwroot`, servida pela API C#/.NET 10 em `BackEnd/SenxCti.Api`. PostgreSQL com Npgsql e EF Core. Solução: `BackEnd/Projeto.SENX.CTI.slnx`.

## Executar

No Windows, abra `Instalar-SENX.cmd` na raiz. Ele verifica .NET 10 SDK/PostgreSQL 18, prepara usuário/banco, solicita senhas, importa somente banco vazio, faz backup, aplica migrações e salva a conexão privada. A opção 2 apenas inicia uma máquina já preparada. Os dois arquivos `Instalar-SENX.cmd` e `Instalar-SENX.ps1` devem acompanhar o projeto completo. Programas ausentes precisam ser instalados pelos links indicados na tela. Banco existente exige confirmação antes das migrações.

1. Configure `SENX_DB_CONNECTION` no ambiente ou em `BackEnd/SenxCti.Api/appsettings.Local.json` (somente Development; ignorado pelo Git).
2. Banco novo: utilize o schema consolidado `Banco_De_Dados/recriar-banco-1.0.0.ps1 -Database NOME_DO_BANCO` ou importe `Banco_De_Dados/senx.sql` seguido de `Banco_De_Dados/atualizar-0.1.4.ps1` e `Banco_De_Dados/atualizar-0.1.5.ps1`. Os scripts fazem backup antes de cada migração/reset.
3. Execute `npm start` e abra `http://localhost:5080`.
4. Sem contas cadastradas, a tela oferece criação do primeiro administrador. Demais contas são criadas por administradores.

## Entrega integrada (1.5.0.0)

- **Sessão, acesso e cadastros:** Perfil, senha, equipes, usuários, critérios e **clientes (`DadosCliente`)** com persistência PostgreSQL e autorização por perfil (`Administrador` e `Colaborador`).
- **Gestão de Clientes (`#clientes` e `#administracao/clientes`):** Cadastro e edição de clientes (`POST/PUT /api/data/customers`) com e-mail, telefone, atendente responsável, situação e consentimento de gravação, além de filtro rápido para consultar todas as ligações vinculadas ao cliente.
- **Autenticação segura:** Lembre-me opcional (sessão persistente por até 14 dias quando marcado; cookie de sessão de 8 horas quando desmarcado). Logout, troca de senha e desativação revogam o acesso imediatamente. Suporte híbrido a hashes Identity PBKDF2 e BCrypt (custo 12).
- **Ingestão de áudio (`Services/Audio`):** Upload de WAV/MP3/OGG/M4A (até 20 MiB) em **Ligações → Enviar gravação**, com seleção de cliente previamente cadastrado, preenchimento automático de telefone, análise automática e reprodução protegida (`HTTP Range`). `SENX_AUDIO_ROOT` aceita uma pasta absoluta (padrão privado: `BackEnd/SenxCti.Api/App_Data/Audio`). Importação administrativa de arquivo dessa pasta via `POST /api/ligacoes/import`. Projeto educativo do CTI, sem fornecedor PABX externo.
- **Inteligência Artificial integrada (`Services/Ai`):** Configure `GEMINI_API_KEY` e, opcionalmente, `GROQ_API_KEY` no ambiente. Gemini aceita modelos configuráveis e reserva Groq. Sem chave, a API informa indisponibilidade. Para demonstração local, habilite `Ai__AllowSimulation=true`. Resultados simulados ficam fora das médias reais. Sem critérios ativos, a transcrição e o resumo são gerados sem nota automática.
- **Duração do áudio:** novos uploads e importações registram a duração lida do arquivo. Áudio inválido retorna HTTP 422. A ligação e a análise são gravadas juntas após processamento bem-sucedido. Registros anteriores com duração zero exigem correção separada.
- **Revisão humana e relatórios:** Revisão e validação humanas separadas da saída original da IA, com controle de conflito entre sessões por UUID. Relatórios descritivos persistidos por equipe e período (Qualidade, Retenção, Desenvolvimento e Conformidade).
- **Consulta e paginação:** Consulta inicial de 200 ligações, com carregamento progressivo até 10 mil. Ranking disponível por equipe e período, com média de notas humanas validadas (incluindo zero), duração média, busca e exportação. Simulações ficam fora da média de notas; regra de mínimo de 20 ligações e FCR não foram implementadas.

Para banco vazio com seed mínimo: `Banco_De_Dados/recriar-banco-1.0.0.ps1 -Database NOME_DO_BANCO`; a senha inicial de `admin@senx.com` é solicitada de forma oculta e armazenada com BCrypt. Banco existente só é apagado com `-Reset -ConfirmReset NOME_DO_BANCO`, após backup. Não execute reset para apenas atualizar a aplicação.

## Publicar

`dotnet publish BackEnd/SenxCti.Api -c Release`. Em Production, configure `SENX_DB_CONNECTION` e `Jwt__Key` (pelo menos 32 bytes), use HTTPS e mantenha o banco/arquivos privados. As rotas da interface funcionam também em Production. Para restringir a API ao próprio computador, configure `SENX_LOCAL_ONLY=true`.

## Verificar

- `npm test`: testes de interface, clientes, sessão e diagnóstico (18/18).
- `dotnet build BackEnd/Projeto.SENX.CTI.slnx -c Release`: compilação sem avisos ou erros.
- `dotnet run --project BackEnd/SenxCti.Tests`: suíte isolada (1466 verificações), incluindo carga em memória.
- `dotnet run --project BackEnd/SenxCti.Tests -- --ai-service-checks`: parser, fallback offline, compatibilidade de senhas e adaptadores HTTP interceptados (15 verificações).
- `dotnet run --project BackEnd/SenxCti.Tests -- --audio-integration`: exige `SENX_TEST_DB_CONNECTION` explícita para QA; upload/importação, análise simulada, revisão e relatório com limpeza dos IDs criados (18 verificações).
- `dotnet run --project BackEnd/SenxCti.Tests -- --delivery-integration`: integração real com registros temporários identificados por UUID, removidos ao finalizar.
- Diagnóstico separado: `npm run diagnostico`, `http://localhost:4174`.

Consulte também: [Documentacao/README.md](Documentacao/README.md), [APIs/README.md](APIs/README.md), [Banco_De_Dados/README.md](Banco_De_Dados/README.md) e [Aplicacao/SenxCti.Web/README.md](Aplicacao/SenxCti.Web/README.md).

## Prioridade de análise no código atual

Apesar da versão exibida permanecer v1.5.0.0, o código inclui `priority` (0 normal, 1 média, 2 alta) e `priorityReason`, independentes da nota. O snapshot prioriza esses registros antes da data. Bancos antigos precisam de `Banco_De_Dados/migrations/1.5.1-prioridade-analise.sql` (nome do arquivo preservado); os schemas de instalação nova já incluem as colunas. Essa migração não foi executada nesta revisão documental.
