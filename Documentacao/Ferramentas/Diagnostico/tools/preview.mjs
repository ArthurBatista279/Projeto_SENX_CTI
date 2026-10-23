import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const diagnostic=path.join(root,'Documentacao','Ferramentas','Diagnostico');
const web=path.join(root,process.argv.includes('--portable')?'FrontEnd':'Aplicacao/SenxCti.Web/wwwroot');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/gerenciador'){res.writeHead(302,{Location:'/gerenciador/'});res.end();return;}
    if(pathname.startsWith('/api/')){
      if(!['GET','POST'].includes(req.method)){res.writeHead(405);res.end();return;}
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>500000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      try {
        const upstream=await fetch('http://127.0.0.1:5080'+pathname,{method:req.method,headers:{'Content-Type':'application/json'},body:req.method==='POST'?Buffer.concat(chunks):undefined,signal:AbortSignal.timeout(25000)});
        res.writeHead(upstream.status,{'Content-Type':'application/json'});res.end(Buffer.from(await upstream.arrayBuffer()));
      }catch{res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'API local indisponível. Inicie o back-end na porta 5080.'}));}
      return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const isManager=pathname==='/gerenciador'||pathname.startsWith('/gerenciador/');
    const base=isManager?diagnostic:web;
    let relative=isManager?pathname.replace(/^\/gerenciador\/?/,''):pathname.replace(/^\//,'');
    // Os logotipos referenciam a fonte principal também quando a página é aberta por seu caminho físico.
    if(pathname.startsWith('/Aplicacao/SenxCti.Web/wwwroot/')) relative=pathname.slice('/Aplicacao/SenxCti.Web/wwwroot/'.length);
    if(isManager && relative.startsWith('tools/')){res.writeHead(404);res.end();return;}
    const target=path.resolve(base,relative||'index.html');
    if(!target.startsWith(path.resolve(base)+path.sep)){res.writeHead(403);res.end();return;}
    if(!(await stat(target)).isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:await readFile(target));
  }catch{res.writeHead(404);res.end('Arquivo não encontrado.');}
});
server.listen(Number(process.env.SENX_PREVIEW_PORT||4173),'127.0.0.1',()=>console.log('SENX: http://localhost:'+(process.env.SENX_PREVIEW_PORT||4173)+(process.argv.includes('--manager')?'/gerenciador/':'/')));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
