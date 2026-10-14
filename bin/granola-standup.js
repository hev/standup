#!/usr/bin/env node
import {realpathSync} from 'node:fs';
import {readFile,open,rename,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PersonalAPI} from '../src/granola/personal-api.js';
import {discover,reviewTemplate,importReviewed,cachedAPI} from '../src/granola/discovery.js';
export const help = `Granola standup discovery (Node 22+, laptop or private server only)
  discover --from ISO_WITH_ZONE --to EXCLUSIVE_ISO_WITH_ZONE --client CLIENT --out PRIVATE.json [--resume] [--cache CACHE.json]
  review-template --candidates PRIVATE.json --out REVIEW.json
  import --candidates PRIVATE.json --review REVIEW.json --out REPORT.json [--apply]
Environment: GRANOLA_API_KEY for live discovery (--cache needs none); STANDUP_URL plus STANDUP_TOKEN (or STANDUP_AUTH=identity) for apply.
All meeting pages and transcript pages are read, including null/misleading titles.
Candidates are unverified. Review every transcript for content and client evidence.
Import defaults to dry run; --apply requires an authenticated writable private app.
Local candidate/review files contain private text. Keep outside source/log directories.
Resume uses the same scope and retries the failed page. Start a new file to rescan changes.
Reports contain counts/status only. No background sync or public demo imports.`;
export async function privateWrite(path, data) {
  const tmp = path + '.tmp-' + process.pid;
  const f = await open(tmp,'wx',0o600);
  try { await f.writeFile(JSON.stringify(data,null,2)+'\n'); await f.sync(); } finally { await f.close(); }
  await rename(tmp,path); await chmod(path,0o600);
}
export function appRequest({url=process.env.STANDUP_URL,token=process.env.STANDUP_TOKEN,auth=process.env.STANDUP_AUTH,fetchImpl=fetch}={}) {
  if (!url || (!token && auth!=='identity')) throw Error('STANDUP_URL plus STANDUP_TOKEN or explicit STANDUP_AUTH=identity required');
  const base = new URL(url);
  if (base.username || base.password || (base.protocol!=='https:' && !(base.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(base.hostname)))) throw Error('Private URL must use HTTPS (or loopback HTTP)');
  return async (path,{method='GET',data}={}) => {
    let r;
    try { r=await fetchImpl(new URL(path,base),{method,redirect:'error',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)}); }
    catch { throw Error('PRIVATE_APP_NETWORK_FAILURE'); }
    if (!r.ok) throw Error('PRIVATE_APP_HTTP_'+r.status);
    try { return await r.json(); } catch { throw Error('PRIVATE_APP_INVALID_JSON'); }
  };
}
export async function main(args) {
  const [command,...rest]=args;
  if (!command || ['help','--help','-h'].includes(command)) { console.log(help); return; }
  const opts={};
  const allowed=new Set(['from','to','client','out','resume','candidates','review','apply','cache']);
  for(let i=0;i<rest.length;i++) {
    const key=rest[i].slice(2);
    if (!rest[i].startsWith('--') || !allowed.has(key) || Object.hasOwn(opts,key)) throw Error('Invalid option');
    if (['resume','apply'].includes(key)) opts[key]=true;
    else { if(!rest[i+1]||rest[i+1].startsWith('--'))throw Error('Missing option value'); opts[key]=rest[++i]; }
  }
  if (!opts.out) throw Error('--out required');
  for(const input of [opts.candidates,opts.review,opts.cache].filter(Boolean)) if(resolve(input)===resolve(opts.out)) throw Error('Output must differ from input');
  const read=async p=>JSON.parse(await readFile(p,'utf8'));
  let result;
  if(command==='discover') {
    const checkpoint=opts.resume?await read(opts.out):null;
    const cache=opts.cache?await read(opts.cache):null;
    const api=cache?cachedAPI(cache):new PersonalAPI();
    result=await discover(api,{...opts,inputIdentity:cache?api.identity:undefined,checkpoint,save:s=>privateWrite(opts.out,s)});
    if(cache) {result.coverage={kind:'local_cache',...cache.coverage};await privateWrite(opts.out,result);}
    console.log(JSON.stringify({complete:result.complete,scanned:result.scanned,candidates:result.candidates.length,excluded:result.excluded.length,failures:result.failures.length}));
    if(!result.complete || result.failures.length) process.exitCode=2;
    return;
  } else if(command==='review-template') result=reviewTemplate(await read(opts.candidates));
  else if(command==='import') {
    result=await importReviewed(await read(opts.candidates),await read(opts.review),{dryRun:!opts.apply,request:opts.apply?appRequest():undefined,save:r=>privateWrite(opts.out,r)});
    if(result.failures.length)process.exitCode=2;
  } else throw Error('Unknown command; run help');
  await privateWrite(opts.out,result);
  console.log(command==='import'?JSON.stringify(result):'Review template written locally');
}
if(process.argv[1] && import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href) main(process.argv.slice(2)).catch(e=>{const safe=e instanceof SyntaxError || (e.code && !String(e.code).startsWith('GRANOLA_')) ? 'Invalid local JSON or file access; check private paths and permissions.' : e.message;console.error(safe);process.exitCode=1;});
