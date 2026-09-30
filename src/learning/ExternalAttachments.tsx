import {fullPdfUrl} from '../segmented/fullPdf';
import presentations from '../../public/data/attachment_presentations.json';
import type {ExternalAttachment} from './modules';
import {asset} from '../segmented/types';
export default function ExternalAttachments({items,number}:{items?:ExternalAttachment[];number:string}){
 const matches=items?.filter(item=>item.question_numbers.includes(number))??[];
 if(!matches.length)return null;
 return <section className="external-attachments" aria-label="Zusätzliche Originalanlagen">{matches.map(item=>{const image=presentations.find(p=>p.source_image===item.image&&p.source_sha256===item.sha256)?.display_image??item.image;return <details key={item.id}><summary>{item.label}</summary><p>Originalquelle: {item.filename} · Seite {item.source_page}</p><a href={fullPdfUrl({source:item.filename,sha256:item.sha256,page:item.source_page})??asset(image)} target="_blank" rel="noreferrer">Vollständige Originalanlage öffnen ↗</a><img style={{maxWidth:'100%',height:'auto'}} src={asset(image)} alt={item.label}/></details>})}</section>;
}
