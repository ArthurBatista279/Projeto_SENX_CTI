# SENX — CTI · 0.1.5.0

Interface HTML/CSS/JS em `Aplicacao/SenxCti.Web/wwwroot`, servida pela API C#/.NET 10 em `BackEnd/SenxCti.Api`. PostgreSQL com Npgsql e EF Core. Solução: `BackEnd/Projeto.SENX.CTI.slnx`.

## Executar

No Windows, abra `Instalar-SENX.cmd` na raiz. Ele verifica .NET 10 SDK/PostgreSQL 18, prepara usuario/banco, solicita senhas, importa somente banco vazio, faz backup, aplica migracoes e salva a conexao privada. A opcao 2 apenas inicia uma maquina ja preparada. Os dois arquivos `Instalar-SENX.cmd` e `Instalar-SENX.ps1` devem acompanhar o projeto completo. Programas ausentes precisam ser instalados pelos links indicados na tela. Banco existente exige confirmacao antes das migracoes.

1. Configure `SENX_DB_CONNECTION` no ambiente ou em `BackEnd/SenxCti.Api/appsettings.Local.json` (somente Development; ignorado pelo Git).
2. Banco novo: importe `Banco_De_Dados/senx.sql`. Aplique `Banco_De_Dados/atualizar-0.1.4.ps1` e depois `Banco_De_Dados/atualizar-0.1.5.ps1`. Os scripts fazem backup antes de cada migração.
3. Execute `npm start` e abra http://localhost:5080.
4. Sem contas cadastradas, a tela oferece criação do primeiro administrador. Demais contas são criadas por administradores.

## Entrega integrada

- Sessão, perfil, senha, equipes, usuários e critérios com persistência PostgreSQL e autorização.
- Ativação/desativação de contas; desativar invalida o acesso anterior.
- Consulta de ligações/análises existentes; revisão e validação humanas separadas da saída original da IA, com controle de conflito entre sessões.
- Relatórios descritivos persistidos, por equipe e período, com volume, análises, revisões e média das notas registradas. Não calculam FCR ou conformidade.
- Reprodução protegida de arquivos vinculados às ligações. Defina `SENX_AUDIO_ROOT` com uma pasta absoluta. `Ligacao.Caminho_Arquivo` deve apontar para um arquivo dentro dela. Não há importador PABX ou processamento IA nesta versão.
- Consulta inicial de 200 ligações, com carregamento progressivo até 10 mil. Filtros, métricas da lista e exportações usam o recorte carregado. Relatórios usam consultas agregadas no servidor.
- Ranking aguarda fórmula e elegibilidade aprovadas; a tela explica essa pendência.

A IA está em desenvolvimento pela equipe. Esta versão consulta resultados já registrados; não simula transcrição, reprodução, validação ou salvamento.

## Publicar

`dotnet publish BackEnd/SenxCti.Api -c Release`. Em Production, configure `SENX_DB_CONNECTION` e `Jwt__Key` (pelo menos 32 bytes), use HTTPS e mantenha o banco/arquivos privados. As rotas da interface funcionam também em Production. Para restringir a API ao próprio computador, configure `SENX_LOCAL_ONLY=true`.

## Verificar

- `npm test`: testes de interface, sessão e diagnóstico.
- `dotnet build BackEnd/Projeto.SENX.CTI.slnx`
- `dotnet run --project BackEnd/SenxCti.Tests -- --delivery-integration`: integração real com registros temporários identificados por UUID, removidos ao finalizar. Execute apenas em banco de desenvolvimento.
- `dotnet run --project BackEnd/SenxCti.Tests`: suíte isolada, incluindo carga em memória.
- Diagnóstico separado: `npm run diagnostico`, http://localhost:4174.

Decisões, relatórios de implementação e pendências ficam no Obsidian, projeto SENX — CTI.
