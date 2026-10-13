import {build} from 'vite';
import {writeFile} from 'node:fs/promises';
// Bundle the real evaluator without a web server or a second calculation engine.
const output=await build({configFile:false,logLevel:'silent',build:{ssr:'src/domain/evaluate.ts',write:false}});
const chunk=output.output.find(x=>x.type==='chunk'&&x.isEntry);
const {evaluatePlan}=await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
const plan=[['M7','nura'],['M8','nura'],['M10','nura'],['M12',null],['M5','saryarka']].map(([initiativeId,districtId])=>districtId?{initiativeId,scope:'district',districtId}:{initiativeId,scope:'citywide'});
const outcome=evaluatePlan(plan);
if(!outcome.ok)throw new Error(JSON.stringify(outcome.issues));
await writeFile(new URL('../../docs/scenario/example-result.json',import.meta.url),JSON.stringify(outcome.result,null,2)+'\n');
console.log({resultId:outcome.result.resultId,score:outcome.result.finalScore});
