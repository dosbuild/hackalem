/** Production MRT / ink raster gate. Run sequentially with the other GPU gates.
 * APP_URL=http://127.0.0.1:4174 RELEASE_OUTPUT=artifacts/ink node scripts/release/ink-contours.mjs
 * Uses literal shaders intercepted from the served app, in a separate 256px GL
 * context. A single colour-only injection follows production normal/depth output;
 * depth, classification, perspective and both ink/edge-resolve shaders stay unchanged.
 */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from './browser-options.mjs';
import {artifactContext} from '../integration/ui.mjs';

const out=process.env.RELEASE_OUTPUT||'artifacts/ink';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
let artifact,report;
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const sources=new WeakMap(),source=WebGL2RenderingContext.prototype.shaderSource,link=WebGL2RenderingContext.prototype.linkProgram;
  window.__productionContourShaders={};
  WebGL2RenderingContext.prototype.shaderSource=function(shader,text){sources.set(shader,text);return source.call(this,shader,text);};
  WebGL2RenderingContext.prototype.linkProgram=function(program){
   const result=link.call(this,program),attached=this.getAttachedShaders(program)||[];
   const vertex=attached.find(shader=>this.getShaderParameter(shader,this.SHADER_TYPE)===this.VERTEX_SHADER),fragment=attached.find(shader=>this.getShaderParameter(shader,this.SHADER_TYPE)===this.FRAGMENT_SHADER);
   const v=sources.get(vertex),f=sources.get(fragment);
   if(v&&f&&f.includes('outputNormal')&&f.includes('gl_FragDepth')&&v.includes('uniform mat3 rotation'))Object.assign(window.__productionContourShaders,{cityVertex:v,cityFragment:f});
   if(v&&f&&f.includes('sampler2D sceneNormal')&&f.includes('worldPixel'))Object.assign(window.__productionContourShaders,{inkVertex:v,inkFragment:f});
   if(v&&f&&f.includes('sampler2D image')&&f.includes('float mask='))Object.assign(window.__productionContourShaders,{resolveVertex:v,resolveFragment:f});
   return result;
  };
 });
 const url=new URL(process.env.APP_URL||'http://127.0.0.1:4174');if(process.env.WORLD_MODE)url.searchParams.set('mode',process.env.WORLD_MODE);
 await page.goto(url.href);await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true',{},{timeout:120000});
 artifact=await artifactContext(page);
 assert(['astana','khanate'].includes(artifact.world)&&['connected','static'].includes(artifact.build),'Contour evidence requires an identified production world and build');
 const shaders=await page.evaluate(()=>window.__productionContourShaders);
 for(const name of ['cityVertex','cityFragment','inkVertex','inkFragment','resolveVertex','resolveFragment'])assert(typeof shaders[name]==='string'&&shaders[name].length>40,`Missing intercepted production ${name}`);
 // A real public navigation action hides the native world while the isolated
 // diagnostic context runs. It does not replace any application rendering code.
 await page.getByRole('navigation',{name:'Пространства Алем'}).getByRole('button',{name:artifact.world==='khanate'?'Летопись':'Итог',exact:true}).click();
 report=await page.evaluate(shaders=>{
  const size=256,color=[.84,.76,.64],inkColor=[.20,.16,.13],checks=[],cases=[];
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('Diagnostic WebGL2 unavailable');
  const programs=[],shaderObjects=[],textures=[],buffers=[],vaos=[],framebuffers=[];
  const check=(name,passed,evidence={})=>checks.push({name,passed,...evidence});
  const compile=(type,text)=>{const shader=gl.createShader(type);shaderObjects.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const program=(vertex,fragment)=>{const result=gl.createProgram();programs.push(result);gl.attachShader(result,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(result,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(result);if(!gl.getProgramParameter(result,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(result));return result;};
  const marker=' if(vKind>13.5',injection=shaders.cityFragment.indexOf(marker);
  if(injection<0||shaders.cityFragment.lastIndexOf('outputNormal',injection)<0)throw Error('Production fragment no longer has the normal-preserving colour probe seam');
  const probeFragment=shaders.cityFragment.slice(0,injection)+' outputColor=vec4(vColor,1.);return;'+shaders.cityFragment.slice(injection);
  const city=program(shaders.cityVertex,probeFragment),ink=program(shaders.inkVertex,shaders.inkFragment),resolve=program(shaders.resolveVertex,shaders.resolveFragment);
  const target=gl.createFramebuffer();framebuffers.push(target);gl.bindFramebuffer(gl.FRAMEBUFFER,target);
  for(let i=0;i<3;i++){
   const texture=gl.createTexture();textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);
   for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,name,i===2?gl.NEAREST:gl.LINEAR);
   for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,i===2?gl.DEPTH_COMPONENT24:gl.RGBA8,size,size,0,i===2?gl.DEPTH_COMPONENT:gl.RGBA,i===2?gl.UNSIGNED_INT:gl.UNSIGNED_BYTE,null);
   gl.framebufferTexture2D(gl.FRAMEBUFFER,i===2?gl.DEPTH_ATTACHMENT:gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,texture,0);
  }
  gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);const framebufferComplete=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  if(!framebufferComplete)throw Error('Production-format MRT framebuffer incomplete');
  const composite=gl.createFramebuffer(),image=gl.createTexture();framebuffers.push(composite);textures.push(image);gl.bindFramebuffer(gl.FRAMEBUFFER,composite);gl.bindTexture(gl.TEXTURE_2D,image);
  for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,name,gl.LINEAR);
  for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,image,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Production-format edge-mask framebuffer incomplete');
  const vao=gl.createVertexArray(),buffer=gl.createBuffer();vaos.push(vao);buffers.push(buffer);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
  const uniform=(p,name,value)=>{const location=gl.getUniformLocation(p,name);if(Array.isArray(value)){if(value.length===9)gl.uniformMatrix3fv(location,false,value);else if(value.length===3)gl.uniform3fv(location,value);else gl.uniform2fv(location,value);}else gl.uniform1f(location,value);};
  let pose;
  const rotation=(yaw,pitch)=>{const a=Math.cos(yaw),b=Math.sin(yaw),c=Math.cos(pitch),d=Math.sin(pitch);return Array.from(new Float32Array([a,c*b,-d*b,-b,c*a,-d*a,0,d,c]));};
  const project=point=>{const m=pose.matrix,x=m[0]*point[0]+m[3]*point[1]+m[6]*point[2],y=m[1]*point[0]+m[4]*point[1]+m[7]*point[2],z=m[2]*point[0]+m[5]*point[1]+m[8]*point[2],w=1-pose.perspective*z;return {x:size/2+x*.415*pose.zoom*size/w,y:size/2+y*.415*pose.zoom*size/w};};
  const begin=(lens,zoom,{yaw=0,pitch=0,pixelRatio=1}={})=>{
   pose={lens,zoom,pixelRatio,perspective:lens==='architectural'?zoom*.415/2.2:0,matrix:rotation(yaw,pitch)};
   gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,size,size);gl.useProgram(city);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
   gl.clearColor(...color,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.clearBufferfv(gl.COLOR,1,new Float32Array([.5,.5,1,0]));
   for(const [name,value]of Object.entries({rotation:pose.matrix,zoom,aspect:1,perspective:pose.perspective,center:[0,0,0],viewportHeight:size,cssHeight:size/pixelRatio,instanced:0,detailHeight:0,shadowsEnabled:0}))uniform(city,name,value);
   gl.vertexAttrib3fv(2,color);gl.vertexAttrib1f(4,0);
  };
  const triangles=(points,normal,kind=8)=>{gl.vertexAttrib3fv(1,normal);gl.vertexAttrib1f(3,kind);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.STREAM_DRAW);gl.drawArrays(gl.TRIANGLES,0,points.length);};
  const quad=(points,normal,kind=8,reverse=false)=>triangles((reverse?[0,1,3,1,2,3]:[0,1,2,0,2,3]).map(i=>points[i]),normal,kind);
  const normalAt=(x,y)=>{const bytes=new Uint8Array(4);gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return [...bytes];};
  const post=strength=>{
   gl.bindFramebuffer(gl.FRAMEBUFFER,composite);gl.viewport(0,0,size,size);gl.disable(gl.DEPTH_TEST);gl.useProgram(ink);gl.bindVertexArray(null);
   for(let i=0;i<3;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.uniform1i(gl.getUniformLocation(ink,['sceneColor','sceneNormal','sceneDepth'][i]),i);}
   for(const [name,value]of Object.entries({pixel:[1/size,1/size],pixelRatio:pose.pixelRatio,zoom:pose.zoom,aspect:1,perspective:pose.perspective,strength}))uniform(ink,name,value);
   gl.drawArrays(gl.TRIANGLES,0,3);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(resolve);gl.activeTexture(gl.TEXTURE0+3);gl.bindTexture(gl.TEXTURE_2D,image);gl.uniform1i(gl.getUniformLocation(resolve,'image'),3);uniform(resolve,'pixel',[1/size,1/size]);gl.drawArrays(gl.TRIANGLES,0,3);
   const pixels=new Uint8Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return {pixels,png:canvas.toDataURL('image/png')};
  };
  const delta=(base,ink,x,y)=>{const i=(y*size+x)*4;return Math.max(...[0,1,2].map(channel=>base[i+channel]-ink[i+channel]));};
  const region=(base,ink,{left=0,bottom=0,right=size,top=size}={})=>{
   let peak=0,darkened=0,sum=0;
   for(let y=Math.max(0,Math.floor(bottom));y<Math.min(size,Math.ceil(top));y++)for(let x=Math.max(0,Math.floor(left));x<Math.min(size,Math.ceil(right));x++){const d=delta(base,ink,x,y);peak=Math.max(peak,d);sum+=Math.max(0,d);if(d>2)darkened++;}
   return {peak,darkened,sum};
  };
  const capture=(id,strength=.82)=>{const baseline=post(0),outlined=post(strength),metrics=region(baseline.pixels,outlined.pixels);cases.push({id,lens:pose.lens,zoom:pose.zoom,perspective:pose.perspective,pixelRatio:pose.pixelRatio,strength,metrics,baselinePng:baseline.png,inkPng:outlined.png});return {baseline,outlined,metrics};};
  const normalized=vector=>{const length=Math.hypot(...vector);return vector.map(value=>value/length);};
  const plane=(left,right,bottom,top,sx,sy,height)=>[[left,bottom],[right,bottom],[right,top],[left,top]].map(([x,y])=>[x,y,height+sx*x+sy*y]);
  const lenses=['orthographic','architectural'];
  for(const lens of lenses){
   // A genuinely slanted physical face uses both triangle diagonals / two
   // adjoining coplanar packets. Only the outer silhouette may carry ink.
   begin(lens,140,{yaw:.23,pitch:.72});const n=normalized([-.16,-.31,1]);
   quad(plane(-.025,0,-.025,.025,.16,.31,.001),n);quad(plane(0,.025,-.025,.025,.16,.31,.001),n,8,true);
   const a=normalAt(128,128),b=normalAt(120,120),slant=capture(`${lens}-slanted-coplanar`),interior=region(slant.baseline.pixels,slant.outlined.pixels,{left:96,bottom:96,right:160,top:160});
   check('Slanted coplanar triangles and adjoining packets have no internal ink',a[3]===255&&b[3]===255&&interior.peak<=1,{lens,interior,normals:[a,b],tolerance:'one RGBA8 rounding unit'});
   for(const kind of [1,4,10,18,21,22]){
    begin(lens,180,{yaw:.23,pitch:.72});quad(plane(-.025,.025,-.025,.025,0,0,.00004),[0,0,1],0);
    quad(plane(0,.025,-.025,.025,0,0,.0008),[0,0,1],kind,true);
    const paintNormal=normalAt(128,128),paint=capture(`${lens}-ground-layer-${kind}`);
    check('Logical ground-paint layer boundaries have no ink',paintNormal[3]===0&&paint.metrics.peak<=1,{lens,kind,metrics:paint.metrics,normal:paintNormal,tolerance:'one RGBA8 rounding unit'});
   }
   // A complete simple building has physical walls, a gable and a 90 degree
   // roof ridge. Same colour isolates silhouette / normal evidence from light.
   begin(lens,160,{yaw:-.22,pitch:.78});const x=.0024,y=.0024,eave=.0013,ridge=.0037;
   quad([[-x,-y,eave],[0,-y,ridge],[0,y,ridge],[-x,y,eave]],normalized([-1,0,1]));
   quad([[0,-y,ridge],[x,-y,eave],[x,y,eave],[0,y,ridge]],normalized([1,0,1]));
   quad([[-x,-y,0],[x,-y,0],[x,-y,eave],[-x,-y,eave]],[0,-1,0]);quad([[x,-y,0],[x,y,0],[x,y,eave],[x,-y,eave]],[1,0,0]);
   quad([[x,y,0],[-x,y,0],[-x,y,eave],[x,y,eave]],[0,1,0]);quad([[-x,y,0],[-x,-y,0],[-x,-y,eave],[-x,y,eave]],[-1,0,0]);
   triangles([[-x,-y,eave],[x,-y,eave],[0,-y,ridge]],[0,-1,0]);triangles([[x,y,eave],[-x,y,eave],[0,y,ridge]],[0,1,0]);
   const building=capture(`${lens}-building-silhouette-and-ridge`),at=project([0,0,ridge]),crease=region(building.baseline.pixels,building.outlined.pixels,{left:at.x-3,bottom:at.y-3,right:at.x+3,top:at.y+3});
   const contrast=Math.max(...color.map((value,i)=>(value-inkColor[i])*255)),silhouetteFloor=contrast*.78*.82*.45,creaseFloor=contrast*.46*.82*.25;
   check('A physical building retains a clear silhouette',building.metrics.peak>=silhouetteFloor&&building.metrics.darkened>=24,{lens,metrics:building.metrics,minimumPeak:silhouetteFloor,minimumPixels:24});
   check('A significant physical normal crease retains ink away from the silhouette',crease.peak>=creaseFloor&&crease.darkened>=2,{lens,crease,at,minimumPeak:creaseFloor,minimumPixels:2});
  }
  // Read actual output raster widths along a straight wall silhouette. Its
  // projected body grows threefold, while ink remains within one CSS px.
  for(const lens of lenses)for(const pixelRatio of [1,1.25]){
   const widths=[];
   for(const zoom of [80,160,240]){
    begin(lens,zoom,{pixelRatio});const z=.001;quad(plane(-.002,.002,-.002,.002,0,0,z),[0,0,1]);
    const line=capture(`${lens}-stroke-${zoom}-ratio-${pixelRatio}`),edge=project([.002,0,z]);let count=0;
    for(let px=Math.floor(edge.x)-5;px<=Math.ceil(edge.x)+5;px++)if(delta(line.baseline.pixels,line.outlined.pixels,px,128)>8)count++;
    const cssWidth=count/pixelRatio;widths.push(cssWidth);
    check('A straight silhouette is thin and remains visible in CSS pixels',cssWidth>=.5&&cssWidth<=3,{lens,zoom,pixelRatio,rasterPixels:count,cssWidth,maximum:'3 CSS px including bilinear coverage'});
   }
   check('Stroke width stays pixel-scaled as the physical body grows',Math.max(...widths)-Math.min(...widths)<=1,{lens,pixelRatio,widths,tolerance:'one CSS px raster sampling granularity'});
  }
  // Hold the physical silhouette at an identical pixel boundary while applying
  // the production zoom-to-strength law. Quantized intensity must follow its
  // continuous fade rather than popping or changing thickness at the boundary.
  for(const lens of lenses){
   const fades=[];
   for(const zoom of [1.299,1.3,1.301,1.35,1.8,2.8,3.8,4.8,6.299,6.3,6.301]){
    begin(lens,zoom);const z=.001,w=1-pose.perspective*z,half=32.25*w/(.415*zoom*size);
    quad(plane(-half,half,-half,half,0,0,z),[0,0,1]);
    const strength=Math.min(1,Math.max(0,(zoom-1.3)/5))*.82,fade=capture(`${lens}-fade-${zoom}`,strength);fades.push({zoom,strength,peak:fade.metrics.peak,sum:fade.metrics.sum});
   }
   const full=fades.at(-1).peak;
   check('Overview ink begins without a discontinuity',fades.slice(0,3).every(fade=>fade.peak<=1)&&full>=40,{lens,fades:fades.slice(0,3),fullPeak:full});
   check('Raster ink intensity follows the continuous production fade',fades.every((fade,i)=>Math.abs(fade.peak-full*fade.strength/.82)<=2&&(i===0||fade.peak>=fades[i-1].peak)),{lens,fades,tolerance:'two RGBA8 rounding units against measured full-strength contrast'});
  }
  const error=gl.getError();check('Production main / MRT / ink passes have no GL error',error===gl.NO_ERROR,{error});
  const result={size,framebuffer:{color:'RGBA8',normal:'RGBA8',depth:'DEPTH_COMPONENT24',complete:framebufferComplete},probe:{injectionOffset:injection,change:'flat vColor return after production normal / opacity / fragment-depth writes'},checks,cases,error,completed:checks.every(item=>item.passed)};
  buffers.forEach(item=>gl.deleteBuffer(item));vaos.forEach(item=>gl.deleteVertexArray(item));textures.forEach(item=>gl.deleteTexture(item));framebuffers.forEach(item=>gl.deleteFramebuffer(item));programs.forEach(item=>gl.deleteProgram(item));shaderObjects.forEach(item=>gl.deleteShader(item));gl.getExtension('WEBGL_lose_context')?.loseContext();
  return result;
 },shaders);
 report.artifact=artifact;report.errors=errors;report.completed&&=errors.length===0;
 report.shaders={};for(const [name,text]of Object.entries(shaders)){const path=`${out}/${name}.glsl`;await writeFile(path,text);report.shaders[name]={path,sha256:createHash('sha256').update(text).digest('hex')};}
 for(const item of report.cases){
  for(const [name,key]of [['baseline','baselinePng'],['ink','inkPng']]){const path=`${out}/${item.id}-${name}.png`;await writeFile(path,Buffer.from(item[key].split(',')[1],'base64'));await writeFile(`${path}.json`,JSON.stringify({...artifact,case:item.id,lens:item.lens,zoom:item.zoom,perspective:item.perspective,pixelRatio:item.pixelRatio,strength:name==='baseline'?0:item.strength},null,2)+'\n');item[`${name}Path`]=path;delete item[key];}
 }
 await writeFile(`${out}/ink-contours.json`,JSON.stringify(report,null,2)+'\n');
 assert(report.completed,JSON.stringify({failed:report.checks.filter(item=>!item.passed),errors}));
 console.log(`PASS ${report.checks.length} production ink raster assertions across ${report.cases.length} cases, both lenses`);
}catch(error){
 if(!report)await writeFile(`${out}/ink-contours.json`,JSON.stringify({completed:false,artifact,error:String(error),stack:error.stack},null,2)+'\n');
 throw error;
}finally{await browser.close();}
