# SENX Web · 1.5.0.0

Fonte única: `wwwroot`. A API .NET serve estes arquivos na mesma origem (`http://localhost:5080`) e a sessão usa cookie `HttpOnly` + proteção `CSRF`.

Execute `npm start` na raiz do repositório, em `Aplicacao` ou em `Aplicacao/SenxCti.Web` e abra `http://localhost:5080`. O comando inicia a API SENX que serve esta interface; o `TranscribeTest` é um projeto separado na porta `5081`. Os dados e alterações vêm do PostgreSQL. Sem backend ou banco disponível, a interface apresenta o erro e permite tentar novamente.

## Principais fluxos da interface (1.5.0.0)

- **Ligações (`#ligacoes`):** Consulta de chamadas, reprodução de áudio protegida, transcrição, critérios avaliados, revisão humana e modal **Enviar gravação** (`upload.js`) com seleção de atendente/cliente, preenchimento automático de telefone; cadastro de clientes na tela Clientes.
- **Clientes (`#clientes` e `#administracao/clientes`):** Cadastro, edição e busca de clientes (`DadosCliente`) por nome, e-mail ou telefone, com indicadores de consentimento ativo, total de ligações vinculadas e filtro direto para visualizar as chamadas de um cliente.
- **Resumos, Relatórios e Rankings:** Consolidações descritivas persistidas no PostgreSQL e visualização por período/equipe.
- **Administração e Configurações:** Gestão de colaboradores/acessos, clientes, departamentos/equipes, catálogo de critérios de análise e perfil/senha do usuário conectado.

Testes unitários e de fluxo de interface: `npm test` (`tests/app.test.mjs`). Testes de navegador com Playwright (`tests/delivery.browser.cjs` e `tests/roles.browser.cjs`) são opcionais e executados pela suíte de integração. O [README da raiz](../../README.md) descreve configuração e limites.

## Gestão e ranking

Colaboradores têm ações distintas Editar e Ativar/Desativar, com filtro de status. Clientes podem ter múltiplos atendentes. Ranking mostra qualidade validada, duração média e contagens, com busca, paginação e CSV. Relatórios têm filtro de status, paginação e exclusão administrativa. Critérios são globais, com salvamento por edição; não há configuração por departamento.

Validação adicional com API simulada: `node Aplicacao/SenxCti.Web/tests/fluxos.browser.cjs` e `node Aplicacao/SenxCti.Web/tests/gestao.browser.cjs`, na raiz, exigem Playwright e navegador compatível. Não são testes do Neon real.

## Prioridade de análise no código atual

Apesar da versão exibida permanecer v1.5.0.0, o código inclui `priority` (0 normal, 1 média, 2 alta) e `priorityReason`, independentes da nota. O snapshot prioriza esses registros antes da data. Bancos antigos precisam de `Banco_De_Dados/migrations/1.5.1-prioridade-analise.sql` (nome do arquivo preservado); os schemas de instalação nova já incluem as colunas. Essa migração não foi executada nesta revisão documental.
