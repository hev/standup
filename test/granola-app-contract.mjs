// Run with an exact app checkout: STANDUP_APP_CHECKOUT=/path node --test test/granola-app-contract.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {candidate,reviewTemplate,importReviewed} from '../src/granola/discovery.js';
import {appRequest} from '../bin/granola-standup.js';
test('Granola CLI interoperates with exact app handler: private auth, stable import IDs and preserved revisions',{skip:!process.env.STANDUP_APP_CHECKOUT},async()=>{
 const {handle}=await import(pathToFileURL(resolve(process.env.STANDUP_APP_CHECKOUT,'src/worker.js')));
 const rows=new Map();const namespaces=[];
 const store={get:async id=>rows.get(id),put:async(doc)=>{assert(!rows.has(doc.id));rows.set(doc.id,doc);}};
 const env={APP_MODE:'private',OWNER_TOKEN:'fictional-owner-token',DEMO_NAMESPACE:'fictional-demo',PRIVATE_NAMESPACE:'fictional-private',SANDBOX_NAMESPACE:'fictional-sandbox'};
 const fetchImpl=(url,init)=>handle(new Request(url,init),env,(e,ns)=>{namespaces.push(ns);return store;});
 const request=appRequest({url:'https://app.test',token:env.OWNER_TOKEN,fetchImpl});
 const scope={from:'2026-10-01T00:00:00Z',to:'2026-10-15T00:00:00Z',client:'Fictional Harbor'};
 const n={id:'not_synthetic00001',title:null,web_url:'https://notes.granola.ai/d/fictional',updated_at:'2026-10-14T10:00:00Z',summary_text:'A possible redesign was proposed.',transcript:[{text:'Harbor round robin. I shipped HBR-142 yesterday.',start_time:'2026-10-14T09:00:00Z'},{text:'I am blocked on access. Perhaps we could redesign later.',start_time:'2026-10-14T09:01:00Z'}]};
 const scan=()=>({format:'granola-candidates-v1',scope,candidates:[candidate(n)],excluded:[],failures:[],complete:true,scanned:1});
 const review=s=>{const r=reviewTemplate(s);Object.assign(r.reviews[0],{decision:'accepted',reason:'Updates followed by deeper discussion',contextReason:'Harbor identified in transcript',projects:['Checkout'],evidence:[{turn:0,quote:'I shipped HBR-142 yesterday.',signal:'progress'},{turn:1,quote:'I am blocked on access.',signal:'blockers'}]});return r;};
 let s=scan();assert.equal((await importReviewed(s,review(s),{request,dryRun:false})).imported,1);
 const original=[...rows.values()][0];assert.equal(Buffer.byteLength(original.id),63);assert.equal(original.source.time,'2026-10-14T09:00:00Z');assert.equal(original.progress,'');assert.equal(original.next,'');original.notes='Owner edit';
 assert.equal((await importReviewed(s,review(s),{request,dryRun:false})).alreadyPresent,1);assert.equal(original.notes,'Owner edit');
 n.summary_text='Source revised';s=scan();assert.equal((await importReviewed(s,review(s),{request,dryRun:false})).imported,1);assert.equal(rows.size,2);
 n.id='not_synthetic00002';s=scan();await importReviewed(s,review(s),{request,dryRun:false});assert.equal(rows.size,3);assert(namespaces.every(ns=>ns==='fictional-private'));
 const unauthorized=appRequest({url:'https://app.test',token:'wrong',fetchImpl});await assert.rejects(importReviewed(s,review(s),{request:unauthorized,dryRun:false}),/HTTP_401/);assert.equal(rows.size,3);
 env.APP_MODE='demo';await assert.rejects(importReviewed(s,review(s),{request,dryRun:false}),/private/);assert.equal(rows.size,3);
});
