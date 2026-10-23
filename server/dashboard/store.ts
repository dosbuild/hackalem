import type {ModeId} from '../../src/modes/types';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, accessSync, constants, realpathSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CouncilSession, RegistryEntry } from '../../src/dashboard/types';

type Database={version:1;sessions:CouncilSession[];registry:RegistryEntry[]};
export function dashboardDirectory(env:Record<string,string|undefined>=process.env) {
 const mount=env.RAILWAY_VOLUME_MOUNT_PATH;
 if(env.RAILWAY_ENVIRONMENT_ID&&!mount)throw new Error('Railway requires a persistent volume for the council and registry');
 const directory=path.resolve(env.ALEM_DATA_DIR||(mount?path.join(mount,'alem'):'.data'));
 if(env.RAILWAY_ENVIRONMENT_ID&&mount){
  const relative=path.relative(path.resolve(mount),directory);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('ALEM_DATA_DIR must be inside the Railway volume');
  realpathSync(mount); // Do not silently create an ephemeral replacement for a missing mount.
 }
 return directory;
}
/** Atomic replace protects the last durable snapshot. A malformed file is an error, never an empty registry. */
export class DashboardStore {
 private file:string;
 private data:Database;
 constructor(directory=dashboardDirectory()) {
  mkdirSync(directory,{recursive:true,mode:0o700});accessSync(directory,constants.R_OK|constants.W_OK);this.file=path.join(directory,'dashboard.json');
  if(existsSync(this.file)) {
   const parsed=JSON.parse(readFileSync(this.file,'utf8')) as Database;
   if(parsed.version!==1||!Array.isArray(parsed.sessions)||!Array.isArray(parsed.registry))throw new Error('storage_corrupt');
   this.data=parsed;
  } else this.data={version:1,sessions:[],registry:[]};
 }
 private write(next:Database) {
  const temp=`${this.file}.${randomUUID()}.tmp`;
  writeFileSync(temp,JSON.stringify(next),{mode:0o600,flush:true});renameSync(temp,this.file);this.data=next;
 }
 session(id:string){return this.data.sessions.find(s=>s.id===id)??null;}
 forPlan(fingerprint:string,mode:ModeId='astana'){return this.data.sessions.filter(s=>s.fingerprint===fingerprint&&(s.worldMode??'astana')===mode);}
 saveSession(session:CouncilSession){const existing=this.session(session.id);if(existing)return existing;this.write({...this.data,sessions:[...this.data.sessions,session]});return session;}
 registry(mode:ModeId='astana'){return this.data.registry.filter(e=>(e.worldMode??'astana')===mode).sort((a,b)=>b.score-a.score||a.createdAt.localeCompare(b.createdAt));}
 submit(entry:RegistryEntry){const existing=this.data.registry.find(r=>r.team.toLocaleLowerCase('en')===entry.team.toLocaleLowerCase('en')&&r.fingerprint===entry.fingerprint&&(r.worldMode??'astana')===(entry.worldMode??'astana'));if(existing)return existing;this.write({...this.data,registry:[...this.data.registry,entry]});return entry;}
}
