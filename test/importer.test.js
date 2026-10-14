import {test} from 'node:test';import assert from 'node:assert/strict';import {parseArchive} from '../scripts/import-archive.mjs';
const c={client:'Fictional Harbor',projects:['Checkout']};
test('archive source is complete and content-addressed; repeated parse is identical',()=>{const text='# Standup\n## Progress\nHBR-142\n## Next\nReview\n## Blockers\nWaiting';const a=parseArchive(text,'standup-2026-10-14.md',c);assert.deepEqual(a,parseArchive(text,'standup-2026-10-14.md',c));assert.equal(a.progress,'HBR-142');assert.equal(a.next,'Review');assert.equal(a.source.summary,text);assert.notEqual(a.importKey,parseArchive(text+' changed','standup-2026-10-14.md',c).importKey);});
test('invalid archive records are explicit failures',()=>{assert.throws(()=>parseArchive('# Nothing','invalid.md',c),/Missing ISO date/);assert.throws(()=>parseArchive('','2026-10-14.md',c),/Empty record/);});

test('historical date and weekday headings map to progress without altering original evidence',()=>{
 const original='# Standup\r\n## Since 2026-10-08\r\nFinished fictional review\r\n## Monday\r\nShipped fictional change\r\n## Friday — 2026-10-09\r\nChecked fictional release\r\n## Next\r\nFollow up\r\n\r\n';
 const parsed=parseArchive(original,'2026-10-14.md',c);
 assert.match(parsed.progress,/Finished fictional review/);assert.match(parsed.progress,/Shipped fictional change/);assert.match(parsed.progress,/Checked fictional release/);
 assert.equal(parsed.next,'Follow up');assert.equal(parsed.source.summary,original);
 assert.deepEqual(parsed,parseArchive(original,'2026-10-14.md',c));
});
