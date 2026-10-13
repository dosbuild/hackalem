import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApiHandler} from './api';
import type {ApiOptions} from './api';

const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.geojson':'application/geo+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.bin':'application/octet-stream','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.gz':'application/gzip'};
const rootDefault=fileURLToPath(new URL('../dist/',import.meta.url));
export async function createServer({root=rootDefault,...options}:{root?:string}&ApiOptions={}) {
  const api=createApiHandler(options);
  const rootPath=await realpath(root);
  await stat(path.join(rootPath,'index.html'));
  const manifest=JSON.parse(await readFile(path.join(rootPath,'asset-manifest.json'),'utf8')) as Record<string,{sha256:string;bytes:number;gzipBytes?:number;brotliBytes?:number}>;
  // Refuse readiness for an incomplete release instead of accepting visitors into a broken map.
  await Promise.all(Object.entries(manifest).map(async([name,asset])=>{
    if(name.split('/').some(part=>!part||part.startsWith('.')))throw new Error('Invalid runtime manifest path');
    const file=await realpath(path.join(rootPath,name));
    if(!file.startsWith(rootPath+path.sep)||(await stat(file)).size!==asset.bytes)throw new Error(`Incomplete runtime asset: ${name}`);
    for(const [suffix,size] of [['.br',asset.brotliBytes],['.gz',asset.gzipBytes]] as const)if(size!==undefined&&(await stat(file+suffix)).size!==size)throw new Error(`Incomplete compressed asset: ${name}${suffix}`);
  }));
  if(manifest['alem/geometry-low.json']){
    const map=JSON.parse(await readFile(path.join(rootPath,'alem/geometry-low.json'),'utf8'));
    for(const asset of [map,...map.tiles]){
      if(!asset.transport&&(manifest[asset.url]?.sha256!==asset.sha256||manifest[asset.url]?.bytes!==asset.bytes))throw new Error('Map build and runtime manifest do not match');
      if(asset.transport){const wire=manifest[`alem/${asset.transport.file}`];if(wire?.sha256!==asset.transport.sha256||wire?.bytes!==asset.transport.bytes)throw new Error('Map transport and runtime manifest do not match');}
    }
    const facade=map.architecture?.asset;
    if(!facade||!/^alem\/facades-[a-f0-9]{20}\.bin$/.test(facade.url)||!/^[a-f0-9]{64}$/.test(facade.sha256)||facade.url!==`alem/facades-${facade.sha256.slice(0,20)}.bin`||!Number.isSafeInteger(facade.bytes)||facade.bytes<=0||facade.bytes%32||facade.transport||facade.gzip!==true)throw new Error('Invalid raw façade descriptor');
    if(manifest[facade.url]?.sha256!==facade.sha256||manifest[facade.url]?.bytes!==facade.bytes)throw new Error('Façade build and runtime manifest do not match');
  }
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    const json=(status:number,body:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    try {
      const url=new URL(req.url||'/', 'http://localhost');
      if(await api(req,res))return;
      if(!['GET','HEAD'].includes(req.method||'')) {json(405,{error:'method'});return;}
      const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname).slice(1);
      if(relative.split('/').some(segment=>segment.startsWith('.')||!segment)||!manifest[relative]) {json(404,{error:'not_found'});return;}
      const file=await realpath(path.join(rootPath,relative));
      if(!file.startsWith(rootPath+path.sep)){json(404,{error:'not_found'});return;}
      const asset=manifest[relative]!;
      const accepted=new Map((req.headers['accept-encoding']||'').split(',').map(item=>{const [name,...parameters]=item.trim().toLowerCase().split(';');const q=parameters.map(p=>p.trim()).find(p=>p.startsWith('q='));return [name,q?Number(q.slice(2)):1] as const;}));
      const quality=(name:string)=>accepted.get(name)??accepted.get('*')??0;
      const encoding=asset.brotliBytes&&quality('br')>0&&quality('br')>=quality('gzip')?'br':asset.gzipBytes&&quality('gzip')>0?'gzip':null;
      const etag=`"${asset.sha256}${encoding?'-'+encoding:''}"`;
      res.setHeader('ETag',etag);res.setHeader('Vary','Accept-Encoding');
      res.setHeader('Cache-Control',relative.startsWith('assets/')||/^alem\/(?:map|facades)-[a-f0-9]{20}\.bin$/.test(relative)?'public, max-age=31536000, immutable':'no-cache');
      if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
      res.setHeader('Content-Type',mime[path.extname(relative)]||'application/octet-stream');
      res.setHeader('Content-Length',encoding==='br'?asset.brotliBytes!:encoding==='gzip'?asset.gzipBytes!:asset.bytes);
      if(encoding)res.setHeader('Content-Encoding',encoding);
      res.writeHead(200);
      if(req.method==='HEAD'){res.end();return;}
      const stream=createReadStream(file+(encoding==='br'?'.br':encoding==='gzip'?'.gz':''));
      res.on('close',()=>stream.destroy()); // Cancelled world preparation must release its file descriptors too.
      stream.on('error',()=>res.destroy());stream.pipe(res);
    } catch {if(!res.headersSent)json(400,{error:'invalid_request'});else res.destroy();}
  });
}
