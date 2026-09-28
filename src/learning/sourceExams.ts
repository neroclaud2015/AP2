export type SourceExams='all'|string[];
export function parseSourceExams(value:string|null):SourceExams {
 return value===null||value==='all'?'all':[...new Set(value.split(',').map(v=>v.trim()).filter(Boolean))];
}
export function includesSource(filter:SourceExams,exam:string){return filter==='all'||filter.includes(exam);}
export function sourceLabel(filter:SourceExams,count:number,label:(id:string)=>string){
 return filter==='all'?`Alle verfügbaren Jahrgänge · ${count} Prüfungen`:filter.length===1?label(filter[0]):`${filter.length} Jahrgänge ausgewählt`;
}
export function sourceDescription(filter:SourceExams,label:(id:string)=>string){
 return filter==='all'?'Der Test zieht Aufgaben aus allen verfügbaren Prüfungsjahrgängen.':filter.length===1?`Der Test verwendet nur Aufgaben aus ${label(filter[0])}.`:`Der Test verwendet nur Aufgaben aus ${filter.length} ausgewählten Jahrgängen.`;
}

export function toggleSourceExam(filter:SourceExams,available:string[],id:string):string[]{
 const selected=filter==='all'?[...available]:[...filter];
 return selected.includes(id)?selected.filter(value=>value!==id):[...selected,id];
}
export function moduleSupportsSources(filter:SourceExams,available:string[]):boolean{
 return available.length>0&&(filter==='all'||filter.length>0&&filter.every(id=>available.includes(id)));
}
