import {AppError,row,decode} from './domain.js';
export const schema={content:{type:'string',full_text_search:true,fuzzy:true,embed:{model:'qwen/qwen3-embedding-4b',dims:2560,serving:{prefer:'native'}}},payload:{type:'string',filterable:false},revision:{type:'uint'},kind:{type:'string'},client:{type:'string'},projects:{type:'[]string'},date:{type:'string'},type:{type:'string'}};
export class LayerStore {
 constructor(env,namespace){this.env=env;this.namespace=namespace;}
 async request(path,body,method=body?'POST':'GET') {
  if(!this.env.LAYER_API_KEY || !this.env.LAYER_GATEWAY_URL) throw new AppError(503,'Storage is not configured');
  const r=await fetch(`${this.env.LAYER_GATEWAY_URL.replace(/\/$/,'')}/v2/namespaces/${encodeURIComponent(this.namespace)}${path}`,{method,headers:{Authorization:`Bearer ${this.env.LAYER_API_KEY}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  if(r.status===404) return null;
  if(!r.ok) { console.error('Layer request failed',r.status,path); throw new AppError(502,`Storage request failed (${r.status})`); }
  return r.json();
 }
 async get(id){const r=await this.request(`/documents/${encodeURIComponent(id)}`);return r?decode(r):null;}
 async put(doc,expected){const r=await this.request('',{upsert_rows:[row(doc)],upsert_condition:['revision','Eq',expected],return_affected_ids:true});if(!r?.upserted_ids?.includes(doc.id)) throw new AppError(409,'This record changed. Load the latest version before saving.');return doc;}
 async seed(documents){return this.request('',{schema,distance_metric:'cosine_distance',upsert_rows:documents.map(row),upsert_condition:['revision','Eq',null],return_affected_ids:true});}
 async list(filter,cursor=null,limit=50){const f=cursor?['And',[filter,['id','Gt',cursor]]]:filter;const r=await this.request('/query',{rank_by:['id','asc'],filters:f,top_k:limit,include_attributes:['payload']}); const rows=(r?.rows??[]).map(decode);return {rows,cursor:rows.length===limit?rows.at(-1).id:null};}
 async all(filter){const rows=[];let cursor=null;do{const page=await this.list(filter,cursor,1000);rows.push(...page.rows);cursor=page.cursor;if(rows.length>=10000&&cursor) throw new AppError(413,'Narrow the filters; this export exceeds 10,000 records');}while(cursor);return rows;}
 async search(query,filter){const r=await this.request('/search',{query,top_k:30,filters:filter,include_attributes:['payload'],embed:{attribute:'content'},rerank:false});return (r?.rows??[]).map(r=>({...decode(r),match:'Related to your search across progress, notes and source evidence'}));}
}
