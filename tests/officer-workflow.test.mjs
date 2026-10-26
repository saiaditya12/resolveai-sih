import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOfficerAction,validateOfficerAction,filterQueue,defaultQueueFilters,officerMetrics,officerSla,institutionHistory } from '../src/lib/officer-model.ts';
const at='2026-10-24T10:00:00+05:30';
const base={id:'test-1',title:'Example case',institution:'Fictional Institute',category:'Fees / Refund',status:'Officer Review',updatedAt:'2026-10-23T10:00:00+05:30',priority:'High',cellId:'student',submittedAt:'2026-10-22T10:00:00+05:30',dueAt:'2026-10-27T10:00:00+05:30',events:[],description:'Fictional complaint',student:{name:'Demo',incidentDate:'',contacted:'No'},summary:{text:'Mock',source:'Prewritten mock intelligence',suggestion:'Mock',reason:'Mock'},evidence:[],similar:[]};
test('request information records recipient, due date and audit event without mutating input',()=>{
 for(const recipient of ['Student','Institution']){const next=applyOfficerAction(base,{type:'request',recipient,text:'Please provide the sample acknowledgement.',dueDate:'2026-10-28'},at,recipient);assert.equal(next.status,recipient==='Student'?'Student Action Required':'Institution Response Requested');assert.equal(next.events.length,1);assert.match(next.events[0].explanation,/2026-10-28/);assert.match(next.events[0].explanation,/no message sent/);}
 assert.equal(base.events.length,0);assert.equal(base.status,'Officer Review');
});
test('request validation rejects empty text, impossible and past dates',()=>{
 const action={type:'request',recipient:'Student',text:'Valid request for a sample receipt.',dueDate:''};assert.equal(validateOfficerAction(base,action,'2026-10-24'),null);
 for(const dueDate of ['2026-02-30','2026-10-23','invalid'])assert.ok(validateOfficerAction(base,{...action,dueDate},'2026-10-24'));
 assert.ok(validateOfficerAction(base,{...action,text:' '},'2026-10-24'));
});
test('transfer changes ownership and cell-scoped queue membership',()=>{
 const next=applyOfficerAction(base,{type:'transfer',cellId:'finance',reason:'Sample finance context requires specialist review.'},at,'transfer');assert.equal(next.cellId,'finance');assert.equal(filterQueue([next],defaultQueueFilters).length,0);assert.equal(filterQueue([next],{...defaultQueueFilters,scope:'all'}).length,1);assert.match(next.events[0].explanation,/Finance/);
 for(const cellId of ['student','unknown'])assert.ok(validateOfficerAction(base,{type:'transfer',cellId,reason:'Sufficient demo reason.'},'2026-10-24'));
});
test('status, escalation and resolution append immutable audit history and finalise actions',()=>{
 let next=applyOfficerAction(base,{type:'status',status:'Institution Response Requested',note:'Waiting for fictional institution confirmation.'},at,'status');next=applyOfficerAction(next,{type:'escalate',reason:'The sample institution has not provided confirmation.'},at,'escalate');assert.equal(officerSla(next).state,'Escalated');
 next=applyOfficerAction(next,{type:'resolve',summary:'Fictional payment confirmation was recorded.',action:'Verified the sample receipt and documented the outcome.',reference:'DEMO-123'},at,'resolve');assert.equal(next.status,'Resolved');assert.equal(next.resolution.reference,'DEMO-123');assert.equal(next.events.length,3);assert.equal(officerSla(next).state,'Complete');assert.ok(validateOfficerAction(next,{type:'escalate',reason:'Another sufficient reason.'},'2026-10-24'));assert.equal(base.events.length,0);
});
test('combined queue facets, empty results and all sorting modes are deterministic',()=>{
 const items=[base,{...base,id:'test-2',priority:'Critical',status:'Escalated',category:'Records',institution:'Other Demo',submittedAt:'2026-10-21T10:00:00+05:30',dueAt:'2026-10-20T10:00:00+05:30'},{...base,id:'test-3',priority:'Low',submittedAt:'2026-10-23T10:00:00+05:30'}];
 assert.equal(filterQueue(items,{...defaultQueueFilters,status:'Escalated',priority:'Critical',category:'Records',sla:'Escalated',institution:'Other Demo'})[0].id,'test-2');
 assert.equal(filterQueue(items,{...defaultQueueFilters,priority:'Low',status:'Escalated'}).length,0);
 for(const [sort,id] of [['priority','test-2'],['newest','test-3'],['oldest','test-2'],['overdue','test-2']])assert.equal(filterQueue(items,{...defaultQueueFilters,sort})[0].id,id);
 assert.deepEqual(items.map(c=>c.id),['test-1','test-2','test-3']);
});
test('SLA and dashboard metrics distinguish waiting, overdue and resolved records',()=>{
 const waiting={...base,status:'Student Action Required'};const overdue={...base,id:'old',status:'Assigned',dueAt:'2026-10-20T10:00:00+05:30'};const resolved=applyOfficerAction(base,{type:'resolve',summary:'The sample outcome has been confirmed.',action:'Recorded a fictional transaction reference.',reference:''},at,'resolve');
 assert.deepEqual(officerMetrics([base,waiting,overdue,resolved]),{new:1,active:3,needsAction:2,overdue:1,resolvedWeek:1});assert.equal(officerSla(base).state,'On Track');assert.equal(officerSla({...base,dueAt:'2026-10-24T22:00:00+05:30'}).state,'Due Soon');assert.equal(officerSla(overdue).state,'Overdue');
});
test('institution counts derive only from the last ninety demo days',()=>{
 const history=institutionHistory([base,{...base,id:'old',submittedAt:'2025-01-01T00:00:00Z'},{...base,id:'two',status:'Resolved'}],'Fictional Institute');assert.equal(history.total,2);assert.equal(history.open,1);assert.equal(history.resolved,1);assert.equal(history.topCategory,'Fees / Refund');
});
test('resolution cannot bypass summary and action validation',()=>{
 assert.ok(validateOfficerAction(base,{type:'resolve',summary:' ',action:'Enough detail in the action taken.',reference:''},'2026-10-24'));assert.ok(validateOfficerAction(base,{type:'resolve',summary:'Enough detail in the resolution.',action:' ',reference:''},'2026-10-24'));assert.throws(()=>applyOfficerAction(base,{type:'status',status:'Resolved',note:'Attempt to bypass structured resolution.'},at,'bad'));
});

