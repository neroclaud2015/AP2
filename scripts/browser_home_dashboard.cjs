const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const base=process.env.APP_URL||'http://127.0.0.1:5174/',dir=process.env.EVIDENCE_DIR||'docs/evidence/home-dashboard/browser';fs.mkdirSync(dir,{recursive:true});
 const server=process.env.APP_URL?null:require('node:child_process').spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5174','--strictPort'],{stdio:'ignore',windowsHide:true});if(server)await new Promise(r=>setTimeout(r,1500));
 const b=await chromium.launch({channel:'chrome',headless:true}),c=await b.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage(),checks=[];
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(base+'?view=start');await p.getByTestId('coverage-count').waitFor();assert.equal(await p.getByTestId('coverage-count').innerText(),'0');assert.equal(await p.getByText('– · Noch keine bewerteten Aufgaben').count(),4);
 const order=await p.locator('[data-testid^="home-"]').evaluateAll(els=>els.map(e=>e.dataset.testid));assert.deepEqual(order.slice(0,3),['home-resume','home-quick','home-progress']);
 await p.screenshot({path:dir+'/desktop-fresh.png',fullPage:true});checks.push('Fresh user: 0 covered, absent accuracy, action sections precede analytics');
 await p.evaluate(async()=>{
 const inventory=await (await fetch('data/question_inventory.json')).json(),q=inventory.filter(q=>q.kind==='multiple_choice').slice(0,20),now=Date.now(),stamp=d=>new Date(now-d*86400000).toISOString();
 const req=indexedDB.open('ap2-private-learning'),db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
 const attempts=[],a=(id,i,result,days)=>({userId:'local',attempt_id:id,question_id:q[i].question_id,exam:q[i].examId,module:q[i].module,timestamp:stamp(days),correctness:result,user_answer:{choice:1},auto_scored:true,self_assessed:false,partial_status:result==='teilweise',unsure:false,confidence:'sure',hints_used:[],error_reason:'',note:'',subparts:[]});
 for(let i=0;i<5;i++){attempts.push(a('prior'+i,i,i<3?'richtig':'falsch',10));attempts.push(a('recent'+i,i,i<4?'richtig':'teilweise',2));}
 for(let i=5;i<12;i++)attempts.push(a('extra'+i,i,'richtig',1));
 ['falsch','richtig','richtig','richtig'].forEach((v,i)=>attempts.push(a('master'+i,12,v,6-i)));
 const tx=db.transaction(['attempts','questionUncertainty'],'readwrite');for(const a of attempts)tx.objectStore('attempts').put(a);for(const i of [4,12,13,14])tx.objectStore('questionUncertainty').put({userId:'local',question_id:q[i].question_id,active:true,entered_at:stamp(1),updated_at:stamp(1),revision:1});
 await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close();
 });
 await p.reload();await p.getByTestId('coverage-count').filter({hasText:'13'}).waitFor();
 for(const [key,value] of [['correct','12'],['unsure','3'],['wrong','2'],['mastered','1']])assert.equal(await p.getByTestId('kpi-'+key).innerText(),value);
 assert.equal(await p.getByTestId('home-next').getByRole('button').innerText(),'Fehlertraining starten');await p.getByText('↑ +32 %-Punkte gegenüber der Vorwoche').waitFor();
 await p.screenshot({path:dir+'/desktop-progress.png',fullPage:true});await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:dir+'/mobile-progress.png',fullPage:true});
 checks.push('Synthetic isolated data: 13 unique covered, 12 latest correct, 3 unsure, 2 active wrong, 1 mastered; +32 pp trend; no real personal data touched');
 await p.getByTestId('home-modules').getByRole('button').first().click();await p.getByRole('combobox',{name:'Modul',exact:true}).waitFor();assert.equal(await p.getByRole('combobox',{name:'Modul',exact:true}).inputValue(),'arbeitsplanung');assert.ok(p.url().includes('bankModule=arbeitsplanung'));await p.reload();assert.equal(await p.getByRole('combobox',{name:'Modul',exact:true}).inputValue(),'arbeitsplanung');checks.push('Module CTA opens persistent module filter');
 await p.goto(base+'?view=start');await p.getByTestId('home-next').getByRole('button',{name:'Fehlertraining starten'}).click();await p.waitForURL(/view=training/);checks.push('Next-action starts real stage-1 training');
 await p.goto(base+'?view=start');await p.getByTestId('home-resume').getByRole('button',{name:'Fortsetzen',exact:true}).waitFor();checks.push('Active TrainingRun is resumable from first section');
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/checks.json',JSON.stringify({checks,errors,fixture:'Synthetic isolated browser profile',real_user_data_touched:false},null,2));console.log(checks);
 }catch(e){await p.screenshot({path:dir+'/failure.png',fullPage:true});throw e;}finally{await b.close();server?.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
