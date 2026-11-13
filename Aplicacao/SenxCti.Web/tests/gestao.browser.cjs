// QA local: cenários de uso com API simulada, sem alterar contas reais.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../wwwroot');
const artifact=process.env.SENX_QA_ARTIFACTS;
const admin={id:'admin',name:'Supervisora QA',email:'supervisora@example.invalid',profile:'Administrador',job:'Supervisão',team:'Suporte'};
const seed=()=>({source:'postgresql',fetchedAt:new Date().toISOString(),counts:{Ligacao:1},rankings:[],
 teams:[{id:'team',name:'Suporte',department:'Atendimento',members:2}],
 users:[{...admin,active:true},{id:'agent',name:'Camila QA',email:'camila@example.invalid',team:'Suporte',profile:'Colaborador',active:true},{id:'inactive',name:'Inativo QA',team:'Suporte',profile:'Colaborador',active:false}],
 customers:[{id:'customer',name:'Maria QA',email:'maria@example.invalid',phone:'11999998888',status:'Ativo',consent:false,userId:'agent',agent:'Camila QA',calls:1}],
 calls:[{id:'call',analysisId:'analysis',client:'Maria QA',phone:'11999998888',agent:'Camila QA',team:'Suporte',date:'2026-11-06',time:'09:00',seconds:120,score:0,processed:true,reviewed:false,model:'QA-fixture',summary:'Cobrança duplicada; verificar estorno.',transcript:'[00:01] Cliente: Preciso conferir a cobrança.\n[00:05] Atendente: Vou verificar.',commitments:'Retornar até amanhã.',nextStep:'Encaminhar ao financeiro.',topic:'Cobrança',status:'Concluída',hasAudio:false,pabxId:'QA-1'}],
 reports:[{id:'report',title:'Relatório de cobrança QA',type:'Qualidade',team:'Suporte',teamId:'team',date:'2026-11-06',period:'Últimos 7 dias',status:'Gerado',score:'0',summary:'Uma ligação; nota zero preservada.',criteria:'Catálogo QA'}],
 criteria:[{id:'criterion',name:'Clareza QA',description:'Explica o procedimento',rule:'Verificar evidência',version:'1',active:true}]});

(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
  for (const profile of ['Administrador','Colaborador']) {
   const page = await browser.newPage({viewport:{width:1440,height:1000}});
   const errors=[]; page.on('pageerror',error=>errors.push(error.message));
   const state=seed(); state.reports=Array.from({length:12},(_,i)=>({...state.reports[0],id:'r'+i,title:'Relatório '+i}));
   if(profile==='Colaborador')state.reports=[];
   await page.route('http://senx.test/**',route=>{
    const url=new URL(route.request().url()),p=url.pathname;
    const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    if(p==='/api/auth/status')return json({setupRequired:false});
    if(p==='/api/auth/session')return json({...admin,profile});
    if(p==='/api/data/snapshot')return json(state);
    if(p==='/api/data/rankings')return json({period:'Últimos 7 dias (UTC)',rows:[{position:1,name:'Camila QA',team:'Suporte',calls:5,evaluated:3,pending:2,score:85},{position:2,name:'João QA',team:'Suporte',calls:2,evaluated:2,pending:0,score:0}]});
    const file=path.join(root,p==='/'?'index.html':p.slice(1));
    return route.fulfill({status:fs.existsSync(file)?200:404,body:fs.existsSync(file)?fs.readFileSync(file):'',contentType:{'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png'}[path.extname(file)]||'application/octet-stream'});
   });
   for (const screen of ['ligacoes','rankings','relatorios','administracao','administracao/criterios']) {
    await page.goto('http://senx.test/#'+screen);
    await page.locator('.page-head h1').waitFor();
    if(screen==='rankings')await page.getByText('Camila QA',{exact:true}).waitFor();
    if(artifact){fs.mkdirSync(artifact,{recursive:true});await page.screenshot({path:path.join(artifact,profile+'-'+screen.replace('/','-')+'.png'),fullPage:true});}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Sem overflow móvel em '+screen);
    await page.setViewportSize({width:1440,height:1000});
   }
   await page.goto('http://senx.test/#rankings');
   await page.getByText('Camila QA',{exact:true}).waitFor();
   await page.locator('input[type=search]').fill('João');
   await page.waitForFunction(()=>!document.querySelector('.ranking-table').textContent.includes('Camila QA'));
   assert.equal(await page.locator('.ranking-table tbody tr').count(),1);
   assert.equal(await page.locator('.ranking-quality progress').getAttribute('value'),'0');
   await page.locator('[data-action=clear-ranking]').click();
   await page.getByText('Camila QA',{exact:true}).waitFor();
   if(profile==='Administrador') {
    const download=page.waitForEvent('download');await page.locator('[data-action=export-ranking]').click();assert.equal((await download).suggestedFilename(),'SENX-ranking.csv');
    await page.goto('http://senx.test/#administracao');
    await page.locator('[data-filter=userStatus]').selectOption('Inativo');
    assert.equal(await page.locator('.users-table tbody tr').count(),1);
    await page.getByText('Inativo QA',{exact:true}).waitFor();
    await page.goto('http://senx.test/#relatorios');
    assert.equal(await page.locator('.report-table tbody tr').count(),8);
    await page.getByRole('button',{name:'Próxima página'}).click();
    assert.equal(await page.locator('.report-table tbody tr').count(),4);
    await page.locator('[data-filter=reportStatus]').selectOption('Gerado');
    assert.equal(await page.locator('.report-table tbody tr').count(),8);
   } else {
    assert.equal(await page.locator('[data-action=export-ranking]').count(),0);
    assert.equal(await page.locator('[data-action=ranking-report]').count(),0);
    await page.goto('http://senx.test/#ligacoes');
    assert.equal(await page.locator('.review-banner').count(),0);
    assert.equal(await page.locator('[data-action=export-calls]').count(),0);
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: cinco telas, dois perfis, desktop/mobile, filtro de status, paginação, busca ranking, nota zero e exportação. API simulada.');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
