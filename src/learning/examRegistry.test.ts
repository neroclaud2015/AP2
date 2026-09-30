import {describe,it,expect} from 'vitest';
import {examSessions,yearSelectionLabel} from './examRegistry';
describe('registry-driven years',()=>{
 it('adds and removes a season without UI constants',()=>{const modules=[{examId:'2017-sommer'},{examId:'2026-27-winter'}];expect(examSessions(modules).map(x=>x.label)).toEqual(['Sommer 2017','Winter 2026/27']);expect(examSessions(modules.slice(0,1))).toHaveLength(1);});
 it('deduplicates modules and uses bounded labels for twenty years',()=>{const years=examSessions(Array.from({length:25},(_,i)=>({examId:`${2000+i}-sommer`})));expect(yearSelectionLabel('all',years)).toBe('Alle Jahre');expect(yearSelectionLabel(years.map(x=>x.id),years)).toBe('25 Jahrgänge ausgewählt');expect(yearSelectionLabel([years[0].id],years)).toBe('Sommer 2000');expect(yearSelectionLabel([],years)).toBe('Keine ausgewählt');});
});
