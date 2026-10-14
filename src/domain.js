export class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function text(value, name, max = 12000) {
  if (typeof value !== 'string' || value.length > max) throw new AppError(400, `Invalid ${name}`);
  return value.trim();
}
export function required(value, name, max = 120) { const v = text(value, name, max); if (!v) throw new AppError(400, `${name} is required`); return v; }
export function date(value) { const parsed=typeof value==='string'?new Date(value+'T00:00:00Z'):new Date(NaN); if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==value) throw new AppError(400,'Invalid date'); return value; }
export function provenance(value){if(value===null)return null;if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>12000)throw new AppError(400,'Invalid provenance');return value;}
export function source(value) {
  if (!value) return null;
  const s = {id:required(value.id,'source ID',500),revision:required(String(value.revision ?? ''),'source revision',200),type:required(value.type,'source type'),url:text(value.url??'','source URL',2000),time:text(value.time??'','source time',100),summary:text(value.summary??'','summary'),transcript:text(value.transcript??'','transcript')};
  if(value.provenance!==undefined)s.provenance=provenance(value.provenance);
  if (s.url && !/^https?:\/\//.test(s.url)) throw new AppError(400,'Source URL must use HTTP or HTTPS');
  return s;
}
export function note(input) {
  const projects = input.projects;
  if (!Array.isArray(projects) || !projects.length || projects.length > 12) throw new AppError(400,'Choose 1–12 projects');
  const n = {client:required(input.client,'client'), projects:[...new Set(projects.map(p=>required(p,'project')))], date:date(input.date),type:input.type??'standup',title:required(input.title,'title',200),progress:text(input.progress??'','progress'),next:text(input.next??'','next'),notes:text(input.notes??'','notes'),blockerIds:input.blockerIds??[],source:source(input.source)};
  if (!['standup','call','planning'].includes(n.type)) throw new AppError(400,'Invalid note type');
  if (!Array.isArray(n.blockerIds) || n.blockerIds.length>20 || n.blockerIds.some(id=>typeof id!=='string'|| !/^[\w-]{1,100}$/.test(id))) throw new AppError(400,'Invalid blocker IDs');
  if(input.provenance!==undefined)n.provenance=provenance(input.provenance);
  if (!n.progress && !n.next && !n.notes) throw new AppError(400,'Write progress, next steps or notes');
  return n;
}
export async function stableId(parts) { const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(parts))); return 'import-'+[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,56); }
export function filters(params, kind='note') {
  const f=[['kind','Eq',kind]];
  for (const k of ['client','type']) if (params.get(k)) f.push([k,'Eq',text(params.get(k),k,120)]);
  if (params.get('project')) f.push(['projects','Contains',text(params.get('project'),'project',120)]);
  if (params.get('from')) f.push(['date','Gte',date(params.get('from'))]);
  if (params.get('to')) f.push(['date','Lte',date(params.get('to'))]);
  return ['And',f];
}
export function row(document, blockerEvidence=[]) {
 const content=document.kind==='blocker' ? `${document.title} ${document.history.map(h=>h.evidence??'').join(' ')}` : [document.title,document.client,...document.projects,document.progress,document.next,document.notes,document.source?.summary,document.source?.transcript,...blockerEvidence].filter(Boolean).join('\n');
 return {id:document.id,revision:document.revision,kind:document.kind,client:document.client??'',projects:document.projects??[],date:document.date??document.since,type:document.type??'blocker',content,payload:JSON.stringify(document)};
}
export function decode(r) { const attrs=r.attributes??r; return JSON.parse(attrs.payload); }
