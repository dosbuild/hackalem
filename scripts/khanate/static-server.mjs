/** Deliberately plain hosting: no API, no Content-Encoding, two mount paths. */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(process.env.STATIC_DIR||'dist-static'),port=Number(process.env.PORT||4198);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.gz':'application/gzip','.bin':'application/octet-stream'};
createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/khanate-preview(?=\/)/,'');
  const file=resolve(root,`.${path.endsWith('/')?path+'index.html':path}`);
  if(!file.startsWith(root+sep)||!(await stat(file)).isFile())throw Error('missing');
  res.writeHead(200,{'Content-Type':types[extname(file)]||'text/plain; charset=utf-8','Cache-Control':'public, max-age=60'});res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Static core: http://127.0.0.1:${port}/ and /khanate-preview/`));
