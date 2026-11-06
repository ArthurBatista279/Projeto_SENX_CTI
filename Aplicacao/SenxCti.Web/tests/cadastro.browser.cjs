const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../wwwroot');
 const admin={id:'admin',name:'Administrador QA',email:'qa@example.invalid',profile:'Administrador',job:'QA',team:'QA'};
 const state={source:'postgresql',version:'1.0.0.0',calls:[],reports:[],rankings:[],criteria:[],counts:{},fetchedAt:new Date().toISOString(),teams:[{id:'team',name:'QA',department:'QA',members:2}],users:[{...admin,active:true},{id:'inactive',name:'Inativo QA',role:'QA',profile:'Colaborador',team:'QA',active:false}],customers:[{id:'linked',name:'Cliente com histórico QA',email:'c@example.invalid',phone:'11999999999',status:'Inativo',consent:true,calls:1,userId:'admin',agent:'QA'}]};
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 let deletes=0; const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://senx.test/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/auth/status')return json({setupRequired:false});
  if(p==='/api/auth/session')return json(admin);
  if(p==='/api/auth/csrf')return json({token:'qa'});
  if(p==='/api/data/snapshot')return json(state);
  if(req.method()==='DELETE'){
   deletes++;
   if(p.endsWith('/linked'))return json({detail:'Este cadastro possui vínculos com o histórico.'},409);
   state.users=state.users.filter(x=>!p.endsWith('/'+x.id));
   return route.fulfill({status:204});
  }
  if(p==='/api/data/customers' && req.method()==='POST'){
   const body=req.postDataJSON(); assert.equal(body.consent,false,'Cliente novo não presume autorização');
   state.customers.push({...body,id:'new',calls:0});return json({id:'new'},201);
  }
  const file=path.join(root,p==='/'?'index.html':p.slice(1));
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf'}[path.extname(file)] || 'application/octet-stream';
  return fs.existsSync(file)?route.fulfill({body:fs.readFileSync(file),contentType:mime}):route.fulfill({status:404});
 });
 try{
  await page.goto('http://senx.test/#clientes');
  await page.locator('[data-action=new-customer]').first().click();
  const toggle=page.locator('#customer-form [name=consent]');
  assert.equal(await toggle.isChecked(),false);
  const off=await toggle.evaluate(el=>({bg:getComputedStyle(el).backgroundColor,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
  assert.equal(off.width,28);assert.equal(off.height,16);assert.notEqual(off.bg,'rgb(255, 255, 255)');
  await toggle.check(); const on=await toggle.evaluate(el=>getComputedStyle(el).backgroundColor);assert.notEqual(on,off.bg);
  await toggle.uncheck(); assert.equal(await toggle.evaluate(el=>getComputedStyle(el).backgroundColor),off.bg);
  await toggle.focus(); await page.keyboard.press('Space');assert.equal(await toggle.isChecked(),true);
  await page.keyboard.press('Space');assert.equal(await toggle.isChecked(),false);
  if(process.env.SENX_QA_ARTIFACTS){fs.mkdirSync(process.env.SENX_QA_ARTIFACTS,{recursive:true});await page.screenshot({path:path.join(process.env.SENX_QA_ARTIFACTS,'consentimento-desmarcado.png')});}
  await page.locator('#customer-form [name=name]').fill('Cliente QA');
  await page.locator('#customer-form [name=email]').fill('novo@example.invalid');
  await page.locator('#customer-form [name=phone]').fill('11999999999');
  await page.locator('#customer-form [type=submit]').click();
  await page.waitForFunction(()=>window.SenxData.customers.some(x=>x.id==='new'));
  assert.equal(await page.locator('[data-action=delete-customer][data-id=new]').count(),0);
  await page.locator('[data-action=delete-customer][data-id=linked]').click();
  await page.locator('#delete-form [type=submit]').click();
  await page.locator('#delete-form [role=alert]').filter({hasText:'histórico'}).waitFor();
  assert.equal(state.customers.some(x=>x.id==='linked'),true);
  await page.locator('dialog [data-action=close]').first().click();
  await page.goto('http://senx.test/#administracao');
  assert.equal(await page.locator('[data-action=delete-user][data-id=admin]').count(),0);
  await page.locator('[data-action=delete-user][data-id=inactive]').click();
  const before=deletes; await page.locator('dialog [data-action=close]').first().click();assert.equal(deletes,before);
  await page.locator('[data-action=delete-user][data-id=inactive]').click();
  await page.locator('#delete-form [type=submit]').click();
  await page.waitForFunction(()=>!window.SenxData.users.some(x=>x.id==='inactive'));
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://senx.test/#clientes');
  await page.locator('[data-action=new-customer]').first().click();
  assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'Modal móvel sem overflow');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Página móvel sem overflow');
  assert.equal(await page.locator('#customer-form [name=consent]').isChecked(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: consentimento visível nos dois estados, teclado, padrão false, salvar, confirmação/cancelamento, exclusão e bloqueio de vínculo. API simulada; nenhuma conta real excluída pelo navegador.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
