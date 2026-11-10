# SENX Web · 1.5.0.0

Fonte única: `wwwroot`. A API .NET serve estes arquivos na mesma origem (`http://localhost:5080`) e a sessão usa cookie `HttpOnly` + proteção `CSRF`.

Execute `npm start` na raiz do repositório, em `Aplicacao` ou em `Aplicacao/SenxCti.Web` e abra `http://localhost:5080`. O comando inicia a API SENX que serve esta interface; o `TranscribeTest` é um projeto separado na porta `5081`. Os dados e alterações vêm do PostgreSQL. Sem backend ou banco disponível, a interface apresenta o erro e permite tentar novamente.

## Principais fluxos da interface (1.5.0.0)

- **Ligações (`#ligacoes`):** Consulta de chamadas, reprodução de áudio protegida, transcrição, critérios avaliados, revisão humana e modal **Enviar gravação** (`upload.js`) com seleção de atendente/cliente, preenchimento automático de telefone e atalho `+ Cadastrar cliente`.
- **Clientes (`#clientes` e `#administracao/clientes`):** Cadastro, edição e busca de clientes (`DadosCliente`) por nome, e-mail ou telefone, com indicadores de consentimento ativo, total de ligações vinculadas e filtro direto para visualizar as chamadas de um cliente.
- **Resumos, Relatórios e Rankings:** Consolidações descritivas persistidas no PostgreSQL e visualização por período/equipe.
- **Administração e Configurações:** Gestão de colaboradores/acessos, clientes, departamentos/equipes, catálogo de critérios de análise e perfil/senha do usuário conectado.

Testes unitários e de fluxo de interface: `npm test` (`tests/app.test.mjs`). Testes de navegador com Playwright (`tests/delivery.browser.cjs` e `tests/roles.browser.cjs`) são opcionais e executados pela suíte de integração. O [README da raiz](../../README.md) descreve configuração e limites.
