# API SENX · 0.1.4.3

A versão 0.1.4.3 prepara a interface e os contratos para recepção da reestruturação da API e banco de dados.

Servidor local: http://localhost:5080. Todas as respostas autenticadas usam cache desabilitado.

## Acesso

- `GET /api/health`: processo e versão (0.1.4.3), público.
- `GET /api/auth/status`: informa se o primeiro administrador precisa ser criado; equipes são listadas somente nessa situação.
- `GET /api/auth/csrf`: emite token de formulário vinculado ao cookie e à identidade atual.
- `POST /api/auth/setup`: cria somente o primeiro administrador, com senha definida pelo usuário.
- `POST /api/auth/login`: e-mail e senha; emite cookie HttpOnly.
- `GET /api/auth/session`: perfil da conta autenticada.
- `PUT /api/auth/profile`: exige sessão, CSRF e senha atual; aceita name, email, currentPassword e newPassword opcional. Atualiza exclusivamente o usuário da sessão.
- `POST /api/auth/logout`: encerra o acesso no navegador.

## Dados (Development local)

- `GET /api/data/snapshot`: administrador vê o conjunto; colaborador recebe somente suas ligações, análises, conta e totais correspondentes.
- `POST /api/data/users`: administrador cadastra nome, e-mail, password, teamId, job e profile.
- `POST /api/data/teams` e `PUT /api/data/teams/{id}`: administrador gerencia equipes.
- `POST /api/data/criteria` e `PUT /api/data/criteria/{id}`: administrador gerencia critérios.
- `GET /api/database/health`: administrador verifica esquema e permissões.
