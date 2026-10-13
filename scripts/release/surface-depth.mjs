/** Raster regression using the production vertex shader: paint cannot bury people. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from './browser-options.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {artifactContext} from '../integration/ui.mjs';
const out=process.env.RELEASE_OUTPUT||'artifacts/renderer';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{const original=WebGL2RenderingContext.prototype.shaderSource;WebGL2RenderingContext.prototype.shaderSource=function(shader,source){if(source.includes('layout(location=4)')&&source.includes('uniform mat3 rotation'))window.__cityVertex=source;if(source.includes('in vec3 vP;')&&source.includes('gl_FragDepth'))window.__cityFragment=source;return original.call(this,shader,source);};});
 await page.goto(process.env.APP_URL||'http://127.0.0.1:4174');await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');
 const artifact=await artifactContext(page);
 assert(['connected','static'].includes(artifact.build),'Depth evidence requires an identified production build');
 const sources=await page.evaluate(()=>({vertex:window.__cityVertex,fragment:window.__cityFragment}));
 assert(Object.values(sources).every(source=>typeof source==='string'&&source.length>40),'Production shaders were intercepted');
 const report=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true}),checks=[];
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const vertex=compile(gl.VERTEX_SHADER,window.__cityVertex),fragment=compile(gl.FRAGMENT_SHADER,window.__cityFragment.replace(' if(vKind>13.5',' outputColor=vec4(vColor,1.);return; if(vKind>13.5')),program=gl.createProgram();
  gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,'viewportHeight'),256);gl.uniform1f(gl.getUniformLocation(program,'aspect'),1);gl.uniform1f(gl.getUniformLocation(program,'zoom'),288);gl.uniform3fv(gl.getUniformLocation(program,'center'),[0,0,0]);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);gl.vertexAttrib3f(1,0,0,1);gl.vertexAttrib1f(4,0);
  gl.viewport(0,0,256,256);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  const quad=(points,kind,color)=>{gl.vertexAttrib1f(3,kind);gl.vertexAttrib3fv(2,color);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,1,2,0,2,3].flatMap(i=>points[i])),gl.STATIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,6);};
  for(const perspective of [0,54.3272727273])for(const pitch of [.35,.78,1]){
   gl.uniform1f(gl.getUniformLocation(program,'perspective'),perspective);
   const c=Math.cos(pitch),s=Math.sin(pitch);gl.uniformMatrix3fv(gl.getUniformLocation(program,'rotation'),false,[1,0,0,0,c,-s,0,s,c]);
   const sampleZ=.00020,sampleY=Math.floor(128+s*sampleZ*.83*288*128/(1-perspective*c*sampleZ)),pixel=new Uint8Array(4);
   for(const [kind,height] of [[0,.00035],[1,.0006],[4,.00085],[10,.00052],[18,.00072],[21,.00045],[22,.00088]]){
    gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    quad([[-.00035,0,.00006],[.00035,0,.00006],[.00035,0,.00106],[-.00035,0,.00106]],8,[1,0,0]);
    // A flat ground-paint strip crosses the lower body in screen space.
    const y=s*(sampleZ-height)/(c-perspective*sampleZ);
    quad([[-.002,y-.0003,height],[.002,y-.0003,height],[.002,y+.0003,height],[-.002,y+.0003,height]],kind,[0,1,0]);
    gl.readPixels(128,sampleY,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    checks.push({perspective,pitch,kind,name:'ground paint stays behind the grounded resident',passed:pixel[0]===255&&pixel[1]===0});
    // A genuinely elevated physical foreground still occludes the same resident.
    quad([[-.0005,-.00045,0],[.0005,-.00045,0],[.0005,-.00045,.002],[-.0005,-.00045,.002]],8,[0,0,1]);
    gl.readPixels(128,sampleY,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    checks.push({perspective,pitch,kind,name:'physical foreground retains normal depth occlusion',passed:pixel[2]===255&&pixel[0]===0});
   }
  }
  // The neutral apron must never cover cartographic districts or water, even
  // when authoring paint elevations or packet order differ.
  gl.uniformMatrix3fv(gl.getUniformLocation(program,'rotation'),false,[1,0,0,0,1,0,0,0,1]);
  for(const perspective of [0,54.3272727273])for(const order of [[21,10,1],[21,1,10],[10,21,1],[10,1,21],[1,21,10],[1,10,21]]){
   gl.uniform1f(gl.getUniformLocation(program,'perspective'),perspective);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   for(const kind of order){const z=kind===21?.0012:kind===10?.00003:.00001,color=kind===21?[1,0,0]:kind===10?[1,1,0]:[0,0,1];quad([[-.003,-.003,z],[.003,-.003,z],[.003,.003,z],[-.003,.003,z]],kind,color);}
   const pixel=new Uint8Array(4);gl.readPixels(128,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
   checks.push({perspective,order,name:'neutral apron and district paint stay beneath water regardless of packet order',passed:pixel[2]===255&&pixel[0]===0&&pixel[1]===0});
  }
  // A park base used to mask its own paths/trees: every macro vertex received
  // exactly the same depth. Exercise overlapping layers in the real shader.
  gl.uniform1f(gl.getUniformLocation(program,'perspective'),0);
  gl.uniformMatrix3fv(gl.getUniformLocation(program,'rotation'),false,[1,0,0,0,1,0,0,0,1]);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const macro=(z,color)=>quad([[-.002,-.002,z],[.002,-.002,z],[.002,.002,z],[-.002,.002,z]],14,color);
  macro(0,[1,0,0]);macro(.0003,[0,1,0]);macro(.001,[0,0,1]);macro(0,[1,0,0]);
  const macroPixel=new Uint8Array(4);gl.readPixels(128,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,macroPixel);
  checks.push({name:'macro details remain above their base regardless of draw order',passed:macroPixel[2]===255&&macroPixel[0]===0});
  // Different triangulations of overlapping land-use polygons must have the
  // exact same depth at each pixel, including while their scale is changing.
  gl.uniform3fv(gl.getUniformLocation(program,'center'),[.123456,.234567,0]);
  const c=Math.cos(.78),s=Math.sin(.78);gl.uniformMatrix3fv(gl.getUniformLocation(program,'rotation'),false,[1,0,0,0,c,-s,0,s,c]);
  const patch=new Uint8Array(32*32*4);
  for(const lens of ['orthographic','architectural'])for(const zoom of [1,3,5,7.6,15.2,30.4,50,100,249])for(let step=0;step<8;step++){
   gl.uniform1f(gl.getUniformLocation(program,'perspective'),lens==='architectural'?zoom*.415/2.2:0);
   gl.uniform1f(gl.getUniformLocation(program,'zoom'),zoom*(1+step*.000001));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   const points=coords=>coords.map(([x,y])=>[x+.123456,y+.234567,.00035]);
   quad(points([[-2,-2],[2,-2],[2,2],[-2,2]]),0,[1,0,0]);
   quad(points([[0,-2],[2,0],[0,2],[-2,0]]),0,[0,1,0]);
   gl.readPixels(112,112,32,32,gl.RGBA,gl.UNSIGNED_BYTE,patch);
   checks.push({lens,zoom,step,name:'overlapping paint keeps stable ordering during scale changes',passed:patch.every((v,i)=>v===(i%4===1||i%4===3?255:0))});
  }
  const error=gl.getError();gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);gl.getExtension('WEBGL_lose_context')?.loseContext();return {checks,error,completed:checks.every(c=>c.passed)&&error===0};
 });
 report.artifact=artifact;report.shaders=Object.fromEntries(Object.entries(sources).map(([name,source])=>[name,{bytes:Buffer.byteLength(source),sha256:createHash('sha256').update(source).digest('hex')}]));
 await writeFile(out+'/surface-depth.json',JSON.stringify(report,null,2)+'\n');assert(report.completed,JSON.stringify(report.checks.filter(c=>!c.passed)));
 console.log(`PASS ${report.checks.length} raster checks: ground paint and physical occlusion across both lenses and all tilt limits`);
}finally{await browser.close();}
