import {it,expect} from 'vitest';
import {readRoute,routeUrl} from '../learning/modules';
it('round-trips WiSo topic routes and removes topic from unrelated routes',()=>{const route=readRoute('?view=wiso&topic=arbeitsvertrag');expect(route.view).toBe('wiso');expect(route.wisoTopicId).toBe('arbeitsvertrag');expect(routeUrl(route,'https://example.test/').searchParams.get('topic')).toBe('arbeitsvertrag');expect(routeUrl({...route,view:'start'},'https://example.test/?topic=old').searchParams.has('topic')).toBe(false);expect(readRoute('?view=wiso-review').view).toBe('wiso-review')});
