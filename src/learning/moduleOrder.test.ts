import {describe,it,expect} from 'vitest';
import {MODULES} from './modules';
import {moduleEntries,MODULE_ORDER} from './moduleOrder';
const order=['arbeitsplanung','funktionsanalyse','wiso'];
describe('explicit module display order',()=>{
 for(const exam of ['2017-sommer','2017-18-winter','2018-sommer','2018-19-winter'])it(exam,()=>{
  const shuffled=[...MODULES].reverse().filter(m=>m.examId===exam);
  const entries=moduleEntries(shuffled,exam);
  expect(entries.map(e=>e.slug)).toEqual(order);
  if(exam==='2018-sommer'){
   expect(entries.slice(0,2).every(e=>!e.config)).toBe(true);
   expect(entries.slice(0,2).map(e=>e.reason)).toEqual(['Fehlende Stückliste / Anlage','Fehlende Stückliste / Anlage']);
   expect(entries[2].config?.slug).toBe('wiso');
  }else expect(entries.every(e=>e.config)).toBe(true);
 });
 it('keeps test cards ordered regardless of pool/registration order',()=>{
  expect(moduleEntries([...MODULES].reverse()).map(e=>e.slug)).toEqual(order);
  expect(MODULE_ORDER.arbeitsplanung).toBeLessThan(MODULE_ORDER.funktionsanalyse);
  expect(MODULE_ORDER.funktionsanalyse).toBeLessThan(MODULE_ORDER.wiso);
 });
});
