import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

// Testes da fonte única da interface.
const file = name => { const source = new URL('../wwwroot/' + name, import.meta.url); return existsSync(source) ? source : new URL('../' + name, import.meta.url); };
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(file('core.js'), 'utf8'), sandbox);
vm.runInContext(readFileSync(file('data.js'), 'utf8'), sandbox);
const C = sandbox.window.SenxCore, D = sandbox.window.SenxData;

// Exercise the real application handlers with a small DOM adapter; no live records.
async function deletionUi(profile = 'Administrador') {
  const handlers = {}, windowHandlers = {}, requests = [];
  const app = { innerHTML: '', dataset: {} }, error = { textContent: '' };
  const cancel = { disabled: false, focus() {} };
  let dialog = null, html = '', pendingDelete, activeButton;
  const modalRoot = { set innerHTML(value) {
    html = value;
    dialog = { isConnected: true, showModal() {}, close() {}, remove() { this.isConnected=false; dialog=null; },
      addEventListener() {}, removeEventListener() {}, querySelector: () => error,
      querySelectorAll: () => [cancel, activeButton].filter(Boolean) };
  } };
  const data = { source:'postgresql', counts:{}, calls:[{id:'call',client:'Contato QA',date:'2026-11-06',seconds:60}],
    reports:[{id:'report',title:'Relatório QA',type:'Qualidade'}], criteria:[{id:'criterion',name:'Critério QA'}],
    customers:[{id:'customer',name:'Cliente QA'}], users:[{id:'self',name:'Admin'},{id:'user',name:'Colaborador'}],
    teams:[{id:'team',name:'Equipe QA',department:'QA'}] };
  const location = { hash:'#ligacoes' };
  const context = { location, setTimeout:()=>0, clearTimeout() {},
    document: { addEventListener(name, fn) { handlers[name]=fn; }, querySelector(selector) {
      if (selector==='#app') return app;
      if (selector==='#modal-root') return modalRoot;
      if (selector==='#modal-root dialog') return dialog;
      if (selector==='#modal-root [data-action=close]') return cancel;
      return null;
    } }, window: { addEventListener(name, fn) { windowHandlers[name]=fn; }, scrollTo() {},
      SenxSession:{ async request(path, options={}) {
        if (options.method==='DELETE') { requests.push(path); await new Promise(resolve=>pendingDelete=resolve); return {}; }
        if (path==='/api/auth/status') return {setupRequired:false};
        if (path==='/api/auth/session') return {id:'self',profile,name:'Admin'};
        return structuredClone(data);
      } } }
  };
  vm.createContext(context);
  for (const name of ['core.js','data.js','app.js']) vm.runInContext(readFileSync(file(name),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  return { app, requests, get html(){return html;}, finishDelete:()=>pendingDelete(),
    route(hash) { location.hash=hash; windowHandlers.hashchange(); },
    target(action,id) { const target={dataset:{action,id},disabled:false,closest:()=>dialog}; return target; },
    click(target) { activeButton=target; return handlers.click({target:{closest:()=>target}}); } };
}

test('ações de exclusão aparecem nas abas de cadastro e respeitam o perfil', async () => {
  const ui=await deletionUi();
  for (const [route,key] of [['ligacoes','calls:call'],['resumos','calls:call'],['relatorios','reports:report'],
    ['clientes','customers:customer'],['administracao/criterios','criteria:criterion'],
    ['administracao/departamentos','teams:team'],['administracao/usuarios','users:user']]) {
    ui.route('#'+route);
    assert.ok(ui.app.innerHTML.includes('data-id="'+key+'"'),route);
  }
  assert.ok(!ui.app.innerHTML.includes('data-id="users:self"'));
  const limited=await deletionUi('Colaborador');
  assert.ok(limited.app.innerHTML.includes('data-id="calls:call"'));
  await limited.click(limited.target('record-actions','calls:call'));
  assert.match(limited.html,/data-action="call-transcript"/);
  assert.match(limited.html,/data-action="call-info"/);
  assert.ok(!limited.html.includes('data-action="delete-record"'));
  await limited.click(limited.target('confirm-delete','calls:call'));
  assert.equal(limited.requests.length,0);
  await limited.click(limited.target('call-transcript','call'));
  assert.match(limited.html,/Transcrição da ligação/);
});

test('exclusão exige confirmação, cancelar não envia DELETE e clique repetido é bloqueado', async () => {
  const ui=await deletionUi();
  await ui.click(ui.target('record-actions','calls:call'));
  assert.match(ui.html,/data-action="delete-record"/);
  assert.equal(ui.requests.length,0);
  await ui.click(ui.target('delete-record','calls:call'));
  assert.match(ui.html,/Esta ação é permanente/);
  assert.equal(ui.requests.length,0);
  await ui.click(ui.target('close',''));
  assert.equal(ui.requests.length,0);
  await ui.click(ui.target('delete-record','calls:call'));
  const button=ui.target('confirm-delete','calls:call');
  const deletion=ui.click(button);
  assert.equal(button.disabled,true);
  await ui.click(button);
  assert.deepEqual(ui.requests,['/api/data/calls/call']);
  ui.finishDelete();
  await deletion;
});

test('produção começa sem qualquer dado demonstrativo', () => {
  for (const name of ['calls','teams','users','criteria','customers','reports','rankings']) assert.equal(D[name].length,0);
  assert.equal(D.version,'1.5.0.0'); assert.equal(D.source,null);
});
test('filtros combinados usam os dados fornecidos pelo servidor', () => {
  const rows=[{id:'a',client:'Contato de teste',team:'Equipe A',date:'2026-10-23',phone:'',agent:'',summary:''},{id:'b',client:'Outro',team:'Equipe B',date:'2026-10-22',phone:'',agent:'',summary:''}];
  assert.deepEqual(C.filterCalls(rows,{query:'contato',team:'Equipe A',date:'2026-10-23'}).map(x=>x.id),['a']);
  assert.equal(C.filterCalls([],{}).length,0);
});
test('busca ignora acentos e caixa', () => {
  assert.equal(C.search('João Ribeiro','JOAO'),true);
  assert.equal(C.search('Camila Souza','MARIA'),false);
});
test('paginação limita páginas e mantém total correto', () => {
  const result = C.paginate(Array.from({length:24},(_,id)=>({id})),99,8);
  assert.equal(result.page,3);assert.equal(result.total,24);assert.equal(result.items.length,8);
  assert.equal(C.paginate([],5).page,1);
});
test('conteúdo exibido escapa HTML e CSV protege fórmulas', () => {
  assert.equal(C.escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  const csv=C.toCsv([['nome','valor'],['Teste; A','=1+1'],['B','Texto "citado"']]);
  assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"Teste; A"'));assert.ok(csv.includes('"Texto ""citado"""'));
});
test('datas e duração não dependem de fuso do navegador', () => {
  assert.equal(C.formatDate('2026-10-23'),'23/10/2026');assert.equal(C.duration(317),'05:17');
});
test('requisições de alteração obtêm CSRF e usam cookie de mesma origem', async () => {
  const calls=[];
  const context={window:{dispatchEvent(){}},location:{protocol:'http:'},AbortSignal,Event,fetch:async(path,options)=>{
    calls.push({path,options});
    return {ok:true,status:200,text:async()=>JSON.stringify(path.endsWith('/csrf')?{token:'test-csrf'}:{id:'test-id'})};
  }};
  vm.createContext(context);vm.runInContext(readFileSync(file('session.js'),'utf8'),context);
  await context.window.SenxSession.request('/api/data/users',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.deepEqual(calls.map(c=>c.path),['/api/auth/csrf','/api/data/users']);
  assert.equal(calls[1].options.headers['X-CSRF-Token'],'test-csrf');
  assert.equal(calls[1].options.credentials,'same-origin');
});
test('CSRF recusado impede o envio da gravação', async () => {
  const calls=[];
  const context={window:{dispatchEvent(){}},location:{protocol:'http:'},AbortSignal,Event,fetch:async(path)=>{
    calls.push(path);return {ok:false,status:403,text:async()=>JSON.stringify({detail:'invalid-csrf'})};
  }};
  vm.createContext(context);vm.runInContext(readFileSync(file('session.js'),'utf8'),context);
  await assert.rejects(context.window.SenxSession.request('/api/data/users',{method:'POST'}),/invalid-csrf/);
  assert.deepEqual(calls,['/api/auth/csrf']);
});
test('sessão vencida avisa a interface sem guardar tokens', async () => {
  const events=[];
  const context={window:{dispatchEvent:event=>events.push(event.type)},location:{protocol:'http:'},AbortSignal,Event,
    fetch:async()=>({ok:false,status:401,text:async()=>''})};
  vm.createContext(context);vm.runInContext(readFileSync(file('session.js'),'utf8'),context);
  await assert.rejects(context.window.SenxSession.request('/api/data/snapshot'),/Entre com sua conta/);
  assert.deepEqual(events,['senx-session-expired']);
});

async function deletionUi(profile, requestDelete) {
  const handlers = {}, windowHandlers = {};
  const app = { innerHTML: '', dataset: {} }, error = { textContent: '' };
  const buttons = [{ disabled: false }, { disabled: false }];
  const dialog = { showModal() {}, close() {}, remove() {}, addEventListener() {}, removeEventListener() {} };
  const modal = { innerHTML: '' };
  const location = { hash: '#ligacoes' };
  class DeleteForm {
    dataset = {};
    fields;
    constructor(kind, id) { this.fields = { kind, id }; }
    reportValidity() { return true; }
    getAttribute() { return 'delete-form'; }
    closest() { return dialog; }
    querySelector() { return error; }
    querySelectorAll() { return buttons; }
  }
  const snapshot = { source: 'postgresql', counts: {}, calls: [{ id: 'call', client: 'Contato QA', transcript: 'Texto QA', date: '2026-11-06', seconds: 60 }],
    reports: [{ id: 'report', title: 'Relatório QA' }], teams: [{ id: 'team', name: 'Equipe QA' }],
    criteria: [{ id: 'criterion', name: 'Critério QA' }], customers: [{ id: 'customer', status: 'Inativo' }],
    users: [{ id: 'self', active: false }, { id: 'active', active: true }, { id: 'inactive', active: false }] };
  const ctx = { location, setTimeout, clearTimeout, HTMLFormElement: DeleteForm,
    FormData: function(form) { return Object.entries(form.fields); },
    document: { addEventListener(name, handler) { handlers[name] = handler; },
      querySelector(selector) {
        return { '#app': app, '#modal-root': modal, '#modal-root dialog': dialog }[selector] || null;
      } },
    window: { addEventListener(name, handler) { windowHandlers[name] = handler; }, scrollTo() {},
      SenxSession: { async request(path, options = {}) {
        if (options.method === 'DELETE') return requestDelete(path);
        if (path === '/api/auth/status') return { setupRequired: false };
        if (path === '/api/auth/session') return { id: 'self', profile, name: 'QA' };
        return structuredClone(snapshot);
      } } }
  };
  vm.createContext(ctx);
  for (const name of ['core.js', 'data.js', 'app.js']) vm.runInContext(readFileSync(file(name), 'utf8'), ctx);
  await new Promise(resolve => setImmediate(resolve));
  return {
    app, modal, error, buttons,
    route(hash) { location.hash = hash; windowHandlers.hashchange(); },
    click(action, id) { return handlers.click({ target: { closest: () => ({ dataset: { action, id } }) } }); },
    submit(form) { return handlers.submit({ target: form, preventDefault() {} }); },
    form(kind, id) { return new DeleteForm(kind, id); }
  };
}

test('menu de registros preserva travas de cadastro e ações de leitura do colaborador', async () => {
  const admin = await deletionUi('Administrador');
  for (const [hash, kind, id] of [['#relatorios', 'reports', 'report'], ['#administracao/criterios', 'criteria', 'criterion'],
    ['#administracao/departamentos', 'teams', 'team'], ['#clientes', 'customers', 'customer'],
    ['#administracao/usuarios', 'users', 'inactive']]) {
    admin.route(hash);
    assert.match(admin.app.innerHTML, new RegExp('data-id="' + kind + ':' + id + '"'));
  }
  assert.doesNotMatch(admin.app.innerHTML, /data-id="users:(self|active)"/);
  const collaborator = await deletionUi('Colaborador', () => assert.fail('DELETE de colaborador'));
  await collaborator.click('record-actions', 'calls:call');
  assert.match(collaborator.modal.innerHTML, /Ver transcrição/);
  assert.match(collaborator.modal.innerHTML, /Ver detalhes/);
  assert.doesNotMatch(collaborator.modal.innerHTML, /Excluir/);
  await collaborator.click('call-transcript', 'call');
  assert.match(collaborator.modal.innerHTML, /Texto QA/);
  await collaborator.submit(collaborator.form('calls', 'call'));
});

test('exclusão exige confirmação, bloqueia envio duplo e mostra conflito do servidor', async () => {
  const calls = [];
  let rejectDelete;
  const ui = await deletionUi('Administrador', path => {
    calls.push(path);
    return new Promise((_, reject) => { rejectDelete = reject; });
  });
  await ui.click('record-actions', 'calls:call');
  assert.match(ui.modal.innerHTML, /data-action="delete-record"/);
  assert.deepEqual(calls, []);
  await ui.click('delete-record', 'calls:call');
  assert.match(ui.modal.innerHTML, /id="confirm-delete"/);
  assert.match(ui.modal.innerHTML, /Esta ação é permanente/);
  await ui.click('close');
  assert.deepEqual(calls, []);
  await ui.click('delete-record', 'calls:call');
  const form = ui.form('calls', 'call');
  const pending = ui.submit(form);
  await ui.submit(form);
  assert.ok(ui.buttons.every(button => button.disabled));
  assert.deepEqual(calls, ['/api/data/calls/call']);
  rejectDelete(Object.assign(new Error('Há vínculos no histórico.'), { status: 409 }));
  await pending;
  assert.match(ui.error.textContent, /vínculos/);
  assert.ok(ui.buttons.every(button => !button.disabled));
});
