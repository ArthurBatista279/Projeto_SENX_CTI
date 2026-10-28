# SENX — CTI · 0.1.4.2

Backend .NET 10 + Npgsql: `BackEnd/SenxCti.Api`. Fonte única da interface: `Aplicacao/SenxCti.Web/wwwroot`.
Solução Visual Studio: `BackEnd/Projeto.SENX.CTI.slnx`.

## Versão 0.1.4.2 — proporção das telas e perfil

As 15 telas completas de `SENX_Figma_Telas` orientam login, cadastro, ligações, resumos, relatórios, rankings, perfil, saída e administração (incluindo formulários). Layout, cores, tipografia Inter local e navegação foram atualizados, com adaptação para celular.
São componentes reais da aplicação: os SVGs completos não são usados como imagens das telas. Dados e avatares demonstrativos do desenho não são copiados para o banco; os usuários aparecem com suas iniciais.
Login, saída, filtros, exportação CSV, criação de usuários e manutenção de equipes/critérios preservam a API autenticada da 0.1.4.
Campos e ações desenhados que ainda não têm suporte na API ficam sinalizados ou desabilitados. Novas contas continuam restritas ao administrador, exceto o primeiro acesso.
Cartões, formulários e estados vazios agora usam dimensões proporcionais à janela. Configurações compartilha os tamanhos de títulos, campos e botões dos demais módulos, sem altura mínima artificial.
Nome e e-mail podem ser editados com confirmação da senha atual; Descartar alterações restaura os valores salvos. A troca opcional de senha exige 12 a 128 caracteres e confirmação, encerra as sessões anteriores e pede novo login. Equipe, cargo e permissões não podem ser alterados pelo próprio perfil.
Não há nova migração. A atualização dos arquivos não altera contas existentes; dados pessoais ou senha só são modificados quando o usuário salva seu formulário. Sessões anteriores à 0.1.4.2 precisam entrar novamente devido à nova verificação de credenciais.
O diagnóstico permanece separado em http://localhost:4174. Após atualizar, reinicie a API e recarregue a página com Ctrl+F5.

## Executar e entrar

Na raiz, execute `npm start` e abra http://localhost:5080.
Se ainda não houver usuários, a tela oferece o cadastro do primeiro administrador. Escolha sua equipe, e-mail e uma senha de 12 a 128 caracteres. Não existe senha padrão. Após cadastrar, entre com essas credenciais.
Novos colaboradores e administradores são cadastrados em Administração → Colaboradores.

- Administrador: gerencia colaboradores, equipes e critérios; consulta todos os registros e o diagnóstico.
- Colaborador: consulta suas próprias ligações e análises, seu perfil e os critérios ativos. Não gerencia cadastros.

A sessão usa cookie HttpOnly e SameSite=Strict, expira em 8 horas e é removida ao sair. A existência e o perfil da conta são conferidos na API a cada requisição autenticada.
Senhas são armazenadas pelo PasswordHasher do ASP.NET Core; texto puro não é aceito. Toda alteração pela API exige proteção de formulário (CSRF).
A configuração inicial fecha após o primeiro usuário, inclusive quando duas requisições chegam juntas.

## PostgreSQL e migração

A configuração privada fica em `BackEnd/SenxCti.Api/appsettings.Local.json`, ignorada pelo Git:

```json
{
  "SENX_DB_CONNECTION": "Host=127.0.0.1;Port=5432;Database=senx;Username=senx_app;Password=PREENCHA_LOCALMENTE"
}
```

A variável de ambiente `SENX_DB_CONNECTION` tem prioridade. Reinicie a API após alterar a conexão.

Para preparar um novo banco: importe `Banco_De_Dados/senx.sql` com psql e depois execute `Banco_De_Dados/atualizar-0.1.4.ps1`.
Para atualizar um banco 0.1.3: execute apenas o script de atualização. Ele cria e verifica a leitura de um backup com pg_dump antes da migração transacional.
A migração amplia Senha para text, adiciona Perfil e impede e-mails duplicados ignorando caixa e espaços externos. Não apaga contas, não cria contas padrão e não converte senhas legadas.
Se já existirem contas antigas sem hashes seguros, elas não conseguirão entrar; esse cenário exige regularização administrativa antes do uso.
Não execute o dump completo sobre um banco preenchido. Backups contêm informações privadas e não devem ir ao Git.

## Diagnóstico separado

Em outro terminal, execute `npm run diagnostico`. Abra http://localhost:4174 e entre com uma conta de administrador.
Usando o mesmo hostname (localhost) nas duas telas, o navegador compartilha a sessão. O diagnóstico permanece fora da navegação da SENX.
A tela verifica API, PostgreSQL, esquema, permissões e leitura dos registros. O histórico e o acompanhamento de recursos ficam no navegador e não são dados de negócio.

## Verificação

- `npm test`: interface, sessão do navegador e isolamento do diagnóstico.

A API continua restrita a acesso local. A autenticação não transforma esta versão em uma implantação de produção.
Login, cadastro de colaboradores, edição do próprio nome/e-mail e troca de senha autenticada funcionam. Recuperação de senha sem acesso à conta, edição administrativa de contas, PABX, upload de áudio, IA real, relatórios e rankings ficam para entregas posteriores.
