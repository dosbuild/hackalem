/** Shared city materials; identity is geographic and never a performance score. */
export const rgb=hex=>hex.replace('#','').match(/../g).map(v=>parseInt(v,16));
export const blend=(a,b,t)=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t));
export function hash(value){let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export const families={
 esil:{roofs:['719b93','8eaba0','b9c6b4','6e8e91'],walls:['e5e2d2','d5dfd3','dfddcc'],leaves:['789582','95a789','a4b09b'],habit:'avenue'},
 almaty:{roofs:['b27d66','c39478','a79b80','8eaa99'],walls:['e6dac7','d7bea4','e8dfcf'],leaves:['889b7e','a3ae8b','829984'],habit:'orchard'},
 saryarka:{roofs:['929d77','aaa881','89a18d','b69c79'],walls:['e5dfca','d8ccb1','dde2d2'],leaves:['769279','91a385','a6b194'],habit:'grove'},
 baikonur:{roofs:['8d96ae','a0adc0','b39f8b','88a5a0'],walls:['dedfd7','cdd7d5','e5dfd3'],leaves:['7d9a91','96aaa0','aab6ab'],habit:'windbreak'},
 nura:{roofs:['b69c64','c7b183','9da57d','b59b7a'],walls:['e8dfc7','ddd0b1','e0e2d1'],leaves:['94a584','a9b595','849d8b'],habit:'garden'},
};
export function material(props,district,family){
 const seed=hash(props.osm_id),f=families[district]||families.saryarka,t=props.tags||{},industrial=['industrial','warehouse','garages','hangar'].includes(t.building);
 // Mineral pigments stay visible in roofs; a small shared graphite component
 // joins the city without erasing its five geographic material families.
 const roof=blend(rgb(f.roofs[seed%f.roofs.length]),rgb(['74858a','928678','7d918b','ab9176'][seed%4]),.28),wall=rgb(f.walls[(seed>>>5)%f.walls.length]);
 const sourceMaterial=t['building:material'],brick=['brick','red_brick'].includes(sourceMaterial),concrete=['concrete','concrete_panels'].includes(sourceMaterial),wood=sourceMaterial==='wood';
 const familyWall=family==='garden-home'&&seed%3===0?blend(wall,rgb('b89782'),.6):family==='street-block'?blend(wall,rgb('d2c5ae'),.3):family==='modern-tower'?blend(wall,rgb('bfc9c5'),.45):family==='residential-slab'?blend(wall,rgb('c8cdc1'),.4):family==='civic-house'?blend(wall,rgb('e1d1ae'),.3):wall;
 return {seed,roof:industrial?blend(roof,rgb('929c99'),.38):roof,wall:brick?blend(wall,rgb('ad8875'),.7):wood?blend(wall,rgb('b5a080'),.65):concrete?blend(wall,rgb('c4c7bc'),.5):industrial?blend(wall,rgb('b8c0b7'),.5):familyWall,style:seed%7};
}
