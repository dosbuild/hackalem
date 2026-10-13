import { describe,it,expect,vi } from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {DashboardStore,dashboardDirectory} from '../../server/dashboard/store';
import {createDashboardHandler} from '../../server/dashboard';
import {createAnalysisService} from '../../server/dashboard/analysis';
import {reviewPlan} from '../../server/dashboard/review';
import {fixture} from '../fixtures';

describe('durable dashboard API',()=>{
 it('requires Railway storage to stay on an existing persistent mount',()=>{
  const mount=mkdtempSync(path.join(tmpdir(),'alem-volume-'));
  try{
   const env={RAILWAY_ENVIRONMENT_ID:'production',RAILWAY_VOLUME_MOUNT_PATH:mount};
   expect(()=>dashboardDirectory({RAILWAY_ENVIRONMENT_ID:'production'})).toThrow('persistent volume');
   expect(dashboardDirectory(env)).toBe(path.join(mount,'alem'));
   expect(dashboardDirectory({...env,ALEM_DATA_DIR:path.join(mount,'registry')})).toBe(path.join(mount,'registry'));
   expect(()=>dashboardDirectory({...env,ALEM_DATA_DIR:mount+'-outside'})).toThrow('inside the Railway volume');
   expect(()=>dashboardDirectory({...env,RAILWAY_VOLUME_MOUNT_PATH:path.join(mount,'absent')})).toThrow();
  }finally{rmSync(mount,{recursive:true,force:true});}
 });
 it('deduplicates explicit submission, restores council/registry across a new server, and protects API inputs',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'alem-dashboard-'));
  let server:http.Server|null=null;
  async function start(){const handler=createDashboardHandler({directory,analysis:createAnalysisService({apiKey:''})});server=http.createServer((req,res)=>{void handler(req,res).then(handled=>{if(!handled){res.writeHead(404);res.end();}});});server.listen(0,'127.0.0.1');await once(server,'listening');const addr=server.address();if(!addr||typeof addr==='string')throw Error('port');return `http://127.0.0.1:${addr.port}/api/dashboard/`;}
  async function stop(){if(!server)return;server.closeAllConnections();await new Promise<void>(resolve=>server!.close(()=>resolve()));}
  try {
   let url=await start();
   const post=(route:string,body:unknown,headers:Record<string,string>={})=>fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
   expect((await post('registry',{plan:fixture,team:'Team'})).status).toBe(400);
   expect((await post('review',{plan:fixture},{Origin:'invalid'})).status).toBe(403);
   expect((await post('review',{plan:fixture},{'Sec-Fetch-Site':'cross-site'})).status).toBe(403);
   expect((await post('review',{plan:fixture},{'Content-Type':'text/plain'})).status).toBe(415);
   expect((await post('review',{plan:fixture,text:'x'.repeat(40000)})).status).toBe(413);
   const record=await (await post('registry',{plan:fixture,team:'Соседи',confirmed:true})).json();
   expect(record.score).toBe(reviewPlan(fixture).result.finalScore);
   expect((await (await post('registry',{plan:[...fixture].reverse(),team:'соседи',confirmed:true})).json()).id).toBe(record.id);
   const council=await(await post('council',{plan:fixture})).json();
   expect((await(await post('council',{plan:fixture})).json()).id).toBe(council.id);
   await stop();url=await start();
   expect((await(await fetch(url+'registry')).json()).entries).toHaveLength(1);
   const restored=await(await fetch(url+`council/${council.id}`)).json();
   expect(restored.events).toEqual(council.events);expect(restored.fingerprint).toBe(council.fingerprint);
   expect((await post('package',{sessionId:council.id,ids:['unknown']})).status).toBe(200);
   const completion=await(await post('complete',{plan:fixture.slice(0,4)})).json();expect(completion.completion.plan).toHaveLength(5);expect(completion.repair).toBeNull();
  } finally {await stop();rmSync(directory,{recursive:true,force:true});}
 },20000);
 it('does not overwrite a corrupt durable registry',()=>{const directory=mkdtempSync(path.join(tmpdir(),'alem-dashboard-corrupt-'));try{writeFileSync(path.join(directory,'dashboard.json'),'corrupt');expect(()=>new DashboardStore(directory)).toThrow();}finally{rmSync(directory,{recursive:true,force:true});}});
});
describe('AI analysis degrades honestly',()=>{
 it('uses real structured provider output and rejects unsupported numerical prose',async()=>{
  const review=reviewPlan(fixture);
  const response=(strengths:string[])=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({strengths,risks:['Есть неравномерность между районами.'],recommendations:['Сравните альтернативу и сохраните выбор за собой.']})}]}]});
  const provider=vi.fn(async()=>response(['План помогает социальным услугам.']));
  const service=createAnalysisService({apiKey:'test',fetchImpl:provider});
  expect((await service(review)).mode).toBe('ai');expect((await service(review)).mode).toBe('ai');expect(provider).toHaveBeenCalledTimes(1);
  expect((await createAnalysisService({apiKey:'test',fetchImpl:async()=>response(['Вы выиграете 100 баллов.'])})(review)).mode).toBe('local');
  expect((await createAnalysisService({apiKey:'test',fetchImpl:async()=>response(['Индекс вырастет на десять баллов.'])})(review)).mode).toBe('local');
  expect((await createAnalysisService({apiKey:''})(review)).mode).toBe('local');
  expect((await createAnalysisService({apiKey:'test',fetchImpl:async()=>{throw new Error('offline');}})(review)).reason).toBe('failed');
 });
});
