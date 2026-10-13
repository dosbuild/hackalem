/** Requires an explicitly configured server key. No mocked response counts as a pass. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.APP_URL||'http://127.0.0.1:4174',out=process.env.RELEASE_OUTPUT||'artifacts/integration/live-provider';
const plan=[{initiativeId:'M1',scope:'district',districtId:'nura'},{initiativeId:'M2',scope:'citywide'},{initiativeId:'M8',scope:'district',districtId:'nura'},{initiativeId:'M10',scope:'district',districtId:'saryarka'},{initiativeId:'M12',scope:'citywide'}];
const report={date:new Date().toISOString(),origin,checks:[],completed:false};
const post=async(path,body)=>{const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});assert(response.ok,`${path}: HTTP ${response.status}`);return response.json();};
await mkdir(out,{recursive:true});
try{
 report.aya=await post('/api/assistant',{text:'Как сопоставить интересы родителей и людей, которым важен путь на работу, при обсуждении этого плана?',history:[],context:{plan,revision:1,space:'dashboard',districtId:'nura',projectId:null,appeal:null}});
 assert.equal(report.aya.mode,'live',`Actual Aya provider reply required; received ${report.aya.mode}/${report.aya.reason}`);assert(report.aya.text.length>30);report.checks.push('Actual free-text Aya response accepted by the application validator');
 report.analysis=await post('/api/dashboard/analysis',{plan});assert.equal(report.analysis.mode,'ai',`Actual analysis provider reply required; received ${report.analysis.mode}/${report.analysis.reason}`);report.checks.push('Actual model analysis accepted by the application validator');
 report.completed=true;console.log('PASS actual Aya dialogue and dashboard analysis. Inspect report prose and verify the live label in the browser.');
}catch(error){report.failure=String(error);process.exitCode=1;console.error(report.failure);}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
