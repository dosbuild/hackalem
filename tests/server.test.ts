import {describe,it,expect,vi} from 'vitest';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {createServer} from '../server/http';
import {calculateRequest,createExplanationService,explanationStatements} from '../server/explanation';
import {SCENARIO_VERSION} from '../src/domain/scenario';
import {fixture} from './fixtures';

const input={modelVersion:SCENARIO_VERSION,plan:fixture};
const result=calculateRequest(input);
const answer=(ids=explanationStatements(result).map(s=>s.id))=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({statementIds:ids})}]}]});

describe('production explanation boundary',()=>{
  it('recalculates canonical inputs and rejects smuggled scores, incomplete plans and stale versions',()=>{
    expect(result.summary.count).toBe(5);
    for(const value of [{...input,score:100},{...input,modelVersion:'old'},{...input,plan:fixture.slice(1)}])expect(()=>calculateRequest(value)).toThrow();
  });
  it('bounds usage, shares order-independent cache and never asks the provider to calculate',async()=>{
    const provider=vi.fn(async(_url:unknown,options?:RequestInit)=>{
      const body=JSON.parse(options!.body as string);
      expect(body.store).toBe(false);expect(body.text.format.strict).toBe(true);
      expect(body.input).not.toContain('apiKey');return answer();
    });
    const service=createExplanationService({apiKey:'test',fetchImpl:provider as typeof fetch,maxCalls:1});
    const reply=await service(input);
    expect(reply).toHaveProperty('statementIds');
    expect(await service({...input,plan:[...fixture].reverse()})).toEqual(reply);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(await service({...input,plan:fixture.map(d=>d.scope==='district'?{...d,districtId:'almaty'}:d)})).toHaveProperty('reason','limited');
  });
  it('retains factual fallback for missing keys, provider failures, unsupported claims and timeout',async()=>{
    expect(await createExplanationService({apiKey:''})(input)).toHaveProperty('mode','local');
    const providers=[async()=>{throw new Error('network');},async()=>answer(['invented']),async()=>new Promise<Response>(()=>{})];
    for(const provider of providers)expect(await createExplanationService({apiKey:'test',fetchImpl:provider,timeoutMs:5})(input)).toHaveProperty('mode','local');
  });
});

