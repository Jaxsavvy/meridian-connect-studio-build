// Loopback-only development preview. Explicit allowlist excludes configuration and repository data.
const http=require('node:http'); const fs=require('node:fs'); const path=require('node:path');
const repo=path.resolve(__dirname,'../../../..');
const files=new Map([['/','docs/studio/assets/8/demo.html'],['/docs/studio/assets/8/demo.html','docs/studio/assets/8/demo.html'],...['model.js','synthetic-service.js','controller.js','view.js','view.css'].map(name=>['/src/renderer/studio-assets/'+name,'src/renderer/studio-assets/'+name])]);
http.createServer((req,res)=>{const target=files.get(req.url);if(req.method!=='GET'||!target){res.writeHead(404);res.end();return;}
  const file=path.join(repo,target);res.setHeader('Content-Type',target.endsWith('.html')?'text/html; charset=utf-8':target.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).on('error',()=>{res.destroy();}).pipe(res);
}).listen(8768,'127.0.0.1',()=>process.stdout.write('Synthetic preview http://127.0.0.1:8768/docs/studio/assets/8/demo.html\n'));
