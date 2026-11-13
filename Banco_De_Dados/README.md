# Banco PostgreSQL SENX

## Estrutura utilizada pela aplicação v1.5.0.0

`senx-1.0.0-limpo.sql` contém o schema base, revisão humana e relatórios, sem ligações/análises fictícias. Inclui uma equipe, um administrador (`admin@senx.com`), um cliente de demonstração e três critérios. A senha inicial é escolhida na execução e armazenada em BCrypt com custo 12; não existe senha padrão publicada.

Após compilar a solução, configure a conexão privada e use um banco PostgreSQL previamente criado e vazio:

```powershell
.\Banco_De_Dados\recriar-banco-1.0.0.ps1 -Database senx_apresentacao
```

O script solicita a senha inicial com digitação oculta. Para recriar as tabelas SENX de um banco existente, interrompa a aplicação e informe explicitamente o nome do destino:

```powershell
.\Banco_De_Dados\recriar-banco-1.0.0.ps1 -Database senx_apresentacao -Reset -ConfirmReset senx_apresentacao
```

Esse reset apaga os dados SENX do destino informado. Antes, o script gera e confere um backup custom em `backups/`; remoção, DDL e seed são uma única transação. Recusa bancos de sistema, destinos com outras tabelas e reset sem confirmação exata. Não remove arquivos de áudio nem altera automaticamente a conexão da API. Para preservar dados existentes, continue usando as migrações incrementais; o schema limpo não é uma atualização incremental.

Execução direta do SQL requer `psql -X --single-transaction -v ON_ERROR_STOP=1 -f Banco_De_Dados/senx-1.0.0-limpo.sql` e a variável de ambiente privada `SENX_ADMIN_HASH` com hash BCrypt de custo mínimo 12. Prefira o script para gerar o hash sem expor senha no histórico do terminal.

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

## Vínculos de clientes na versão atual

Os nomes dos scripts `senx-1.0.0-limpo.sql` e `recriar-banco-1.0.0.ps1` são históricos e continuam válidos; não foram renomeados. O repositório também cria `ClienteUsuario` e popula vínculos a partir do responsável e das ligações. Essa inicialização ocorre em tempo de execução e requer permissões de criação/escrita; o setup Neon não deve ser presumido completo apenas pela contagem de tabelas. Valide em banco separado antes de produção. Nenhuma migração foi executada na limpeza de 13/11/2026.

## Prioridade de análise no código atual

Apesar da versão exibida permanecer v1.5.0.0, o código inclui `priority` (0 normal, 1 média, 2 alta) e `priorityReason`, independentes da nota. O snapshot prioriza esses registros antes da data. Bancos antigos precisam de `Banco_De_Dados/migrations/1.5.1-prioridade-analise.sql` (nome do arquivo preservado); os schemas de instalação nova já incluem as colunas. Essa migração não foi executada nesta revisão documental.
