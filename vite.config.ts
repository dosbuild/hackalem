import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {createReadStream,existsSync} from 'node:fs';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream';

import type {handleApiRequest} from './server/api.ts';

const codespaceHost=process.env.CODESPACE_NAME&&process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  ?`${process.env.CODESPACE_NAME}-5174.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`:undefined;

export default defineConfig({
  plugins:[react(),{
    name:'city-development-transport',
    configureServer(server){
      server.middlewares.use((req,res,next)=>{
        const pathname=new URL(req.url||'/', 'http://localhost').pathname;
        if(!/^\/(?:alem|khanate)\/map-[a-f0-9]{20}\.bin$/.test(pathname)||!['GET','HEAD'].includes(req.method||'')){next();return;}
        const file=new URL(`./public${pathname}`,import.meta.url);
        if(!existsSync(file)){next();return;}
        const accepted=(req.headers['accept-encoding']||'').split(',').some(value=>{
          const [name,...params]=value.trim().split(';');
          return name==='gzip'&&!params.some(p=>/^q=0(?:\.0*)?$/.test(p.trim()));
        });
        res.setHeader('Content-Type','application/octet-stream');
        res.setHeader('Cache-Control','public, max-age=31536000, immutable');
        res.setHeader('Vary','Accept-Encoding');
        const etag=`"${pathname.split('/').at(-1)}${accepted?'-gzip':''}"`;
        res.setHeader('ETag',etag);
        if(req.headers['if-none-match']===etag){res.statusCode=304;res.end();return;}
        if(accepted)res.setHeader('Content-Encoding','gzip');
        if(req.method==='HEAD'){res.end();return;}
        const source=createReadStream(file);
        if(accepted)pipeline(source,createGzip({level:4}),res,()=>{});
        else pipeline(source,res,()=>{});
      });
    },
  },{
    name:'alem-api',
    configureServer(server){
      server.middlewares.use((req,res,next)=>{
        if(!/^\/(?:api(?:\/|$)|healthz(?:\?|$))/.test(req.url||'')){next();return;}
        // Codespaces can forward a localhost Host. Trust only its explicit preview
        // origin; never accept arbitrary forwarded headers or foreign origins.
        if(codespaceHost&&req.headers.origin===`https://${codespaceHost}`)req.headers.host=codespaceHost;
        void server.ssrLoadModule('/server/api.ts').then(async module=>{
          if(!await (module.handleApiRequest as typeof handleApiRequest)(req,res))next();
        }).catch(next);
      });
    },
  }],
  base:'./',
  optimizeDeps:{entries:['index.html']},
  server:{
    host:'0.0.0.0',port:5174,strictPort:true,
    allowedHosts:codespaceHost?[codespaceHost]:[],
  },
});
