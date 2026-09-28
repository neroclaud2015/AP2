import {toggleSourceExam,type SourceExams} from './sourceExams';
export default function SourceYearSelection({value,years,disabled=false,onChange}:{value:SourceExams;years:{id:string;label:string}[];disabled?:boolean;onChange:(next:SourceExams)=>void}){
 const ids=years.map(y=>y.id);const selected=value==='all'?ids:value;const unknown=selected.filter(id=>!ids.includes(id));
 return <fieldset className="source-year-selection" disabled={disabled}><legend>Aufgaben aus</legend>
  <div className="source-modes"><label><input type="radio" name="source-mode" checked={value==='all'} onChange={()=>onChange('all')}/>Alle Jahre</label><label><input type="radio" name="source-mode" checked={value!=='all'} onChange={()=>onChange([...ids])}/>Jahrgänge auswählen</label></div>
  <div className="source-year-options">{years.map(year=><label key={year.id}><input type="checkbox" checked={selected.includes(year.id)} onChange={()=>onChange(toggleSourceExam(value,ids,year.id))}/>{year.label}</label>)}</div>
  <div className="selection-actions"><button type="button" className="outline" onClick={()=>onChange('all')}>Alle auswählen</button><button type="button" className="outline" onClick={()=>onChange([])}>Auswahl löschen</button><span>{value==='all'?'Alle verfügbaren Jahrgänge':`${value.length} Jahrgänge ausgewählt`}</span></div>
  {value!=='all'&&!value.length&&<p role="alert">Mindestens einen Prüfungsjahrgang auswählen.</p>}
  {!!unknown.length&&<p role="alert">Ein ausgewählter Prüfungsjahrgang ist nicht verfügbar. Bitte die Auswahl löschen und neu wählen.</p>}
 </fieldset>;
}
