
/* SENX 0.1.4.2 — consulta PostgreSQL, sem persistência ou dados de negócio locais. */
(() => {
  'use strict';
  const C=window.SenxCore, state=window.SenxData, e=C.escapeHtml;
  const ui={page:1,query:'',team:'',status:'',date:'',selected:null,tab:'resumo',adminTab:'usuarios',analysis:'',topic:'',profile:'',reportType:'Todos',rankingTab:'atendentes'};
  const app=document.querySelector('#app');
  let connection='loading',connectionDetail='',lastRoute='',toastTimer,lastFocus;
  let session=null, authReady=false, setupRequired=false, setupTeams=[], authError='';
  const request=window.SenxSession.request;
  const isAdmin=()=>session?.profile==='Administrador';
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

  const icon=name=>'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.info)+'</svg>';
  const brand=()=>'<div class="brand"><img src="assets/senx-symbol.png" alt=""><img src="assets/senx-wordmark.png" alt="SENX"></div>';
  const btn=(text,action,style='',id='')=>'<button type="button" class="btn '+style+'" data-action="'+action+'" data-id="'+e(id)+'">'+text+'</button>';
  const badge=(text,tone='blue')=>'<span class="badge '+tone+'">'+e(text)+'</span>';
  const empty=(title='Nenhum registro no banco.',text='Cadastre os dados de teste para começar.')=>'<div class="empty-state"><strong>'+e(title)+'</strong><p>'+e(text)+'</p></div>';
  const input=(name,label,value='',type='text')=>'<div class="form-field"><label for="field-'+name+'">'+label+' *</label><input id="field-'+name+'" name="'+name+'" type="'+type+'" value="'+e(value)+'" maxlength="'+(type==='password'?128:name==='name'?200:255)+'" '+(type==='password'?'minlength="12" autocomplete="new-password"':'')+' required></div>';
  const person=(name,subtitle='')=>'<div class="person"><span class="avatar">'+e(C.initials(name||'?'))+'</span><div><strong>'+e(name||'Não informado')+'</strong><small>'+e(subtitle)+'</small></div></div>';
  const unavailable=(label,reason='Disponível em uma próxima etapa.',style='secondary')=>'<button type="button" class="btn '+style+'" disabled title="'+e(reason)+'">'+label+'</button>';
  const warn=(title,text)=>'<div class="banner warning">'+icon('alert')+'<div><strong>'+e(title)+'</strong><small>'+e(text)+'</small></div></div>';
  const emptyRow=(columns,title,text='')=>'<tr class="empty-row"><td colspan="'+columns+'">'+empty(title,text)+'</td></tr>';
  const analysisLabel=c=>c.processed===true?'Concluída':c.processed===false?'Em análise':'Não analisada';
  const analysisBadge=c=>badge(analysisLabel(c),c.processed===true?'green':c.processed===false?'purple':'neutral');
  const field=(label,control,extra='')=>'<label class="field-control '+extra+'"><span>'+label+'</span>'+control+'</label>';
  const pendingSelect=(label,description)=>field(label,'<select disabled title="'+e(description)+'"><option>'+e(description)+'</option></select>');
  const privacy=()=>'<div class="privacy-foot">Acesso conforme seu perfil • Dados pessoais protegidos</div>';
  const note=(title,text)=>'<div class="banner info">'+icon('info')+'<div><strong>'+e(title)+'</strong><small>'+e(text)+'</small></div></div>';
  function toast(text){const box=document.querySelector('#toast');box.textContent=text;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),5500);}
  function download(name,text,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=Object.assign(document.createElement('a'),{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function clearData() {
    Object.assign(state,{calls:[],teams:[],users:[],criteria:[],counts:{},reports:[],rankings:[],source:null,fetchedAt:null});
  }
  async function startSession() {
    authError='';
    try {
      const status=await request('/api/auth/status');
      setupRequired=status.setupRequired;setupTeams=status.teams;
      if(!setupRequired) {
        try {session=await request('/api/auth/session');}
        catch(error){if(error.status!==401)throw error;session=null;}
      }
      authReady=true;render();
      if(session)await loadDatabase();
    }catch(error){authError=error.message;authReady=true;render();}
  }
  window.addEventListener('senx-session-expired',()=>{session=null;clearData();closeModal();render();});
  async function loadDatabase() {
    if(!session)return;
    connection='loading';render();
    try {
      const data=await request('/api/data/snapshot');
      if(data.source!=='postgresql'||!['calls','teams','users','criteria'].every(k=>Array.isArray(data[k])))throw new Error('Contrato de dados inválido.');
      Object.assign(state,data);state.reports=[];state.rankings=[];connection='connected';connectionDetail='';
      if(!state.calls.some(c=>c.id===ui.selected))ui.selected=state.calls[0]?.id||null;
    }catch(error) {
      Object.assign(state,{calls:[],teams:[],users:[],criteria:[],counts:{},reports:[],rankings:[],source:null,fetchedAt:null});
      if(error.status===401)session=null;
      connection='error';connectionDetail=error.message;
    }
    render();
  }
  const connected=()=>connection==='connected';
  const count=name=>connected()?(state.counts[name]??0):'—';
  const metric=(label,value,name,tone='blue',caption='')=>'<article class="metric"><span class="metric-icon '+tone+'">'+icon(name)+'</span><div><label>'+label+'</label><strong>'+e(value)+'</strong><small>'+e(caption)+'</small></div></article>';
  function head(title,subtitle,actions='') {
    const stamp=state.fetchedAt?new Date(state.fetchedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Aguardando atualização';
    return '<header class="page-head"><div><h1>'+title+'</h1><p>'+subtitle+'</p></div><div class="head-actions"><span class="updated-stamp">'+e(state.fetchedAt?'Atualizado em '+stamp:stamp)+'</span>'+actions+'</div></header>';
  }
  const teamOptions=()=>state.teams.map(t=>'<option value="'+e(t.name)+'" '+(ui.team===t.name?'selected':'')+'>'+e(t.name)+'</option>').join('');
  const search=(placeholder='Pesquisar',label='Buscar')=>'<label class="field-control search"><span>'+label+'</span><div class="input-icon">'+icon('search')+'<input type="search" data-filter="query" value="'+e(ui.query)+'" placeholder="'+placeholder+'"></div></label>';
  const teamFilter=(label='Equipe')=>field(label,'<div class="input-icon">'+icon('users')+'<select data-filter="team"><option value="">Todas as equipes</option>'+teamOptions()+'</select></div>');
  const dateFilter=()=>field('Período','<input aria-label="Período" type="date" data-filter="date" value="'+e(ui.date)+'">');
  const analysisFilter=()=>field('Análise / revisão','<select data-filter="analysis"><option value="">Todos os estados</option>'+['Concluída','Em análise','Não analisada'].map(v=>'<option '+(ui.analysis===v?'selected':'')+'>'+v+'</option>').join('')+'</select>');
  const topicFilter=()=>field('Assunto','<select data-filter="topic"><option value="">Todos os assuntos</option>'+[...new Set(state.calls.map(c=>c.topic).filter(Boolean))].map(v=>'<option '+(ui.topic===v?'selected':'')+'>'+e(v)+'</option>').join('')+'</select>');
  const filteredCalls=()=>C.filterCalls(state.calls,ui).filter(c=>(!ui.analysis||analysisLabel(c)===ui.analysis)&&(!ui.topic||c.topic===ui.topic));
  function pager(result,label='registros') {
    const pages=Array.from({length:Math.min(result.pages,3)},(_,i)=>Math.max(1,Math.min(result.page-1,result.pages-2))+i);
    return '<div class="pagination"><span>Mostrando '+result.items.length+' de '+result.total+' '+label+'</span><div class="pages"><button data-page="'+(result.page-1)+'" '+(result.page<=1?'disabled':'')+' aria-label="Página anterior">‹</button>'+pages.map(p=>'<button data-page="'+p+'" class="'+(result.page===p?'selected':'')+'" aria-label="Página '+p+'">'+p+'</button>').join('')+'<button data-page="'+(result.page+1)+'" '+(result.page>=result.pages?'disabled':'')+' aria-label="Próxima página">›</button></div></div>';
  }
  function table(headers,rows,extra='') {return '<div class="table-wrap '+extra+'"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';}
  function shell(content,active) {
    const nav=[['ligacoes','Ligações','phone'],['relatorios','Relatórios','report'],['resumos','Resumos','summary'],['rankings','Rankings','ranking'],['configuracoes','Configurações','settings'],['administracao','Administração','admin']].filter(([route])=>route!=='administracao'||isAdmin());
    const banner=connection==='error'?note('Conexão indisponível',connectionDetail):'';
    return '<div class="layout screen-'+active+'"><div class="mobile-bar">'+btn(icon('menu')+'<span class="sr-only">Menu principal</span>','menu','secondary small')+'<strong>SENX</strong><a href="#configuracoes" aria-label="Meu perfil">'+icon('users')+'</a></div><aside class="sidebar"><a class="brand-link" href="#ligacoes" aria-label="SENX — Ligações">'+brand()+'</a><nav class="nav-list" aria-label="Menu principal">'+nav.map(([route,label,name])=>'<a href="#'+route+'" class="nav-link '+(active===route?'active':'')+'" '+(active===route?'aria-current="page"':'')+'>'+icon(name)+label+'</a>').join('')+'</nav><div class="sidebar-bottom"><a href="#configuracoes" class="sidebar-person">'+person(session.name,session.job)+'</a><div class="sidebar-note"><strong>LGPD • Acesso restrito</strong><p>Gravações protegidas conforme<br>a política de privacidade vigente.</p><small>v0.1.4.2</small></div></div></aside><main class="content" id="main" tabindex="-1">'+banner+content+'</main></div>';
  }
  function decorations(){return '<span class="decoration diamond one"></span><span class="decoration diamond two"></span><span class="decoration sphere one"></span><span class="decoration sphere two"></span>';}
  function passwordField(name,label,placeholder,setup=false){
    const id=name==='password'?'login-password':'field-'+name;
    return '<div class="form-field"><label for="'+id+'">'+label+'</label><div class="password-wrap"><input id="'+id+'" name="'+name+'" type="password" maxlength="128" '+(setup?'minlength="12" autocomplete="new-password"':'autocomplete="current-password"')+' placeholder="'+placeholder+'" required><button type="button" data-action="toggle-password" data-id="'+id+'" aria-label="Mostrar '+label.toLowerCase()+'">'+icon('eye')+'</button></div></div>';
  }
  function auth(setup=false) {
    const register=setup||location.hash==='#cadastro';
    const team=setupTeams.length?'<div class="form-field"><label for="setup-team">Equipe *</label><select id="setup-team" name="teamId" required>'+setupTeams.map(t=>'<option value="'+e(t.id)+'">'+e(t.name)+'</option>').join('')+'</select></div>':input('teamName','Nome da equipe')+input('department','Departamento');
    const headline=register?'Crie Sua Conta e<br>Comece a Transformar<br>Seus Dados ↗':'Transforme Sua Rotina<br>Complicada Em Uma<br>Experiência Mais<br>Simples ↗';
    const help=register?'<label class="consent"><input type="checkbox" disabled title="Documentos de uso ainda não publicados."><span>Concordo com os <button type="button" data-action="policy">Termos de Uso</button> e a <button type="button" data-action="policy">Política de Privacidade</button></span></label>':'<div class="auth-help"><label title="A sessão atual dura até 8 horas."><input type="checkbox" role="switch" disabled><span>Lembre-me</span></label><button type="button" data-action="forgot">Esqueceu a senha?</button></div>';
    return '<div class="auth '+(register?'auth-register':'auth-login')+'"><section class="auth-story">'+decorations()+'<div class="auth-copy"><h1>'+headline+'</h1><p>A SENX é uma plataforma avançada de análise de dados impulsionada por IA, projetada para transformar a maneira como as empresas compreendem e aproveitam seus dados.</p></div></section><main id="main" class="auth-panel"><div class="auth-card '+(setup?'setup-card':'')+'">'+brand()+'<h2>'+(register?'Crie sua conta':'Bem-Vindo de volta!')+'</h2>'+(register?'<p>Preencha os campos abaixo para se cadastrar</p>':'')+'<form id="auth-form">'+(register?'<div class="form-field"><label for="field-name">Nome completo</label><input id="field-name" name="name" maxlength="200" placeholder="Seu nome completo" autocomplete="name" required></div>':'')+'<div class="form-field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" maxlength="255" placeholder="'+(register?'seu@email.com':'Email')+'" autocomplete="username" required></div>'+passwordField('password','Senha',register?'Crie uma senha':'Senha',register)+(register?passwordField('confirm','Confirmar senha','Confirme sua senha',true):'')+(setup?team:'')+help+'<p class="form-error" role="alert">'+e(authError)+'</p><button class="btn full" type="submit" '+(register&&!setup?'disabled title="Novas contas são criadas pelo administrador."':'')+'>'+(register?'Criar Conta':'Login')+'</button></form><div class="auth-footer">'+(register?'Já tem uma conta? <a href="#login">Faça login</a>':'<a href="#cadastro">Crie uma conta</a>')+'</div>'+(setup?'<div class="auth-notice">Primeiro acesso: crie o administrador com senha de 12 a 128 caracteres.</div>':register?'<div class="auth-notice">Solicite seu acesso ao administrador da SENX.</div>':'')+'</div></main></div>';
  }
  function callsPage() {
    const result=C.paginate(filteredCalls(),ui.page);
    const analyzed=state.calls.filter(c=>c.processed===true).length;
    const average=state.calls.length?C.duration(Math.round(state.calls.reduce((n,c)=>n+(Number(c.seconds)||0),0)/state.calls.length)):'—';
    const rows=result.items.map(c=>'<tr><td>'+person(c.client,c.team)+'</td><td>'+e(c.phone)+'</td><td>'+C.formatDate(c.date)+' '+e(c.time)+'</td><td>'+C.duration(c.seconds)+'</td><td class="muted">—</td><td>'+badge(c.topic||'Não informado','neutral')+'</td><td>'+analysisBadge(c)+'</td><td><div class="row-actions">'+btn(icon('play')+'<span class="sr-only">Ver ligação</span>','call','icon-action',c.id)+btn(icon('more')+'<span class="sr-only">Mais informações da ligação</span>','call-info','icon-action secondary',c.id)+'</div></td></tr>');
    return head('Análise de Ligações','Triagem das gravações PABX • Análises sujeitas à validação humana',btn('Atualizar','refresh','secondary small'))+
      warn('Análises e indícios de IA sujeitos à validação humana','Confira as evidências antes de agir — sentimento não é conclusão definitiva.')+
      '<section class="metrics five">'+metric('Total de Ligações',count('Ligacao'),'phone')+metric('Analisadas (IA)',connected()?analyzed:'—','summary','indigo','No recorte consultado')+metric('Ligações Críticas','—','alert','red','Classificação pendente')+metric('Satisfação Estimada','—','check','green','Indicador ainda indisponível')+metric('Duração Média',average,'clock','purple','No recorte consultado')+'</section>'+
      '<section class="panel calls-filters"><div class="toolbar">'+search('Pesquisar pelo nome do contato...')+teamFilter('Todas as ligações')+analysisFilter()+dateFilter()+btn(icon('download')+' Exportar','export-calls')+'</div></section>'+
      '<section class="panel calls-table">'+table(['Contato','Telefone','Data / hora ↓','Duração','Indício (IA)','Assunto / motivo','Análise','Ações'],rows.length?rows:[emptyRow(8,'Nenhuma ligação encontrada.','As gravações e análises aparecerão aqui quando estiverem disponíveis no banco.')])+
      '<div class="legend"><span>Indícios de IA exigem revisão humana</span><span>Sentimento: estimativa sujeita à validação</span></div>'+pager(result,'ligações')+'</section>';
  }
  function summariesPage() {
    const calls=filteredCalls(),call=calls.find(c=>c.id===ui.selected)||calls[0];
    let detail='<div class="detail-title"><h2>Selecione uma ligação</h2><p class="detail-meta">Resumo, transcrição e próximos passos</p></div><div class="detail-body">'+empty('Nenhuma ligação selecionada.','As análises existentes serão apresentadas sem gerar conteúdo fictício.')+'</div>';
    if(call) {
      let body=ui.tab==='transcricao'?'<section><h3>Transcrição da ligação</h3><p class="stored-text">'+e(call.transcript||'Transcrição não registrada.')+'</p></section>':ui.tab==='audio'?'<div class="audio-box">'+icon('phone')+'<h3>Ouvir ligação</h3><p>A reprodução será habilitada quando o armazenamento de áudio estiver integrado.</p></div>':
        '<div class="summary-topic">'+badge(call.topic||'Assunto não informado','neutral')+'<small>Conteúdo registrado no banco</small></div><section><h3>Necessidade relatada</h3><p class="stored-text">'+e(call.summary||'Resumo não registrado.')+'</p></section><section><h3>Encaminhamento</h3><p>'+e(call.nextStep||'Não registrado.')+'</p></section><section><h3>Compromissos e próximos passos</h3><p>'+e(call.commitments||'Não registrados.')+'</p></section><div class="quote">'+icon('alert')+'<div><strong>Confira a gravação e a transcrição</strong><p>Indícios de IA precisam de contexto e validação humana antes de qualquer ação.</p></div></div>';
      detail='<div class="detail-title"><div><h2>'+e(call.client)+' <small>'+e(call.pabxId||call.id.slice(0,8))+'</small></h2>'+analysisBadge(call)+'</div><p class="detail-meta">'+C.formatDate(call.date)+' · '+e(call.time)+' • '+C.duration(call.seconds)+' • '+e(call.phone)+'</p><p class="detail-meta">Equipe: '+e(call.team)+' • Colaborador: '+e(call.agent)+'</p></div><div class="tabs compact">'+[['resumo','Resumo','report'],['transcricao','Transcrição','summary'],['audio','Ouvir ligação','phone']].map(([id,label,name])=>'<button class="tab '+(ui.tab===id?'active':'')+'" data-tab="'+id+'">'+icon(name)+label+'</button>').join('')+'</div><div class="detail-body">'+body+'</div><div class="detail-footer"><span class="muted">Revisão humana ainda não integrada</span><div>'+unavailable(icon('edit')+' Revisar classificação')+unavailable(icon('check')+' Validar resumo','A validação de resumos será implementada em uma próxima etapa.','')+'</div></div>'+privacy();
    }
    return head('Resumos das Ligações','Consulte necessidades, encaminhamentos e próximos passos',btn('Atualizar','refresh','secondary small'))+warn('Resumos e indícios de IA sujeitos à validação humana','Sentimento não é conclusão definitiva. Confira as evidências e a transcrição antes de agir.')+
      '<section class="panel summary-filters"><div class="toolbar">'+search('Contato, trecho do resumo ou ID da ligação','Buscar no histórico')+teamFilter()+topicFilter()+dateFilter()+analysisFilter()+'</div><div class="filter-info"><span>'+calls.length+' ligações no recorte • Ordenadas por mais recentes</span>'+btn('Limpar filtros','clear-filters','text-btn')+'</div></section>'+
      '<div class="summary-layout"><section class="panel"><div class="panel-header"><h3>Ligações no período '+badge(calls.length)+'</h3>'+icon('filter')+'</div><div class="call-list">'+(calls.map(c=>'<button class="call-option '+(c.id===call?.id?'active':'')+'" data-action="select-call" data-id="'+e(c.id)+'"><div class="call-option-top"><strong>'+e(c.client)+'</strong><small>'+C.formatDate(c.date)+' · '+e(c.time)+'</small></div><p>'+e((c.summary||'Sem análise registrada.').slice(0,110))+'</p><div class="call-option-top"><small>'+e(c.team)+' · '+e(c.topic||'Sem assunto')+'</small>'+analysisBadge(c)+'</div></button>').join('')||empty('Nenhuma ligação registrada.',''))+'</div><div class="list-foot">Mostrando '+calls.length+' ligações</div></section><section class="panel summary-detail">'+detail+'</section></div>';
  }
  function reportsPage() {
    const filters=['Todos','Qualidade','Retenção','Desenvolvimento','Conformidade'];
    return head('Relatórios','Relatórios de qualidade, retenção e desenvolvimento • Ligações PABX')+
      warn('Relatórios sujeitos à validação humana antes da publicação','A geração de relatórios ainda não está integrada. Nenhum resultado demonstrativo é exibido.')+
      '<section class="metrics five">'+metric('Relatórios gerados','—','report','indigo')+metric('Agendados','—','clock','purple')+metric('Ligações críticas','—','alert','red')+metric('Satisfação estimada','—','check','green')+metric('Falhas recorrentes','—','info','purple')+'</section>'+
      '<div class="tabs report-tabs">'+filters.map(v=>'<button class="tab '+(ui.reportType===v?'active':'')+'" data-action="report-tab" data-id="'+v+'">'+v+'</button>').join('')+'</div><div class="toolbar report-toolbar">'+search('Pesquisar pelo nome do relatório...')+pendingSelect('Equipe / departamento','Todas as equipes')+pendingSelect('Status','Todos os status')+dateFilter()+unavailable('+ Novo relatório','A geração de relatórios ainda não está disponível.','')+'</div>'+
      '<section class="panel report-table">'+table(['Relatório','Tipo','Equipe','Critérios aplicados','Período','Status','Ações'],[emptyRow(7,'Nenhum relatório disponível.','Categoria: '+ui.reportType+' • A geração será integrada em uma próxima etapa.')])+pager(C.paginate([],1),'relatórios')+'</section><div class="split-notes"><article class="note"><h3>Critérios de análise</h3><p>Os critérios cadastrados poderão orientar os relatórios.</p><div class="chips">'+(state.criteria.filter(c=>c.active).map(c=>badge(c.name,'neutral')).join('')||'<span class="muted">Nenhum critério ativo cadastrado.</span>')+'</div></article><article class="note blue"><h3>Pontos de atenção</h3><p>A análise de sentimento não é conclusão definitiva. Alertas sensíveis precisam de evidências e revisão humana antes do compartilhamento.</p></article></div>';
  }
  function rankingsPage() {
    return head('Rankings de Desempenho','Compare resultados de atendentes e equipes',unavailable(icon('download')+' Exportar','O ranking ainda não foi calculado.'))+
      '<section class="panel"><div class="toolbar ranking-filters">'+search('Nome ou ramal do atendente','Buscar atendente')+teamFilter()+dateFilter()+pendingSelect('Tipo de ligação','Todos os tipos')+pendingSelect('Classificar por','Nota de qualidade')+'</div><div class="filter-info"><span>Amostra mínima e fórmula de pontuação aguardam definição.</span>'+btn('Limpar filtros','clear-filters','text-btn')+'</div></section>'+
      '<section class="metrics four ranking-metrics">'+metric('Ligações avaliadas','—','phone')+metric('Nota média de qualidade','—','check')+metric('Resolução no primeiro contato','—','check')+metric('Atendentes no ranking','—','users')+'</section><section class="panel ranking-table"><div class="panel-header"><div class="ranking-heading"><h3>Classificação geral</h3><div class="segmented">'+[['atendentes','Atendentes'],['equipes','Equipes']].map(([id,label])=>'<button data-action="ranking-tab" data-id="'+id+'" class="'+(ui.rankingTab===id?'selected':'')+'">'+label+'</button>').join('')+'</div></div><small class="muted">Qualidade: 0–100 • Maior nota primeiro</small></div>'+table(['Posição',ui.rankingTab==='equipes'?'Equipe':'Atendente','Equipe','Ligações','Qualidade ↓','Resolução','TMA','Variação',''],[emptyRow(9,'Nenhuma classificação disponível.','Os dados não são classificados antes da definição das regras de pontuação.')])+pager(C.paginate([],1),'classificações')+'</section><div class="team-scores">'+state.teams.map(t=>'<article class="note"><h3>'+e(t.name)+'</h3><p>'+e(t.members)+' colaboradores • '+e(t.department)+'</p><div class="score-values"><span><strong>—</strong>Nota média</span><span><strong>—</strong>Ligações avaliadas</span><span><strong>—</strong>Resolução</span></div></article>').join('')+'</div>';
  }
  function settingsPage() {
    const profileField=(name,label,value,readonly=false)=>'<div class="form-field"><label for="profile-'+name+'">'+label+'</label><input id="profile-'+name+'" name="'+name+'" type="'+(name==='email'?'email':'text')+'" value="'+e(value)+'" maxlength="'+(name==='name'?200:255)+'" '+(readonly?'readonly':'required autocomplete="'+(name==='name'?'name':'email')+'"')+'></div>';
    return head('Configurações','Gerencie seus dados pessoais e a segurança da sua conta')+
      '<section class="panel profile-card"><span class="avatar profile-avatar">'+e(C.initials(session.name))+'</span><div><h2>'+e(session.name)+'</h2><p>'+e(session.job)+' • '+e(session.profile)+'</p></div><a class="btn secondary" href="#saida">'+icon('exit')+' Sair</a></section>'+
      '<section class="panel profile-form"><h2>Informações de perfil</h2><form id="profile-form"><div class="form-grid">'+profileField('email','E-mail',session.email)+profileField('name','Nome',session.name)+profileField('team','Departamento / equipe',session.team,true)+profileField('job','Cargo',session.job,true)+
      '<div class="form-field"><label for="profile-current-password">Senha atual para confirmar alterações</label><input id="profile-current-password" name="currentPassword" type="password" maxlength="128" autocomplete="current-password" required></div>'+
      '<details class="profile-passwords"><summary>Alterar senha</summary><div class="form-grid"><div class="form-field"><label for="profile-new-password">Nova senha (12 a 128 caracteres)</label><input id="profile-new-password" name="newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password"></div><div class="form-field"><label for="profile-confirm-password">Confirmar nova senha</label><input id="profile-confirm-password" name="confirmPassword" type="password" maxlength="128" autocomplete="new-password"></div></div><p>Ao alterar a senha, todas as sessões anteriores serão encerradas.</p></details></div>'+
      '<p class="form-error" role="alert"></p><div class="profile-actions"><button type="reset" class="btn secondary">Descartar alterações</button><button class="btn" type="submit">Salvar alterações</button></div></form><p class="profile-note">Cargo, equipe e permissões são administrados pelo responsável da SENX. Sua senha nunca é exibida.</p></section>';
  }
  function usersView() {
    const users=state.users.filter(u=>C.search(u.name+' '+u.email,ui.query)&&(!ui.team||ui.team===u.team)&&(!ui.profile||u.profile===ui.profile));
    const roles=field('Perfil','<select data-filter="profile"><option value="">Todos os perfis</option>'+['Administrador','Colaborador'].map(p=>'<option '+(ui.profile===p?'selected':'')+'>'+p+'</option>').join('')+'</select>');
    return '<section class="panel users-filters"><div class="panel-header"><h2>Colaboradores e acessos</h2>'+badge(state.users.length+' usuários','green')+'</div><div class="toolbar admin-filter">'+search('Pesquisar por nome ou e-mail')+teamFilter('Departamento')+roles+field('Status','<select aria-label="Status dos colaboradores"><option>Todos os status</option></select>')+btn(icon('plus')+' Adicionar usuário','new-user','ghost')+'</div></section><section class="panel users-table">'+table(['Nome','E-mail','Departamento','Perfil de acesso','Status','Ações'],users.length?users.map(u=>'<tr><td>'+person(u.name,u.role)+'</td><td>'+e(u.email)+'</td><td>'+e(u.team)+'</td><td><div class="access-chips">'+badge(u.profile)+(u.profile==='Administrador'?badge('Gerenciar cadastros'):badge('Consulta própria'))+'</div></td><td>'+badge('Ativo','green')+'</td><td><div class="row-actions">'+unavailable(icon('edit')+'<span class="sr-only">Editar usuário</span>','A edição de usuários ainda não está disponível.','icon-action secondary')+'</div></td></tr>'):[emptyRow(6,'Nenhum colaborador encontrado.','Ajuste os filtros ou adicione um usuário.')])+'</section>';
  }
  function teamsView() {
    const teams=state.teams.filter(t=>C.search(t.name+' '+t.department,ui.query));
    return '<section class="metrics three">'+metric('Departamentos cadastrados',connected()?new Set(state.teams.map(t=>t.department)).size:'—','building','soft')+metric('Colaboradores ativos',count('Usuario'),'users','soft')+metric('Lideranças responsáveis','—','admin','soft')+'</section><section class="panel departments-table"><div class="panel-header"><div><h2>Departamentos</h2><p>Organize os acessos e os critérios de análise de cada equipe.</p></div>'+btn(icon('plus')+' Adicionar departamento','new-team')+'</div>'+table(['Departamento','Liderança responsável','Colaboradores','Critérios ativos','Ações'],teams.length?teams.map(t=>'<tr><td><strong>'+e(t.department)+'</strong><small>Equipe: '+e(t.name)+'</small></td><td class="muted">Não definida</td><td>'+e(t.members)+' colaboradores</td><td>'+badge('Catálogo global')+'</td><td>'+btn(icon('edit')+' Editar','edit-team','text-btn',t.id)+'</td></tr>'):[emptyRow(5,'Nenhum departamento cadastrado.','Adicione uma equipe e seu departamento.')])+'<div class="list-foot">'+teams.length+' equipes cadastradas</div></section>'+note('Critérios e acessos por departamento','O catálogo de critérios é global nesta versão. Lideranças e vínculos de critérios por departamento ainda não estão configurados.')+'<section class="panel context-panel"><h3>Uma configuração para cada contexto de atendimento</h3><div class="context-grid"><div><strong>Liderança responsável</strong><p>A atribuição de liderança será integrada em uma próxima etapa.</p></div><div><strong>Colaboradores vinculados</strong><p>O perfil determina as permissões de acesso de cada colaborador.</p></div><div><strong>Critérios ativos</strong><p>O catálogo global reúne os critérios de análise cadastrados.</p></div></div></section>';
  }
  function criteriaView() {
    const criteria=state.criteria.filter(c=>C.search(c.name+' '+c.description,ui.query));
    return '<section class="panel criteria-filter"><div class="toolbar"><strong>Departamento</strong><select aria-label="Departamento do catálogo" disabled><option>Catálogo global</option></select><span class="muted">Configuração por departamento ainda indisponível</span><span class="criteria-count">'+badge(state.criteria.filter(c=>c.active).length+' ativos / '+state.criteria.length+' critérios')+'</span>'+btn(icon('plus')+' Adicionar critério','new-criterion','secondary')+'</div></section>'+warn('Classificações sensíveis exigem evidências e revisão humana','Exija evidência textual da gravação ou transcrição. Sentimento é estimativa de IA; tom de voz não comprova intenção ou satisfação.')+
      '<section class="panel criteria-table">'+table(['Critério','Descrição','Evidências esperadas','Estado','Ação'],criteria.length?criteria.map(c=>'<tr><td>'+e(c.name)+'<small>Versão '+e(c.version)+'</small></td><td>'+e(c.description)+'</td><td>'+e(c.rule)+'</td><td><button class="switch-label" data-action="edit-criterion" data-id="'+e(c.id)+'" aria-label="Editar estado do critério '+e(c.name)+'"><span class="switch '+(c.active?'on':'')+'"></span>'+e(c.active?'Ativo':'Inativo')+'</button></td><td>'+btn(icon('edit')+' Editar','edit-criterion','text-btn',c.id)+'</td></tr>'):[emptyRow(5,'Nenhum critério cadastrado.','Adicione os critérios de análise da SENX.')])+'</section><div class="criteria-footer"><small class="muted">Cada critério é salvo pelo seu formulário de edição.</small><div>'+btn('Atualizar catálogo','refresh','secondary')+unavailable(icon('check')+' Salvar critérios','Use Adicionar critério ou Editar para salvar cada registro.','')+'</div></div>';
  }
  function adminPage() {
    if(!isAdmin())return head('Administração','Acesso restrito.')+note('Permissão necessária','Somente administradores podem gerenciar cadastros.');
    const tabs=[['usuarios','Colaboradores e acessos'],['departamentos','Departamentos'],['criterios','Critérios de análise']];
    return head('Administração','Gerencie acessos, departamentos e os critérios de análise das ligações.')+'<div class="tabs admin-tabs">'+tabs.map(([id,label])=>'<a class="tab '+(ui.adminTab===id?'active':'')+'" href="#administracao/'+id+'">'+label+'</a>').join('')+'</div>'+(ui.adminTab==='usuarios'?usersView():ui.adminTab==='departamentos'?teamsView():criteriaView());
  }
  function exitPage(){
    return '<main class="exit-page" id="main">'+decorations()+'<section class="exit-card"><div class="exit-icon">'+icon('exit')+'</div><h1>Realmente deseja sair?</h1><p>Você será desconectado da SENX e precisará<br>entrar novamente para continuar.</p>'+btn('SAIR','logout','full')+'<a class="btn secondary full" href="#configuracoes">CANCELAR</a></section></main>';
  }
  function render() {
    if(!authReady){app.innerHTML='<main id="main">Carregando sessão…</main>';return;}
    if(!session){document.title='SENX 0.1.4.2 — '+(setupRequired?'Primeiro acesso':'Login');app.innerHTML=auth(setupRequired);return;}
    const raw=location.hash.slice(1)||'ligacoes',[route,sub]=raw.split('/');
    if(lastRoute!==raw){Object.assign(ui,{page:1,query:'',team:'',status:'',date:'',analysis:'',topic:'',profile:''});closeModal();lastRoute=raw;}
    ui.adminTab=['usuarios','departamentos','criterios'].includes(sub)?sub:'usuarios';
    if(route==='login'||route==='cadastro'){location.hash='ligacoes';return;}
    else if(route==='saida')app.innerHTML=exitPage();
    else {
      const pages={ligacoes:callsPage,resumos:summariesPage,relatorios:reportsPage,rankings:rankingsPage,configuracoes:settingsPage,administracao:adminPage};
      if(!pages[route]){location.hash='ligacoes';return;}
      app.innerHTML=shell(pages[route](),route);
    }
    document.title='SENX 0.1.4.2 — '+(route==='administracao'?ui.adminTab:route);
    app.dataset.route=raw;
  }
  function closeModal(){const dialog=document.querySelector('#modal-root dialog');if(dialog){dialog.close();dialog.remove();if(lastFocus?.isConnected)lastFocus.focus();}}
  function modal(title,subtitle,content,formId='') {
    closeModal();lastFocus=document.activeElement;
    const save=title.startsWith('Editar')?'Salvar alterações':'Salvar';
    document.querySelector('#modal-root').innerHTML='<dialog class="dialog-'+formId+'" aria-labelledby="dialog-title">'+(formId?'<form id="'+formId+'">':'')+'<header class="modal-head"><div><h2 id="dialog-title">'+title+'</h2><p>'+subtitle+'</p></div><button type="button" class="close-dialog" data-action="close" aria-label="Fechar formulário">'+icon('close')+'</button></header><div class="modal-body">'+content+'<p class="form-error" role="alert"></p></div><footer class="modal-footer">'+btn(formId?'Cancelar':'Fechar','close','secondary')+(formId?'<button type="submit" class="btn">'+save+'</button>':'')+'</footer>'+(formId?'</form>':'')+'</dialog>';
    document.querySelector('#modal-root dialog').showModal();
    document.querySelector('#modal-root input:not([type=hidden])')?.focus();
  }
  function teamModal(id) {
    if(!connected()){toast('Conecte o PostgreSQL antes de gravar.');return;}
    const t=state.teams.find(t=>t.id===id)||{name:'',department:''};
    modal(id?'Editar departamento':'Adicionar departamento','Defina o nome e a equipe vinculada ao departamento.','<input type="hidden" name="id" value="'+e(id||'')+'">'+input('department','Nome do departamento',t.department)+input('name','Nome da equipe',t.name)+
      '<div class="form-field"><label>Liderança responsável</label><select disabled><option>Atribuição ainda não disponível</option></select></div><div class="form-field"><label>Critérios de análise</label><select disabled><option>Catálogo global de critérios</option></select></div>'+
      '<div class="permissions"><strong>Vínculo com a equipe</strong><small>Nome da equipe e departamento serão salvos. Lideranças e critérios por departamento aguardam integração.</small></div>'+note('Acessos preservados','O perfil de cada colaborador continua determinando suas permissões.'),'team-form');
  }
  function criterionModal(id) {
    if(!connected()){toast('Conecte o PostgreSQL antes de gravar.');return;}
    const c=state.criteria.find(c=>c.id===id)||{name:'',description:'',rule:'',version:'',active:true};
    const textarea=(name,label,value)=>'<div class="form-field"><label for="field-'+name+'">'+label+' *</label><textarea id="field-'+name+'" name="'+name+'" maxlength="255" rows="3" required>'+e(value)+'</textarea></div>';
    modal(id?'Editar critério':'Adicionar critério','Catálogo global • '+(c.name||'Novo critério'),'<input type="hidden" name="id" value="'+e(id||'')+'"><div class="criterion-status">'+badge('Critério de análise','amber')+'<label class="switch-label"><input type="checkbox" role="switch" name="active" '+(c.active?'checked':'')+'>Ativo</label></div>'+
      input('name','Nome do critério',c.name)+textarea('description','Descrição',c.description)+textarea('rule','Evidências esperadas / regra de avaliação',c.rule)+input('version','Versão',c.version)+
      note('Evidências e revisão humana','Use regras claras e confira o contexto da gravação antes de interpretar os resultados.')+
      warn('Indício não é conclusão','Sentimento é estimativa de IA. O catálogo não substitui a revisão humana.'),'criterion-form');
  }
  function userModal() {
    if(!isAdmin())return;
    if(!state.teams.length){toast('Cadastre uma equipe antes de adicionar colaboradores.');return;}
    modal('Adicionar usuário','Cadastre um acesso para a análise das gravações do PABX.',input('name','Nome completo')+input('email','E-mail corporativo','','email')+
      '<div class="form-grid"><div class="form-field"><label for="user-team">Departamento / equipe *</label><select id="user-team" name="teamId" required>'+state.teams.map(t=>'<option value="'+e(t.id)+'">'+e(t.name)+'</option>').join('')+'</select></div><div class="form-field"><label for="user-profile">Perfil de acesso *</label><select id="user-profile" name="profile"><option>Colaborador</option><option>Administrador</option></select></div></div>'+
      '<div class="form-grid">'+input('job','Cargo')+input('password','Senha inicial (12 a 128 caracteres)','','password')+'</div>'+'<div class="form-field"><label>Status</label><select disabled><option>Ativo</option></select></div>'+
      '<div class="permissions"><strong>Permissões de acesso</strong><p id="permissions-description">Consultar suas próprias ligações, análises e perfil.</p><small>As permissões são verificadas pela API de acordo com o perfil selecionado.</small></div>'+
      note('Cadastro ainda não salvo','O usuário será incluído após clicar em Salvar. A senha é armazenada como hash seguro.'),'user-form');
  }
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();
    if(!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form)),id=form.getAttribute('id');
    if(id==='auth-form'){
      const button=form.querySelector('[type=submit]');button.disabled=true;
      try{
        if(setupRequired){
          if(data.password!==data.confirm)throw new Error('As senhas não coincidem.');
          await request('/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,teamId:data.teamId||null})});
          setupRequired=false;location.hash='login';await startSession();toast('Administrador criado. Entre com seu e-mail e senha.');
        }else{
          session=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.email,password:data.password})});
          authError='';location.hash='ligacoes';await loadDatabase();
        }
      }catch(error){const message=form.querySelector('[role=alert]');if(message.isConnected)message.textContent=error.message;button.disabled=false;}
      return;
    }
    if(id==='profile-form'){
      const button=form.querySelector('[type=submit]'),message=form.querySelector('[role=alert]');
      message.textContent='';
      if((data.newPassword||'')!==(data.confirmPassword||'')){form.querySelector('details').open=true;message.textContent='As novas senhas não coincidem.';return;}
      button.disabled=true;
      try{
        const result=await request('/api/auth/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.name.trim(),email:data.email.trim(),currentPassword:data.currentPassword,newPassword:data.newPassword||null})});
        form.reset();
        if(result.requiresLogin){session=null;clearData();location.hash='login';render();toast('Senha alterada. Entre novamente com a nova senha.');}
        else{session=result.user;await loadDatabase();toast('Perfil atualizado no PostgreSQL.');}
      }catch(error){if(form.isConnected){message.textContent=error.message;button.disabled=false;}}
      return;
    }
    if(!['team-form','criterion-form','user-form'].includes(id))return;
    const button=form.querySelector('[type=submit]');button.disabled=true;
    const payload=id==='user-form'?{name:data.name.trim(),email:data.email.trim(),password:data.password,teamId:data.teamId,job:data.job.trim(),profile:data.profile}:id==='team-form'?{name:data.name.trim(),department:data.department.trim()}:{name:data.name.trim(),description:data.description.trim(),rule:data.rule.trim(),version:data.version.trim(),active:data.active==='on'};
    try {
      const kind=id==='user-form'?'users':id==='team-form'?'teams':'criteria';
      await request('/api/data/'+kind+(data.id?'/'+encodeURIComponent(data.id):''),{method:data.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      closeModal();await loadDatabase();
      toast(connected()?'Registro gravado e relido do PostgreSQL.':'Gravação confirmada pela API; a releitura falhou. Atualize a conexão.');
    }catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
  });
  document.addEventListener('reset',event=>{if(event.target.id==='profile-form'){event.target.querySelector('[role=alert]').textContent='';event.target.querySelector('details').open=false;}});
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action],[data-page],[data-tab]');if(!target||target.disabled)return;
    if(target.dataset.page){ui.page=Number(target.dataset.page);render();return;}
    if(target.dataset.tab){ui.tab=target.dataset.tab;render();return;}
    const id=target.dataset.id;
    switch(target.dataset.action){
      case 'toggle-password':{const field=document.getElementById(id);field.type=field.type==='password'?'text':'password';target.setAttribute('aria-label',(field.type==='password'?'Mostrar':'Ocultar')+' senha');break;}
      case 'forgot':modal('Recuperar senha','Entre em contato com o administrador.','<p>A recuperação de senha ainda não está disponível nesta versão.</p>');break;
      case 'policy':modal('Termos de uso e privacidade','Documentos da plataforma.','<p>Os documentos oficiais ainda precisam ser definidos pelo projeto. Esta tela não registra uma aceitação de termos.</p>');break;
      case 'clear-filters':Object.assign(ui,{page:1,query:'',team:'',status:'',date:'',analysis:'',topic:'',profile:''});render();break;
      case 'report-tab':ui.reportType=id;render();break;
      case 'ranking-tab':ui.rankingTab=id;render();break;
      case 'call-info':{const call=state.calls.find(c=>c.id===id);if(call)modal('Informações da ligação','Dados registrados no PostgreSQL.','<p><strong>Identificador:</strong> '+e(call.pabxId||call.id)+'</p><p><strong>Colaborador:</strong> '+e(call.agent)+'</p><p><strong>Equipe:</strong> '+e(call.team)+'</p><p><strong>Status:</strong> '+e(call.status)+'</p>');break;}
      case 'menu':document.querySelector('.layout').classList.toggle('menu-open');break;

      case 'logout':request('/api/auth/logout',{method:'POST'}).then(()=>{session=null;clearData();closeModal();location.hash='login';render();}).catch(error=>toast(error.message));break;
      case 'new-user':userModal();break;
      case 'refresh':loadDatabase();break;
      case 'close':closeModal();break;
      case 'new-team':teamModal();break;
      case 'edit-team':teamModal(id);break;
      case 'new-criterion':criterionModal();break;
      case 'edit-criterion':criterionModal(id);break;
      case 'call':ui.selected=id;ui.tab='resumo';location.hash='resumos';break;
      case 'select-call':ui.selected=id;ui.tab='resumo';render();break;
      case 'pending-upload':modal('Importação pendente','Nenhum registro será criado nesta ação.', '<p>A importação exige arquivos, colaborador, cliente e identificador PABX. A integração será feita na próxima etapa.</p>');break;
      case 'export-calls':if(!connected()){toast('Conecte o banco antes de exportar.');return;}download('SENX-ligacoes.csv',C.toCsv([['ID','Contato','Telefone','Equipe','Data','Duração','Status'],...filteredCalls().map(c=>[c.id,c.client,c.phone,c.team,c.date,C.duration(c.seconds),c.status])]),'text/csv;charset=utf-8');break;
    }
  });
  document.addEventListener('change',event=>{const t=event.target;if(t.name==='profile'){const description=document.querySelector('#permissions-description');if(description)description.textContent=t.value==='Administrador'?'Gerenciar colaboradores, departamentos e critérios; consultar todos os registros.':'Consultar suas próprias ligações, análises e perfil.';}if(t.matches('[data-filter]')&&t.type!=='search'){ui[t.dataset.filter]=t.value;ui.page=1;render();}});
  let filterTimer;
  document.addEventListener('input',event=>{const t=event.target;if(!t.matches('input[type=search][data-filter]'))return;const value=t.value;clearTimeout(filterTimer);filterTimer=setTimeout(()=>{ui.query=value;ui.page=1;render();const input=document.querySelector('input[type=search][data-filter]');input?.focus();},180);});
  window.addEventListener('hashchange',()=>{clearTimeout(filterTimer);render();window.scrollTo(0,0);});
  render();startSession();
})();
