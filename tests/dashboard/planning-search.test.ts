import {describe,it,expect} from 'vitest';
import {evaluatePlan} from '../../src/domain/evaluate';
import {findBestCompletion,findPlanRepair,hasCompletion} from '../../src/domain/planning-search';
import {visitCompletions} from '../../src/domain/search-kernel';
import type {Plan} from '../../src/domain/types';
const school:Plan=[{scope:'district',initiativeId:'M7',districtId:'nura'}];
describe('canonical exhaustive planning search',()=>{
 it('finds a completion that preserves every existing district and initiative',()=>{const result=findBestCompletion(school)!;expect(result.plan).toContainEqual(school[0]);expect(result.added).toHaveLength(4);expect(evaluatePlan(result.plan)).toMatchObject({ok:true,result:{finalScore:result.score}});});
 it('checks stranded plans without spending or mutating them',()=>{const dead:Plan=[{scope:'district',initiativeId:'M3',districtId:'nura'},{scope:'district',initiativeId:'M13',districtId:'esil'},{scope:'district',initiativeId:'M5',districtId:'almaty'}];expect(hasCompletion(dead)).toBe(false);expect(dead).toHaveLength(3);const repair=findPlanRepair(dead)!;expect(repair.removed).toHaveLength(1);expect(repair.preserved).toBe(2);expect(hasCompletion(repair.plan)).toBe(true);});
 it('enumerates the complete valid landscape with canonical score parity',()=>{let count=0;visitCompletions([], (plan,score)=>{count++;if(count%5000===0){const canonical=evaluatePlan(plan);expect(canonical.ok).toBe(true);if(canonical.ok)expect(score()).toBeCloseTo(canonical.result.finalScore,12);}});expect(count).toBe(694395);});
 it('rejects duplicate decisions and counts a complete valid plan as its own completion',()=>{expect(hasCompletion([...school,...school])).toBe(false);const result=findBestCompletion(school)!;expect(findBestCompletion(result.plan)).toMatchObject({plan:result.plan,score:result.score,added:[]});});
});
