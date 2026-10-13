/** Capture the actual native world; the studio is never in the release allowlist. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
try{
 const page=await browser.newPage({viewport:{width:1104,height:600},deviceScaleFactor:1});
 await page.goto(`${process.env.APP_URL||'http://127.0.0.1:4197'}/scripts/khanate/studio.html`);
 await page.locator('[data-ready=true]').waitFor({timeout:45000});
 await page.addStyleTag({content:'#tools,.geo-labels,.district-wayfinding,.landmark-atlas,.landmark-caption{display:none!important}'});
 await page.screenshot({path:'public/khanate/invitation.png'});
 console.log('Captured the rendered historical world → public/khanate/invitation.png');
}finally{await browser.close();}
