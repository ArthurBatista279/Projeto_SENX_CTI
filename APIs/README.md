# API SENX · 1.0.0.0

Servidor padrão: http://localhost:5080. Interface e API usam a mesma origem.

- `/api/auth`: status, csrf, setup, login, session, profile, logout.
- `GET /api/data/snapshot?limit=200`: dados filtrados pelo usuário; até 10 mil ligações sob demanda. Relatórios consolidados são exclusivos de administradores.
- `POST /api/data/users`, `PUT /api/data/users/{id}/active`: administração.
- `POST /api/data/teams`, `PUT /api/data/teams/{id}`: administração.
- `POST /api/data/criteria`, `PUT /api/data/criteria/{id}`: administração.
- `PUT /api/data/calls/{id}/review`: administração; analysisId, revision (UUID ou null), summary, score (0–100 ou null), validate. Retorna 409 em edição concorrente; preserva a análise original.
- `POST /api/data/reports`: administração; title, type, teamId (UUID ou null), period, summary (observações). Categorias: Qualidade, Retenção, Desenvolvimento, Conformidade. Períodos: Últimos 7 dias, Últimos 30 dias, Mês atual, Trimestre atual. São consolidações descritivas em UTC.
- `GET /api/data/calls/{id}/audio`: acesso por proprietário/admin, suporta HTTP Range. Requer arquivo em SENX_AUDIO_ROOT.
- `GET /api/health`: público. `GET /api/database/health`: administrador.
- Controllers existentes em `/api/{entidade}` continuam com JWT. Swagger em Development.

As rotas da interface usam cookie HttpOnly e token X-CSRF-Token nas alterações. Desativação revoga sessões e tokens anteriores. Em Production, configure conexão/Jwt__Key e HTTPS.

- `GET /api/ligacoes/upload-options`: atendentes e clientes autorizados.
- `POST /api/ligacoes/upload`: multipart com audio, IdFuncionario, IdCliente, NumeroOrigem, NumeroDestino e Direcao (Entrada/Saída); até 20 MiB de WAV, MP3, OGG ou M4A.
- `POST /api/ligacoes/import`: administrador; JSON com fileName relativo a SENX_AUDIO_ROOT e os mesmos metadados.

O processamento usa Gemini/reserva Groq quando configurados. Sem chaves, retorna demonstração explicitamente simulada; falhas de provedores configurados retornam erro controlado. Consulte o [README principal](../README.md) para configuração e limites.
