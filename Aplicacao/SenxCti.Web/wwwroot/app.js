/* SENX 1.0.0.0 — Fonte única da interface: wwwroot. Totalmente integrada ao backend .NET e PostgreSQL. */
(() => {
  'use strict';
  const C = window.SenxCore, state = window.SenxData, e = C.escapeHtml;
  const ui = {
    page: 1, query: '', team: '', status: '', date: '', selected: null, tab: 'resumo',
    adminTab: 'usuarios', analysis: '', topic: '', profile: '', reportType: 'Todos',
    callLimit: 200, rankingTab: 'atendentes', audioPlaying: false, audioCurrentTime: 0, audioDuration: 345,
    audioSpeed: 1
  };
  const stopAudio = () => document.querySelector('audio')?.pause();
  const app = document.querySelector('#app');
  let connection = 'loading', connectionDetail = '', lastRoute = '', toastTimer, lastFocus;
  let session = null, authReady = false, setupRequired = false, setupTeams = [], authError = '';
  const request = window.SenxSession.request;
  window.addEventListener('senx-upload-completed', async () => { await loadDatabase(); toast('Gravação processada. Confira a análise antes de validá-la.'); });
  const isAdmin = () => session?.profile === 'Administrador';

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
    award: '<circle cx="12" cy="8" r="6"/><path d="m15.4 12.8 2.6 7.2-6-3.6-6 3.6 2.6-7.2"/>'
  };

  const icon = name => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.info) + '</svg>';
  const brand = () => '<div class="brand"><img src="assets/senx-symbol.png" alt=""><img src="assets/senx-wordmark.png" alt="SENX"></div>';
  const btn = (text, action, style = '', id = '') => '<button type="button" class="btn ' + style + '" data-action="' + action + '" data-id="' + e(id) + '">' + text + '</button>';
  const badge = (text, tone = 'blue') => '<span class="badge ' + tone + '">' + e(text) + '</span>';
  const empty = (title = 'Nenhum registro no banco de dados.', text = 'Os dados aparecerão aqui conforme forem registrados no PostgreSQL.') => '<div class="empty-state"><strong>' + e(title) + '</strong><p>' + e(text) + '</p></div>';
  const input = (name, label, value = '', type = 'text') => '<div class="form-field"><label for="field-' + name + '">' + label + ' *</label><input id="field-' + name + '" name="' + name + '" type="' + type + '" value="' + e(value) + '" maxlength="' + (type === 'password' ? 128 : name === 'name' ? 200 : 255) + '" ' + (type === 'password' ? 'minlength="12" autocomplete="new-password"' : '') + ' required></div>';
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
      if (!state.calls.some(c => c.id === ui.selected)) ui.selected = state.calls[0]?.id || null;
    } catch (error) {
      Object.assign(state, { calls: [], teams: [], users: [], criteria: [], customers: [], counts: {}, reports: [], rankings: [], source: null, fetchedAt: null });
      if (error.status === 401) session = null;
      connection = 'error';
      connectionDetail = error.message;
    }
    render();
  }

  const connected = () => connection === 'connected';
  const count = name => connected() ? (state.counts[name] ?? state[name.toLowerCase() + 's']?.length ?? 0) : '—';
  const metric = (label, value, name, tone = 'blue', caption = '') => '<article class="metric"><span class="metric-icon ' + tone + '">' + icon(name) + '</span><div><label>' + label + '</label><strong>' + e(value) + '</strong><small>' + e(caption) + '</small></div></article>';

  function head(title, subtitle, actions = '') {
    const stamp = state.fetchedAt ? new Date(state.fetchedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Aguardando atualização';
    return '<header class="page-head"><div><h1>' + title + '</h1><p>' + subtitle + '</p></div><div class="head-actions"><span class="updated-stamp">' + e(state.fetchedAt ? 'Atualizado em ' + stamp : stamp) + '</span>' + actions + '</div></header>';
  }

  const teamOptions = () => state.teams.map(t => '<option value="' + e(t.name) + '" ' + (ui.team === t.name ? 'selected' : '') + '>' + e(t.name) + '</option>').join('');
  const search = (placeholder = 'Pesquisar', label = 'Buscar') => '<label class="field-control search"><span>' + label + '</span><div class="input-icon">' + icon('search') + '<input type="search" data-filter="query" value="' + e(ui.query) + '" placeholder="' + placeholder + '"></div></label>';
  const teamFilter = (label = 'Equipe') => field(label, '<div class="input-icon">' + icon('users') + '<select data-filter="team"><option value="">Todas as equipes</option>' + teamOptions() + '</select></div>');
  const dateFilter = () => field('Período', '<input aria-label="Período" type="date" data-filter="date" value="' + e(ui.date) + '">');
  const analysisFilter = () => field('Análise / revisão', '<select data-filter="analysis"><option value="">Todos os estados</option>' + ['Concluída', 'Em análise', 'Não analisada'].map(v => '<option ' + (ui.analysis === v ? 'selected' : '') + '>' + v + '</option>').join('') + '</select>');
  const topicFilter = () => field('Assunto', '<select data-filter="topic"><option value="">Todos os assuntos</option>' + [...new Set(state.calls.map(c => c.topic).filter(Boolean))].map(v => '<option ' + (ui.topic === v ? 'selected' : '') + '>' + e(v) + '</option>').join('') + '</select>');
  const filteredCalls = () => C.filterCalls(state.calls, ui).filter(c => (!ui.analysis || analysisLabel(c) === ui.analysis) && (!ui.topic || c.topic === ui.topic));

  function pager(result, label = 'registros') {
    const pages = Array.from({ length: Math.min(result.pages, 3) }, (_, i) => Math.max(1, Math.min(result.page - 1, result.pages - 2)) + i);
    return '<div class="pagination"><span>Mostrando ' + result.items.length + ' de ' + result.total + ' ' + label + '</span><div class="pages"><button data-page="' + (result.page - 1) + '" ' + (result.page <= 1 ? 'disabled' : '') + ' aria-label="Página anterior">‹</button>' + pages.map(p => '<button data-page="' + p + '" class="' + (result.page === p ? 'selected' : '') + '" aria-label="Página ' + p + '">' + p + '</button>').join('') + '<button data-page="' + (result.page + 1) + '" ' + (result.page >= result.pages ? 'disabled' : '') + ' aria-label="Próxima página">›</button></div></div>';
  }

  function table(headers, rows, extra = '') {
    return '<div class="table-wrap ' + extra + '"><table><thead><tr>' + headers.map(h => '<th scope="col">' + h + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function shell(content, active) {
    const nav = [['ligacoes', 'Ligações', 'phone'], ['clientes', 'Clientes', 'users'], ['resumos', 'Resumos', 'summary'], ['relatorios', 'Relatórios', 'report'], ['rankings', 'Rankings', 'ranking'], ['configuracoes', 'Configurações', 'settings'], ['administracao', 'Administração', 'admin']].filter(([route]) => route !== 'administracao' || isAdmin());
    const banner = connection === 'error' ? note('Conexão indisponível', connectionDetail) : connected() && Number(state.counts.Ligacao) > state.calls.length ? note('Recorte de consulta', 'Exibindo as ' + state.calls.length + ' ligações mais recentes. Filtros, exportação e métricas desta lista se referem a esse recorte.') : '';
    return '<div class="layout screen-' + active + '"><div class="mobile-bar">' + btn(icon('menu') + '<span class="sr-only">Menu principal</span>', 'menu', 'secondary small') + '<strong>SENX</strong><a href="#configuracoes" aria-label="Meu perfil">' + icon('users') + '</a></div><aside class="sidebar"><a class="brand-link" href="#ligacoes" aria-label="SENX — Ligações">' + brand() + '</a><nav class="nav-list" aria-label="Menu principal">' + nav.map(([route, label, name]) => '<a href="#' + route + '" class="nav-link ' + (active === route ? 'active' : '') + '" ' + (active === route ? 'aria-current="page"' : '') + '>' + icon(name) + label + '</a>').join('') + '</nav><div class="sidebar-bottom"><a href="#configuracoes" class="sidebar-person">' + person(session?.name || 'Usuário', session?.job || 'SENX') + '</a><div class="sidebar-note"><small>v1.0.0.0</small></div></div></aside><main class="content" id="main" tabindex="-1">' + banner + content + '</main></div>';
  }

  function decorations() {
    return '<span class="decoration diamond one"></span><span class="decoration diamond two"></span><span class="decoration sphere one"></span><span class="decoration sphere two"></span>';
  }

  function passwordField(name, label, placeholder, setup = false) {
    const id = name === 'password' ? 'login-password' : 'field-' + name;
    return '<div class="form-field"><label for="' + id + '">' + label + '</label><div class="password-wrap"><input id="' + id + '" name="' + name + '" type="password" maxlength="128" ' + (setup ? 'minlength="12" autocomplete="new-password"' : 'autocomplete="current-password"') + ' placeholder="' + placeholder + '" required><button type="button" data-action="toggle-password" data-id="' + id + '" aria-label="Mostrar ' + label.toLowerCase() + '">' + icon('eye') + '</button></div></div>';
  }

  function auth(setup = false) {
    const register = setup;
    if (!setup && location.hash === '#cadastro') location.hash = 'login';
    const team = setupTeams.length ? '<div class="form-field"><label for="setup-team">Equipe *</label><select id="setup-team" name="teamId" required>' + setupTeams.map(t => '<option value="' + e(t.id) + '">' + e(t.name) + '</option>').join('') + '</select></div>' : input('teamName', 'Nome da equipe') + input('department', 'Departamento');
    const headline = register ? 'Crie Sua Conta e<br>Comece a Transformar<br>Seus Dados ↗' : 'Transforme Sua Rotina<br>Complicada Em Uma<br>Experiência Mais<br>Simples ↗';
    const help = register ? '<label class="consent"><input type="checkbox" disabled title="Documentos de uso ainda não publicados."><span>Concordo com os <button type="button" data-action="policy">Termos de Uso</button> e a <button type="button" data-action="policy">Política de Privacidade</button></span></label>' : '<div class="auth-help"><label title="Mantenha a sessão por até 14 dias neste dispositivo."><input type="checkbox" name="rememberMe" role="switch"><span>Lembre-me</span></label><button type="button" data-action="forgot">Esqueceu a senha?</button></div>';
    return '<div class="auth ' + (register ? 'auth-register' : 'auth-login') + '"><section class="auth-story">' + decorations() + '<div class="auth-copy"><h1>' + headline + '</h1><p>A SENX é uma plataforma avançada de análise de dados impulsionada por IA, projetada para transformar a maneira como as empresas compreendem e aproveitam seus dados.</p></div></section><main id="main" class="auth-panel"><div class="auth-card ' + (setup ? 'setup-card' : '') + '">' + brand() + '<h2>' + (register ? 'Crie sua conta' : 'Bem-Vindo de volta!') + '</h2>' + (register ? '<p>Preencha os campos abaixo para se cadastrar</p>' : '') + '<form id="auth-form">' + (register ? '<div class="form-field"><label for="field-name">Nome completo</label><input id="field-name" name="name" maxlength="200" placeholder="Seu nome completo" autocomplete="name" required></div>' : '') + '<div class="form-field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" maxlength="255" placeholder="' + (register ? 'seu@email.com' : 'Email') + '" autocomplete="username" required></div>' + passwordField('password', 'Senha', register ? 'Crie uma senha' : 'Senha', register) + (register ? passwordField('confirm', 'Confirmar senha', 'Confirme sua senha', true) : '') + (setup ? team : '') + help + '<p class="form-error" role="alert">' + e(authError) + '</p><button class="btn full" type="submit">' + (register ? 'Criar Conta' : 'Login') + '</button></form><div class="auth-footer">' + (register ? 'Já tem uma conta? <a href="#login">Faça login</a>' : 'Solicite seu acesso ao administrador.') + '</div>' + (setup ? '<div class="auth-notice">Primeiro acesso: crie o administrador com senha de 12 a 128 caracteres.</div>' : '<div class="auth-notice">Entre com sua conta para acessar o sistema.</div>') + '</div></main></div>';
  }

  function callsPage() {
    const calls = filteredCalls();
    const result = C.paginate(calls, ui.page);
    const analyzed = calls.filter(c => c.processed === true && !/simulado/i.test(c.model || '')).length;
    const reviewedCount = calls.filter(c => c.reviewed === true).length;
    const scores = calls.filter(c => c.analysisId && !/simulado/i.test(c.model || '') && Number.isFinite(c.score)).map(c => c.score);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) + ' pts' : '—';
    const average = calls.length ? C.duration(Math.round(calls.reduce((n, c) => n + (Number(c.seconds) || 0), 0) / calls.length)) : '—';
    const rows = result.items.map(c => '<tr><td>' + person(c.client, c.team) + '</td><td>' + e(c.phone) + '</td><td>' + C.formatDate(c.date) + ' ' + e(c.time) + '</td><td>' + C.duration(c.seconds) + '</td><td>' + (c.score != null ? badge(c.score + ' pts', c.score >= 90 ? 'green' : c.score >= 75 ? 'amber' : 'red') : badge('Pendente', 'neutral')) + '</td><td>' + badge(c.topic || 'Geral', 'neutral') + '</td><td>' + analysisBadge(c) + '</td><td><div class="row-actions">' + btn(icon('play') + '<span class="sr-only">Ouvir e Ver</span>', 'call', 'icon-action', c.id) + btn(icon('more') + '<span class="sr-only">Mais detalhes</span>', 'call-info', 'icon-action secondary', c.id) + '</div></td></tr>');

    return head('Análise de Ligações', 'Triagem de chamadas com transcrição e resumos estruturados por IA', btn(icon('upload') + ' Enviar gravação', 'upload-audio', 'small') + btn(icon('download') + ' Exportar CSV', 'export-calls', 'secondary small') + btn('Atualizar', 'refresh', 'secondary small') + (Number(state.counts.Ligacao) > state.calls.length && ui.callLimit < 10000 ? btn('Carregar mais ligações', 'load-more', 'secondary small') : '')) +
      warn('Análises automatizadas e revisão humana', 'As pontuações e resumos fornecem suporte à supervisão; a validação humana é o critério definitivo de qualidade.') +
      '<section class="metrics five">' + metric('Ligações no recorte', connected() ? calls.length : '—', 'phone') + metric('Analisadas (IA)', connected() ? analyzed : '—', 'summary', 'indigo', 'Processamento concluído') + metric('Revisões validadas', connected() ? reviewedCount : '—', 'check', 'green') + metric('Nota média registrada', connected() ? avgScore : '—', 'check', 'green', 'Média de avaliações') + metric('Duração Média', connected() ? average : '—', 'clock', 'purple', 'Tempo médio') + '</section>' +
      '<section class="panel calls-filters"><div class="toolbar">' + search('Pesquisar por contato, telefone ou atendente...') + teamFilter('Filtrar equipe') + analysisFilter() + topicFilter() + dateFilter() + '</div></section>' +
      '<section class="panel calls-table">' + table(['Contato', 'Telefone', 'Data / hora ↓', 'Duração', 'Pontuação IA', 'Assunto / Motivo', 'Status Análise', 'Ações'], rows.length ? rows : [emptyRow(8, 'Nenhuma ligação encontrada no banco de dados.')]) +
      '<div class="legend"><span>Pontuação: 0 a 100 baseada nos critérios de atendimento</span><span>Sentimento e tópicos extraídos por IA sujeitos à validação</span></div>' + pager(result, 'ligações') + '</section>';
  }

  function renderAudioPlayer(call) {
    if (!call.hasAudio) return note('Gravação indisponível', 'Nenhum arquivo foi associado a esta ligação.');
    return '<audio controls preload="none" class="recording-player" src="/api/data/calls/' + encodeURIComponent(call.id) + '/audio"></audio><p class="audio-error" role="alert"></p>';
  }

  function formatTranscript(text) {
    if (!text) return '<p class="stored-text">Transcrição não registrada.</p>';
    const lines = text.split('\n');
    return '<div class="transcript-dialogue">' + lines.map(line => {
      const match = line.match(/^(\[\d{2}:\d{2}\])\s*([^:]+):\s*(.+)$/);
      if (!match) return '<p class="stored-text">' + e(line) + '</p>';
      const [, time, speaker, content] = match;
      const isAgent = !speaker.toLowerCase().includes('cliente');
      return '<div class="speaker-bubble ' + (isAgent ? 'agent' : 'client') + '"><div class="speaker-header"><span>' + e(speaker) + '</span><time>' + e(time) + '</time></div><p>' + e(content) + '</p></div>';
    }).join('') + '</div>';
  }

  function summariesPage() {
    const calls = filteredCalls(), call = calls.find(c => c.id === ui.selected) || calls[0];
    let detail = '<div class="detail-title"><h2>Selecione uma ligação</h2><p class="detail-meta">Resumo, transcrição e próximos passos</p></div><div class="detail-body">' + empty('Nenhuma ligação selecionada.') + '</div>';

    if (call) {
      let body = '';
      if (ui.tab === 'transcricao') {
        body = '<section><h3>Transcrição da ligação em áudio</h3>' + formatTranscript(call.transcript) + '</section>';
      } else if (ui.tab === 'audio') {
        body = '<div class="audio-box"><h3>Reprodução da Gravação PABX</h3><p class="detail-meta">Gravação da ligação • ' + e(call.client) + ' • Duração: ' + C.duration(call.seconds) + '</p>' + renderAudioPlayer(call) + '</div>';
      } else {
        body = '<div class="summary-topic">' + badge(call.topic || 'Geral', 'blue') + (call.score != null ? badge('Nota: ' + call.score + '/100', call.score >= 90 ? 'green' : 'amber') : '') + '<small>Classificação de atendimento</small></div>' +
          '<section><h3>Necessidade relatada pelo cliente</h3><p class="stored-text">' + e(call.summary || 'Análise ainda não disponível. A integração de IA está em desenvolvimento.') + '</p></section>' +
          '<section><h3>Encaminhamento e Resolução</h3><p>' + e(call.nextStep || 'Não informado.') + '</p></section>' +
          '<section><h3>Compromissos e Próximos Passos</h3><p>' + e(call.commitments || 'Sem pendências registradas.') + '</p></section>' +
          '<div class="quote">' + icon('alert') + '<div><strong>Auditoria de Atendimento</strong><p>A análise é gerada com apoio de IA e confirmada pelo supervisor responsável.</p></div></div>';
      }

      detail = '<div class="detail-title"><div><h2>' + e(call.client) + ' <small>' + e(call.pabxId || call.id) + '</small></h2>' + analysisBadge(call) + '</div>' +
        '<p class="detail-meta">' + C.formatDate(call.date) + ' · ' + e(call.time) + ' • Duração: ' + C.duration(call.seconds) + ' • Tel: ' + e(call.phone) + '</p>' +
        '<p class="detail-meta">Equipe: ' + e(call.team) + ' • Colaborador: ' + e(call.agent) + '</p></div>' +
        '<div class="tabs compact">' + [['resumo', 'Resumo', 'report'], ['transcricao', 'Transcrição', 'summary'], ['audio', 'Ouvir Ligação', 'phone']].map(([id, label, name]) => '<button class="tab ' + (ui.tab === id ? 'active' : '') + '" data-tab="' + id + '">' + icon(name) + label + '</button>').join('') + '</div>' +
        '<div class="detail-body">' + body + '</div>' +
        '<div class="detail-footer"><span class="muted">' + (call.reviewed ? '✓ Resumo validado pela supervisão' : 'Aguardando revisão humana') + '</span>' +
        (isAdmin() && call.analysisId ? '<div>' + btn(icon('edit') + ' Revisar resumo', 'review-call', 'secondary small', call.id) + btn(icon('check') + ' Validar resumo', 'validate-call', call.reviewed ? 'secondary small' : 'small', call.id) + '</div>' : '<span>Revisão disponível à administração quando houver análise.</span>') + '</div>' +
        '<div class="privacy-foot">Acesso conforme o perfil da conta. Revisões humanas são registradas.</div>';
    }

    return head('Resumos e Transcrições', 'Consulte necessidades, encaminhamentos e gravações das ligações', btn('Atualizar', 'refresh', 'secondary small')) +
      warn('Inspeção de Ligações e IA', 'Valide o resumo e os compromissos antes de encaminhar tarefas a outros departamentos.') +
      '<section class="panel summary-filters"><div class="toolbar">' + search('Buscar por contato, resumo ou ID...') + teamFilter() + topicFilter() + dateFilter() + analysisFilter() + '</div>' +
      '<div class="filter-info"><span>' + calls.length + ' ligações no recorte • Ordenadas por mais recentes</span>' + btn('Limpar filtros', 'clear-filters', 'text-btn') + '</div></section>' +
      '<div class="summary-layout"><section class="panel"><div class="panel-header"><h3>Ligações ' + badge(calls.length) + '</h3>' + icon('filter') + '</div>' +
      '<div class="call-list">' + (calls.map(c => '<button class="call-option ' + (c.id === call?.id ? 'active' : '') + '" data-action="select-call" data-id="' + e(c.id) + '"><div class="call-option-top"><strong>' + e(c.client) + '</strong><small>' + C.formatDate(c.date) + '</small></div><p>' + e((c.summary || 'Sem resumo disponível.').slice(0, 110)) + '...</p><div class="call-option-top"><small>' + e(c.agent) + ' · ' + e(c.topic || 'Geral') + '</small>' + analysisBadge(c) + '</div></button>').join('') || empty('Nenhuma ligação encontrada.')) + '</div>' +
      '<div class="list-foot">Mostrando ' + calls.length + ' ligações</div></section>' +
      '<section class="panel summary-detail">' + detail + '</section></div>';
  }

  function reportsPage() {
    const filters = ['Todos', 'Qualidade', 'Retenção', 'Desenvolvimento', 'Conformidade'];
    const reports = state.reports.filter(r => (ui.reportType === 'Todos' || r.type === ui.reportType) && (!ui.team || r.team === ui.team) && (!ui.date || r.date === ui.date) && C.search(r.title + ' ' + (r.team || ''), ui.query));
    const rows = reports.map(r => '<tr><td><strong>' + e(r.title) + '</strong><small>' + e((r.summary || '').slice(0, 80)) + '...</small></td><td>' + badge(r.type, r.type === 'Qualidade' ? 'green' : r.type === 'Retenção' ? 'amber' : 'blue') + '</td><td>' + e(r.team || 'Todas') + '</td><td>' + e(r.criteria || 'Catálogo') + '</td><td>' + e(r.period) + '</td><td>' + badge(r.status, r.status === 'Publicado' ? 'green' : 'amber') + '</td><td><div class="row-actions">' + btn(icon('eye') + ' Ver', 'view-report', 'icon-action', r.id) + btn(icon('download') + ' Baixar', 'export-report', 'icon-action secondary', r.id) + '</div></td></tr>');

    return head('Relatórios Gerenciais', 'Indicadores de qualidade, retenção e conformidade operacional', (isAdmin() ? btn(icon('plus') + ' Novo Relatório', 'new-report') : '') + btn('Atualizar', 'refresh', 'secondary small')) +
      '<section class="metrics three">' + metric('Relatórios neste recorte', reports.length, 'report', 'indigo') + metric('Equipes cadastradas', state.teams.length, 'users', 'green') + metric('Critérios ativos', state.criteria.filter(c => c.active).length, 'check', 'purple') + '</section>' +
      note(isAdmin() ? 'Relatórios descritivos' : 'Acesso a relatórios', isAdmin() ? 'Consolidações persistidas de volume, análises, revisões e média das notas registradas. FCR e conformidade aguardam definição.' : 'Relatórios consolidados são restritos à administração.') + '<div class="tabs report-tabs">' + filters.map(v => '<button class="tab ' + (ui.reportType === v ? 'active' : '') + '" data-action="report-tab" data-id="' + v + '">' + v + '</button>').join('') + '</div>' +
      '<div class="toolbar report-toolbar">' + search('Buscar pelo título ou departamento do relatório...') + teamFilter() + dateFilter() + '</div>' +
      '<section class="panel report-table">' + table(['Relatório', 'Categoria', 'Departamento', 'Critérios Aplicados', 'Período', 'Status', 'Ações'], rows.length ? rows : [emptyRow(7, 'Nenhum relatório cadastrado no banco de dados.')]) + '</section>' +
      '<div class="split-notes"><article class="note"><h3>Critérios Ativos na Avaliação</h3><p>Os critérios cadastrados pela administração orientam o cruzamento de dados nos relatórios.</p><div class="chips">' + (state.criteria.filter(c => c.active).map(c => badge(c.name, 'neutral')).join('') || '<span class="muted">Nenhum critério ativo.</span>') + '</div></article><article class="note blue"><h3>Resumo de Diretrizes</h3><p>Os relatórios são compilados a partir das transcrições das chamadas e apoiam treinamentos e planos de ação da equipe.</p></article></div>';
  }

  function rankingsPage() {
    return head('Rankings de Desempenho', 'Acompanhamento de atendentes e equipes') +
      note('Regras de classificação em definição', 'Fórmula, pesos, período e elegibilidade aguardam validação do produto. Nenhuma classificação ou FCR é calculado nesta versão.') +
      '<section class="panel">' + table(['Equipe', 'Departamento', 'Colaboradores'], state.teams.map(t => '<tr><td>' + e(t.name) + '</td><td>' + e(t.department) + '</td><td>' + e(t.members) + '</td></tr>')) + '</section>';
  }

  function settingsPage() {
    const profileField = (name, label, value, readonly = false) => '<div class="form-field"><label for="profile-' + name + '">' + label + '</label><input id="profile-' + name + '" name="' + name + '" type="' + (name === 'email' ? 'email' : 'text') + '" value="' + e(value) + '" maxlength="' + (name === 'name' ? 200 : 255) + '" ' + (readonly ? 'readonly' : 'required autocomplete="' + (name === 'name' ? 'name' : 'email') + '"') + '></div>';
    return head('Configurações', 'Gerencie seus dados de acesso e a segurança da sua conta') +
      '<section class="panel profile-card"><span class="avatar profile-avatar">' + e(C.initials(session.name)) + '</span><div><h2>' + e(session.name) + '</h2><p>' + e(session.job) + ' • ' + e(session.profile) + ' • ' + e(session.team) + '</p></div><a class="btn secondary" href="#saida">' + icon('exit') + ' Sair</a></section>' +
      '<section class="panel profile-form"><h2>Informações de Perfil</h2><form id="profile-form"><div class="form-grid">' + profileField('email', 'E-mail Corporativo', session.email) + profileField('name', 'Nome Completo', session.name) + profileField('team', 'Departamento / Equipe', session.team, true) + profileField('job', 'Cargo', session.job, true) +
      '<div class="form-field"><label for="profile-current-password">Senha Atual para confirmação</label><input id="profile-current-password" name="currentPassword" type="password" maxlength="128" autocomplete="current-password" placeholder="Digite sua senha atual" required></div>' +
      '<details class="profile-passwords"><summary>Alterar Senha de Acesso</summary><div class="form-grid"><div class="form-field"><label for="profile-new-password">Nova Senha (mínimo 12 caracteres)</label><input id="profile-new-password" name="newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="Mínimo 12 caracteres"></div><div class="form-field"><label for="profile-confirm-password">Confirmar Nova Senha</label><input id="profile-confirm-password" name="confirmPassword" type="password" maxlength="128" autocomplete="new-password" placeholder="Repita a nova senha"></div></div><p>A alteração da senha encerra as demais sessões abertas da sua conta por segurança.</p></details></div>' +
      '<p class="form-error" role="alert"></p><div class="profile-actions"><button type="reset" class="btn secondary">Descartar alterações</button><button class="btn" type="submit">Salvar Alterações</button></div></form><p class="profile-note">Permissões e departamentos são geridos pela administração da SENX.</p></section>';
  }

  function usersView() {
    const users = state.users.filter(u => C.search(u.name + ' ' + u.email, ui.query) && (!ui.team || ui.team === u.team) && (!ui.profile || u.profile === ui.profile));
    const roles = field('Perfil', '<select data-filter="profile"><option value="">Todos os perfis</option>' + ['Administrador', 'Colaborador'].map(p => '<option ' + (ui.profile === p ? 'selected' : '') + '>' + p + '</option>').join('') + '</select>');
    return '<section class="panel users-filters"><div class="panel-header"><h2>Colaboradores e Acessos</h2>' + badge(state.users.length + ' cadastrados', 'green') + '</div><div class="toolbar admin-filter">' + search('Pesquisar por nome ou e-mail') + teamFilter('Departamento') + roles + btn(icon('plus') + ' Adicionar usuário', 'new-user', 'ghost') + '</div></section><section class="panel users-table">' + table(['Nome', 'E-mail', 'Departamento', 'Perfil de Acesso', 'Status', 'Ações'], users.length ? users.map(u => '<tr><td>' + person(u.name, u.role) + '</td><td>' + e(u.email) + '</td><td>' + e(u.team) + '</td><td><div class="access-chips">' + badge(u.profile, u.profile === 'Administrador' ? 'purple' : 'blue') + '</div></td><td>' + badge(u.active !== false ? 'Ativo' : 'Inativo', u.active !== false ? 'green' : 'neutral') + '</td><td><div class="row-actions">' + btn(icon('edit') + ' ' + (u.active !== false ? 'Desativar' : 'Ativar'), 'toggle-user', 'text-btn', u.id) + '</div></td></tr>') : [emptyRow(6, 'Nenhum colaborador encontrado no banco de dados.', 'Cadastre um novo usuário pelo botão acima.')]) + '</section>';
  }

  function teamsView() {
    const teams = state.teams.filter(t => C.search(t.name + ' ' + t.department, ui.query));
    return '<section class="metrics three">' + metric('Departamentos Cadastrados', new Set(state.teams.map(t => t.department)).size, 'building', 'soft') + metric('Colaboradores ativos', state.users.filter(u => u.active).length, 'users', 'soft') + metric('Equipes cadastradas', state.teams.length, 'admin', 'soft') + '</section><section class="panel departments-table"><div class="panel-header"><div><h2>Departamentos e Equipes</h2><p>Organize os acessos e os critérios de análise de cada equipe.</p></div>' + btn(icon('plus') + ' Adicionar departamento', 'new-team') + '</div>' + table(['Departamento', 'Equipe Vinculada', 'Colaboradores', 'Critérios', 'Ações'], teams.length ? teams.map(t => '<tr><td><strong>' + e(t.department) + '</strong></td><td>' + e(t.name) + '</td><td>' + e(t.members) + ' colaboradores</td><td>' + badge('Catálogo CTI') + '</td><td>' + btn(icon('edit') + ' Editar', 'edit-team', 'text-btn', t.id) + '</td></tr>') : [emptyRow(5, 'Nenhum departamento cadastrado.')]) + '<div class="list-foot">' + teams.length + ' equipes cadastradas</div></section>';
  }

  function criteriaView() {
    const criteria = state.criteria.filter(c => C.search(c.name + ' ' + c.description, ui.query));
    return '<section class="panel criteria-filter"><div class="toolbar"><strong>Departamento:</strong><select aria-label="Departamento"><option>Catálogo Global CTI</option></select><span class="criteria-count">' + badge(state.criteria.filter(c => c.active).length + ' ativos / ' + state.criteria.length + ' critérios', 'blue') + '</span>' + btn(icon('plus') + ' Adicionar critério', 'new-criterion', 'secondary') + '</div></section>' +
      warn('Classificações de Qualidade e IA', 'Os critérios configurados orientam a avaliação automatizada das transcrições pela IA.') +
      '<section class="panel criteria-table">' + table(['Critério', 'Descrição', 'Evidências e Regra de Avaliação', 'Status', 'Ações'], criteria.length ? criteria.map(c => '<tr><td><strong>' + e(c.name) + '</strong><small>Versão ' + e(c.version) + '</small></td><td>' + e(c.description) + '</td><td>' + e(c.rule) + '</td><td><button class="switch-label" data-action="toggle-criterion" data-id="' + e(c.id) + '" aria-label="Alternar critério"><span class="switch ' + (c.active ? 'on' : '') + '"></span>' + (c.active ? 'Ativo' : 'Inativo') + '</button></td><td>' + btn(icon('edit') + ' Editar', 'edit-criterion', 'text-btn', c.id) + '</td></tr>') : [emptyRow(5, 'Nenhum critério cadastrado.')]) + '</section>';
  }

  function adminPage() {
    if (!isAdmin()) return head('Administração', 'Acesso restrito.') + note('Permissão necessária', 'Somente administradores podem gerenciar cadastros.');
    const tabs = [['usuarios', 'Colaboradores e Acessos'], ['clientes', 'Clientes'], ['departamentos', 'Departamentos'], ['criterios', 'Critérios de Análise']];
    return head('Administração da Plataforma', 'Gerencie colaboradores, clientes, equipes e critérios de avaliação do atendimento.') + '<div class="tabs admin-tabs">' + tabs.map(([id, label]) => '<a class="tab ' + (ui.adminTab === id ? 'active' : '') + '" href="#administracao/' + id + '">' + label + '</a>').join('') + '</div>' + (ui.adminTab === 'usuarios' ? usersView() : ui.adminTab === 'clientes' ? customersView() : ui.adminTab === 'departamentos' ? teamsView() : criteriaView());
  }

  function customersView() {
    const list = (state.customers || []).filter(c => C.search((c.name || '') + ' ' + (c.email || '') + ' ' + (c.phone || '') + ' ' + (c.status || ''), ui.query));
    const totalCalls = (state.customers || []).reduce((acc, c) => acc + (Number(c.calls) || 0), 0);
    return '<section class="metrics three">' + metric('Clientes Cadastrados', (state.customers || []).length, 'users', 'blue') + metric('Consentimento Ativo', (state.customers || []).filter(c => c.consent).length, 'check', 'green') + metric('Ligações Vinculadas', totalCalls, 'phone', 'indigo') + '</section>' +
      '<section class="panel users-filters"><div class="panel-header"><div><h2>Base de Clientes</h2><p>Cadastre clientes para vincular chamadas e consultar históricos.</p></div><div class="head-actions">' + badge((state.customers || []).length + ' clientes', 'blue') + btn(icon('plus') + ' Adicionar cliente', 'new-customer') + '</div></div><div class="toolbar admin-filter">' + search('Pesquisar cliente por nome, e-mail ou telefone...') + '</div></section>' +
      '<section class="panel users-table">' + table(['Cliente', 'E-mail', 'Telefone', 'Atendente Responsável', 'Situação', 'Ligações', 'Ações'], list.length ? list.map(c => '<tr><td>' + person(c.name, c.consent ? 'Consentimento ativo' : 'Sem consentimento') + '</td><td>' + e(c.email) + '</td><td>' + e(c.phone) + '</td><td>' + e(c.agent || '—') + '</td><td>' + badge(c.status || 'Ativo', (c.status || 'Ativo') === 'Ativo' ? 'green' : c.status === 'Inativo' ? 'neutral' : 'amber') + '</td><td>' + badge((c.calls || 0) + ' ligações', 'blue') + '</td><td><div class="row-actions">' + btn(icon('phone') + ' Ver ligações', 'customer-calls', 'text-btn', c.id) + (isAdmin() ? btn(icon('edit') + ' Editar', 'edit-customer', 'text-btn', c.id) : '') + '</div></td></tr>') : [emptyRow(7, 'Nenhum cliente cadastrado no banco de dados.', isAdmin() ? 'Cadastre um novo cliente pelo botão "Adicionar cliente" acima.' : 'Solicite o cadastro do cliente à administração.')]) + '</section>';
  }

  function customersPage() {
    return head('Clientes', 'Cadastre e consulte clientes e seus históricos de atendimento', (isAdmin() ? btn(icon('plus') + ' Adicionar cliente', 'new-customer') : '') + btn('Atualizar', 'refresh', 'secondary small')) + customersView();
  }

  function exitPage() {
    return '<main class="exit-page" id="main">' + decorations() + '<section class="exit-card"><div class="exit-icon">' + icon('exit') + '</div><h1>Realmente deseja sair?</h1><p>Você será desconectado da SENX e precisará<br>entrar novamente para continuar.</p>' + btn('SAIR', 'logout', 'full') + '<a class="btn secondary full" href="#ligacoes">CANCELAR</a></section></main>';
  }

  function render() {
    if (!authReady) { app.innerHTML = '<main id="main">Carregando plataforma SENX…</main>'; return; }
    if (!session) { document.title = 'SENX 1.0.0.0 — ' + (setupRequired ? 'Primeiro acesso' : 'Login'); app.innerHTML = auth(setupRequired); return; }
    const raw = location.hash.slice(1) || 'ligacoes', [route, sub] = raw.split('/');
    if (lastRoute !== raw) { Object.assign(ui, { page: 1, query: '', team: '', status: '', date: '', analysis: '', topic: '', profile: '' }); closeModal(); lastRoute = raw; }
    ui.adminTab = ['usuarios', 'clientes', 'departamentos', 'criterios'].includes(sub) ? sub : 'usuarios';

    if (route === 'login' || route === 'cadastro') { location.hash = 'ligacoes'; return; }
    else if (route === 'saida') app.innerHTML = exitPage();
    else {
      const pages = { ligacoes: callsPage, clientes: customersPage, resumos: summariesPage, relatorios: reportsPage, rankings: rankingsPage, configuracoes: settingsPage, administracao: adminPage };
      if (!pages[route]) { location.hash = 'ligacoes'; return; }
      app.innerHTML = shell(pages[route](), route);
    }
    document.title = 'SENX 1.0.0.0 — ' + (route === 'administracao' ? ui.adminTab : route);
    app.dataset.route = raw;
  }

  function closeModal() {
    const dialog = document.querySelector('#modal-root dialog');
    if (dialog) { dialog.close(); dialog.remove(); if (lastFocus?.isConnected) lastFocus.focus(); }
  }

  function modal(title, subtitle, content, formId = '') {
    closeModal(); lastFocus = document.activeElement;
    const save = title.startsWith('Editar') ? 'Salvar alterações' : 'Salvar';
    document.querySelector('#modal-root').innerHTML = '<dialog class="dialog-' + formId + '" aria-labelledby="dialog-title">' + (formId ? '<form id="' + formId + '">' : '') + '<header class="modal-head"><div><h2 id="dialog-title">' + e(title) + '</h2><p>' + e(subtitle) + '</p></div></header><div class="modal-body">' + content + '<p class="form-error" role="alert"></p></div><footer class="modal-footer">' + btn(formId ? 'Cancelar' : 'Fechar', 'close', 'secondary') + (formId ? '<button type="submit" class="btn">' + save + '</button>' : '') + '</footer>' + (formId ? '</form>' : '') + '</dialog>';
    document.querySelector('#modal-root dialog').showModal();
    document.querySelector('#modal-root input:not([type=hidden])')?.focus();
  }

  function teamModal(id) {
    const t = state.teams.find(t => t.id === id) || { name: '', department: '' };
    modal(id ? 'Editar departamento' : 'Adicionar departamento', 'Defina o nome e a equipe vinculada ao departamento.', '<input type="hidden" name="id" value="' + e(id || '') + '">' + input('department', 'Nome do departamento', t.department) + input('name', 'Nome da equipe', t.name) +
      '<div class="form-field"><label>Liderança responsável</label><input name="leader" value="Não definida" readonly></div>' +
      note('Departamentos e Equipes', 'As equipes agrupam colaboradores e suas respectivas análises de chamadas.'), 'team-form');
  }

  function criterionModal(id) {
    const c = state.criteria.find(c => c.id === id) || { name: '', description: '', rule: '', version: '1.0', active: true };
    const textarea = (name, label, value) => '<div class="form-field"><label for="field-' + name + '">' + label + ' *</label><textarea id="field-' + name + '" name="' + name + '" maxlength="255" rows="3" required>' + e(value) + '</textarea></div>';
    modal(id ? 'Editar critério' : 'Adicionar critério', 'Catálogo de Qualidade CTI • ' + (c.name || 'Novo critério'), '<input type="hidden" name="id" value="' + e(id || '') + '"><div class="criterion-status">' + badge('Critério de Análise CTI', 'amber') + '<label class="switch-label"><input type="checkbox" role="switch" name="active" ' + (c.active ? 'checked' : '') + '>Ativo</label></div>' +
      input('name', 'Nome do critério', c.name) + textarea('description', 'Descrição do critério', c.description) + textarea('rule', 'Evidências esperadas / Regra de validação', c.rule) + input('version', 'Versão', c.version) +
      note('Validação de Qualidade', 'Regras claras facilitam a auditoria automática e a calibração da supervisão.'), 'criterion-form');
  }

  function userModal() {
    modal('Adicionar colaborador', 'Cadastre um acesso para a análise das gravações do PABX.', input('name', 'Nome completo') + input('email', 'E-mail corporativo', '', 'email') +
      '<div class="form-grid"><div class="form-field"><label for="user-team">Departamento / Equipe *</label><select id="user-team" name="teamId" required>' + state.teams.map(t => '<option value="' + e(t.id) + '">' + e(t.name) + '</option>').join('') + '</select></div><div class="form-field"><label for="user-profile">Perfil de Acesso *</label><select id="user-profile" name="profile"><option>Colaborador</option><option>Administrador</option></select></div></div>' +
      '<div class="form-grid">' + input('job', 'Cargo', 'Atendente') + input('password', 'Senha inicial', '', 'password') + '</div>' +
      '<div class="permissions"><strong>Permissões</strong><p id="permissions-description">Consultar suas próprias ligações, transcrições e perfil.</p></div>', 'user-form');
  }

  function customerModal(id) {
    const c = (state.customers || []).find(x => x.id === id) || { name: '', email: '', phone: '', status: 'Ativo', consent: true, userId: session?.id || '' };
    const statuses = ['Ativo', 'Em acompanhamento', 'Inativo'];
    const users = state.users?.length ? state.users : [{ id: session?.id || '', name: session?.name || 'Administrador' }];
    modal(id ? 'Editar cliente' : 'Adicionar cliente', 'Cadastre ou atualize os dados do cliente para vincular ligações e histórico.',
      '<input type="hidden" name="id" value="' + e(id || '') + '">' +
      '<div class="criterion-status">' + badge('Cadastro de Cliente CTI', 'blue') + '<label class="switch-label"><input type="checkbox" role="switch" name="consent" ' + (c.consent !== false ? 'checked' : '') + '>Consentimento de gravação</label></div>' +
      input('name', 'Nome completo / Empresa', c.name) +
      '<div class="form-grid">' + input('email', 'E-mail de contato', c.email, 'email') +
      '<div class="form-field"><label for="field-phone">Telefone (somente números, até 11 dígitos) *</label><input id="field-phone" name="phone" type="tel" value="' + e(c.phone) + '" maxlength="11" pattern="[0-9]{1,11}" placeholder="Ex: 11999998888" required></div></div>' +
      '<div class="form-grid"><div class="form-field"><label for="customer-status">Situação *</label><select id="customer-status" name="status">' + statuses.map(s => '<option ' + (c.status === s ? 'selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
      '<div class="form-field"><label for="customer-user">Atendente responsável *</label><select id="customer-user" name="userId">' + users.map(u => '<option value="' + e(u.id) + '" ' + (c.userId === u.id ? 'selected' : '') + '>' + e(u.name) + '</option>').join('') + '</select></div></div>' +
      note('Histórico e Busca', 'Após cadastrar o cliente, ele ficará disponível na tela de envio de gravação e na busca de chamadas.'), 'customer-form');
  }

  function reportModal() {
    modal('Novo Relatório Executivo', 'Gere uma análise consolidada de atendimento.',
      input('title', 'Título do relatório', 'Relatório Semanal de Desempenho CTI') +
      '<div class="form-grid"><div class="form-field"><label>Categoria *</label><select name="type"><option>Qualidade</option><option>Retenção</option><option>Desenvolvimento</option><option>Conformidade</option></select></div>' +
      '<div class="form-field"><label>Departamento / Equipe *</label><select name="teamId"><option value="">Todas as equipes</option>' + state.teams.map(t => '<option value="' + e(t.id) + '">' + e(t.name) + '</option>').join('') + '</select></div></div>' +
      '<div class="form-field"><label>Período *</label><select name="period"><option>Últimos 7 dias</option><option>Últimos 30 dias</option><option>Mês atual</option><option>Trimestre atual</option></select></div>' +
      '<div class="form-field"><label>Observações do Supervisor</label><textarea name="summary" rows="3"></textarea></div>',
      'report-form');
  }

  // Tratamento de envio de formulários
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
      const payload = id === 'user-form' ? { name: data.name.trim(), email: data.email.trim(), password: data.password, teamId: data.teamId, job: data.job.trim(), profile: data.profile } : id === 'team-form' ? { name: data.name.trim(), department: data.department.trim() } : id === 'customer-form' ? { name: data.name.trim(), email: data.email.trim(), phone: data.phone.trim(), status: (data.status || 'Ativo').trim(), consent: data.consent === 'on', userId: data.userId || null } : { name: data.name.trim(), description: data.description.trim(), rule: data.rule.trim(), version: data.version.trim(), active: data.active === 'on' };
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
          await request('/api/data/reports', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data, teamId:data.teamId || null})});
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
        Object.assign(ui, { page: 1, query: '', team: '', status: '', date: '', analysis: '', topic: '', profile: '' });
        render();
        break;
      case 'report-tab':
        ui.reportType = id;
        render();
        break;
      case 'ranking-tab':
        ui.rankingTab = id;
        render();
        break;
      case 'call-info': {
        const call = state.calls.find(c => c.id === id);
        if (call) modal('Detalhes da Chamada', 'Registro PABX CTI', '<p><strong>Identificador PABX:</strong> ' + e(call.pabxId || call.id) + '</p><p><strong>Cliente:</strong> ' + e(call.client) + '</p><p><strong>Telefone:</strong> ' + e(call.phone) + '</p><p><strong>Atendente:</strong> ' + e(call.agent) + '</p><p><strong>Equipe:</strong> ' + e(call.team) + '</p><p><strong>Duração:</strong> ' + C.duration(call.seconds) + '</p><p><strong>Pontuação IA:</strong> ' + (call.score ?? 'Pendente') + ' / 100</p>');
        break;
      }
      case 'menu':
        document.querySelector('.layout').classList.toggle('menu-open');
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
      case 'new-user': userModal(); break;
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
      case 'customer-calls': {
        const cust = (state.customers || []).find(c => c.id === id);
        if (cust) {
          Object.assign(ui, { page: 1, query: cust.name, team: '', status: '', date: '', analysis: '', topic: '', profile: '' });
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
      case 'new-report':
        reportModal();
        break;
      case 'view-report': {
        const rep = state.reports.find(r => r.id === id);
        if (rep) {
          modal(rep.title, rep.type + ' • ' + rep.period,
            '<div class="report-meta"><span><strong>Equipe:</strong> ' + e(rep.team) + '</span><span><strong>Status:</strong> ' + e(rep.status) + '</span><span><strong>Pontuação:</strong> ' + e(rep.score) + '</span></div>' +
            '<div style="margin-top:16px;"><h3>Resumo Executivo</h3><p class="stored-text">' + e(rep.summary) + '</p></div>' +
            '<p>Média descritiva das notas existentes. Nenhuma recomendação automática foi gerada.</p>');
        }
        break;
      }
      case 'export-report': {
        const rep = state.reports.find(r => r.id === id);
        if (rep) {
          download('SENX-Relatorio-' + rep.id + '.txt', 'SENX CTI — ' + rep.title + '\r\nTipo: ' + rep.type + '\r\nPeriodo: ' + rep.period + '\r\nEquipe: ' + rep.team + '\r\nPontuacao: ' + rep.score + '\r\n\r\nRESUMO:\r\n' + rep.summary);
          toast('Relatório baixado com sucesso!');
        }
        break;
      }
      case 'export-calls':
        download('SENX-ligacoes.csv', C.toCsv([['ID', 'Contato', 'Telefone', 'Atendente', 'Equipe', 'Data', 'Duração', 'Pontuação', 'Assunto', 'Status'], ...filteredCalls().map(c => [c.pabxId || c.id, c.client, c.phone, c.agent, c.team, c.date, C.duration(c.seconds), c.score ?? '—', c.topic || '—', c.status])]), 'text/csv;charset=utf-8');
        toast('Lista de ligações exportada em CSV.');
        break;
      case 'export-ranking': {
        const list = state.rankings || [];
        download('SENX-ranking-' + ui.rankingTab + '.csv', C.toCsv([['Posição', 'Nome', 'Departamento', 'Ligações', 'Nota Qualidade', 'FCR', 'TMA', 'Variação'], ...list.map(i => [i.position + 'º', i.name, i.team, i.calls, i.score, i.fcr, i.tma, i.trend])]), 'text/csv;charset=utf-8');
        toast('Ranking exportado em CSV.');
        break;
      }
    }
  });

  document.addEventListener('change', event => {
    const t = event.target;
    if (t.name === 'profile') {
      const description = document.querySelector('#permissions-description');
      if (description) description.textContent = t.value === 'Administrador' ? 'Gerenciar colaboradores, departamentos e critérios; consultar todos os registros.' : 'Consultar suas próprias ligações, transcrições e perfil.';
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

  window.addEventListener('hashchange', () => {
    clearTimeout(filterTimer);
    stopAudio();
    render();
    window.scrollTo(0, 0);
  });

  render();
  startSession();
})();
