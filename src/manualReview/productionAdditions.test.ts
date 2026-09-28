import {it,expect} from 'vitest';
import registry from '../../public/data/source_registry.json';
import {productionAdditions} from './productionAdditions';
const ready={examId:'2017-sommer',slug:'arbeitsplanung',segmentedPath:'data/2017_sommer_arbeitsplanung_segmented.json',answersPath:'data/2017_sommer_arbeitsplanung_answers.json',solutionsPath:'data/2017_sommer_arbeitsplanung_u_solutions.json'};
it('ignores registrations until both sources are production; rejects duplicate identities',()=>{expect(productionAdditions(registry,[{...ready,examId:'2018-19-winter'}],[])).toEqual([]);expect(productionAdditions(registry,[ready],[])).toEqual([ready]);expect(()=>productionAdditions(registry,[ready,ready],[])).toThrow();expect(()=>productionAdditions(registry,[ready],[ready])).toThrow();});
