import {build} from 'vite';
import {mkdir,readFile,writeFile,cp,readdir,stat,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {checkPreviews} from '../cityrt/check-previews.mjs';
import {facadeAsset,checkFacadeBytes} from './facade-assets.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
process.chdir(root);
await checkPreviews({root});
const staticBuild=process.argv.includes('--static'),output=staticBuild?'dist-static':'dist';
const city=JSON.parse(await readFile('public/alem/geometry-low.json','utf8'));
const facade=facadeAsset(city);
checkFacadeBytes(facade,await readFile('public/'+facade.url));
const bootstrap=JSON.parse(await readFile('src/world/bootstrap.json','utf8'));
if(JSON.stringify(bootstrap.metadata.architecture.asset)!==JSON.stringify(facade))throw Error('Bundled façade asset and release metadata do not match');
process.env.VITE_ALEM_STATIC=String(staticBuild);
await build({publicDir:false,build:{outDir:output}});
if(!staticBuild)await build({configFile:false,publicDir:false,build:{ssr:'server/main.ts',outDir:'.server',target:'node22',rolldownOptions:{output:{entryFileNames:'server.mjs'}}}});
const copy=async(source,destination)=>{await mkdir(new URL('.',new URL(destination,new URL('../../',import.meta.url))),{recursive:true});await cp(source,destination,{recursive:true});};
// Publish exactly what the browser requests. The monolithic audit mesh and raw
// copies of lossless wire assets are authoring outputs, not runtime dependencies.
const mapFiles=new Set(['geometry-low.json','brand.svg','landmarks.json','lrt-route.json']);
for(const asset of [city,...city.tiles])mapFiles.add(asset.transport?.file||asset.url.slice(5));
mapFiles.add(facade.url.slice(5));
for(const name of mapFiles){
  if(!/^(?:(?:map|facades)-[a-f0-9]{20}\.bin|geometry-low\.json|brand\.svg|landmarks\.json|lrt-route\.json)$/.test(name))throw Error(`Unexpected city runtime asset: ${name}`);
  await copy(`public/alem/${name}`,`${output}/alem/${name}`);
}
const khanate=JSON.parse(await readFile('public/khanate/geometry.json','utf8'));
for(const name of [khanate.transport.file,'geometry.json','invitation.png']){
 if(!/^(?:map-[a-f0-9]{20}\.bin|geometry\.json|invitation\.png)$/.test(name))throw Error(`Unexpected historical runtime asset: ${name}`);
 await copy(`public/khanate/${name}`,`${output}/khanate/${name}`);
}
await copy('docs/khanate-art-direction.md',`${output}/khanate/ATTRIBUTION.md`);
// Current companion art only. Historical winter plates and plush expressions stay
// in the authoring tree; they are not dependencies of the geographic game.
await copy('public/aya/guide-atlas.webp',`${output}/aya/guide-atlas.webp`);
await copy('public/aya/guide-idle.webp',`${output}/aya/guide-idle.webp`);
// Individually named own-model previews; no research/reference assets are copied.
for(const mode of ['astana','khanate'])for(let i=1;i<=14;i++)for(const district of ['esil','almaty','saryarka','baikonur','nura'])await copy(`public/project-previews/${mode}/M${i}-${district}.webp`,`${output}/project-previews/${mode}/M${i}-${district}.webp`);
await copy('public/project-previews/manifest.json',`${output}/project-previews/manifest.json`);
await copy('public/residents/geographic-anchors.json',`${output}/residents/geographic-anchors.json`);
await copy('public/city/data/districts.geojson',`${output}/city/data/districts.geojson`);
await copy('ATTRIBUTION.md',`${output}/city/ATTRIBUTION.md`);
for(const [name,license] of [['react','LICENSE'],['react-dom','LICENSE'],['earcut','LICENSE'],['@fontsource-variable/noto-sans','LICENSE'],['@fontsource-variable/noto-serif','LICENSE']]) await copy(`node_modules/${name}/${license}`,`${output}/licenses/${name.replaceAll("/","-")}.txt`);
await copy('src/design/assets/SHANTELL-OFL.txt',`${output}/licenses/shantell-sans-OFL.txt`);
await copy('src/design/assets/SHANTELL-ATTRIBUTION.md',`${output}/licenses/shantell-sans-attribution.md`);
await copy('data/prepared/geography.tar.gz',`${output}/geography.tar.gz`);
let commit=process.env.RAILWAY_GIT_COMMIT_SHA||null,dirty=null;
try {commit ||= execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();}catch{}
await writeFile(`${output}/version.json`,JSON.stringify({application:'alem',commit,dirty,model:'astana-education-1',delivery:staticBuild?'static':'connected',worlds:['astana','khanate'],builtAt:new Date().toISOString()})+'\n');
const manifest={};
async function collect(directory=output,prefix='') {
  for(const entry of await readdir(directory)) {
    const path=`${directory}/${entry}`,relative=`${prefix}${entry}`;
    if((await stat(path)).isDirectory()) {await collect(path,`${relative}/`);continue;}
    const data=await readFile(path);const item=manifest[relative]={bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
    // Spatial map pieces use bounded compression work, including the first-view mesh.
    const streamed=/^(?:map|facades)-[a-f0-9]{20}\.bin$/.test(entry);
    if(!(staticBuild&&streamed)&&data.length>1024&&(streamed||data.length<12_000_000)&&!/\.(png|webp|gz)$/.test(entry)){const compressed=brotliCompressSync(data,{params:{[constants.BROTLI_PARAM_QUALITY]:streamed?7:11}});if(compressed.length<data.length*.95){await writeFile(`${path}.br`,compressed);item.brotliBytes=compressed.length;}}
    if((streamed||data.length>1024)&&!/\.(png|webp|gz)$/.test(entry)){const compressed=gzipSync(data,{level:9});if(streamed||compressed.length<data.length*.95){await writeFile(`${path}.gz`,compressed);item.gzipBytes=compressed.length;}}
  }
}
await collect();
if(staticBuild)for(const name of Object.keys(manifest).filter(name=>/^(?:alem\/(?:map|facades)|khanate\/map)-[a-f0-9]{20}\.bin$/.test(name))){
 // Static clients fetch these intrinsically compressed files themselves. A
 // second, uncompressed copy would add over 200 MB to the downloadable package.
 const packed=await readFile(`${output}/${name}.gz`);
 manifest[`${name}.gz`]={bytes:packed.length,sha256:createHash('sha256').update(packed).digest('hex')};
 await unlink(`${output}/${name}`);delete manifest[name];
}
await writeFile(`${output}/asset-manifest.json`,JSON.stringify(manifest,null,2));
console.log(`Production allowlist: ${Object.keys(manifest).length} assets; ${Math.round(Object.values(manifest).reduce((sum,a)=>sum+(a.brotliBytes||a.gzipBytes||a.bytes),0)/1e6)} MB compressed including the attributed database.`);
