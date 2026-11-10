// QA local: cenários de uso com API simulada, sem alterar contas reais.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../wwwroot');
const artifact=process.env.SENX_QA_ARTIFACTS;
const results=[];
const admin={id:'admin',name:'Supervisora QA',email:'supervisora@example.invalid',profile:'Administrador',job:'Supervisão',team:'Suporte'};
const seed=()=>({source:'postgresql',fetchedAt:new Date().toISOString(),counts:{Ligacao:1},rankings:[],
 teams:[{id:'team',name:'Suporte',department:'Atendimento',members:2}],
 users:[{...admin,active:true},{id:'agent',name:'Camila QA',email:'camila@example.invalid',team:'Suporte',profile:'Colaborador',active:true},{id:'inactive',name:'Inativo QA',team:'Suporte',profile:'Colaborador',active:false}],
 customers:[{id:'customer',name:'Maria QA',email:'maria@example.invalid',phone:'11999998888',status:'Ativo',consent:false,userId:'agent',agent:'Camila QA',calls:1}],
 calls:[{id:'call',analysisId:'analysis',client:'Maria QA',phone:'11999998888',agent:'Camila QA',team:'Suporte',date:'2026-11-06',time:'09:00',seconds:120,score:0,processed:true,reviewed:false,model:'QA-fixture',summary:'Cobrança duplicada; verificar estorno.',transcript:'[00:01] Cliente: Preciso conferir a cobrança.\n[00:05] Atendente: Vou verificar.',commitments:'Retornar até amanhã.',nextStep:'Encaminhar ao financeiro.',topic:'Cobrança',status:'Concluída',hasAudio:false,pabxId:'QA-1'}],
 reports:[{id:'report',title:'Relatório de cobrança QA',type:'Qualidade',team:'Suporte',teamId:'team',date:'2026-11-06',period:'Últimos 7 dias',status:'Gerado',score:'0',summary:'Uma ligação; nota zero preservada.',criteria:'Catálogo QA'}],
 criteria:[{id:'criterion',name:'Clareza QA',description:'Explica o procedimento',rule:'Verificar evidência',version:'1',active:true}]});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 async function scenario(screen,situation,fn,mode='normal'){
  if(process.env.SENX_QA_FILTER && !screen.includes(process.env.SENX_QA_FILTER))return;
  console.log('RUN:',screen,situation);
  const context=await browser.newContext({viewport:mode==='mobile'?{width:390,height:844}:{width:1440,height:960}});
  const page=await context.newPage();page.setDefaultTimeout(3500);
  let state=seed(),logged=!['login','setup'].includes(mode);const writes=[],errors=[];
  if(mode==='empty')for(const key of ['calls','reports','customers','users','teams','criteria'])state[key]=[];
  if(mode==='empty')state.counts={};
  const identity=mode==='collaborator'?{...admin,id:'agent',profile:'Colaborador'}:admin;
  if(mode==='collaborator'){state.reports=[];state.users=state.users.filter(u=>u.id==='agent');}
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://senx.test/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(p==='/api/auth/status')return json({setupRequired:mode==='setup',teams:[]});
   if(p==='/api/auth/session')return logged?json(identity):json({detail:'Sessão ausente'},401);
   if(p==='/api/auth/csrf')return json({token:'qa'});
   if(p==='/api/data/snapshot')return mode==='offline'?json({detail:'Banco indisponível QA'},503):json(state);
   if(p==='/api/data/rankings')return mode==='offline'?json({detail:'Banco indisponível QA'},503):json({
    period:'Período QA (UTC)',rows:mode==='empty'?[]:[{name:'Camila QA',team:'Suporte',position:mode==='collaborator'?null:1,calls:1,evaluated:1,pending:0,score:0}]
   });
   if(p==='/api/ligacoes/upload-options')return json({users:state.users,customers:state.customers});
   if(req.method()!=='GET'){
    writes.push({p,method:req.method(),body:req.postDataJSON?.bind(req)});
    if(p==='/api/ligacoes/upload'){
     if(situation.includes('falha'))return json({detail:'Falha de análise QA'},503);
     state.calls.push({...state.calls[0],id:'novo-audio',client:'Gravação nova QA'});
     return json({id:'novo-audio',simulated:false},201);
    }
    if(p==='/api/auth/logout'){logged=false;return json({});}
    if(p==='/api/auth/login')return json({detail:'Credenciais inválidas QA'},401);
    if(p==='/api/data/reports/report'&&req.method()==='DELETE'){
     if(situation.includes('falha'))return json({detail:'Não foi possível excluir QA'},503);
     state.reports=[];return route.fulfill({status:204});
    }
    if(p==='/api/data/reports'){state.reports.push({...req.postDataJSON(),id:'new-report'});return json({id:'new-report'},201);}
    if(p.endsWith('/review'))return json({detail:'A análise foi atualizada por outra sessão QA'},409);
    if(p.startsWith('/api/data/criteria/')){state.criteria[0].active=!state.criteria[0].active;return json({});}
    if(p==='/api/auth/profile')return json({detail:'Senha atual incorreta QA'},400);
    return json({detail:'Recusa simulada QA'},409);
   }
   const file=path.join(root,p==='/'?'index.html':p.slice(1));
   const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf'};
   return fs.existsSync(file)?route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'}):route.fulfill({status:404});
  });
  try{
   await page.goto('http://senx.test/#'+screen);
   await page.waitForFunction(()=>document.querySelector('#app')?.textContent.length>100);
   // Snapshot completa de forma assíncrona após a autenticação.
   if(logged)await page.waitForFunction(()=>!document.querySelector('#app')?.textContent.includes('Carregando dados'));
   await fn(page,state,writes);
   if(artifact && screen==='relatorios' && situation.startsWith('1.')){fs.mkdirSync(artifact,{recursive:true});await page.screenshot({path:path.join(artifact,'relatorios.png')});}
   assert.deepEqual(errors,[],'Sem exceções JavaScript');results.push({screen,situation,status:'PASS'});
  }catch(e){results.push({screen,situation,status:'FAIL',detail:e.message});}
  finally{await context.close();}
 }
 const screens=['ligacoes','clientes','resumos','relatorios','rankings','configuracoes','administracao/usuarios','administracao/clientes','administracao/departamentos','administracao/criterios'];
 const headings=['Análise de Ligações','Clientes','Resumos e Transcrições','Relatórios Gerenciais','Ranking de Qualidade','Configurações','Administração da Plataforma','Clientes','Administração da Plataforma','Administração da Plataforma'];
 for(let i=0;i<screens.length;i++){
  const screen=screens[i],heading=headings[i];
  await scenario(screen,'1. Supervisora consulta atendimento e cadastros existentes',async p=>{await p.getByRole('heading',{name:heading,exact:true}).waitFor();
   if(screen==='relatorios'){await p.locator('[data-action=view-report]').click();await p.getByText('Uma ligação; nota zero preservada.',{exact:true}).waitFor();}
   if(screen==='clientes'||screen==='administracao/clientes')assert.equal(await p.locator('[data-action=new-customer]').count(),1);
   if(screen==='resumos'){await p.locator('[data-tab=transcricao]').click();await p.getByText('Preciso conferir a cobrança.',{exact:true}).waitFor();}
   if(screen==='rankings')await p.getByRole('cell',{name:'Camila QA',exact:true}).waitFor();
  });
  await scenario(screen,'2. Primeiro uso sem cadastros e sem indicadores inventados',async p=>{await p.getByRole('heading',{name:heading,exact:true}).waitFor();assert.equal(await p.locator('[data-action=view-report],[data-action=select-call],[data-action=edit-customer],[data-action=edit-team],[data-action=edit-criterion]').count(),0);},'empty');
  await scenario(screen,'3. Banco indisponível comunica erro e não mostra dados antigos',async p=>{await p.getByText('Banco indisponível QA',{exact:false}).first().waitFor();assert.equal(await p.locator('[data-action=view-report],[data-action=select-call]').count(),0);},'offline');
  await scenario(screen,'4. Colaborador acessa somente controles permitidos',async p=>{await p.getByRole('heading',{name:screen.startsWith('administracao')&&screen!=='administracao/clientes'?'Administração':heading,exact:true}).waitFor();assert.equal(await p.locator('[data-action=new-report],[data-action=ranking-report],[data-action=delete-report],[data-action=new-customer],[data-action=review-call],[data-action=new-user],[data-action=new-team],[data-action=new-criterion]').count(),0);},'collaborator');
  await scenario(screen,'5. Consulta em celular e tablet',async p=>{
   await p.getByRole('heading',{name:heading,exact:true}).waitFor();
   for(const width of [320,390,600,768]){
    await p.setViewportSize({width,height:740});
    assert.equal(await p.getByRole('button',{name:'Menu principal'}).isVisible(),true);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Página sem transbordamento horizontal em '+width+' px');
   }
  },'mobile');
 }
 await scenario('ligacoes','Menu móvel permanece junto ao cabeçalho ao rolar',async p=>{
  const menu=p.getByRole('button',{name:'Menu principal'}), sidebar=p.locator('#main-sidebar'), header=p.locator('.mobile-bar');
  await p.locator('.mobile-brand img[alt=SENX]').waitFor();
  await p.waitForFunction(()=>document.querySelector('.mobile-brand img')?.naturalWidth>0);
  await p.evaluate(()=>scrollTo(0,350));
  await p.waitForFunction(()=>scrollY>100);
  await menu.click();
  await sidebar.waitFor();
  assert.equal(await menu.getAttribute('aria-expanded'),'true');
  for(const scroll of [350,500]){
   await p.evaluate(y=>scrollTo(0,y),scroll);
   const top=await header.boundingBox(), drawer=await sidebar.boundingBox();
   assert.ok(Math.abs(top.y)<1,'Cabeçalho fixo no topo');
   assert.ok(Math.abs(drawer.y-top.y-top.height)<1,'Menu começa exatamente abaixo do cabeçalho');
  }
  await p.keyboard.press('Escape');
  await sidebar.waitFor({state:'hidden'});
  assert.equal(await menu.getAttribute('aria-expanded'),'false');
  assert.ok(await menu.evaluate(el=>document.activeElement===el));
 },'mobile');
 await scenario('rankings','Ranking gera relatório com o recorte selecionado',async (p,_s,w)=>{
  await p.locator('[data-ranking=teamId]').selectOption('team');
  await p.locator('[data-ranking=period]').selectOption('Mês atual');
  await p.getByRole('button',{name:'Gerar relatório deste recorte'}).click();
  const period = p.locator('.panel-header [role=status]').filter({hasText:'Período QA (UTC)'});
  const context = p.locator('.ranking-report-context');
  const title = p.locator('#report-form #field-title');
  assert.ok((await period.boundingBox()).x > (await period.locator('xpath=../..').boundingBox()).x);
  assert.ok((await context.boundingBox()).y - ((await title.boundingBox()).y + (await title.boundingBox()).height) >= 10);
  assert.equal(await title.evaluate(el=>getComputedStyle(el).outlineOffset),'-2px');
  await p.locator('#report-form button[type=submit]').click();
  await p.getByRole('heading',{name:'Relatórios Gerenciais'}).waitFor();
  const saved=w.find(r=>r.p==='/api/data/reports').body();
  assert.equal(saved.teamId,'team');assert.equal(saved.period,'Mês atual');assert.equal(saved.includeRanking,true);
 });
 // Fluxos de maior risco: operações, cancelamento, preservação e falhas.
 const openReportDeletion=async p=>{await p.locator('[data-action=record-actions][data-id="reports:report"]').click();await p.locator('[data-action=delete-report]').click();};
 await scenario('relatorios','Excluir errado: cancelar não envia DELETE',async(p,s,w)=>{await openReportDeletion(p);await p.getByText('Somente este relatório será removido.',{exact:false}).waitFor();await p.locator('dialog [data-action=close]').first().click();assert.equal(w.length,0);assert.equal(s.reports.length,1);});
 await scenario('relatorios','Excluir errado: confirmar remove só relatório e atualiza lista',async(p,s)=>{await openReportDeletion(p);await p.locator('#delete-form [type=submit]').click();await p.waitForFunction(()=>window.SenxData.reports.length===0);assert.equal(s.calls.length,1);});
 await scenario('relatorios','Excluir errado: falha mantém modal e relatório para nova tentativa',async(p,s)=>{await openReportDeletion(p);await p.locator('#delete-form [type=submit]').click();await p.locator('#delete-form [role=alert]').filter({hasText:'Não foi possível excluir QA'}).waitFor();assert.equal(s.reports.length,1);assert.equal(await p.locator('#delete-form [type=submit]').isEnabled(),true);});
 await scenario('relatorios','Gerar relatório válido e consultar novamente',async p=>{await p.locator('[data-action=new-report]').click();await p.locator('#report-form [name=title]').fill('QA fechamento semanal');await p.locator('#report-form [type=submit]').click();await p.waitForFunction(()=>window.SenxData.reports.some(r=>r.id==='new-report'));});
 await scenario('relatorios','Baixar relatório existente',async p=>{const download=p.waitForEvent('download');await p.locator('[data-action=export-report]').click();assert.match((await download).suggestedFilename(),/SENX-Relatorio/);});
 await scenario('ligacoes','Upload: entrada, saída e telefone manual preservado',async p=>{await p.locator('[data-action=upload-audio]').click();assert.equal(await p.locator('.upload-new-customer').count(),0);const from=p.locator('[name=NumeroOrigem]'),to=p.locator('[name=NumeroDestino]');assert.equal(await from.inputValue(),'11999998888');await p.locator('[name=Direcao]').selectOption('Saída');assert.equal(await from.inputValue(),'');assert.equal(await to.inputValue(),'11999998888');await to.fill('1133334444');await p.locator('[name=Direcao]').selectOption('Entrada');assert.equal(await to.inputValue(),'1133334444');assert.equal(await from.inputValue(),'11999998888');});
 await scenario('ligacoes','Upload sem clientes: impede envio sem vínculo',async p=>{await p.locator('[data-action=upload-audio]').click();assert.equal(await p.locator('[name=IdCliente]').inputValue(),'');assert.equal(await p.locator('[name=IdCliente]').evaluate(el=>el.checkValidity()),false);},'empty');
 await scenario('ligacoes','Upload sem arquivo: validação impede requisição',async(p,s,w)=>{await p.locator('[data-action=upload-audio]').click();await p.locator('[name=NumeroDestino]').fill('1133334444');await p.locator('.upload-form [type=submit]').click();assert.equal(w.length,0);});
 await scenario('ligacoes','Upload de arquivo errado: extensão recusada',async(p,s,w)=>{await p.locator('[data-action=upload-audio]').click();await p.locator('[name=NumeroDestino]').fill('1133334444');await p.locator('[name=audio]').setInputFiles({name:'errado.txt',mimeType:'text/plain',buffer:Buffer.from('teste QA')});await p.locator('.upload-form [type=submit]').click();await p.locator('.upload-form [role=alert]').filter({hasText:'Selecione um áudio permitido'}).waitFor();assert.equal(w.length,0);});
 await scenario('ligacoes','Upload cancelado: fecha sem enviar arquivo',async(p,s,w)=>{await p.locator('[data-action=upload-audio]').click();await p.locator('.upload-close').click();await p.locator('.upload-form').waitFor({state:'detached'});assert.equal(await p.locator('.upload-form').count(),0);assert.equal(w.length,0);});
 for (const fails of [false,true]) await scenario('ligacoes',fails?'Upload com falha mantém o formulário':'Upload concluído fecha o formulário e atualiza a lista',async p=>{
  await p.locator('[data-action=upload-audio]').click();
  await p.locator('[name=NumeroDestino]').fill('1133334444');
  await p.locator('[name=audio]').setInputFiles({name:'qa.wav',mimeType:'audio/wav',buffer:Buffer.from('áudio de teste de interface')});
  await p.locator('.upload-form [type=submit]').click();
  if(fails){
   await p.locator('.upload-form [role=alert]').filter({hasText:'Falha de análise QA'}).waitFor();
   assert.equal(await p.locator('[name=NumeroDestino]').inputValue(),'1133334444');
   assert.equal(await p.locator('.upload-form [type=submit]').isEnabled(),true);
  }else{
   await p.locator('.upload-form').waitFor({state:'detached'});
   await p.locator('#toast.visible').filter({hasText:'Análise concluída.'}).waitFor();
   await p.getByText('Gravação nova QA',{exact:true}).waitFor();
  }
 });
 await scenario('resumos','Revisão concorrente não sobrescreve análise',async p=>{await p.locator('[data-action=review-call]').click();await p.locator('#review-call-form [name=summary]').fill('Revisão QA');await p.locator('#review-call-form [type=submit]').click();await p.locator('#review-call-form [role=alert]').filter({hasText:'outra sessão'}).waitFor();});
 await scenario('administracao/criterios','Desativar critério e reler estado',async(p,s)=>{await p.locator('[data-action=toggle-criterion]').click();await p.waitForFunction(()=>window.SenxData.criteria[0].active===false);assert.equal(s.criteria[0].active,false);});
 await scenario('configuracoes','Senha atual incorreta não altera perfil',async p=>{await p.locator('[name=currentPassword]').fill('QA-senha-incorreta');await p.locator('#profile-form [type=submit]').click();await p.locator('#profile-form [role=alert]').filter({hasText:'Senha atual incorreta'}).waitFor();});
 for(const n of [1,2,3,4,5])await scenario('login',`Login ${n}: `+['campos obrigatórios','mostrar/ocultar senha','orientação de recuperação','credenciais inválidas','sem cadastro público'][n-1],async(p,s,w)=>{
  await p.locator('#auth-form').waitFor();
  if(n===1){await p.locator('#auth-form [type=submit]').click();assert.equal(w.length,0);}
  if(n===2){await p.locator('[data-action=toggle-password]').click();assert.equal(await p.locator('[name=password]').getAttribute('type'),'text');}
  if(n===3){await p.locator('[data-action=forgot]').click();await p.getByRole('heading',{name:'Recuperar Senha'}).waitFor();}
  if(n===4){await p.locator('[name=email]').fill('qa@example.invalid');await p.locator('[name=password]').fill('QA-incorreta');await p.locator('#auth-form [type=submit]').click();await p.locator('#auth-form [role=alert]').filter({hasText:'Credenciais inválidas'}).waitFor();}
  if(n===5)assert.equal(await p.locator('a[href="#cadastro"]').count(),0);
 },'login');
 for(const n of [1,2,3,4,5])await scenario('cadastro',`Primeiro administrador ${n}: `+['equipe obrigatória','senha mínima','confirmação divergente','documentos pendentes','sem equipe preexistente'][n-1],async(p,s,w)=>{
  await p.locator('#auth-form').waitFor();
  if(n===1)assert.equal(await p.locator('[name=teamName]').getAttribute('required'),'');
  if(n===2)assert.equal(await p.locator('[name=password]').getAttribute('minlength'),'12');
  if(n===3){for(const [name,value]of Object.entries({name:'QA',email:'qa@example.invalid',password:'SenhaQA123456!',confirm:'OutraQA123456!',teamName:'Suporte',department:'QA'}))await p.locator(`[name=${name}]`).fill(value);await p.locator('#auth-form [type=submit]').click();await p.locator('#auth-form [role=alert]').filter({hasText:'não coincidem'}).waitFor();assert.equal(w.length,0);}
  if(n===4)assert.equal(await p.locator('.consent input').isDisabled(),true);
  if(n===5)assert.equal(await p.locator('[name=department]').count(),1);
 },'setup');
 for(const n of [1,2,3,4,5])await scenario('saida',`Saída ${n}: `+['confirmação explícita','cancelar preserva sessão','sair retorna ao login','sem logout ao abrir','teclado alcança ação'][n-1],async(p,s,w)=>{
  await p.getByRole('heading',{name:'Realmente deseja sair?'}).waitFor();
  if(n===1)assert.equal(await p.locator('[data-action=logout]').count(),1);
  if(n===2){await p.getByText('CANCELAR',{exact:true}).click();await p.getByRole('heading',{name:'Análise de Ligações'}).waitFor();assert.equal(w.length,0);}
  if(n===3){await p.locator('[data-action=logout]').click();await p.locator('#auth-form').waitFor();}
  if(n===4)assert.equal(w.length,0);
  if(n===5){await p.locator('[data-action=logout]').focus();assert.equal(await p.locator('[data-action=logout]').evaluate(el=>el===document.activeElement),true);}
 });
 for(const mode of ['default','mobile'])await scenario('saida','Cartão compacto e paleta SENX — '+mode,async p=>{
  const card=p.locator('.exit-card'), button=card.getByRole('button',{name:'SAIR',exact:true});
  await card.waitFor();
  assert.equal(await card.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await button.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(23, 105, 255)');
  assert.ok((await card.boundingBox()).height<460);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 },mode);
 await browser.close();
 if(artifact){fs.mkdirSync(artifact,{recursive:true});fs.writeFileSync(path.join(artifact,'cenarios.json'),JSON.stringify(results,null,2));}
 for(const r of results)console.log(`${r.status}: ${r.screen} — ${r.situation}${r.detail?' — '+r.detail:''}`);
 console.log(`TOTAL ${results.length}: ${results.filter(r=>r.status==='PASS').length} PASS, ${results.filter(r=>r.status==='FAIL').length} FAIL`);
 process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
