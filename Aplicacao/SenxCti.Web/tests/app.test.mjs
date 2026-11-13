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

test('colaborador consulta relatórios e apenas administrador tem opção de download', async () => {
  for (const profile of ['Colaborador', 'Administrador']) {
    const ui = await deletionUi(profile);
    ui.route('#relatorios');
    assert.match(ui.app.innerHTML, /data-action="view-report"/);
    assert.equal(ui.app.innerHTML.includes('data-action="export-report"'), profile === 'Administrador');
    await ui.click('view-report', 'report');
    assert.match(ui.modal.innerHTML, /Resumo Executivo/);
    if (profile === 'Colaborador') {
      // The DOM adapter has no download API: bypassing the hidden button must still be a no-op.
      await ui.click('export-report', 'report');
    }
  }
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

test('prioridade da IA ordena antes da data e da paginação, sem usar a nota', () => {
  const rows = [
    {id:'normal',processed:true,priority:0,score:0,date:'2026-11-12',time:'12:00'},
    {id:'medium',processed:true,priority:1,date:'2026-11-11',time:'12:00'},
    {id:'high-old',processed:true,priority:2,score:100,reviewed:true,date:'2026-11-10',time:'12:00'},
    {id:'high-new',processed:true,priority:2,date:'2026-11-11',time:'12:00'}
  ];
  const ordered = C.prioritizeCalls(rows);
  assert.deepEqual(Array.from(ordered, c => c.id), ['high-new','high-old','medium','normal']);
  assert.equal(C.paginate(ordered, 1, 1).items[0].id, 'high-new');
  assert.equal(rows[0].id, 'normal');
  assert.equal(C.callPriority({processed:true,priority:2,model:'offline/simulado-v1'}), 0);
  assert.equal(C.callPriority({processed:false,priority:2}), 0);
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
        if (options.method === 'DELETE') {
          const result = await requestDelete(path);
          const [, , , kind, id] = path.split('/');
          snapshot[kind] = snapshot[kind].filter(row => row.id !== id);
          return result;
        }
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

test('exclusão confirmada atualiza a lista e não envia a mesma requisição duas vezes', async () => {
  const calls = [];
  let finish;
  const ui = await deletionUi('Administrador', path => {
    calls.push(path);
    return new Promise(resolve => { finish = resolve; });
  });
  await ui.click('delete-record', 'calls:call');
  const form = ui.form('calls', 'call');
  const pending = ui.submit(form);
  await ui.submit(form);
  assert.deepEqual(calls, ['/api/data/calls/call']);
  assert.ok(ui.buttons.every(button => button.disabled));
  finish({});
  await pending;
  assert.doesNotMatch(ui.app.innerHTML, /data-id="calls:call"/);
  assert.equal(ui.error.textContent, '');
});

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

test('revisão pendente sobrepõe borda até validar, relatórios e ranking colorido seguem padrão e colaborador não exporta ranking nem vê banner de revisão', async () => {
  async function bootUi(profile) {
    const handlers = {}, windowHandlers = {}, downloads = [];
    const app = { innerHTML: '', dataset: {} }, modal = { innerHTML: '' };
    const location = { hash: '#ligacoes' };
    const snapshot = {
      source: 'postgresql',
      counts: {},
      teams: [{ id: 'team', name: 'Suporte CTI' }],
      criteria: [{ id: 'c1', name: 'Clareza', active: true }, { id: 'c2', name: 'Cordialidade', active: true }],
      users: [], customers: [],
      calls: [
        { id: 'c-high-rev', client: 'Cliente Alto Pendente', date: '2026-11-13', seconds: 30, processed: true, reviewed: false, priority: 2, model: 'gemini', topic: 'Suporte' },
        { id: 'c-med-rev', client: 'Cliente Médio Pendente', date: '2026-11-13', seconds: 30, processed: true, reviewed: false, priority: 1, model: 'gemini', topic: 'Suporte' },
        { id: 'c-high', client: 'Cliente Alto Revisado', date: '2026-11-13', seconds: 30, processed: true, reviewed: true, priority: 2, model: 'gemini', topic: 'Suporte' },
        { id: 'c-med', client: 'Cliente Médio Revisado', date: '2026-11-13', seconds: 30, processed: true, reviewed: true, priority: 1, model: 'gemini', topic: 'Suporte' },
        { id: 'c-norm', client: 'Cliente Normal Revisado', date: '2026-11-13', seconds: 30, processed: true, reviewed: true, priority: 0, model: 'gemini', topic: 'Suporte' }
      ],
      reports: [
        { id: 'r1', title: 'Ligações críticas', type: 'Retenção', team: 'Suporte CTI', appliedCriteria: ['Intenção de cancelamento', 'Satisfação'], period: '07/11/2026 a 13/11/2026', status: 'Aguarda revisão', highPriority: 1, mediumPriority: 1, normalPriority: 0, highPriorityPending: 1, summary: 'Resumo.' },
        { id: 'r2', title: 'Qualidade semanal', type: 'Qualidade', team: 'Suporte CTI', appliedCriteria: ['Clareza'], period: '07/11/2026 a 13/11/2026', status: 'Concluído', highPriority: 0, mediumPriority: 0, normalPriority: 2, highPriorityPending: 0, summary: 'OK.' }
      ]
    };
    const ctx = {
      location, setTimeout, clearTimeout, URLSearchParams,
      Blob: function(parts) { return { parts }; },
      URL: { createObjectURL(b) { downloads.push(b); return 'blob:test'; }, revokeObjectURL() {} },
      document: {
        addEventListener(name, handler) { handlers[name] = handler; },
        querySelector(selector) { return selector === '#app' ? app : selector === '#modal-root' ? modal : null; },
        createElement() { return { click() {} }; }
      },
      window: {
        addEventListener(name, handler) { windowHandlers[name] = handler; }, scrollTo() {},
        SenxSession: {
          async request(path) {
            if (path === '/api/auth/status') return { setupRequired: false };
            if (path === '/api/auth/session') return { id: 'u1', profile, name: 'Arthur' };
            if (path.startsWith('/api/data/rankings')) return { period: 'Últimos 7 dias (UTC)', rows: [{ position: 1, name: 'Rafael', team: 'Suporte CTI', calls: 2, avgSeconds: 26, evaluated: 2, pending: 0, score: 100 }] };
            return structuredClone(snapshot);
          }
        }
      }
    };
    vm.createContext(ctx);
    for (const name of ['core.js', 'data.js', 'app.js']) vm.runInContext(readFileSync(file(name), 'utf8'), ctx);
    await new Promise(resolve => setImmediate(resolve));
    return {
      app, modal, downloads,
      route(hash) { location.hash = hash; windowHandlers.hashchange(); },
      click(action, id) { return handlers.click({ target: { closest: () => ({ dataset: { action, id } }) } }); }
    };
  }

  const admin = await bootUi('Administrador');
  assert.match(admin.app.innerHTML, /review-banner/);
  assert.match(admin.app.innerHTML, /data-action="export-calls"/);
  assert.match(admin.app.innerHTML, /<tr class="needs-review">[\s\S]*Cliente Alto Pendente[\s\S]*Alta prioridade/);
  assert.match(admin.app.innerHTML, /<tr class="needs-review">[\s\S]*Cliente Médio Pendente[\s\S]*Média prioridade/);
  assert.match(admin.app.innerHTML, /<tr class="high-priority">[\s\S]*Cliente Alto Revisado/);
  assert.match(admin.app.innerHTML, /<tr class="medium-priority">[\s\S]*Cliente Médio Revisado[\s\S]*badge yellow">Média prioridade<\/span>/);
  assert.match(admin.app.innerHTML, /<tr class="normal-priority">[\s\S]*Cliente Normal Revisado/);

  admin.route('#relatorios');
  assert.match(admin.app.innerHTML, /metric-icon blue/);
  assert.match(admin.app.innerHTML, /metric-icon green/);
  assert.match(admin.app.innerHTML, /metric-icon yellow/);
  assert.match(admin.app.innerHTML, /metric-icon purple/);
  assert.match(admin.app.innerHTML, /<tr class="report-alert">[\s\S]*Alerta · 1 ligação\(ões\) crítica\(s\) requer\(em\) validação humana/);
  assert.match(admin.app.innerHTML, /badge purple">Retenção<\/span>/);
  assert.match(admin.app.innerHTML, /badge blue">Qualidade<\/span>/);
  assert.match(admin.app.innerHTML, /badge amber">Aguarda revisão<\/span>/);
  assert.match(admin.app.innerHTML, /badge green">Concluído<\/span>/);

  admin.route('#rankings');
  await new Promise(resolve => setImmediate(resolve));
  assert.match(admin.app.innerHTML, /data-action="export-ranking"/);
  assert.match(admin.app.innerHTML, /metric-icon blue/);
  assert.match(admin.app.innerHTML, /metric-icon green/);
  assert.match(admin.app.innerHTML, /metric-icon amber/);
  assert.match(admin.app.innerHTML, /metric-icon purple/);

  const collaborator = await bootUi('Colaborador');
  assert.doesNotMatch(collaborator.app.innerHTML, /review-banner/);
  assert.doesNotMatch(collaborator.app.innerHTML, /data-action="review-pending"/);
  assert.doesNotMatch(collaborator.app.innerHTML, /data-action="export-calls"/);
  await collaborator.click('review-pending');
  await collaborator.click('export-calls');
  assert.equal(collaborator.downloads.length, 0);
  assert.doesNotMatch(collaborator.app.innerHTML, /<option selected>Aguarda revisão<\/option>/);

  collaborator.route('#rankings');
  await new Promise(resolve => setImmediate(resolve));
  assert.doesNotMatch(collaborator.app.innerHTML, /data-action="export-ranking"/);
  await collaborator.click('export-ranking');
  assert.equal(collaborator.downloads.length, 0);
});
