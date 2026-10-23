import { AREA_IDS, DISTRICT_IDS, INDICATOR_IDS, INITIATIVE_IDS } from './types';

const object = (v:unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v:unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const exactKeys = (v:Record<string,unknown>, ids:readonly string[]) => Object.keys(v).length === ids.length && ids.every(k => k in v);
const normalized = (values:number[]) => Math.abs(values.reduce((a,b) => a+b,0)-1) < 1e-12;

/** Fails at startup on a broken dataset; the independent source fixture checks exact values. */
export function validateScenario(input:unknown): readonly string[] {
  if (!object(input)) return ['scenario'];
  const errors:string[] = [];
  const {baseline, districts, weights, catalogue, rules, synergies, incompatibilities} = input;
  if (!object(rules) || rules.budget !== 100 || rules.decisionCount !== 5 || rules.maxPerArea !== 2 || rules.horizon !== 8) errors.push('rules');
  if (!object(baseline) || !exactKeys(baseline,DISTRICT_IDS)) errors.push('baseline.districts');
  for (const d of DISTRICT_IDS) {
    const values = object(baseline) ? baseline[d] : null;
    if (!object(values) || !exactKeys(values,INDICATOR_IDS) || Object.values(values).some(v => !finite(v) || v < 0 || v > 100)) errors.push(`baseline.${d}`);
  }
  if (!object(weights) || !exactKeys(weights,INDICATOR_IDS) || Object.values(weights).some(v => !finite(v) || v < 0 || v > 1) || !normalized(Object.values(weights) as number[])) errors.push('weights');
  if (!Array.isArray(districts) || districts.length !== 5 || !DISTRICT_IDS.every(id => districts.filter(d => object(d) && d.id === id).length === 1)
    || districts.some(d => !object(d) || typeof d.name !== 'string' || !finite(d.populationShare) || d.populationShare <= 0 || d.populationShare > 1)
    || !normalized(districts.map(d => d.populationShare as number))) errors.push('districts');
  if (!Array.isArray(catalogue) || catalogue.length !== 14 || !INITIATIVE_IDS.every(id => catalogue.filter(m => object(m) && m.id === id).length === 1)) errors.push('catalogue.ids');
  if (Array.isArray(catalogue)) for (const m of catalogue) {
    if (!object(m)) { errors.push('catalogue.entry'); continue; }
    const city = ['M2','M6','M12','M14'].includes(String(m.id));
    if (!AREA_IDS.includes(m.area as typeof AREA_IDS[number]) || m.scope !== (city ? 'citywide' : 'district') || typeof m.name !== 'string'
      || !finite(m.cost) || m.cost <= 0 || !finite(m.lag) || !Number.isInteger(m.lag) || m.lag < 0 || m.lag > 8
      || !object(m.effects) || !Object.keys(m.effects).length || Object.entries(m.effects).some(([k,v]) => !INDICATOR_IDS.includes(k as typeof INDICATOR_IDS[number]) || !finite(v))) errors.push(`catalogue.${String(m.id)}`);
  }
  for (const [name, entries] of [['synergies',synergies],['incompatibilities',incompatibilities]] as const) {
    if (!Array.isArray(entries) || entries.length !== 3) { errors.push(name); continue; }
    for (const entry of entries) {
      if (!object(entry) || !Array.isArray(entry.ids) || entry.ids.length !== 2 || entry.ids[0] === entry.ids[1] || entry.ids.some(id => !INITIATIVE_IDS.includes(id))) { errors.push(name); continue; }
      if (name === 'synergies') {
        if (!INDICATOR_IDS.includes(entry.indicatorId as typeof INDICATOR_IDS[number]) || !finite(entry.amount)
          || ['M2','M6','M12','M14'].includes(entry.ids[0])) errors.push(name);
      } else if (entry.scope !== 'plan' && entry.scope !== 'district') errors.push(name);
    }
  }
  return errors;
}
