import {createServer} from './http';
import {DashboardStore} from './dashboard/store';
// Validate storage before readiness, so a bad mount cannot accept submissions it will lose.
const server=await createServer({dashboardStore:new DashboardStore()});
server.requestTimeout=10000;
server.headersTimeout=10000;
server.listen(Number(process.env.PORT||4174),process.env.HOST||'0.0.0.0',()=>{
  const address=server.address();
  const port=typeof address==='object'&&address?address.port:process.env.PORT||4174;
  console.log(`Alem production server listening on ${process.env.HOST||'0.0.0.0'}:${port}; AI ${process.env.OPENAI_API_KEY?'configured':'local fallback'}`);
});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close();setTimeout(()=>process.exit(0),1000).unref();});
