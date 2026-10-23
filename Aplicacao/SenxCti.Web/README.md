# SENX Web — fonte principal

Esta é a fonte oficial das telas SENX v0.1, em HTML, CSS e JavaScript sem dependências de execução. A API C# serve os arquivos de `wwwroot`. A equipe de back-end continua responsável pela evolução do banco e das integrações.

## Fluxo de edição

1. Edite `wwwroot/index.html`, `styles.css`, `data.js`, `core.js` e `app.js`.
2. Na raiz, execute `npm test` e `npm run exportar`.
3. Envie a pasta `FrontEnd` inteira para revisão. Ela é uma cópia gerada, não uma segunda fonte de código.

Na raiz, `npm run dev` abre a fonte em `http://localhost:4173`. `npm run revisar` serve a exportação portátil. Não é necessário Node para abrir `FrontEnd/index.html` diretamente.

## Versão 0.1

- Login, Cadastro, Ligações, Resumos, Relatórios, Rankings, Configurações e Saída.
- Administração: colaboradores, departamentos e critérios, com os formulários de criação/edição.
- Filtros, paginação, resumo/transcrição, player de áudio local, seleção de arquivo, edição local de cadastros e perfil, CSV e relato de problemas.
- Persistência local no navegador. Senhas não são persistidas, autenticadas ou enviadas.
- Marca extraída das imagens incorporadas no SVG oficial de Login; paleta, disposição e padrões baseados nos SVGs de alta fidelidade de `SENX_Figma_Telas`.

## Versão 0.2 — dependências

Integrações de autenticação, API, banco, PABX e IA serão adicionadas conforme a estruturação do projeto. A validação humana de análises precisa de auditoria e identidade do revisor. A regra de elegibilidade do ranking, a ação do triângulo de relatórios e o estado dos compromissos permanecem pendentes de confirmação. A versão 0.1 não concede permissões reais nem implementa essas regras por suposição.
