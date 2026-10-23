import {spawnSync} from 'node:child_process';
for(const mode of ['khanate','astana']) {
 const run=spawnSync(process.execPath,['scripts/khanate/static-journey.mjs'],{stdio:'inherit',env:{...process.env,WORLD_MODE:mode}});
 if(run.error)throw run.error;
 if(run.status!==0)process.exit(run.status??1);
}
