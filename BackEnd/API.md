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
`idEquipe`, `nome`, `email`, `imagem`, `cargo`, `senha` e `perfil` em multipart/form-data.
O PUT substitui os dados e exige senha de 12 a 128 caracteres, assim como o POST.
Perfil aceita Administrador ou Colaborador. As respostas não incluem senha nem hash.

Os controllers de Alerta, Analise, Assunto, DadosCliente, Equipe, Ligacao,
Registro e Resultado expõem CRUD global e exigem JWT de Administrador.
Criterio exige Administrador para escrita; colaboradores podem consultar apenas
critérios ativos. Usuario também exige Administrador. Login é anônimo e limitado
por IP. As rotas existentes da interface mantêm cookie
e CSRF. A restrição existente de acesso local a /api foi preservada.
Alterações de senha e exclusões invalidam tokens existentes; o perfil é consultado
novamente na validação do token.

## Validação realizada

Veja [o relatório de revisão](REVISAO.md) e [os testes](SenxCti.Tests/README.md).
O banco local ainda precisa da migração existente 0.1.4 para autenticação:
falta Usuario.Perfil e Usuario.Senha ainda é varchar(40). Nenhuma migração foi
executada durante a revisão.

Para testar sem autenticação, inicie a API a partir de BackEnd e execute:

```powershell
dotnet run --project SenxCti.Api
```

Em outro terminal: `Invoke-RestMethod http://localhost:5080/api/health`.
Configure SENX_DB_CONNECTION no ambiente ou em SenxCti.Api/appsettings.Local.json
(ignorado pelo Git e carregado somente em Development). Não versione credenciais.