describe('production HTTP surface',()=>{
  it('caches content-addressed assets for both worlds while revalidating mutable descriptors',async()=>{
    const root=await mkdtemp(path.join(tmpdir(),'alem-map-cache-'));
    const names=['index.html','khanate/map-0123456789abcdef0123.bin','alem/facade-groups-0123456789abcdef0123.json','khanate/geometry.json'];
    for(const name of names){await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),'{}');}
    await writeFile(path.join(root,'asset-manifest.json'),JSON.stringify(Object.fromEntries(names.map(name=>[name,{bytes:2,sha256:'fixture'}]))));
    const server=await createServer({root,explain:createExplanationService({apiKey:''})});server.listen(0,'127.0.0.1');await once(server,'listening');
    const address=server.address();if(typeof address!=='object'||!address)throw Error('address');
    try{
      for(const name of names){const response=await fetch(`http://127.0.0.1:${address.port}/${name}`);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe(name.includes('012345')?'public, max-age=31536000, immutable':'no-cache');}
    }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
  });
  it('refuses a release whose raw façade identity differs from its asset manifest',async()=>{
    const root=await mkdtemp(path.join(tmpdir(),'alem-facade-release-')),raw=Buffer.alloc(64),sha256=createHash('sha256').update(raw).digest('hex'),url=`alem/facades-${sha256.slice(0,20)}.bin`;
    try{
      await mkdir(path.join(root,'alem'));await writeFile(path.join(root,'index.html'),'ready');await writeFile(path.join(root,url),raw);
      const map={url,sha256,bytes:raw.length,tiles:[],architecture:{asset:{url,sha256,bytes:raw.length,gzip:true}}};
      const metadata=JSON.stringify(map);await writeFile(path.join(root,'alem/geometry-low.json'),metadata);
      await writeFile(path.join(root,'asset-manifest.json'),JSON.stringify({'alem/geometry-low.json':{bytes:Buffer.byteLength(metadata),sha256:'metadata'},[url]:{bytes:raw.length,sha256:'different'}}));
      await expect(createServer({root,explain:createExplanationService({apiKey:''})})).rejects.toThrow('Map build');
      // The base map is independent; a matching base descriptor must still fail
      // if the required architecture's manifest identity is stale.
      map.url='index.html';map.sha256='entry';map.bytes=5;
      const changed=JSON.stringify(map);await writeFile(path.join(root,'alem/geometry-low.json'),changed);
      await writeFile(path.join(root,'asset-manifest.json'),JSON.stringify({'index.html':{bytes:5,sha256:'entry'},'alem/geometry-low.json':{bytes:Buffer.byteLength(changed),sha256:'metadata'},[url]:{bytes:raw.length,sha256:'different'}}));
      await expect(createServer({root,explain:createExplanationService({apiKey:''})})).rejects.toThrow('Façade build');
    }finally{await rm(root,{recursive:true,force:true});}
  });
  it('refuses to become ready when a listed runtime asset is missing',async()=>{
    const root=await mkdtemp(path.join(tmpdir(),'alem-incomplete-'));
    try{
      await writeFile(path.join(root,'index.html'),'ready');
      await writeFile(path.join(root,'asset-manifest.json'),JSON.stringify({'alem/map-missing.bin':{sha256:'missing',bytes:60}}));
      await expect(createServer({root,explain:createExplanationService({apiKey:''})})).rejects.toThrow();
    }finally{await rm(root,{recursive:true,force:true});}
  });
  it('serves only manifest files; rejects traversal, secrets, bad origins and malformed bodies',async()=>{
    const root=await mkdtemp(path.join(tmpdir(),'alem-server-'));const html='<h1>Әлем</h1>',compressed=gzipSync(html),brotli=brotliCompressSync(html);
    await writeFile(path.join(root,'index.html'),html);await writeFile(path.join(root,'index.html.gz'),compressed);
    await writeFile(path.join(root,'index.html.br'),brotli);
    const facade=Buffer.from(new Float32Array(16).fill(.00008).buffer),facadeHash=createHash('sha256').update(facade).digest('hex'),facadeName=`alem/facades-${facadeHash.slice(0,20)}.bin`,facadeGzip=gzipSync(facade);
    await mkdir(path.join(root,'alem'));await writeFile(path.join(root,facadeName),facade);await writeFile(path.join(root,facadeName+'.gz'),facadeGzip);
    await writeFile(path.join(root,'.env'),'PRIVATE');await writeFile(path.join(root,'asset-manifest.json'),JSON.stringify({'index.html':{sha256:'test',bytes:Buffer.byteLength(html),gzipBytes:compressed.length,brotliBytes:brotli.length},[facadeName]:{sha256:facadeHash,bytes:facade.length,gzipBytes:facadeGzip.length}}));
    const server=await createServer({root,explain:createExplanationService({apiKey:''})});server.listen(0,'127.0.0.1');await once(server,'listening');
    const address=server.address();if(typeof address!=='object'||!address)throw Error('address');const url=`http://127.0.0.1:${address.port}`;
    try {
      const page=await fetch(url);expect(page.status).toBe(200);expect(await page.text()).toBe(html);expect(page.headers.get('content-security-policy')).toContain("connect-src 'self'");
      expect((await fetch(url,{headers:{'If-None-Match':page.headers.get('etag')!}})).status).toBe(304);
      const raw=await fetch(url+'/'+facadeName,{headers:{'Accept-Encoding':'gzip'}});
      expect(raw.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');expect(raw.headers.get('content-encoding')).toBe('gzip');
      expect(Buffer.from(await raw.arrayBuffer())).toEqual(facade);expect((await fetch(url+'/'+facadeName,{headers:{'If-None-Match':raw.headers.get('etag')!,'Accept-Encoding':'gzip'}})).status).toBe(304);
      const facadeHead=await fetch(url+'/'+facadeName,{method:'HEAD',headers:{'Accept-Encoding':'identity'}});expect(Number(facadeHead.headers.get('content-length'))).toBe(facade.length);expect(await facadeHead.text()).toBe('');
      for(const [accept,expected] of [['br, gzip','br'],['br;q=0, gzip','gzip'],['br;q=0.4, gzip;q=0.8','gzip'],['br;q=0, gzip;q=0',null]] as const){
        const response=await fetch(url,{headers:{'Accept-Encoding':accept}});expect(response.headers.get('Content-Encoding')).toBe(expected);expect(await response.text()).toBe(html);
      }
      for(const pathname of ['/.env','/%2eenv','/src/main.tsx','/absent.js','/index.html.gz','/index.html.br','/asset-manifest.json'])expect((await fetch(url+pathname)).status).toBe(404);
      expect((await fetch(url+'/healthz')).status).toBe(200);
      expect(await (await fetch(url+'/healthz',{method:'HEAD'})).text()).toBe('');
      expect((await fetch(url+'/api/missing')).status).toBe(404);
      const post=(body:unknown,headers:Record<string,string>={})=>fetch(url+'/api/explanation',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
      expect((await post(input,{Origin:'https://other.example'})).status).toBe(403);
      expect((await post(input,{Origin:'null'})).status).toBe(403);
      expect((await post(input,{'Sec-Fetch-Site':'cross-site'})).status).toBe(403);
      expect((await post({...input,plan:[]})).status).toBe(400);
      expect((await post({text:'x'.repeat(5000)})).status).toBe(413);
      expect(await (await post(input)).json()).toHaveProperty('mode','local');
    } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
  });
});
