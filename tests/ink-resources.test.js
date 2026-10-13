import {describe,it,expect} from 'vitest';
import {createInkPass} from '../src/world/ink-pass.js';

function device({failShader=0,failLink=0,incompleteTarget=0}={}){
 const live=new Set();let shaders=0,programs=0,targets=0,enumValue=1;
 const create=kind=>{const object={kind,index:kind==='Shader'?++shaders:kind==='Program'?++programs:0};live.add(object);return object;};
 const remove=object=>expect(live.delete(object)).toBe(true);
 const api={getShaderParameter:s=>s.index!==failShader,getShaderInfoLog:()=> 'compile failed',getProgramParameter:p=>p.index!==failLink,getProgramInfoLog:()=> 'link failed',checkFramebufferStatus:()=>++targets===incompleteTarget?gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:gl.FRAMEBUFFER_COMPLETE};
 for(const kind of ['Shader','Program','Texture','Framebuffer']){api['create'+kind]=()=>create(kind);api['delete'+kind]=remove;}
 const gl=new Proxy(api,{get(target,key){if(key in target)return target[key];return target[key]=/^[A-Z_0-9]+$/.test(key)?enumValue++:()=>{};}});
 return {gl,live};
}
describe('ink resolve recovery',()=>{
 it('releases both programs and every partial shader when either pass cannot compile or link',()=>{
  for(const fault of [{failShader:1},{failShader:2},{failShader:3},{failShader:4},{failLink:1},{failLink:2}]){const d=device(fault);expect(()=>createInkPass(d.gl)).toThrow();expect(d.live.size).toBe(0);}
 });
 it('falls back if either render target is incomplete and releases its retained allocations',()=>{
  for(const incompleteTarget of [1,2]){const d=device({incompleteTarget}),ink=createInkPass(d.gl);expect(ink.begin(320,240)).toBe(false);expect(ink.diagnostics().inkEnabled).toBe(false);ink.destroy();expect(d.live.size).toBe(0);}
 });
 it('resizes the same targets in place and accounts for and releases the final edge-mask image',()=>{
  const d=device(),ink=createInkPass(d.gl);expect(ink.begin(320,240)).toBe(true);const resources=d.live.size;expect(ink.begin(1000,800)).toBe(true);expect(d.live.size).toBe(resources);expect(ink.diagnostics()).toMatchObject({inkEnabled:true,gpuInkBytes:1000*800*16});ink.destroy();expect(d.live.size).toBe(0);
 });
});
