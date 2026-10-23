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
      '<div class="empty"><h3>Nenhum teste registrado</h3><p>Execute uma verificação de serviços ou uma análise para começar.</p></div>';
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
  async function request(path, options = {}) {
    if (location.protocol === 'file:') throw new Error('Abra com npm run gerenciar ou pela API em /gerenciador/ para executar integrações.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(path,{...options,signal:controller.signal});
      let body;
      try { body = await response.json(); } catch { throw new Error('A API retornou uma resposta inválida. Verifique se o back-end está em execução.'); }
      if (!response.ok) throw Object.assign(new Error(body.detail || body.title || body.error || 'A API retornou HTTP ' + response.status),{body,status:response.status});
      return body;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Tempo limite de 20 segundos excedido.');
      if (error instanceof TypeError) throw new Error('API local indisponível. Inicie o back-end na porta 5080.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function present(id,label,className) { $('#' + id).textContent=label; $('#' + id).className='badge ' + className; }
  async function checkHealth() {
    const button=$('#check-health'); button.disabled=true;
    for(const id of ['api-status','db-status','ai-status']) present(id,'Verificando…','neutral');
    const started=performance.now();
    const [api,db] = await Promise.allSettled([request('/api/health'),request('/api/database/health')]);
    let apiOk=false, dbOk=false, provider='desconhecido';
    if(api.status === 'fulfilled') {
      apiOk=api.value.status === 'ok'; provider=api.value.aiProvider || 'desconhecido';
      present('api-status',apiOk?'Operacional':'Indisponível',apiOk?'good':'bad');
      present('ai-status',provider==='fake'?'Simulado local':provider,provider==='fake'?'warn':'neutral');
      $('#ai-detail').textContent=provider==='fake'?'Adaptador de teste; não usa um modelo real.':'Provedor declarado pela API; disponibilidade ainda não validada por análise.';
    } else { present('api-status','Indisponível','bad'); present('ai-status','Não verificado','neutral'); $('#ai-detail').textContent=api.reason.message; }
    const database=db.status === 'fulfilled'?db.value:db.reason.body;
    dbOk=database?.status==='ok';
    present('db-status',dbOk?'Conectado':database?.status==='not_configured'?'Não configurado':'Indisponível',dbOk?'good':database?.status==='not_configured'?'warn':'bad');
    $('#db-detail').textContent=database?.detail || (db.status==='rejected'?db.reason.message:'Sem detalhes.');
    $('#last-check').textContent='Última verificação: ' + formatDate(new Date()) + ' · ' + Math.round(performance.now()-started) + ' ms';
    log('Verificação das integrações',apiOk && dbOk && provider!=='fake'?'ok':apiOk?'warning':'error','API: ' + (apiOk?'operacional':'indisponível') + ' · Banco: ' + $('#db-status').textContent + ' · IA: ' + provider);
    button.disabled=false;
  }
  $('#check-health').addEventListener('click',checkHealth);
  $('#analysis-form').addEventListener('submit', async event => {
    event.preventDefault();
    const transcript=$('#transcript').value.trim(), result=$('#analysis-result'), button=event.currentTarget.querySelector('button');
    if(!transcript) { toast('Informe uma transcrição para testar.'); return; }
    button.disabled=true; result.textContent='Consultando o provedor da API…';
    const start=performance.now();
    try {
      const health=await request('/api/health');
      if (!health.aiProvider) throw new Error('A API não informou o provedor. Envio cancelado.');
      if (health.aiProvider !== 'fake' && !confirm('A API informou o provedor ' + health.aiProvider + '. Este teste enviará a transcrição e poderá consumir a cota do modelo. Executar?')) { result.textContent='Teste cancelado antes do envio.'; return; }
      const analysis=await request('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transcript})});
      if(typeof analysis.summary!=='string' || typeof analysis.provider!=='string' || !Array.isArray(analysis.topics)) throw new Error('Contrato de análise inválido: faltam campos esperados.');
      result.className='';
      result.innerHTML='<p class="muted">' + (analysis.provider==='fake'?'Resposta simulada — não valida a qualidade de um modelo real.':'Resposta recebida do adaptador da API.') +
        '</p><dl><dt>Provedor</dt><dd>' + escapeHtml(analysis.provider) + '</dd><dt>Resumo</dt><dd>' + escapeHtml(analysis.summary) +
        '</dd><dt>Assuntos</dt><dd>' + escapeHtml(analysis.topics.join(', ')) + '</dd><dt>Criticidade</dt><dd>' + escapeHtml(analysis.criticality) +
        '</dd><dt>Duração</dt><dd>' + Math.round(performance.now()-start) + ' ms</dd></dl>';
      log('Análise de transcrição',analysis.provider==='fake'?'warning':'ok','Contrato recebido · Provedor: ' + analysis.provider + ' · ' + Math.round(performance.now()-start) + ' ms');
    } catch(error) { result.textContent=error.message; log('Análise de transcrição','error',error.message); }
    finally { button.disabled=false; }
  });
  if (location.protocol !== 'file:' && location.pathname.startsWith('/gerenciador')) {
    const images=document.querySelectorAll('.brand img');
    images[0].src='/assets/senx-symbol.png'; images[1].src='/assets/senx-wordmark.png'; $('#open-app').href='/';
  }
  function activeLink() {
    for(const link of document.querySelectorAll('nav a')) {
      const active=link.hash===(location.hash || '#overview'); link.classList.toggle('active',active);
      if(active) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
    }
  }
  window.addEventListener('hashchange',activeLink); activeLink(); render();
})();
