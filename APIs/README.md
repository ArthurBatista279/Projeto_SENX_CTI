# API SENX · 1.5.0.0

Servidor padrão: `http://localhost:5080`. Interface e API usam a mesma origem.

- `/api/auth`: `status`, `csrf`, `setup`, `login`, `session`, `profile`, `logout`.
- `GET /api/data/snapshot?limit=200`: dados filtrados pelo usuário (incluindo `calls`, `customers`, `teams`, `users`, `criteria`, `reports`); até 10 mil ligações sob demanda. Relatórios consolidados são retornados aos usuários autenticados; criação, exclusão e download na interface são administrativos.
- `POST /api/data/customers`, `PUT /api/data/customers/{id}`: cadastro e atualização de clientes (`DadosCliente`) para vínculo de ligações e histórico.
- `POST /api/data/users`, `PUT /api/data/users/{id}/active`: administração de colaboradores e acessos.
- `POST /api/data/teams`, `PUT /api/data/teams/{id}`: administração de departamentos/equipes.
- `POST /api/data/criteria`, `PUT /api/data/criteria/{id}`: administração de critérios de qualidade.
- `PUT /api/data/calls/{id}/review`: administração; `analysisId`, `revision` (UUID ou null), `summary`, `score` (0–100 ou null), `validate`. Retorna `409` em edição concorrente; preserva a análise original.
- `POST /api/data/reports`: administração; `title`, `type`, `teamId` (UUID ou null), `period`, `summary` (observações). Categorias: Qualidade, Retenção, Desenvolvimento, Conformidade. Períodos: Últimos 7 dias, Últimos 30 dias, Mês atual, Trimestre atual. São consolidações descritivas em UTC.
- `GET /api/data/calls/{id}/audio`: acesso por proprietário/admin, suporta HTTP Range. Requer arquivo em `SENX_AUDIO_ROOT`.
- `GET /api/health`: público. `GET /api/database/health`: administrador.
- Controllers existentes em `/api/{entidade}` continuam com JWT. Swagger em Development.

As rotas da interface usam cookie HttpOnly e token `X-CSRF-Token` nas alterações. Desativação revoga sessões e tokens anteriores. Em Production, configure conexão/`Jwt__Key` e HTTPS.

- `GET /api/ligacoes/upload-options`: atendentes e clientes autorizados.
- `POST /api/ligacoes/upload`: multipart com `audio`, `IdFuncionario`, `IdCliente`, `NumeroOrigem`, `NumeroDestino` e `Direcao` (`Entrada`/`Saída`); até 20 MiB de WAV, MP3, OGG ou M4A.
- `POST /api/ligacoes/import`: administrador; JSON com `fileName` relativo a `SENX_AUDIO_ROOT` e os mesmos metadados.

O processamento usa Gemini (`Gemini:AnalysisModel`) e reserva Groq quando configurados. A simulação é opt-in via `Ai__AllowSimulation=true`. Sem chaves ou com provedores indisponíveis, o upload retorna HTTP 503 quando não há análise disponível. Um áudio sem duração válida retorna HTTP 422. Consulte o [README principal](../README.md) para configuração e limites.

## Rotas e contratos da v1.5.0.0

- `PUT /api/data/users/{id}`: administrador edita name, email, teamId, job e profile; password opcional preserva a senha quando ausente. Impede rebaixar o próprio administrador (409). Ativação/desativação continua em rota separada.
- Clientes aceitam `userIds` para múltiplos atendentes e mantêm `userId` compatível. Vínculos são persistidos em `ClienteUsuario`; acesso ao snapshot considera responsabilidade e histórico.
- `GET /api/data/rankings?teamId=UUID&period=...`: usuários autenticados consultam ranking por equipe/período, com notas humanas validadas, contagem de chamadas e duração média. Não aplica regra mínima de 20 chamadas nem calcula FCR.
- `POST /api/data/reports` aceita também `includeRanking`; `DELETE /api/data/reports/{id}` remove somente o relatório (administrador).
- `DELETE /api/data/{users|customers}/{id}`: administrador; cadastro deve estar inativo e sem vínculos impeditivos. Exclusão da própria conta é bloqueada.
- `DELETE /api/data/{calls|criteria|teams}/{id}`: administrador; respeita as regras de integridade. Exclusão de ligação remove registros dependentes previstos no serviço e trata o arquivo associado.

Erros de validação retornam 400; ausência de registro, 404; conflitos de revisão ou integridade, 409. Consulte DatabaseEndpoints.cs e CadastroDeletion.cs para as condições específicas. Não há endpoint GET individual de relatório: a interface consulta os relatórios no snapshot.

## Prioridade de análise no código atual

Apesar da versão exibida permanecer v1.5.0.0, o código inclui `priority` (0 normal, 1 média, 2 alta) e `priorityReason`, independentes da nota. O snapshot prioriza esses registros antes da data. Bancos antigos precisam de `Banco_De_Dados/migrations/1.5.1-prioridade-analise.sql` (nome do arquivo preservado); os schemas de instalação nova já incluem as colunas. Essa migração não foi executada nesta revisão documental.
