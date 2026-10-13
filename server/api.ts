import type {IncomingMessage, ServerResponse} from 'node:http';
import {createExplanationService} from './explanation';
import {createAssistantService} from './assistant/service';
import {createDashboardHandler} from './dashboard';
import type {DashboardStore} from './dashboard/store';

export interface ApiOptions {
  explain?:ReturnType<typeof createExplanationService>;
  dashboardStore?:DashboardStore;
}

/** The same API runs behind Vite in development and the release HTTP server. */
export function createApiHandler({explain=createExplanationService(),dashboardStore}:ApiOptions={}) {
  const assistant=createAssistantService();
  const dashboard=createDashboardHandler(dashboardStore?{store:dashboardStore}:{});
  return async(req:IncomingMessage,res:ServerResponse):Promise<boolean>=>{
    const url=new URL(req.url||'/', 'http://localhost');
    if(url.pathname!=='/healthz'&&!url.pathname.startsWith('/api/'))return false;
    const json=(status:number,body:unknown)=>{
      if(res.destroyed)return;
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:JSON.stringify(body));
    };
    try {
      if(url.pathname==='/healthz') {
        if(!['GET','HEAD'].includes(req.method||'')){json(405,{error:'method'});return true;}
        json(200,{status:'ok'});return true;
      }
      if(await dashboard(req,res))return true;
      if(url.pathname!=='/api/explanation'&&url.pathname!=='/api/assistant') {json(404,{error:'not_found'});return true;}
      if(req.method!=='POST') {json(405,{error:'method'});return true;}
      if(req.headers['sec-fetch-site']==='cross-site') {json(403,{error:'origin'});return true;}
      if(req.headers.origin) {
        let same=false;try{same=new URL(req.headers.origin).host===req.headers.host;}catch{}
        if(!same){json(403,{error:'origin'});return true;}
      }
      if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')) {json(415,{error:'json_required'});return true;}
      const limit=url.pathname==='/api/assistant'?24576:4096;
      if(Number(req.headers['content-length'])>limit) {json(413,{error:'too_large'});req.resume();return true;}
      const chunks:Buffer[]=[];let size=0;
      for await(const chunk of req) {size+=chunk.length;if(size>limit){json(413,{error:'too_large'});return true;}chunks.push(chunk);}
      let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{json(400,{error:'invalid_json'});return true;}
      const controller=new AbortController();
      const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);
      try{json(200,await (url.pathname==='/api/assistant'?assistant:explain)(input,controller.signal));}
      catch{json(400,{error:'invalid_plan'});}
      finally{res.off('close',disconnected);}
    }catch{json(400,{error:'invalid_request'});}
    return true;
  };
}

// Vite reloads this module (and its API dependencies) when server source changes.
export const handleApiRequest=createApiHandler();
