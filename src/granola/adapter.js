import {PersonalAPI} from './personal-api.js';
/** Server-side recent-note bridge; discovery/review remains a separate explicit CLI. */
export async function calls(api=new PersonalAPI(),id=null){
 if(!id){const page=await api.get('notes',{page_size:20});if(!Array.isArray(page.notes))throw Error('Invalid recent notes');return {calls:page.notes.map(n=>({id:n.id,title:n.title??'Untitled Granola note',time:n.created_at??'',timeLabel:'note created'}))};}
 const n=await api.note(id);const turns=n.transcript??[];const actual=turns.find(t=>Number.isFinite(Date.parse(t.start_time)))?.start_time;const scheduled=n.calendar_event?.scheduled_start_time;const time=actual??scheduled??'';
 const evidence=turns.map((t,index)=>({index,text:t.text,speaker:t.speaker??null,start:t.start_time??null,end:t.end_time??null}));
 const values=[n.id,n.title??null,n.summary_markdown??n.summary_text??'',evidence,time];const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(values)));const revision=n.updated_at??[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 return {id:n.id,revision,type:'granola',url:n.web_url??'',time,summary:n.summary_markdown??n.summary_text??'',transcript:JSON.stringify(evidence),provenance:{timeBasis:actual?'transcript':scheduled?'scheduled':'unknown',transcriptRetention:'complete',originals:'Original Granola note',speakerAttribution:'May be ambiguous'}};
}
