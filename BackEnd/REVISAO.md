# Revisão da API existente — 28/10/2026

Não foram encontradas instruções AGENTS.md no repositório. Foram lidos README,
API.md, projetos, Program.cs, controllers, DTOs, modelos, interfaces, repositórios,
SenxContext, testes e SQL. A arquitetura foi preservada; não houve escrita no banco.

## Rotas e autenticação

- `/api/Login`: POST anônimo, emite JWT, com limite por IP.
- `/api/{Alerta,Analise,Assunto,Criterio,DadosCliente,Equipe,Ligacao,Registro,Resultado}`:
  GET lista, GET por Guid, POST, PUT pelo corpo, PUT por Guid e DELETE por Guid.
- `/api/Usuario`: GET e POST multipart; `/{id}`: GET, PUT multipart e DELETE.
- `/api/auth`: csrf, status, session, login, setup, logout e profile. Cookie e CSRF.
- `/api/data`, somente Development: snapshot, POST/PUT teams e criteria, POST users.
  O snapshot mantém o filtro por usuário para colaboradores; escrita exige Admin.
- `/api/health`: público; `/api/database/health`: administrador por cookie.
- Swagger disponível em Development; `/` serve a aplicação web existente.

JWT e cookie verificam a conta no PostgreSQL e a versão das credenciais em cada
validação. Senhas usam PasswordHasher; o token não substitui a consulta da conta.
O acesso a `/api` continua limitado a loopback. Repositórios dos controllers usam
EF/Npgsql; autenticação e rotas da interface usam SQL parametrizado via Npgsql.

## Problemas reproduzidos e correções

1. Colaboradores acessavam CRUDs globais sem o filtro de propriedade aplicado ao
   snapshot da interface. Esses controllers agora exigem a política Admin existente.
   Criterio permite leitura de ativos ao colaborador e exige Admin para escrita.
   O acesso aos próprios dados pela interface permanece no snapshot existente.
2. Falhas Npgsql encapsuladas em DbUpdateException escapavam do tratamento e
   expunham detalhes em Development. Agora retornam 503 com mensagem genérica;
   conflitos FK/unique continuam retornando 409.
3. Os limites varchar configurados no EF não eram validados pelo MVC. Foram
   adicionados MaxLength às 37 propriedades limitadas dos nove modelos usados
   diretamente como entrada. Entradas acima do limite agora retornam 400.

Os testes novos reproduziram 72 falhas de autorização/tratamento de erro e 37
falhas de comprimento antes das respectivas correções. Nenhum pacote foi alterado.

Arquivos alterados: Program.cs da API; os nove controllers e nove modelos listados
acima (exceto Usuario, que não mudou); Program.cs dos testes; novo
DatabaseReadOnly.cs; API.md, README dos testes e este relatório.

## Comandos e resultados

Executados a partir de BackEnd:

| Comando | Resultado |
| --- | --- |
| `dotnet restore Projeto.SENX.CTI.slnx` | Sucesso após execução fora do sandbox; tentativa inicial bloqueada ao ler NuGet.Config |
| `dotnet build Projeto.SENX.CTI.slnx -c Release --no-restore` | 0 erros, 0 avisos; SDK selecionado pela pasta BackEnd é preview 11 |
| `dotnet test Projeto.SENX.CTI.slnx -c Release --no-build --no-restore` | Código 0, mas não executa esta suíte, que é um console sem test adapter |
| `dotnet run --project SenxCti.Tests/SenxCti.Tests.csproj -c Release --no-restore` | 1.471 verificações passaram, zero falhas |
| `dotnet run --project SenxCti.Tests/SenxCti.Tests.csproj -c Release --no-build --no-restore -- --database-readonly` | 9 entidades lidas; Usuario falhou com SQLSTATE 42703 |
| `dotnet run --project SenxCti.Api -c Release --no-build --no-restore -- --urls http://localhost:5087` | Inicialização real validada; execução fora do sandbox necessária para DPAPI do usuário |

Resultados por rodada: repositórios 174/174; HTTP/validação 217/217; upload 10/10;
autorização/Swagger 70/70; carga simulada 1.000/1.000. Antes das alterações, os
1.360 testes originais já passavam. Carga em TestServer não mede produção.

Verificação HTTP real na porta temporária 5087: health, Swagger UI, Swagger JSON,
página inicial e csrf retornaram 200; Usuario anônimo 401; Login vazio 400;
auth/login sem CSRF 403. A instância de verificação foi encerrada ao final.
Para uso normal: `dotnet run --project SenxCti.Api`, http://localhost:5080/swagger.

## PostgreSQL: pendência exata, sem migração executada

O modelo corresponde às colunas e relações do dump acrescido da migração 0.1.4.
O índice por expressão de e-mail normalizado e o CHECK de perfil são mantidos
pelo SQL existente, não pelo modelo EF; não foi gerada migração a partir do EF.
No banco local consultado, Usuario não tem Perfil e Senha é varchar(40), portanto
o esquema ainda é anterior ao exigido pela autenticação.

A proposta é aplicar, após revisão e backup, **exatamente o arquivo existente**
[`0.1.4-acesso.sql`](../Banco_De_Dados/migrations/0.1.4-acesso.sql). Seus efeitos:

- Altera Usuario.Senha para text, preservando os valores existentes.
- Adiciona Perfil varchar(20) obrigatório com padrão Colaborador.
- Adiciona CHECK permitindo apenas Administrador e Colaborador.
- Cria índice único em lower(btrim(Email)); duplicidades fazem a transação falhar.
- Usa transação e lock_timeout de 5 segundos. Não cria contas, não converte senhas
  legadas em hashes e não promove usuários existentes a administrador.

Nenhuma dessas operações foi executada. Login válido, emissão/revalidação real
de JWT, sessão autenticada e persistência CRUD ainda não foram validados: falta
o esquema 0.1.4 e uma conta de teste com hash válido/perfil adequado. A suíte HTTP
substitui autenticação e repositórios; o teste separado usa PostgreSQL real em
transação READ ONLY, faz SELECT de até uma linha por entidade e não exibe dados
pessoais nem credenciais. Não testa escrita, FKs ou concorrência no banco real.
