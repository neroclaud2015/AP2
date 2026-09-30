import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ClassificationEditor,{ClassificationForm} from './ClassificationEditor';
import type {InventoryQuestion,Taxonomy} from './model';
const state=vi.hoisted(()=>({data:undefined as unknown}));
vi.mock('./useBankData',()=>({useBankData:()=>({data:state.data,error:'',save:vi.fn()})}));
const question={question_id:'example',question_source_revision:'revision-current'} as InventoryQuestion;
const taxonomy:Taxonomy={version:'v1',nodes:[{id:'new-knowledge',kind:'knowledge',label:'Neues Wissensgebiet',parent_id:null,active:true,aliases:[],version:'v1'},{id:'new-type',kind:'question_type',label:'Neuer Aufgabentyp',parent_id:null,active:true,aliases:[],version:'v1'}]};
it('starts collapsed and does not load the form until requested',()=>{
 const html=renderToStaticMarkup(<ClassificationEditor questionId="example"/>);
 expect(html).toContain('Klassifikation bearbeiten');expect(html).not.toMatch(/<details[^>]*\bopen/);expect(html).not.toContain('<fieldset');
});
it('renders taxonomy-provided knowledge and primary/secondary controls',()=>{
 state.data={inventory:[question],taxonomy,classifications:[],overrides:[]};
 const html=renderToStaticMarkup(<ClassificationForm questionId="example"/>);
 expect(html).toContain('Neues Wissensgebiet');expect(html).toContain('Neuer Aufgabentyp');expect(html).toContain('Primärer Aufgabentyp');expect(html).toContain('Weitere Aufgabentypen');
});
it('prevents a historical training snapshot from confirming the current source',()=>{
 state.data={inventory:[question],taxonomy,classifications:[],overrides:[]};
 const html=renderToStaticMarkup(<ClassificationForm questionId="example" expectedSourceRevision="revision-old"/>);
 expect(html).toContain('älteren Aufgabenstand');expect(html).toMatch(/<fieldset disabled/);expect(html).toMatch(/<button[^>]*disabled/);
});
