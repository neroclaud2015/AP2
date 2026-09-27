import { useEffect, useRef, useState } from 'react';
import type { Box, QuestionSource, SegmentedQuestion } from './types';
import { asset,questionSources } from './types';

function PageCrop({source,label}:{source:QuestionSource;label:string}){
 const canvas=useRef<HTMLCanvasElement>(null);const [error,setError]=useState(false);
 useEffect(()=>{
  let active=true;setError(false);if(!source.source_page_image){setError(true);return;}
  const image=new Image();image.onload=()=>{
   if(!active||!canvas.current)return;
   const [x0,y0,x1,y1]=source.bounding_box;const scale=image.naturalWidth/source.source_size[0];const output=canvas.current;
   output.width=Math.round((x1-x0)*scale);output.height=Math.round((y1-y0)*scale);const context=output.getContext('2d')!;
   context.fillStyle='white';context.fillRect(0,0,output.width,output.height);
   for(const [a,b,c,d] of source.regions)context.drawImage(image,a*scale,b*scale,(c-a)*scale,(d-b)*scale,(a-x0)*scale,(b-y0)*scale,(c-a)*scale,(d-b)*scale);
  };image.onerror=()=>{if(active)setError(true);};image.src=asset(source.source_page_image);return()=>{active=false;};
 },[source]);
 return error?<p role="alert">Bild von Seite {source.source_page} konnte nicht geladen werden. Bitte Original-PDF öffnen.</p>:<canvas ref={canvas} className="question-image" role="img" data-source-page={source.source_page} aria-label={label}/>;
}
export function CropImage({question,edited=false}:{question:SegmentedQuestion;edited?:boolean}){
 const [error,setError]=useState(false);useEffect(()=>setError(false),[question.question_id,question.cropped_question_image,edited]);
 if(edited&&question.source_page_available!==false)return <div className="multipage-crop">{questionSources(question).map((source,i)=><div key={source.source_page}>{i>0&&<p className="hint">Fortsetzung · Originalseite {source.source_page}</p>}<PageCrop source={source} label={`Aufgabe ${question.question_number}, ${i===0?'bearbeiteter Originalausschnitt':'unveränderte Fortsetzung'}, Seite ${source.source_page}`}/></div>)}</div>;
 return error?<p role="alert">Bild konnte nicht geladen werden. Bitte Original-PDF öffnen.</p>:<img className="question-image" src={asset(question.cropped_question_image)} alt={`Aufgabe ${question.question_number}, Originalausschnitt`} onError={()=>setError(true)}/>;
}
export function CropEditor({question, onChange}: {question: SegmentedQuestion; onChange: (box: Box) => void}) {
  const start = useRef<[number,number] | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const point = (event: React.PointerEvent<SVGSVGElement>): [number,number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.max(0,Math.min(question.source_size[0],(event.clientX-rect.left)/rect.width*question.source_size[0])),
      Math.max(0,Math.min(question.source_size[1],(event.clientY-rect.top)/rect.height*question.source_size[1]))];
  };
  return <div className="crop-editor"><p>Auf der Originalseite ein Rechteck ziehen. Für eine L-Form bleibt die automatische Maske erhalten, bis du einen neuen Ausschnitt festlegst.</p>
    <svg ref={svg} aria-label="Ausschnitt auf Originalseite auswählen" viewBox={`0 0 ${question.source_size.join(' ')}`}
      onPointerDown={e => {start.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerUp={e => {if (!start.current) return; const end=point(e);const origin=start.current;start.current=null;
        if(Math.abs(end[0]-origin[0])>5 && Math.abs(end[1]-origin[1])>5) onChange([Math.min(end[0],origin[0]),Math.min(end[1],origin[1]),Math.max(end[0],origin[0]),Math.max(end[1],origin[1])].map(v=>Math.round(v*10)/10) as Box);}}>
      <image href={asset(question.source_page_image)} width={question.source_size[0]} height={question.source_size[1]}/>
      {question.regions.map((b,i)=><rect key={i} x={b[0]} y={b[1]} width={b[2]-b[0]} height={b[3]-b[1]} fill="#d4e8a22e" stroke="#e17025" strokeWidth="3"/>)}
    </svg>
    <div className="coordinates">{['Links','Oben','Rechts','Unten'].map((name,i)=><label key={name}>{name}<input aria-label={`Ausschnitt ${name}`} type="number" step="0.1" min="0" max={question.source_size[i%2]} value={question.bounding_box[i]} onChange={e=>{const next=[...question.bounding_box] as Box;next[i]=Number(e.target.value);onChange(next);}}/></label>)}</div>
  </div>;
}
