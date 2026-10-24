(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const KEY = 'senx.dev-manager.v1';
  const statuses = ['Planejado','Em desenvolvimento','Em validação','Concluído','Bloqueado'];
  const areas = ['Front-end','Back-end','Banco de dados','IA / API','Integração'];
  const tone = value => ({'Concluído':'good','Em desenvolvimento':'blue','Em validação':'warn','Bloqueado':'bad'}[value] || 'neutral');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatDate = value => new Date(value).toLocaleString('pt-BR', {dateStyle:'short',timeStyle:'short'});
  let state = {resources:[],history:[]}, storageAvailable = true, toastTimer;
  function toast(message) {
    $('#toast').textContent = message; $('#toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 6500);
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.resources) || !Array.isArray(parsed.history) ||
          !parsed.resources.every(r => typeof r.id === 'string' && typeof r.name === 'string' && statuses.includes(r.status) && areas.includes(r.area)) ||
          !parsed.history.every(h => typeof h.title === 'string' && typeof h.date === 'string')) throw new Error('Formato inválido');
      state = parsed;
    }
  } catch {
    storageAvailable = false;
    toast('Armazenamento local indisponível ou inválido. Novos registros ficarão apenas nesta sessão; exporte antes de sair.');
  }
  function save(next) {
    if (storageAvailable) {
      try { localStorage.setItem(KEY, JSON.stringify(next)); }
      catch { storageAvailable = false; toast('Não foi possível salvar no navegador. Exporte os registros antes de sair.'); }
    }
    state = next;
  }
  function render() {
    const query = $('#search').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const filtered = state.resources.filter(r => (!$('#area-filter').value || r.area === $('#area-filter').value) &&
      (!$('#status-filter').value || r.status === $('#status-filter').value) &&
      (r.name + ' ' + (r.owner || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query));
    $('#total').textContent = state.resources.length;
    $('#in-progress').textContent = state.resources.filter(r => r.status === 'Em desenvolvimento').length;
    $('#in-review').textContent = state.resources.filter(r => r.status === 'Em validação').length;
    $('#done').textContent = state.resources.filter(r => r.status === 'Concluído').length;
    $('#resource-rows').innerHTML = filtered.map(r => '<tr><td><strong>' + escapeHtml(r.name) + '</strong><small>' + escapeHtml(r.notes || 'Sem pendências registradas') +
      '</small></td><td>' + escapeHtml(r.area) + '</td><td>' + escapeHtml(r.owner || 'Não definido') +
      '</td><td><span class="badge ' + tone(r.status) + '">' + escapeHtml(r.status) + '</span></td><td>' +
      escapeHtml(formatDate(r.updated)) + '</td><td><div class="row-actions"><button class="secondary" data-edit="' + escapeHtml(r.id) +
      '">Editar</button><button class="secondary" data-delete="' + escapeHtml(r.id) + '">Excluir</button></div></td></tr>').join('');
    $('#empty').hidden = filtered.length > 0;
    $('#empty-title').textContent = state.resources.length ? 'Nenhum recurso encontrado' : 'Organize a próxima implementação';
    $('#empty-text').textContent = state.resources.length ? 'Ajuste a busca ou os filtros para encontrar outros recursos.' : 'Adicione um recurso para acompanhar seu desenvolvimento e suas pendências.';
    $('#resource-count').textContent = filtered.length + ' de ' + state.resources.length + ' recursos';
    $('#test-history').innerHTML = state.history.length ? state.history.map(h => '<article class="history-item"><span class="badge ' +
      ({ok:'good',warning:'warn',error:'bad'}[h.status] || 'neutral') + '">' + escapeHtml({ok:'Sucesso',warning:'Atenção',error:'Falha'}[h.status] || 'Registro') +
      '</span><div><p>' + escapeHtml(h.title) + '</p><small>' + escapeHtml(formatDate(h.date)) + ' · ' + escapeHtml(h.detail) + '</small></div></article>').join('') :
      '<div class="empty"><h3>Nenhum teste registrado</h3><p>Execute uma verificação de serviços para começar.</p></div>';
  }
  function log(title, status, detail) {
    save({...state, history:[{title,status,detail,date:new Date().toISOString()},...state.history].slice(0,100)});
    render();
  }
  function openResource(id) {
    $('#resource-form').reset();
    const resource = state.resources.find(r => r.id === id);
    $('#resource-id').value = resource?.id || '';
    for (const [field, value] of Object.entries({name:resource?.name || '',area:resource?.area || areas[0],status:resource?.status || statuses[0],owner:resource?.owner || '',notes:resource?.notes || ''})) $('#resource-' + field).value = value;
    $('#dialog-title').textContent = resource ? 'Editar recurso' : 'Novo recurso';
    $('#resource-dialog').showModal();
    $('#resource-name').focus();
  }
  $('#new-resource').addEventListener('click', () => openResource());
  for (const id of ['close-dialog','cancel-dialog']) $('#' + id).addEventListener('click', () => $('#resource-dialog').close());
  $('#resource-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#resource-name').value.trim();
    if (!name) { $('#resource-name').setCustomValidity('Informe o nome do recurso.'); $('#resource-name').reportValidity(); return; }
    const id = $('#resource-id').value;
    const item = {id:id || crypto.randomUUID(),name,area:$('#resource-area').value,status:$('#resource-status').value,owner:$('#resource-owner').value.trim(),notes:$('#resource-notes').value.trim(),updated:new Date().toISOString()};
    save({...state,resources:id ? state.resources.map(r => r.id === id ? item : r) : [item,...state.resources]});
    $('#resource-dialog').close(); render();
    toast(storageAvailable ? 'Recurso salvo neste navegador.' : 'Recurso mantido apenas nesta sessão. Exporte os registros.');
  });
  $('#resource-name').addEventListener('input', () => $('#resource-name').setCustomValidity(''));
  $('#resource-rows').addEventListener('click', event => {
    const edit = event.target.closest('[data-edit]'), remove = event.target.closest('[data-delete]');
    if (edit) openResource(edit.dataset.edit);
    if (remove && confirm('Excluir este recurso do acompanhamento local?')) {
      save({...state,resources:state.resources.filter(r => r.id !== remove.dataset.delete)}); render(); toast('Recurso excluído.');
    }
  });
  for (const id of ['search','area-filter','status-filter']) $('#' + id).addEventListener('input', render);
  $('#export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'SENX-gerenciador-' + new Date().toISOString().slice(0,10) + '.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000); toast('Exportação preparada. Nenhum envio externo foi realizado.');
  });
  $('#clear-history').addEventListener('click', () => {
    if (state.history.length && confirm('Limpar os registros de testes deste navegador?')) { save({...state,history:[]}); render(); }
  });
  const request=window.SenxSession.request;
  async function showSession() {
    try {
      const user=await request('/api/auth/session');
      const admin=user.profile==='Administrador';
      $('#session-status').textContent=admin?'Conectado: '+user.name+' · Administrador':'Sua conta não possui acesso ao diagnóstico completo.';
      $('#diagnostic-login').hidden=true;$('#diagnostic-logout').hidden=false;
      $('#check-health').disabled=!admin;
    }catch(error){
      $('#session-status').textContent=error.status===401?'Entre com sua conta de administrador.':error.message;
      $('#diagnostic-login').hidden=false;$('#diagnostic-logout').hidden=true;$('#check-health').disabled=true;
    }
  }
  $('#diagnostic-login').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;$('#login-error').textContent='';
    try{
      await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#diagnostic-email').value,password:$('#diagnostic-password').value})});
      $('#diagnostic-password').value='';await showSession();
    }catch(error){$('#login-error').textContent=error.message;}finally{button.disabled=false;}
  });
  $('#diagnostic-logout').addEventListener('click',async()=>{
    try{await request('/api/auth/logout',{method:'POST'});$('#schema-rows').replaceChildren();$('#db-identity').textContent='Sessão encerrada.';await showSession();}
    catch(error){toast(error.message);}
  });
  window.addEventListener('senx-session-expired',()=>showSession());
  function present(id,label,className) { $('#' + id).textContent=label; $('#' + id).className='badge ' + className; }
  async function checkHealth() {
    const button=$('#check-health'); button.disabled=true;
    for(const id of ['api-status','db-status','data-status']) present(id,'Verificando…','neutral');
    $('#schema-rows').replaceChildren();
    const started=performance.now();
    try {
      const [api,db,data]=await Promise.allSettled([request('/api/health'),request('/api/database/health'),request('/api/data/snapshot')]);
      const apiOk=api.status==='fulfilled' && api.value.status==='ok';
      present('api-status',apiOk?'Operacional':'Indisponível',apiOk?'good':'bad');
      $('#api-detail').textContent=apiOk?'API '+api.value.version:api.reason?.message || 'Resposta inesperada.';
      const database=db.status==='fulfilled'?db.value:db.reason.body;
      const dbOk=database?.status==='ok';
      present('db-status',dbOk?'Validado':database?.status || 'Indisponível',dbOk?'good':'bad');
      $('#db-detail').textContent=database?.detail || db.reason?.message || 'Sem detalhes.';
      $('#db-identity').textContent=database?.database ? 'Banco: '+database.database+' · Usuário: '+database.user+' · PostgreSQL '+database.serverVersion : 'Sem conexão confirmada.';
      const dataOk=data.status==='fulfilled' && data.value.source==='postgresql';
      present('data-status',dataOk?'Leitura validada':'Indisponível',dataOk?'good':'bad');
      $('#data-detail').textContent=dataOk?'Snapshot consultado no PostgreSQL.':data.reason?.message || 'Resposta inesperada.';
      $('#schema-rows').innerHTML=(database?.tables || []).map(t=>'<tr><td>'+escapeHtml(t.name)+'</td><td>'+escapeHtml(dataOk?data.value.counts[t.name] ?? '—':'—')+
        '</td><td>'+(!t.exists?'Ausente':t.missingColumns.length?'Faltam: '+escapeHtml(t.missingColumns.join(', ')):'OK')+
        '</td><td>'+(t.canRead?'Sim':'Não')+'</td><td>'+(['Equipe','Criterio','Usuario'].includes(t.name)?(t.canInsert && t.canUpdate?'INSERT / UPDATE OK':'Permissão incompleta'):'Somente leitura na aplicação')+'</td></tr>').join('');
      $('#last-check').textContent='Última verificação: '+formatDate(new Date())+' · '+Math.round(performance.now()-started)+' ms';
      log('API e PostgreSQL',apiOk && dbOk && dataOk?'ok':'error','API: '+(apiOk?'OK':'falha')+' · Banco: '+(database?.status || 'falha')+' · Leitura: '+(dataOk?'OK':'falha'));
    } finally { button.disabled=false; }
  }
  $('#check-health').addEventListener('click',checkHealth);
  for(const image of document.querySelectorAll('.brand img')) image.src='assets/'+image.src.split('/').pop();
  $('#open-app').href='http://localhost:5080/';
  function activeLink() {
    for(const link of document.querySelectorAll('nav a')) {
      const active=link.hash===(location.hash || '#overview'); link.classList.toggle('active',active);
      if(active) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
    }
  }
  window.addEventListener('hashchange',activeLink); activeLink(); render(); showSession();
})();
