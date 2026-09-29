import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ExternalAttachments from './ExternalAttachments';
it('shows one shared external source only for its explicitly mapped question identities',()=>{
 const items=[{id:'gear',label:'Getriebe',image:'assets/gear.png',filename:'drawing.pdf',source_page:1,sha256:'a'.repeat(64),question_numbers:['U1','U2']}];
 for(const number of ['U1','U2'])expect(renderToStaticMarkup(<ExternalAttachments items={items} number={number}/>)).toContain('drawing.pdf');
 expect(renderToStaticMarkup(<ExternalAttachments items={items} number="U3"/>)).toBe('');
 expect(renderToStaticMarkup(<ExternalAttachments number="U1"/>)).toBe('');
});