test('action guards reject duplicate escalation, unchanged statuses and text boundaries', () => {
 const day='2026-10-24';
 assert.match(validateOfficerAction({...base,status:'Escalated'},{type:'escalate',reason:'Valid fictional escalation reason.'},day),/already escalated/);
 assert.match(validateOfficerAction(base,{type:'status',status:'Officer Review',note:'Valid fictional status note.'},day),/different status/);
 for(const text of ['', 'short', 'x'.repeat(2001)]) {
  assert.ok(validateOfficerAction(base,{type:'request',recipient:'Student',text,dueDate:''},day));
  assert.ok(validateOfficerAction(base,{type:'status',status:'Student Action Required',note:text},day));
  assert.ok(validateOfficerAction(base,{type:'transfer',cellId:'finance',reason:text},day));
  assert.ok(validateOfficerAction(base,{type:'escalate',reason:text},day));
 }
 assert.ok(validateOfficerAction(base,{type:'resolve',summary:'Valid fictional summary.',action:'Valid fictional action taken.',reference:'x'.repeat(121)},day));
 for(const status of ['Resolved','Closed']) for(const action of [
  {type:'request',recipient:'Student',text:'Valid fictional request.',dueDate:''},
  {type:'status',status:'Officer Review',note:'Valid fictional note.'},
  {type:'transfer',cellId:'finance',reason:'Valid fictional reason.'},
  {type:'escalate',reason:'Valid fictional reason.'},
  {type:'resolve',summary:'Valid fictional summary.',action:'Valid fictional action.',reference:''},
 ]) assert.match(validateOfficerAction({...base,status},action,day),/Further actions are unavailable/);
});
