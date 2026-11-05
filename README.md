# SENX — CTI · 1.0.0.0

Interface HTML/CSS/JS em `Aplicacao/SenxCti.Web/wwwroot`, servida pela API C#/.NET 10 em `BackEnd/SenxCti.Api`. PostgreSQL com Npgsql e EF Core. Solução: `BackEnd/Projeto.SENX.CTI.slnx`.

## Executar

No Windows, abra `Instalar-SENX.cmd` na raiz. Ele verifica .NET 10 SDK/PostgreSQL 18, prepara usuario/banco, solicita senhas, importa somente banco vazio, faz backup, aplica migracoes e salva a conexao privada. A opcao 2 apenas inicia uma maquina ja preparada. Os dois arquivos `Instalar-SENX.cmd` e `Instalar-SENX.ps1` devem acompanhar o projeto completo. Programas ausentes precisam ser instalados pelos links indicados na tela. Banco existente exige confirmacao antes das migracoes.

1. Configure `SENX_DB_CONNECTION` no ambiente ou em `BackEnd/SenxCti.Api/appsettings.Local.json` (somente Development; ignorado pelo Git).
2. Banco novo: importe `Banco_De_Dados/senx.sql`. Aplique `Banco_De_Dados/atualizar-0.1.4.ps1` e depois `Banco_De_Dados/atualizar-0.1.5.ps1`. Os scripts fazem backup antes de cada migração.
3. Execute `npm start` e abra http://localhost:5080.
4. Sem contas cadastradas, a tela oferece criação do primeiro administrador. Demais contas são criadas por administradores.

## Entrega integrada

- Sessão, perfil, senha, equipes, usuários e critérios com persistência PostgreSQL e autorização.
- Lembre-me opcional: sessão persistente por até 14 dias quando marcado; desmarcado, cookie de sessão com validade máxima de 8 horas. Logout, troca de senha e desativação revogam o acesso. CRUD anônimo fica desabilitado por padrão.
- Ativação/desativação de contas; desativar invalida o acesso anterior.
- Consulta de ligações/análises existentes; revisão e validação humanas separadas da saída original da IA, com controle de conflito entre sessões.
- Relatórios descritivos persistidos, por equipe e período, com volume, análises, revisões e média das notas registradas. Não calculam FCR ou conformidade.
- Upload de WAV/MP3/OGG/M4A (até 20 MiB) em Ligações, análise e reprodução protegida. `SENX_AUDIO_ROOT` aceita uma pasta absoluta; padrão privado: `BackEnd/SenxCti.Api/App_Data/Audio`. Importação administrativa de arquivo dessa pasta: `POST /api/ligacoes/import` com fileName e os mesmos campos do upload. Projeto educativo, sem fornecedor PABX externo.
- Consulta inicial de 200 ligações, com carregamento progressivo até 10 mil. Filtros, métricas da lista e exportações usam o recorte carregado. Relatórios usam consultas agregadas no servidor.
- Ranking aguarda fórmula e elegibilidade aprovadas; a tela explica essa pendência.

A IA integrada usa Gemini e reserva Groq; consulte `Services/Ai`. Configure `GEMINI_API_KEY` e opcionalmente `GROQ_API_KEY` no ambiente, nunca no Git. Modelos podem ser ajustados em `Gemini:AnalysisModel`, `Gemini:FallbackAnalysisModel` e `Fallback:Groq:Model`. Sem chaves, funciona uma demonstração explicitamente simulada, excluída das médias reais. Com chaves inválidas ou serviço indisponível, retorna falha controlada. Áudio pode sair da máquina quando um provedor estiver configurado.

Para banco vazio com seed mínimo: `Banco_De_Dados/recriar-banco-1.0.0.ps1 -Database NOME_DO_BANCO`; a senha inicial de admin@senx.com é solicitada de forma oculta e armazenada com BCrypt. Banco existente só é apagado com `-Reset -ConfirmReset NOME_DO_BANCO`, após backup. Não execute reset para apenas atualizar a aplicação. O schema consolidado substitui a sequência de migrações em instalações novas.

## Publicar

`dotnet publish BackEnd/SenxCti.Api -c Release`. Em Production, configure `SENX_DB_CONNECTION` e `Jwt__Key` (pelo menos 32 bytes), use HTTPS e mantenha o banco/arquivos privados. As rotas da interface funcionam também em Production. Para restringir a API ao próprio computador, configure `SENX_LOCAL_ONLY=true`.

## Verificar

- `npm test`: testes de interface, sessão e diagnóstico.
- `dotnet build BackEnd/Projeto.SENX.CTI.slnx`
- `dotnet run --project BackEnd/SenxCti.Tests -- --delivery-integration`: integração real com registros temporários identificados por UUID, removidos ao finalizar. Execute apenas em banco de desenvolvimento.
- `dotnet run --project BackEnd/SenxCti.Tests`: suíte isolada, incluindo carga em memória.
- `dotnet run --project BackEnd/SenxCti.Tests -- --ai-service-checks`: parser, fallback offline e compatibilidade de senhas. Com `SENX_TEST_DB_CONNECTION`, verifica adaptadores HTTP interceptados, sem consumo externo.
- `dotnet run --project BackEnd/SenxCti.Tests -- --audio-integration`: exige `SENX_TEST_DB_CONNECTION` explícita para QA; upload/importação, análise simulada, revisão e relatório com limpeza dos IDs criados.
- Diagnóstico separado: `npm run diagnostico`, http://localhost:4174.

Decisões, relatórios de implementação e pendências ficam no Obsidian, projeto SENX — CTI.
