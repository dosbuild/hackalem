/** Read public same-frame diagnostics; application state / events stay untouched. */
export async function installAnchorSampler(context){
 await context.addInitScript(()=>{
  window.__cameraAudit=[];window.__firstCanvas=null;
  const number=value=>value===undefined||value===''?null:Number(value);
  const parse=(value,fallback)=>{try{return JSON.parse(value);}catch{return fallback;}};
  const tick=()=>{
   const map=document.querySelector('[data-testid=city-map]');
   if(map?.dataset.camera&&map.dataset.renderCamera){
    const c=parse(map.dataset.camera,null),r=parse(map.dataset.renderCamera,null);
    if(c&&r){
     if(!window.__firstCanvas)window.__firstCanvas=map.querySelector('.alem-city');
     const resident=document.querySelector('#residents'),origins=parse(map.dataset.interventions,[]),sites=parse(map.dataset.programSites,[]);
     window.__cameraAudit.push({world:document.documentElement.dataset.mode,c,r,frame:number(map.dataset.frame),renderFrame:number(map.dataset.renderFrame),annotationFrame:number(resident?.dataset.frame),
      resident:map.dataset.resident?{id:map.dataset.resident,actors:parse(map.dataset.actors,[]),anchor:map.dataset.anchor,position:parse(map.dataset.residentPosition,null),x:number(map.dataset.residentX),y:number(map.dataset.residentY)}:null,
      objects:[...document.querySelectorAll('.map-project')].map(el=>({id:el.dataset.initiative,district:el.dataset.district,site:el.dataset.site,child:el.dataset.child==='true',frame:number(el.dataset.frame),origin:(el.dataset.child==='true'?sites.find(item=>item.key===el.dataset.site):origins.find(item=>item.key===`${el.dataset.initiative}:${el.dataset.district}`))?.origin??null,x:number(el.dataset.anchorX),y:number(el.dataset.anchorY)})),
      sameCanvas:window.__firstCanvas===map.querySelector('.alem-city')});
    }
   }
   requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 });
}
