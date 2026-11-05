# Suíte de Testes Backend (`SenxCti.Tests`) · 1.0.0.0

Executar a partir da raiz do repositório ou da pasta `BackEnd`:

```powershell
dotnet run --project BackEnd/SenxCti.Tests/SenxCti.Tests.csproj -c Release
```

Este projeto é um executável de verificação com código de saída `0` (sucesso) ou `1` (falha).

## Modos de execução na Versão 1.0.0.0

| Comando | O que valida |
|---|---|
| `dotnet run --project BackEnd/SenxCti.Tests` | **Suíte geral em memória (1.471 verificações):** repositórios EF (174), integração HTTP/validação MVC (217), upload (10), autorização JWT/Swagger (70) e carga em memória (1.000 requisições). |
| `dotnet run --project BackEnd/SenxCti.Tests -- --ai-service-checks` | **Serviços de IA e senhas (15+ verificações):** parser JSON de análise, cálculo de `ScoreGeral`, modo simulado explícito, compatibilidade de senhas (Identity PBKDF2 + BCrypt custo 12) e adaptadores HTTP interceptados (Gemini fallback 429, falha controlada e Groq ASR + análise). |
| `dotnet run --project BackEnd/SenxCti.Tests -- --audio-integration` | **Integração E2E de áudio no PostgreSQL (18 verificações):** exige `SENX_TEST_DB_CONNECTION`; testa `POST /api/ligacoes/upload`, `POST /api/ligacoes/import`, persistência transacional de ligação/análise/resultados, revisão humana, relatórios e limpeza automática dos IDs de QA. |
| `dotnet run --project BackEnd/SenxCti.Tests -- --delivery-integration` | **Integração da entrega no PostgreSQL:** autenticação cookie/CSRF, cadastros administrativos, revisão humana concorrente, relatórios e limpeza por UUID. |
| `dotnet run --project BackEnd/SenxCti.Tests -- --database-readonly` | **Leitura do banco real:** abre transação `READ ONLY`, consulta até uma linha por entidade e encerra com `ROLLBACK`. |

## Histórico das rodadas de regressão

Os logs originais da revisão de 28/10/2026 estão preservados em [`Historico/2026-10-28/`](Historico/2026-10-28/):
- [`baseline.log`](Historico/2026-10-28/baseline.log) (1.213 aprovadas / 32 falhas iniciais)
- [`after-fixes.log`](Historico/2026-10-28/after-fixes.log) (1.306 aprovadas / 0 falhas)
- [`final.log`](Historico/2026-10-28/final.log) (1.360 aprovadas / 0 falhas, posteriormente ampliadas para 1.471 verificações)

## Limites e segurança dos testes

- A suíte padrão e `--ai-service-checks` rodam isolados sem consumir APIs pagas externas (chamadas HTTP para Gemini/Groq são interceptadas em memória).
- Os testes de integração PostgreSQL (`--audio-integration` e `--delivery-integration`) criam pastas temporárias de áudio e removem todos os registros temporários pelos seus UUIDs ao finalizar.
