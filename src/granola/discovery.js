import {createHash} from 'node:crypto';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function range(from, to) {
  for (const value of [from,to]) if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('Explicit ISO timestamps with timezone required');
  if (Date.parse(from) >= Date.parse(to)) throw Error('Range must have from < to (exclusive)');
  return {from,to};
}
export function candidate(note) {
  const turns = note.transcript;
  const time = turns.find(t => Number.isFinite(Date.parse(t.start_time)))?.start_time ?? note.calendar_event?.scheduled_start_time ?? null;
  const timeBasis = turns.some(t => Number.isFinite(Date.parse(t.start_time))) ? 'transcript' : time ? 'scheduled' : 'unknown';
  const transcript = turns.map((t,index) => ({index, text:t.text, speaker:t.speaker ?? null, start:t.start_time ?? null, end:t.end_time ?? null}));
  const source = {id:note.id, revision:hash(note), type:'granola', url:note.web_url ?? '', time:time ?? '', summary:note.summary_markdown ?? note.summary_text ?? '', transcript:JSON.stringify(transcript)};
  return {id:note.id, revision:source.revision, title:note.title ?? null, source, sourceUpdatedAt:note.updated_at, createdAt:note.created_at, calendar:note.calendar_event ?? null, timeBasis, transcript, status:'needs_review', reasons:[turns.length ? 'Transcript evidence requires explicit review' : 'No transcript evidence'], hints:{title: /stand.?up|check.?in|sync/i.test(note.title ?? ''), content:/yesterday|blocker|progress|next|today/i.test(source.summary + source.transcript)}, evidenceHash:hash({source,timeBasis})};
}
export async function discover(api, {from,to,client, checkpoint = null, save = async () => {}}) {
  range(from,to); if (!client?.trim()) throw Error('Client context required');
  const scope = {from,to,client};
  if (checkpoint && JSON.stringify(checkpoint.scope) !== JSON.stringify(scope)) throw Error('Checkpoint scope mismatch');
  const state = checkpoint ?? {format:'granola-candidates-v1',scope,candidates:[],excluded:[],failures:[],cursor:null,complete:false,scanned:0};
  if (state.complete) return state;
  state.failures = state.failures.filter(f=>f.id);
  const known = new Set([...state.candidates,...state.excluded].map(c=>c.id));
  try {
    // List all creation dates: date filters apply to note creation, not meeting time.
    // A note created outside the range can still contain an in-range meeting.
    for await (const page of api.pages('notes','notes',{page_size:30},state.cursor)) {
      for (const stub of page.notes) {
        if (known.has(stub.id)) continue;
        try {
          if (stub.deleted_at) { state.excluded.push({id:stub.id,reason:'deleted'}); known.add(stub.id); continue; }
          const c = candidate(await api.note(stub.id));
          if (!c.source.time) { c.reasons.push('Meeting time unknown; review required'); state.candidates.push(c); }
          else if (Date.parse(c.source.time) >= Date.parse(from) && Date.parse(c.source.time) < Date.parse(to)) state.candidates.push(c);
          else state.excluded.push({id:c.id,reason:'outside_meeting_range'});
          known.add(stub.id);
          state.failures = state.failures.filter(f => f.id !== stub.id);
        } catch (e) {
          state.failures = state.failures.filter(f=>f.id!==stub.id);
          state.failures.push({id:stub.id,code:e.code ?? 'INVALID_MEETING'});
        }
      }
      state.scanned = known.size + state.failures.filter(f=>f.id).length;
      // On detail failure keep the current cursor so resume retries this page.
      if (state.failures.length) { await save(state); return state; }
      state.cursor = page.hasMore ? page.cursor : null;
      state.complete = !page.hasMore;
      await save(state);
    }
  } catch(e) { state.failures.push({code:e.code ?? 'SCAN_FAILURE'}); await save(state); }
  return state;
}
export function reviewTemplate(scan) {
  return {format:'granola-review-v1',reviews:scan.candidates.map(c=>({id:c.id,evidenceHash:c.evidenceHash,decision:'ambiguous',reason:'',client:scan.scope.client,projects:[],evidence:[],contextReason:'',relatedSources:[]}))};
}
export function reviewedNote(c, r, scope) {
  if (r.evidenceHash !== c.evidenceHash || c.evidenceHash !== hash({source:c.source,timeBasis:c.timeBasis}) || c.revision !== c.source.revision) throw Error('Stale review');
  if (JSON.stringify(c.transcript) !== c.source.transcript) throw Error('Transcript evidence mismatch');
  if (r.client !== scope.client || !r.contextReason?.trim() || !r.reason?.trim()) throw Error('Explicit client evidence and reason required');
  if (!Array.isArray(r.projects) || !r.projects.length || r.projects.some(p=>typeof p!=='string'||!p.trim())) throw Error('Projects required');
  if (!Array.isArray(r.evidence) || !r.evidence.length) throw Error('Transcript evidence required');
  const signals = new Set();
  for (const e of r.evidence) {
    const turn = c.transcript[e.turn];
    if (!turn || typeof e.quote !== 'string' || !e.quote.trim() || !turn.text.includes(e.quote)) throw Error('Evidence must quote a transcript turn');
    if (!['progress','next','blockers','round_robin','context'].includes(e.signal)) throw Error('Unknown evidence signal');
    signals.add(e.signal);
  }
  if (![...signals].some(s=>s==='progress'||s==='next') || ![...signals].some(s=>s==='blockers'||s==='round_robin')) throw Error('Standup evidence needs updates and blockers/round-robin');
  const time = r.meetingTime ?? c.source.time;
  if (c.timeBasis !== 'transcript' && !r.timeReason?.trim()) throw Error('Confirm actual meeting time with timeReason');
  range(scope.from,scope.to);
  if (!time || !/(Z|[+-]\d{2}:\d{2})$/.test(time) || !(Date.parse(time)>=Date.parse(scope.from) && Date.parse(time)<Date.parse(scope.to))) throw Error('Actual meeting time must be inside scope with timezone');
  let transcript = c.source.transcript, summary = c.source.summary;
  if (r.transcriptTurns !== undefined) {
    if (!Array.isArray(r.transcriptTurns) || !r.transcriptTurns.length || new Set(r.transcriptTurns).size !== r.transcriptTurns.length || r.transcriptTurns.some(i=>!Number.isInteger(i)||!c.transcript[i]) || r.evidence.some(e=>!r.transcriptTurns.includes(e.turn))) throw Error('Reviewed excerpt must include every cited evidence turn');
    if (!r.excerptReason?.trim()) throw Error('Explicit excerpt reason required');
    transcript = JSON.stringify(r.transcriptTurns.map(i=>c.transcript[i]));
  }
  if (r.summaryExcerpt !== undefined) {
    if (typeof r.summaryExcerpt!=='string' || !r.summaryExcerpt.trim() || !c.source.summary.includes(r.summaryExcerpt) || !r.excerptReason?.trim()) throw Error('Summary excerpt must be exact source text with reason');
    summary = r.summaryExcerpt;
  }
  const provenance = {evidenceRetention:{transcript:r.transcriptTurns ? 'reviewed_excerpt' : 'complete', summary:r.summaryExcerpt !== undefined ? 'reviewed_excerpt' : 'complete', originalTranscriptTurns:c.transcript.length, sourceEvidenceHash:c.evidenceHash, excerptReason:r.excerptReason ?? null, originals:'Retained in private local candidate file'},reviewReason:r.reason,contextReason:r.contextReason,evidence:r.evidence,sourceUpdatedAt:c.sourceUpdatedAt,timeBasis:c.timeBasis,timeReason:r.timeReason ?? null,relatedSources:r.relatedSources ?? []};
  const note = {title:c.title || 'Untitled standup',client:r.client,projects:r.projects,date:time.slice(0,10),type:'standup',progress:'',next:'',blockerIds:[],notes:'Imported meeting evidence; proposals and speaker attribution remain unverified.\n'+JSON.stringify(provenance),source:{...c.source,time,summary,transcript}};
  for (const value of [note.notes,note.source.summary,note.source.transcript]) if (value.length>12000) throw Error('App field limit exceeded; retain local original and explicitly select reviewed transcriptTurns/summaryExcerpt');
  return note;
}
export async function importReviewed(scan, review, {request, dryRun = true, save = async () => {}}) {
  if (!scan.complete || scan.failures.length) throw Error('Finish discovery failures before importing');
  if (scan.format!=='granola-candidates-v1' || review.format!=='granola-review-v1') throw Error('Unsupported format');
  const report = {scanned:scan.scanned,candidates:scan.candidates.length,qualifying:0,imported:0,alreadyPresent:0,ambiguous:0,excluded:scan.excluded.length,failures:[],dryRun};
  const ids = new Set(); const planned = [];
  for (const r of review.reviews) {
    if (ids.has(r.id)) throw Error('Duplicate review'); ids.add(r.id);
    const c = scan.candidates.find(c=>c.id===r.id); if (!c) throw Error('Unknown candidate');
    if (!['accepted','ambiguous','excluded'].includes(r.decision)) throw Error('Invalid decision');
    if (r.decision==='excluded') { if (!r.reason?.trim()) throw Error('Exclusion reason required'); report.excluded++; continue; }
    if (r.decision!=='accepted') { report.ambiguous++; continue; }
    planned.push(reviewedNote(c,r,scan.scope)); report.qualifying++;
  }
  report.ambiguous += scan.candidates.filter(c=>!ids.has(c.id)).length;
  if (dryRun) return report;
  const config = await request('/api/config');
  if (config.mode!=='private' || config.readOnly!==false) throw Error('Authenticated writable private instance required');
  for (const note of planned) {
    try {
      const result = await request('/api/import',{method:'POST',data:note});
      if (!result.entry?.id) throw Error('Invalid import response');
      result.duplicate ? report.alreadyPresent++ : report.imported++;
    } catch { report.failures.push({code:'IMPORT_FAILED',index:report.imported+report.alreadyPresent}); await save(report); break; }
    await save(report);
  }
  return report;
}
