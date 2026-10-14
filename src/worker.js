import {profileId,overlayId,profileInput,overlayInput,stale,documentBase} from './personalization.js';
import {validateNamespaces} from './config.js';
import {AppError,required,text,note,date,source,stableId,filters} from './domain.js';
import {PersonalAPI} from './granola/personal-api.js';
import {calls as personalCalls} from './granola/adapter.js';
import {LayerStore} from './layer.js';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
async function equal(a,b){if(!a||!b)return false;const hash=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
async function body(req){if(Number(req.headers.get('content-length'))>100000)throw new AppError(413,'Request is too large');const raw=await req.text();if(raw.length>100000)throw new AppError(413,'Request is too large');try{return JSON.parse(raw);}catch{throw new AppError(400,'Invalid JSON');}}
async function granola(env,path){if(!env.GRANOLA_API_KEY)throw new AppError(503,'Granola is not configured. Paste notes manually.');try{if(!env.GRANOLA_ADAPTER_URL){const id=path.match(/^\/calls\/([\w-]+)$/)?.[1];return await personalCalls(new PersonalAPI({token:env.GRANOLA_API_KEY}),id??null);}const r=await fetch(env.GRANOLA_ADAPTER_URL.replace(/\/$/,'')+path,{headers:{Authorization:`Bearer ${env.GRANOLA_API_KEY}`},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return await r.json();}catch{throw new AppError(502,'Call notes are unavailable. You can paste notes manually.');}}
async function blockerEvidence(store,ids){const result=[];for(const id of ids){const b=await store.get(id);if(b?.kind!=='blocker')throw new AppError(400,'Unknown blocker');result.push(b.title+'\n'+(b.history[0]?.evidence??''));}return result;}
export async function handle(req,env,storeFactory=(e,n)=>new LayerStore(e,n)) {
 const url=new URL(req.url),p=url.pathname,m=req.method;
 try{
  if(p==='/api/version'&&m==='GET')return json({version:env.APP_VERSION??'development'});
  if(!p.startsWith('/api/'))return env.ASSETS.fetch(req);
  if(!['demo','private','sandbox'].includes(env.APP_MODE))throw new AppError(503,'App mode is not configured');
  const namespaces=validateNamespaces({demo:env.DEMO_NAMESPACE,privateNotes:env.PRIVATE_NAMESPACE,sandbox:env.SANDBOX_NAMESPACE});
  const isDemo=env.APP_MODE==='demo';
  if(!isDemo&&(!/^[A-Za-z0-9_.~+=-]{32,200}$/.test(env.OWNER_TOKEN??'')||env.OWNER_TOKEN.startsWith('replace-')))throw new AppError(503,'Private authentication is not configured. Set a random owner token of at least 32 characters.');
  const bearer=req.headers.get('Authorization')?.replace(/^Bearer /,'');
  const cookie=req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('standup_session='))?.slice(16);
  const supplied=bearer??cookie;
  const write=!['GET','HEAD'].includes(m);
  if(write && !bearer && req.headers.get('Origin')!==url.origin)throw new AppError(403,'Use this app origin for browser writes');
  if(p==='/api/session'&&m==='POST'){
   if(isDemo)throw new AppError(403,'The public demo is read-only');
   const b=await body(req);if(!await equal(b.token,env.OWNER_TOKEN))throw new AppError(401,'Invalid owner token');
   return json({ok:true},200,{'Set-Cookie':`standup_session=${env.OWNER_TOKEN}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${url.protocol==='https:'?'; Secure':''}`});
  }
  if(!isDemo && !await equal(supplied,env.OWNER_TOKEN))throw new AppError(401,'Sign in to your private standups');
  if(env.APP_MODE==='sandbox'&&(!env.SANDBOX_EXPIRES_AT || !Number.isFinite(Date.parse(env.SANDBOX_EXPIRES_AT)) || Date.now()>=Date.parse(env.SANDBOX_EXPIRES_AT)))throw new AppError(410,'This sandbox has expired');
  if(isDemo&&write)throw new AppError(403,'The public demo is read-only');
  if(p==='/api/search'&&env.SEARCH_DISABLED==='1')throw new AppError(503,'Search is unavailable in this preview. Timeline and notes are still available.');
  const store=storeFactory(env,isDemo?namespaces.demo:env.APP_MODE==='private'?namespaces.privateNotes:namespaces.sandbox);
  if(p==='/api/config'&&m==='GET')return json({mode:env.APP_MODE,readOnly:isDemo,features:{structuredProvenance:true,nativeGranola:true,personalization:true},searchAvailable:env.SEARCH_DISABLED!=='1',granolaConfigured:!isDemo&&!!env.GRANOLA_API_KEY,expiresAt:env.APP_MODE==='sandbox'?env.SANDBOX_EXPIRES_AT:null});
  if(p==='/api/profile'&&m==='GET')return json({profile:await store.get(profileId)});
  if(p==='/api/profile'&&m==='PUT'){
   const b=await body(req),old=await store.get(profileId);if(b.revision!==(old?.revision??0))throw new AppError(409,'Profile changed. Load the latest profile.');
   const profile={...documentBase(profileId,'profile'),...profileInput(b),revision:(old?.revision??0)+1,updatedAt:new Date().toISOString()};await store.put(profile,old?.revision??null);return json({profile});
  }
  const focusMatch=p.match(/^\/api\/entries\/([\w-]+)\/personalization$/);
  if(focusMatch){
   const entry=await store.get(focusMatch[1]);if(!entry||entry.kind!=='note')throw new AppError(404,'Standup not found');
   const old=await store.get(overlayId(entry.id)),profile=await store.get(profileId);
   if(m==='GET')return json({personalization:old?{...old,stale:stale(old,entry,profile)}:null});
   if(m==='PUT'){const b=await body(req);if(b.revision!==(old?.revision??0))throw new AppError(409,'Personalized view changed. Load the latest view.');const value=overlayInput(b.personalization,entry,profile);const personalization={...documentBase(overlayId(entry.id),'personalization'),...value,entryId:entry.id,revision:(old?.revision??0)+1,updatedAt:new Date().toISOString()};await store.put(personalization,old?.revision??null);return json({personalization:{...personalization,stale:false}});}
  }
  if(p==='/api/entries'&&m==='GET'){
   const rows=await store.all(filters(url.searchParams));rows.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));const offset=Number(url.searchParams.get('cursor')??0);if(!Number.isInteger(offset)||offset<0)throw new AppError(400,'Invalid cursor');return json({rows:rows.slice(offset,offset+50),cursor:rows.length>offset+50?String(offset+50):null});
  }
  if(p==='/api/search'&&m==='POST'){const b=await body(req);return json({rows:await store.search(required(b.query,'query',500),filters(new URLSearchParams(b.filters??{})))});}
  // Public search is a GET so it remains a read-only route.
  if(p==='/api/search'&&m==='GET')return json({rows:await store.search(required(url.searchParams.get('q'),'query',500),filters(url.searchParams))});
  if(p==='/api/facets'&&m==='GET'){const rows=await store.all(filters(new URLSearchParams()));return json({clients:[...new Set(rows.map(n=>n.client))].sort(),projects:[...new Set(rows.flatMap(n=>n.projects))].sort()});}
  if(p==='/api/export'&&m==='GET')return json({format:'standup-v1',entries:await store.all(filters(url.searchParams)),blockers:await store.all(['kind','Eq','blocker']),profile:await store.get(profileId),personalizations:await store.all(['kind','Eq','personalization'])});
  if(p==='/api/entries'&&m==='POST'){
   const b=await body(req),n=note(b);const evidence=await blockerEvidence(store,n.blockerIds);
   const id=b.importKey?await stableId(['archive',required(b.importKey,'import key',1000),n.client,[...n.projects].sort()]):crypto.randomUUID();
   if(b.importKey){const old=await store.get(id);if(old)return json({entry:old,duplicate:true});}
   const now=new Date().toISOString();const entry={...n,id,kind:'note',revision:1,createdAt:now,updatedAt:now};
   try{await store.put(entry,null,evidence);}catch(e){if(b.importKey&&e.status===409)return json({entry:await store.get(id),duplicate:true});throw e;}return json({entry},201);
  }
  const entryMatch=p.match(/^\/api\/entries\/([\w-]+)$/);
  if(entryMatch){const old=await store.get(entryMatch[1]);if(!old||old.kind!=='note')throw new AppError(404,'Standup not found');if(m==='GET')return json({entry:old});if(m==='PUT'){const b=await body(req);if(!Number.isInteger(b.revision)||b.revision!==old.revision)throw new AppError(409,'This record changed. Load the latest version before saving.');const n=note(b);const evidence=await blockerEvidence(store,n.blockerIds);const entry={...old,...n,revision:old.revision+1,updatedAt:new Date().toISOString()};await store.put(entry,b.revision,evidence);return json({entry});}}
  if(p==='/api/blockers'&&m==='GET')return json({rows:await store.all(['kind','Eq','blocker'])});
  if(p==='/api/blockers'&&m==='POST'){const b=await body(req),now=new Date().toISOString();const blocker={id:crypto.randomUUID(),kind:'blocker',title:required(b.title,'blocker title',500),client:required(b.client,'client'),since:date(b.since),status:'open',revision:1,history:[{at:now,status:'open',evidence:text(b.evidence??'','evidence',2000)}]};await store.put(blocker,null);return json({blocker},201);}
  const blockerMatch=p.match(/^\/api\/blockers\/([\w-]+)$/);
  if(blockerMatch&&m==='PUT'){const old=await store.get(blockerMatch[1]);if(!old||old.kind!=='blocker')throw new AppError(404,'Blocker not found');const b=await body(req);if(b.revision!==old.revision)throw new AppError(409,'Blocker changed');if(!['open','resolved'].includes(b.status))throw new AppError(400,'Invalid blocker status');const blocker={...old,status:b.status,revision:old.revision+1,history:[...old.history,{at:new Date().toISOString(),status:b.status,evidence:required(b.evidence,'resolution evidence',2000)}]};await store.put(blocker,b.revision);return json({blocker});}
  if(isDemo&&p.startsWith('/api/calls'))throw new AppError(403,'Calls are private to the owner');
  if(p==='/api/calls'&&m==='GET')return json({calls:(await granola(env,'/calls')).calls});
  const callMatch=p.match(/^\/api\/calls\/([\w-]+)$/);if(callMatch&&m==='GET')return json({call:await granola(env,'/calls/'+callMatch[1])});
  if(p==='/api/import/preview'&&m==='POST'){const b=await body(req);const s=source(b.source);if(!s)throw new AppError(400,'Choose a source');return json({source:s,draft:{title:'Call notes',progress:'',next:'',notes:s.summary||s.transcript},warning:'Editable draft. Speaker attribution may be ambiguous; proposals are not decisions or personal commitments.'+(s.provenance?.timeBasis==='scheduled'?' The source time is scheduled; verify the actual call time.':'')});}
  if(p==='/api/import'&&m==='POST'){
   const b=await body(req),n=note(b);if(!n.source)throw new AppError(400,'Source is required');
   const id=await stableId([n.source.type,n.source.id,n.source.revision,n.client,[...n.projects].sort()]);const old=await store.get(id);if(old)return json({entry:old,duplicate:true});const evidence=await blockerEvidence(store,n.blockerIds);
   const now=new Date().toISOString(),entry={...n,id,kind:'note',revision:1,createdAt:now,updatedAt:now};try{await store.put(entry,null,evidence);}catch(e){if(e.status===409)return json({entry:await store.get(id),duplicate:true});throw e;}return json({entry},201);
  }
  throw new AppError(404,'Route not found');
 }catch(e){if(!(e instanceof AppError))console.error('Unhandled app error',e.name);return json({error:e instanceof AppError?e.message:'Service unavailable. Please try again.'},e.status??503);}
}
export default {fetch(request,env){return handle(request,env);}};
