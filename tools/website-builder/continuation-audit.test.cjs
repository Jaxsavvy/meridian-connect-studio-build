'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const W=require('../../src/renderer/studio-ui/website-builder.js');
function setup(storage=W.createMemoryStorage()){let i=0;const c=W.createController({storage,idFactory:prefix=>prefix+'-continuation-'+(++i),now:()=> '2026-10-18T00:00:00.000Z'});c.selectContext({id:'synthetic-a',name:'Synthetic A'});assert.equal(c.createProject('Continuation site'),true);return {storage,c};}
function bytes(s){return Array.from({length:s.length},(_,i)=>[s.key(i),s.getItem(s.key(i))]).sort((a,b)=>a[0].localeCompare(b[0]));}
function seed(s,project,id){const p=structuredClone(project);p.id=id;p.name='Retained '+id;s.setItem('meridian.website.synthetic-a.'+encodeURIComponent(id),JSON.stringify(p));return p;}

test('2: reserved catalogue identity cannot replace saved project bytes',()=>{
 const {c}=setup();const storage=W.createMemoryStorage();const p=c.snapshot().project;p.id='index';const before=bytes(storage);
 assert.throws(()=>W.createRepository(storage,'synthetic-a').save(p),/identity|overlap|reserved/i);assert.deepEqual(bytes(storage),before);
});
test('2/3: recovery key aliases preserve both retained websites and allow separate-copy escape',()=>{
 for(const suffix of ['.backup','.pending'])for(const edited of ['parent','child']){
  const {storage,c}=setup(),source=c.snapshot().project;
  const parent=seed(storage,source,'retained'),child=seed(storage,source,'retained'+suffix),before=bytes(storage);
  assert.equal(c.openProject(edited==='parent'?parent.id:child.id),true);c.updateBrief('goal','Keep these unsaved edits');
  assert.equal(c.save(),false,'Aliased storage must not be overwritten');assert.deepEqual(bytes(storage),before);assert.equal(c.snapshot().dirty,true);
  assert.equal(c.saveSeparateCopy(),true);assert.equal(c.snapshot().project.brief.goal,'Keep these unsaved edits');
  for(const p of [parent,child])assert.deepEqual(JSON.parse(storage.getItem('meridian.website.synthetic-a.'+p.id)),p);
 }
});
test('2: every explicit-save write/cleanup failure preserves a recoverable draft and safe retry',()=>{
 for(let at=1;at<=5;at++){
  const memory=W.createMemoryStorage();let armed=false,count=0;
  const s={getItem:k=>memory.getItem(k),key:i=>memory.key(i),get length(){return memory.length;},setItem(k,v){if(armed&&++count===at)throw Error('Synthetic write failure');memory.setItem(k,v);},removeItem(k){if(armed&&++count===at)throw Error('Synthetic cleanup failure');memory.removeItem(k);}};
  const {c}=setup(s);const original=c.snapshot().project;c.updateBrief('goal','Current draft');armed=true;assert.equal(c.save(),false);armed=false;
  const retained=W.createRepository(s,'synthetic-a').open(original.id);assert.ok(retained);assert.equal(c.snapshot().project.brief.goal,'Current draft');assert.equal(c.save(),true);assert.equal(W.createRepository(s,'synthetic-a').open(original.id).brief.goal,'Current draft');
 }
});
test('3: two windows refuse stale overwrites after undo and checkpoint restoration',()=>{
 const {storage,c}=setup();const id=c.snapshot().project.id;const b=W.createController({storage});b.selectContext({id:'synthetic-a',name:'A'});b.openProject(id);
 c.updateBrief('goal','Version one');c.save();c.createCheckpoint('One');c.updateBrief('goal','Version two');c.save();assert.equal(b.updateBrief('goal','Stale edit'),true);const before=bytes(storage);assert.equal(b.save(),false);assert.deepEqual(bytes(storage),before);
 c.restoreCheckpoint(c.snapshot().checkpoints[0].id);c.undo();c.redo();assert.equal(c.save(),true);assert.equal(c.snapshot().project.brief.goal,'Version one');
});
test('4: malformed checkpoint envelope is reported and bytes remain untouched',()=>{
 for(const malformed of ['null','[]','true','{"schema":"foreign"}']){const {storage,c}=setup();const id=c.snapshot().project.id,key='meridian.website-checkpoints.synthetic-a.'+id;storage.setItem(key,malformed);c.close();assert.equal(c.openProject(id),true);assert.match(c.snapshot().checkpointError||'',/checkpoint/i);assert.equal(storage.getItem(key),malformed);assert.match(c.snapshot().error,/Checkpoint history/);}
});
test('4/13: checkpoint history retry preserves current edits and discovers repaired history',()=>{
 const {storage,c}=setup();const id=c.snapshot().project.id;c.createCheckpoint('Before fault');const key='meridian.website-checkpoints.synthetic-a.'+id,good=storage.getItem(key);storage.setItem(key,'null');c.close();c.openProject(id);c.updateBrief('audience','Keep unsaved audience');const before=c.snapshot().project;
 assert.equal(typeof c.refreshCheckpointHistory,'function');assert.equal(c.refreshCheckpointHistory(),false);assert.deepEqual(c.snapshot().project,before);
 storage.setItem(key,good);assert.equal(c.refreshCheckpointHistory(),true);assert.equal(c.snapshot().checkpointError,null);assert.equal(c.snapshot().dirty,true);assert.equal(c.snapshot().checkpoints.length,1);assert.deepEqual(c.snapshot().project,before);
});
test('5/6/7: nested deletion, linked action clearing and checkpoint restore compose with undo/redo',()=>{
 const {c}=setup();const home=c.snapshot().selectedPageId;c.addPage('Services');const services=c.snapshot().selectedPageId;c.addPage('Child');const child=c.snapshot().selectedPageId;c.updatePage('parentPageId',services);c.selectPage(home);const section=c.snapshot().project.pages[0].sections[0].id;c.updateSection(section,'actionPageId',services);c.makeSectionShared(section);const shared=c.snapshot().project.pages[0].sections[0].sharedId;c.selectPage(child);c.addSharedSection(shared);c.save();c.createCheckpoint('Linked hierarchy');c.removePage(services);let p=c.snapshot().project;assert.equal(p.pages.find(x=>x.id===child).parentPageId,'');assert.ok(p.pages.flatMap(x=>x.sections).filter(x=>x.sharedId===shared).every(x=>x.actionPageId===''));c.undo();assert.ok(c.snapshot().project.pages.some(x=>x.id===services));c.redo();c.save();c.restoreCheckpoint(c.snapshot().checkpoints[0].id);assert.ok(c.snapshot().project.pages.some(x=>x.id===services));c.save();assert.ok(Object.keys(c.exportSite().files).includes('services.html'));
});
test('6: all50 pages,100 sections and three-level limits reject excess without changing drafts/history',()=>{
 const {c}=setup();for(let i=1;i<50;i++)assert.equal(c.addPage('Same name'),true);assert.equal(c.snapshot().project.pages.length,50);const before=c.snapshot().project;assert.equal(c.addPage('One too many'),false);assert.deepEqual(c.snapshot().project,before);const id=c.snapshot().selectedPageId;for(let i=c.snapshot().project.pages.find(p=>p.id===id).sections.length;i<100;i++)assert.equal(c.addSection(),true);const full=c.snapshot().project;assert.equal(c.addSection(),false);assert.deepEqual(c.snapshot().project,full);assert.equal(new Set(Object.keys(c.exportSite().files)).size,50);
});
test('7: detach changes stay local and checkpoint restoration restores linked propagation',()=>{
 const {c}=setup();const home=c.snapshot().selectedPageId,s=c.snapshot().project.pages[0].sections[0].id;c.makeSectionShared(s);const shared=c.snapshot().project.pages[0].sections[0].sharedId;c.addPage('Other');c.addSharedSection(shared);const other=c.snapshot().selectedPageId,copy=c.snapshot().project.pages[1].sections.at(-1).id;c.save();c.createCheckpoint('Linked');c.detachSection(copy);c.updateSection(copy,'heading','Independent');c.selectPage(home);c.updateSection(s,'heading','Original');assert.equal(c.snapshot().project.pages[1].sections.at(-1).heading,'Independent');c.save();c.restoreCheckpoint(c.snapshot().checkpoints[0].id);c.selectPage(other);c.updateSection(copy,'heading','Again linked');assert.equal(c.snapshot().project.pages[0].sections[0].heading,'Again linked');
});
test('8: Unicode, literal pasted markup and formatting-limit failure retain safe content and redo',()=>{
 const {c}=setup();const sid=c.snapshot().project.pages[0].sections[0].id;const text='Emoji 😀; e\u0301; 漢字\n<script>inert</script> & "quoted"';c.updateSection(sid,'body',text);c.formatSectionText(sid,'bold',0,5);c.formatSectionText(sid,'bullets',0,10);const html=c.preview();assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);c.updateSection(sid,'body','x'.repeat(8000));const before=c.snapshot().project;assert.equal(c.formatSectionText(sid,'bold',0,8000),false);assert.deepEqual(c.snapshot().project,before);c.undo();assert.equal(c.redo(),true);assert.equal(c.snapshot().project.pages[0].sections[0].body.length,8000);
});
test('9: reserved filenames, escaped navigation and every internal link resolve within exported site',()=>{
 const {c}=setup();for(const name of ['CON','NUL','COM1','Index','A & <B>','漢字'])c.addPage(name);const bundle=c.exportSite(),files=Object.keys(bundle.files);assert.equal(files.length,7);for(const [file,html]of Object.entries(bundle.files)){assert.match(file,/^[a-z0-9-]+\.html$/);assert.doesNotMatch(file,/^(con|nul|com1)\.html$/);for(const match of html.matchAll(/href="([^"]+)"/g))assert.ok(files.includes(match[1]));assert.doesNotMatch(html,/<B>/);}
});

test('4/12: checkpoint error state clears across project switch and discard refreshes another window history',()=>{
 const {storage,c}=setup();const id=c.snapshot().project.id;c.createCheckpoint('Original');const key='meridian.website-checkpoints.synthetic-a.'+id,good=storage.getItem(key);storage.setItem(key,'null');c.close();c.openProject(id);assert.ok(c.snapshot().checkpointError);c.selectContext({id:'synthetic-b',name:'B'});assert.equal(c.snapshot().checkpointError,null);storage.setItem(key,good);c.selectContext({id:'synthetic-a',name:'A'});c.openProject(id);c.updateBrief('goal','Discard just this change');const other=W.createController({storage});other.selectContext({id:'synthetic-a',name:'A'});other.openProject(id);other.removeCheckpoint(other.snapshot().checkpoints[0].id);assert.equal(c.discard(),true);assert.equal(c.snapshot().checkpoints.length,0);assert.equal(c.snapshot().checkpointError,null);
});
test('2: standalone legacy recovery-suffix identities remain editable when no storage alias exists',()=>{
 for(const suffix of ['.backup','.pending']){const {storage,c}=setup();const legacy=seed(storage,c.snapshot().project,'standalone'+suffix);c.openProject(legacy.id);c.updateBrief('goal','Still supported');assert.equal(c.save(),true);assert.equal(c.snapshot().project.brief.goal,'Still supported');}
});
