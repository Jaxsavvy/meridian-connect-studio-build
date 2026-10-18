'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../../src/renderer/studio-ui/website-builder.js');
function setup(){const storage=W.createMemoryStorage();let n=0;const c=W.createController({storage,idFactory:p=>p+'-extended-'+(++n)});c.selectContext({id:'synthetic-clock',name:'Clock'});c.createProject('Clock draft');return {storage,c};}
test('catalogue orders valid instants across timezone offsets and places unknown dates last',()=>{
 const {storage,c}=setup(),source=c.snapshot().project;const entries=[['late','2026-10-18T10:00:00-07:00'],['early','2026-10-18T11:00:00+00:00'],['unknown','invalid-date']];for(const[id,updatedAt]of entries){const p={...source,id,updatedAt};storage.setItem('meridian.website.synthetic-clock.'+id,JSON.stringify(p));}const list=W.createRepository(storage,'synthetic-clock').list().filter(p=>entries.some(([id])=>id===p.id));assert.deepEqual(list.map(p=>p.id),['late','early','unknown']);
});
test('saved date presentation handles invalid, missing, future and localized dates without exposing raw invalid text',()=>{
 assert.equal(typeof W.formatSavedDate,'function');for(const value of [null,undefined,'','not-a-date',{}])assert.equal(W.formatSavedDate(value,'en-US'),'Date unavailable');const iso='2099-10-18T12:00:00Z';assert.ok(W.formatSavedDate(iso,'en-US').includes('2099'));assert.ok(W.formatSavedDate(iso,'de-DE').includes('2099'));assert.notEqual(W.formatSavedDate(iso,'en-US'),W.formatSavedDate(iso,'de-DE'));assert.equal(W.formatSavedDate('invalid<script>','ar'),'Date unavailable');
});
test('missing saved timestamps retain valid backup and malformed records never replace retained bytes',()=>{
 const {storage,c}=setup(),p=c.snapshot().project,key='meridian.website.synthetic-clock.'+p.id,raw=storage.getItem(key);storage.setItem(key+'.backup',raw);const malformed={...p};delete malformed.updatedAt;storage.setItem(key,JSON.stringify(malformed));const before=storage.getItem(key);assert.equal(c.openProject(p.id),true);assert.equal(storage.getItem(key),before);assert.equal(c.snapshot().project.updatedAt,p.updatedAt);
});
test('clock rollback across save and checkpoint restore does not roll back revision',()=>{
 const {storage,c}=setup();const id=c.snapshot().project.id;let time='2099-10-18T12:00:00Z';const b=W.createController({storage,now:()=>time});b.selectContext({id:'synthetic-clock',name:'Clock'});b.openProject(id);b.updateBrief('goal','Future clock');b.save();b.createCheckpoint('Future');const revision=b.snapshot().project.revision;time='2000-01-01T00:00:00Z';b.updateBrief('goal','Clock rolled back');b.save();b.restoreCheckpoint(b.snapshot().checkpoints[0].id);b.save();assert.ok(b.snapshot().project.revision>revision);assert.equal(b.snapshot().project.brief.goal,'Future clock');
});
test('right-to-left and expanded labels remain escaped in preview/export without losing content',()=>{
 const {c}=setup();const s=c.snapshot().project.pages[0].sections[0].id;c.updatePage('title','مرحبا — Prüfüberschrift '.repeat(5));c.updateSection(s,'heading','שלום <inert>');c.updateSection(s,'body','עברית العربية 😀 e\u0301');const html=c.exportSite().files['index.html'];assert.match(html,/שלום &lt;inert&gt;/);assert.match(html,/العربية/);assert.doesNotMatch(html,/<inert>/);
});

test('malformed checkpoint diagnostics omit retained document contents',()=>{
 const {storage,c}=setup(),p=c.snapshot().project;const key='meridian.website-checkpoints.synthetic-clock.'+encodeURIComponent(p.id),raw='{PRIVATE_SYNTHETIC_SENTINEL';storage.setItem(key,raw);c.openProject(p.id);const state=c.snapshot();assert.ok(state.checkpointError);assert.doesNotMatch(state.checkpointError,/PRIVATE_SYNTHETIC_SENTINEL/);assert.equal(storage.getItem(key),raw);
});
