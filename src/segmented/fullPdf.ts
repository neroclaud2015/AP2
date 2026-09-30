import published from '../../public/data/full_pdf_sources.json';
interface PdfDocument {path:string;sha256:string;pages:number;bytes:number;filename:string}
interface PdfIndex {documents:Record<string,PdfDocument>;aliases:Record<string,string>;questions:Record<string,{question:string;solution:string;solution_page:number}>}
const index=published as PdfIndex;
/** Transport availability is separate from immutable segmentation/test snapshots. */
export function fullPdfUrl({source,sha256,questionId,kind='question',page=1}:{source?:string;sha256?:string;questionId?:string;kind?:'question'|'solution';page?:number}):string|undefined {
 const digest=sha256||(source?index.aliases[source]:undefined)||(!source&&questionId?index.questions[questionId]?.[kind]:undefined);
 const doc=digest?index.documents[digest]:undefined;
 if(!doc||!Number.isInteger(page)||page<1||page>doc.pages)return undefined;
 return import.meta.env.BASE_URL+doc.path+'#page='+page;
}
export function questionPdfUrl(q:{source_pdf:string;question_id:string;source_page:number;source_sha256?:string;source_pdf_sha256?:string},page=q.source_page,sha256?:string){return fullPdfUrl({source:q.source_pdf,sha256:sha256??q.source_sha256??q.source_pdf_sha256,questionId:q.question_id,page});}
