import {describe,it,expect} from 'vitest';
import {readRoute,routeUrl} from './modules';
import {parseSourceExams,sourceLabel} from './sourceExams';
describe('module source filter routes and labels',()=>{
 it('defaults legacy Tests URLs to all and preserves all/single/multiple through refresh',()=>{
  expect(readRoute('?view=tests&exam=2017-18-winter').sourceExams).toBe('all');
  for(const years of ['all','2017-sommer','2017-18-winter','2017-sommer,2017-18-winter']){
   const route=readRoute('?view=tests&module=arbeitsplanung&years='+years);
   expect(readRoute(routeUrl(route,'https://example.test/').search)).toEqual(route);
  }
 });
 it('does not silently widen invalid years and deduplicates multi-select',()=>{
  expect(parseSourceExams('missing')).toEqual(['missing']);expect(parseSourceExams('')).toEqual([]);
  expect(parseSourceExams('a,b,a')).toEqual(['a','b']);
 });
 it('keeps card labels bounded for 15+ exam seasons',()=>{
  expect(sourceLabel('all',15,id=>id)).toBe('Alle verfügbaren Jahrgänge · 15 Prüfungen');
  expect(sourceLabel(Array.from({length:15},(_,i)=>String(i)),15,id=>id)).toBe('15 Jahrgänge ausgewählt');
  expect(sourceLabel(['winter'],1,()=> 'Winter 2017/18')).toBe('Winter 2017/18');
 });
});
