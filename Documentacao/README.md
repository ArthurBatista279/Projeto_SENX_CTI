# Documentação Técnica — Projeto SENX CTI · 1.5.0.0

Esta pasta reúne os artefatos visuais de modelagem do banco de dados e a ferramenta de diagnóstico portátil do **Projeto SENX — CTI**.

## Conteúdo da pasta

| Caminho | Descrição |
|---|---|
| `CTI-Página-MER.drawio.png` | Modelo Entidade-Relacionamento (MER) conceitual do projeto. |
| `CTI_DER-Página-DER.drawio.png` | Diagrama Entidade-Relacionamento (DER) lógico das tabelas do banco. |
| `Ferramentas/Diagnostico/` | Utilitário web independente para inspeção e diagnóstico da suíte (`npm run diagnostico`, porta `4174`). |

## Visão geral da Versão 1.5.0.0

1. **Aplicação Web Integrada (`Aplicacao/SenxCti.Web/wwwroot`):**
   - Servida na mesma origem pela API .NET (`http://localhost:5080`) com autenticação por cookie `HttpOnly` e proteção `CSRF`.
   - Telas: **Ligações** (com player protegido, transcrição, critérios, revisão humana e modal **Enviar gravação**), **Clientes** (cadastro, busca e histórico de ligações por cliente), **Resumos**, **Relatórios**, **Rankings**, **Configurações** e **Administração** (Colaboradores, Departamentos e Critérios).
2. **Backend e Inteligência Artificial (`BackEnd/SenxCti.Api`):**
   - Pipeline `Services/Ai` integrado com **Google Gemini** (`Gemini:AnalysisModel`, ex.: `gemini-3.5-flash`) e fallback **Groq** (Whisper ASR + LLM). Sem chave configurada, o processamento retorna erro de configuração. Demonstração simulada somente com `Ai:AllowSimulation=true`, explicitamente habilitada para testes.
   - Pipeline `Services/Audio` com validação de assinatura binária (WAV, MP3, OGG, M4A até 20 MiB), armazenamento privado em `SENX_AUDIO_ROOT` e persistência transacional da ligação, análise e avaliação por critério.
3. **Banco de Dados (`Banco_De_Dados/`):**
   - Schema consolidado em `senx-1.0.0-limpo.sql` (14 tabelas e 19 FKs) e script seguro de recriação/seed `recriar-banco-1.0.0.ps1` com backup automático via `pg_dump`.
   - Migrações incrementais `0.1.4-acesso.sql` e `0.1.5-entrega.sql` preservadas para atualização de bancos existentes sem perda de dados.

## Documentação complementar

- [README Principal](../README.md) — instruções de instalação, configuração privada (`appsettings.Local.json`) e execução.
- [APIs/README.md](../APIs/README.md) — resumo das rotas da aplicação, clientes e upload de áudio.
- [Banco_De_Dados/README.md](../Banco_De_Dados/README.md) — guia do schema limpo `1.5.0.0`, migrações e restauração de backups.
- [BackEnd/SenxCti.Tests/README.md](../BackEnd/SenxCti.Tests/README.md) — suíte de testes automatizados (isolados, IA e integração PostgreSQL).

## Organização e evidências

Diagnostico é referenciado pelos comandos npm e pelos testes; foi preservado. SVGs em SENX_Figma_Telas são referências visuais, não telas servidas. TranscribeTest permanece laboratório separado. Os diagramas são referências e não substituem o esquema SQL/código atual. Relatórios de trabalho ficam no Obsidian, separados da documentação operacional versionada. Consulte o README principal para ranking e vínculos múltiplos de clientes.

## Prioridade de análise no código atual

Apesar da versão exibida permanecer v1.5.0.0, o código inclui `priority` (0 normal, 1 média, 2 alta) e `priorityReason`, independentes da nota. O snapshot prioriza esses registros antes da data. Bancos antigos precisam de `Banco_De_Dados/migrations/1.5.1-prioridade-analise.sql` (nome do arquivo preservado); os schemas de instalação nova já incluem as colunas. Essa migração não foi executada nesta revisão documental.
