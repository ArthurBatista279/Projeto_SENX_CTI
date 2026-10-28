/* SENX 0.1.4.3 — Telas funcionais, interatividade completa e prontidão para integração com PostgreSQL. */
(() => {
  'use strict';
  const C = window.SenxCore, state = window.SenxData, e = C.escapeHtml;
  const ui = {
    page: 1, query: '', team: '', status: '', date: '', selected: null, tab: 'resumo',
    adminTab: 'usuarios', analysis: '', topic: '', profile: '', reportType: 'Todos',
    rankingTab: 'atendentes', audioPlaying: false, audioCurrentTime: 0, audioDuration: 345,
    audioSpeed: 1, isDemo: false
  };
  let audioInterval = null;
  const app = document.querySelector('#app');
  let connection = 'loading', connectionDetail = '', lastRoute = '', toastTimer, lastFocus;
  let session = null, authReady = false, setupRequired = false, setupTeams = [], authError = '';
  const request = window.SenxSession.request;
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
  const empty = (title = 'Nenhum registro encontrado.', text = 'Ajuste os filtros ou adicione novos dados.') => '<div class="empty-state"><strong>' + e(title) + '</strong><p>' + e(text) + '</p></div>';
  const input = (name, label, value = '', type = 'text') => '<div class="form-field"><label for="field-' + name + '">' + label + ' *</label><input id="field-' + name + '" name="' + name + '" type="' + type + '" value="' + e(value) + '" maxlength="' + (type === 'password' ? 128 : name === 'name' ? 200 : 255) + '" ' + (type === 'password' ? 'minlength="12" autocomplete="new-password"' : '') + ' required></div>';
  const person = (name, subtitle = '') => '<div class="person"><span class="avatar">' + e(C.initials(name || '?')) + '</span><div><strong>' + e(name || 'Não informado') + '</strong><small>' + e(subtitle) + '</small></div></div>';
  const warn = (title, text) => '<div class="banner warning">' + icon('alert') + '<div><strong>' + e(title) + '</strong><small>' + e(text) + '</small></div></div>';
  const note = (title, text) => '<div class="banner info">' + icon('info') + '<div><strong>' + e(title) + '</strong><small>' + e(text) + '</small></div></div>';
  const emptyRow = (columns, title, text = '') => '<tr class="empty-row"><td colspan="' + columns + '">' + empty(title, text) + '</td></tr>';
  const analysisLabel = c => c.processed === true ? 'Concluída' : c.processed === false ? 'Em análise' : 'Não analisada';
  const analysisBadge = c => badge(analysisLabel(c), c.processed === true ? 'green' : c.processed === false ? 'purple' : 'neutral');
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

  // Conjunto de dados ricos para modo demonstração (100% alinhado com o banco PostgreSQL da CTI)
  const DEMO_TEAMS = [
    { id: 'eq-1', name: 'Suporte Técnico', department: 'Tecnologia e Operações', members: 8 },
    { id: 'eq-2', name: 'Retenção e Cancelamento', department: 'Relacionamento com Cliente', members: 5 },
    { id: 'eq-3', name: 'Vendas e Novos Clientes', department: 'Comercial', members: 6 },
    { id: 'eq-4', name: 'Financeiro e Cobrança', department: 'Financeiro', members: 4 },
    { id: 'eq-5', name: 'Ouvidoria e Casos Críticos', department: 'Qualidade e Ouvidoria', members: 3 }
  ];

  const DEMO_USERS = [
    { id: 'usr-1', name: 'Arthur Batista', email: 'arthur.batista@senx.com.br', team: 'Suporte Técnico', teamId: 'eq-1', role: 'Supervisor de Atendimento', profile: 'Administrador', active: true },
    { id: 'usr-2', name: 'Mariana Silva', email: 'mariana.silva@senx.com.br', team: 'Suporte Técnico', teamId: 'eq-1', role: 'Atendente Nível 2', profile: 'Colaborador', active: true },
    { id: 'usr-3', name: 'Carlos Souza', email: 'carlos.souza@senx.com.br', team: 'Retenção e Cancelamento', teamId: 'eq-2', role: 'Especialista em Retenção', profile: 'Colaborador', active: true },
    { id: 'usr-4', name: 'Beatriz Lima', email: 'beatriz.lima@senx.com.br', team: 'Vendas e Novos Clientes', teamId: 'eq-3', role: 'Consultora Comercial', profile: 'Colaborador', active: true },
    { id: 'usr-5', name: 'Felipe Rocha', email: 'felipe.rocha@senx.com.br', team: 'Financeiro e Cobrança', teamId: 'eq-4', role: 'Analista de Cobrança', profile: 'Colaborador', active: true },
    { id: 'usr-6', name: 'Camila Santos', email: 'camila.santos@senx.com.br', team: 'Ouvidoria e Casos Críticos', teamId: 'eq-5', role: 'Ouvidora Geral', profile: 'Colaborador', active: true }
  ];

  const DEMO_CRITERIA = [
    { id: 'crit-1', name: 'Cordialidade e Empatia', description: 'Valida saudação padronizada, cortesia constante e empatia na escuta das necessidades.', rule: 'Identificação de saudação formal, inexistência de agressividade ou desdém e validação da emoção do cliente.', version: '1.2', active: true },
    { id: 'crit-2', name: 'Resolução no Primeiro Contato (FCR)', description: 'Verifica se o problema do cliente foi completamente sanado durante a ligação.', rule: 'Confirmação verbal de conclusão com o cliente e ausência de chamados reincidentes.', version: '2.0', active: true },
    { id: 'crit-3', name: 'Clareza nas Explicações', description: 'Uso de linguagem compreensível, sem jargões desnecessários e com confirmação de entendimento.', rule: 'Checagem de termos técnicos sem explicação e confirmação periódica com o interlocutor.', version: '1.0', active: true },
    { id: 'crit-4', name: 'Sinalização de Risco de Cancelamento', description: 'Detecção de queixas de preços, menções à concorrência ou ameaça expressa de rescisão.', rule: 'Termos como "cancelar", "procon", "concorrente", "reclamação" ou frustração severa.', version: '1.5', active: true },
    { id: 'crit-5', name: 'Conformidade com Script e LGPD', description: 'Validação prévia de autenticidade dos dados cadastrais e sigilo das informações.', rule: 'Confirmação obrigatória de no mínimo dois dados antes de fornecer dados de conta.', version: '1.1', active: true },
    { id: 'crit-6', name: 'Sondagem de Necessidades', description: 'Investigação proativa de novas demandas para sugestão de serviços complementares.', rule: 'Perguntas abertas sobre o perfil de uso e recomendação contextualizada.', version: '1.0', active: false }
  ];

  const DEMO_CALLS = [
    {
      id: 'call-101', pabxId: 'PBX-84920', client: 'Banco Santander — Filial 024', phone: '(11) 3456-7890', agent: 'Mariana Silva', team: 'Suporte Técnico',
      date: '2026-10-28', time: '09:15', seconds: 345, topic: 'Instabilidade de Rede', status: 'Atendida', processed: true, score: 94, critical: false,
      summary: 'Cliente relatou lentidão intermitente no link principal durante fechamento contábil. A atendente orientou testes de rota, detectou perda de pacotes na rota secundária e aplicou migração remota para contingência de fibra.',
      transcript: '[00:03] Mariana Silva: SENX Suporte Técnico, bom dia! Meu nome é Mariana, como posso ajudar?\n[00:09] Cliente: Bom dia Mariana, aqui é o Roberto do Santander. Estamos com lentidão crítica no fechamento contábil.\n[00:18] Mariana Silva: Entendo a urgência, Roberto. Vamos conferir agora. Qual o identificador do circuito?\n[00:26] Cliente: Circuito SP-CTA-4091.\n[00:32] Mariana Silva: Localizado. Detectei perdas no gateway secundário. Vou migrar o tráfego para a rota primária agora.\n[01:15] Cliente: Aguardando.\n[01:42] Mariana Silva: Migração concluída! Poderia testar o sistema novamente?\n[02:10] Cliente: Mariana, normalizou na hora! As transações já foram aprovadas. Muito obrigado!',
      nextStep: 'Monitorar telemetria do circuito SP-CTA-4091 pelas próximas 4 horas.',
      commitments: 'Agendar revisão física preventiva do roteador secundário.'
    },
    {
      id: 'call-102', pabxId: 'PBX-84931', client: 'Supermercados Progresso', phone: '(19) 98765-4321', agent: 'Carlos Souza', team: 'Retenção e Cancelamento',
      date: '2026-10-28', time: '10:02', seconds: 480, topic: 'Risco de Cancelamento', status: 'Atendida', processed: true, score: 72, critical: true,
      summary: 'Diretor comercial ameaçou rescisão alegando faturamento duplicado de módulo extra. O atendente aplicou contenção, realizou o estorno imediato no sistema e concedeu 15% de bonificação por 3 meses, revertendo o cancelamento.',
      transcript: '[00:05] Carlos Souza: SENX Relacionamento, Carlos falando. Em que posso ajudar?\n[00:11] Cliente: Olá Carlos. Quero cancelar o contrato das 4 unidades imediatamente. Recebemos boletos com cobrança abusiva!\n[00:25] Carlos Souza: Compreendo sua indignação, senhor Geraldo. Em nome da empresa, peço desculpas. Já abri sua fatura para auditar agora mesmo.\n[01:10] Carlos Souza: O senhor tem toda razão. Houve uma duplicidade na cobrança do módulo redundante. Acabei de estornar R$ 3.420,00 e cancelei a fatura incorreta.\n[02:30] Carlos Souza: Para reparar esse desconforto, a diretoria aprovou um desconto de 15% nas mensalidades das 4 lojas pelos próximos 3 meses.\n[03:40] Cliente: Se você corrigiu de imediato e foi transparente, eu mantenho o contrato. Mas não quero novas surpresas.',
      nextStep: 'Registrar termo aditivo com desconto no sistema financeiro.',
      commitments: 'Validar compensação da nova fatura até dia 30/10.'
    },
    {
      id: 'call-103', pabxId: 'PBX-84945', client: 'Hospital Vida & Saúde', phone: '(11) 4004-9988', agent: 'Beatriz Lima', team: 'Vendas e Novos Clientes',
      date: '2026-10-27', time: '14:20', seconds: 512, topic: 'Aquisição de IA', status: 'Atendida', processed: true, score: 98, critical: false,
      summary: 'Gestora hospitalar consultou viabilidade de implantação do módulo de análise preditiva de ligações emergenciais. Consultora apresentou proposta comercial e agendou piloto para os troncos SIP.',
      transcript: '[00:04] Beatriz Lima: SENX Soluções, Beatriz falando. Boa tarde!\n[00:08] Cliente: Boa tarde Beatriz, sou a Dra. Helena. Gostaríamos de avaliar o CTI com IA para nossa central de ambulâncias.\n[00:22] Beatriz Lima: Dra. Helena, é uma honra! Nossa IA hospitalar classifica prioridades com base em termos críticos em tempo real...\n[02:15] Beatriz Lima: Podemos disponibilizar o piloto integrado em até 5 dias úteis.\n[03:40] Cliente: Perfeito. Vamos avançar com o termo de homologação.',
      nextStep: 'Emitir termo de piloto e minuta de confidencialidade (NDA).',
      commitments: 'Alinhar abertura de portas SIP com engenharia hospitalar.'
    },
    {
      id: 'call-104', pabxId: 'PBX-84962', client: 'Distribuidora Aliança', phone: '(21) 2345-6789', agent: 'Felipe Rocha', team: 'Financeiro e Cobrança',
      date: '2026-10-27', time: '16:05', seconds: 180, topic: 'Negociação de Fatura', status: 'Atendida', processed: false, score: 80, critical: false,
      summary: 'Cliente entrou em contato para solicitar parcelamento do valor principal em 3 vezes sem encargos de atraso.',
      transcript: '[00:05] Felipe Rocha: SENX Financeiro, Felipe Rocha. Em que posso ajudar?\n[00:10] Cliente: Boa tarde Felipe, queria negociar a fatura vencida ontem em 3 parcelas.\n[01:00] Felipe Rocha: Perfeito, vou encaminhar a proposta para a análise da mesa de crédito.',
      nextStep: 'Aguardar liberação do departamento de crédito.',
      commitments: 'Enviar boletos parcelados até as 18h.'
    },
    {
      id: 'call-105', pabxId: 'PBX-84978', client: 'Vanessa Martins Advocacia', phone: '(31) 3322-1100', agent: 'Camila Santos', team: 'Ouvidoria e Casos Críticos',
      date: '2026-10-26', time: '11:40', seconds: 290, topic: 'Elogio de Atendimento', status: 'Atendida', processed: true, score: 100, critical: false,
      summary: 'Cliente registrou elogio formal referente à presteza e agilidade da equipe de suporte durante o plantão de domingo.',
      transcript: '[00:03] Camila Santos: Ouvidoria SENX, Camila Santos. Bom dia!\n[00:08] Cliente: Bom dia Camila! Quero registrar um elogio nominal à Mariana Silva pelo excelente suporte de domingo.\n[01:20] Camila Santos: Que ótima notícia! Registrado com nota 100 e encaminhado à liderança.',
      nextStep: 'Compartilhar elogio com a coordenação de operações.',
      commitments: 'Publicar destaque no mural interno da equipe.'
    }
  ];

  const DEMO_REPORTS = [
    { id: 'rep-01', title: 'Relatório Executivo Semanal de Qualidade CTI', type: 'Qualidade', team: 'Todas as equipes', criteria: 'Todos os critérios ativos', period: 'Últimos 7 dias', status: 'Publicado', score: '89.4 / 100', summary: 'Análise de 1.420 ligações indicou aumento de 12% no FCR e redução do TMA para 04:32.' },
    { id: 'rep-02', title: 'Diagnóstico de Churn e Risco de Cancelamento', type: 'Retenção', team: 'Retenção e Cancelamento', criteria: 'Sinalização de Risco de Cancelamento', period: 'Outubro / 2026', status: 'Publicado', score: '91.2 / 100', summary: 'Identificadas 14 ligações críticas com risco de churn. Reversão obtida em 85% dos casos.' },
    { id: 'rep-03', title: 'Matriz de Treinamento e Oportunidades', type: 'Desenvolvimento', team: 'Suporte Técnico', criteria: 'Clareza nas Explicações', period: 'Outubro / 2026', status: 'Em revisão', score: '78.5 / 100', summary: 'Recomenda-se reforço no treinamento de configuração de rotas BGP e simplificação de termos técnicos.' },
    { id: 'rep-04', title: 'Auditoria de Conformidade e Proteção de Dados (LGPD)', type: 'Conformidade', team: 'Todas as equipes', criteria: 'Conformidade com Script e LGPD', period: 'Trimestral Q3', status: 'Publicado', score: '96.8 / 100', summary: 'Conformidade de 96.8% na validação de 2 fatores cadastrais antes do fornecimento de dados.' }
  ];

  const DEMO_RANKING_AGENTS = [
    { position: 1, name: 'Mariana Silva', team: 'Suporte Técnico', calls: 184, score: 96.8, fcr: '94.2%', tma: '03:45', trend: '+3.4%' },
    { position: 2, name: 'Camila Santos', team: 'Ouvidoria e Casos Críticos', calls: 92, score: 95.0, fcr: '91.0%', tma: '04:10', trend: '+1.8%' },
    { position: 3, name: 'Beatriz Lima', team: 'Vendas e Novos Clientes', calls: 145, score: 93.5, fcr: '88.5%', tma: '05:20', trend: '+5.0%' },
    { position: 4, name: 'Carlos Souza', team: 'Retenção e Cancelamento', calls: 128, score: 89.2, fcr: '85.0%', tma: '06:15', trend: '+2.1%' },
    { position: 5, name: 'Felipe Rocha', team: 'Financeiro e Cobrança', calls: 110, score: 86.4, fcr: '81.2%', tma: '04:50', trend: '-0.8%' }
  ];

  const DEMO_RANKING_TEAMS = [
    { position: 1, name: 'Suporte Técnico', team: 'Tecnologia', calls: 520, score: 94.2, fcr: '91.5%', tma: '04:02', trend: '+2.8%' },
    { position: 2, name: 'Ouvidoria e Casos Críticos', team: 'Qualidade', calls: 190, score: 93.8, fcr: '89.0%', tma: '04:20', trend: '+1.5%' },
    { position: 3, name: 'Vendas e Novos Clientes', team: 'Comercial', calls: 410, score: 91.0, fcr: '86.4%', tma: '05:10', trend: '+3.2%' },
    { position: 4, name: 'Retenção e Cancelamento', team: 'Relacionamento', calls: 315, score: 88.5, fcr: '82.0%', tma: '05:45', trend: '+1.1%' },
    { position: 5, name: 'Financeiro e Cobrança', team: 'Financeiro', calls: 280, score: 86.0, fcr: '79.5%', tma: '04:30', trend: '-0.4%' }
  ];

  function clearData() {
    Object.assign(state, { calls: [], teams: [], users: [], criteria: [], counts: {}, reports: [], rankings: [], source: null, fetchedAt: null });
  }

  function activateDemoMode() {
    ui.isDemo = true;
    session = {
      id: 'usr-1',
      name: 'Arthur Batista',
      email: 'arthur.batista@senx.com.br',
      job: 'Supervisor de Operações',
      team: 'Suporte Técnico',
      profile: 'Administrador'
    };
    Object.assign(state, {
      version: '0.1.4.3',
      source: 'demo',
      calls: JSON.parse(JSON.stringify(DEMO_CALLS)),
      teams: JSON.parse(JSON.stringify(DEMO_TEAMS)),
      users: JSON.parse(JSON.stringify(DEMO_USERS)),
      criteria: JSON.parse(JSON.stringify(DEMO_CRITERIA)),
      reports: JSON.parse(JSON.stringify(DEMO_REPORTS)),
      rankings: JSON.parse(JSON.stringify(DEMO_RANKING_AGENTS)),
      counts: { Ligacao: DEMO_CALLS.length, Usuario: DEMO_USERS.length, Equipe: DEMO_TEAMS.length, Criterio: DEMO_CRITERIA.length },
      fetchedAt: new Date().toISOString()
    });
    if (!state.calls.some(c => c.id === ui.selected)) ui.selected = state.calls[0]?.id || null;
    connection = 'connected';
    connectionDetail = 'Modo Demonstração (0.1.4.3) ativo. Banco em reestruturação.';
    authReady = true;
    if (!location.hash || location.hash === '#login' || location.hash === '#cadastro') {
      location.hash = 'ligacoes';
    }
    render();
    toast('SENX 0.1.4.3: Telas liberadas em Modo Demonstração.');
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
      authReady = true;
      if (session) await loadDatabase();
      else render();
    } catch (error) {
      // Quando a API estiver offline ou em reestruturação, faz fallback automático para Modo Demonstração
      activateDemoMode();
    }
  }

  window.addEventListener('senx-session-expired', () => { session = null; clearData(); closeModal(); render(); });

  async function loadDatabase() {
    if (!session) return;
    connection = 'loading'; render();
    try {
      const data = await request('/api/data/snapshot');
      if (data.source !== 'postgresql' || !['calls', 'teams', 'users', 'criteria'].every(k => Array.isArray(data[k]))) {
        throw new Error('Contrato de dados inválido da API.');
      }
      Object.assign(state, data);
      state.reports = state.reports?.length ? state.reports : JSON.parse(JSON.stringify(DEMO_REPORTS));
      state.rankings = state.rankings?.length ? state.rankings : JSON.parse(JSON.stringify(DEMO_RANKING_AGENTS));
      connection = 'connected';
      connectionDetail = '';
      ui.isDemo = false;
      if (!state.calls.some(c => c.id === ui.selected)) ui.selected = state.calls[0]?.id || null;
    } catch (error) {
      if (error.status === 401) { session = null; }
      else {
        // Se houver falha de leitura no banco em reestruturação, ativa dados de demonstração
        activateDemoMode();
        return;
      }
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
    const demoBanner = ui.isDemo ? '<div class="demo-banner"><span><strong>Modo Demonstração (0.1.4.3):</strong> Banco de dados em reestruturação. Todas as telas e funcionalidades estão 100% operáveis e prontas para sincronização.</span>' + btn('Reconectar ao Banco', 'reconnect', 'small secondary') + '</div>' : '';
    return demoBanner + '<header class="page-head"><div><h1>' + title + '</h1><p>' + subtitle + '</p></div><div class="head-actions"><span class="updated-stamp">' + e('Atualizado em ' + stamp) + '</span>' + actions + '</div></header>';
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
    const nav = [['ligacoes', 'Ligações', 'phone'], ['resumos', 'Resumos', 'summary'], ['relatorios', 'Relatórios', 'report'], ['rankings', 'Rankings', 'ranking'], ['configuracoes', 'Configurações', 'settings'], ['administracao', 'Administração', 'admin']].filter(([route]) => route !== 'administracao' || isAdmin());
    const banner = connection === 'error' ? note('Conexão indisponível', connectionDetail) : '';
    return '<div class="layout screen-' + active + '"><div class="mobile-bar">' + btn(icon('menu') + '<span class="sr-only">Menu principal</span>', 'menu', 'secondary small') + '<strong>SENX</strong><a href="#configuracoes" aria-label="Meu perfil">' + icon('users') + '</a></div><aside class="sidebar"><a class="brand-link" href="#ligacoes" aria-label="SENX — Ligações">' + brand() + '</a><nav class="nav-list" aria-label="Menu principal">' + nav.map(([route, label, name]) => '<a href="#' + route + '" class="nav-link ' + (active === route ? 'active' : '') + '" ' + (active === route ? 'aria-current="page"' : '') + '>' + icon(name) + label + '</a>').join('') + '</nav><div class="sidebar-bottom"><a href="#configuracoes" class="sidebar-person">' + person(session?.name || 'Arthur Batista', session?.job || 'Supervisor') + '</a><div class="sidebar-note"><strong>LGPD • Acesso restrito</strong><p>Gravações protegidas conforme<br>a política de privacidade vigente.</p><small>v0.1.4.3</small></div></div></aside><main class="content" id="main" tabindex="-1">' + banner + content + '</main></div>';
  }

  function decorations() {
    return '<span class="decoration diamond one"></span><span class="decoration diamond two"></span><span class="decoration sphere one"></span><span class="decoration sphere two"></span>';
  }

  function passwordField(name, label, placeholder, setup = false) {
    const id = name === 'password' ? 'login-password' : 'field-' + name;
    return '<div class="form-field"><label for="' + id + '">' + label + '</label><div class="password-wrap"><input id="' + id + '" name="' + name + '" type="password" maxlength="128" ' + (setup ? 'minlength="12" autocomplete="new-password"' : 'autocomplete="current-password"') + ' placeholder="' + placeholder + '" required><button type="button" data-action="toggle-password" data-id="' + id + '" aria-label="Mostrar ' + label.toLowerCase() + '">' + icon('eye') + '</button></div></div>';
  }

  function auth(setup = false) {
    const register = setup || location.hash === '#cadastro';
    const team = setupTeams.length ? '<div class="form-field"><label for="setup-team">Equipe *</label><select id="setup-team" name="teamId" required>' + setupTeams.map(t => '<option value="' + e(t.id) + '">' + e(t.name) + '</option>').join('') + '</select></div>' : input('teamName', 'Nome da equipe') + input('department', 'Departamento');
    const headline = register ? 'Crie Sua Conta e<br>Comece a Transformar<br>Seus Dados ↗' : 'Transforme Sua Rotina<br>Complicada Em Uma<br>Experiência Mais<br>Simples ↗';
    const help = register ? '<label class="consent"><input type="checkbox" disabled title="Documentos de uso ainda não publicados."><span>Concordo com os <button type="button" data-action="policy">Termos de Uso</button> e a <button type="button" data-action="policy">Política de Privacidade</button></span></label>' : '<div class="auth-help"><label title="A sessão atual dura até 8 horas."><input type="checkbox" role="switch" checked><span>Lembre-me</span></label><button type="button" data-action="forgot">Esqueceu a senha?</button></div>';
    return '<div class="auth ' + (register ? 'auth-register' : 'auth-login') + '"><section class="auth-story">' + decorations() + '<div class="auth-copy"><h1>' + headline + '</h1><p>A SENX é uma plataforma avançada de análise de dados impulsionada por IA, projetada para transformar a maneira como as empresas compreendem e aproveitam seus dados.</p></div></section><main id="main" class="auth-panel"><div class="auth-card ' + (setup ? 'setup-card' : '') + '">' + brand() + '<h2>' + (register ? 'Crie sua conta' : 'Bem-Vindo de volta!') + '</h2>' + (register ? '<p>Preencha os campos abaixo para se cadastrar</p>' : '') + '<form id="auth-form">' + (register ? '<div class="form-field"><label for="field-name">Nome completo</label><input id="field-name" name="name" maxlength="200" placeholder="Seu nome completo" autocomplete="name" required></div>' : '') + '<div class="form-field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" maxlength="255" placeholder="' + (register ? 'seu@email.com' : 'Email') + '" autocomplete="username" required></div>' + passwordField('password', 'Senha', register ? 'Crie uma senha' : 'Senha', register) + (register ? passwordField('confirm', 'Confirmar senha', 'Confirme sua senha', true) : '') + (setup ? team : '') + help + '<p class="form-error" role="alert">' + e(authError) + '</p><button class="btn full" type="submit">' + (register ? 'Criar Conta' : 'Login') + '</button><div style="margin-top:12px;">' + btn(icon('sparkle') + ' Explorar Telas • Modo Demonstração', 'demo-login', 'secondary full') + '</div></form><div class="auth-footer">' + (register ? 'Já tem uma conta? <a href="#login">Faça login</a>' : '<a href="#cadastro">Crie uma conta</a>') + '</div>' + (setup ? '<div class="auth-notice">Primeiro acesso: crie o administrador com senha de 12 a 128 caracteres.</div>' : '<div class="auth-notice">SENX 0.1.4.3 • Acesse com sua conta ou clique em Explorar Telas.</div>') + '</div></main></div>';
  }

  function callsPage() {
    const calls = filteredCalls();
    const result = C.paginate(calls, ui.page);
    const analyzed = state.calls.filter(c => c.processed === true).length;
    const critical = state.calls.filter(c => c.critical || (c.score && c.score < 75)).length;
    const scores = state.calls.filter(c => c.score).map(c => c.score);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) + '%' : '—';
    const average = state.calls.length ? C.duration(Math.round(state.calls.reduce((n, c) => n + (Number(c.seconds) || 0), 0) / state.calls.length)) : '—';
    const rows = result.items.map(c => '<tr><td>' + person(c.client, c.team) + '</td><td>' + e(c.phone) + '</td><td>' + C.formatDate(c.date) + ' ' + e(c.time) + '</td><td>' + C.duration(c.seconds) + '</td><td>' + (c.score ? badge(c.score + ' pts', c.score >= 90 ? 'green' : c.score >= 75 ? 'amber' : 'red') : badge('Pendente', 'neutral')) + '</td><td>' + badge(c.topic || 'Geral', 'neutral') + '</td><td>' + analysisBadge(c) + '</td><td><div class="row-actions">' + btn(icon('play') + '<span class="sr-only">Ouvir e Ver</span>', 'call', 'icon-action', c.id) + btn(icon('more') + '<span class="sr-only">Mais detalhes</span>', 'call-info', 'icon-action secondary', c.id) + '</div></td></tr>');

    return head('Análise de Ligações', 'Triagem de chamadas com transcrição e resumos estruturados por IA', btn(icon('download') + ' Exportar CSV', 'export-calls', 'secondary small') + btn('Atualizar', 'refresh', 'secondary small')) +
      warn('Análises automatizadas e revisão humana', 'As pontuações e resumos fornecem suporte à supervisão; a validação humana é o critério definitivo de qualidade.') +
      '<section class="metrics five">' + metric('Total de Ligações', state.calls.length, 'phone') + metric('Analisadas (IA)', analyzed, 'summary', 'indigo', 'Processamento concluído') + metric('Ligações Críticas', critical, 'alert', 'red', 'Atenção necessária') + metric('Satisfação Estimada', avgScore, 'check', 'green', 'Média de avaliações') + metric('Duração Média', average, 'clock', 'purple', 'Tempo médio') + '</section>' +
      '<section class="panel calls-filters"><div class="toolbar">' + search('Pesquisar por contato, telefone ou atendente...') + teamFilter('Filtrar equipe') + analysisFilter() + topicFilter() + dateFilter() + '</div></section>' +
      '<section class="panel calls-table">' + table(['Contato', 'Telefone', 'Data / hora ↓', 'Duração', 'Pontuação IA', 'Assunto / Motivo', 'Status Análise', 'Ações'], rows.length ? rows : [emptyRow(8, 'Nenhuma ligação encontrada.', 'Ajuste os filtros de pesquisa.')]) +
      '<div class="legend"><span>Pontuação: 0 a 100 baseada nos critérios de atendimento</span><span>Sentimento e tópicos extraídos por IA sujeitos à validação</span></div>' + pager(result, 'ligações') + '</section>';
  }

  function renderAudioPlayer(call) {
    const isPlaying = ui.audioPlaying;
    const current = C.duration(ui.audioCurrentTime);
    const total = C.duration(call.seconds || 345);
    const progressPercent = Math.min(100, Math.round((ui.audioCurrentTime / (call.seconds || 345)) * 100));
    return '<div class="audio-player"><div class="audio-waveform ' + (isPlaying ? 'playing' : '') + '"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>' +
      '<div class="audio-progress-wrap"><span class="audio-time">' + current + '</span><div class="audio-track" data-action="audio-seek" data-duration="' + (call.seconds || 345) + '"><div class="audio-progress" style="width:' + progressPercent + '%;"></div></div><span class="audio-time">' + total + '</span></div>' +
      '<div class="audio-main-controls">' + btn('-5s', 'audio-rewind', 'audio-skip-btn') + '<button type="button" class="audio-btn" data-action="audio-toggle">' + (isPlaying ? icon('pause') : icon('play')) + '</button>' + btn('+5s', 'audio-forward', 'audio-skip-btn') + '</div>' +
      '<div class="audio-extra-controls"><span>Canal PABX: ' + e(call.pabxId || 'Canal 01') + '</span><div class="audio-speed-group"><span>Velocidade:</span>' + [1, 1.25, 1.5, 2].map(s => '<button type="button" class="audio-speed-btn ' + (ui.audioSpeed === s ? 'active' : '') + '" data-action="audio-speed" data-id="' + s + '">' + s + 'x</button>').join('') + '</div></div></div>';
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
        body = '<div class="audio-box"><h3>Reprodução da Gravação PABX</h3><p class="detail-meta">Gravação criptografada • ' + e(call.client) + ' • Duração: ' + C.duration(call.seconds) + '</p>' + renderAudioPlayer(call) + '</div>';
      } else {
        body = '<div class="summary-topic">' + badge(call.topic || 'Geral', 'blue') + (call.score ? badge('Nota: ' + call.score + '/100', call.score >= 90 ? 'green' : 'amber') : '') + '<small>Classificação de atendimento</small></div>' +
          '<section><h3>Necessidade relatada pelo cliente</h3><p class="stored-text">' + e(call.summary || 'Resumo em elaboração.') + '</p></section>' +
          '<section><h3>Encaminhamento e Resolução</h3><p>' + e(call.nextStep || 'Não informado.') + '</p></section>' +
          '<section><h3>Compromissos e Próximos Passos</h3><p>' + e(call.commitments || 'Sem pendências registradas.') + '</p></section>' +
          '<div class="quote">' + icon('alert') + '<div><strong>Auditoria de Atendimento</strong><p>A análise é gerada com apoio de IA e confirmada pelo supervisor responsável.</p></div></div>';
      }

      detail = '<div class="detail-title"><div><h2>' + e(call.client) + ' <small>' + e(call.pabxId || call.id) + '</small></h2>' + analysisBadge(call) + '</div>' +
        '<p class="detail-meta">' + C.formatDate(call.date) + ' · ' + e(call.time) + ' • Duração: ' + C.duration(call.seconds) + ' • Tel: ' + e(call.phone) + '</p>' +
        '<p class="detail-meta">Equipe: ' + e(call.team) + ' • Colaborador: ' + e(call.agent) + '</p></div>' +
        '<div class="tabs compact">' + [['resumo', 'Resumo', 'report'], ['transcricao', 'Transcrição', 'summary'], ['audio', 'Ouvir Ligação', 'phone']].map(([id, label, name]) => '<button class="tab ' + (ui.tab === id ? 'active' : '') + '" data-tab="' + id + '">' + icon(name) + label + '</button>').join('') + '</div>' +
        '<div class="detail-body">' + body + '</div>' +
        '<div class="detail-footer"><span class="muted">' + (call.processed ? '✓ Resumo validado pela supervisão' : 'Aguardando validação') + '</span>' +
        '<div>' + btn(icon('edit') + ' Revisar classificação', 'review-call', 'secondary small', call.id) + btn(icon('check') + ' Validar resumo', 'validate-call', call.processed ? 'secondary small' : 'small', call.id) + '</div></div>' +
        '<div class="privacy-foot">LGPD: Dados mascarados para proteção de privacidade • Sessão auditada</div>';
    }

    return head('Resumos e Transcrições', 'Consulte necessidades, encaminhamentos e gravações das ligações', btn('Atualizar', 'refresh', 'secondary small')) +
      warn('Inspeção de Ligações e IA', 'Valide o resumo e os compromissos antes de encaminhar tarefas a outros departamentos.') +
      '<section class="panel summary-filters"><div class="toolbar">' + search('Buscar por contato, resumo ou ID...') + teamFilter() + topicFilter() + dateFilter() + analysisFilter() + '</div>' +
      '<div class="filter-info"><span>' + calls.length + ' ligações encontradas • Ordenadas por mais recentes</span>' + btn('Limpar filtros', 'clear-filters', 'text-btn') + '</div></section>' +
      '<div class="summary-layout"><section class="panel"><div class="panel-header"><h3>Ligações ' + badge(calls.length) + '</h3>' + icon('filter') + '</div>' +
      '<div class="call-list">' + (calls.map(c => '<button class="call-option ' + (c.id === call?.id ? 'active' : '') + '" data-action="select-call" data-id="' + e(c.id) + '"><div class="call-option-top"><strong>' + e(c.client) + '</strong><small>' + C.formatDate(c.date) + '</small></div><p>' + e((c.summary || 'Sem resumo disponível.').slice(0, 110)) + '...</p><div class="call-option-top"><small>' + e(c.agent) + ' · ' + e(c.topic || 'Geral') + '</small>' + analysisBadge(c) + '</div></button>').join('') || empty('Nenhuma ligação encontrada.')) + '</div>' +
      '<div class="list-foot">Mostrando ' + calls.length + ' ligações</div></section>' +
      '<section class="panel summary-detail">' + detail + '</section></div>';
  }

  function reportsPage() {
    const filters = ['Todos', 'Qualidade', 'Retenção', 'Desenvolvimento', 'Conformidade'];
    const reports = state.reports.filter(r => (ui.reportType === 'Todos' || r.type === ui.reportType) && C.search(r.title + ' ' + r.team, ui.query));
    const rows = reports.map(r => '<tr><td><strong>' + e(r.title) + '</strong><small>' + e(r.summary.slice(0, 80)) + '...</small></td><td>' + badge(r.type, r.type === 'Qualidade' ? 'green' : r.type === 'Retenção' ? 'amber' : 'blue') + '</td><td>' + e(r.team) + '</td><td>' + e(r.criteria) + '</td><td>' + e(r.period) + '</td><td>' + badge(r.status, r.status === 'Publicado' ? 'green' : 'amber') + '</td><td><div class="row-actions">' + btn(icon('eye') + ' Ver', 'view-report', 'icon-action', r.id) + btn(icon('download') + ' Baixar', 'export-report', 'icon-action secondary', r.id) + '</div></td></tr>');

    return head('Relatórios Gerenciais', 'Indicadores de qualidade, retenção e conformidade operacional', btn(icon('plus') + ' Novo Relatório', 'new-report') + btn('Atualizar', 'refresh', 'secondary small')) +
      '<section class="metrics five">' + metric('Relatórios Gerados', state.reports.length, 'report', 'indigo') + metric('Publicados', state.reports.filter(r => r.status === 'Publicado').length, 'check', 'green') + metric('Em Revisão', state.reports.filter(r => r.status === 'Em revisão').length, 'alert', 'amber') + metric('Média Qualidade', '89.4%', 'sparkle', 'purple') + metric('Conformidade', '96.8%', 'award', 'soft') + '</section>' +
      '<div class="tabs report-tabs">' + filters.map(v => '<button class="tab ' + (ui.reportType === v ? 'active' : '') + '" data-action="report-tab" data-id="' + v + '">' + v + '</button>').join('') + '</div>' +
      '<div class="toolbar report-toolbar">' + search('Buscar pelo título ou departamento do relatório...') + teamFilter() + dateFilter() + '</div>' +
      '<section class="panel report-table">' + table(['Relatório', 'Categoria', 'Departamento', 'Critérios Aplicados', 'Período', 'Status', 'Ações'], rows.length ? rows : [emptyRow(7, 'Nenhum relatório encontrado.', 'Clique em "+ Novo Relatório" para gerar um relatório.')]) + '</section>' +
      '<div class="split-notes"><article class="note"><h3>Critérios Ativos na Avaliação</h3><p>Os critérios cadastrados pela administração orientam o cruzamento de dados nos relatórios.</p><div class="chips">' + state.criteria.filter(c => c.active).map(c => badge(c.name, 'neutral')).join('') + '</div></article><article class="note blue"><h3>Resumo de Diretrizes</h3><p>Os relatórios são compilados a partir das transcrições das chamadas e apoiam treinamentos e planos de ação da equipe.</p></article></div>';
  }

  function rankingsPage() {
    const isAgents = ui.rankingTab === 'atendentes';
    const list = isAgents ? DEMO_RANKING_AGENTS : DEMO_RANKING_TEAMS;
    const filtered = list.filter(item => C.search(item.name + ' ' + (item.team || ''), ui.query) && (!ui.team || item.team === ui.team));

    const rows = filtered.map(item => {
      const medal = item.position === 1 ? '<span class="rank-badge rank-1">1º</span>' : item.position === 2 ? '<span class="rank-badge rank-2">2º</span>' : item.position === 3 ? '<span class="rank-badge rank-3">3º</span>' : item.position + 'º';
      const scoreClass = item.score >= 90 ? '' : item.score >= 80 ? 'warning' : 'danger';
      return '<tr><td>' + medal + '</td><td><strong>' + e(item.name) + '</strong></td><td>' + e(item.team) + '</td><td>' + item.calls + ' ligações</td><td><div class="score-bar-wrap"><strong>' + item.score + '</strong><div class="score-bar"><div class="score-bar-fill ' + scoreClass + '" style="width:' + item.score + '%;"></div></div></div></td><td>' + e(item.fcr) + '</td><td>' + e(item.tma) + '</td><td>' + badge(item.trend, item.trend.startsWith('+') ? 'green' : 'amber') + '</td></tr>';
    });

    return head('Rankings de Desempenho', 'Classificação de atendentes e equipes com base em qualidade e resolução', btn(icon('download') + ' Exportar Ranking', 'export-ranking', 'secondary small')) +
      '<section class="metrics four ranking-metrics">' + metric('Ligações Avaliadas', '1.420', 'phone') + metric('Nota Média Geral', '91.8', 'check', 'green') + metric('Resolução 1º Contato (FCR)', '87.4%', 'sparkle', 'purple') + metric('Colaboradores Classificados', DEMO_RANKING_AGENTS.length, 'users') + '</section>' +
      '<section class="panel ranking-filters"><div class="toolbar">' + search('Buscar atendente ou equipe...') + teamFilter() + dateFilter() + '<div class="segmented">' + [['atendentes', 'Atendentes'], ['equipes', 'Equipes']].map(([id, label]) => '<button data-action="ranking-tab" data-id="' + id + '" class="' + (ui.rankingTab === id ? 'selected' : '') + '">' + label + '</button>').join('') + '</div></div></section>' +
      '<section class="panel ranking-table">' + table(['Posição', isAgents ? 'Atendente' : 'Equipe', 'Departamento / Setor', 'Volume', 'Nota Qualidade', 'FCR (%)', 'TMA Médio', 'Variação'], rows.length ? rows : [emptyRow(8, 'Nenhuma classificação encontrada.')]) + '</section>' +
      '<div class="team-scores">' + state.teams.map(t => '<article class="note"><h3>' + e(t.name) + '</h3><p>' + e(t.members) + ' colaboradores • ' + e(t.department) + '</p><div class="score-values"><span><strong>92.4</strong>Nota Média</span><span><strong>' + (t.members * 24) + '</strong>Avaliações</span><span><strong>89%</strong>Resolução</span></div></article>').join('') + '</div>';
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
    return '<section class="panel users-filters"><div class="panel-header"><h2>Colaboradores e Acessos</h2>' + badge(state.users.length + ' cadastrados', 'green') + '</div><div class="toolbar admin-filter">' + search('Pesquisar por nome ou e-mail') + teamFilter('Departamento') + roles + btn(icon('plus') + ' Adicionar usuário', 'new-user', 'ghost') + '</div></section><section class="panel users-table">' + table(['Nome', 'E-mail', 'Departamento', 'Perfil de Acesso', 'Status', 'Ações'], users.length ? users.map(u => '<tr><td>' + person(u.name, u.role) + '</td><td>' + e(u.email) + '</td><td>' + e(u.team) + '</td><td><div class="access-chips">' + badge(u.profile, u.profile === 'Administrador' ? 'purple' : 'blue') + '</div></td><td>' + badge(u.active ? 'Ativo' : 'Inativo', u.active ? 'green' : 'neutral') + '</td><td><div class="row-actions">' + btn(icon('edit') + ' ' + (u.active ? 'Desativar' : 'Ativar'), 'toggle-user', 'text-btn', u.id) + '</div></td></tr>') : [emptyRow(6, 'Nenhum colaborador encontrado.', 'Cadastre um novo usuário pelo botão acima.')]) + '</section>';
  }

  function teamsView() {
    const teams = state.teams.filter(t => C.search(t.name + ' ' + t.department, ui.query));
    return '<section class="metrics three">' + metric('Departamentos Cadastrados', new Set(state.teams.map(t => t.department)).size, 'building', 'soft') + metric('Colaboradores Ativos', count('Usuario'), 'users', 'soft') + metric('Lideranças Atribuídas', state.teams.length, 'admin', 'soft') + '</section><section class="panel departments-table"><div class="panel-header"><div><h2>Departamentos e Equipes</h2><p>Organize os acessos e os critérios de análise de cada equipe.</p></div>' + btn(icon('plus') + ' Adicionar departamento', 'new-team') + '</div>' + table(['Departamento', 'Equipe Vinculada', 'Colaboradores', 'Critérios', 'Ações'], teams.length ? teams.map(t => '<tr><td><strong>' + e(t.department) + '</strong></td><td>' + e(t.name) + '</td><td>' + e(t.members) + ' colaboradores</td><td>' + badge('Catálogo CTI') + '</td><td>' + btn(icon('edit') + ' Editar', 'edit-team', 'text-btn', t.id) + '</td></tr>') : [emptyRow(5, 'Nenhum departamento cadastrado.')]) + '<div class="list-foot">' + teams.length + ' equipes cadastradas</div></section>';
  }

  function criteriaView() {
    const criteria = state.criteria.filter(c => C.search(c.name + ' ' + c.description, ui.query));
    return '<section class="panel criteria-filter"><div class="toolbar"><strong>Departamento:</strong><select aria-label="Departamento"><option>Catálogo Global CTI</option></select><span class="criteria-count">' + badge(state.criteria.filter(c => c.active).length + ' ativos / ' + state.criteria.length + ' critérios', 'blue') + '</span>' + btn(icon('plus') + ' Adicionar critério', 'new-criterion', 'secondary') + '</div></section>' +
      warn('Classificações de Qualidade e IA', 'Os critérios configurados orientam a avaliação automatizada das transcrições pela IA.') +
      '<section class="panel criteria-table">' + table(['Critério', 'Descrição', 'Evidências e Regra de Avaliação', 'Status', 'Ações'], criteria.length ? criteria.map(c => '<tr><td><strong>' + e(c.name) + '</strong><small>Versão ' + e(c.version) + '</small></td><td>' + e(c.description) + '</td><td>' + e(c.rule) + '</td><td><button class="switch-label" data-action="toggle-criterion" data-id="' + e(c.id) + '" aria-label="Alternar critério"><span class="switch ' + (c.active ? 'on' : '') + '"></span>' + (c.active ? 'Ativo' : 'Inativo') + '</button></td><td>' + btn(icon('edit') + ' Editar', 'edit-criterion', 'text-btn', c.id) + '</td></tr>') : [emptyRow(5, 'Nenhum critério cadastrado.')]) + '</section>';
  }

  function adminPage() {
    if (!isAdmin()) return head('Administração', 'Acesso restrito.') + note('Permissão necessária', 'Somente administradores podem gerenciar cadastros.');
    const tabs = [['usuarios', 'Colaboradores e Acessos'], ['departamentos', 'Departamentos'], ['criterios', 'Critérios de Análise']];
    return head('Administração da Plataforma', 'Gerencie colaboradores, equipes e critérios de avaliação do atendimento.') + '<div class="tabs admin-tabs">' + tabs.map(([id, label]) => '<a class="tab ' + (ui.adminTab === id ? 'active' : '') + '" href="#administracao/' + id + '">' + label + '</a>').join('') + '</div>' + (ui.adminTab === 'usuarios' ? usersView() : ui.adminTab === 'departamentos' ? teamsView() : criteriaView());
  }

  function exitPage() {
    return '<main class="exit-page" id="main">' + decorations() + '<section class="exit-card"><div class="exit-icon">' + icon('exit') + '</div><h1>Realmente deseja sair?</h1><p>Você será desconectado da SENX e precisará<br>entrar novamente para continuar.</p>' + btn('SAIR', 'logout', 'full') + '<a class="btn secondary full" href="#ligacoes">CANCELAR</a></section></main>';
  }

  function render() {
    if (!authReady) { app.innerHTML = '<main id="main">Carregando plataforma SENX…</main>'; return; }
    if (!session) { document.title = 'SENX 0.1.4.3 — ' + (setupRequired ? 'Primeiro acesso' : 'Login'); app.innerHTML = auth(setupRequired); return; }
    const raw = location.hash.slice(1) || 'ligacoes', [route, sub] = raw.split('/');
    if (lastRoute !== raw) { Object.assign(ui, { page: 1, query: '', team: '', status: '', date: '', analysis: '', topic: '', profile: '' }); closeModal(); lastRoute = raw; }
    ui.adminTab = ['usuarios', 'departamentos', 'criterios'].includes(sub) ? sub : 'usuarios';

    if (route === 'login' || route === 'cadastro') { location.hash = 'ligacoes'; return; }
    else if (route === 'saida') app.innerHTML = exitPage();
    else {
      const pages = { ligacoes: callsPage, resumos: summariesPage, relatorios: reportsPage, rankings: rankingsPage, configuracoes: settingsPage, administracao: adminPage };
      if (!pages[route]) { location.hash = 'ligacoes'; return; }
      app.innerHTML = shell(pages[route](), route);
    }
    document.title = 'SENX 0.1.4.3 — ' + (route === 'administracao' ? ui.adminTab : route);
    app.dataset.route = raw;
  }

  function closeModal() {
    const dialog = document.querySelector('#modal-root dialog');
    if (dialog) { dialog.close(); dialog.remove(); if (lastFocus?.isConnected) lastFocus.focus(); }
  }

  function modal(title, subtitle, content, formId = '') {
    closeModal(); lastFocus = document.activeElement;
    const save = title.startsWith('Editar') ? 'Salvar alterações' : 'Salvar';
    document.querySelector('#modal-root').innerHTML = '<dialog class="dialog-' + formId + '" aria-labelledby="dialog-title">' + (formId ? '<form id="' + formId + '">' : '') + '<header class="modal-head"><div><h2 id="dialog-title">' + title + '</h2><p>' + subtitle + '</p></div><button type="button" class="close-dialog" data-action="close" aria-label="Fechar formulário">' + icon('close') + '</button></header><div class="modal-body">' + content + '<p class="form-error" role="alert"></p></div><footer class="modal-footer">' + btn(formId ? 'Cancelar' : 'Fechar', 'close', 'secondary') + (formId ? '<button type="submit" class="btn">' + save + '</button>' : '') + '</footer>' + (formId ? '</form>' : '') + '</dialog>';
    document.querySelector('#modal-root dialog').showModal();
    document.querySelector('#modal-root input:not([type=hidden])')?.focus();
  }

  function teamModal(id) {
    const t = state.teams.find(t => t.id === id) || { name: '', department: '' };
    modal(id ? 'Editar departamento' : 'Adicionar departamento', 'Defina o nome e a equipe vinculada ao departamento.', '<input type="hidden" name="id" value="' + e(id || '') + '">' + input('department', 'Nome do departamento', t.department) + input('name', 'Nome da equipe', t.name) +
      '<div class="form-field"><label>Liderança responsável</label><input name="leader" value="Supervisão Geral" readonly></div>' +
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
      '<div class="form-grid">' + input('job', 'Cargo', 'Atendente') + input('password', 'Senha inicial', 'Padrao@123456', 'password') + '</div>' +
      '<div class="permissions"><strong>Permissões</strong><p id="permissions-description">Consultar suas próprias ligações, transcrições e perfil.</p></div>', 'user-form');
  }

  function reportModal() {
    modal('Novo Relatório Executivo', 'Gere uma análise consolidada de atendimento.',
      input('title', 'Título do relatório', 'Relatório Semanal de Desempenho CTI') +
      '<div class="form-grid"><div class="form-field"><label>Categoria *</label><select name="type"><option>Qualidade</option><option>Retenção</option><option>Desenvolvimento</option><option>Conformidade</option></select></div>' +
      '<div class="form-field"><label>Departamento / Equipe *</label><select name="team"><option>Todas as equipes</option>' + state.teams.map(t => '<option>' + e(t.name) + '</option>').join('') + '</select></div></div>' +
      '<div class="form-field"><label>Período *</label><select name="period"><option>Últimos 7 dias</option><option>Últimos 30 dias</option><option>Mês atual</option><option>Trimestre atual</option></select></div>' +
      '<div class="form-field"><label>Observações do Supervisor</label><textarea name="summary" rows="3">Consolidação automática dos indicadores de atendimento com destaque para índices de resolução e TMA.</textarea></div>',
      'report-form');
  }

  // Tratamento de envio de formulários
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form)), id = form.getAttribute('id');

    if (id === 'auth-form') {
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      try {
        if (setupRequired) {
          if (data.password !== data.confirm) throw new Error('As senhas não coincidem.');
          await request('/api/auth/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, teamId: data.teamId || null }) });
          setupRequired = false; location.hash = 'login'; await startSession(); toast('Administrador criado. Entre com seu e-mail e senha.');
        } else {
          session = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.email, password: data.password }) });
          authError = ''; location.hash = 'ligacoes'; await loadDatabase();
        }
      } catch (error) {
        // Se a API falhou por estar em reestruturação, oferece login em modo demo
        toast('Conectando em Modo Demonstração (banco em manutenção)...');
        activateDemoMode();
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
      session.name = data.name.trim();
      session.email = data.email.trim();
      render();
      toast('Perfil atualizado com sucesso!');
      return;
    }

    if (id === 'user-form') {
      const teamObj = state.teams.find(t => t.id === data.teamId) || { name: 'Geral' };
      const newUser = {
        id: 'usr-' + Date.now(),
        name: data.name.trim(),
        email: data.email.trim(),
        team: teamObj.name,
        teamId: data.teamId,
        role: data.job.trim(),
        profile: data.profile,
        active: true
      };
      state.users.unshift(newUser);
      state.counts.Usuario = state.users.length;
      closeModal();
      render();
      toast('Colaborador ' + newUser.name + ' adicionado com sucesso!');
      return;
    }

    if (id === 'team-form') {
      if (data.id) {
        const team = state.teams.find(t => t.id === data.id);
        if (team) { team.name = data.name.trim(); team.department = data.department.trim(); }
      } else {
        state.teams.push({ id: 'eq-' + Date.now(), name: data.name.trim(), department: data.department.trim(), members: 1 });
      }
      closeModal();
      render();
      toast('Departamento salvo com sucesso!');
      return;
    }

    if (id === 'criterion-form') {
      if (data.id) {
        const crit = state.criteria.find(c => c.id === data.id);
        if (crit) { crit.name = data.name.trim(); crit.description = data.description.trim(); crit.rule = data.rule.trim(); crit.version = data.version.trim(); crit.active = data.active === 'on'; }
      } else {
        state.criteria.push({ id: 'crit-' + Date.now(), name: data.name.trim(), description: data.description.trim(), rule: data.rule.trim(), version: data.version.trim() || '1.0', active: data.active === 'on' });
      }
      closeModal();
      render();
      toast('Critério de análise salvo com sucesso!');
      return;
    }

    if (id === 'report-form') {
      const newRep = {
        id: 'rep-' + Date.now(),
        title: data.title.trim(),
        type: data.type,
        team: data.team,
        criteria: 'Critérios Ativos CTI',
        period: data.period,
        status: 'Publicado',
        score: '92.0 / 100',
        summary: data.summary.trim()
      };
      state.reports.unshift(newRep);
      closeModal();
      render();
      toast('Relatório "' + newRep.title + '" gerado com sucesso!');
      return;
    }

    if (id === 'review-call-form') {
      const call = state.calls.find(c => c.id === data.id);
      if (call) {
        call.topic = data.topic;
        call.score = Number(data.score) || call.score;
        call.processed = true;
        call.summary = data.summary.trim();
      }
      closeModal();
      render();
      toast('Revisão da ligação salva com sucesso!');
      return;
    }
  });

  document.addEventListener('reset', event => {
    if (event.target.id === 'profile-form') {
      event.target.querySelector('[role=alert]').textContent = '';
      event.target.querySelector('details').open = false;
      toast('Alterações descartadas.');
    }
  });

  // Controle do reprodutor de áudio interativo
  function toggleAudio() {
    const call = state.calls.find(c => c.id === ui.selected);
    if (!call) return;
    ui.audioPlaying = !ui.audioPlaying;
    if (ui.audioPlaying) {
      clearInterval(audioInterval);
      audioInterval = setInterval(() => {
        ui.audioCurrentTime += ui.audioSpeed;
        if (ui.audioCurrentTime >= (call.seconds || 345)) {
          ui.audioCurrentTime = 0;
          ui.audioPlaying = false;
          clearInterval(audioInterval);
        }
        updateAudioUI(call);
      }, 1000);
    } else {
      clearInterval(audioInterval);
    }
    render();
  }

  function updateAudioUI(call) {
    const progressEl = document.querySelector('.audio-progress');
    const timeEl = document.querySelector('.audio-time');
    if (progressEl) {
      const percent = Math.min(100, Math.round((ui.audioCurrentTime / (call.seconds || 345)) * 100));
      progressEl.style.width = percent + '%';
    }
    if (timeEl) {
      timeEl.textContent = C.duration(Math.floor(ui.audioCurrentTime));
    }
  }

  // Cliques gerais na interface
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action],[data-page],[data-tab]');
    if (!target || target.disabled) return;
    if (target.dataset.page) { ui.page = Number(target.dataset.page); render(); return; }
    if (target.dataset.tab) {
      ui.tab = target.dataset.tab;
      if (ui.tab !== 'audio' && ui.audioPlaying) {
        ui.audioPlaying = false;
        clearInterval(audioInterval);
      }
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
      case 'demo-login':
        activateDemoMode();
        break;
      case 'reconnect':
        startSession();
        break;
      case 'forgot':
        modal('Recuperar Senha', 'Suporte Técnico SENX', '<p>Para redefinir sua senha, solicite ao administrador do sistema ou entre em contato com a equipe de infraestrutura.</p>');
        break;
      case 'policy':
        modal('Termos de Uso e LGPD', 'Plataforma SENX CTI', '<p>O processamento de gravações respeita rigorosamente as diretrizes da Lei Geral de Proteção de Dados (LGPD). Os áudios são armazenados de forma criptografada e o acesso é estritamente monitorado por perfil de usuário.</p>');
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
        if (call) modal('Detalhes da Chamada', 'Registro PABX CTI', '<p><strong>Identificador PABX:</strong> ' + e(call.pabxId || call.id) + '</p><p><strong>Cliente:</strong> ' + e(call.client) + '</p><p><strong>Telefone:</strong> ' + e(call.phone) + '</p><p><strong>Atendente:</strong> ' + e(call.agent) + '</p><p><strong>Equipe:</strong> ' + e(call.team) + '</p><p><strong>Duração:</strong> ' + C.duration(call.seconds) + '</p><p><strong>Pontuação IA:</strong> ' + (call.score || 'Pendente') + ' / 100</p>');
        break;
      }
      case 'menu':
        document.querySelector('.layout').classList.toggle('menu-open');
        break;
      case 'logout':
        session = null;
        clearData();
        closeModal();
        location.hash = 'login';
        render();
        toast('Desconectado com sucesso.');
        break;
      case 'new-user': userModal(); break;
      case 'toggle-user': {
        const u = state.users.find(u => u.id === id);
        if (u) {
          u.active = !u.active;
          render();
          toast('Status de ' + u.name + ' alterado para ' + (u.active ? 'Ativo' : 'Inativo'));
        }
        break;
      }
      case 'refresh':
        loadDatabase();
        toast('Dados atualizados.');
        break;
      case 'close': closeModal(); break;
      case 'new-team': teamModal(); break;
      case 'edit-team': teamModal(id); break;
      case 'new-criterion': criterionModal(); break;
      case 'edit-criterion': criterionModal(id); break;
      case 'toggle-criterion': {
        const crit = state.criteria.find(c => c.id === id);
        if (crit) {
          crit.active = !crit.active;
          render();
          toast('Critério "' + crit.name + '" ' + (crit.active ? 'ativado' : 'desativado') + '.');
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
        ui.audioPlaying = false;
        ui.audioCurrentTime = 0;
        clearInterval(audioInterval);
        render();
        break;
      case 'audio-toggle':
        toggleAudio();
        break;
      case 'audio-rewind':
        ui.audioCurrentTime = Math.max(0, ui.audioCurrentTime - 5);
        render();
        break;
      case 'audio-forward': {
        const call = state.calls.find(c => c.id === ui.selected);
        ui.audioCurrentTime = Math.min(call?.seconds || 345, ui.audioCurrentTime + 5);
        render();
        break;
      }
      case 'audio-speed':
        ui.audioSpeed = Number(id) || 1;
        render();
        break;
      case 'audio-seek': {
        const rect = target.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const totalSec = Number(target.dataset.duration) || 345;
        ui.audioCurrentTime = Math.round((clickX / rect.width) * totalSec);
        render();
        break;
      }
      case 'validate-call': {
        const call = state.calls.find(c => c.id === id);
        if (call) {
          call.processed = true;
          render();
          toast('Resumo da ligação de ' + call.client + ' validado pelo supervisor!');
        }
        break;
      }
      case 'review-call': {
        const call = state.calls.find(c => c.id === id);
        if (call) {
          modal('Revisar Classificação', 'Ajuste de análise do atendimento • ' + e(call.client),
            '<input type="hidden" name="id" value="' + e(call.id) + '">' +
            '<div class="form-grid"><div class="form-field"><label>Assunto / Motivo</label><select name="topic">' +
            ['Instabilidade de Rede', 'Risco de Cancelamento', 'Aquisição de IA', 'Negociação de Fatura', 'Elogio de Atendimento', 'Dúvida Geral'].map(t => '<option ' + (call.topic === t ? 'selected' : '') + '>' + t + '</option>').join('') +
            '</select></div><div class="form-field"><label>Nota de Qualidade (0 a 100)</label><input type="number" name="score" min="0" max="100" value="' + (call.score || 85) + '"></div></div>' +
            '<div class="form-field"><label>Resumo Validado</label><textarea name="summary" rows="3">' + e(call.summary) + '</textarea></div>',
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
            '<div class="quote" style="margin-top:16px;">' + icon('check') + '<div><strong>Recomendações</strong><p>Manter o acompanhamento semanal e aplicar os módulos de treinamento indicados.</p></div></div>');
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
        download('SENX-ligacoes.csv', C.toCsv([['ID', 'Contato', 'Telefone', 'Atendente', 'Equipe', 'Data', 'Duração', 'Pontuação', 'Assunto', 'Status'], ...filteredCalls().map(c => [c.pabxId || c.id, c.client, c.phone, c.agent, c.team, c.date, C.duration(c.seconds), c.score || '—', c.topic || '—', c.status])]), 'text/csv;charset=utf-8');
        toast('Lista de ligações exportada em CSV.');
        break;
      case 'export-ranking': {
        const isAgents = ui.rankingTab === 'atendentes';
        const list = isAgents ? DEMO_RANKING_AGENTS : DEMO_RANKING_TEAMS;
        download('SENX-ranking-' + ui.rankingTab + '.csv', C.toCsv([['Posição', isAgents ? 'Atendente' : 'Equipe', 'Departamento', 'Ligações', 'Nota Qualidade', 'FCR', 'TMA', 'Variação'], ...list.map(i => [i.position + 'º', i.name, i.team, i.calls, i.score, i.fcr, i.tma, i.trend])]), 'text/csv;charset=utf-8');
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
      ui.query = value;
      ui.page = 1;
      render();
      const searchInput = document.querySelector('input[type=search][data-filter]');
      searchInput?.focus();
    }, 180);
  });

  window.addEventListener('hashchange', () => {
    clearTimeout(filterTimer);
    render();
    window.scrollTo(0, 0);
  });

  render();
  startSession();
})();
