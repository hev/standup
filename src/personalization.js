import {AppError,required,text,stableId} from './domain.js';
export const profileId='owner-profile';
export const overlayId=async id=>(await stableId(['personalization',id])).replace('import-','focus-');
export const kinds=['progress','action','dependency','decision'];
export const evidenceFields=['source.summary','source.transcript','progress','next','notes'];
export function profileInput(b){
 const list=(v,name)=>{if(!Array.isArray(v)||v.length>30)throw new AppError(400,`Invalid ${name}`);return [...new Set(v.map(x=>required(x,name,120)))];};
 return {version:1,name:required(b.name,'owner name',120),aliases:list(b.aliases??[],'aliases'),projects:list(b.projects??[],'projects')};
}
export function fieldValue(entry,field){return field.split('.').reduce((v,k)=>v?.[k],entry)??'';}
export function overlayInput(value,entry,profile){
 if(!profile)throw new AppError(400,'Configure your focus first');
 if(!value||value.version!==1||value.profileRevision!==profile.revision||value.entryRevision!==entry.revision||value.sourceRevision!==(entry.source?.revision??''))throw new AppError(409,'Profile or source changed. Review the latest evidence before saving.');
 if(!Array.isArray(value.claims)||value.claims.length>40||!Array.isArray(value.ambiguity)||value.ambiguity.length>20)throw new AppError(400,'Invalid personalized view');
 const claims=value.claims.map(c=>{
  if(!c||!kinds.includes(c.kind)||!['explicit','ambiguous'].includes(c.certainty)||!Array.isArray(c.evidence)||!c.evidence.length||c.evidence.length>8)throw new AppError(400,'Each claim needs a kind, certainty and source evidence');
  const evidence=c.evidence.map(e=>{if(!e||!evidenceFields.includes(e.field))throw new AppError(400,'Invalid evidence field');required(e.quote,'evidence quote',4000);const quote=e.quote;if(!fieldValue(entry,e.field).includes(quote))throw new AppError(400,'Evidence quote must match the original source exactly');return {field:e.field,quote};});
  let actionDate;
  if(c.actionDate!==undefined&&c.actionDate!==''){
   actionDate=c.actionDate;
   if(c.kind!=='action'||typeof actionDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(actionDate)||!Number.isFinite(Date.parse(actionDate))||new Date(actionDate).toISOString().slice(0,10)!==actionDate)throw new AppError(400,'Action date must be a real YYYY-MM-DD date on an action');
  }
  return {...(actionDate?{actionDate}:{}),kind:c.kind,text:required(c.text,'claim',2000),certainty:c.certainty,evidence};
 });
 return {version:1,profileRevision:profile.revision,entryRevision:entry.revision,sourceRevision:entry.source?.revision??'',claims,ambiguity:value.ambiguity.map(v=>text(v,'ambiguity',2000)).filter(Boolean)};
}
export function stale(overlay,entry,profile){return !profile||overlay.profileRevision!==profile.revision||overlay.entryRevision!==entry.revision||overlay.sourceRevision!==(entry.source?.revision??'');}
export function documentBase(id,kind){return {id,kind,title:kind,client:'',projects:[],date:'1970-01-01',type:kind,progress:'',next:'',notes:'',source:null,blockerIds:[]};}
