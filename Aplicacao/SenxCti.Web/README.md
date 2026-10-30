# SENX Web · 0.1.5.0

Fonte única: `wwwroot`. A API .NET serve estes arquivos na mesma origem e a sessão usa cookie HttpOnly/CSRF.

Execute `npm start` na raiz do repositório e abra http://localhost:5080. Os dados e alterações vêm do PostgreSQL. Sem backend ou banco disponível, a interface apresenta o erro e permite tentar novamente.

Revisões humanas, relatórios e ativação de contas são persistidos. Áudio depende do arquivo associado e de `SENX_AUDIO_ROOT`. IA e regras de ranking permanecem em desenvolvimento. O README da raiz descreve a configuração.

Testes do navegador em `tests/delivery.browser.cjs` são opcionais, executados pelo teste C# de integração com credenciais temporárias em ambiente e Playwright disponível no `NODE_PATH`.
