import type { DistrictId, Indicators, Initiative, InitiativeId, IndicatorMatrix, IndicatorId } from './types';
import { freeze } from './immutable';
import { validateScenario } from './scenario-validation';

export const SCENARIO_VERSION = 'astana-education-1';
export const RULES = freeze({ budget: 100, decisionCount: 5, maxPerArea: 2, horizon: 8 });
export const DISTRICTS: readonly Readonly<{ id: DistrictId; name: string; populationShare: number }>[] = freeze([
  { id: 'esil', name: 'Есиль', populationShare: .27 },
  { id: 'almaty', name: 'Алматы', populationShare: .24 },
  { id: 'saryarka', name: 'Сарыарка', populationShare: .20 },
  { id: 'baikonur', name: 'Байконур', populationShare: .13 },
  { id: 'nura', name: 'Нура', populationShare: .16 },
]);
export const BASELINE: IndicatorMatrix = freeze({
  esil:    { T1:45, T2:62, E1:68, E2:72, S1:48, S2:55, B1:78, B2:60, C1:75, C2:70 },
  almaty:  { T1:40, T2:75, E1:50, E2:55, S1:60, S2:65, B1:62, B2:52, C1:50, C2:60 },
  saryarka:{ T1:50, T2:70, E1:42, E2:40, S1:62, S2:68, B1:58, B2:55, C1:45, C2:55 },
  baikonur:{ T1:52, T2:68, E1:55, E2:50, S1:58, S2:60, B1:52, B2:58, C1:55, C2:58 },
  nura:    { T1:55, T2:40, E1:45, E2:65, S1:38, S2:35, B1:55, B2:50, C1:60, C2:50 },
});
export const WEIGHTS: Indicators = freeze({ T1:.10, T2:.10, E1:.09, E2:.11, S1:.11, S2:.11, B1:.09, B2:.09, C1:.10, C2:.10 });
export const CATALOGUE: readonly Initiative[] = freeze([
  { id:'M1', area:'transport', name:'Выделенные автобусные полосы', scope:'district', cost:18, lag:2, effects:{T1:6,T2:9} },
  { id:'M2', area:'transport', name:'Адаптивные светофоры', scope:'citywide', cost:22, lag:2, effects:{T1:4,B2:3} },
  { id:'M3', area:'transport', name:'Строительство или расширение LRT', scope:'district', cost:30, lag:4, effects:{T1:16,T2:20,E2:4} },
  { id:'M4', area:'environment', name:'Парк или сквер', scope:'district', cost:15, lag:2, effects:{E1:12,E2:3,B1:2} },
  { id:'M5', area:'environment', name:'Переход частных домов на чистое топливо', scope:'district', cost:25, lag:3, effects:{E2:14,C1:4} },
  { id:'M6', area:'environment', name:'Озеленение и ветрозащитные посадки', scope:'citywide', cost:20, lag:4, effects:{E1:5,E2:3} },
  { id:'M7', area:'social', name:'Модульная школа и детский сад', scope:'district', cost:24, lag:3, effects:{S1:16} },
  { id:'M8', area:'social', name:'Семейная поликлиника', scope:'district', cost:20, lag:3, effects:{S2:14} },
  { id:'M9', area:'social', name:'Спортивные пространства во дворах', scope:'district', cost:10, lag:1, effects:{S1:3,S2:3,B1:3} },
  { id:'M10', area:'safety', name:'Освещение и камеры', scope:'district', cost:12, lag:1, effects:{B1:12,B2:2} },
  { id:'M11', area:'safety', name:'Безопасные переходы и школьные зоны', scope:'district', cost:10, lag:1, effects:{B2:12,T1:-2} },
  { id:'M12', area:'municipal', name:'Единая платформа обращений жителей', scope:'citywide', cost:14, lag:1, effects:{C2:5} },
  { id:'M13', area:'municipal', name:'Модернизация тепловых и водопроводных сетей', scope:'district', cost:28, lag:4, effects:{C1:18,E2:2} },
  { id:'M14', area:'municipal', name:'Аварийные бригады и раннее предупреждение', scope:'citywide', cost:16, lag:1, effects:{C1:5,C2:2} },
]);
export const INITIATIVES: Readonly<Record<InitiativeId, Initiative>> = freeze(Object.fromEntries(CATALOGUE.map(item => [item.id, item])) as Record<InitiativeId, Initiative>);
export const INCOMPATIBILITIES: readonly Readonly<{ ids: readonly [InitiativeId, InitiativeId]; scope: 'plan' | 'district' }>[] = freeze([
  { ids:['M1','M3'], scope:'plan' }, { ids:['M4','M7'], scope:'district' }, { ids:['M5','M13'], scope:'district' },
]);
export const SYNERGIES: readonly Readonly<{ ids: readonly [InitiativeId, InitiativeId]; indicatorId: IndicatorId; amount: number }>[] = freeze([
  { ids:['M1','M2'], indicatorId:'T1', amount:2 },
  { ids:['M10','M12'], indicatorId:'B1', amount:2 },
  { ids:['M5','M6'], indicatorId:'E2', amount:2 },
]);

const datasetIssues = validateScenario({ baseline:BASELINE, districts:DISTRICTS, weights:WEIGHTS, catalogue:CATALOGUE, rules:RULES, synergies:SYNERGIES, incompatibilities:INCOMPATIBILITIES });
if (datasetIssues.length) throw new Error(`Invalid scenario dataset: ${datasetIssues.join(', ')}`);
