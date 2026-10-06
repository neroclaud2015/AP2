import {expect,test} from 'vitest';
import {deriveDashboard, type DashboardSnapshot} from './analytics';
import type {Attempt} from '../learning/model';
import type {InventoryQuestion} from '../bank/model';
import type {TestSession} from '../exams/model';
const now=new Date('2026-10-06T12:00:00Z');
const inventory=Array.from({length:20},(_,i)=>({question_id:'q'+i,module:i<10?'arbeitsplanung':'wiso',moduleTitle:i<10?'Arbeitsplanung':'WiSo',examId:'2026-sommer'} as InventoryQuestion));
const a=(id:string,q='q0',correctness:Attempt['correctness']='richtig',timestamp='2026-10-05T12:00:00Z'):Attempt=>({userId:'u',attempt_id:id,question_id:q,timestamp,correctness,user_answer:{choice:1},auto_scored:true,self_assessed:false,partial_status:false,unsure:false,confidence:'sure',hints_used:[],error_reason:'',note:'',subparts:[]});
const empty=():DashboardSnapshot=>({attempts:[],testSessions:[],wrongQuestions:[],questionUncertainty:[],learningSessions:[],trainingRuns:[]});
const derive=(s:Partial<DashboardSnapshot>={},config={highCoverage:80,milestones:[5,10,20],minTrendQuestions:5})=>deriveDashboard('u',inventory,{...empty(),...s},now,config);
test('empty user accuracy is absent, registry totals deduplicate and source additions appear',()=>{
 expect(derive()).toMatchObject({total:20,answered:0,accuracy:null,coverage:0,delta:null,milestone:5});
 expect(deriveDashboard('u',[...inventory,inventory[0]],empty(),now).total).toBe(20);
 expect(deriveDashboard('u',[...inventory,{...inventory[0],question_id:'new',module:'new-module'}],empty(),now).modules).toHaveLength(3);
});
test('coverage counts unique formal submissions, latest partial lowers accuracy, removed questions excluded, pure inputs',()=>{
 const s={...empty(),attempts:[a('1'),a('2'),a('3','q1','teilweise'),a('4','q0','falsch','2026-10-06T10:00:00Z'),a('draft','q2',null),{...a('view','q3'),auto_scored:false},a('gone','deleted'),{...a('other','q4'),userId:'other'}]};
 const before=JSON.stringify(s),r=derive(s);expect(r).toMatchObject({answered:2,correct:0,partial:1,accuracy:0,coverage:10});expect(JSON.stringify(s)).toBe(before);
});
test('discarded/deleted/pending tests and mirrored attempts never contribute; eligible test counted once',()=>{
 const t={userId:'u',test_id:'t',status:'completed',completed_at:'2026-10-05T12:00:00Z',result:{byQuestion:{q0:'richtig',q1:'pending'}}} as unknown as TestSession;
 expect(derive({testSessions:[t,t],attempts:[{...a('mirror'),test_id:'t'}]}).answered).toBe(1);
 for(const extra of [{status:'discarded'},{deleted_at:'2026-10-06'},{discarded_at:'2026-10-06'},{status:'active'}])expect(derive({testSessions:[{...t,...extra} as TestSession],attempts:[{...a('mirror'),test_id:'t'}]}).answered).toBe(0);
});
test('invalid explicit flags and invalid timestamps are excluded defensively',()=>{
 expect(derive({attempts:[{...a('x'),invalidated:true} as Attempt,{...a('y'),deleted_at:'2026-10-06'} as Attempt,a('z','q2','richtig','bad')]}).answered).toBe(0);
});
test('wrong stages are replayed read-only from valid sources; active uncertainty excludes stages but includes mastered',()=>{
 const attempts=[a('1','q0','falsch'),a('2','q1','falsch','2026-10-01'),a('3','q1','richtig','2026-10-02'),a('4','q1','richtig','2026-10-03'),a('5','q1','richtig','2026-10-04')];
 const states=['q0','q1','q2'].map(question_id=>({question_id,userId:'u',active:true,entered_at:'2026-10-01',updated_at:'2026-10-01',revision:1}));
 expect(derive({attempts,questionUncertainty:states})).toMatchObject({unsure:2,wrong:1,mastered:1,next:{kind:'wrong',count:1}});
 expect(derive({questionUncertainty:states}).next.kind).toBe('uncertainty');
});
test('two 7-day windows take unique latest within window; at least five each; boundaries do not overlap',()=>{
 const attempts=Array.from({length:5},(_,i)=>a('old'+i,'q'+i,i===0?'falsch':'richtig','2026-09-25T12:00:00Z'));
 attempts.push(...Array.from({length:5},(_,i)=>a('new'+i,'q'+i,'richtig','2026-10-01T12:00:00Z')),a('repeat','q0','teilweise','2026-10-02T12:00:00Z'));
 expect(derive({attempts})).toMatchObject({current:{count:5,accuracy:80},previous:{count:5,accuracy:80},delta:0,newCoverage:0});
 expect(derive({attempts:attempts.filter(x=>x.attempt_id!=='old4')}).delta).toBeNull();
 expect(derive({attempts:[a('boundary','q0','richtig','2026-09-29T12:00:00Z')]})).toMatchObject({current:{count:1},previous:{count:0},newCoverage:1});
});
test('recommendation chooses lowest coverage and config controls test threshold/milestone',()=>{
 const attempts=inventory.slice(0,8).map((q,i)=>a('a'+i,q.question_id));
 expect(derive({attempts}).next).toMatchObject({kind:'module',module:'wiso'});
 expect(derive({attempts},{highCoverage:30,milestones:[9,17],minTrendQuestions:5})).toMatchObject({next:{kind:'test'},milestone:9});
 expect(derive({attempts:inventory.map((q,i)=>a('a'+i,q.question_id))}).milestone).toBeNull();
});
