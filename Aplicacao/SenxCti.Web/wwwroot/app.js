/* SENX 1.5.0.0 — Fonte única da interface: wwwroot. Totalmente integrada ao backend .NET e PostgreSQL. */
(() => {
  'use strict';

  // ============================================================================
  // 1. ESTADO GLOBAL, SESSÃO E HELPERS BASE
  // ============================================================================
  const C = window.SenxCore, state = window.SenxData, e = C.escapeHtml;
  const ui = {
    page: 1, query: '', team: '', status: '', date: '', selected: null, tab: 'resumo',
    adminTab: 'usuarios', analysis: '', topic: '', profile: '', reportType: 'Todos',
    callLimit: 200, audioPlaying: false, audioCurrentTime: 0, audioDuration: 345,
    audioSpeed: 1, userStatus: '', reportStatus: ''
  };
  const stopAudio = () => document.querySelector('audio')?.pause();
  const app = document.querySelector('#app');
  let connection = 'loading', connectionDetail = '', lastRoute = '', toastTimer, lastFocus;
  let session = null, authReady = false, setupRequired = false, setupTeams = [], authError = '';
  const request = window.SenxSession.request;
  window.addEventListener('senx-upload-completed', async event => {
    await loadDatabase();
    toast(event.detail?.simulated
      ? 'Demonstração simulada concluída. Não representa o conteúdo do áudio.'
      : isAdmin()
        ? 'Análise concluída. Revise o resultado na lista de ligações.'
        : 'Análise concluída. O resultado está disponível para consulta.');
    if (document.activeElement === document.body) document.querySelector('[data-action=upload-audio]')?.focus();
  });
  const isAdmin = () => session?.profile === 'Administrador';
  const recordActions = (kind, id) => kind === 'calls' || isAdmin()
    ? btn(icon('more') + '<span class="sr-only">Mais ações</span>', 'record-actions', 'icon-action secondary', kind + ':' + id) : '';
  const deletionRules = {
    calls: { label: 'ligação', action: 'delete-record', impact: 'A ligação, sua gravação não compartilhada, análise, revisão e registros associados serão removidos. Os relatórios já gerados serão preservados.' },
    reports: { label: 'relatório', action: 'delete-report', impact: 'Somente este relatório será removido. As ligações, gravações, análises e revisões de origem serão preservadas.' },
    users: { label: 'colaborador', action: 'delete-user', eligible: u => u.active === false && u.id !== session?.id },
    customers: { label: 'cliente', action: 'delete-customer', eligible: c => c.status === 'Inativo' },
    criteria: { label: 'critério', action: 'delete-record' },
    teams: { label: 'departamento', action: 'delete-record' }
  };

  function deletableRecord(kind, id) {
    if (!isAdmin() || !Object.hasOwn(deletionRules, kind)) return null;
    const rule = deletionRules[kind], row = state[kind]?.find(item => item.id === id);
    return row && (!rule.eligible || rule.eligible(row)) ? { rule, name: row.title || row.name || row.client || id } : null;
  }

  function confirmDeletion(kind, id) {
    const record = deletableRecord(kind, id);
    if (!record) return;
    const { rule, name } = record;
    modal('Excluir ' + rule.label, 'Confirmação de exclusão definitiva', `
      <input type="hidden" name="id" value="${e(id)}">
      <input type="hidden" name="kind" value="${kind}">
      <p>Excluir definitivamente <strong>${e(name)}</strong>?</p>
      <p>${e(rule.impact || 'Cadastros com vínculos não podem ser excluídos.')}</p>
      <p class="delete-warning">Esta ação é permanente e não pode ser desfeita.</p>
    `, 'delete-form');
  }

  const paths = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z"/>',
    report: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4"/>',
    summary: '<path d="M5 3v17h16M9 5h10M9 9h7M9 13h10M9 17h5"/>',
    ranking: '<path d="M8 21h8M12 17v4M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4"/>',
    settings: '<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
    admin: '<path d="m12 2 9 5v6c0 5-9 9-9 9s-9-4-9-9V7l9-5Z"/><path d="M9 12h6M12 9v6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    filter: '<path d="M3 4h18l-7 8v7l-4 2v-9Z"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M5 16v5h14v-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17v.1"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
    exit: '<path d="M10 4H4v16h6M13 8l5 4-5 4M8 12h13"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    play: '<path d="m8 4 12 8-12 8V4Z"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 3a4 4 0 0 1 0 8M20 21v-3a7 7 0 0 0-3-6"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
    sparkle: '<path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3Z"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="m15.4 12.8 2.6 7.2-6-3.6-6 3.6 2.6-7.2"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>'
  };

  const icon = name => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.info) + '</svg>';
  const brand = () => '<div class="brand"><img src="assets/senx-symbol.png" alt=""><img src="assets/senx-wordmark.png" alt="SENX"></div>';
  const btn = (text, action, style = '', id = '') => '<button type="button" class="btn ' + style + '" data-action="' + action + '" data-id="' + e(id) + '">' + text + '</button>';
  const badge = (text, tone = 'blue') => '<span class="badge ' + tone + '">' + e(text) + '</span>';
  const empty = (title = 'Nenhum registro no banco de dados.', text = 'Os dados aparecerão aqui conforme forem registrados no PostgreSQL.') => '<div class="empty-state"><strong>' + e(title) + '</strong><p>' + e(text) + '</p></div>';
  const input = (name, label, value = '', type = 'text', required = true) => '<div class="form-field"><label for="field-' + name + '">' + label + (required ? ' *' : '') + '</label><input id="field-' + name + '" name="' + name + '" type="' + type + '" value="' + e(value) + '" maxlength="' + (type === 'password' ? 128 : name === 'name' ? 200 : 255) + '" ' + (type === 'password' ? 'minlength="12" autocomplete="new-password"' : '') + (required ? ' required' : '') + '></div>';
  const person = (name, subtitle = '') => '<div class="person"><span class="avatar">' + e(C.initials(name || '?')) + '</span><div><strong>' + e(name || 'Não informado') + '</strong><small>' + e(subtitle) + '</small></div></div>';
  const warn = (title, text) => '<div class="banner warning">' + icon('alert') + '<div><strong>' + e(title) + '</strong><small>' + e(text) + '</small></div></div>';
  const note = (title, text) => '<div class="banner info">' + icon('info') + '<div><strong>' + e(title) + '</strong><small>' + e(text) + '</small></div></div>';
  const emptyRow = (columns, title, text = '') => '<tr class="empty-row"><td colspan="' + columns + '">' + empty(title, text) + '</td></tr>';
  const analysisLabel = c => c.processed === true ? 'Concluída' : c.processed === false ? 'Em análise' : 'Não analisada';
  const analysisBadge = c => badge(/simulado/i.test(c.model || '') ? 'Simulada — demonstração' : analysisLabel(c), /simulado/i.test(c.model || '') ? 'amber' : c.processed === true ? 'green' : c.processed === false ? 'purple' : 'neutral');
  const field = (label, control, extra = '') => '<label class="field-control ' + extra + '"><span>' + label + '</span>' + control + '</label>';

  function toast(text) {
    const box = document.querySelector('#toast');
    if (!box) return;
    box.textContent = text;
    box.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('visible'), 4500);
  }

  function download(name, text, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearData() {
    ranking.request++;
    ranking.data = null;
    Object.assign(state, { calls: [], teams: [], users: [], criteria: [], customers: [], counts: {}, reports: [], rankings: [], source: null, fetchedAt: null });
    ui.callLimit = 200;
  }

  async function startSession() {
    authError = '';
    try {
      const status = await request('/api/auth/status');
      setupRequired = status.setupRequired;
      setupTeams = status.teams || [];
      if (!setupRequired) {
        try { session = await request('/api/auth/session'); }
        catch (error) { if (error.status !== 401) throw error; session = null; }
      }
      authReady = true; render();
      if (session) await loadDatabase();
    } catch (error) {
      authError = error.message;
      authReady = true;
      render();
    }
  }

  window.addEventListener('senx-session-expired', () => { session = null; clearData(); closeModal(); render(); });

  async function loadDatabase() {
    if (!session) return;
    connection = 'loading'; render();
    try {
      const data = await request('/api/data/snapshot?limit=' + ui.callLimit);
      if (data.source !== 'postgresql' || !['calls', 'teams', 'users', 'criteria'].every(k => Array.isArray(data[k]))) {
        throw new Error('Contrato de dados inválido da API.');
      }
      Object.assign(state, data);
      state.customers = Array.isArray(data.customers) ? data.customers : []; state.reports = Array.isArray(data.reports) ? data.reports : [];
      state.rankings = Array.isArray(data.rankings) ? data.rankings : [];
      connection = 'connected';
      connectionDetail = '';
      if (!state.calls.some(c => c.id === ui.selected)) ui.selected = C.prioritizeCalls(state.calls)[0]?.id || null;
    } catch (error) {
      Object.assign(state, { calls: [], teams: [], users: [], criteria: [], customers: [], counts: {}, reports: [], rankings: [], source: null, fetchedAt: null });
      if (error.status === 401) session = null;
      connection = 'error';
      connectionDetail = error.message;
    }
    render();
  }

  // ============================================================================
  // 2. COMPONENTES REUTILIZÁVEIS (Ícones, Cards, Tabelas, Paginação e Shell)
  // ============================================================================
  const connected = () => connection === 'connected';
  const count = name => connected() ? (state.counts[name] ?? state[name.toLowerCase() + 's']?.length ?? 0) : '—';
  const metric = (label, value, name, tone = 'blue', caption = '') => `
    <article class="metric">
      <span class="metric-icon ${tone}">${icon(name)}</span>
      <div><label>${label}</label><strong>${e(value)}</strong><small>${e(caption)}</small></div>
    </article>`;

  function head(title, subtitle, actions = '') {
    const stamp = state.fetchedAt
      ? new Date(state.fetchedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : 'Aguardando atualização';
    return `
      <header class="page-head">
        <div><h1>${title}</h1><p>${subtitle}</p></div>
        <div class="head-actions">
          <span class="updated-stamp">${e(state.fetchedAt ? 'Atualizado em ' + stamp : stamp)}</span>
          ${actions}
        </div>
      </header>`;
  }

  const teamOptions = () => state.teams
    .map(t => `<option value="${e(t.name)}" ${ui.team === t.name ? 'selected' : ''}>${e(t.name)}</option>`)
    .join('');

  const search = (placeholder = 'Pesquisar', label = 'Buscar') => `
    <label class="field-control search">
      <span>${label}</span>
      <div class="input-icon">
        ${icon('search')}
        <input type="search" data-filter="query" value="${e(ui.query)}" placeholder="${placeholder}">
      </div>
    </label>`;

  const teamFilter = (label = 'Equipe') => field(label, `
    <div class="input-icon">
      ${icon('users')}
      <select data-filter="team"><option value="">Todas as equipes</option>${teamOptions()}</select>
    </div>`);

  const dateFilter = () => field('Período', `<input aria-label="Período" type="date" data-filter="date" value="${e(ui.date)}">`);

  const analysisFilter = () => field('Análise / revisão', `
    <select data-filter="analysis">
      <option value="">Todos os estados</option>
      ${['Concluída', 'Em análise', 'Não analisada', 'Aguarda revisão'].map(v => `<option ${ui.analysis === v ? 'selected' : ''}>${v}</option>`).join('')}
    </select>`);

  const topicFilter = () => field('Assunto', `
    <select data-filter="topic">
      <option value="">Todos os assuntos</option>
      ${[...new Set(state.calls.map(c => c.topic).filter(Boolean))].map(v => `<option ${ui.topic === v ? 'selected' : ''}>${e(v)}</option>`).join('')}
    </select>`);

  const filteredCalls = () => C.prioritizeCalls(C.filterCalls(state.calls, ui).filter(c =>
    (!ui.analysis || (ui.analysis === 'Aguarda revisão' ? c.processed === true && !c.reviewed : analysisLabel(c) === ui.analysis)) &&
    (!ui.topic || c.topic === ui.topic)));
  const hasRealAnalysis = c => c.processed === true && !/simulado/i.test(c.model || '');
  const callHighlight = c => (c.processed === true && !c.reviewed) ? 'needs-review' : C.callPriority(c) === 2 ? 'high-priority' : C.callPriority(c) === 1 ? 'medium-priority' : hasRealAnalysis(c) ? 'normal-priority' : '';
  const priorityBadge = c => !hasRealAnalysis(c)
    ? ''
    : `<span class="call-priority-label" title="${e(c.priorityReason || 'Atendimento sem risco crítico identificado pela IA.')}">${badge(C.callPriority(c) === 2 ? 'Alta prioridade' : C.callPriority(c) === 1 ? 'Média prioridade' : 'Prioridade normal', C.callPriority(c) === 2 ? 'red' : C.callPriority(c) === 1 ? 'yellow' : 'green')}</span>`;

  function pager(result, label = 'registros') {
    const pages = Array.from({ length: Math.min(result.pages, 3) }, (_, i) => Math.max(1, Math.min(result.page - 1, result.pages - 2)) + i);
    return `
      <div class="pagination">
        <span>Mostrando ${result.items.length} de ${result.total} ${label}</span>
        <div class="pages">
          <button data-page="${result.page - 1}" ${result.page <= 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>
          ${pages.map(p => `<button data-page="${p}" class="${result.page === p ? 'selected' : ''}" aria-label="Página ${p}">${p}</button>`).join('')}
          <button data-page="${result.page + 1}" ${result.page >= result.pages ? 'disabled' : ''} aria-label="Próxima página">›</button>
        </div>
      </div>`;
  }

  function table(headers, rows, extra = '') {
    return `
      <div class="table-wrap ${extra}">
        <table>
          <thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;
  }

  function shell(content, active) {
    const nav = [
      ['ligacoes', 'Ligações', 'phone'],
      ['clientes', 'Clientes', 'users'],
      ['resumos', 'Resumos', 'summary'],
      ['relatorios', 'Relatórios', 'report'],
      ['rankings', 'Rankings', 'ranking'],
      ['configuracoes', 'Configurações', 'settings'],
      ['administracao', 'Administração', 'admin']
    ].filter(([route]) => route !== 'administracao' || isAdmin());

    const banner = connection === 'error'
      ? note('Conexão indisponível', connectionDetail)
      : connected() && Number(state.counts.Ligacao) > state.calls.length
        ? note('Recorte de consulta', 'Exibindo as ' + state.calls.length + ' ligações mais recentes. Filtros, exportação e métricas desta lista se referem a esse recorte.')
        : '';

    const navHtml = nav.map(([route, label, name]) => `
      <a href="#${route}" class="nav-link ${active === route ? 'active' : ''}" ${active === route ? 'aria-current="page"' : ''}>
        ${icon(name)}${label}
      </a>`).join('');

    return `
      <div class="layout screen-${active}">
        <div class="mobile-bar">
          <button type="button" class="btn secondary small" data-action="menu" aria-label="Menu principal" aria-controls="main-sidebar" aria-expanded="false">${icon('menu')}</button>
          <a class="mobile-brand" href="#ligacoes"><img src="assets/senx-wordmark.png" alt="SENX"></a>
          <a class="mobile-profile" href="#configuracoes" aria-label="Meu perfil">${icon('users')}</a>
        </div>
        <aside class="sidebar" id="main-sidebar">
          <a class="brand-link" href="#ligacoes" aria-label="SENX — Ligações">${brand()}</a>
          <nav class="nav-list" aria-label="Menu principal">${navHtml}</nav>
          <div class="sidebar-bottom">
            <a href="#configuracoes" class="sidebar-person">${person(session?.name || 'Usuário', session?.job || 'SENX')}</a>
            <div class="sidebar-note"><small>v1.5.0.0</small></div>
          </div>
        </aside>
        <main class="content" id="main" tabindex="-1">${banner}${content}</main>
      </div>`;
  }

  // ============================================================================
  // 3. TELAS DE AUTENTICAÇÃO (Login, Primeiro Acesso e Saída)
  // ============================================================================
  function decorations() {
    return '<span class="decoration diamond one"></span><span class="decoration diamond two"></span><span class="decoration sphere one"></span><span class="decoration sphere two"></span>';
  }

  function passwordField(name, label, placeholder, setup = false) {
    const id = name === 'password' ? 'login-password' : 'field-' + name;
    return `
      <div class="form-field">
        <label for="${id}">${label}</label>
        <div class="password-wrap">
          <input id="${id}" name="${name}" type="password" maxlength="128" ${setup ? 'minlength="12" autocomplete="new-password"' : 'autocomplete="current-password"'} placeholder="${placeholder}" required>
          <button type="button" data-action="toggle-password" data-id="${id}" aria-label="Mostrar ${label.toLowerCase()}">${icon('eye')}</button>
        </div>
      </div>`;
  }

  function auth(setup = false) {
    const register = setup;
    if (!setup && location.hash === '#cadastro') location.hash = 'login';
    const team = setupTeams.length
      ? `<div class="form-field"><label for="setup-team">Equipe *</label><select id="setup-team" name="teamId" required>${setupTeams.map(t => `<option value="${e(t.id)}">${e(t.name)}</option>`).join('')}</select></div>`
      : input('teamName', 'Nome da equipe') + input('department', 'Departamento');
    const headline = register
      ? 'Crie Sua Conta e<br>Comece a Transformar<br>Seus Dados ↗'
      : 'Transforme Sua Rotina<br>Complicada Em Uma<br>Experiência Mais<br>Simples ↗';
    const help = register
      ? `<label class="consent"><input type="checkbox" disabled title="Documentos de uso ainda não publicados."><span>Concordo com os <button type="button" data-action="policy">Termos de Uso</button> e a <button type="button" data-action="policy">Política de Privacidade</button></span></label>`
      : `<div class="auth-help"><label title="Mantenha a sessão por até 14 dias neste dispositivo."><input type="checkbox" name="rememberMe" role="switch"><span>Lembre-me</span></label><button type="button" data-action="forgot">Esqueceu a senha?</button></div>`;

    return `
      <div class="auth ${register ? 'auth-register' : 'auth-login'}">
        <section class="auth-story">
          ${decorations()}
          <div class="auth-copy">
            <h1>${headline}</h1>
            <p>A SENX é uma plataforma avançada de análise de dados impulsionada por IA, projetada para transformar a maneira como as empresas compreendem e aproveitam seus dados.</p>
          </div>
        </section>
        <main id="main" class="auth-panel">
          <div class="auth-card ${setup ? 'setup-card' : ''}">
            ${brand()}
            <h2>${register ? 'Crie sua conta' : 'Bem-Vindo de volta!'}</h2>
            ${register ? '<p>Preencha os campos abaixo para se cadastrar</p>' : ''}
            <form id="auth-form">
              ${register ? '<div class="form-field"><label for="field-name">Nome completo</label><input id="field-name" name="name" maxlength="200" placeholder="Seu nome completo" autocomplete="name" required></div>' : ''}
              <div class="form-field">
                <label for="login-email">E-mail</label>
                <input id="login-email" name="email" type="email" maxlength="255" placeholder="${register ? 'seu@email.com' : 'Email'}" autocomplete="username" required>
              </div>
              ${passwordField('password', 'Senha', register ? 'Crie uma senha' : 'Senha', register)}
              ${register ? passwordField('confirm', 'Confirmar senha', 'Confirme sua senha', true) : ''}
              ${setup ? team : ''}
              ${help}
              <p class="form-error" role="alert">${e(authError)}</p>
              <button class="btn full" type="submit">${register ? 'Criar Conta' : 'Login'}</button>
            </form>
            <div class="auth-footer">${register ? 'Já tem uma conta? <a href="#login">Faça login</a>' : 'Solicite seu acesso ao administrador.'}</div>
            <div class="auth-notice">${setup ? 'Primeiro acesso: crie o administrador com senha de 12 a 128 caracteres.' : 'Entre com sua conta para acessar o sistema.'}</div>
          </div>
        </main>
      </div>`;
  }

  // ============================================================================
  // 4. TELA: LIGAÇÕES (Listagem, Métricas, Player e Transcrição)
  // ============================================================================
  function callsPage() {
    const calls = filteredCalls();
    const result = C.paginate(calls, ui.page);
    const analyzed = calls.filter(c => c.processed === true && !/simulado/i.test(c.model || '')).length;
    const reviewedCount = calls.filter(c => c.reviewed === true).length;
    const scores = calls.filter(c => c.analysisId && !/simulado/i.test(c.model || '') && Number.isFinite(c.score)).map(c => c.score);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) + ' pts' : '—';
    const average = calls.length ? C.duration(Math.round(calls.reduce((n, c) => n + (Number(c.seconds) || 0), 0) / calls.length)) : '—';

    const rows = result.items.map(c => {
      const needsReview = callHighlight(c);
      const scoreBadge = c.score != null
        ? badge(c.score + ' pts', c.score >= 90 ? 'green' : c.score >= 75 ? 'amber' : 'red')
        : badge('Pendente', 'neutral');
      return `
        <tr class="${needsReview}">
          <td>${person(c.client, c.team)}${priorityBadge(c)}</td>
          <td>${e(c.phone)}</td>
          <td>${C.formatDate(c.date)} ${e(c.time)}</td>
          <td>${C.duration(c.seconds)}</td>
          <td>${scoreBadge}</td>
          <td>${badge(c.topic || 'Geral', 'neutral')}</td>
          <td>${analysisBadge(c)}</td>
          <td>
            <div class="row-actions">
              ${btn(icon('play') + '<span class="sr-only">Ouvir e Ver</span>', 'call', 'icon-action', c.id)}
              ${recordActions('calls', c.id)}
            </div>
          </td>
        </tr>`;
    });

    const loadMoreBtn = Number(state.counts.Ligacao) > state.calls.length && ui.callLimit < 10000
      ? btn('Carregar mais ligações', 'load-more', 'secondary small') : '';

    const reviewBanner = isAdmin() ? `
      <div class="banner warning review-banner">
        ${icon('alert')}
        <div>
          <strong>${connected() ? state.calls.filter(c => c.processed === true && !c.reviewed).length : '—'} ligações com revisão pendente</strong>
          <small>Confira a transcrição e as evidências antes de validar a análise.</small>
        </div>
        ${btn('Revisar agora', 'review-pending', 'small')}
      </div>` : '';

    return head(
      'Análise de Ligações',
      'Triagem de chamadas com transcrição e resumos estruturados por IA',
      btn(icon('upload') + ' Enviar gravação', 'upload-audio', 'small') +
      (isAdmin() ? btn(icon('download') + ' Exportar CSV', 'export-calls', 'secondary small') : '') +
      btn('Atualizar', 'refresh', 'secondary small') +
      loadMoreBtn
    ) + reviewBanner + `
      <section class="metrics five">
        ${metric('Ligações no recorte', connected() ? calls.length : '—', 'phone')}
        ${metric('Analisadas (IA)', connected() ? analyzed : '—', 'summary', 'indigo', 'Processamento concluído')}
        ${metric('Revisões validadas', connected() ? reviewedCount : '—', 'check', 'green')}
        ${metric('Nota média registrada', connected() ? avgScore : '—', 'check', 'green', 'Média de avaliações')}
        ${metric('Duração Média', connected() ? average : '—', 'clock', 'purple', 'Tempo médio')}
      </section>
      <section class="panel calls-filters">
        <div class="toolbar">
          ${search('Pesquisar por contato, telefone ou atendente...')}
          ${teamFilter('Filtrar equipe')}
          ${analysisFilter()}
          ${topicFilter()}
          ${dateFilter()}
        </div>
      </section>
      <section class="panel calls-table">
        ${table(
          ['Contato / Prioridade', 'Telefone', 'Data / hora', 'Duração', 'Pontuação IA', 'Assunto / Motivo', 'Status Análise', 'Ações'],
          rows.length ? rows : [emptyRow(8, 'Nenhuma ligação encontrada no banco de dados.')]
        )}
        <div class="legend">
          <span>Pontuação: 0 a 100 baseada nos critérios de atendimento</span>
          <span>Borda lateral: laranja = revisão pendente; após revisar: vermelha = alta prioridade; amarela clara = média prioridade; verde = prioridade normal</span>
          <span>Sentimento e tópicos extraídos por IA sujeitos à validação</span>
        </div>
        ${pager(result, 'ligações')}
      </section>`;
  }

  function renderAudioPlayer(call) {
    if (!call.hasAudio) return note('Gravação indisponível', 'Nenhum arquivo foi associado a esta ligação.');
    return `<audio controls preload="none" class="recording-player" src="/api/data/calls/${encodeURIComponent(call.id)}/audio"></audio><p class="audio-error" role="alert"></p>`;
  }

  function formatTranscript(text) {
    if (!text) return '<p class="stored-text">Transcrição não registrada.</p>';
    const lines = text.split('\n');
    return '<div class="transcript-dialogue">' + lines.map(line => {
      const match = line.match(/^(\[\d{2}:\d{2}\])\s*([^:]+):\s*(.+)$/);
      if (!match) return `<p class="stored-text">${e(line)}</p>`;
      const [, time, speaker, content] = match;
      const isAgent = !speaker.toLowerCase().includes('cliente');
      return `
        <div class="speaker-bubble ${isAgent ? 'agent' : 'client'}">
          <div class="speaker-header"><span>${e(speaker)}</span><time>${e(time)}</time></div>
          <p>${e(content)}</p>
        </div>`;
    }).join('') + '</div>';
  }

  // ============================================================================
  // 5. TELA: RESUMOS E TRANSCRIÇÕES
  // ============================================================================
  function summariesPage() {
    const calls = filteredCalls(), call = calls.find(c => c.id === ui.selected) || calls[0];
    let detail = `
      <div class="detail-title"><h2>Selecione uma ligação</h2><p class="detail-meta">Resumo, transcrição e próximos passos</p></div>
      <div class="detail-body">${empty('Nenhuma ligação selecionada.')}</div>`;

    if (call) {
      let body = '';
      if (ui.tab === 'transcricao') {
        body = `<section><h3>Transcrição da ligação em áudio</h3>${formatTranscript(call.transcript)}</section>`;
      } else if (ui.tab === 'audio') {
        body = `
          <div class="audio-box">
            <h3>Reprodução da Gravação PABX</h3>
            <p class="detail-meta">Gravação da ligação • ${e(call.client)} • Duração: ${C.duration(call.seconds)}</p>
            ${renderAudioPlayer(call)}
          </div>`;
      } else {
        body = `
          <div class="summary-topic">
            ${badge(call.topic || 'Geral', 'blue')}
            ${call.score != null ? badge('Nota: ' + call.score + '/100', call.score >= 90 ? 'green' : 'amber') : ''}
            <small>Classificação de atendimento</small>
          </div>
          <section><h3>Necessidade relatada pelo cliente</h3><p class="stored-text">${e(call.summary || 'Análise ainda não disponível. A integração de IA está em desenvolvimento.')}</p></section>
          <section><h3>Encaminhamento e Resolução</h3><p>${e(call.nextStep || 'Não informado.')}</p></section>
          <section><h3>Compromissos e Próximos Passos</h3><p>${e(call.commitments || 'Sem pendências registradas.')}</p></section>
          <div class="quote">${icon('alert')}<div><strong>Auditoria de Atendimento</strong><p>A análise é gerada com apoio de IA e confirmada pelo supervisor responsável.</p></div></div>`;
      }

      const detailTabs = [['resumo', 'Resumo', 'report'], ['transcricao', 'Transcrição', 'summary'], ['audio', 'Ouvir Ligação', 'phone']]
        .map(([id, label, name]) => `<button class="tab ${ui.tab === id ? 'active' : ''}" data-tab="${id}">${icon(name)}${label}</button>`)
        .join('');

      const reviewActions = isAdmin() && call.analysisId
        ? `<div>${btn(icon('edit') + ' Revisar resumo', 'review-call', 'secondary small', call.id)}${btn(icon('check') + ' Validar resumo', 'validate-call', call.reviewed ? 'secondary small' : 'small', call.id)}</div>`
        : '<span>Revisão disponível à administração quando houver análise.</span>';

      detail = `
        <div class="detail-title">
          <div><h2>${e(call.client)} <small>${e(call.pabxId || call.id)}</small></h2>${analysisBadge(call)}${recordActions('calls', call.id)}</div>
          <p class="detail-meta">${C.formatDate(call.date)} · ${e(call.time)} • Duração: ${C.duration(call.seconds)} • Tel: ${e(call.phone)}</p>
          ${hasRealAnalysis(call) ? `<p class="call-priority-reason">${priorityBadge(call)} ${e(C.callPriority(call) ? call.priorityReason : 'Atendimento sem risco crítico identificado pela IA.')}</p>` : ''}
          <p class="detail-meta">Equipe: ${e(call.team)} • Colaborador: ${e(call.agent)}</p>
        </div>
        <div class="tabs compact">${detailTabs}</div>
        <div class="detail-body">${body}</div>
        <div class="detail-footer">
          <span class="muted">${call.reviewed ? '✓ Resumo validado pela supervisão' : 'Aguardando revisão humana'}</span>
          ${recordActions('calls', call.id)}
          ${reviewActions}
        </div>
        <div class="privacy-foot">Acesso conforme o perfil da conta. Revisões humanas são registradas.</div>`;
    }

    const callOptions = calls.map(c => `
      <button class="call-option ${c.id === call?.id ? 'active ' : ''}${callHighlight(c)}" data-action="select-call" data-id="${e(c.id)}">
        <div class="call-option-top"><strong>${e(c.client)}</strong>${priorityBadge(c)}<small>${C.formatDate(c.date)}</small></div>
        <p>${e((c.summary || 'Sem resumo disponível.').slice(0, 110))}...</p>
        <div class="call-option-top"><small>${e(c.agent)} · ${e(c.topic || 'Geral')}</small>${analysisBadge(c)}</div>
      </button>`).join('');

    return head('Resumos e Transcrições', 'Consulte necessidades, encaminhamentos e gravações das ligações', btn('Atualizar', 'refresh', 'secondary small')) +
      warn('Inspeção de Ligações e IA', 'Valide o resumo e os compromissos antes de encaminhar tarefas a outros departamentos.') + `
      <section class="panel summary-filters">
        <div class="toolbar">
          ${search('Buscar por contato, resumo ou ID...')}
          ${teamFilter()}
          ${topicFilter()}
          ${dateFilter()}
          ${analysisFilter()}
        </div>
        <div class="filter-info">
          <span>${calls.length} ligações no recorte • Ordenadas por prioridade e, depois, mais recentes</span>
          ${btn('Limpar filtros', 'clear-filters', 'text-btn')}
        </div>
      </section>
      <div class="summary-layout">
        <section class="panel">
          <div class="panel-header"><h3>Ligações ${badge(calls.length)}</h3>${icon('filter')}</div>
          <div class="call-list">${callOptions || empty('Nenhuma ligação encontrada.')}</div>
          <div class="list-foot">Mostrando ${calls.length} ligações</div>
        </section>
        <section class="panel summary-detail">${detail}</section>
      </div>`;
  }

  // ============================================================================
  // 6. TELA: RELATÓRIOS
  // ============================================================================
  function parseReportSummary(rep) {
    const raw = rep.summary || '';
    const match = raw.match(
      /^Ligações: (\d+)\. Com análise real: (\d+)\. Validadas por pessoa \(análise real\): (\d+)\. Demonstrações simuladas: (\d+) \(excluídas das notas e dos totais de análise real\)\. Categoria organizacional; sem inferência automática\.\s*(.*)$/s
    );
    return {
      total: rep.total ?? (match ? Number(match[1]) : null),
      analyzed: rep.analyzed ?? (match ? Number(match[2]) : null),
      reviewed: rep.reviewed ?? (match ? Number(match[3]) : null),
      note: (match ? match[5] : raw).trim()
    };
  }

  const reportCategoryTone = type => ({ Qualidade: 'blue', Retenção: 'purple', Desenvolvimento: 'green', Conformidade: 'neutral' }[type] || 'blue');
  const reportStatusTone = status => status === 'Concluído' || status === 'Publicado' ? 'green' : status === 'Em andamento' ? 'purple' : status === 'Agendado' ? 'neutral' : 'amber';
  const reportCriteriaItems = rep => {
    if (Array.isArray(rep.appliedCriteria) && rep.appliedCriteria.length) return rep.appliedCriteria;
    if (rep.criteria && rep.criteria !== 'Indicadores descritivos dos registros' && rep.criteria !== 'Catálogo') {
      const items = String(rep.criteria).split(',').map(s => s.trim()).filter(Boolean);
      if (items.length) return items;
    }
    const active = state.criteria.filter(c => c.active).map(c => c.name);
    return active.length ? active : [rep.criteria || 'Catálogo'];
  };
  const reportCriteriaChips = rep => {
    const items = reportCriteriaItems(rep);
    const visible = items.slice(0, 2).map(name => badge(name, 'neutral')).join('');
    return `<div class="report-criteria-list">${visible}${items.length > 2 ? badge('+' + (items.length - 2) + ' critério(s)', 'neutral') : ''}</div>`;
  };
  const reportPrioritySummary = rep => {
    const high = Number(rep.highPriority || 0), med = Number(rep.mediumPriority || 0), norm = Number(rep.normalPriority || 0);
    if (rep.highPriority == null && rep.mediumPriority == null) return '';
    return `<div class="report-priority-chips">${high ? badge(high + ' alta', 'red') : ''}${med ? badge(med + ' média', 'yellow') : ''}${norm ? badge(norm + ' normal', 'green') : ''}</div>`;
  };

  function reportsPage() {
    const filters = ['Todos', 'Qualidade', 'Retenção', 'Desenvolvimento', 'Conformidade'];
    const categoryMetrics = [
      ['Qualidade', 'smile', 'green'],
      ['Retenção', 'alertCircle', 'yellow'],
      ['Desenvolvimento', 'clock', 'purple'],
      ['Conformidade', 'checkCircle', 'green']
    ];
    const reports = state.reports.filter(r =>
      (ui.reportType === 'Todos' || r.type === ui.reportType) &&
      (!ui.team || r.team === ui.team) &&
      (!ui.date || r.date === ui.date) &&
      (!ui.reportStatus || r.status === ui.reportStatus) &&
      C.search(r.title + ' ' + (r.team || ''), ui.query));
    const result = C.paginate(reports, ui.page);

    const rows = result.items.map(r => {
      const info = parseReportSummary(r);
      const criticalPending = Number(r.highPriorityPending || 0);
      const isAlert = criticalPending > 0;
      const sub = isAlert
        ? `Alerta · ${criticalPending} ligação(ões) crítica(s) requer(em) validação humana`
        : (info.note || (info.total != null ? info.total + ' ligação(ões) no período • ' + (info.reviewed ?? 0) + ' validada(s)' : ''));
      return `
        <tr class="${isAlert ? 'report-alert' : ''}">
          <td><strong>${e(r.title)}</strong><small class="${isAlert ? 'report-alert-text' : ''}">${e(sub.slice(0, 85))}${sub.length > 85 ? '...' : ''}</small>${reportPrioritySummary(r)}</td>
          <td>${badge(r.type, reportCategoryTone(r.type))}</td>
          <td>${e(r.team || 'Todas')}</td>
          <td>${reportCriteriaChips(r)}</td>
          <td>${e(r.period)}</td>
          <td>${badge(r.status || 'Aguarda revisão', reportStatusTone(r.status || 'Aguarda revisão'))}</td>
          <td>
            <div class="row-actions">
              ${btn(icon('eye') + ' Ver', 'view-report', 'icon-action', r.id)}
              ${isAdmin() ? btn(icon('download') + ' Baixar', 'export-report', 'icon-action secondary', r.id) : ''}
              ${recordActions('reports', r.id)}
            </div>
          </td>
        </tr>`;
    });

    const statusFilter = field('Status', `
      <select data-filter="reportStatus">
        <option value="">Todos os status</option>
        ${[...new Set(state.reports.map(r => r.status).filter(Boolean))].map(status => `<option ${ui.reportStatus === status ? 'selected' : ''}>${e(status)}</option>`).join('')}
      </select>`);

    return head('Relatórios', 'Qualidade, retenção e desenvolvimento das equipes', btn('Atualizar', 'refresh', 'secondary small')) + `
      <section class="metrics five">
        ${metric('Relatórios no recorte', reports.length, 'report', 'blue')}
        ${categoryMetrics.map(([type, iconName, tone]) => metric(type, reports.filter(r => r.type === type).length, iconName, tone)).join('')}
      </section>
      ${note(
        isAdmin() ? 'Relatórios descritivos' : 'Acesso a relatórios',
        isAdmin()
          ? 'Consolidações persistidas de volume, análises, revisões e média das notas registradas. FCR e conformidade aguardam definição.'
          : 'Consulte os relatórios cadastrados pela administração. O download está disponível somente para administradores.'
      )}
      <div class="tabs report-tabs">
        ${filters.map(v => `<button class="tab ${ui.reportType === v ? 'active' : ''}" data-action="report-tab" data-id="${v}">${v}</button>`).join('')}
      </div>
      <div class="toolbar report-toolbar">
        ${search('Buscar pelo título ou departamento do relatório...')}
        ${teamFilter()}
        ${statusFilter}
        ${dateFilter()}
        ${isAdmin() ? btn(icon('plus') + ' Novo Relatório', 'new-report') : ''}
      </div>
      <section class="panel report-table">
        ${table(['Relatório', 'Categoria', 'Departamento', 'Critérios Aplicados', 'Período', 'Status', 'Ações'], rows.length ? rows : [emptyRow(7, 'Nenhum relatório encontrado neste recorte.')])}
        ${pager(result, 'relatórios')}
      </section>
      <div class="split-notes">
        <article class="note">
          <h3>Critérios Ativos na Avaliação</h3>
          <p>Os critérios cadastrados pela administração orientam o cruzamento de dados nos relatórios.</p>
          <div class="chips">${state.criteria.filter(c => c.active).map(c => badge(c.name, 'neutral')).join('') || '<span class="muted">Nenhum critério ativo.</span>'}</div>
        </article>
        <article class="note blue">
          <h3>Resumo de Diretrizes</h3>
          <p>Os relatórios são compilados a partir das transcrições das chamadas e apoiam treinamentos e planos de ação da equipe.</p>
        </article>
      </div>`;
  }

  // ============================================================================
  // 7. TELA: RANKINGS DE DESEMPENHO
  // ============================================================================
  const rankingPeriods = ['Últimos 7 dias', 'Últimos 30 dias', 'Mês atual', 'Trimestre atual'];
  const ranking = { teamId: '', period: rankingPeriods[0], data: null, error: '', request: 0 };
  const rankingScore = value => value == null ? 'Sem avaliações' : Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  function rankingTable(rows) {
    const headers = ['Posição', 'Colaborador', 'Equipe', 'Qualidade', 'Ligações', 'Duração média', 'Avaliadas', 'Pendentes'];
    const renderedRows = rows.length ? rows.map(row => `
      <tr class="${row.position === 1 ? 'ranking-first' : ''}">
        <td><span class="ranking-position">${e(row.position ?? '—')}</span></td>
        <td><strong>${e(row.name)}</strong></td>
        <td>${e(row.team)}</td>
        <td>
          <div class="ranking-quality">
            <strong>${e(rankingScore(row.score))}</strong>
            ${row.score == null ? '' : `<progress max="100" value="${e(Math.max(0, Math.min(100, Number(row.score))))}" aria-label="Nota média de ${e(row.name)}"></progress>`}
          </div>
        </td>
        <td>${e(row.calls)}</td>
        <td>${e(row.avgSeconds != null && Number(row.calls) > 0 ? C.duration(row.avgSeconds) : '—')}</td>
        <td>${e(row.evaluated)}</td>
        <td>${e(row.pending)}</td>
      </tr>`) : [emptyRow(headers.length, 'Nenhum atendente neste recorte.')];
    return table(headers, renderedRows);
  }

  async function loadRanking() {
    const current = ++ranking.request;
    const account = session?.id;
    ranking.data = null;
    ranking.error = '';
    render();
    const params = new URLSearchParams({ period: ranking.period });
    if (ranking.teamId) params.set('teamId', ranking.teamId);
    try {
      const result = await request('/api/data/rankings?' + params);
      if (!Array.isArray(result.rows)) throw new Error('Não foi possível ler o ranking.');
      if (current === ranking.request && account === session?.id) ranking.data = result;
    } catch (error) {
      if (current === ranking.request && account === session?.id) ranking.error = error.message;
    }
    if (current === ranking.request && lastRoute === 'rankings' && account === session?.id) render();
  }

  function rankingsPage() {
    const data = ranking.data;
    const rows = (data?.rows || []).filter(row => C.search(row.name + ' ' + row.team, ui.query));
    const result = C.paginate(rows, ui.page);
    const evaluated = rows.reduce((sum, row) => sum + Number(row.evaluated || 0), 0);
    const average = evaluated ? rows.reduce((sum, row) => sum + Number(row.score || 0) * Number(row.evaluated || 0), 0) / evaluated : null;
    const options = (items, selected) => items.map(([value, label]) => `<option value="${e(value)}"${value === selected ? ' selected' : ''}>${e(label)}</option>`).join('');

    return head('Rankings de Desempenho', 'Qualidade das revisões humanas validadas por atendente', isAdmin() ? btn(icon('download') + ' Exportar', 'export-ranking', 'secondary small') : '') + `
      <section class="panel ranking-filter-panel">
        <div class="toolbar ranking-filters">
          ${search('Nome do atendente', 'Buscar atendente')}
          ${field('Equipe', `<select data-ranking="teamId">${options([['', 'Todas as equipes'], ...state.teams.map(t => [t.id, t.name])], ranking.teamId)}</select>`)}
          ${field('Período', `<select data-ranking="period">${options(rankingPeriods.map(p => [p, p]), ranking.period)}</select>`)}
          ${btn('Atualizar', 'refresh-ranking', 'secondary small')}
        </div>
        <div class="filter-info">
          <span>Ordenado por nota média validada • Maior nota primeiro</span>
          ${btn('Limpar filtros', 'clear-ranking', 'text-btn')}
        </div>
      </section>
      <section class="metrics four">
        ${metric('Ligações avaliadas', data ? evaluated : '—', 'phone', 'blue')}
        ${metric('Nota média de qualidade', data ? rankingScore(average) : '—', 'award', 'green')}
        ${metric('Aguardam validação', data ? rows.reduce((sum, row) => sum + Number(row.pending || 0), 0) : '—', 'clock', 'amber')}
        ${metric('Atendentes no recorte', data ? rows.length : '—', 'users', 'purple')}
      </section>
      <section class="panel ranking-table">
        <div class="panel-header">
          <h2>Classificação geral</h2>
          <span class="muted" role="status">${e(ranking.error || data?.period || 'Carregando desempenho…')}</span>
        </div>
        ${data ? rankingTable(result.items) + pager(result, 'atendentes') : `<p class="ranking-feedback" role="status">${e(ranking.error || 'Carregando desempenho…')}</p>`}
      </section>
      <div class="ranking-footer">
        <p>Média de notas validadas, incluindo zero. Ligações simuladas e sem nota ficam fora da média.</p>
        ${isAdmin() && data ? btn('Gerar relatório deste recorte', 'ranking-report', 'secondary small') : ''}
      </div>`;
  }

  // ============================================================================
  // 8. TELA: CONFIGURAÇÕES E PERFIL DO USUÁRIO
  // ============================================================================
  function settingsPage() {
    const profileField = (name, label, value, readonly = false) => `
      <div class="form-field">
        <label for="profile-${name}">${label}</label>
        <input id="profile-${name}" name="${name}" type="${name === 'email' ? 'email' : 'text'}" value="${e(value)}" maxlength="${name === 'name' ? 200 : 255}" ${readonly ? 'readonly' : `required autocomplete="${name === 'name' ? 'name' : 'email'}"`}>
      </div>`;

    return head('Configurações', 'Gerencie seus dados de acesso e a segurança da sua conta') + `
      <section class="panel profile-card">
        <span class="avatar profile-avatar">${e(C.initials(session.name))}</span>
        <div>
          <h2>${e(session.name)}</h2>
          <p>${e(session.job)} • ${e(session.profile)} • ${e(session.team)}</p>
        </div>
        <a class="btn secondary" href="#saida">${icon('exit')} Sair</a>
      </section>
      <section class="panel profile-form">
        <h2>Informações de Perfil</h2>
        <form id="profile-form">
          <div class="form-grid">
            ${profileField('email', 'E-mail Corporativo', session.email)}
            ${profileField('name', 'Nome Completo', session.name)}
            ${profileField('team', 'Departamento / Equipe', session.team, true)}
            ${profileField('job', 'Cargo', session.job, true)}
            <div class="form-field">
              <label for="profile-current-password">Senha Atual para confirmação</label>
              <input id="profile-current-password" name="currentPassword" type="password" maxlength="128" autocomplete="current-password" placeholder="Digite sua senha atual" required>
            </div>
            <details class="profile-passwords">
              <summary>Alterar Senha de Acesso</summary>
              <div class="form-grid">
                <div class="form-field">
                  <label for="profile-new-password">Nova Senha (mínimo 12 caracteres)</label>
                  <input id="profile-new-password" name="newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="Mínimo 12 caracteres">
                </div>
                <div class="form-field">
                  <label for="profile-confirm-password">Confirmar Nova Senha</label>
                  <input id="profile-confirm-password" name="confirmPassword" type="password" maxlength="128" autocomplete="new-password" placeholder="Repita a nova senha">
                </div>
              </div>
              <p>A alteração da senha encerra as demais sessões abertas da sua conta por segurança.</p>
            </details>
          </div>
          <p class="form-error" role="alert"></p>
          <div class="profile-actions">
            <button type="reset" class="btn secondary">Descartar alterações</button>
            <button class="btn" type="submit">Salvar Alterações</button>
          </div>
        </form>
        <p class="profile-note">Permissões e departamentos são geridos pela administração da SENX.</p>
      </section>`;
  }

  // ============================================================================
  // 9. TELA: ADMINISTRAÇÃO (Colaboradores, Departamentos e Critérios)
  // ============================================================================
  function usersView() {
    const users = state.users.filter(u =>
      C.search(u.name + ' ' + u.email, ui.query) &&
      (!ui.team || ui.team === u.team) &&
      (!ui.profile || u.profile === ui.profile) &&
      (!ui.userStatus || (u.active !== false ? 'Ativo' : 'Inativo') === ui.userStatus));

    const roles = field('Perfil', `
      <select data-filter="profile">
        <option value="">Todos os perfis</option>
        ${['Administrador', 'Colaborador'].map(p => `<option ${ui.profile === p ? 'selected' : ''}>${p}</option>`).join('')}
      </select>`);

    const statusFilter = field('Status', `
      <select data-filter="userStatus">
        <option value="">Todos os status</option>
        ${['Ativo', 'Inativo'].map(status => `<option ${ui.userStatus === status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>`);

    const rows = users.length ? users.map(u => `
      <tr>
        <td>${person(u.name, u.role)}</td>
        <td>${e(u.email)}</td>
        <td>${e(u.team)}</td>
        <td><div class="access-chips">${badge(u.profile, u.profile === 'Administrador' ? 'purple' : 'blue')}</div></td>
        <td>${badge(u.active !== false ? 'Ativo' : 'Inativo', u.active !== false ? 'green' : 'neutral')}</td>
        <td>
          <div class="row-actions">
            ${btn(icon('edit') + ' Editar', 'edit-user', 'text-btn', u.id)}
            ${btn(u.active !== false ? 'Desativar' : 'Ativar', 'toggle-user', 'text-btn' + (u.active !== false ? ' danger' : ''), u.id)}
            ${u.active === false && u.id !== session?.id ? recordActions('users', u.id) : ''}
          </div>
        </td>
      </tr>`) : [emptyRow(6, 'Nenhum colaborador encontrado no banco de dados.', 'Cadastre um novo usuário pelo botão acima.')];

    return `
      <section class="panel users-filters">
        <div class="panel-header">
          <h2>Colaboradores e Acessos</h2>
          ${badge(state.users.length + ' cadastrados', 'green')}
        </div>
        <div class="toolbar admin-filter">
          ${search('Pesquisar por nome ou e-mail')}
          ${teamFilter('Departamento')}
          ${roles}
          ${statusFilter}
          ${btn(icon('plus') + ' Adicionar usuário', 'new-user', 'ghost')}
        </div>
      </section>
      <section class="panel users-table">
        ${table(['Nome', 'E-mail', 'Departamento', 'Perfil de Acesso', 'Status', 'Ações'], rows)}
      </section>`;
  }

  function teamsView() {
    const teams = state.teams.filter(t => C.search(t.name + ' ' + t.department, ui.query));
    const rows = teams.length ? teams.map(t => `
      <tr>
        <td><strong>${e(t.department)}</strong></td>
        <td>${e(t.name)}</td>
        <td>${e(t.members)} colaboradores</td>
        <td>${badge('Catálogo CTI')}</td>
        <td>${btn(icon('edit') + ' Editar', 'edit-team', 'text-btn', t.id)}${recordActions('teams', t.id)}</td>
      </tr>`) : [emptyRow(5, 'Nenhum departamento cadastrado.')];

    return `
      <section class="metrics three">
        ${metric('Departamentos Cadastrados', new Set(state.teams.map(t => t.department)).size, 'building', 'soft')}
        ${metric('Colaboradores ativos', state.users.filter(u => u.active).length, 'users', 'soft')}
        ${metric('Equipes cadastradas', state.teams.length, 'admin', 'soft')}
      </section>
      <section class="panel departments-table">
        <div class="panel-header">
          <div><h2>Departamentos e Equipes</h2><p>Organize os acessos e os critérios de análise de cada equipe.</p></div>
          ${btn(icon('plus') + ' Adicionar departamento', 'new-team')}
        </div>
        ${table(['Departamento', 'Equipe Vinculada', 'Colaboradores', 'Critérios', 'Ações'], rows)}
        <div class="list-foot">${teams.length} equipes cadastradas</div>
      </section>`;
  }

  function criteriaView() {
    const criteria = state.criteria.filter(c => C.search(c.name + ' ' + c.description, ui.query));
    const rows = criteria.length ? criteria.map(c => `
      <tr>
        <td><strong>${e(c.name)}</strong><small>Versão ${e(c.version)}</small></td>
        <td>${e(c.description)}</td>
        <td>${e(c.rule)}</td>
        <td>
          <button class="switch-label" data-action="toggle-criterion" data-id="${e(c.id)}" aria-label="Alternar critério">
            <span class="switch ${c.active ? 'on' : ''}"></span>${c.active ? 'Ativo' : 'Inativo'}
          </button>
        </td>
        <td>${btn(icon('edit') + ' Editar', 'edit-criterion', 'text-btn', c.id)}${recordActions('criteria', c.id)}</td>
      </tr>`) : [emptyRow(5, 'Nenhum critério cadastrado.')];

    return `
      <section class="panel criteria-filter">
        <div class="toolbar">
          <strong>Departamento:</strong>
          <select aria-label="Departamento"><option>Catálogo Global CTI</option></select>
          <span class="criteria-count">${badge(state.criteria.filter(c => c.active).length + ' ativos / ' + state.criteria.length + ' critérios', 'blue')}</span>
          ${btn(icon('plus') + ' Adicionar critério', 'new-criterion', 'secondary')}
        </div>
      </section>
      ${warn('Classificações sensíveis exigem evidências e revisão humana', 'Confira os trechos da transcrição. Estimativas da IA devem ser verificadas pela supervisão.')}
      <section class="panel criteria-table">
        ${table(['Critério', 'Descrição', 'Evidências esperadas e regra', 'Estado', 'Ação'], rows)}
      </section>
      <p class="criteria-save-note">Alterações são salvas ao editar ou alternar cada critério. O catálogo é global.</p>`;
  }

  function adminPage() {
    if (!isAdmin()) return head('Administração', 'Acesso restrito.') + note('Permissão necessária', 'Somente administradores podem gerenciar cadastros.');
    const tabs = [['usuarios', 'Colaboradores e Acessos'], ['departamentos', 'Departamentos'], ['criterios', 'Critérios de Análise']];
    const tabLinks = tabs.map(([id, label]) => `<a class="tab ${ui.adminTab === id ? 'active' : ''}" href="#administracao/${id}">${label}</a>`).join('');
    const view = ui.adminTab === 'usuarios' ? usersView() : ui.adminTab === 'departamentos' ? teamsView() : criteriaView();
    return head('Administração', 'Gerencie colaboradores, equipes e critérios de avaliação do atendimento.') +
      `<div class="tabs admin-tabs">${tabLinks}</div>` + view;
  }

  // ============================================================================
  // 10. TELA: CLIENTES E VÍNCULOS DE ATENDENTES
  // ============================================================================
  function customerAgentCalls(c, agentId) {
    if (!agentId) return Number(c.calls) || 0;
    try {
      const map = typeof c.agentCallsJson === 'string' ? JSON.parse(c.agentCallsJson) : (c.agentCallsJson || {});
      return Number(map[agentId]) || 0;
    } catch { return Number(c.calls) || 0; }
  }

  function customerHasAgent(c, agentId) {
    if (!agentId) return true;
    const ids = Array.isArray(c.userIds) ? c.userIds.map(String) : [String(c.userId || '')];
    return ids.includes(String(agentId));
  }

  function customersView() {
    const allCustomers = state.customers || [];
    const selectedAgent = ui.profile || '';
    const list = allCustomers.filter(c =>
      customerHasAgent(c, selectedAgent) &&
      C.search((c.name || '') + ' ' + (c.email || '') + ' ' + (c.phone || '') + ' ' + (c.status || '') + ' ' + (c.agent || ''), ui.query));
    const totalCalls = list.reduce((acc, c) => acc + customerAgentCalls(c, selectedAgent), 0);
    const agentSelect = isAdmin() && state.users?.length
      ? field('Atendente', `
          <select data-filter="profile">
            <option value="">Todos os atendentes</option>
            ${state.users.map(u => `<option value="${e(u.id)}" ${selectedAgent === String(u.id) ? 'selected' : ''}>${e(u.name)}</option>`).join('')}
          </select>`)
      : '';

    const rows = list.length ? list.map(c => `
      <tr>
        <td>${person(c.name, c.consent ? 'Consentimento ativo' : 'Sem consentimento')}</td>
        <td>${e(c.email)}</td>
        <td>${e(c.phone)}</td>
        <td>${e(c.agent || '—')}</td>
        <td>${badge(c.status || 'Ativo', (c.status || 'Ativo') === 'Ativo' ? 'green' : c.status === 'Inativo' ? 'neutral' : 'amber')}</td>
        <td>${badge(customerAgentCalls(c, selectedAgent) + ' ligações', 'blue')}</td>
        <td>
          <div class="row-actions">
            ${btn(icon('phone') + ' Ver ligações', 'customer-calls', 'text-btn', c.id)}
            ${isAdmin() ? btn(icon('edit') + ' Editar', 'edit-customer', 'text-btn', c.id) + (c.status === 'Inativo' ? recordActions('customers', c.id) : '') : ''}
          </div>
        </td>
      </tr>`) : [emptyRow(7, 'Nenhum cliente cadastrado no banco de dados.', isAdmin() ? 'Cadastre um novo cliente pelo botão "Adicionar cliente" acima.' : 'Solicite o cadastro do cliente à administração.')];

    return `
      <section class="metrics three">
        ${metric('Clientes Cadastrados', list.length, 'users', 'blue')}
        ${metric('Consentimento Ativo', list.filter(c => c.consent).length, 'check', 'green')}
        ${metric('Ligações Vinculadas', totalCalls, 'phone', 'indigo')}
      </section>
      <section class="panel users-filters">
        <div class="panel-header">
          <div><h2>Base de Clientes</h2><p>Consulte os dados e o histórico dos clientes.</p></div>
          <div class="head-actions">${badge(list.length + ' clientes', 'blue')}</div>
        </div>
        <div class="toolbar admin-filter">
          ${search('Pesquisar cliente por nome, e-mail, telefone ou atendente...')}
          ${agentSelect}
        </div>
      </section>
      <section class="panel users-table">
        ${table(['Cliente', 'E-mail', 'Telefone', 'Atendente Responsável', 'Situação', 'Ligações', 'Ações'], rows)}
      </section>`;
  }

  function customersPage() {
    return head(
      'Clientes',
      'Cadastre e consulte clientes e seus históricos de atendimento',
      (isAdmin() ? btn(icon('plus') + ' Adicionar cliente', 'new-customer') : '') + btn('Atualizar', 'refresh', 'secondary small')
    ) + customersView();
  }

  function exitPage() {
    return `
      <main class="exit-page" id="main">
        ${decorations()}
        <section class="exit-card">
          <div class="exit-icon">${icon('exit')}</div>
          <h1>Realmente deseja sair?</h1>
          <p>Você será desconectado da SENX e precisará entrar novamente para continuar.</p>
          ${btn('SAIR', 'logout', 'full')}
          <a class="btn secondary full" href="#ligacoes">CANCELAR</a>
        </section>
      </main>`;
  }

  // ============================================================================
  // 11. ROTEAMENTO (render) E MODAIS DE CADASTRO / EDIÇÃO
  // ============================================================================
  function render() {
    if (!authReady) { app.innerHTML = '<main id="main">Carregando plataforma SENX…</main>'; return; }
    if (!session) { document.title = 'SENX 1.5.0.0 — ' + (setupRequired ? 'Primeiro acesso' : 'Login'); app.innerHTML = auth(setupRequired); return; }
    const raw = location.hash.slice(1) || 'ligacoes', [route, sub] = raw.split('/');
    if (route === 'administracao' && sub === 'clientes') { location.hash = 'clientes'; return; }
    const enteringRanking = lastRoute !== raw && route === 'rankings';
    if (lastRoute !== raw) { Object.assign(ui, { page: 1, query: '', team: '', status: '', date: '', analysis: '', topic: '', profile: '', userStatus: '', reportStatus: '' }); closeModal(); lastRoute = raw; }
    ui.adminTab = ['usuarios', 'departamentos', 'criterios'].includes(sub) ? sub : 'usuarios';

    if (route === 'login' || route === 'cadastro') { location.hash = 'ligacoes'; return; }
    else if (route === 'saida') app.innerHTML = exitPage();
    else {
      const pages = { ligacoes: callsPage, clientes: customersPage, resumos: summariesPage, relatorios: reportsPage, rankings: rankingsPage, configuracoes: settingsPage, administracao: adminPage };
      if (!pages[route]) { location.hash = 'ligacoes'; return; }
      app.innerHTML = shell(pages[route](), route);
    }
    document.title = 'SENX 1.5.0.0 — ' + (route === 'administracao' ? ui.adminTab : route);
    app.dataset.route = raw;
    if (enteringRanking) void loadRanking();
  }

  function closeModal() {
    const dialog = document.querySelector('#modal-root dialog');
    if (dialog) { dialog.close(); dialog.remove(); if (lastFocus?.isConnected) lastFocus.focus(); }
  }

  function modal(title, subtitle, content, formId = '') {
    closeModal(); lastFocus = document.activeElement;
    const save = formId === 'delete-form' ? 'Excluir definitivamente' : title.startsWith('Editar') ? 'Salvar alterações' : 'Salvar';
    const submitBtn = formId
      ? `<button type="submit" class="btn${formId === 'delete-form' ? ' danger" id="confirm-delete"' : '"'}>${save}</button>`
      : '';
    document.querySelector('#modal-root').innerHTML = `
      <dialog class="dialog-${formId}" aria-labelledby="dialog-title">
        ${formId ? `<form id="${formId}">` : ''}
        <header class="modal-head"><div><h2 id="dialog-title">${e(title)}</h2><p>${e(subtitle)}</p></div></header>
        <div class="modal-body">${content}<p class="form-error" role="alert"></p></div>
        <footer class="modal-footer">${btn(formId ? 'Cancelar' : 'Fechar', 'close', 'secondary')}${submitBtn}</footer>
        ${formId ? '</form>' : ''}
      </dialog>`;
    document.querySelector('#modal-root dialog').showModal();
    document.querySelector('#modal-root input:not([type=hidden])')?.focus();
  }

  function teamModal(id) {
    const t = state.teams.find(t => t.id === id) || { name: '', department: '' };
    modal(id ? 'Editar departamento' : 'Adicionar departamento', 'Defina o nome e a equipe vinculada ao departamento.', `
      <input type="hidden" name="id" value="${e(id || '')}">
      ${input('department', 'Nome do departamento', t.department)}
      ${input('name', 'Nome da equipe', t.name)}
      <div class="form-field"><label>Liderança responsável</label><input name="leader" value="Não definida" readonly></div>
      ${note('Departamentos e Equipes', 'As equipes agrupam colaboradores e suas respectivas análises de chamadas.')}
    `, 'team-form');
  }

  function criterionModal(id) {
    const c = state.criteria.find(c => c.id === id) || { name: '', description: '', rule: '', version: '1.0', active: true };
    const textarea = (name, label, value) => `
      <div class="form-field">
        <label for="field-${name}">${label} *</label>
        <textarea id="field-${name}" name="${name}" maxlength="255" rows="3" required>${e(value)}</textarea>
      </div>`;
    modal(id ? 'Editar critério' : 'Adicionar critério', 'Catálogo de Qualidade CTI • ' + (c.name || 'Novo critério'), `
      <input type="hidden" name="id" value="${e(id || '')}">
      <div class="criterion-status">
        ${badge('Critério de Análise CTI', 'amber')}
        <label class="switch-label"><input type="checkbox" role="switch" name="active" ${c.active ? 'checked' : ''}>Ativo</label>
      </div>
      ${input('name', 'Nome do critério', c.name)}
      ${textarea('description', 'Descrição do critério', c.description)}
      ${textarea('rule', 'Evidências esperadas / Regra de validação', c.rule)}
      ${input('version', 'Versão', c.version)}
      ${note('Validação de Qualidade', 'Regras claras facilitam a auditoria automática e a calibração da supervisão.')}
    `, 'criterion-form');
  }

  function userModal(id) {
    const u = (id ? state.users.find(x => x.id === id) : null) || { name: '', email: '', teamId: state.teams[0]?.id || '', profile: 'Colaborador', role: 'Atendente' };
    const isEdit = Boolean(id);
    modal(
      isEdit ? 'Editar colaborador' : 'Adicionar colaborador',
      isEdit ? ('Atualize os dados e o perfil de ' + (u.name || 'colaborador') + '.') : 'Cadastre um acesso para a análise das gravações do PABX.',
      `
        ${isEdit ? `<input type="hidden" name="id" value="${e(id)}">` : ''}
        ${input('name', 'Nome completo', u.name)}
        ${input('email', 'E-mail corporativo', u.email, 'email')}
        <div class="form-grid">
          <div class="form-field">
            <label for="user-team">Departamento / Equipe *</label>
            <select id="user-team" name="teamId" required>
              ${state.teams.map(t => `<option value="${e(t.id)}" ${String(u.teamId) === String(t.id) ? 'selected' : ''}>${e(t.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="user-profile">Perfil de Acesso *</label>
            <select id="user-profile" name="profile">
              ${['Colaborador', 'Administrador'].map(p => `<option ${u.profile === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid">
          ${input('job', 'Cargo', u.role || 'Atendente')}
          ${isEdit ? input('password', 'Nova senha (opcional)', '', 'password', false) : input('password', 'Senha inicial', '', 'password', true)}
        </div>
        <div class="permissions">
          <strong>Permissões</strong>
          <p id="permissions-description">${u.profile === 'Administrador' ? 'Gerenciar colaboradores, departamentos e critérios; consultar todos os registros.' : 'Consultar suas próprias ligações, transcrições e perfil.'}</p>
        </div>
      `,
      'user-form'
    );
  }

  function renderCustomerExtraAgents(primaryId, extraIds) {
    const users = state.users?.length ? state.users : [{ id: session?.id || '', name: session?.name || 'Administrador' }];
    const cleanExtras = [...new Set((extraIds || []).map(String).filter(uid => uid && uid !== String(primaryId)))];
    const available = users.filter(u => String(u.id) !== String(primaryId) && !cleanExtras.includes(String(u.id)));

    const selectHtml = `
      <div class="extra-agent-bar">
        <select id="customer-extra-user" name="extraUserId"${available.length ? '' : ' disabled'}>
          <option value="">${available.length ? 'Selecionar outro atendente para vincular...' : 'Todos os atendentes disponíveis já estão vinculados'}</option>
          ${available.map(u => `<option value="${e(u.id)}">${e(u.name)}${u.role ? ' (' + e(u.role) + ')' : ''}</option>`).join('')}
        </select>
        <button type="button" class="btn secondary" data-action="add-customer-agent"${available.length ? '' : ' disabled'}>${icon('plus')} Vincular</button>
      </div>`;

    const listHtml = cleanExtras.length
      ? `<div class="extra-agent-list">${cleanExtras.map(uid => {
          const u = users.find(x => String(x.id) === uid) || { id: uid, name: 'Colaborador' };
          return `
            <span class="extra-agent-chip">
              <input type="hidden" name="userIds" value="${e(u.id)}">
              <span class="avatar">${e(C.initials(u.name || '?'))}</span>
              <span class="extra-agent-name">${e(u.name)}</span>
              <button type="button" class="extra-agent-remove" data-action="remove-customer-agent" data-id="${e(u.id)}" aria-label="Remover ${e(u.name)}">×</button>
            </span>`;
        }).join('')}</div>`
      : '<p class="extra-agent-empty">Nenhum atendente adicional vinculado. O atendente principal já possui acesso automático.</p>';

    return selectHtml + listHtml;
  }

  function customerModal(id) {
    const c = (state.customers || []).find(x => x.id === id) || { name: '', email: '', phone: '', status: 'Ativo', consent: false, userId: session?.id || '', userIds: [session?.id || ''] };
    const statuses = ['Ativo', 'Em acompanhamento', 'Inativo'];
    const users = state.users?.length ? state.users : [{ id: session?.id || '', name: session?.name || 'Administrador' }];
    const primaryId = String(c.userId || users[0]?.id || session?.id || '');
    const selectedIds = Array.isArray(c.userIds) && c.userIds.length ? c.userIds.map(String) : [primaryId];
    const extraIds = selectedIds.filter(uid => uid !== primaryId);

    modal(id ? 'Editar cliente' : 'Adicionar cliente', 'Cadastre ou atualize os dados do cliente para vincular ligações e histórico.', `
      <input type="hidden" name="id" value="${e(id || '')}">
      <div class="criterion-status">
        ${badge('Cadastro de Cliente CTI', 'blue')}
        <label class="switch-label"><input type="checkbox" role="switch" name="consent" ${c.consent !== false ? 'checked' : ''}>Cliente autorizou a gravação das ligações</label>
      </div>
      <p class="consent-help">Registre a autorização informada pelo cliente. Este campo é informativo: desmarcá-lo não bloqueia o envio ou a análise de áudios nesta versão.</p>
      ${input('name', 'Nome completo / Empresa', c.name)}
      <div class="form-grid">
        ${input('email', 'E-mail de contato', c.email, 'email')}
        <div class="form-field">
          <label for="field-phone">Telefone (somente números, até 11 dígitos) *</label>
          <input id="field-phone" name="phone" type="tel" value="${e(c.phone)}" maxlength="11" pattern="[0-9]{1,11}" placeholder="Ex: 11999998888" required>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-field">
          <label for="customer-status">Situação *</label>
          <select id="customer-status" name="status">${statuses.map(s => `<option ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-field">
          <label for="customer-user">Atendente principal *</label>
          <select id="customer-user" name="userId">${users.map(u => `<option value="${e(u.id)}" ${primaryId === String(u.id) ? 'selected' : ''}>${e(u.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div id="customer-extra-agents" class="form-field">
        <label for="customer-extra-user">Atendentes adicionais vinculados</label>
        ${renderCustomerExtraAgents(primaryId, extraIds)}
      </div>
      ${note('Histórico e Busca', 'Após cadastrar o cliente, ele ficará disponível na tela de envio de gravação e na busca de chamadas.')}
    `, 'customer-form');
  }

  function reportModal() {
    modal('Novo Relatório Executivo', 'Gere uma análise consolidada de atendimento.', `
      ${input('title', 'Título do relatório', 'Relatório Semanal de Desempenho CTI')}
      <div class="form-grid">
        <div class="form-field"><label>Categoria *</label><select name="type"><option>Qualidade</option><option>Retenção</option><option>Desenvolvimento</option><option>Conformidade</option></select></div>
        <div class="form-field"><label>Departamento / Equipe *</label><select name="teamId"><option value="">Todas as equipes</option>${state.teams.map(t => `<option value="${e(t.id)}">${e(t.name)}</option>`).join('')}</select></div>
      </div>
      <div class="form-field"><label>Período *</label><select name="period"><option>Últimos 7 dias</option><option>Últimos 30 dias</option><option>Mês atual</option><option>Trimestre atual</option></select></div>
      <div class="form-field"><label>Observações do Supervisor</label><textarea name="summary" rows="3"></textarea></div>
    `, 'report-form');
  }

  // ============================================================================
  // 12. EVENTOS GLOBAIS (Submit, Click, Change, Busca e Teclado)
  // ============================================================================
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form)), id = form.getAttribute('id');
    if (form.dataset.saving) return;

    if (id === 'auth-form') {
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      try {
        if (setupRequired) {
          if (data.password !== data.confirm) throw new Error('As senhas não coincidem.');
          await request('/api/auth/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, teamId: data.teamId || null }) });
          setupRequired = false; location.hash = 'login'; await startSession(); toast('Administrador criado. Entre com seu e-mail e senha.');
        } else {
          session = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.email, password: data.password, rememberMe: data.rememberMe === 'on' }) });
          authError = ''; location.hash = 'ligacoes'; await loadDatabase();
        }
      } catch (error) {
        const message = form.querySelector('[role=alert]');
        if (message) message.textContent = error.message;
        button.disabled = false;
      }
      return;
    }

    if (id === 'delete-form') {
      const record = deletableRecord(data.kind, data.id);
      if (!record) return;
      form.dataset.saving = 'true';
      const dialog = form.closest('dialog');
      const buttons = form.querySelectorAll('button');
      const blockCancel = event => event.preventDefault();
      dialog.addEventListener('cancel', blockCancel);
      buttons.forEach(button => button.disabled = true);
      form.querySelector('[role=alert]').textContent = '';
      try {
        await request('/api/data/' + data.kind + '/' + encodeURIComponent(data.id), {method:'DELETE'});
        if (data.kind === 'calls' && ui.selected === data.id) {
          stopAudio();
          ui.selected = null;
        }
        closeModal();
        await loadDatabase();
        toast('Exclusão concluída.');
      } catch (error) {
        form.querySelector('[role=alert]').textContent = error.message;
      } finally {
        dialog.removeEventListener('cancel', blockCancel);
        buttons.forEach(button => button.disabled = false);
        delete form.dataset.saving;
      }
      return;
    }

    if (id === 'profile-form') {
      const button = form.querySelector('[type=submit]'), message = form.querySelector('[role=alert]');
      message.textContent = '';
      if ((data.newPassword || '') !== (data.confirmPassword || '')) {
        form.querySelector('details').open = true;
        message.textContent = 'As novas senhas não coincidem.';
        return;
      }
      button.disabled = true;
      try {
        const result = await request('/api/auth/profile', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.name.trim(), email: data.email.trim(), currentPassword: data.currentPassword, newPassword: data.newPassword || null })
        });
        form.reset();
        if (result.requiresLogin) {
          session = null; clearData(); location.hash = 'login'; render(); toast('Senha alterada. Entre novamente com a nova senha.');
        } else {
          session = result.user; await loadDatabase(); toast('Perfil atualizado com sucesso.');
        }
      } catch (error) {
        if (form.isConnected) { message.textContent = error.message; button.disabled = false; }
      }
      return;
    }

    if (['user-form', 'team-form', 'criterion-form', 'customer-form'].includes(id)) {
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      const checkedUsers = id === 'customer-form' && typeof form.querySelectorAll === 'function'
        ? [...new Set([
            data.userId,
            ...Array.from(form.querySelectorAll('input[type="hidden"][name="userIds"], input[name="userIds"]:checked') || []).map(el => el.value),
            data.extraUserId
          ].filter(Boolean))]
        : [];
      const payload = id === 'user-form'
        ? {
            name: data.name.trim(),
            email: data.email.trim(),
            password: data.password?.trim() ? data.password : null,
            teamId: data.teamId,
            job: data.job.trim(),
            profile: data.profile
          }
        : id === 'team-form'
          ? { name: data.name.trim(), department: data.department.trim() }
          : id === 'customer-form'
            ? {
                name: data.name.trim(),
                email: data.email.trim(),
                phone: data.phone.trim(),
                status: (data.status || 'Ativo').trim(),
                consent: data.consent === 'on',
                userId: data.userId || checkedUsers[0] || null,
                userIds: checkedUsers.length ? checkedUsers : (data.userId ? [data.userId] : [])
              }
            : {
                name: data.name.trim(),
                description: data.description.trim(),
                rule: data.rule.trim(),
                version: data.version.trim(),
                active: data.active === 'on'
              };
      try {
        const kind = id === 'user-form' ? 'users' : id === 'team-form' ? 'teams' : id === 'customer-form' ? 'customers' : 'criteria';
        await request('/api/data/' + kind + (data.id ? '/' + encodeURIComponent(data.id) : ''), {
          method: data.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        closeModal();
        await loadDatabase();
        toast('Registro salvo com sucesso no banco de dados.');
      } catch (error) {
        form.querySelector('[role=alert]').textContent = error.message;
        button.disabled = false;
      }
      return;
    }

    if (id === 'report-form' || id === 'review-call-form') {
      form.dataset.saving = 'true';
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      try {
        if (id === 'report-form') {
          const { includeRanking, ...report } = data;
          await request('/api/data/reports', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...report, teamId:report.teamId || null, includeRanking:includeRanking === 'true'})});
          if (includeRanking === 'true') location.hash = 'relatorios';
        } else {
          const call = state.calls.find(c => c.id === data.id);
          if (!call) throw new Error('Atualize a lista de ligações.');
          await saveReview(call, data.summary, data.score === '' ? null : Number(data.score), false);
        }
        closeModal();
        await loadDatabase();
        toast('Registro salvo no banco de dados.');
      } catch (error) {
        form.querySelector('[role=alert]').textContent = error.message;
        button.disabled = false;
        delete form.dataset.saving;
      }
      return;
    }
  });

  async function saveReview(call, summary, score, validate) {
    return request('/api/data/calls/' + encodeURIComponent(call.id) + '/review', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({analysisId:call.analysisId,revision:call.revision || null,summary,score,validate})
    });
  }

  document.addEventListener('reset', event => {
    if (event.target.id === 'profile-form') {
      event.target.querySelector('[role=alert]').textContent = '';
      event.target.querySelector('details').open = false;
      toast('Alterações descartadas.');
    }
  });

  document.addEventListener('error', event => {
    if (event.target.matches?.('audio')) {
      const message = document.querySelector('.audio-error');
      if (message) message.textContent = 'Não foi possível reproduzir a gravação. Confira a disponibilidade e o formato do arquivo.';
    }
  }, true);

  document.addEventListener('click', async event => {
    const target = event.target.closest('[data-action],[data-page],[data-tab]');
    if (!target || target.disabled) return;
    if (target.dataset.page) { ui.page = Number(target.dataset.page); render(); return; }
    if (target.dataset.tab) {
      ui.tab = target.dataset.tab;
      if (ui.tab !== 'audio') stopAudio();
      render();
      return;
    }

    const id = target.dataset.id;
    switch (target.dataset.action) {
      case 'record-actions': {
        const [kind, recordId] = (id || '').split(':');
        const record = deletableRecord(kind, recordId);
        const call = kind === 'calls' ? state.calls.find(row => row.id === recordId) : null;
        if (!record && !call) break;
        const actions = call
          ? btn('Ver transcrição', 'call-transcript', 'secondary', recordId) + btn('Ver detalhes', 'call-info', 'secondary', recordId) : '';
        const remove = record
          ? btn('Excluir', record.rule.action, 'danger', record.rule.action === 'delete-record' ? id : recordId) : '';
        modal(call ? 'Ações da ligação' : 'Ações do registro', call?.client || record?.name || '',
          '<div class="call-action-options">' + actions + remove + '</div>');
        break;
      }
      case 'call-transcript': {
        const call = state.calls.find(row => row.id === id);
        if (call) modal('Transcrição da ligação', call.client, formatTranscript(call.transcript));
        break;
      }
      case 'delete-record': {
        const [kind, recordId] = (id || '').split(':');
        confirmDeletion(kind, recordId);
        break;
      }
      case 'toggle-password': {
        const field = document.getElementById(id);
        field.type = field.type === 'password' ? 'text' : 'password';
        target.setAttribute('aria-label', (field.type === 'password' ? 'Mostrar' : 'Ocultar') + ' senha');
        break;
      }
      case 'forgot':
        modal('Recuperar Senha', 'Suporte Técnico SENX', '<p>Para redefinir sua senha, solicite ao administrador do sistema ou entre em contato com a equipe de infraestrutura.</p>');
        break;
      case 'policy':
        modal('Termos de Uso e LGPD', 'Plataforma SENX CTI', '<p>Os documentos de uso e privacidade serão publicados pelo responsável pelo produto.</p>');
        break;
      case 'clear-filters':
        Object.assign(ui, { page: 1, query: '', team: '', status: '', date: '', analysis: '', topic: '', profile: '', userStatus: '', reportStatus: '' });
        render();
        break;
      case 'report-tab':
        ui.reportType = id;
        ui.page = 1;
        render();
        break;
      case 'review-pending':
        if (!isAdmin()) break;
        ui.analysis = 'Aguarda revisão'; ui.page = 1; render();
        break;
      case 'clear-ranking':
        ui.query = ''; ui.page = 1; ranking.teamId = ''; ranking.period = rankingPeriods[0];
        await loadRanking();
        break;
      case 'export-ranking':
        if (!isAdmin()) break;
        if (ranking.data) download('SENX-ranking.csv', C.toCsv([['Posição', 'Colaborador', 'Equipe', 'Qualidade', 'Ligações', 'Duração média', 'Avaliadas', 'Pendentes'], ...ranking.data.rows.filter(row => C.search(row.name + ' ' + row.team, ui.query)).map(row => [row.position ?? '', row.name, row.team, row.score ?? '', row.calls, row.avgSeconds != null && Number(row.calls) > 0 ? C.duration(row.avgSeconds) : '—', row.evaluated, row.pending])]), 'text/csv;charset=utf-8');
        break;
      case 'refresh-ranking':
        await loadRanking();
        break;
      case 'ranking-report': {
        if (!isAdmin() || !ranking.data) break;
        const team = state.teams.find(t => t.id === ranking.teamId)?.name || 'Todas as equipes';
        modal('Relatório do ranking', 'O resultado será recalculado ao salvar e ficará registrado neste relatório.',
          input('title', 'Título do relatório', 'Ranking de Qualidade — ' + team) +
          '<div class="ranking-report-context"><span><strong>Equipe:</strong> ' + e(team) + '</span>' +
          '<span><strong>Período:</strong> ' + e(ranking.data.period) + '</span></div>' +
          '<input type="hidden" name="type" value="Qualidade"><input type="hidden" name="includeRanking" value="true">' +
          '<input type="hidden" name="period" value="' + e(ranking.period) + '"><input type="hidden" name="teamId" value="' + e(ranking.teamId) + '">',
          'report-form');
        break;
      }
      case 'call-info': {
        const call = state.calls.find(c => c.id === id);
        if (call) {
          modal('Detalhes da Chamada', 'Registro PABX CTI', `
            <p><strong>Identificador PABX:</strong> ${e(call.pabxId || call.id)}</p>
            <p><strong>Cliente:</strong> ${e(call.client)}</p>
            <p><strong>Telefone:</strong> ${e(call.phone)}</p>
            <p><strong>Atendente:</strong> ${e(call.agent)}</p>
            <p><strong>Equipe:</strong> ${e(call.team)}</p>
            <p><strong>Duração:</strong> ${C.duration(call.seconds)}</p>
            <p><strong>Pontuação IA:</strong> ${call.score ?? 'Pendente'} / 100</p>
          `);
        }
        break;
      }
      case 'menu':
        target.setAttribute('aria-expanded', String(document.querySelector('.layout').classList.toggle('menu-open')));
        break;
      case 'logout':
        try {
          await request('/api/auth/logout', { method: 'POST' });
          session = null;
          clearData();
          closeModal();
          location.hash = 'login';
          render();
          toast('Desconectado com sucesso.');
        } catch (error) { toast(error.message); }
        break;
      case 'delete-user': confirmDeletion('users', id); break;
      case 'delete-customer': confirmDeletion('customers', id); break;
      case 'new-user': userModal(); break;
      case 'edit-user': userModal(id); break;
      case 'toggle-user': {
        const user = state.users.find(u => u.id === id);
        if (!user || target.disabled) break;
        target.disabled = true;
        try {
          await request('/api/data/users/' + encodeURIComponent(id) + '/active', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!user.active})});
          await loadDatabase(); toast('Status salvo no banco de dados.');
        } catch (error) { target.disabled = false; toast(error.message); }
        break;
      }
      case 'load-more':
        ui.callLimit = Math.min(10000, ui.callLimit + 200);
        await loadDatabase();
        break;
      case 'refresh':
        loadDatabase();
        toast('Atualizando dados da API...');
        break;
      case 'close': closeModal(); break;
      case 'new-customer': customerModal(); break;
      case 'edit-customer': customerModal(id); break;
      case 'add-customer-agent': {
        const form = document.querySelector('#customer-form');
        const box = document.querySelector('#customer-extra-agents');
        if (!form || !box) break;
        const primaryId = form.querySelector('#customer-user')?.value || '';
        const extraSelect = form.querySelector('#customer-extra-user');
        const currentExtras = Array.from(form.querySelectorAll('input[type="hidden"][name="userIds"]')).map(el => el.value);
        if (extraSelect?.value) currentExtras.push(extraSelect.value);
        box.innerHTML = '<label for="customer-extra-user">Atendentes adicionais vinculados</label>' + renderCustomerExtraAgents(primaryId, currentExtras);
        break;
      }
      case 'remove-customer-agent': {
        const form = document.querySelector('#customer-form');
        const box = document.querySelector('#customer-extra-agents');
        if (!form || !box) break;
        const primaryId = form.querySelector('#customer-user')?.value || '';
        const currentExtras = Array.from(form.querySelectorAll('input[type="hidden"][name="userIds"]')).map(el => el.value).filter(uid => String(uid) !== String(id));
        box.innerHTML = '<label for="customer-extra-user">Atendentes adicionais vinculados</label>' + renderCustomerExtraAgents(primaryId, currentExtras);
        break;
      }
      case 'customer-calls': {
        const cust = (state.customers || []).find(c => c.id === id);
        if (cust) {
          Object.assign(ui, { page: 1, query: cust.name, team: '', status: '', date: '', analysis: '', topic: '', profile: '', userStatus: '', reportStatus: '' });
          lastRoute = 'ligacoes';
          location.hash = 'ligacoes';
          render();
        }
        break;
      }
      case 'new-team': teamModal(); break;
      case 'edit-team': teamModal(id); break;
      case 'new-criterion': criterionModal(); break;
      case 'edit-criterion': criterionModal(id); break;
      case 'toggle-criterion': {
        const crit = state.criteria.find(c => c.id === id);
        if (crit) {
          const nextActive = !crit.active;
          try {
            await request('/api/data/criteria/' + encodeURIComponent(crit.id), {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: crit.name, description: crit.description, rule: crit.rule, version: crit.version, active: nextActive })
            });
            crit.active = nextActive;
            render();
            toast('Critério "' + crit.name + '" ' + (crit.active ? 'ativado' : 'desativado') + '.');
          } catch (error) {
            toast(error.message);
          }
        }
        break;
      }
      case 'call':
        ui.selected = id;
        ui.tab = 'resumo';
        location.hash = 'resumos';
        break;
      case 'select-call':
        ui.selected = id;
        stopAudio();
        render();
        break;
      case 'validate-call': {
        const call = state.calls.find(c => c.id === id);
        if (!call || !isAdmin() || !call.analysisId || target.disabled) break;
        target.disabled = true;
        try {
          await saveReview(call, call.summary, call.score, true);
          await loadDatabase(); toast('Validação registrada no banco.');
        } catch (error) { target.disabled = false; toast(error.message); }
        break;
      }
      case 'review-call': {
        const call = state.calls.find(c => c.id === id);
        if (call && isAdmin() && call.analysisId) {
          modal('Revisar resumo', 'A revisão humana preserva o resultado original da IA. Salvar uma edição exige nova validação.',
            '<input type="hidden" name="id" value="' + e(call.id) + '">' +
            '<div class="form-field"><label>Nota (0 a 100; opcional)</label><input type="number" name="score" min="0" max="100" value="' + e(call.score ?? '') + '"></div>' +
            '<div class="form-field"><label>Resumo revisado</label><textarea name="summary" maxlength="20000" rows="8" required>' + e(call.summary || '') + '</textarea></div>',
            'review-call-form');
        }
        break;
      }
      case 'delete-report': confirmDeletion('reports', id); break;
      case 'new-report':
        if (!isAdmin()) break;
        reportModal();
        break;
      case 'view-report': {
        const rep = state.reports.find(r => r.id === id);
        if (rep) {
          const info = parseReportSummary(rep);
          const rawScore = rep.averageScore != null ? Number(rep.averageScore) : (rep.score != null && rep.score !== '—' && String(rep.score).trim() !== '' ? Number(rep.score) : NaN);
          const hasScore = Number.isFinite(rawScore);
          const numScore = hasScore ? Math.max(0, Math.min(100, Math.round(rawScore))) : null;
          const scoreTone = numScore == null ? 'neutral' : numScore >= 90 ? 'green' : numScore >= 75 ? 'amber' : 'red';
          const scoreStatus = numScore == null ? 'Sem avaliações no período' : numScore >= 90 ? 'Excelente (90 a 100 pts)' : numScore >= 75 ? 'Dentro da meta (75 a 89 pts)' : 'Atenção (abaixo de 75 pts)';
          const fillClass = numScore == null ? '' : numScore >= 90 ? '' : numScore >= 75 ? ' warning' : ' danger';
          const kpis = info.total != null ? '<div class="report-kpi-grid">' +
            '<div class="report-kpi-card"><span class="metric-icon blue">' + icon('phone') + '</span><div><strong>' + e(info.total) + '</strong><span>Ligações</span><small>Total no período</small></div></div>' +
            '<div class="report-kpi-card"><span class="metric-icon indigo">' + icon('sparkle') + '</span><div><strong>' + e(info.analyzed ?? 0) + '</strong><span>Analisadas pela IA</span><small>Avaliadas com critérios</small></div></div>' +
            '<div class="report-kpi-card"><span class="metric-icon green">' + icon('check') + '</span><div><strong>' + e(info.reviewed ?? 0) + '</strong><span>Validadas pelo Gestor</span><small>Revisão concluída</small></div></div>' +
            '</div>' : '';
          const priorityChips = reportPrioritySummary(rep);
          const criteriaLine = reportCriteriaItems(rep).map(name => badge(name, 'neutral')).join(' ');
          modal(rep.title, rep.type + ' • ' + rep.period,
            '<div class="report-meta-pills">' +
              '<span class="report-pill"><strong>Equipe:</strong> ' + e(rep.team || 'Todas as equipes') + '</span>' +
              '<span class="report-pill"><strong>Categoria:</strong> ' + badge(rep.type || 'Qualidade', reportCategoryTone(rep.type || 'Qualidade')) + '</span>' +
              '<span class="report-pill"><strong>Status:</strong> ' + badge(rep.status || 'Aguarda revisão', reportStatusTone(rep.status || 'Aguarda revisão')) + '</span>' +
            '</div>' +
            (Number(rep.highPriorityPending || 0) > 0 ? warn('Ligações críticas pendentes', rep.highPriorityPending + ' ligação(ões) de alta prioridade neste recorte ainda aguardam validação humana.') : '') +
            '<div class="report-score-card ' + scoreTone + '">' +
              '<div class="report-score-value">' +
                '<strong>' + (numScore != null ? numScore : '—') + '</strong>' +
                '<small>' + (numScore != null ? 'de 100 pts' : 'sem nota') + '</small>' +
              '</div>' +
              '<div class="report-score-info">' +
                '<div class="report-score-head"><strong>Pontuação Média de Qualidade</strong>' + badge(scoreStatus, scoreTone) + '</div>' +
                '<p>Média de <strong>0 a 100 pontos</strong> calculada pelas notas das ligações avaliadas conforme os critérios de atendimento.</p>' +
                '<div class="score-bar"><div class="score-bar-fill' + fillClass + '" style="width:' + (numScore ?? 0) + '%"></div></div>' +
                '<div class="report-score-scale"><span>0 pts (Crítico)</span><span>75 pts (Meta)</span><span>100 pts (Excelente)</span></div>' +
              '</div>' +
            '</div>' +
            kpis +
            (priorityChips ? '<div class="report-summary-box"><h3>Prioridades no Recorte</h3>' + priorityChips + '</div>' : '') +
            '<div class="report-summary-box"><h3>Critérios Aplicados</h3><div class="chips">' + criteriaLine + '</div></div>' +
            '<div class="report-summary-box"><h3>Resumo Executivo</h3><p class="stored-text">' + e(info.note || 'Nenhuma observação adicional registrada pelo gestor para este período.') + '</p></div>' +
            (Array.isArray(rep.ranking) ? '<div style="margin-top:16px;"><h3>Ranking registrado</h3>' + rankingTable(rep.ranking) + '</div>' : ''));
        }
        break;
      }
      case 'export-report': {
        if (!isAdmin()) break;
        const rep = state.reports.find(r => r.id === id);
        if (rep) {
          const savedRanking = Array.isArray(rep.ranking) ? '\r\n\r\nRANKING REGISTRADO:\r\n' + rep.ranking.map(row =>
            [row.position ?? '—', row.name, row.team, rankingScore(row.score), row.evaluated + ' com nota validada', row.pending + ' aguardam validação'].join(' | ')).join('\r\n') : '';
          download('SENX-Relatorio-' + rep.id + '.txt', 'SENX CTI — ' + rep.title + '\r\nTipo: ' + rep.type + '\r\nPeriodo: ' + rep.period + '\r\nEquipe: ' + rep.team + '\r\nPontuacao: ' + rep.score + '\r\n\r\nRESUMO:\r\n' + rep.summary + savedRanking);
          toast('Relatório baixado com sucesso!');
        }
        break;
      }
      case 'export-calls': {
        if (!isAdmin()) break;
        const header = ['ID', 'Contato', 'Telefone', 'Atendente', 'Equipe', 'Data', 'Duração', 'Pontuação', 'Assunto', 'Status'];
        const csvRows = filteredCalls().map(c => [
          c.pabxId || c.id, c.client, c.phone, c.agent, c.team, c.date,
          C.duration(c.seconds), c.score ?? '—', c.topic || '—', c.status
        ]);
        download('SENX-ligacoes.csv', C.toCsv([header, ...csvRows]), 'text/csv;charset=utf-8');
        toast('Lista de ligações exportada em CSV.');
        break;
      }
    }
  });

  document.addEventListener('change', event => {
    const t = event.target;
    if (t.dataset.ranking === 'teamId' || t.dataset.ranking === 'period') {
      ranking[t.dataset.ranking] = t.value;
      ui.page = 1;
      void loadRanking();
      return;
    }
    if (t.name === 'profile') {
      const description = document.querySelector('#permissions-description');
      if (description) description.textContent = t.value === 'Administrador' ? 'Gerenciar colaboradores, departamentos e critérios; consultar todos os registros.' : 'Consultar suas próprias ligações, transcrições e perfil.';
    }
    if (t.id === 'customer-user') {
      const form = document.querySelector('#customer-form');
      const box = document.querySelector('#customer-extra-agents');
      if (form && box) {
        const currentExtras = Array.from(form.querySelectorAll('input[type="hidden"][name="userIds"]')).map(el => el.value);
        box.innerHTML = '<label for="customer-extra-user">Atendentes adicionais vinculados</label>' + renderCustomerExtraAgents(t.value, currentExtras);
      }
    }
    if (t.matches('[data-filter]') && t.type !== 'search') {
      ui[t.dataset.filter] = t.value;
      ui.page = 1;
      render();
    }
  });

  let filterTimer;
  document.addEventListener('input', event => {
    const t = event.target;
    if (!t.matches('input[type=search][data-filter]')) return;
    const value = t.value;
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      const wasFocused = document.activeElement === t;
      const selectionStart = t.selectionStart;
      const selectionEnd = t.selectionEnd;
      const selectionDirection = t.selectionDirection;
      ui.query = value;
      ui.page = 1;
      render();
      const searchInput = document.querySelector('input[type=search][data-filter]');
      if (wasFocused && searchInput) {
        searchInput.focus({ preventScroll: true });
        searchInput.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
      }
    }, 180);
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    const layout = document.querySelector('.layout.menu-open');
    if (!layout) return;
    layout.classList.remove('menu-open');
    const menu = layout.querySelector('[data-action=menu]');
    menu.setAttribute('aria-expanded', 'false');
    menu.focus();
  });

  window.addEventListener('hashchange', () => {
    clearTimeout(filterTimer);
    stopAudio();
    render();
    window.scrollTo(0, 0);
  });

  render();
  startSession();
})();
