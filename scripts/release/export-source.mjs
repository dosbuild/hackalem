/** Export current audited source, including intended new files, without old Git objects. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,readFile,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const args=process.argv.slice(2),outputAt=args.indexOf('--output');
assert(args.length===0||args.length===2&&outputAt===0&&args[1],'Use --output /absolute/new/directory, or omit it for an audit');
const output=outputAt<0?null:resolve(args[outputAt+1]);
if(output)assert(output!==root&&!output.startsWith(root+sep),'Export must use a separate directory');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const top=new Set(['.env.example','.gitattributes','.gitignore','.nvmrc','AGENTS.md','ATTRIBUTION.md','DEPLOY_RAILWAY.md','README.md','REPOSITORY.md','index.html','package-lock.json','package.json','railway.json','tsconfig.json','vite.config.ts','vitest.config.ts']);
const documentation=new Set(['release.md','release-verification.json','river-atlas.md','source-provenance.md','production-cleanup.md','play-art-provenance.md','khanate-art-direction.md','khanate-delivery.md','material-stability.md']);
const documentationFolders=['scenario/','budget/','fullscreen/','consequences/','city-synthesis/','hero-school/','city-impact/','decision-events/'];
const documentationFiles=new Set(['integration/DEPLOYMENT.md','integration/PROVENANCE.md','landmarks/current-package.md']);
function selected(name){
 if(top.has(name))return true;
 if(/(?:^|\/)(?:\.git|node_modules|\.env[^/]*|\.data|artifacts|\.playwright-cli|design-reference|execution-record|archive)(?:\/|$)/.test(name))return false;
 if(name==='data/prepared/geography.tar.gz'||name==='data/prepared/README.md')return true;
 if(name.startsWith('docs/')){
  const local=name.slice(5);
  return /\.(?:md|json)$/.test(local)&&(documentation.has(local)||documentationFiles.has(local)||documentationFolders.some(folder=>local.startsWith(folder)&&!local.includes('/verification/')));
 }
 if(/^(?:\.github|\.devcontainer)\//.test(name))return /\.(?:yml|yaml|json)$/.test(name);
 if(/^(?:src|server|scripts|tests)\//.test(name))return /\.(?:ts|tsx|mts|js|mjs|py|json|css|html|md|txt|woff2|svg)$/.test(name);
 if(name.startsWith('public/'))return /\.(?:json|svg|png|webp)$/.test(name)&&!/(?:^|\/)(?:city|source|reference)(?:\/|$)/.test(name)&&!name.endsWith('-source.json');
 return false;
}
const names=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean))].sort();
const files={},excluded=[];
for(const name of names){
 assert(!name.startsWith('/')&&!name.split('/').includes('..'),'Only repository-relative paths may be exported');
 if(!selected(name)){excluded.push(name);continue;}
 let info;try{info=await lstat(resolve(root,name));}catch(error){if(error.code==='ENOENT')continue;throw error;}
 assert(info.isFile()&&!info.isSymbolicLink(),`Source must be a regular local file: ${name}`);
 const bytes=await readFile(resolve(root,name));files[name]={bytes:bytes.length,sha256:sha(bytes)};
}
for(const required of ['package.json','package-lock.json','index.html','src/main.tsx','src/app/App.tsx','server/main.ts','data/prepared/geography.tar.gz','docs/scenario/source/goal-objective.md','src/design/assets/SHANTELL-OFL.txt','public/project-previews/manifest.json'])assert(files[required],`Required production source: ${required}`);
const sourceSha256=sha(Buffer.from(JSON.stringify(files)));
const manifest={application:'alem',sourceSha256,method:'Current tracked and intended untracked source; no original Git objects or private/generated data.',files};
const summary={files:Object.keys(files).length,bytes:Object.values(files).reduce((sum,item)=>sum+item.bytes,0),sourceSha256,excluded,output};
if(!output){console.log(JSON.stringify(summary,null,2));process.exit(0);}
try{await lstat(output);throw Error('Export directory already exists; choose a new directory');}catch(error){if(error.code!=='ENOENT')throw error;}
const staging=output+`.export-${process.pid}`;
await mkdir(staging,{recursive:false});
try{
 for(const [name,expected]of Object.entries(files)){
  const bytes=await readFile(resolve(root,name));assert.equal(sha(bytes),expected.sha256,`Source changed during export: ${name}`);
  const target=resolve(staging,name);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
 }
 for(const [name,expected]of Object.entries(files))assert.equal(sha(await readFile(resolve(root,name))),expected.sha256,`Source changed before export completed: ${name}`);
 await writeFile(resolve(staging,'SOURCE-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
 await rename(staging,output);
 console.log(JSON.stringify(summary,null,2));
}catch(error){await rm(staging,{recursive:true,force:true});throw error;}
