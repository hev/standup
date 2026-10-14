import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PersonalAPI} from '../src/granola/personal-api.js';
import {candidate,discover,reviewTemplate,importReviewed} from '../src/granola/discovery.js';
import {appRequest,privateWrite} from '../bin/granola-standup.js';
const scope={from:'2026-09-01T00:00:00Z',to:'2026-10-15T00:00:00Z',client:'Fictional Harbor'};
const turns=[{text:'Harbor team round robin: I finished HBR-142 yesterday. Today I will test the retry UI.',start_time:'2026-10-14T09:00:00-04:00',speaker:{attribution:'me'}},{text:'I am blocked on provider access. Could we perhaps replace the queue later?',start_time:'2026-10-14T09:01:00-04:00',speaker:{attribution:'them'}}];
const note=(id='not_synthetic00001',title=null)=>({id,title,updated_at:'2026-10-14T18:00:00Z',created_at:'2026-08-01T00:00:00Z',web_url:'https://notes.granola.ai/d/fictional',summary_text:'A proposal was discussed.',transcript:structuredClone(turns)});
const json=(b,status=200,headers={})=>new Response(JSON.stringify(b),{status,headers});
function apiFixture({fail=false}={}) {
 const calls=[];
 const api=new PersonalAPI({token:'fictional-secret',sleep:async()=>{},fetchImpl:async(url,init)=>{
  const u=new URL(url); calls.push(u.pathname+u.search);
  assert.equal(init.headers.Authorization,'Bearer fictional-secret'); assert.equal(init.redirect,'error');
  if(u.pathname.endsWith('/transcript')) return json({transcript:u.searchParams.has('cursor')?[turns[1]]:[turns[0]],hasMore:!u.searchParams.has('cursor'),cursor:u.searchParams.has('cursor')?null:'turn2'});
  if(u.pathname==='/v1/notes') return json({notes:u.searchParams.has('cursor')?[{id:'not_synthetic00002'}]:[{id:'not_synthetic00001'}],hasMore:!u.searchParams.has('cursor'),cursor:u.searchParams.has('cursor')?null:'page2'});
  if(fail && u.pathname.endsWith('00002'))return json({error:'PRIVATE-CANARY'},403);
  const n=note(u.pathname.split('/').at(-1),u.pathname.endsWith('00002')?'Architecture discussion':null);delete n.transcript;return json(n);
 }}); return {api,calls};
}
const scanFor=(c=candidate(note()))=>({format:'granola-candidates-v1',scope,candidates:[c],excluded:[],failures:[],complete:true,scanned:1});
function accept(scan) {const review=reviewTemplate(scan);Object.assign(review.reviews[0],{decision:'accepted',reason:'Team updates followed by deeper queue discussion',contextReason:'Harbor team explicitly identified',projects:['Checkout'],relatedSources:[{type:'archive',id:'fictional-archive-reference',relationship:'likely_duplicate'}],evidence:[{turn:0,quote:'I finished HBR-142 yesterday.',signal:'progress'},{turn:0,quote:'Harbor team round robin',signal:'round_robin'},{turn:1,quote:'I am blocked on provider access.',signal:'blockers'}]});return review;}
test('Personal API fetches every note and transcript page, nullable/misleading titles survive',async()=>{
 const {api,calls}=apiFixture();const s=await discover(api,scope);
 assert.equal(s.complete,true);assert.equal(s.scanned,2);assert.equal(s.candidates.length,2);
 assert.equal(s.candidates[0].title,null);assert.equal(s.candidates[1].title,'Architecture discussion');
 assert.equal(s.candidates[0].transcript.length,2);assert.equal(s.candidates[0].status,'needs_review');
 assert(calls.some(u=>u.includes('cursor=turn2')));assert(calls.some(u=>u.includes('cursor=page2')));
 assert.equal(s.candidates[0].source.time,'2026-10-14T09:00:00-04:00');
 assert.equal(s.candidates[0].source.summary,'A proposal was discussed.');
});
test('mixed meeting accepted explicitly; proposals stay evidence; negative and ambiguous distinguished',async()=>{
 const s=scanFor();s.candidates.push(candidate({...note('negative','Daily standup'),transcript:[{text:'Welcome to the product sales presentation.',start_time:turns[0].start_time}]}));s.scanned++;
 const r=accept(s);Object.assign(r.reviews[1],{decision:'excluded',reason:'Sales presentation without team updates'});
 let sent;const report=await importReviewed(s,r,{dryRun:false,request:async(path,opts)=>path==='/api/config'?{mode:'private',readOnly:false}:(sent=opts.data,{entry:{id:'x'}})});
 assert.equal(report.qualifying,1);assert.equal(report.imported,1);assert.equal(report.excluded,1);assert.equal(sent.progress,'');assert.equal(sent.next,'');assert(sent.source.transcript.includes('perhaps replace'));assert(sent.notes.includes('likely_duplicate'));
 r.reviews[1].decision='ambiguous';assert.equal((await importReviewed(s,r,{})).ambiguous,1);
});
test('failed fetch is incomplete, sanitized, checkpoint resumes failed page without duplication',async()=>{
 const {api}=apiFixture({fail:true});const s=await discover(api,scope);assert.equal(s.complete,false);assert.equal(s.failures[0].code,'GRANOLA_HTTP_403');assert(!JSON.stringify(s.failures).includes('PRIVATE-CANARY'));assert.equal(s.cursor,'page2');
 await assert.rejects(importReviewed(s,accept(s),{}),/Finish discovery/);
 const resumed=await discover(apiFixture().api,{...scope,checkpoint:s});assert(resumed.complete);assert.equal(resumed.candidates.length,2);assert.equal(resumed.failures.length,0);
});
test('list network failure recovers on resume and cannot masquerade as zero',async()=>{
 const bad=new PersonalAPI({token:'x',retries:0,fetchImpl:async()=>{throw Error('private');}});const s=await discover(bad,scope);assert.equal(s.complete,false);assert.equal(s.failures.length,1);
 const good=await discover(apiFixture().api,{...scope,checkpoint:s});assert(good.complete);assert.equal(good.failures.length,0);
});
test('429 backoff and 5xx retry bounded; auth never retried',async()=>{
 let n=0;const delays=[];const api=new PersonalAPI({token:'x',sleep:async ms=>delays.push(ms),fetchImpl:async()=>++n===1?json({},429,{'retry-after':'1'}):n===2?json({},503):json({ok:true})});assert.deepEqual(await api.get('notes'),{ok:true});assert.deepEqual(delays,[1000,1000]);
 n=0;api.fetchImpl=async()=>{n++;return json({},401);};await assert.rejects(api.get('notes'),/GRANOLA_HTTP_401/);assert.equal(n,1);
 api.fetchImpl=async()=>json({},429,{'retry-after':'120'});await assert.rejects(api.get('notes'),/RETRY_LATER/);
});
test('cursor loops and page limits fail closed',async()=>{
 const api=new PersonalAPI({token:'x',fetchImpl:async()=>json({notes:[],hasMore:true,cursor:'same'})});await assert.rejects(async()=>{for await (const p of api.pages('notes','notes'))void p;},/CURSOR_LOOP/);
 api.maxPages=1;await assert.rejects(async()=>{for await(const p of api.pages('notes','notes'))void p;},/PAGE_LIMIT/);
});
test('private-only destination checked before content write; 401 sends no body',async()=>{
 for(const config of [{mode:'demo',readOnly:true},{mode:'sandbox',readOnly:false},{mode:'private',readOnly:true}]) {
 let calls=0;await assert.rejects(importReviewed(scanFor(),accept(scanFor()),{dryRun:false,request:async()=>{calls++;return config;}}),/private/);assert.equal(calls,1);
 }
 let calls=0;const req=appRequest({url:'https://private.example',token:'fake',fetchImpl:async(u,init)=>{calls++;assert.equal(init.body,undefined);return json({error:'private'},401);}});
 await assert.rejects(importReviewed(scanFor(),accept(scanFor()),{dryRun:false,request:req}),/HTTP_401/);assert.equal(calls,1);
 assert.throws(()=>appRequest({url:'http://remote.example',token:'x'}),/HTTPS/);
});
test('repeat imports preserve edits, new source revisions and same-day IDs remain distinct',async()=>{
 const stored=new Map();const request=async(path,opts)=>{if(path==='/api/config')return {mode:'private',readOnly:false};const n=opts.data;const key=JSON.stringify([n.source.id,n.source.revision,n.client,[...n.projects].sort()]);if(stored.has(key))return {entry:stored.get(key),duplicate:true};const entry={...n,id:'entry'+stored.size};stored.set(key,entry);return {entry};};
 const s=scanFor();const r=accept(s);assert.equal((await importReviewed(s,r,{request,dryRun:false})).imported,1);[...stored.values()][0].progress='Owner edit';assert.equal((await importReviewed(s,r,{request,dryRun:false})).alreadyPresent,1);assert.equal([...stored.values()][0].progress,'Owner edit');
 const changed=scanFor(candidate({...note(),summary_text:'Updated source summary',updated_at:'2026-10-14T19:00:00Z'}));await importReviewed(changed,accept(changed),{request,dryRun:false});
 const other=scanFor(candidate(note('not_synthetic00003')));await importReviewed(other,accept(other),{request,dryRun:false});assert.equal(stored.size,3);
});
test('stale review, invented quotes, summary-only signals, missing context and oversized evidence rejected before writes',async()=>{
 for(const mutate of [r=>r.reviews[0].evidenceHash='stale',r=>r.reviews[0].evidence[0].quote='invented',r=>r.reviews[0].evidence=[],r=>r.reviews[0].contextReason='',r=>r.reviews[0].client='Other']) {
 const s=scanFor(),r=accept(s);mutate(r);await assert.rejects(importReviewed(s,r,{}));
 }
 const large=note();large.transcript[1].text+='x'.repeat(12000);const s=scanFor(candidate(large));await assert.rejects(importReviewed(s,accept(s),{}),/field limit/);
});
test('unknown time requires review; scheduled time cannot claim actual without confirmation',async()=>{
 const n=note();n.transcript=n.transcript.map(t=>({text:t.text}));n.calendar_event={scheduled_start_time:turns[0].start_time};const s=scanFor(candidate(n)),r=accept(s);
 await assert.rejects(importReviewed(s,r,{}),/Confirm actual/);r.reviews[0].timeReason='Reviewer confirmed scheduled start against source';assert.equal((await importReviewed(s,r,{})).qualifying,1);
});
test('private files written atomically with owner-only permissions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'standup-granola-'));try{const path=join(dir,'scan.json');await privateWrite(path,{synthetic:true});assert.equal((await stat(path)).mode&0o777,0o600);assert.deepEqual(JSON.parse(await readFile(path)),{synthetic:true});await privateWrite(path,{synthetic:2});}finally{await rm(dir,{recursive:true});}
});
test('dry run makes no network calls; unknown decisions and mismatched checkpoint scope rejected',async()=>{
 const s=scanFor();assert.equal((await importReviewed(s,accept(s),{request:()=>{throw Error('network');}})).dryRun,true);
 const r=accept(s);r.reviews[0].decision='yes';await assert.rejects(importReviewed(s,r,{}),/Invalid decision/);
 await assert.rejects(discover(apiFixture().api,{...scope,client:'Other',checkpoint:s}),/scope mismatch/);
});
test('checkout skill install preserves existing skills and resolves portable docs',async()=>{
 const {install}=await import('../scripts/install-granola-skill.mjs');const dir=await mkdtemp(join(tmpdir(),'standup-skill-'));
 try {const path=join(dir,'skills','granola-standup');await install(path);await install(path);assert((await readFile(join(path,'SKILL.md'),'utf8')).includes('granola-standup'));assert((await readFile(join(path,'references/cli.md'),'utf8')).includes('Historical Granola'));}finally{await rm(dir,{recursive:true});}
});
test('large mixed meeting supports explicitly reviewed excerpts with full local evidence retained',async()=>{
 const n=note();n.transcript.push({text:'Unrelated deep architecture discussion. '.repeat(1000),start_time:'2026-10-14T09:10:00-04:00'});
 const s=scanFor(candidate(n)),r=accept(s);const original=s.candidates[0].source.transcript;
 Object.assign(r.reviews[0],{transcriptTurns:[0,1],excerptReason:'Retain standup portion; full discussion retained locally'});
 let sent;assert.equal((await importReviewed(s,r,{dryRun:false,request:async(p,o)=>p==='/api/config'?{mode:'private',readOnly:false}:(sent=o.data,{entry:{id:'fake'}})})).imported,1);
 assert.equal(JSON.parse(sent.source.transcript).length,2);assert(sent.notes.includes('reviewed_excerpt'));assert.equal(s.candidates[0].source.transcript,original);
 r.reviews[0].transcriptTurns=[0];await assert.rejects(importReviewed(s,r,{}),/every cited/);
});
test('explicit identity gateway mode authenticates config before payload and never forges identity',async()=>{
 const calls=[];const request=appRequest({url:'https://private.example',auth:'identity',token:null,fetchImpl:async(url,init)=>{calls.push({path:new URL(url).pathname,...init});return new URL(url).pathname==='/api/config'?json({mode:'private',readOnly:false}):json({entry:{id:'identity-entry'}});}});
 const s=scanFor();assert.equal((await importReviewed(s,accept(s),{dryRun:false,request})).imported,1);assert.equal(calls[0].path,'/api/config');assert.equal(calls[0].body,undefined);assert.equal(calls[0].headers.Authorization,undefined);assert.equal(calls[1].headers['Tailscale-User-Login'],undefined);
});
test('authoritative updated_at matches preexisting import identity while evidence hash remains separate',async()=>{
 const s=scanFor();const c=s.candidates[0];assert.equal(c.source.revision,'2026-10-14T18:00:00Z');assert.match(c.fullEvidenceHash,/^[a-f0-9]{64}$/);
 const reordered=candidate(Object.fromEntries(Object.entries(note()).reverse()));assert.equal(reordered.fullEvidenceHash,c.fullEvidenceHash);
 const fmt=candidate({...note(),summary_text:'Summary format changed'});assert.equal(fmt.source.revision,c.source.revision);assert.notEqual(fmt.fullEvidenceHash,c.fullEvidenceHash);
 const r=accept(s);r.reviews[0].importedSourceRevision=c.sourceUpdatedAt;
 let calls=0;const request=async(p,o)=>p==='/api/config'?{mode:'private',readOnly:false}:(assert.equal(o.data.source.revision,note().updated_at),calls++,{entry:{id:'existing'},duplicate:true});
 assert.equal((await importReviewed(s,r,{request,dryRun:false})).alreadyPresent,1);assert.equal(calls,1);
 r.reviews[0].importedSourceRevision='different';await assert.rejects(importReviewed(s,r,{}),/authoritative/);
 const noTime=note();delete noTime.updated_at;assert.equal(candidate(noTime).source.revision,candidate(noTime).fullEvidenceHash);
});
test('cached summaries and transcripts discover without network or credentials, preserving exact summary',async()=>{
 const {cachedAPI}=await import('../src/granola/discovery.js');
 const n=note();n.summary_markdown='\n  ## Exact summary  \n\n';
 const cache={format:'granola-cache-v1',coverage:{complete:true,description:'Fictional reviewed local snapshot'},notes:[n,{...note('summary-only'),transcript:null,calendar_event:{scheduled_start_time:turns[0].start_time}}]};
 const api=cachedAPI(cache);const s=await discover(api,{...scope,inputIdentity:api.identity});assert(s.complete);assert.equal(s.candidates.length,2);assert.equal(s.candidates[0].source.summary,n.summary_markdown);assert.equal(s.candidates[1].transcriptComplete,false);assert.equal(s.candidates[1].transcript.length,0);
 await assert.rejects(discover(cachedAPI(cache),{...scope,inputIdentity:'changed',checkpoint:s}),/scope mismatch/);
 assert.throws(()=>cachedAPI({...cache,notes:[n,n]}),/duplicate/);assert.throws(()=>cachedAPI({...cache,coverage:{complete:false}}),/coverage/);
});

test('legacy hash-revision candidates cannot duplicate timestamp-revision imports',async()=>{
 const s=scanFor();s.candidates[0].source.revision='legacy-hash';s.candidates[0].revision='legacy-hash';await assert.rejects(importReviewed(s,accept(s),{}),/Legacy hash revision/);
});
