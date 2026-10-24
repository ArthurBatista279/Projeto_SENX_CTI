import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const diagnostic=path.join(root,'Documentacao/Ferramentas/Diagnostico');
const web=path.join(root,'Aplicacao/SenxCti.Web/wwwroot');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf'};
export function createServer({manager=false,api='http://127.0.0.1:5080'}={}) {
  return http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost'), pathname=decodeURIComponent(url.pathname);
      if(pathname.startsWith('/api/')){
        if(!['GET','POST','PUT'].includes(req.method)){res.writeHead(405);res.end();return;}
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>500000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
        try {
          const upstream=await fetch(api+url.pathname+url.search,{method:req.method,headers:{'Content-Type':'application/json',...(req.headers.cookie?{Cookie:req.headers.cookie}:{}),...(req.headers['x-csrf-token']?{'X-CSRF-Token':req.headers['x-csrf-token']}:{})},body:['POST','PUT'].includes(req.method)?Buffer.concat(chunks):undefined,signal:AbortSignal.timeout(15000)});
          const cookies=upstream.headers.getSetCookie();
          res.writeHead(upstream.status,{'Content-Type':'application/json','Cache-Control':'no-store',...(cookies.length?{'Set-Cookie':cookies}:{})});res.end(Buffer.from(await upstream.arrayBuffer()));
        }catch{res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({detail:'API local indisponível. Inicie o back-end na porta 5080.'}));}
        return;
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const base=manager?diagnostic:web;
      const relative=pathname==='/'?'index.html':pathname.slice(1);
      // O diagnóstico publica somente sua tela; scripts internos não são arquivos públicos.
      const shared=manager && relative==='session.js';
      const asset=manager && /^assets\/(senx-symbol|senx-wordmark)\.png$/.test(relative);
      if(manager && !asset && !shared && !['index.html','app.js','styles.css'].includes(relative)){res.writeHead(404);res.end();return;}
      const directory=(asset||shared)?web:base, target=path.resolve(directory,relative);
      if(!target.startsWith(path.resolve(directory)+path.sep) || !types[path.extname(target)]){res.writeHead(404);res.end();return;}
      if(!(await stat(target)).isFile()){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':types[path.extname(target)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:await readFile(target));
    }catch{res.writeHead(404);res.end('Arquivo não encontrado.');}
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const manager=process.argv.includes('--manager');
  const port=Number(process.env.SENX_PREVIEW_PORT||(manager?4174:4173));
  const server=createServer({manager});
  server.listen(port,'127.0.0.1',()=>console.log((manager?'Diagnóstico SENX':'SENX')+': http://localhost:'+port+'/'));
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
}
