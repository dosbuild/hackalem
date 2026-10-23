import {beforeEach,describe,it,expect,vi} from 'vitest';
describe('world-owned camera recovery',()=>{
 beforeEach(()=>vi.resetModules());
 const pose={x:-.12,y:.07,yaw:-.3,pitch:.9,zoom:160};
 it('round-trips the useful pose independently for both worlds without storing viewport data',async()=>{
  const {cameraSession}=await import('../src/world/camera-session.js'),values=new Map(),port={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  cameraSession('astana',port).save({...pose,width:1440,height:900});cameraSession('khanate',port).save({...pose,x:.15,zoom:200});
  expect(JSON.parse(values.get('alem:camera'))).toEqual({version:1,pose});
  expect(JSON.parse(values.get('alem:khanate:camera')).pose.x).toBe(.15);
  const returned=cameraSession('astana',port).read();returned.zoom=1;
  expect(cameraSession('astana',port).read()).toEqual(pose);
 });
 it('keeps session memory when persistence is denied and does not accept corrupted saved cameras',async()=>{
  const {cameraSession,readCameraPose}=await import('../src/world/camera-session.js'),denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  expect(cameraSession('astana',denied).read()).toBeNull();cameraSession('astana',denied).save(pose);expect(cameraSession('astana',denied).read()).toEqual(pose);
  for(const damaged of [{...pose,zoom:Infinity},{...pose,zoom:0},{...pose,pitch:2},{...pose,x:100},{...pose,y:'0'},{}])expect(readCameraPose(damaged)).toBeNull();
 });
 it('restores close inspections after a world remount and a fresh session',async()=>{
  const {cameraSession,readCameraPose}=await import('../src/world/camera-session.js'),values=new Map(),port={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const modern={...pose,zoom:518.4},historical={...pose,x:.15,zoom:576};
  cameraSession('astana',port).save(modern);cameraSession('khanate',port).save(historical);
  expect(cameraSession('astana',port).read()).toEqual(modern);expect(cameraSession('khanate',port).read()).toEqual(historical);
  vi.resetModules();const restored=await import('../src/world/camera-session.js');
  expect(restored.cameraSession('astana',port).read()).toEqual(modern);expect(restored.cameraSession('khanate',port).read()).toEqual(historical);
  expect(readCameraPose({...pose,zoom:577})).toBeNull();
 });
 for(const mode of ['astana','khanate'])it(`${mode}: persists an explicitly granted extended camera and headroom below ordinary zoom`,async()=>{
  const {cameraSession,readCameraPose}=await import('../src/world/camera-session.js'),values=new Map(),port={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},extended={...pose,zoom:1800};
  const session=cameraSession(mode,port,2304);session.save(extended,2304);expect(session.read()).toEqual(extended);expect(session.zoomLimit).toBe(2304);
  expect(readCameraPose(extended)).toBeNull();expect(readCameraPose(extended,2304)).toEqual(extended);expect(cameraSession(mode,port).read()).toBeNull();
  session.save(pose,2304);expect(cameraSession(mode,port,2304).read()).toEqual(pose);
  // The ceiling is recovered by read(), including when current zoom is below576.
  const remount=cameraSession(mode,port,2304);expect(remount.read()).toEqual(pose);expect(remount.zoomLimit).toBe(2304);
  vi.resetModules();const fresh=await import('../src/world/camera-session.js'),reloaded=fresh.cameraSession(mode,port,2304);expect(reloaded.read()).toEqual(pose);expect(reloaded.zoomLimit).toBe(2304);
  reloaded.save(pose,576);expect(JSON.parse(values.get(mode==='khanate'?'alem:khanate:camera':'alem:camera'))).toEqual({version:1,pose});
 });
 it('retains extended camera memory when storage is denied and rejects corrupt or excessive ceilings',async()=>{
  const {cameraSession}=await import('../src/world/camera-session.js'),denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}},session=cameraSession('astana',denied,2304),extended={...pose,zoom:2304};
  session.save(extended,2304);const remount=cameraSession('astana',denied,2304);expect(remount.read()).toEqual(extended);expect(remount.zoomLimit).toBe(2304);
  session.save({...pose,zoom:2305},2304);session.save(pose,2305);expect(session.read()).toEqual(extended);
  for(const zoomLimit of [null,0,575,2305,'2304']){
   vi.resetModules();const fresh=await import('../src/world/camera-session.js');expect(fresh.cameraSession('khanate',{getItem:()=>JSON.stringify({version:1,pose,zoomLimit})},2304).read()).toBeNull();
  }
 });

});
