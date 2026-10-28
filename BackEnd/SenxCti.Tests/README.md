# Verificações de regressão — 28/10/2026

Executar a partir de BackEnd:

```powershell
dotnet restore SenxCti.Tests/SenxCti.Tests.csproj
dotnet run --project SenxCti.Tests/SenxCti.Tests.csproj -c Release --no-restore
```

Este é um executável de testes com código de saída 1 em caso de falha; não usa `dotnet test`.

## Cinco rodadas

1. Repositórios reais: busca por Guid, atualização por corpo/URL de cada campo escalar e marcação para exclusão, com rastreamento EF e SaveChanges substituído. Não executa SQL.
2. Integração HTTP: nove controllers (incluindo Alerta), CRUD, registros inexistentes, JSON inválido, campos obrigatórios, IDs vazios, timeout e conflito FK simulados, sem exposição de detalhes internos.
3. Upload: extensão proibida, tamanho acima de 5 MB, gravação integral, acesso ao arquivo, preservação da imagem e remoção do arquivo após falha de cadastro.
4. Autorização: anônimos bloqueados, usuário colaborador sem acesso ao controller administrativo, health, Swagger e rota inexistente.
5. Carga: 1.000 GETs, no máximo 20 simultâneos, alternando health e listagem de equipes.

## Resultados

- Antes: 1.213 verificações passaram e 32 falharam (`baseline.log`).
- Após correções: 1.306 passaram, zero falhas (`after-fixes.log`).
- Revisão final ampliada, em Release: 1.360 passaram, zero falhas (`final.log`).
- Build Release: zero erros e zero avisos de compilação; SDK instalado é preview.
- `git diff --check`: sem erros.

A quantidade final cresceu porque os fluxos antes bloqueados pelo POST passaram a executar e foram adicionados casos de regressão.

## Erros corrigidos

- AlertaRepository passava string para Find de uma chave Guid, causando exceção na busca/exclusão.
- GET por ID inexistente resultava em 204; agora retorna 404 nos nove controllers.
- Alerta retornava sucesso ao atualizar/excluir ID inexistente e não rejeitava Guid.Empty; agora segue as mesmas verificações dos demais controllers.
- Propriedades de navegação eram exigidas na validação MVC, bloqueando JSONs contendo apenas os campos e IDs. Elas agora usam JsonIgnore e ValidateNever; relacionamentos continuam mapeados no EF, mas não entram no contrato JSON. Envie os IDs, não objetos relacionados aninhados.
- Capturas genéricas nos controllers convertiam falhas de infraestrutura em 400 e retornavam mensagens internas. Agora os erros seguem para o middleware existente: 409 para os conflitos PostgreSQL tratados e 503 para indisponibilidade tratada.
- Dependência System.Security.Cryptography.Pkcs 9.0.11 tinha dois avisos NuGet. Fixada em 9.0.21, versão corrigida para ambos os avisos:
  - https://github.com/advisories/GHSA-846f-f764-76mx
  - https://github.com/advisories/GHSA-2fmv-rv2c-59x7

## Limites

Nenhum dado real foi alterado. HTTP usa TestServer, repositórios em memória e autenticação de teste registrada apenas neste projeto. A rodada de repositórios usa o modelo e rastreamento EF reais, mas não persiste dados. Não valida migrações, SQL, transações, restrições reais do PostgreSQL, emissão/verificação real de JWT, desempenho de produção ou limites de corpo do Kestrel. O teste de upload valida o limite de tamanho do DTO. Os tempos de carga dos logs medem apenas o ambiente em memória e não devem ser usados para dimensionar produção.

Os testes criam uma pasta temporária exclusiva por execução e a removem ao finalizar. A autenticação simulada não é registrada na API de produção.
