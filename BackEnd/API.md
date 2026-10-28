# API: login, usuários e Swagger

Execute `dotnet run --project SenxCti.Api`. No perfil Development, acesse
http://localhost:5080/swagger. A documentação segue a configuração do
[Swashbuckle 10](https://github.com/domaindrivendev/Swashbuckle.AspNetCore/blob/master/docs/configure-and-customize-swaggergen.md).

## Configuração

- Banco PostgreSQL: variável `SENX_DB_CONNECTION` ou configuração local já existente.
- Aplique previamente a migração existente `../Banco_De_Dados/migrations/0.1.4-acesso.sql`:
  ela adiciona `Perfil` e permite armazenar hashes na coluna `Senha`.
- Produção: configure `Jwt__Key` com um segredo aleatório de pelo menos 32 bytes.
- Development sem chave configurada gera uma chave temporária: reiniciar invalida os tokens.
- Em `appsettings.json`, `Jwt` define emissor, audiência e duração (30 minutos).
- O primeiro administrador é criado pelo fluxo de configuração inicial da interface
  (`/api/auth/setup`, com token CSRF). Não há cadastro administrativo anônimo nas controllers.

## Uso

1. Envie `POST /api/Login` com `{"email":"...","senha":"..."}`.
2. Copie o campo `token` e cole em **Authorize** no Swagger.
3. Use `/api/Usuario`: GET para listar e POST para cadastrar.
4. Use `/api/Usuario/{id}`: GET, PUT e DELETE.

O CRUD de usuários exige perfil Administrador. POST e PUT recebem
`idEquipe`, `nome`, `email`, `imagem`, `cargo`, `senha` e `perfil`.
O PUT substitui os dados e exige senha de 12 a 128 caracteres, assim como o POST.
Perfil aceita Administrador ou Colaborador. As respostas não incluem senha nem hash.

As demais controllers exigem JWT. As rotas existentes da interface mantêm cookie
e CSRF. A restrição existente de acesso local a /api foi preservada.
Alterações de senha e exclusões invalidam tokens existentes; o perfil é consultado
novamente na validação do token.

## Validação realizada

Compilação sem erros; Swagger UI e JSON com HTTP 200; rotas de Login e Usuario
presentes; Usuario anônimo com 401; Login vazio com 400; login por cookie sem CSRF
com 403. O fluxo de login e CRUD com persistência precisa de validação com banco
configurado e uma conta de teste. O build ainda informa os avisos preexistentes
NU1902 e NU1903 da dependência System.Security.Cryptography.Pkcs 9.0.11.
