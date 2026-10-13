import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
const out=process.env.RELEASE_OUTPUT||'artifacts/city-synthesis/close';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),report=[];
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
try{
await page.goto(process.env.APP_URL||'http://127.0.0.1:4174');await page.locator('[data-ready=true]').waitFor();await page.getByRole('button',{name:'Выбрать первый район',exact:true}).click();
for(const district of ['esil','almaty','saryarka','baikonur','nura']){
 await page.locator('.resident-toggle').click();await page.locator('.resident-request[data-resident="'+district+'-01"]').click();await page.waitForFunction(()=>+document.querySelector('[data-testid=city-map]').dataset.zoom>159.999&&document.querySelector('[data-testid=city-map]').dataset.qualityLoading!=='true');await page.waitForTimeout(1000);await page.getByRole('button',{name:'Закрыть место встречи',exact:true}).click();await page.getByRole('button',{name:'Закрыть запросы жителей',exact:true}).click();await page.waitForTimeout(300);await page.screenshot({path:out+'/'+district+'.png'});report.push({district,data:await page.getByTestId('city-map').evaluate(e=>({...e.dataset}))});console.log(district);
}
assert.equal(errors.length,0,'No browser exceptions in district close views');assert.equal(report.length,5);assert(report.every(v=>v.data.completeCity==='true'&&+v.data.buildingCount===60978));
await writeFile(out+'/report.json',JSON.stringify({views:report,errors,complete:true},null,2)+'\n');
}finally{await browser.close();}
