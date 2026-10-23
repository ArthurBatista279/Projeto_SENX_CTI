/* SENX v0.1 — demonstração local. Integrações reais serão adicionadas na v0.2. */
(() => {
  'use strict';
  const C = window.SenxCore, D = window.SenxData, e = C.escapeHtml;
  const KEY = 'senx-cti-demo-v01';
  let storageAvailable = true;
  function load() {
    try { const saved = JSON.parse(localStorage.getItem(KEY)); return saved?.version === 1 ? saved : null; }
    catch { storageAvailable = false; return null; }
  }
  const state = load() || { version: 1, users: structuredClone(D.users), departments: structuredClone(D.departments), criteria: structuredClone(D.criteria), profile: { ...D.profile }, reports: structuredClone(D.reports), imported: [], reviews: [] };
  state.criteriaByDepartment ||= {};
  const ui = { page: 1, query: '', team: '', status: '', date: '', type: '', selected: D.calls[0].id, detailTab: 'resumo', rankingTab: 'atendentes', adminTab: 'usuarios', lastRoute: 'ligacoes' };
  let currentRoute = '', toastTimer, lastFocus, audioUrl;
  const app = document.querySelector('#app');
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
    users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 3a4 4 0 0 1 0 8M20 21v-3a7 7 0 0 0-3-6"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
  const brand = () => '<div class="brand"><img src="assets/senx-symbol.png" alt=""><img src="assets/senx-wordmark.png" alt="SENX"></div>';
  const avatar = (name, i = 0) => `<span class="avatar ${['','pink','mint'][i % 3]}">${e(C.initials(name))}</span>`;
  const person = (name, subtitle = '', i = 0) => `<div class="person">${avatar(name, i)}<div><strong>${e(name)}</strong>${subtitle ? `<small>${e(subtitle)}</small>` : ''}</div></div>`;
  const badge = text => {
    const color = /Conclu|Ativo|Validado/.test(text) ? 'green' : /Aguard|revis|Agendad/.test(text) ? 'amber' : /cancel|Cancel/.test(text) ? 'red' : /análise|andamento|Retenção/.test(text) ? 'purple' : /Qualidade|Consulta|Liderança/.test(text) ? 'blue' : '';
    return `<span class="badge ${color}">${e(text)}</span>`;
  };
  const notice = (title, text, info = false, action = '') => `<div class="banner ${info ? 'info' : ''}">${icon(info ? 'admin' : 'alert')}<div><strong>${title}</strong><small>${text}</small></div>${action}</div>`;
  const button = (text, action, style = '', name = '') => `<button type="button" class="btn ${style}" data-action="${action}">${name ? icon(name) : ''}${text}</button>`;
  const actionIcon = (name, action, label, id = '') => `${action==='report-detail'?`<button type="button" class="icon-btn" disabled title="Ação do triângulo pendente de validação" aria-label="Ação do triângulo pendente de validação">${icon('play')}</button>`:''}<button type="button" class="icon-btn" data-action="${action}" data-id="${e(id)}" title="${e(label)}" aria-label="${e(label)}">${icon(name)}</button>`;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { storageAvailable = false; toast('Este navegador não permite salvar. Os testes continuam nesta sessão.'); } }
  function toast(message) { const box = document.querySelector('#toast'); box.textContent = message; box.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('visible'), 4500); }
  function download(filename, content, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  const allCalls = () => [...state.imported, ...D.calls];
  const currentCall = () => allCalls().find(c => c.id === ui.selected) || D.calls[0];
  const criteriaDepartment = () => state.departments.find(d => d.name === ui.team) || state.departments[0];
  function criteriaFor(department = criteriaDepartment()) {
    state.criteriaByDepartment[department.id] ||= D.criteria.map((c, index) => ({ ...c, active: index < department.criteria }));
    return state.criteriaByDepartment[department.id];
  }
  const selectedAttr = (value, expected) => value === expected ? ' selected' : '';
  const option = (value, label, selected = '') => `<option value="${e(value)}"${selectedAttr(value, selected)}>${e(label)}</option>`;
  const select = (name, label, values, placeholder, selected = '') => `<label class="field-control"><span>${label}</span><select data-filter="${name}" aria-label="${label}">${option('', placeholder, selected)}${values.map(v => option(v, v, selected)).join('')}</select></label>`;
  const searchField = (placeholder = 'Pesquisar por nome, telefone ou ID') => `<label class="field-control search"><span class="sr-only">Pesquisar</span><div class="input-icon">${icon('search')}<input type="search" data-filter="query" value="${e(ui.query)}" placeholder="${placeholder}" aria-label="${placeholder}"></div></label>`;
  const metric = (label, value, name, color = '', note = '') => `<article class="metric"><span class="metric-icon ${color}">${icon(name)}</span><div><label>${label}</label><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div></article>`;
  function pagination(result, size = 8) {
    return `<div class="pagination"><span>${result.total ? `Mostrando ${(result.page - 1) * size + 1}–${Math.min(result.page * size, result.total)} de ${result.total}` : 'Nenhum resultado'}</span><div class="pages"><button data-page="${result.page - 1}" ${result.page <= 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>${Array.from({length: result.pages}, (_, i) => `<button data-page="${i+1}" class="${result.page === i+1 ? 'selected' : ''}" ${result.page === i+1 ? 'aria-current="page"' : ''}>${i+1}</button>`).join('')}<button data-page="${result.page + 1}" ${result.page >= result.pages ? 'disabled' : ''} aria-label="Próxima página">›</button></div></div>`;
  }
  const empty = (text = 'Nenhum registro encontrado.') => `<div class="empty-state"><strong>${text}</strong><p>Experimente limpar ou alterar os filtros.</p></div>`;
  function head(title, subtitle, actions = '') {
    return `<header class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="head-actions"><span class="demo-tag">Versão 0.1 · Dados demonstrativos</span>${actions}</div></header>`;
  }
  function shell(content, active) {
    const nav = [['ligacoes','Ligações','phone'],['relatorios','Relatórios','report'],['resumos','Resumos','summary'],['rankings','Rankings','ranking'],['configuracoes','Configurações','settings'],['administracao','Administração','admin']];
    return `<div class="layout"><div class="mobile-bar">${button('', 'menu', 'secondary small', 'menu')}<strong>SENX</strong><span class="badge blue">v0.1</span></div><aside class="sidebar"><a href="#ligacoes" aria-label="SENX — Ligações">${brand()}</a><nav class="nav-list" aria-label="Menu principal">${nav.map(([route,label,name]) => `<a class="nav-link ${active === route ? 'active' : ''}" href="#${route}" ${active === route ? 'aria-current="page"' : ''}>${icon(name)}${label}</a>`).join('')}</nav><div class="sidebar-bottom">${person(state.profile.name, state.profile.job)}<div class="sidebar-note"><strong>LGPD · Acesso restrito</strong>Gravações protegidas conforme política de privacidade.</div></div></aside><main id="main" class="content" tabindex="-1">${content}<footer class="review-bar"><span>SENX v0.1 · Ambiente de demonstração ${storageAvailable ? '· Dados locais neste navegador' : '· Armazenamento indisponível'}</span><div class="links"><a href="#telas">Todas as telas</a><button class="text-btn" data-action="feedback">${icon('edit')}Relatar problema</button><button class="text-btn" data-action="reset">Restaurar demonstração</button></div></footer></main></div>`;
  }
  const decor = () => '<i class="decoration diamond one"></i><i class="decoration diamond two"></i><i class="decoration sphere one"></i><i class="decoration sphere two"></i>';
  function passwordField(name, label, placeholder, autocomplete = 'current-password') {
    return `<div class="form-field"><label for="${name}">${label}</label><div class="password-wrap"><input id="${name}" name="${name}" type="password" placeholder="${placeholder}" autocomplete="${autocomplete}" required minlength="6"><button type="button" data-action="password" data-id="${name}" aria-label="Mostrar ${label.toLowerCase()}" aria-pressed="false">${icon('eye')}</button></div></div>`;
  }
  function auth(register = false) {
    return `<div class="auth"><section class="auth-story">${decor()}<div><h1>${register ? 'Crie sua conta e<br>comece a transformar<br>seus dados ↗' : 'Transforme sua rotina<br>complicada em uma<br>experiência mais<br>simples ↗'}</h1><p>A SENX é uma plataforma avançada de análise de dados impulsionada por IA, projetada para transformar a maneira como as empresas compreendem e aproveitam seus dados.</p></div></section><main id="main" class="auth-panel"><div class="auth-card">${brand()}<h2>${register ? 'Crie sua conta' : 'Bem-vindo de volta!'}</h2><p>${register ? 'Preencha os campos abaixo para se cadastrar' : 'Acesse a plataforma de análise de ligações'}</p><form id="${register ? 'register' : 'login'}-form">${register ? '<div class="form-field"><label for="full-name">Nome completo</label><input id="full-name" name="name" placeholder="Seu nome completo" autocomplete="name" required minlength="3"></div>' : ''}<div class="form-field"><label for="email">E-mail</label><input id="email" name="email" type="email" placeholder="seu@email.com" autocomplete="email" required></div>${passwordField('password','Senha',register ? 'Crie uma senha (mínimo 6 caracteres)' : 'Sua senha',register ? 'new-password' : 'current-password')}${register ? passwordField('confirm-password','Confirmar senha','Confirme sua senha','new-password') + '<label class="consent"><input name="consent" type="checkbox" required><span>Concordo com os <button class="text-btn" type="button" data-action="terms">Termos de Uso e a Política de Privacidade</button></span></label>' : '<div class="auth-help"><label><input type="checkbox" name="remember">Lembre-me</label><button type="button" class="text-btn" data-action="recover">Esqueceu a senha?</button></div>'}<p id="auth-error" class="form-error" role="alert"></p><button class="btn full" type="submit">${register ? 'Criar conta' : 'Login'}</button></form><div class="auth-footer">${register ? 'Já tem uma conta? <a href="#login">Faça login</a>' : '<a href="#cadastro">Crie uma conta</a>'}</div><div class="demo-login"><button type="button" class="text-btn" data-action="enter-demo">Explorar demonstração ${icon('chevron')}</button><small>v0.1 · Use dados fictícios. Autenticação real na v0.2.</small></div></div></main><span class="auth-version">SENX · Revisão das telas · 0.1</span></div>`;
  }
  function callRows(calls) {
    return calls.map((c, i) => `<tr class="${c.topic === 'Cancelamento' ? 'row-alert' : ''}"><td>${person(c.client, c.team, i)}</td><td>${e(c.phone)}</td><td>${C.formatDate(c.date)} ${e(c.time)}</td><td>${C.duration(c.seconds)}</td><td><span class="sentiment ${c.sentiment === 'Insatisfeito' ? 'red' : c.sentiment === 'Satisfeito' ? 'green' : c.sentiment === 'Em análise' ? 'amber' : ''}">${e(c.sentiment)}</span></td><td>${badge(c.topic)}</td><td>${badge(c.status)}</td><td><div class="row-actions">${actionIcon('eye','call-detail',`Ver ligação de ${c.client}`,c.id)}${actionIcon('more','call-info',`Metadados de ${c.id}`,c.id)}</div></td></tr>`).join('');
  }
  function callsPage() {
    const calls = C.filterCalls(allCalls(), ui), result = C.paginate(calls, ui.page);
    return head('Análise de Ligações','Triagem das gravações PABX · Dados demonstrativos · Indícios de IA sujeitos à validação',button('Importar gravação','import','secondary','upload')) +
      notice('3 ligações com indício de cancelamento aguardam validação humana','Classificações de risco geradas por IA. Revise evidências antes de agir — sentimento não é conclusão definitiva.',false,button('Revisar agora','review-call','small')) +
      `<section class="metrics">${metric('Total de ligações', '248','phone')}${metric('Analisadas (IA)','183','report','purple')}${metric('Ligações críticas','11','alert','red')}${metric('Satisfação estimada','68%','check','green')}${metric('Duração média','04:37','clock','purple')}</section>` +
      `<section class="panel"><div class="toolbar">${searchField()}${select('team','Equipe',D.departments.map(d=>d.name),'Todas as equipes',ui.team)}${select('status','Status de análise',['Aguardando revisão','Concluída','Em análise','Não analisado'],'Todos os status',ui.status)}<label class="field-control"><span>Data da ligação</span><input type="date" data-filter="date" value="${e(ui.date)}" aria-label="Data da ligação"></label>${button('Exportar','export-calls','','download')}</div><div class="filter-info"><span>${calls.length} ligações no recorte demonstrativo</span><button class="text-btn" data-action="clear-filters">Limpar filtros</button></div>${calls.length ? `<div class="table-wrap"><table><thead><tr><th>Contato</th><th>Telefone</th><th>Data / hora</th><th>Duração</th><th>Indício (IA)</th><th>Assunto / motivo</th><th>Análise</th><th>Ações</th></tr></thead><tbody>${callRows(result.items)}</tbody></table></div>` : empty()}<div class="legend"><span>🔴 Atenção crítica requer revisão humana</span><span>${badge('Cancelamento')} Indício — evidências disponíveis</span><span>Sentimento estimado: sujeito à validação</span></div>${pagination(result)}</section>`;
  }
  function summaryContent(call, tab) {
    if (call.status === 'Não analisado' && !call.summary) return empty('Gravação adicionada apenas à demonstração local. Nenhuma análise foi executada.');
    if (tab === 'transcricao') return `<div>${(call.transcript || []).map(s => `<article class="speech"><strong>${e(s.speaker)}</strong><time>${e(s.time)}</time><p>${e(s.text)}</p></article>`).join('') || empty('Transcrição ainda indisponível.')}</div>`;
    if (tab === 'audio') return `<div class="audio-box">${icon('phone')}<h3>Ouvir gravação local</h3><p>Os exemplos não incluem áudio. Selecione uma gravação para testar o player no seu navegador.</p><label class="btn secondary" for="audio-file">${icon('upload')}Selecionar áudio</label><input id="audio-file" type="file" accept="audio/*,video/mp4" hidden><audio id="audio-player" controls hidden></audio><p class="tiny muted">O arquivo permanece no seu dispositivo.</p></div>`;
    return `<div class="chips" style="margin:0 0 18px">${badge(`Assunto: ${call.topic}`)}${badge('Gerado por IA · Não validado')}</div><section><h3>Necessidade relatada</h3><p>${e(call.summary)}</p></section><section><h3>Encaminhamento</h3><p>${e(call.nextStep || 'Aguardando análise.')}</p></section><section><h3>Compromissos e próximos passos</h3><div class="commitments"><label><input type="checkbox" disabled>Conferir a cobrança e avaliar o estorno.</label><label><input type="checkbox" disabled>Retornar ao cliente com uma posição da análise.</label></div><p class="tiny muted" style="margin-top:7px">Itens extraídos para conferência. Comportamento de conclusão pendente de validação.</p></section>${call.topic === 'Cancelamento' ? `<div class="quote"><h3>${icon('alert')} Possível intenção de cancelamento ${badge('Não confirmado')}</h3><blockquote>“Se essa cobrança não for resolvida, vou cancelar o serviço.”</blockquote><p>Cliente · trecho ilustrativo 00:42. Apenas indício de insatisfação; valide contexto e áudio antes de agir.</p><button class="text-btn" data-action="transcript-tab">Ver trecho da transcrição ${icon('chevron')}</button></div>` : ''}<section><h3>Critérios de atendimento</h3><p class="tiny muted">Clareza · Cordialidade · Conformidade com procedimentos · Compromissos assumidos</p></section>`;
  }
  function summariesPage() {
    const calls = C.filterCalls(allCalls(), ui), call = currentCall();
    return head('Resumos das Ligações','Consulte necessidades, encaminhamentos e próximos passos · Dados demonstrativos') + notice('Resumos e indícios de IA sujeitos à validação humana','Sentimento não é conclusão definitiva. Confira as evidências e a transcrição antes de agir.') +
      `<section class="panel"><div class="toolbar">${searchField('Contato, trecho do resumo ou ID da ligação')}${select('team','Equipe',D.departments.map(d=>d.name),'Todas as equipes',ui.team)}${select('status','Análise / revisão',['Aguardando revisão','Concluída','Em análise','Não analisado'],'Todos os estados',ui.status)}</div><div class="filter-info"><span>${calls.length} ligações no recorte · Demonstração local</span><button class="text-btn" data-action="clear-filters">Limpar filtros</button></div></section><div class="summary-layout"><section class="panel"><div class="panel-header"><h3>Ligações no período</h3>${badge(String(calls.length))}</div><div class="call-list">${calls.map(c=>`<button class="call-option ${c.id===call.id?'active':''}" data-action="select-call" data-id="${e(c.id)}"><span class="call-option-top"><strong>${e(c.client)}</strong><small>${C.formatDate(c.date)}</small></span><p>${e((c.summary || 'Gravação ainda não analisada.').slice(0,105))}</p><span class="call-option-top"><small>${e(c.team)} · ${e(c.topic)}</small>${badge(c.status)}</span></button>`).join('') || empty()}</div></section><section class="panel"><div class="detail-title"><div><h2>${e(call.client)} <small class="muted">${e(call.id)}</small></h2>${badge(call.status)}</div><div class="detail-meta"><span>${C.formatDate(call.date)} · ${e(call.time)}</span><span>${e(call.phone)}</span><span>Equipe: ${e(call.team)}</span><span>Colaborador: ${e(call.agent)}</span></div></div><div class="tabs compact" role="tablist" aria-label="Conteúdo da ligação">${[['resumo','Resumo','summary'],['transcricao','Transcrição','report'],['audio','Ouvir ligação','play']].map(([id,label,name])=>`<button role="tab" aria-selected="${ui.detailTab===id}" class="tab ${ui.detailTab===id?'active':''}" data-detail-tab="${id}">${icon(name)} ${label}</button>`).join('')}</div><div class="detail-body" role="tabpanel">${summaryContent(call,ui.detailTab)}</div><div class="detail-footer"><span class="muted">Revisão humana pendente · Demonstração</span>${button('Revisar classificação','review-classification','secondary small')}${button('Validar resumo','validate-summary','small','check')}</div></section></div>`;
  }
  const filteredReports = () => state.reports.filter(r => C.search(r.title,ui.query) && (!ui.type || r.type===ui.type) && (!ui.team || r.team===ui.team) && (!ui.status || r.status===ui.status));
  function reportsPage() {
    const reports = filteredReports(), result = C.paginate(reports,ui.page,6);
    return head('Relatórios','Relatórios de qualidade, retenção e desenvolvimento · Ligações PABX') + notice('2 relatórios aguardam validação humana antes da publicação','Métricas de sentimento e risco são estimativas da IA — confirme as evidências antes de compartilhar.',false,button('Revisar agora','review-reports','small')) +
      `<section class="metrics">${metric('Relatórios gerados','36','report')}${metric('Agendados','5','clock','purple')}${metric('Ligações críticas','11','alert','red')}${metric('Satisfação estimada','68%','check','green')}${metric('Falhas recorrentes','4','info','purple')}</section><div class="tabs">${['','Qualidade','Retenção','Desenvolvimento','Conformidade'].map(type=>`<button class="tab ${ui.type===type?'active':''}" data-report-type="${type}">${type||'Todos'}</button>`).join('')}</div><section class="panel"><div class="toolbar">${searchField('Pesquisar pelo nome do relatório')}${select('team','Equipe / departamento',[...D.departments.map(d=>d.name),'Todos'],'Todas as equipes',ui.team)}${select('status','Status',['Concluído','Aguardando revisão','Em andamento','Agendado'],'Todos os status',ui.status)}${button('Novo relatório','new-report','','plus')}</div><div class="filter-info"><span>${reports.length} relatórios demonstrativos</span><button class="text-btn" data-action="clear-filters">Limpar filtros</button></div>${reports.length ? `<div class="table-wrap"><table><thead><tr><th>Relatório</th><th>Tipo</th><th>Equipe</th><th>Critérios aplicados</th><th>Período</th><th>Status</th><th>Ações</th></tr></thead><tbody>${result.items.map(r=>`<tr><td class="row-main">${e(r.title)}<small>Dados fictícios · revisão humana</small></td><td>${badge(r.type)}</td><td>${e(r.team)}</td><td>${badge('Critérios do departamento')}<small>Clareza · contexto · evidências</small></td><td>${e(r.period)}</td><td>${badge(r.status)}</td><td><div class="row-actions">${actionIcon('eye','report-detail','Visualizar relatório',r.id)}${actionIcon('download','report-download','Baixar relatório demonstrativo',r.id)}</div></td></tr>`).join('')}</tbody></table></div>`:empty()}${pagination(result,6)}</section><div class="split-notes"><article class="note"><h3>Critérios de análise</h3><p>Configurados por liderança, de acordo com as necessidades de cada departamento.</p><div class="chips">${['Assunto','Clareza e cordialidade','Procedimentos internos','Compromissos'].map(badge).join('')}</div></article><article class="note blue"><h3>Pontos de atenção</h3><p>A análise não determina uma conclusão definitiva. Alertas sensíveis precisam de contexto, evidências e revisão humana. Considere também a qualidade das gravações e a proteção de dados.</p></article></div>`;
  }
  function rankingsPage() {
    const rankings=D.rankings.filter(r=>C.search(r.name,ui.query)&&(!ui.team||r.team===ui.team));
    return head('Rankings de Desempenho','Compare resultados de atendentes e equipes · Dados demonstrativos',button('Exportar','export-rankings','secondary','download'))+
      `<section class="panel"><div class="toolbar">${searchField('Nome ou ramal do atendente')}${select('team','Equipe',D.departments.map(d=>d.name),'Todas as equipes',ui.team)}<label class="field-control"><span>Período de exemplo</span><select aria-label="Período de exemplo" disabled><option>17 a 23/10/2026</option></select></label><label class="field-control"><span>Classificar por</span><select aria-label="Ordenação ilustrativa" disabled><option>Nota de qualidade</option></select></label></div><div class="filter-info"><span>24 atendentes · 3 equipes · Regra de amostra mínima pendente de validação</span><button class="text-btn" data-action="clear-filters">Limpar filtros</button></div></section>`+
      `<section class="metrics four">${metric('Ligações avaliadas','1.248','phone','','Dados ilustrativos')}${metric('Nota média de qualidade','88,6','check','','Exemplo de apresentação')}${metric('Resolução no primeiro contato','84,2%','report','','Métrica sujeita à validação')}${metric('Atendentes no ranking','24','users','','3 equipes no exemplo')}</section>`+
      `<section class="panel"><div class="panel-header"><div class="tabs" style="margin:0"><strong>Classificação geral</strong><button class="tab ${ui.rankingTab==='atendentes'?'active':''}" data-ranking-tab="atendentes">Atendentes</button><button class="tab ${ui.rankingTab==='equipes'?'active':''}" data-ranking-tab="equipes">Equipes</button></div><span class="tiny muted">Qualidade: 0–100 · Maior nota primeiro</span></div><div class="table-wrap">${ui.rankingTab==='equipes'?teamRankingTable():`<table><thead><tr><th>Posição</th><th>Atendente</th><th>Equipe</th><th>Ligações</th><th>Qualidade ↓</th><th>Resolução</th><th>TMA</th><th>Detalhes</th></tr></thead><tbody>${rankings.map(r=>{const pos=D.rankings.indexOf(r)+1;return `<tr><td><span class="position ${pos<=3?'top':''}">${String(pos).padStart(2,'0')}</span></td><td class="row-main">${e(r.name)}<small>Ramal ${200+pos}</small></td><td>${e(r.team)}</td><td>${r.calls}</td><td class="ranking-score"><strong>${r.quality.toFixed(1).replace('.',',')}</strong><div class="score-bar"><i style="width:${r.quality}%"></i></div></td><td>${r.resolution.toFixed(1).replace('.',',')}%</td><td>${r.average}</td><td><button class="text-btn" data-action="agent-calls" data-id="${e(r.name)}">Ligações ${icon('chevron')}</button></td></tr>`}).join('')}</tbody></table>`}</div>${!rankings.length&&ui.rankingTab==='atendentes'?empty():''}</section>`+
      notice('Ranking ilustrativo: regras de negócio ainda não aplicadas','A elegibilidade com menos de 20 ligações e a fórmula de pontuação precisam de confirmação do responsável pelo produto.',true);
  }
  function teamRankingTable() {
    return `<table><thead><tr><th>Equipe</th><th>Atendentes</th><th>Qualidade</th><th>Ligações</th><th>Resolução</th></tr></thead><tbody>${[['Atendimento',10,'90,8',526,'87,1%'],['Comercial',7,'88,2',378,'83,6%'],['Suporte',7,'85,7',344,'80,4%']].filter(r=>!ui.team||r[0]===ui.team).map(r=>`<tr>${r.map((v,i)=>`<td${i===0?' class="row-main"':''}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function settingsPage() {
    const p=state.profile;
    return head('Configurações','Gerencie suas informações de perfil neste ambiente de demonstração')+`<section class="panel profile-card">${avatar(p.name)}<div><h2>${e(p.name)}</h2><p>${e(p.job)}</p><a class="btn small" href="#saida">Sair</a></div></section><section class="panel"><form id="profile-form" class="profile-form"><h2>Informações de perfil</h2><div class="form-grid"><div class="form-field"><label for="profile-email">E-mail</label><input id="profile-email" name="email" type="email" required value="${e(p.email)}"></div><div class="form-field"><label for="profile-name">Nome</label><input id="profile-name" name="name" minlength="3" required value="${e(p.name)}"></div><div class="form-field"><label for="profile-password">Senha</label><input id="profile-password" type="password" value="demonstracao" disabled><small>Alteração de senha disponível após a integração de autenticação.</small></div><div class="form-field"><label for="profile-team">Departamento</label><select id="profile-team" name="team">${state.departments.map(d=>option(d.name,d.name,p.team)).join('')}</select></div><div class="form-field"><label for="profile-job">Cargo</label><input id="profile-job" name="job" required value="${e(p.job)}"></div></div><div class="form-actions"><button type="reset" class="btn secondary">Descartar alterações</button><button type="submit" class="btn">Salvar</button></div></form></section>`;
  }
  function adminPage() {
    const tabs=[['usuarios','Colaboradores e acessos'],['departamentos','Departamentos'],['criterios','Critérios de análise']];
    return head('Administração','Gerencie acessos, departamentos e critérios de análise das ligações.')+`<div class="tabs">${tabs.map(([id,label])=>`<a class="tab ${ui.adminTab===id?'active':''}" href="#administracao/${id}">${label}</a>`).join('')}</div>`+(ui.adminTab==='usuarios'?usersView():ui.adminTab==='departamentos'?departmentsView():criteriaView());
  }
  function usersView() {
    const users=state.users.filter(u=>C.search(`${u.name} ${u.email}`,ui.query)&&(!ui.team||u.team===ui.team)&&(!ui.status||u.status===ui.status));
    return `<section class="panel"><div class="panel-header"><h2>Colaboradores e acessos</h2>${badge(`${users.length} usuários`)}</div><div class="toolbar admin-filter">${searchField('Pesquisar por nome ou e-mail')}${select('team','Departamento',state.departments.map(d=>d.name),'Todos os departamentos',ui.team)}${select('status','Status',['Ativo','Inativo'],'Todos os status',ui.status)}${button('Adicionar usuário','add-user','ghost','plus')}</div><div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Departamento</th><th>Perfil de acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody>${users.map(u=>`<tr><td>${person(u.name,u.role)}</td><td>${e(u.email)}</td><td>${e(u.team)}</td><td>${badge(u.role)}<small>Permissões ilustrativas</small></td><td>${badge(u.status)}</td><td><div class="row-actions">${actionIcon('edit','edit-user',`Editar ${u.name}`,u.id)}${actionIcon('more','user-options',`Opções de ${u.name}`,u.id)}</div></td></tr>`).join('')}</tbody></table></div>${!users.length?empty():''}<div class="filter-info"><span>Cadastros de demonstração · Alterações locais</span><button class="text-btn" data-action="clear-filters">Limpar filtros</button></div></section>`;
  }
  function departmentsView() {
    return `<section class="metrics three">${metric('Departamentos cadastrados',state.departments.length,'building')}${metric('Colaboradores ativos',state.users.filter(u=>u.status==='Ativo').length,'users')}${metric('Lideranças responsáveis',state.departments.length,'admin')}</section><section class="panel"><div class="panel-header"><div><h2>Departamentos</h2><p>Organize os acessos e os critérios de análise de cada equipe.</p></div>${button('Adicionar departamento','add-department','','plus')}</div><div class="table-wrap"><table><thead><tr><th>Departamento</th><th>Liderança responsável</th><th>Colaboradores</th><th>Critérios ativos</th><th>Ações</th></tr></thead><tbody>${state.departments.map(d=>`<tr><td class="row-main">${e(d.name)}<small>${e(d.description)}</small></td><td>${person(d.leader)}</td><td>${state.users.filter(u=>u.team===d.name).length} colaboradores</td><td>${badge(`${d.criteria} ativos`)}</td><td><button class="text-btn" data-action="edit-department" data-id="${e(d.id)}">${icon('edit')}Editar</button></td></tr>`).join('')}</tbody></table></div><div class="filter-info">${state.departments.length} departamentos · Dados demonstrativos</div></section>`+notice('Critérios e acessos limitados ao departamento','As lideranças consultam gravações, revisam análises e configuram critérios apenas de sua equipe. Matriz de acesso real pendente.',true)+`<article class="note"><h3>Uma configuração para cada contexto de atendimento</h3><div class="split-notes" style="margin-top:10px"><div><strong>Liderança responsável</strong><p>Acompanha a revisão humana e o contexto dos indícios.</p></div><div><strong>Colaboradores vinculados</strong><p>Os acessos ainda são demonstrativos nesta versão.</p></div></div></article>`;
  }
  function criteriaView() {
    state.criteria = criteriaFor();
    return `<section class="panel pad"><label class="field-control" style="max-width:300px"><span>Departamento</span><select data-filter="team" aria-label="Departamento dos critérios">${state.departments.map(d=>option(d.name,d.name,ui.team||'Atendimento')).join('')}</select></label><p class="tiny muted" style="margin-top:10px">Prévia de configuração por equipe. Campos e estados são locais nesta versão.</p></section>`+notice('Classificações sensíveis exigem evidências e revisão humana obrigatória','Exija evidência textual da gravação/transcrição, com marcação de tempo. Sentimento é estimativa da IA; tom de voz não confirma conclusão.')+`<section class="panel"><div class="table-wrap"><table class="criteria-table"><thead><tr><th>Critério</th><th>Descrição</th><th>Evidência esperada</th><th>Estado</th><th>Ação</th></tr></thead><tbody>${state.criteria.map(c=>`<tr><td>${e(c.name)}${/cancelamento|Satisfação/.test(c.name)?'<small style="color:#b45309">Sensível · revisão obrigatória</small>':''}</td><td>${e(c.description)}</td><td>${e(c.evidence)}</td><td><span class="switch-label"><button class="switch ${c.active?'on':''}" data-action="toggle-criterion" data-id="${e(c.id)}" role="switch" aria-checked="${c.active}" aria-label="${e(c.name)} ativo"></button>${c.active?'Ativo':'Inativo'}</span></td><td><button class="text-btn" data-action="edit-criterion" data-id="${e(c.id)}">${icon('edit')}Editar</button></td></tr>`).join('')}</tbody></table></div></section><div class="form-actions">${button('Descartar alterações','discard-criteria','secondary')}${button('Salvar critérios','save-criteria','','check')}</div>`;
  }
  function exitPage() {
    return `<main id="main" class="exit-page">${decor()}<section class="exit-card"><div class="exit-icon">${icon('exit')}</div><h1>Realmente deseja sair?</h1><p>Você sairá da demonstração SENX. As alterações de teste ficam neste navegador.</p>${button('SAIR','confirm-exit','full')}<a class="btn secondary full" href="#${e(ui.lastRoute)}">CANCELAR</a></section></main>`;
  }
  function screensPage() {
    const screens=[['login','Login','phone','Formulário, senha visível e acesso à demonstração.'],['cadastro','Cadastro','users','Validação dos campos e confirmação de senha.'],['ligacoes','Ligações','phone','Filtros, paginação, detalhes e exportação CSV.'],['resumos','Resumos e revisão','summary','Leitura de resumo, transcrição e player local.'],['relatorios','Relatórios','report','Filtros, prévia e criação de exemplo.'],['rankings','Rankings','ranking','Atendentes, equipes, filtros e CSV.'],['configuracoes','Configurações','settings','Edição local dos dados de perfil.'],['saida','Saída','exit','Confirmação e cancelamento.'],['administracao/usuarios','Colaboradores e acessos','users','Adicionar e editar usuários demonstrativos.'],['administracao/departamentos','Departamentos','building','Adicionar e editar departamentos.'],['administracao/criterios','Critérios de análise','admin','Edição dos critérios de demonstração.']];
    return head('Todas as telas','Versão 0.1 · Roteiro de revisão pela equipe')+notice('Demonstração independente de banco e API','Use informações fictícias. Os formulários não criam contas reais e os testes não enviam dados a serviços externos.',true)+`<div class="screen-grid">${screens.map(([route,label,name,description])=>`<a href="#${route}" class="screen-card">${icon(name)}<strong>${label}</strong><p>${description}</p></a>`).join('')}</div>`;
  }
  function render(resetFilters = false) {
    closeModal();
    const raw = location.hash.slice(1) || 'login', [route, sub] = raw.split('/');
    const known = ['login','cadastro','ligacoes','resumos','relatorios','rankings','configuracoes','administracao','saida','telas'];
    if (!known.includes(route)) { location.hash='telas'; return; }
    if (resetFilters || currentRoute !== raw) Object.assign(ui, {page:1,query:'',team:'',status:'',date:'',type:''});
    if (!['login','cadastro','saida'].includes(route)) ui.lastRoute=raw;
    if (route==='administracao') ui.adminTab=['usuarios','departamentos','criterios'].includes(sub)?sub:'usuarios';
    currentRoute=raw;
    if (route==='login'||route==='cadastro') {
      app.innerHTML=auth(route==='cadastro');
      const remember=app.querySelector('[name="remember"]');
      if(remember){remember.disabled=true;remember.parentElement.title='Disponível após a integração de autenticação na v0.2.'}
    }
    else if(route==='saida') app.innerHTML=exitPage();
    else {
      const pages={ligacoes:callsPage,resumos:summariesPage,relatorios:reportsPage,rankings:rankingsPage,configuracoes:settingsPage,administracao:adminPage,telas:screensPage};
      app.innerHTML=shell(pages[route](),route);
    }
    app.dataset.route=raw;
    document.title=`${({login:'Login',cadastro:'Cadastro',ligacoes:'Ligações',resumos:'Resumos',relatorios:'Relatórios',rankings:'Rankings',configuracoes:'Configurações',administracao:'Administração',saida:'Saída',telas:'Todas as telas'})[route]} — SENX`;
  }

  // Modais e ações de formulário.
  function openModal(title, subtitle, content, footer = '', formId = '') {
    closeModal(); lastFocus=document.activeElement;
    const root=document.querySelector('#modal-root');
    root.innerHTML=`<dialog aria-labelledby="senx-dialog-heading">${formId?`<form id="${formId}">`:''}<header class="modal-head"><div><h2 id="senx-dialog-heading">${title}</h2><p>${subtitle}</p></div>${actionIcon('close','close-modal','Fechar janela')}</header><div class="modal-body">${content}</div>${footer?`<footer class="modal-footer">${footer}</footer>`:''}${formId?'</form>':''}</dialog>`;
    const dialog=root.querySelector('dialog'); dialog.addEventListener('cancel',event=>{event.preventDefault();closeModal()}); dialog.showModal();
    const first=dialog.querySelector('input:not([disabled]),textarea,select'); if(first)first.focus();
  }
  function closeModal() {
    const dialog=document.querySelector('#modal-root dialog');
    if(dialog){dialog.close();dialog.remove();if(lastFocus?.isConnected)lastFocus.focus()}
  }
  const modalActions = (label='Salvar') => `${button('Cancelar','close-modal','secondary')}<button class="btn" type="submit">${label}</button>`;
  const inputField = (name,label,value='',type='text',required=true) => `<div class="form-field"><label for="modal-${name}">${label}${required?' *':''}</label><input id="modal-${name}" name="${name}" type="${type}" value="${e(value)}" ${required?'required':''} ${type==='email'?'autocomplete="email"':''}></div>`;
  const selectField = (name,label,values,selected='') => `<div class="form-field"><label for="modal-${name}">${label} *</label><select id="modal-${name}" name="${name}" required>${values.map(v=>option(v,v,selected)).join('')}</select></div>`;
  function userModal(id) {
    const user=state.users.find(u=>u.id===id)||{name:'',email:'',team:state.departments[0].name,role:'Consulta',status:'Ativo'};
    openModal(id?'Editar usuário':'Adicionar usuário','Cadastro de demonstração local. Nenhuma conta ou permissão real é criada.',`<input type="hidden" name="id" value="${e(id||'')}">${inputField('name','Nome completo',user.name)}${inputField('email','E-mail corporativo',user.email,'email')}<div class="form-grid" style="margin-top:16px">${selectField('team','Departamento',state.departments.map(d=>d.name),user.team)}${selectField('role','Perfil de acesso',['Consulta','Revisão','Liderança'],user.role)}</div>${selectField('status','Status',['Ativo','Inativo'],user.status)}<section class="permissions"><strong>Prévia de permissões</strong><label class="check-row"><input type="checkbox" checked disabled><span>Consultar gravações<small>Ouvir gravações e consultar transcrições e resumos.</small></span></label><label class="check-row"><input type="checkbox" ${user.role!=='Consulta'?'checked':''} disabled><span>Revisar análises<small>Dependente da matriz de permissões da v0.2.</small></span></label></section>`,modalActions(), 'user-form');
  }
  function departmentModal(id) {
    const d=state.departments.find(d=>d.id===id)||{name:'',leader:state.users[0].name,description:'',criteria:0};
    openModal(id?'Editar departamento':'Adicionar departamento','Organize a equipe e sua liderança na demonstração.',`<input type="hidden" name="id" value="${e(id||'')}">${inputField('name','Nome do departamento',d.name)}${selectField('leader','Liderança responsável',state.users.map(u=>u.name),d.leader)}<div class="form-field"><label for="modal-description">Descrição</label><textarea id="modal-description" name="description" rows="3">${e(d.description)}</textarea></div>${notice('Acessos preservados','A configuração local não altera permissões reais. As regras serão integradas na v0.2.',true)}`,modalActions(id?'Salvar alterações':'Salvar'),'department-form');
  }
  function criterionModal(id) {
    const c=criteriaFor().find(c=>c.id===id);
    openModal('Editar critério',`${e(ui.team||'Atendimento')} · ${e(c.name)}`,`<input type="hidden" name="id" value="${e(id)}">${inputField('name','Nome do critério',c.name)}<div class="form-field"><label for="modal-description">Descrição *</label><textarea id="modal-description" name="description" rows="3" required>${e(c.description)}</textarea></div><div class="form-field"><label for="modal-evidence">Evidências esperadas *</label><textarea id="modal-evidence" name="evidence" rows="3" required>${e(c.evidence)}</textarea></div><section class="permissions"><label class="check-row"><input type="checkbox" checked disabled>Exigir evidência textual e marcação de tempo.</label><label class="check-row"><input type="checkbox" checked disabled>Exigir revisão humana antes de qualquer ação.</label></section>${notice('Indício não é conclusão','Sentimento é estimativa da IA. Não use inferência de tom como evidência suficiente de intenção de cancelamento.')}`,modalActions('Salvar alterações'),'criterion-form');
  }
  function reportModal(id) {
    const r=state.reports.find(r=>r.id===id);
    openModal(e(r.title),'Prévia demonstrativa · Nenhum dado real ou modelo de IA foi consultado.',`<div class="stack"><div>${badge(r.type)} ${badge(r.status)}</div><p class="muted">Equipe: ${e(r.team)} · Período: ${e(r.period)}</p><h3>Panorama da análise</h3><p>O recorte ilustrativo apresenta oportunidades de revisão dos atendimentos, acompanhamento das solicitações e conferência de evidências. As métricas são exemplos de apresentação.</p>${notice('Validação humana pendente','O relatório deve ser conferido com a transcrição e o áudio antes de qualquer decisão.')}</div>`,`${button('Fechar','close-modal','secondary')}<button class="btn" data-action="report-download" data-id="${e(r.id)}">Baixar prévia</button>`);
  }
  function importModal() {
    openModal('Importar gravação','Teste local de seleção de arquivo. O áudio não será enviado nem transcrito.',`<div class="file-zone">${icon('upload')}<h3>Selecione uma gravação</h3><p>Áudio MP3, WAV, M4A, OGG ou vídeo MP4 · até 100 MB para a demonstração.</p><input type="file" name="file" accept=".mp3,.wav,.m4a,.ogg,.mp4,.webm" required aria-label="Gravação para demonstração"></div><div class="form-field" style="margin-top:16px"><label for="import-contact">Nome do contato *</label><input id="import-contact" name="client" required placeholder="Contato de demonstração"></div>${selectField('team','Equipe',state.departments.map(d=>d.name))}<p class="tiny muted" style="margin-top:12px">Somente o nome e os metadados são armazenados. A análise de arquivos ficará para a integração do back-end.</p>`,modalActions('Adicionar à lista'),'import-form');
  }
  const errors = form => form.querySelector('[role="alert"]') || (()=>{const p=document.createElement('p');p.className='form-error';p.setAttribute('role','alert');form.querySelector('.modal-body')?.append(p);return p})();
  function submitForm(event) {
    const form=event.target;if(!(form instanceof HTMLFormElement))return;
    event.preventDefault();if(!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form));
    // Um campo chamado "id" pode sombrear a propriedade form.id no navegador.
    switch(form.getAttribute('id')){
      case 'login-form': location.hash='ligacoes';toast('Acesso de demonstração. Nenhuma senha foi armazenada ou autenticada.');return;
      case 'register-form':
        if(data.password!==data['confirm-password']){document.querySelector('#auth-error').textContent='As senhas não coincidem.';document.querySelector('#confirm-password').focus();return}
        location.hash='login';toast('Formulário validado. Cadastro real será integrado na v0.2.');return;
      case 'profile-form': state.profile={name:data.name.trim(),email:data.email.trim(),team:data.team,job:data.job.trim()};save();render();toast('Perfil de demonstração salvo neste navegador.');return;
      case 'user-form': {
        if(state.users.some(u=>u.email.toLowerCase()===data.email.trim().toLowerCase()&&u.id!==data.id)){errors(form).textContent='Este e-mail já existe na demonstração.';return}
        const user={id:data.id||`USR-${crypto.randomUUID()}`,name:data.name.trim(),email:data.email.trim(),team:data.team,role:data.role,status:data.status};
        if(data.id)state.users=state.users.map(u=>u.id===data.id?user:u);else state.users.push(user);
        save();render();toast('Usuário salvo na demonstração local.');return;
      }
      case 'department-form': {
        if(state.departments.some(d=>C.search(d.name,data.name.trim())&&C.search(data.name.trim(),d.name)&&d.id!==data.id)){errors(form).textContent='Já existe um departamento com esse nome.';return}
        const previous=state.departments.find(d=>d.id===data.id);
        const department={id:data.id||`DEP-${crypto.randomUUID()}`,name:data.name.trim(),leader:data.leader,description:data.description.trim(),criteria:previous?.criteria||0};
        if(previous){state.departments=state.departments.map(d=>d.id===data.id?department:d);state.users.forEach(u=>{if(u.team===previous.name)u.team=department.name});if(state.profile.team===previous.name)state.profile.team=department.name}
        else state.departments.push(department);
        save();render();toast('Departamento salvo na demonstração local.');return;
      }
      case 'criterion-form': state.criteriaByDepartment[criteriaDepartment().id]=criteriaFor().map(c=>c.id===data.id?{...c,name:data.name.trim(),description:data.description.trim(),evidence:data.evidence.trim()}:c);save();render();toast('Critério de demonstração atualizado para esta equipe.');return;
      case 'new-report-form': state.reports.unshift({id:`REL-${crypto.randomUUID()}`,title:data.title.trim(),type:data.type,team:data.team,status:'Aguardando revisão',period:'17/10 – 23/10/2026'});save();render();toast('Relatório de exemplo adicionado. Nenhuma análise real foi executada.');return;
      case 'feedback-form': {
        const review={version:'0.1',screen:currentRoute,description:data.description.trim(),expected:data.expected.trim(),viewport:`${innerWidth}×${innerHeight}`,createdAt:new Date().toISOString(),userAgent:navigator.userAgent};
        state.reviews.push(review);save();download('senx-revisao-'+Date.now()+'.json',JSON.stringify(review,null,2),'application/json');closeModal();toast('Relato baixado. Compartilhe o arquivo com a equipe.');return;
      }
      case 'import-form': {
        const file=form.querySelector('[name="file"]').files[0];
        if(!file||!/\.(mp3|wav|m4a|ogg|mp4|webm)$/i.test(file.name)||file.size>100*1024*1024){errors(form).textContent='Selecione um formato aceito com até 100 MB.';return}
        const date=new Date().toISOString().slice(0,10);
        state.imported.unshift({id:`LOCAL-${Date.now()}`,client:data.client.trim(),phone:'Não informado',agent:state.profile.name,team:data.team,date,time:'00:00',seconds:0,topic:'Não classificado',sentiment:'Em análise',status:'Não analisado',summary:'',transcript:[],filename:file.name});
        save();location.hash='ligacoes';closeModal();render(true);toast('Metadados adicionados. Nenhum áudio foi enviado ou analisado.');return;
      }
    }
  }
  function doAction(action,id,element) {
    switch(action){
      case 'menu': document.querySelector('.layout').classList.toggle('menu-open');return;
      case 'enter-demo': location.hash='ligacoes';return;
      case 'password': {const input=document.getElementById(id),show=input.type==='password';input.type=show?'text':'password';element.setAttribute('aria-pressed',String(show));element.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');return}
      case 'recover': openModal('Recuperar senha','Disponível após a integração de autenticação.',`<p>Esta versão não possui contas reais. Para testar a plataforma, use <strong>Explorar demonstração</strong> na tela de login.</p>`,button('Entendi','close-modal'));return;
      case 'terms': openModal('Termos de uso e privacidade','Conteúdo jurídico pendente de definição pela equipe.',`<p>Esta prévia usa apenas dados fictícios e armazena alterações no navegador. O cadastro não é enviado e nenhum consentimento real é registrado.</p><p class="muted" style="margin-top:15px">O texto definitivo será inserido após validação do responsável pelo produto.</p>`,button('Entendi','close-modal'));return;
      case 'confirm-exit': location.hash='login';toast('Você saiu da demonstração.');return;
      case 'close-modal': closeModal();return;
      case 'clear-filters': render(true);return;
      case 'review-call': ui.selected=D.calls[0].id;ui.detailTab='resumo';location.hash='resumos';return;
      case 'call-detail': ui.selected=id;ui.detailTab='resumo';location.hash='resumos';return;
      case 'select-call': ui.selected=id;ui.detailTab='resumo';render();return;
      case 'transcript-tab': ui.detailTab='transcricao';render();return;
      case 'call-info': {const c=allCalls().find(c=>c.id===id);openModal('Metadados da ligação',e(c.id),`<div class="stack"><p><strong>Contato:</strong> ${e(c.client)}</p><p><strong>Atendente:</strong> ${e(c.agent)}</p><p><strong>Equipe:</strong> ${e(c.team)}</p><p><strong>Data:</strong> ${C.formatDate(c.date)} ${e(c.time)}</p><p><strong>Arquivo:</strong> ${e(c.filename||'Exemplo sem gravação')}</p><p class="muted">Dados fictícios para revisão visual.</p></div>`,button('Fechar','close-modal','secondary'));return}
      case 'review-classification': case 'validate-summary': openModal('Revisão humana','Fluxo demonstrativo · Decisões reais dependem do back-end.',`<p>A validação de análises exige identidade do revisor, registro de evidências e trilha de auditoria. Esses requisitos serão integrados na versão 0.2.</p>${notice('Nenhum estado funcional foi alterado','Use esta prévia para conferir a apresentação do fluxo.',true)}`,button('Entendi','close-modal'));return;
      case 'export-calls': download('senx-ligacoes-demo.csv',C.toCsv([['ID','Contato','Telefone','Equipe','Data','Duração','Assunto','Status'],...C.filterCalls(allCalls(),ui).map(c=>[c.id,c.client,c.phone,c.team,c.date,C.duration(c.seconds),c.topic,c.status])]),'text/csv;charset=utf-8');return;
      case 'import': importModal();return;
      case 'new-report': openModal('Novo relatório','Crie um item de demonstração para testar a listagem.',`${inputField('title','Nome do relatório')}${selectField('type','Tipo',['Qualidade','Retenção','Desenvolvimento','Conformidade'])}${selectField('team','Equipe',[...state.departments.map(d=>d.name),'Todos'])}${notice('Prévia sem processamento de IA','O relatório não contém análises reais e ficará aguardando revisão.',true)}`,modalActions('Criar exemplo'),'new-report-form');return;
      case 'review-reports': ui.status='Aguardando revisão';ui.page=1;render();return;
      case 'report-detail': reportModal(id);return;
      case 'report-download': {const r=state.reports.find(r=>r.id===id);download('senx-relatorio-demo.txt',`SENX — PRÉVIA DEMONSTRATIVA\n${r.title}\nTipo: ${r.type}\nEquipe: ${r.team}\nPeríodo: ${r.period}\nStatus: ${r.status}\n\nNenhuma análise real foi executada. Conferência e integração pendentes.`);return}
      case 'export-rankings': download('senx-ranking-demo.csv',C.toCsv([['Atendente','Equipe','Ligações','Qualidade','Resolução'],...D.rankings.filter(r=>C.search(r.name,ui.query)&&(!ui.team||r.team===ui.team)).map(r=>[r.name,r.team,r.calls,r.quality,r.resolution])]),'text/csv;charset=utf-8');return;
      case 'agent-calls': location.hash='ligacoes';setTimeout(()=>{ui.query=id;render()},0);return;
      case 'add-user': userModal();return;
      case 'edit-user': userModal(id);return;
      case 'user-options': {const u=state.users.find(u=>u.id===id);openModal('Opções do usuário',e(u.name),`<p>Status atual: ${badge(u.status)}</p><p class="muted" style="margin-top:14px">Você pode alterar os dados e o status na edição local. Nenhum acesso real será concedido ou revogado.</p>`,`${button('Fechar','close-modal','secondary')}<button class="btn" data-action="edit-user" data-id="${e(id)}">Editar usuário</button>`);return}
      case 'add-department': departmentModal();return;
      case 'edit-department': departmentModal(id);return;
      case 'edit-criterion': criterionModal(id);return;
      case 'toggle-criterion': {const c=criteriaFor().find(c=>c.id===id);c.active=!c.active;render();toast('Estado ilustrativo alterado. Use Salvar critérios para persistir.');return}
      case 'save-criteria': criteriaDepartment().criteria=criteriaFor().filter(c=>c.active).length;save();toast('Critérios desta equipe salvos localmente para revisão.');return;
      case 'discard-criteria': {const saved=load(),id=criteriaDepartment().id;state.criteriaByDepartment[id]=saved?.criteriaByDepartment?.[id];render();toast('Alterações de critérios descartadas.');return}
      case 'feedback': openModal('Relatar problema na tela',`Tela: ${e(currentRoute)} · Versão 0.1`, '<div class="form-field"><label for="feedback-description">O que aconteceu? *</label><textarea id="feedback-description" name="description" rows="4" required placeholder="Descreva o problema e como reproduzir."></textarea></div><div class="form-field"><label for="feedback-expected">Como deveria funcionar?</label><textarea id="feedback-expected" name="expected" rows="2"></textarea></div><p class="tiny muted" style="margin-top:14px">Um arquivo será baixado para você compartilhar com a equipe. Nenhum relato é enviado automaticamente.</p>',modalActions('Baixar relato'),'feedback-form');return;
      case 'reset': openModal('Restaurar demonstração','Apaga somente os dados fictícios salvos por esta prévia.', '<p>Perfis, cadastros e relatórios locais voltarão aos exemplos originais. Os arquivos que você baixou permanecem no seu dispositivo.</p>',`${button('Cancelar','close-modal','secondary')}${button('Restaurar','confirm-reset','danger')}`);return;
      case 'confirm-reset': Object.assign(state,{version:1,users:structuredClone(D.users),departments:structuredClone(D.departments),criteria:structuredClone(D.criteria),criteriaByDepartment:{},profile:{...D.profile},reports:structuredClone(D.reports),imported:[],reviews:[]});save();render(true);toast('Demonstração restaurada.');return;
    }
  }
  document.addEventListener('submit',submitForm);
  document.addEventListener('click',event=>{
    const element=event.target.closest('[data-action],[data-page],[data-detail-tab],[data-report-type],[data-ranking-tab]');if(!element)return;
    if(element.disabled)return;
    if(element.dataset.action)doAction(element.dataset.action,element.dataset.id,element);
    else if(element.dataset.page){ui.page=Number(element.dataset.page);render()}
    else if(element.dataset.detailTab){ui.detailTab=element.dataset.detailTab;render()}
    else if(element.dataset.reportType!==undefined){ui.type=element.dataset.reportType;ui.page=1;render()}
    else if(element.dataset.rankingTab){ui.rankingTab=element.dataset.rankingTab;render()}
  });
  document.addEventListener('change',event=>{
    const target=event.target;
    if(target.matches('[data-filter]')&&target.type!=='search'){ui[target.dataset.filter]=target.value;ui.page=1;render()}
    if(target.id==='audio-file'&&target.files[0]){const player=document.querySelector('#audio-player');if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(target.files[0]);player.src=audioUrl;player.hidden=false;player.onerror=()=>toast('O navegador não conseguiu reproduzir este formato de áudio.')}
  });
  let filterTimer;
  document.addEventListener('input',event=>{
    const target=event.target;
    if(!target.matches('input[type="search"][data-filter]'))return;
    const value=target.value;clearTimeout(filterTimer);
    filterTimer=setTimeout(()=>{ui.query=value;ui.page=1;render();const input=document.querySelector('input[type="search"][data-filter]');input?.focus()},180);
  });
  window.addEventListener('hashchange',()=>{clearTimeout(filterTimer);render();window.scrollTo(0,0);document.querySelector('#main')?.focus({preventScroll:true})});
  window.addEventListener('beforeunload',()=>{if(audioUrl)URL.revokeObjectURL(audioUrl)});
  render();
})();
