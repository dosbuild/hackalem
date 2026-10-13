import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {executablePath,browserArgs} from '../../release/browser-options.mjs';
const ids=process.argv.slice(2);if(!ids.length)ids.push('expo','baiterek','khan','atyrau','palace','akorda','hazret','opera','arch','concert','lrt','train');
const folder=process.env.LANDMARK_CAPTURES||'artifacts/landmarks/studio';await mkdir(folder,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const id of ids){await page.goto(`http://127.0.0.1:5175/scripts/alem/landmarks/studio.html?id=${id}`);await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.screenshot({path:`${folder}/${id}.png`});console.log(id,await page.evaluate(()=>landmarkStudio.renderer.diagnostics().cityVertices/3));}
await browser.close();await writeFile(`${folder}/errors.json`,JSON.stringify(errors));if(errors.length)throw Error(errors.join('\n'));
