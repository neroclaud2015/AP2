export default function WisoTrainingAction({count,ready,busy,error,onStart,resumeCount}:{count:number;ready:boolean;busy:boolean;error:string;onStart:()=>void;resumeCount?:number}){
 const resumable=resumeCount!==undefined;
 return <><button className="primary" disabled={busy||!resumable&&(!ready||!count)} onClick={onStart}>{resumable?`Gespeichertes Training fortsetzen · ${resumeCount} Aufgaben`:`Thema trainieren / fortsetzen · ${count} Aufgaben`}</button>{!resumable&&!ready&&count>0&&<p role="status">Quellen werden geladen… Das Training ist bereit, sobald alle Originalaufgaben verfügbar sind.</p>}{resumable&&<p className="hint">Deine gespeicherte Runde verwendet ihre ursprünglichen Aufgaben und Quellen.</p>}{error&&<p role="alert">{error} Bitte erneut versuchen.</p>}</>;
}
