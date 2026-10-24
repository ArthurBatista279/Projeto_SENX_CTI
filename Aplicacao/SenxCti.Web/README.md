# SENX Web · 0.1.4.2

Fonte da interface: wwwroot. Execute `npm start` na raiz e abra http://localhost:5080.
O primeiro acesso permite criar o administrador quando o banco ainda está sem usuários.
Login e logout usam sessão por cookie; colaboradores são cadastrados pela administração.
Administradores gerenciam cadastros. Colaboradores consultam somente seu próprio atendimento.
O diagnóstico continua separado em http://localhost:4174 (`npm run diagnostico`) e exige administrador.
O helper session.js é compartilhado pelas duas telas para requisições com CSRF. Não há persistência de senhas ou tokens de autenticação em localStorage.

Interface baseada nos 15 SVGs completos de SENX_Figma_Telas, com componentes HTML e estilos responsivos. Fonte Inter incluída localmente, com licença OFL em wwwroot/assets. Fotografias e dados fictícios das referências não são usados na aplicação.
Configurações usa dimensões compactas e permite salvar nome/e-mail, descartar alterações e trocar a senha mediante confirmação da senha atual. Equipe, cargo e perfil de acesso permanecem protegidos. Trocar senha encerra as sessões anteriores. Os módulos Ligações e Resumos permitem atualizar a consulta.
Relatórios, rankings, áudio e recuperação de senha sem acesso à conta aguardam integração; as ações indisponíveis são identificadas na tela. Os formulários preservam campos exigidos pela API, mesmo quando não aparecem nos desenhos.
