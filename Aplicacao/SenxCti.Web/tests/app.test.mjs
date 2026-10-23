import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

// O mesmo teste roda tanto na fonte quanto no pacote portátil gerado.
const file = name => { const source = new URL('../wwwroot/' + name, import.meta.url); return existsSync(source) ? source : new URL('../' + name, import.meta.url); };
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(file('core.js'), 'utf8'), sandbox);
vm.runInContext(readFileSync(file('data.js'), 'utf8'), sandbox);
const C = sandbox.window.SenxCore, D = sandbox.window.SenxData;

test('produção começa sem qualquer dado demonstrativo', () => {
  for (const name of ['calls','teams','users','criteria','reports','rankings']) assert.equal(D[name].length,0);
  assert.equal(D.version,'0.1.2'); assert.equal(D.source,null);
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
