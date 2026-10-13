import {it,expect} from 'vitest';
import {createProjectLabelSizes,placeProjectLabel} from '../src/world/label-layout';

const button=(width:number,height:number)=>{
 const state={width,height,reads:0};
 return {state,element:{get offsetWidth(){state.reads++;return state.width;},get offsetHeight(){state.reads++;return state.height;}}};
};

it('remeasures before placement after a viewport or window resize',()=>{
 const window=new EventTarget(),cache=createProjectLabelSizes(window),label=button(120,28);
 expect(cache.read(label.element)).toEqual({width:120,height:28});
 label.state.width=180;
 cache.invalidate();
 const size=cache.read(label.element),placement=placeProjectLabel({x:190,y:260},{x:310,y:290},size,{width:390,height:667},[])!;
 expect(size).toEqual({width:180,height:28});expect(placement.box.right-placement.box.left).toBe(180);expect(placement.box.right).toBeLessThanOrEqual(382);
 label.state.height=36;window.dispatchEvent(new Event('resize'));
 expect(cache.read(label.element)).toEqual({width:180,height:36});cache.destroy();
});

it('does not retain a hidden or partial measurement and follows replacement buttons',()=>{
 const cache=createProjectLabelSizes(new EventTarget()),old=button(0,28);
 expect(cache.read(old.element)).toEqual({width:0,height:28});old.state.width=170;old.state.height=0;
 expect(cache.read(old.element)).toEqual({width:170,height:0});old.state.height=28;
 expect(cache.read(old.element)).toEqual({width:170,height:28});
 cache.read(old.element);expect(old.state.reads).toBe(6);
 const next=button(230,32);expect(cache.read(next.element)).toEqual({width:230,height:32});cache.destroy();
});

it('refreshes integer geometry when delayed fonts become ready or finish loading',async()=>{
 let ready!:()=>void;const fonts=Object.assign(new EventTarget(),{ready:new Promise<void>(resolve=>{ready=resolve;})});
 const cache=createProjectLabelSizes(new EventTarget(),fonts),label=button(131,29);
 expect(cache.read(label.element)).toEqual({width:131,height:29});label.state.width=153;ready();await fonts.ready;
 expect(cache.read(label.element)).toEqual({width:153,height:29});label.state.width=176;label.state.height=30;fonts.dispatchEvent(new Event('loadingdone'));
 expect(cache.read(label.element)).toEqual({width:176,height:30});cache.destroy();
});

it('releases listeners and ignores a font-ready callback after destruction',async()=>{
 class TrackedTarget extends EventTarget {
  listeners=0;
  override addEventListener(type:string,callback:EventListenerOrEventListenerObject|null,options?:AddEventListenerOptions|boolean){this.listeners++;super.addEventListener(type,callback,options);}
  override removeEventListener(type:string,callback:EventListenerOrEventListenerObject|null,options?:EventListenerOptions|boolean){this.listeners--;super.removeEventListener(type,callback,options);}
 }
 let ready!:()=>void;const window=new TrackedTarget(),fonts=Object.assign(new TrackedTarget(),{ready:new Promise<void>(resolve=>{ready=resolve;})});
 const cache=createProjectLabelSizes(window,fonts),label=button(100,28);cache.read(label.element);cache.destroy();
 expect(window.listeners).toBe(0);expect(fonts.listeners).toBe(0);ready();await fonts.ready;
 label.state.width=150;expect(cache.read(label.element).width).toBe(150);label.state.width=180;expect(cache.read(label.element).width).toBe(180);
 const mounted=createProjectLabelSizes(window,fonts);expect(mounted.read(label.element).width).toBe(180);expect(window.listeners).toBe(1);mounted.destroy();expect(window.listeners).toBe(0);
});
