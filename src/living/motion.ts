import type { DistrictId } from '../domain/types';
import type { LivingStory } from './appeals';
import { STORIES, STORY_BY_ID } from './appeals';
export type Point=readonly [number,number];
export const POCKETS:Record<DistrictId,{center:Point;entrance:Point;label:Point;place:string;color:string}>={
  almaty:{center:[230,742],entrance:[108,635],label:[174,541],place:'Кирпичная улица',color:'#cfaaa0'},
  saryarka:{center:[610,783],entrance:[-45,808],label:[434,633],place:'Мозаичный двор',color:'#aab98e'},
  esil:{center:[780,565],entrance:[320,469],label:[817,469],place:'Площадь у реки',color:'#90b4ac'},
  baikonur:{center:[1300,867],entrance:[1705,735],label:[1315,665],place:'Остановка и мастерская',color:'#aaa9bd'},
  nura:{center:[1080,568],entrance:[1230,521],label:[1480,432],place:'Школа и новые дома',color:'#cdbb92'},
};
export interface Walker {key:number;storyId:string;slot:number;from:Point;point:Point;phase:'arriving'|'walking'|'staying'|'leaving';started:number;nextStoryId?:string;}
/** Feet sit on the illustrated paving, never on the shelter roof or planters. */
const spots:Record<DistrictId,readonly Point[]>={
  almaty:[[155,717],[238,735],[280,752],[202,754],[300,795]],
  saryarka:[[550,765],[650,790],[580,811],[720,783],[480,795]],
  esil:[[740,544],[825,563],[685,565],[880,589],[780,607]],
  nura:[[1060,548],[1125,565],[1000,575],[950,550],[1075,610]],
  baikonur:[[1205,860],[1300,887],[1105,839],[1350,895],[1450,904]],
};
const paths:Record<DistrictId,readonly Point[]>={
  almaty:[POCKETS.almaty.entrance,[145,722],[220,756]],
  saryarka:[POCKETS.saryarka.entrance,[240,813],[485,811]],
  esil:[POCKETS.esil.entrance,[470,519],[665,553]],
  nura:[POCKETS.nura.entrance,[1150,546],[1060,557]],
  baikonur:[POCKETS.baikonur.entrance,[1538,735],[1538,853],[1420,897]],
};
export function walkPath(story:LivingStory,from:Point,to:Point,leaving:boolean):string {
  const entrance=entranceFor(story.districtId),fromEntrance=from[0]===entrance[0]&&from[1]===entrance[1];
  const route=leaving?[from,...[...paths[story.districtId]].reverse()]:fromEntrance?[...paths[story.districtId],to]:[from,to];
  return `path('M ${route.map(p=>`${p[0]} ${p[1]}`).join(' L ')}')`;
}
export const entranceFor=(district:DistrictId):Point=>paths[district][0]!;
export function positionFor(story:LivingStory,slot:number,narrow:boolean,committed:boolean):Point {
  const point=spots[story.districtId][narrow?slot%5:Math.floor(slot/5)%2]!;
  if(!committed)return point;
  const activity:Record<DistrictId,Point>={almaty:[170,723],saryarka:[552,755],esil:[756,529],nura:[1110,552],baikonur:[1225,852]};
  const destination=activity[story.districtId];
  return [destination[0]+(slot%5)*16,destination[1]+(slot%3)*7];
}
export function createWalkers(districtId:DistrictId,narrow:boolean,now=0):Walker[] {
  const order:DistrictId[]=['nura','saryarka','almaty','baikonur','esil'];
  return Array.from({length:narrow?5:10},(_,slot)=>{
    const d=narrow?districtId:order[slot%5]!;
    const id=narrow?(['M7','M1','M8','M11','M4'] as const)[slot]!:slot<5?({nura:'M7',saryarka:'M4',almaty:'M13',baikonur:'M14',esil:'M1'} as const)[d]:({nura:'M8',saryarka:'M9',almaty:'M7',baikonur:'M3',esil:'M4'} as const)[d];
    const story=STORIES.find(s=>s.districtId===d&&s.initiativeId===id)!;
    const point=positionFor(story,slot,narrow,false);
    return {key:slot,storyId:story.id,slot,from:point,point,phase:'staying' as const,started:now};
  });
}
/** First exit at 8s, then 10s. Four seconds to a real entrance; next person walks out of it. */
export function nextReplacement(walkers:readonly Walker[],pinnedId:string|null,sequence:number,_districtId:DistrictId,_narrow:boolean,now:number):Walker[] {
  const eligible=walkers.filter(w=>w.storyId!==pinnedId&&w.phase==='staying');
  if(!eligible.length)return [...walkers];
  const target=eligible[sequence%eligible.length]!;
  return walkers.map(w=>w.key===target.key?{...w,from:w.point,point:entranceFor(STORY_BY_ID[w.storyId]!.districtId),phase:'leaving',started:now}:w);
}
export function arriveReplacement(walkers:readonly Walker[],departed:Walker,sequence:number,districtId:DistrictId,narrow:boolean,now:number):Walker[] {
  const current=walkers.find(w=>w.key===departed.key);
  if(!current||current.phase!=='leaving')return [...walkers];
  const district=narrow?districtId:STORY_BY_ID[departed.storyId]!.districtId;
  const pool=STORIES.filter(s=>s.districtId===district&&!walkers.some(w=>w.storyId===s.id||w.nextStoryId===s.id));
  const story=departed.nextStoryId?STORY_BY_ID[departed.nextStoryId]!:pool[sequence%pool.length]!;
  const entrance=entranceFor(story.districtId);
  return walkers.map(w=>w.key===departed.key?{key:w.key+100,storyId:story.id,slot:w.slot,from:entrance,point:entrance,phase:'arriving',started:now}:w);
}
