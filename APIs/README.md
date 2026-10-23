# Integração e teste de carga da IA

`POST /api/ai/analyze` usa inicialmente um provedor `fake`, permitindo testar a infraestrutura sem chave, custo ou serviço externo. Com a API em `http://localhost:5080`, execute `node APIs/load-test.mjs`.

Use `SENX_API_URL`, `SENX_LOAD_REQUESTS` e `SENX_LOAD_CONCURRENCY` para configurar o teste. O script bloqueia carga contra um provedor externo; a liberação exige `SENX_LOAD_ALLOW_EXTERNAL=true`, depois de definir modelo, orçamento, cota, dados permitidos e limites. A escolha entre Gemini e outro provedor continua pendente.
