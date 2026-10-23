# SENX — CTI · 0.1.2

Fonte principal das telas: `Aplicacao/SenxCti.Web/wwwroot`.
`FrontEnd` é a cópia gerada para revisão; não é a fonte principal.

Para executar a aplicação local:
```powershell
dotnet run --project BackEnd/SenxCti.Api --urls http://localhost:5080
```

O perfil local usa Development. A configuração de conexão fica em `BackEnd/SenxCti.Api/appsettings.Local.json` (ignorado pelo Git) ou na variável `SENX_DB_CONNECTION`. Nunca compartilhe esse arquivo.

Comandos da raiz: `npm test`, `npm run dev`, `npm run gerenciar` e `npm run exportar`.
A prévia Node encaminha a API para a porta 5080. O gerenciador abre em `/gerenciador/`.

Os registros de negócio vêm do PostgreSQL. Sem API/banco, as telas ficam vazias e mostram a pendência.
O esquema oficial é `Banco_De_Dados/senx.sql`. Não há carga automática de exemplos nem alteração automática de esquema.

Documentação e relatórios da versão estão somente no Obsidian, em Projeto SENX - CTI.
O projeto pessoal Mark_LV não integra esta aplicação.
