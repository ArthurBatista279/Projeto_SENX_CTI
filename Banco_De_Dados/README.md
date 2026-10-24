# Banco PostgreSQL SENX

`senx.sql` é o dump original PostgreSQL 18.6 da base 0.1.3. Ele foi preservado como origem.
A estrutura 0.1.4 é formada pelo dump mais `migrations/0.1.4-acesso.sql`.

## Atualizar

Execute `Banco_De_Dados/atualizar-0.1.4.ps1` em PowerShell. O script lê a configuração privada da API e usa as ferramentas locais do PostgreSQL 18.
Um backup em formato custom é criado antes da atualização, em backups/ por padrão, e não é enviado ao Git.
É possível informar outro caminho com `-BackupPath`.
A migração é transacional; duplicidades de e-mail fazem a atualização falhar sem apagar cadastros.

## Restaurar

Interrompa a aplicação. Para testar recuperação, crie um banco separado e restaure o arquivo com pg_restore, usando o mesmo usuário proprietário.
Exemplo, substituindo nome do banco e caminho:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -h localhost -U senx_app senx_recuperacao
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h localhost -U senx_app -d senx_recuperacao --exit-on-error "CAMINHO_DO_BACKUP.dump"
```

A criação de um banco requer permissão CREATEDB ou execução pelo administrador postgres. Não use --clean sobre o banco ativo para testar.
Backups contêm dados privados, inclusive hashes de senhas após a 0.1.4. Mantenha-os protegidos.
