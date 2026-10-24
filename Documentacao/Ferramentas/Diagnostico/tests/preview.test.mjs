import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import http from 'node:http';
import {createServer} from '../tools/preview.mjs';

async function serve(t, options) {
  const server=createServer(options);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return 'http://127.0.0.1:'+server.address().port;
}
test('diagnóstico independente publica só a tela e os logotipos',async t=>{
  const base=await serve(t,{manager:true});
  const page=await fetch(base+'/');
  assert.equal(page.status,200);
  assert.match(await page.text(),/Esquema e permissões/);
  for(const file of ['/app.js','/styles.css','/session.js','/assets/senx-symbol.png']) assert.equal((await fetch(base+file)).status,200);
  for(const file of ['/gerenciador/','/tools/preview.mjs','/tests/preview.test.mjs','/package.json','/appsettings.Local.json']) assert.equal((await fetch(base+file)).status,404);
});
test('interface principal não publica o diagnóstico',async t=>{
  const base=await serve(t,{manager:false});
  assert.match(await (await fetch(base+'/')).text(),/SENX — Plataforma CTI/);
  assert.equal((await fetch(base+'/gerenciador/')).status,404);
});
test('proxy informa API indisponível sem inventar um sucesso',async t=>{
  const base=await serve(t,{manager:true,api:'http://127.0.0.1:1'});
  const response=await fetch(base+'/api/database/health');
  assert.equal(response.status,502);
  assert.match((await response.json()).detail,/API local indisponível/);
});
test('proxy preserva cookies e token CSRF entre diagnóstico e API',async t=>{
  const upstream=http.createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':['SENX.Session=test; HttpOnly; SameSite=Strict','SENX.Csrf=test; HttpOnly']});
    res.end(JSON.stringify({cookie:req.headers.cookie,csrf:req.headers['x-csrf-token']}));
  });
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  t.after(()=>new Promise(resolve=>upstream.close(resolve)));
  const base=await serve(t,{manager:true,api:'http://127.0.0.1:'+upstream.address().port});
  const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{Cookie:'SENX.Csrf=example','X-CSRF-Token':'example-token'},body:'{}'});
  assert.deepEqual(await response.json(),{cookie:'SENX.Csrf=example',csrf:'example-token'});
  assert.equal(response.headers.getSetCookie().length,2);
});
