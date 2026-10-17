// Dates are calendar dates, not instants. "Today" uses the reader's local day.
export function localDay(now=new Date()) {
 return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function isTodayAction(claim,today=localDay()) {
 return claim.kind==='action'&&claim.certainty==='explicit'&&claim.actionDate===today;
}
export function focusGroups(claims,today=localDay()) {
 return [
  {label:`Your actions today · ${today}`,claims:claims.filter(c=>isTodayAction(c,today)),today:true},
  {label:'Other next actions · dated or timing unconfirmed',claims:claims.filter(c=>c.kind==='action'&&!isTodayAction(c,today))},
  {label:'Dependencies · waiting on / needed from you',claims:claims.filter(c=>c.kind==='dependency')},
  {label:'Your progress · reported work',claims:claims.filter(c=>c.kind==='progress')},
  {label:'Decisions affecting you',claims:claims.filter(c=>c.kind==='decision')}
 ];
}
export function claimLabel(c,today=localDay()) {
 if(c.kind==='action')return isTodayAction(c,today)?`Today (${today}): `:c.actionDate?`Action dated ${c.actionDate}: `:'Next · timing unconfirmed: ';
 return c.kind==='dependency'?'Dependency: ':c.kind==='decision'?'Decision: ':'Progress: ';
}
