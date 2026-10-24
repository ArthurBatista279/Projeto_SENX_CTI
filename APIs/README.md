# API SENX · 0.1.4.2

A 0.1.4.2 adiciona edição autenticada do próprio perfil e invalidação de sessões após alteração da senha. Não exige nova migração do banco.

Servidor local: http://localhost:5080. Todas as respostas autenticadas usam cache desabilitado.

## Acesso

- `GET /api/health`: processo e versão, público.
- `GET /api/auth/status`: informa se o primeiro administrador precisa ser criado; equipes são listadas somente nessa situação.
- `GET /api/auth/csrf`: emite token de formulário vinculado ao cookie e à identidade atual.
- `POST /api/auth/setup`: cria somente o primeiro administrador, com senha definida pelo usuário.
- `POST /api/auth/login`: e-mail e senha; emite cookie HttpOnly.
- `GET /api/auth/session`: perfil da conta autenticada.
- `PUT /api/auth/profile`: exige sessão, CSRF e senha atual; aceita name, email, currentPassword e newPassword opcional. Atualiza exclusivamente o usuário da sessão. Não permite modificar cargo, equipe ou perfil de acesso. Responde com requiresLogin e user (sem credenciais); ao trocar senha, user é nulo e exige novo login.
- `POST /api/auth/logout`: encerra o acesso no navegador.

Login, configuração inicial e edição de perfil compartilham limite de 10 tentativas por minuto por IP. Toda requisição de alteração exige `X-CSRF-Token`, obtido no endpoint csrf. Nenhum token de sessão vai ao localStorage. A senha atual é verificada antes de salvar e as consultas usam parâmetros. E-mail duplicado retorna 409 sem salvar parcialmente. Cookies guardam uma versão opaca das credenciais que é conferida pela API e nunca exposta nas respostas.
Sem sessão: 401. Sem perfil permitido ou token CSRF: 403. Duplicidade ou equipe inválida: 409. Limite de tentativas: 429.

## Dados (Development local)

- `GET /api/data/snapshot`: administrador vê o conjunto; colaborador recebe somente suas ligações, análises, conta e totais correspondentes.
- `POST /api/data/users`: administrador cadastra nome, e-mail, password, teamId, job e profile.
- `POST /api/data/teams` e `PUT /api/data/teams/{id}`: administrador gerencia equipes.
- `POST /api/data/criteria` e `PUT /api/data/criteria/{id}`: administrador gerencia critérios.
- `GET /api/database/health`: administrador verifica esquema e permissões.

Os perfis aceitos são Administrador e Colaborador. O campo Cargo permanece separado do perfil de acesso.
Nomes de usuário aceitam até 200 caracteres, e-mails/cargos até 255 e senhas novas de 12 a 128 caracteres.
Senhas e hashes nunca são retornados nos contratos públicos.
