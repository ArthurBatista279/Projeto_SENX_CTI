# Banco de dados

`schema.postgresql.sql` é a base inicial compatível com PostgreSQL. `DDL_CTI-Chamadas.sql`, na raiz, foi preservado como referência histórica, mas usa sintaxe do SQL Server e não deve ser executado no PostgreSQL.

Crie um banco e usuário, execute o esquema e defina `SENX_DB_CONNECTION`, por exemplo: `Host=localhost;Port=5432;Database=senx_cti;Username=senx;Password=<senha-local>`. Depois, acesse `GET /api/database/health`.

O computador analisado ainda não possui PostgreSQL, `psql` ou Docker. O esquema precisa de validação de execução assim que uma dessas opções estiver disponível.
