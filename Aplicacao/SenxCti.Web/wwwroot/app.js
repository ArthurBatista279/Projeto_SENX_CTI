
/* SENX 0.1.2 — consulta PostgreSQL, sem persistência ou dados de negócio locais. */
(() => {
  'use strict';
  const C=window.SenxCore, state=window.SenxData, e=C.escapeHtml;
  // A carga antiga de demonstração deixa de ser usada. Outras chaves, como o gerenciador, são preservadas.
  try { localStorage.removeItem('senx-cti-demo-v01'); } catch {}
  const ui={page:1,query:'',team:'',status:'',date:'',selected:null,tab:'resumo',adminTab:'usuarios'};
  const app=document.querySelector('#app');
  let connection='loading',connectionDetail='',lastRoute='',toastTimer,lastFocus,audioUrl;
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
  const badge=text=>'<span class="badge blue">'+e(text)+'</span>';
  const empty=(title='Nenhum registro no banco.',text='Cadastre os dados de teste para começar.')=>'<div class="empty-state"><strong>'+e(title)+'</strong><p>'+e(text)+'</p></div>';
  const input=(name,label,value='',type='text')=>'<div class="form-field"><label for="field-'+name+'">'+label+' *</label><input id="field-'+name+'" name="'+name+'" type="'+type+'" value="'+e(value)+'" maxlength="255" required></div>';
  const note=(title,text)=>'<div class="banner info">'+icon('info')+'<div><strong>'+e(title)+'</strong><small>'+e(text)+'</small></div></div>';
  function toast(text){const box=document.querySelector('#toast');box.textContent=text;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),5500);}
  function download(name,text,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=Object.assign(document.createElement('a'),{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function request(url,options={}) {
    if(location.protocol==='file:')throw new Error('Abra a aplicação pela API ou pela prévia local para consultar o PostgreSQL.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(url,{...options,signal:controller.signal});
      let data;try{data=await response.json();}catch{throw new Error('A API não retornou JSON válido. Confira o servidor local.');}
      if(!response.ok)throw new Error(data.detail||data.title||data.error||'Falha HTTP '+response.status);
      return data;
    }catch(error){if(error.name==='AbortError')throw new Error('A conexão excedeu 15 segundos.');if(error instanceof TypeError)throw new Error('A API local está indisponível. Inicie o back-end na porta 5080.');throw error;}
    finally{clearTimeout(timer);}
  }
  async function loadDatabase() {
    connection='loading';render();
    try {
      const data=await request('/api/data/snapshot');
      if(data.source!=='postgresql'||!['calls','teams','users','criteria'].every(k=>Array.isArray(data[k])))throw new Error('Contrato de dados inválido.');
      Object.assign(state,data);state.reports=[];state.rankings=[];connection='connected';connectionDetail='';
      if(!state.calls.some(c=>c.id===ui.selected))ui.selected=state.calls[0]?.id||null;
    }catch(error) {
      Object.assign(state,{calls:[],teams:[],users:[],criteria:[],counts:{},reports:[],rankings:[],source:null,fetchedAt:null});
      connection='error';connectionDetail=error.message;
    }
    render();
  }
  const connected=()=>connection==='connected';
  const count=name=>connected()?(state.counts[name]??0):'—';
  const metric=(label,value,name,noteText='')=>'<article class="metric"><span class="metric-icon">'+icon(name)+'</span><div><label>'+label+'</label><strong>'+e(value)+'</strong><small>'+e(noteText)+'</small></div></article>';
  function head(title,subtitle,actions='') {return '<header class="page-head"><div><h1>'+title+'</h1><p>'+subtitle+'</p></div><div class="head-actions"><span class="demo-tag">Versão 0.1.2 · PostgreSQL</span>'+actions+'</div></header>';}
  const teamOptions=()=>state.teams.map(t=>'<option value="'+e(t.name)+'" '+(ui.team===t.name?'selected':'')+'>'+e(t.name)+'</option>').join('');
  const search=(placeholder='Pesquisar')=>'<label class="field-control search"><span>Busca</span><input type="search" data-filter="query" value="'+e(ui.query)+'" placeholder="'+placeholder+'"></label>';
  const teamFilter=()=>'<label class="field-control"><span>Equipe</span><select data-filter="team"><option value="">Todas as equipes</option>'+teamOptions()+'</select></label>';
  const filteredCalls=()=>C.filterCalls(state.calls,ui);
  function pager(result) {return '<div class="pagination"><span>'+result.total+' registros no recorte</span><div class="pages"><button data-page="'+(result.page-1)+'" '+(result.page<=1?'disabled':'')+' aria-label="Página anterior">‹</button><span>'+result.page+' / '+result.pages+'</span><button data-page="'+(result.page+1)+'" '+(result.page>=result.pages?'disabled':'')+' aria-label="Próxima página">›</button></div></div>';}
  function table(headers,rows) {return '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';}
  function shell(content,active) {
    const nav=[['ligacoes','Ligações','phone'],['resumos','Resumos','summary'],['relatorios','Relatórios','report'],['rankings','Rankings','ranking'],['configuracoes','Configurações','settings'],['administracao','Administração','admin']];
    const status=connection==='connected'?'PostgreSQL conectado':connection==='loading'?'Consultando banco…':'Banco indisponível';
    const banner=connection==='error'?note('Conexão pendente',connectionDetail):connection==='loading'?note('Consultando PostgreSQL','Os registros serão exibidos após a resposta do banco.'):state.counts.Ligacao>state.calls.length?note('Recorte de consulta','Exibindo as últimas 200 ligações. Os contadores representam o total do banco.'):'';
    return '<div class="layout"><div class="mobile-bar">'+btn(icon('menu'),'menu','secondary small')+'<strong>SENX</strong>'+badge('0.1.2')+'</div><aside class="sidebar"><a href="#ligacoes" aria-label="SENX — Ligações">'+brand()+'</a><nav class="nav-list" aria-label="Menu principal">'+nav.map(([route,label,name])=>'<a href="#'+route+'" class="nav-link '+(active===route?'active':'')+'">'+icon(name)+label+'</a>').join('')+'</nav><div class="sidebar-bottom"><strong>Ambiente de testes</strong><div class="sidebar-note">0.1.2 · Integração local<br>Autenticação pendente para a versão 0.2.</div></div></aside><main class="content" id="main" tabindex="-1">'+banner+content+'<footer class="review-bar"><span>SENX 0.1.2 · '+status+'</span><div class="links">'+btn('Atualizar banco','refresh','secondary small')+'<a href="#telas">Todas as telas</a>'+btn('Relatar problema','feedback','secondary small')+'</div></footer></main></div>';
  }
  function auth(register=false) {
    return '<div class="auth"><section class="auth-story"><div><h1>Transforme sua rotina<br>em uma experiência<br>mais simples ↗</h1><p>Análise de ligações e acompanhamento de atendimentos com a identidade SENX.</p></div></section><main id="main" class="auth-panel"><div class="auth-card">'+brand()+'<h2>'+(register?'Crie sua conta':'Bem-vindo de volta!')+'</h2><p>Versão 0.1.2 · Testes de integração</p><form id="auth-form">'+(register?input('name','Nome completo'):'')+input('email','E-mail','','email')+input('password','Senha','','password')+(register?input('confirm','Confirmar senha','','password'):'')+'<p class="form-error" role="alert">Autenticação e criação de contas ainda não estão disponíveis.</p><button class="btn full" disabled>'+(register?'Criar conta':'Login')+'</button></form><div class="auth-footer"><a href="#'+(register?'login':'cadastro')+'">'+(register?'Voltar ao login':'Criar conta')+'</a></div><div class="demo-login">'+btn('Abrir ambiente de testes','enter-tests','secondary full')+'<small>Acesso local sem autenticação · Dados consultados no PostgreSQL.</small></div></div></main></div>';
  }
  function callsPage() {
    const result=C.paginate(filteredCalls(),ui.page);
    return head('Análise de Ligações','Registros do PostgreSQL · Sem carga de exemplos',btn('Importar gravação','pending-upload','secondary'))+
      '<section class="metrics four">'+metric('Ligações no banco',count('Ligacao'),'phone')+metric('Análises registradas',count('Analise'),'summary')+metric('Alertas registrados',count('Alerta'),'alert')+metric('Clientes cadastrados',count('DadosCliente'),'users')+'</section>'+
      '<section class="panel"><div class="toolbar">'+search('Contato, telefone, equipe ou ID')+teamFilter()+'<label class="field-control"><span>Data</span><input type="date" data-filter="date" value="'+e(ui.date)+'"></label>'+btn('Exportar CSV','export-calls','secondary')+'</div>'+
      (result.items.length?table(['Contato','Telefone','Data / hora','Duração','Equipe','Status armazenado','Ações'],result.items.map(c=>'<tr><td class="row-main">'+e(c.client)+'</td><td>'+e(c.phone)+'</td><td>'+C.formatDate(c.date)+' '+e(c.time)+'</td><td>'+C.duration(c.seconds)+'</td><td>'+e(c.team)+'</td><td>'+badge(c.status)+'</td><td>'+btn('Ver resumo','call','secondary small',c.id)+'</td></tr>')):empty('Nenhuma ligação encontrada.','A importação do PABX será integrada posteriormente.'))+pager(result)+'</section>';
  }
  function summariesPage() {
    const calls=filteredCalls(),call=calls.find(c=>c.id===ui.selected)||calls[0];
    let detail=empty('Nenhuma ligação selecionada.','As análises aparecerão quando existirem registros no banco.');
    if(call) {
      let body=ui.tab==='transcricao'?'<p class="stored-text">'+e(call.transcript||'Transcrição não registrada.')+'</p>':ui.tab==='audio'?empty('Reprodução de gravação pendente.','O armazenamento e o acesso aos arquivos serão integrados na versão 0.2.'):'<section><h3>Resumo registrado</h3><p class="stored-text">'+e(call.summary||'Resumo não registrado.')+'</p></section><section><h3>Encaminhamento</h3><p>'+e(call.nextStep||'Não registrado.')+'</p></section><section><h3>Compromissos</h3><p>'+e(call.commitments||'Não registrados.')+'</p></section>';
      detail='<div class="detail-title"><h2>'+e(call.client)+'</h2><div class="detail-meta">'+e(call.agent)+' · '+e(call.team)+' · '+C.formatDate(call.date)+'</div></div><div class="tabs compact">'+[['resumo','Resumo'],['transcricao','Transcrição'],['audio','Áudio']].map(([id,label])=>'<button class="tab '+(ui.tab===id?'active':'')+'" data-tab="'+id+'">'+label+'</button>').join('')+'</div><div class="detail-body">'+body+'</div>';
    }
    return head('Resumos das Ligações','Resumo e transcrição armazenados em Analise; sem conteúdo gerado nesta tela.')+'<section class="panel"><div class="toolbar">'+search('Contato ou ID da ligação')+teamFilter()+'</div></section><div class="summary-layout"><section class="panel"><div class="panel-header"><h3>Ligações no banco</h3>'+badge(calls.length)+'</div><div class="call-list">'+(calls.map(c=>'<button class="call-option '+(c.id===call?.id?'active':'')+'" data-action="select-call" data-id="'+e(c.id)+'"><strong>'+e(c.client)+'</strong><p>'+e((c.summary||'Sem análise registrada.').slice(0,110))+'</p><small>'+e(c.team)+' · '+C.formatDate(c.date)+'</small></button>').join('')||empty('Nenhuma ligação registrada.',''))+'</div></section><section class="panel">'+detail+'</section></div>';
  }
  function reportsPage() {
    return head('Relatórios','Estrutura visual preservada para a próxima etapa.')+note('Persistência de relatórios pendente','O esquema senx.sql não contém uma entidade de relatórios. Nenhum relatório fictício será criado.')+'<section class="panel">'+empty('Nenhum relatório disponível.','A geração e o armazenamento serão definidos com o back-end.')+'</section>';
  }
  function rankingsPage() {
    return head('Rankings de Desempenho','Indicadores aguardando definição das regras de produto.')+'<section class="metrics four">'+metric('Colaboradores',count('Usuario'),'users')+metric('Equipes',count('Equipe'),'building')+metric('Resultados registrados',count('Resultado'),'report')+metric('Nota consolidada','—','ranking','Fórmula pendente')+'</section>'+note('Ranking ainda não calculado','Amostra mínima, elegibilidade e fórmula de pontuação continuam pendentes de validação. Nenhuma classificação é inferida.')+'<section class="panel">'+empty('Nenhuma classificação disponível.','Os registros do banco não são classificados sem uma regra aprovada.')+'</section>';
  }
  function settingsPage() {return head('Configurações','Perfil e credenciais do usuário autenticado.')+note('Perfil indisponível nesta etapa','A versão 0.1.2 não autentica usuários. Não existe um perfil de exemplo ou alteração de senha local.')+'<section class="panel">'+empty('Nenhum usuário autenticado.','A integração de identidade fica para a versão 0.2.')+'</section>';}
  function usersView() {
    const users=state.users.filter(u=>C.search(u.name+' '+u.email,ui.query)&&(!ui.team||ui.team===u.team));
    return note('Cadastro de contas pendente','O esquema atual limita Senha a 40 caracteres. O fluxo de autenticação e o armazenamento de hashes precisam ser definidos antes de habilitar contas.')+'<section class="panel"><div class="toolbar">'+search('Nome ou e-mail')+teamFilter()+'</div>'+table(['Nome','E-mail','Equipe','Cargo'],users.map(u=>'<tr><td>'+e(u.name)+'</td><td>'+e(u.email)+'</td><td>'+e(u.team)+'</td><td>'+e(u.role)+'</td></tr>'))+(!users.length?empty('Nenhum colaborador cadastrado.','Não são criadas contas automaticamente.'):'')+'</section>';
  }
  function teamsView() {
    const teams=state.teams.filter(t=>C.search(t.name+' '+t.department,ui.query));
    return '<section class="panel"><div class="panel-header"><h2>Equipes e departamentos</h2>'+btn('Adicionar equipe','new-team')+'</div><div class="toolbar">'+search('Nome da equipe ou departamento')+'</div>'+table(['Equipe','Departamento','Colaboradores','Ações'],teams.map(t=>'<tr><td class="row-main">'+e(t.name)+'</td><td>'+e(t.department)+'</td><td>'+e(t.members)+'</td><td>'+btn('Editar','edit-team','secondary small',t.id)+'</td></tr>'))+(!teams.length?empty('Nenhuma equipe cadastrada.','Adicione a primeira equipe para testar a gravação no PostgreSQL.'):'')+'</section>';
  }
  function criteriaView() {
    const criteria=state.criteria.filter(c=>C.search(c.name+' '+c.description,ui.query));
    return note('Critérios do banco','O esquema atual não vincula Criterio a Equipe. Esta lista representa o catálogo global, sem simular configuração por departamento.')+'<section class="panel"><div class="panel-header"><h2>Critérios de análise</h2>'+btn('Adicionar critério','new-criterion')+'</div><div class="toolbar">'+search('Nome ou descrição')+'</div>'+table(['Critério','Descrição','Regra de avaliação','Versão','Estado','Ações'],criteria.map(c=>'<tr><td>'+e(c.name)+'</td><td>'+e(c.description)+'</td><td>'+e(c.rule)+'</td><td>'+e(c.version)+'</td><td>'+badge(c.active?'Ativo':'Inativo')+'</td><td>'+btn('Editar','edit-criterion','secondary small',c.id)+'</td></tr>'))+(!criteria.length?empty('Nenhum critério cadastrado.','Adicione um critério para testar a persistência.'):'')+'</section>';
  }
  function adminPage() {
    const tabs=[['usuarios','Colaboradores'],['departamentos','Equipes e departamentos'],['criterios','Critérios de análise']];
    return head('Administração','Leitura e gravação no esquema PostgreSQL do Git.')+'<div class="tabs">'+tabs.map(([id,label])=>'<a class="tab '+(ui.adminTab===id?'active':'')+'" href="#administracao/'+id+'">'+label+'</a>').join('')+'</div>'+(ui.adminTab==='usuarios'?usersView():ui.adminTab==='departamentos'?teamsView():criteriaView());
  }
  function screensPage() {
    const screens=[['login','Login'],['cadastro','Cadastro'],['ligacoes','Ligações'],['resumos','Resumos'],['relatorios','Relatórios'],['rankings','Rankings'],['configuracoes','Configurações'],['administracao/usuarios','Colaboradores'],['administracao/departamentos','Equipes e departamentos'],['administracao/criterios','Critérios'],['saida','Saída']];
    return head('Todas as telas','Versão 0.1.2 · Testes de banco')+note('Dados demonstrativos removidos','Cadastros de equipes e critérios usam o PostgreSQL. As demais telas exibem dados existentes ou sinalizam integrações pendentes.')+'<div class="screen-grid">'+screens.map(([route,label])=>'<a class="screen-card" href="#'+route+'">'+icon('grid')+'<strong>'+label+'</strong></a>').join('')+'</div>';
  }
  function render() {
    const raw=location.hash.slice(1)||'login',[route,sub]=raw.split('/');
    if(lastRoute!==raw){Object.assign(ui,{page:1,query:'',team:'',status:'',date:''});closeModal();lastRoute=raw;}
    ui.adminTab=['usuarios','departamentos','criterios'].includes(sub)?sub:'usuarios';
    if(route==='login'||route==='cadastro')app.innerHTML=auth(route==='cadastro');
    else if(route==='saida')app.innerHTML='<main class="exit-page" id="main"><section class="exit-card"><h1>Deseja sair?</h1><p>Os dados gravados permanecem no PostgreSQL.</p>'+btn('Sair','exit','full')+'<a class="btn secondary full" href="#ligacoes">Cancelar</a></section></main>';
    else {
      const pages={ligacoes:callsPage,resumos:summariesPage,relatorios:reportsPage,rankings:rankingsPage,configuracoes:settingsPage,administracao:adminPage,telas:screensPage};
      if(!pages[route]){location.hash='telas';return;}
      app.innerHTML=shell(pages[route](),route);
    }
    document.title='SENX 0.1.2 — '+(route==='administracao'?ui.adminTab:route);
    app.dataset.route=raw;
  }
  function closeModal(){const dialog=document.querySelector('#modal-root dialog');if(dialog){dialog.close();dialog.remove();if(lastFocus?.isConnected)lastFocus.focus();}}
  function modal(title,subtitle,content,formId='') {
    closeModal();lastFocus=document.activeElement;
    document.querySelector('#modal-root').innerHTML='<dialog aria-labelledby="dialog-title">'+(formId?'<form id="'+formId+'">':'')+'<header class="modal-head"><div><h2 id="dialog-title">'+title+'</h2><p>'+subtitle+'</p></div>'+btn('✕','close','secondary small')+'</header><div class="modal-body">'+content+'<p class="form-error" role="alert"></p></div><footer class="modal-footer">'+btn('Fechar','close','secondary')+(formId?'<button type="submit" class="btn">Salvar no banco</button>':'')+'</footer>'+(formId?'</form>':'')+'</dialog>';
    document.querySelector('#modal-root dialog').showModal();
    document.querySelector('#modal-root input:not([type=hidden])')?.focus();
  }
  function teamModal(id) {
    if(!connected()){toast('Conecte o PostgreSQL antes de gravar.');return;}
    const t=state.teams.find(t=>t.id===id)||{name:'',department:''};
    modal(id?'Editar equipe':'Adicionar equipe','Dados gravados em public.Equipe.', '<input type="hidden" name="id" value="'+e(id||'')+'">'+input('name','Nome da equipe',t.name)+input('department','Departamento',t.department),'team-form');
  }
  function criterionModal(id) {
    if(!connected()){toast('Conecte o PostgreSQL antes de gravar.');return;}
    const c=state.criteria.find(c=>c.id===id)||{name:'',description:'',rule:'',version:'',active:true};
    modal(id?'Editar critério':'Adicionar critério','Catálogo global de public.Criterio.','<input type="hidden" name="id" value="'+e(id||'')+'">'+input('name','Nome',c.name)+input('description','Descrição',c.description)+input('rule','Regra de avaliação',c.rule)+input('version','Versão do critério',c.version)+'<label class="consent"><input type="checkbox" name="active" '+(c.active?'checked':'')+'>Ativo</label>','criterion-form');
  }
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();
    if(!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form)),id=form.getAttribute('id');
    if(!['team-form','criterion-form'].includes(id))return;
    const button=form.querySelector('[type=submit]');button.disabled=true;
    const payload=id==='team-form'?{name:data.name.trim(),department:data.department.trim()}:{name:data.name.trim(),description:data.description.trim(),rule:data.rule.trim(),version:data.version.trim(),active:data.active==='on'};
    try {
      const kind=id==='team-form'?'teams':'criteria';
      await request('/api/data/'+kind+(data.id?'/'+encodeURIComponent(data.id):''),{method:data.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      closeModal();await loadDatabase();
      toast(connected()?'Registro gravado e relido do PostgreSQL.':'Gravação confirmada pela API; a releitura falhou. Atualize a conexão.');
    }catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
  });
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action],[data-page],[data-tab]');if(!target||target.disabled)return;
    if(target.dataset.page){ui.page=Number(target.dataset.page);render();return;}
    if(target.dataset.tab){ui.tab=target.dataset.tab;render();return;}
    const id=target.dataset.id;
    switch(target.dataset.action){
      case 'menu':document.querySelector('.layout').classList.toggle('menu-open');break;
      case 'enter-tests':location.hash='ligacoes';break;
      case 'exit':location.hash='login';break;
      case 'refresh':loadDatabase();break;
      case 'close':closeModal();break;
      case 'new-team':teamModal();break;
      case 'edit-team':teamModal(id);break;
      case 'new-criterion':criterionModal();break;
      case 'edit-criterion':criterionModal(id);break;
      case 'call':ui.selected=id;ui.tab='resumo';location.hash='resumos';break;
      case 'select-call':ui.selected=id;ui.tab='resumo';render();break;
      case 'pending-upload':modal('Importação pendente','Nenhum registro será criado nesta ação.', '<p>A importação exige arquivos, colaborador, cliente e identificador PABX. A integração será feita na próxima etapa.</p>');break;
      case 'feedback':download('SENX-revisao-0.1.2.json',JSON.stringify({version:'0.1.2',screen:location.hash,connection,viewport:innerWidth+'×'+innerHeight,createdAt:new Date().toISOString()},null,2),'application/json');toast('Contexto da revisão baixado para compartilhar com a equipe.');break;
      case 'export-calls':if(!connected()){toast('Conecte o banco antes de exportar.');return;}download('SENX-ligacoes.csv',C.toCsv([['ID','Contato','Telefone','Equipe','Data','Duração','Status'],...filteredCalls().map(c=>[c.id,c.client,c.phone,c.team,c.date,C.duration(c.seconds),c.status])]),'text/csv;charset=utf-8');break;
    }
  });
  document.addEventListener('change',event=>{const t=event.target;if(t.matches('[data-filter]')&&t.type!=='search'){ui[t.dataset.filter]=t.value;ui.page=1;render();}});
  let filterTimer;
  document.addEventListener('input',event=>{const t=event.target;if(!t.matches('input[type=search][data-filter]'))return;const value=t.value;clearTimeout(filterTimer);filterTimer=setTimeout(()=>{ui.query=value;ui.page=1;render();const input=document.querySelector('input[type=search][data-filter]');input?.focus();},180);});
  window.addEventListener('hashchange',()=>{clearTimeout(filterTimer);render();window.scrollTo(0,0);});
  render();loadDatabase();
})();
