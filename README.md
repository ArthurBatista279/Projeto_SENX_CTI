# SENX — CTI · 0.1.4.3

Backend .NET 10 + Npgsql / EF Core: `BackEnd/SenxCti.Api`. Fonte única da interface: `Aplicacao/SenxCti.Web/wwwroot`.
Solução Visual Studio: `BackEnd/Projeto.SENX.CTI.slnx`.

## Versão 0.1.4.3 — Telas Prontas, Interatividade e Prontidão de Banco

A versão 0.1.4.3 entrega a interface da SENX **100% pronta, interativa e navegável**, com todas as telas funcionando perfeitamente enquanto a reestruturação do banco de dados e da API é realizada pela equipe:

- **Ligações:** Filtros combinados por busca, equipe, status da análise, assunto e data; métricas do topo calculadas dinamicamente; paginação funcional; modal de detalhes completos da chamada e exportação em CSV formatado com proteção contra injeção de fórmulas.
- **Resumos e Transcrições:** Seleção de ligações com sincronização em tempo real; transcrição formatada em balões de diálogo com carimbos de tempo de Atendente e Cliente; reprodutor de áudio interativo com Play/Pause, barra de progresso com busca (seek), velocidades (1x a 2x) e contadores; revisão e validação de resumos pela supervisão com toasts e badges.
- **Relatórios Gerenciais:** Abas por categoria (Qualidade, Retenção, Desenvolvimento, Conformidade); métricas compiladas; modal interativo para geração de novos relatórios; visualização de relatórios executivos e exportação.
- **Rankings de Desempenho:** Classificação detalhada de atendentes e equipes com pódio (1º, 2º e 3º lugares com medalhas), barras visuais de nota, taxas de resolução (FCR), TMA e exportação em CSV.
- **Configurações / Perfil:** Edição de dados do usuário autenticado (nome, e-mail) com confirmação e validação de troca de senha.
- **Administração:** Gestão de colaboradores com modal de cadastro, ativação/desativação de status; gestão de departamentos/equipes; e catálogo de critérios com switch Ativo/Inativo em tempo real.
- **Modo Demonstração Integrado:** Permite navegar e testar todas as funcionalidades mesmo com a API ou o PostgreSQL em reestruturação, sem bloquear o usuário na tela de login. Os contratos de dados seguem estritamente os tipos e entidades do banco de dados para integração direta quando a reestruturação terminar.

## Executar e entrar

Na raiz, execute `npm start` e abra http://localhost:5080.
- Para navegar imediatamente mesmo com o banco em manutenção, clique em **"Explorar Telas • Modo Demonstração"** na tela de login.
- Se o banco de dados estiver configurado, realize o primeiro acesso como Administrador ou faça login com sua conta.

- Administrador: gerencia colaboradores, equipes e critérios; consulta todos os registros e relatórios.
- Colaborador: consulta suas próprias ligações e análises, seu perfil e os critérios ativos.

## PostgreSQL e migração

A configuração privada fica em `BackEnd/SenxCti.Api/appsettings.Local.json`, ignorada pelo Git:

```json
{
  "SENX_DB_CONNECTION": "Host=127.0.0.1;Port=5432;Database=senx_cti;Username=senx_app;Password=PREENCHA_LOCALMENTE"
}
```

Para preparar um novo banco: importe `Banco_De_Dados/senx.sql` com psql e depois execute `Banco_De_Dados/atualizar-0.1.4.ps1`.

## Diagnóstico separado

Em outro terminal, execute `npm run diagnostico`. Abra http://localhost:4174.

## Verificação

- `npm test`: interface, sessão do navegador e isolamento do diagnóstico (13 testes aprovados).
- `dotnet build BackEnd/SenxCti.Api`: compilação da API C# .NET 10 com 0 erros.
