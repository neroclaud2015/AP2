import originalNotices from '../../public/data/official_corrections.json';
import overnightNotices from '../../public/data/official_corrections_overnight.json';
const notices=[...originalNotices,...overnightNotices];
import {asset} from '../segmented/types';

/** Render only beside revealed official solutions, never in an active exam. */
export default function OfficialCorrection({questionId}:{questionId:string}) {
 const matching=notices.filter(n=>n.question_id===questionId);
 if(!matching.length)return null;
 return <aside className="official-correction">{matching.map(n=><div key={n.source_sha256}>
  <h4>{n.title}</h4><p>{n.text}</p>
  <details><summary>Offizielle Änderungsmitteilung ansehen</summary>
   <img className="u-solution-image" src={asset(n.source_image)} alt={n.title}/>
   <a href={asset(n.source_pdf)+'#page='+n.source_page} target="_blank" rel="noreferrer">Originalmitteilung · {n.notice_date} · Seite {n.source_page} ↗</a>
  </details>
 </div>)}</aside>;
}
