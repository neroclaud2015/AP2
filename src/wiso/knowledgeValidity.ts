import type {TopicKnowledge} from './KnowledgeHistory';
/** A build-time verdict must not outlive a known effective-date boundary. */
export function knowledgeStillCurrent(k:TopicKnowledge|undefined,today=new Date().toISOString().slice(0,10)){
 if(!k)return true;
 const v=k.versions.find(v=>v.current);
 return k.status==='current'&&!!v&&v.verified&&!!v.verified_at&&v.verified_at<=today&&(!v.effective_from||v.effective_from<=today)&&(!v.effective_until||today<v.effective_until)&&!k.versions.some(x=>x.id!==v.id&&x.effective_from&&x.effective_from>k.as_of&&x.effective_from<=today);
}
