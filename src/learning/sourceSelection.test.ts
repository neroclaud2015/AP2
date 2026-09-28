import {describe,it,expect} from 'vitest';
import {moduleSupportsSources,toggleSourceExam} from './sourceExams';
describe('explicit multi-year selection',()=>{
 const years=['2017-sommer','2017-18-winter','2018-sommer'];
 it('starts individual selection by excluding an unchecked all-year choice',()=>{expect(toggleSourceExam('all',years,'2018-sommer')).toEqual(years.slice(0,2));});
 it('allows empty selection and adding/removing multiple years without mutating input',()=>{const selected=['2017-sommer'];expect(toggleSourceExam(selected,years,'2017-18-winter')).toEqual(years.slice(0,2));expect(selected).toEqual(['2017-sommer']);expect(toggleSourceExam(selected,years,'2017-sommer')).toEqual([]);});
 it('prevents empty, unknown or partially unavailable module combinations',()=>{expect(moduleSupportsSources('all',years.slice(0,2))).toBe(true);expect(moduleSupportsSources([],years)).toBe(false);expect(moduleSupportsSources(['missing'],years)).toBe(false);expect(moduleSupportsSources(years,years.slice(0,2))).toBe(false);expect(moduleSupportsSources(years.slice(0,2),years)).toBe(true);});
});
