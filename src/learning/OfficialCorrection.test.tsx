import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import OfficialCorrection from './OfficialCorrection';

describe('official source correction',()=>{
 it('is bound to the full question identity, never a generic U1',()=>{
  expect(renderToStaticMarkup(<OfficialCorrection questionId="2020-21-wiso-p4-U1"/>)).toContain('4 Punkten');
  for(const id of ['U1','2020-ap-p16-U1','2020-21-ap-p16-U1','2020-21-wiso-p6-U2'])expect(renderToStaticMarkup(<OfficialCorrection questionId={id}/>)).toBe('');
 });
 it('links the original dated notice and source image without guessing a numeric answer',()=>{
  const html=renderToStaticMarkup(<OfficialCorrection questionId="2020-21-wiso-p4-U1"/>);
  expect(html).toContain('2020-12-01');expect(html).toContain('notice.pdf#page=1');expect(html).toContain('page-1.png');expect(html).toContain('nicht eindeutig lösbar');
 });
});
