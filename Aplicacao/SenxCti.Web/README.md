# SENX Web · 1.0.0.0

Fonte única: `wwwroot`. A API .NET serve estes arquivos na mesma origem e a sessão usa cookie HttpOnly/CSRF.

Execute `npm start` na raiz do repositório, em `Aplicacao` ou em `Aplicacao/SenxCti.Web` e abra http://localhost:5080. O comando inicia a API SENX que serve esta interface; o TranscribeTest é um projeto separado na porta 5081. Os dados e alterações vêm do PostgreSQL. Sem backend ou banco disponível, a interface apresenta o erro e permite tentar novamente.

Revisões humanas, relatórios e ativação de contas são persistidos. A tela Ligações permite enviar áudio para análise, com progresso e seleção de atendente/cliente. A IA integrada usa provedores configurados ou demonstração explicitamente simulada quando não há chaves. Arquivos ficam em SENX_AUDIO_ROOT (padrão privado App_Data/Audio no backend). Regras de ranking continuam pendentes. O [README da raiz](../../README.md) descreve configuração e limites.

Testes do navegador em `tests/delivery.browser.cjs` são opcionais, executados pelo teste C# de integração com credenciais temporárias em ambiente e Playwright disponível no `NODE_PATH`.
