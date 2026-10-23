import {afterAll,describe,expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const directory=mkdtempSync(join(tmpdir(),'alem-placement-audit-'));
const source=JSON.parse(readFileSync(new URL('../src/world/placements.json',import.meta.url),'utf8'));
afterAll(()=>rmSync(directory,{recursive:true,force:true}));
function audit(change){
 const candidate=structuredClone(source);change(candidate);
 const catalog=join(directory,'candidate.json');writeFileSync(catalog,JSON.stringify(candidate));
 try{return {ok:true,output:execFileSync(process.execPath,['scripts/consequences/audit-placement.mjs','--catalog',catalog],{cwd:new URL('..',import.meta.url),env:{...process.env,RELEASE_OUTPUT:directory},encoding:'utf8',stdio:'pipe',timeout:30000})};}
 catch(error){return {ok:false,output:error.stderr?.toString()??String(error)};}
}
describe('standalone scenario placement candidate audit',()=>{
 it('audits a complete released catalog without changing the authoritative file',()=>{
  const before=readFileSync(new URL('../src/world/placements.json',import.meta.url),'utf8');
  expect(audit(()=>{}).ok).toBe(true);
  expect(readFileSync(new URL('../src/world/placements.json',import.meta.url),'utf8')).toBe(before);
 },30000);
 it('rejects an omitted initiative and an undersupplied lighting route',()=>{
  expect(audit(candidate=>{delete candidate.records['M10:esil'];}).output).toContain('all 70');
  expect(audit(candidate=>{candidate.records['M10:esil'].furniture.length=1;}).output).toContain('M10:esil needs at least two safe street fixtures');
 });
 it('rejects street furniture placed on its source road',()=>{
  const result=audit(candidate=>{const site=candidate.records['M1:esil'];site.furniture[0].point=[...site.route[0]];});
  expect(result.ok).toBe(false);
  expect(result.output).toContain('M1:esil furniture intersects');
 },30000);
});
