# Projeto SENX — CTI

Base técnica inicial da plataforma de análise de ligações da CTI. O projeto recebe gravações do PABX, organiza transcrições e prepara análises para atendentes, supervisores e gestores.

## Estrutura

- `Aplicacao/SenxCti.Web/wwwroot`: fonte principal das telas SENX v0.1 em HTML, CSS e JavaScript;
- `FrontEnd`: cópia portátil gerada para revisão em outras máquinas; não é a pasta principal;
- `BackEnd/SenxCti.Api`: API ASP.NET Core em C#/.NET 10;
- `BackEnd/SenxCti.Api.Tests`: testes de integração;
- `Banco_De_Dados`: esquema inicial PostgreSQL;
- `APIs`: teste de carga protegido para a IA;
- `SENX_Figma_Telas`: referências visuais oficiais.
- `Documentacao/Ferramentas/Diagnostico`: gerenciador interno de desenvolvimento;
- `Documentacao/Ferramentas/Diagnostico/tools`: utilitários de prévia e exportação.

O projeto Mark_LV não faz parte desta base.

## Executar

```powershell
npm run dev
```

Abra `http://localhost:4173` e use **Explorar demonstração**. Para distribuir a revisão, execute `npm run exportar` e compartilhe a pasta `FrontEnd` inteira. Quem receber pode abrir `FrontEnd/index.html` diretamente, sem instalar banco, API ou Node.

As oito telas principais e as telas/formulários de Administração estão disponíveis. Dados e métricas são fictícios; cadastros e perfil são salvos somente no navegador. A opção **Relatar problema** baixa um arquivo para compartilhar com a equipe. **Restaurar demonstração** recupera os exemplos.

Os arquivos em `FrontEnd` são gerados a partir de `Aplicacao/SenxCti.Web/wwwroot`. Faça as alterações na fonte principal e exporte novamente, evitando duas bases divergentes.

## Validar e executar com C#

```powershell
npm test
npm test --prefix .\FrontEnd
dotnet test .\Projeto_SENX_CTI.slnx
dotnet run --project .\BackEnd\SenxCti.Api --urls http://localhost:5080
```

Em execução com C#, a interface é servida em `http://localhost:5080`. O teste técnico do adaptador de IA permanece em `node .\APIs\load-test.mjs`.

O provedor de IA é simulado nesta etapa. O conector real depende da escolha do modelo e da definição de cota, custo, privacidade e limite de carga. Também seguem pendentes a integração com o PABX, a matriz de permissões e as regras de produto ainda não validadas.

O PostgreSQL e as integrações reais ficam a cargo da equipe de back-end nesta etapa. A versão 0.2 será estruturada sobre esta fonte principal, conforme as dependências e regras forem validadas.
