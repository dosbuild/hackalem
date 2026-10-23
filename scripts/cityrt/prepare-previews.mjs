/** Export Alem's native project meshes; original reference images never enter the release. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {previewSourceHashes} from './check-previews.mjs';
import {createNativePreviewContext,previewContextRequest} from './preview-context.mjs';
const directory='public/project-previews',origin=process.env.APP_URL||'http://127.0.0.1:5174';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),manifest={author:'Alem implementation',method:'Native own project meshes, shared WebGL materials/ink and camera; no source-reference assets.',width:480,height:288,sources:{},images:[]};
manifest.sources=await previewSourceHashes();
const nativeContext=await createNativePreviewContext();
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
try{
 const page=await browser.newPage({viewport:{width:480,height:288},deviceScaleFactor:1});page.setDefaultTimeout(60000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/scripts/cityrt/preview-studio.html`);await page.waitForFunction(()=>document.body.dataset.ready==='true');
 for(const mode of ['astana','khanate']){
  await mkdir(`${directory}/${mode}`,{recursive:true});
  for(let index=1;index<=14;index++)for(const district of ['esil','almaty','saryarka','baikonur','nura']){
   const id=`M${index}`,request=previewContextRequest(mode,id,district);
   const context=request?await nativeContext(request):undefined;
   const result=await page.evaluate(({mode,id,district,context})=>window.exportPreview(mode,id,district,context),{mode,id,district,context});
   const bytes=Buffer.from(result.data.split(',')[1],'base64'),path=`${mode}/${id}-${district}.webp`;
   const {data:contextData,...contextProvenance}=context||{};
   await writeFile(`${directory}/${path}`,bytes);manifest.images.push({mode,initiativeId:id,districtId:district,path,bytes:bytes.length,sha256:hash(bytes),modelBytes:result.bytes,pose:result.pose,...(result.activity?{activity:result.activity}:{}),...(result.presentation?{presentation:result.presentation}:{}),...(context?{context:contextProvenance}:{})});
  }
  console.log(`Exported 70 ${mode} project previews.`);
 }
 if(errors.length)throw Error(errors.join('\n'));
 const after=await previewSourceHashes();
 if(JSON.stringify(after)!==JSON.stringify(manifest.sources))throw Error('Preview sources changed during capture; repeat against a stable current source.');
 await writeFile(`${directory}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
 console.log(`140 own-model previews: ${(manifest.images.reduce((sum,item)=>sum+item.bytes,0)/1e6).toFixed(2)} MB.`);
}finally{await browser.close();}
