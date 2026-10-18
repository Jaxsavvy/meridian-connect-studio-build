'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryStorage, createRepository, createController, renderPage, exportSite } = require('../../src/renderer/studio-ui/website-builder.js');

test('page and section management is bounded, undoable, and keeps selection valid', () => {
  const active = controller();
  active.createProject('Manage site');
  const home = active.snapshot().selectedPageId;
  active.addPage('Services');
  const services = active.snapshot().selectedPageId;
  assert.equal(active.movePage(services, -1), true);
  assert.equal(active.snapshot().project.pages[0].id, services);
  assert.equal(active.movePage(services, -1), false);
  assert.equal(active.removePage(services), true);
  assert.equal(active.snapshot().selectedPageId, home);
  active.undo();
  assert.equal(active.snapshot().selectedPageId, services);
  active.redo();
  assert.equal(active.removePage(home), false, 'Keep at least one page');
  active.undo();
  assert.equal(active.snapshot().project.pages.length, 2, 'Rejected deletion retains redo/history');
  active.selectPage(home);
  const sections = active.snapshot().project.pages.find(p => p.id === home).sections;
  assert.equal(active.moveSection(sections[1].id, -1), true);
  assert.equal(active.removeSection(sections[0].id), true);
  active.undo();
  assert.deepEqual(active.snapshot().project.pages.find(p => p.id === home).sections.map(s => s.id), [sections[1].id, sections[0].id]);
  assert.equal(active.removeSection('missing'), false);
  assert.equal(active.moveSection(sections[1].id, 2), false);
  active.save();
  active.openProject(active.snapshot().project.id);
  assert.equal(active.snapshot().project.pages.find(p => p.id === home).sections[0].id, sections[1].id);
});

test('safe global styles persist, undo, and apply to every exported page', () => {
  const active = controller();
  active.createProject('Styled site');
  active.addPage('About');
  assert.equal(active.updateDesign('accent', '#16715a'), true);
  assert.equal(active.updateDesign('font', 'serif'), true);
  for (const html of Object.values(active.exportSite().files)) {
    assert.match(html, /--accent:#16715a/);
    assert.match(html, /Georgia/);
  }
  assert.equal(active.updateDesign('font', 'serif; background:url(https://bad)'), false);
  assert.equal(active.updateDesign('accent', '#fff; color:red'), false);
  active.undo();
  assert.equal(active.snapshot().project.design.font, 'system-ui');
  active.redo();
  active.save();
  active.openProject(active.snapshot().project.id);
  assert.equal(active.snapshot().project.design.font, 'serif');
});

test('preview navigation is inert while standalone export links all pages', () => {
  const active = controller();
  active.createProject('Preview site');
  active.addPage('About');
  assert.match(active.preview(), /<span aria-current="page">About<\/span>/);
  assert.doesNotMatch(active.preview(), /href="(?:index|about)\.html"/);
  assert.match(active.exportSite().files['index.html'], /href="about.html"/);
});

test('custom accent retains readable action text at light and dark extremes', () => {
  const active = controller();
  active.createProject('Contrast');
  active.updateDesign('accent', '#ffffff');
  assert.match(active.preview(), /color:#000;background:var\(--accent\)/);
  active.updateDesign('accent', '#000000');
  assert.match(active.preview(), /color:#fff;background:var\(--accent\)/);
  assert.match(active.preview(), /section-hero \.eyebrow\{color:#c7e4fb\}/);
});

test('archive filenames are portable and deleting the home page is rejected without losing redo', () => {
  const active = controller();
  active.createProject('Portable');
  const home = active.snapshot().selectedPageId;
  active.addPage('CON');
  active.addPage('page-con');
  assert.deepEqual(Object.keys(active.exportSite().files), ['index.html', 'page-con.html', 'page-con-2.html']);
  active.undo();
  assert.equal(active.removePage(home), false);
  assert.equal(active.redo(), true);
  const invalid = active.snapshot().project;
  invalid.pages[1].slug = 'a'.repeat(121);
  assert.throws(() => exportSite(invalid), /slug is invalid/);
});

test('whole-site ZIP has correct UTF-8 content, CRCs, central directory and safe names', () => {
  const active = controller();
  active.createProject('Café site');
  active.addPage('About Us');
  active.updateSection(active.snapshot().project.pages[1].sections[0].id, 'body', 'Café ☕ — synthetic');
  const archive = active.exportArchive();
  const data = Buffer.from(archive.bytes);
  const expected = active.exportSite().files;
  const names = [];
  let offset = 0;
  function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
    return (value ^ 0xffffffff) >>> 0;
  }
  while (data.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(data.readUInt16LE(offset + 6), 0x0800);
    assert.equal(data.readUInt16LE(offset + 8), 0);
    const size = data.readUInt32LE(offset + 18);
    const nameLength = data.readUInt16LE(offset + 26);
    const name = data.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const body = data.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    assert.equal(body.toString('utf8'), expected[name]);
    assert.equal(data.readUInt32LE(offset + 14), crc32(body));
    names.push(name);
    offset += 30 + nameLength + size;
  }
  assert.deepEqual(names, Object.keys(expected));
  assert.equal(data.readUInt32LE(offset), 0x02014b50);
  const end = data.length - 22;
  assert.equal(data.readUInt32LE(end), 0x06054b50);
  assert.equal(data.readUInt16LE(end + 10), 2);
  assert.equal(data.readUInt32LE(end + 16), offset);
  assert.match(archive.name, /^[a-z0-9-]+\.zip$/);
  assert.equal(active.snapshot().dirty, true, 'Download must not pretend to save the project');
});

const meridianProject = { id: 'project-alpha', name: 'Synthetic Alpha' };

test('saved local checkpoints survive restart and restore only as undoable unsaved drafts', () => {
  const storage = createMemoryStorage();
  const active = controller(storage, 'checkpoints'); active.createProject('Checkpoint site');
  active.updateBrief('goal','First goal');
  assert.equal(active.createCheckpoint('Too early'), false);
  active.save(); assert.equal(active.createCheckpoint('First draft'), true);
  const checkpoint = active.snapshot().checkpoints[0];
  active.updateBrief('goal','Second goal'); active.save();
  const revision=active.snapshot().project.revision;
  const restarted=controller(storage,'reopen'); restarted.openProject(active.snapshot().project.id);
  assert.equal(restarted.snapshot().checkpoints[0].label,'First draft');
  assert.equal(restarted.restoreCheckpoint(checkpoint.id),true);
  assert.equal(restarted.snapshot().project.brief.goal,'First goal');
  assert.equal(restarted.snapshot().project.revision,revision);
  assert.equal(restarted.snapshot().dirty,true);
  assert.equal(createRepository(storage,meridianProject.id).open(active.snapshot().project.id).brief.goal,'Second goal','Restore must not write primary');
  restarted.undo(); assert.equal(restarted.snapshot().project.brief.goal,'Second goal');
  restarted.redo(); assert.equal(restarted.snapshot().project.brief.goal,'First goal');
});

test('checkpoint restore cannot overwrite dirty edits or cross website/project identity', () => {
  const storage=createMemoryStorage();const active=controller(storage,'scope');active.createProject('First');active.createCheckpoint('Clean');
  const checkpoint=active.snapshot().checkpoints[0],websiteId=active.snapshot().project.id;
  active.updateBrief('goal','Keep dirty');assert.equal(active.restoreCheckpoint(checkpoint.id),false);assert.equal(active.snapshot().project.brief.goal,'Keep dirty');
  active.save();active.createProject('Other');assert.equal(active.restoreCheckpoint(checkpoint.id),false);assert.deepEqual(active.snapshot().checkpoints,[]);
  const key=`meridian.website-checkpoints.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(websiteId)}`;
  const history=JSON.parse(storage.getItem(key));history.checkpoints[0].project.meridianProjectId='foreign';storage.setItem(key,JSON.stringify(history));
  assert.equal(active.openProject(websiteId),true,'Corrupt history must not prevent primary website opening');
  assert.deepEqual(active.snapshot().checkpoints,[]);
  assert.equal(active.restoreCheckpoint(checkpoint.id),false);
  assert.match(active.snapshot().error,/checkpoint/i);
});

test('checkpoint storage failure leaves saved primary and edits unchanged', () => {
  const base=createMemoryStorage();let fail=false;const storage={...base,setItem(key,value){if(fail&&key.startsWith('meridian.website-checkpoints.'))throw Error('Checkpoint quota');base.setItem(key,value);}};
  const active=controller(storage,'quota');active.createProject('Quota');active.createCheckpoint('Before');
  const before=active.snapshot().project;fail=true;assert.equal(active.createCheckpoint('Failed'),false);
  assert.deepEqual(active.snapshot().project,before);assert.equal(active.snapshot().dirty,false);
  assert.equal(active.snapshot().checkpoints.length,1);assert.match(active.snapshot().error,/Checkpoint quota/);
});

test('local readiness never grants review, approval or publish authority', () => {
  const active=controller();active.createProject('Readiness');
  assert.equal(active.readiness().canPublish,false);assert.equal(active.readiness().canApprove,false);
  assert.equal(active.readiness().checks.find(check=>check.id==='brief').passed,false);
  for(const field of ['audience','goal','tone','offer']) active.updateBrief(field,'Synthetic answer');
  active.updateSection(active.snapshot().project.pages[0].sections[0].id,'actionPageId',active.snapshot().selectedPageId);
  active.save();const ready=active.readiness();assert.ok(ready.checks.every(check=>check.passed));
  assert.equal(ready.canPublish,false);assert.equal(ready.canApprove,false);assert.match(ready.limit,/service/i);
  active.selectContext({id:'project-beta',name:'Beta'});assert.equal(active.readiness().websiteOpen,false);
});

test('checkpoint bounds keep existing history and never pollute primary-index recovery', () => {
  const storage=createMemoryStorage(),active=controller(storage,'bounded');active.createProject('Bounded');
  for(let index=0;index<10;index++) assert.equal(active.createCheckpoint(`Checkpoint ${index}`),true);
  const before=active.snapshot().checkpoints;
  assert.equal(active.createCheckpoint('Eleventh'),false);assert.deepEqual(active.snapshot().checkpoints,before);
  storage.setItem(`meridian.website.${encodeURIComponent(meridianProject.id)}.index`,'{broken');
  assert.equal(createRepository(storage,meridianProject.id).list().length,1);
  active.close();assert.deepEqual(active.snapshot().checkpoints,[]);
});

test('stale window cannot checkpoint a newer saved primary from another window', () => {
  const storage=createMemoryStorage(),first=controller(storage,'first');first.createProject('Shared local site');
  const second=controller(storage,'second');second.openProject(first.snapshot().project.id);second.updateBrief('goal','Newer window');second.save();
  assert.equal(first.createCheckpoint('Stale'),false);assert.match(first.snapshot().error,/changed elsewhere/);
  assert.equal(createRepository(storage,meridianProject.id).open(first.snapshot().project.id).brief.goal,'Newer window');
});

function controller(storage = createMemoryStorage(), id = 'one') {
  let sequence = 0;
  const value = createController({
    storage,
    now: () => `2026-10-14T00:00:0${sequence++}.000Z`,
    idFactory: prefix => `${prefix}-${id}-${sequence++}`,
  });
  value.selectContext(meridianProject);
  return value;
}

test('creates, saves, and reopens a website project after controller restart', () => {
  const storage = createMemoryStorage();
  const first = controller(storage, 'persist');
  assert.equal(first.createProject('Roof Co'), true);
  first.updateBrief('audience', 'Oregon homeowners');
  first.addPage('Services');
  assert.equal(first.save(), true);
  const saved = first.snapshot();
  assert.equal(saved.dirty, false);
  assert.equal(saved.project.pages.length, 2);

  const restarted = controller(storage, 'restart');
  assert.equal(restarted.snapshot().projects.length, 1);
  assert.equal(restarted.openProject(saved.project.id), true);
  assert.equal(restarted.snapshot().project.brief.audience, 'Oregon homeowners');
  assert.equal(restarted.snapshot().project.pages[1].slug, 'services');
});

test('isolates website records between Meridian projects', () => {
  const storage = createMemoryStorage();
  const alpha = controller(storage, 'alpha');
  alpha.createProject('Alpha site');
  const id = alpha.snapshot().project.id;

  const beta = createController({ storage, idFactory: prefix => `${prefix}-beta` });
  beta.selectContext({ id: 'project-beta', name: 'Synthetic Beta' });
  assert.deepEqual(beta.snapshot().projects, []);
  assert.equal(beta.openProject(id), false);
});

test('recovers a valid backup when the primary record is malformed', () => {
  const storage = createMemoryStorage();
  const active = controller(storage, 'recover');
  active.createProject('Recovery site');
  active.updateBrief('goal', 'First saved value');
  active.save();
  active.updateBrief('goal', 'Second saved value');
  active.save();
  const id = active.snapshot().project.id;
  storage.setItem(`meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(id)}`, '{broken');

  const recovered = createRepository(storage, meridianProject.id).open(id);
  assert.equal(recovered.brief.goal, 'First saved value');
});

test('rebuilds a corrupted project index from validated primary records', () => {
  const storage = createMemoryStorage();
  const active = controller(storage, 'index');
  active.createProject('Indexed site');
  storage.setItem(`meridian.website.${encodeURIComponent(meridianProject.id)}.index`, '{broken');
  const restarted = controller(storage, 'index-restart');
  assert.equal(restarted.snapshot().projects.length, 1);
  assert.equal(restarted.snapshot().projects[0].name, 'Indexed site');
});

test('failed durable save preserves dirty edits in memory', () => {
  const base = createMemoryStorage();
  let fail = false;
  const storage = {
    get length() { return base.length; },
    key: index => base.key(index),
    getItem: key => base.getItem(key),
    removeItem: key => base.removeItem(key),
    setItem(key, value) {
      if (fail && !key.endsWith('.pending') && !key.endsWith('.backup') && !key.endsWith('index')) throw new Error('Disk unavailable');
      base.setItem(key, value);
    },
  };
  const active = controller(storage, 'failure');
  active.createProject('Failure site');
  active.updateBrief('offer', 'Keep this offer');
  fail = true;
  assert.equal(active.save(), false);
  assert.equal(active.snapshot().dirty, true);
  assert.equal(active.snapshot().project.brief.offer, 'Keep this offer');
  assert.match(active.snapshot().error, /Disk unavailable/);
});

test('undo and redo restore supported website edits', () => {
  const active = controller();
  active.createProject('History site');
  active.updateBrief('tone', 'Direct');
  assert.equal(active.undo(), true);
  assert.equal(active.snapshot().project.brief.tone, '');
  assert.equal(active.redo(), true);
  assert.equal(active.snapshot().project.brief.tone, 'Direct');
});

test('discard restores the last durable website revision', () => {
  const active = controller();
  active.createProject('Discard site');
  active.updateBrief('goal', 'Saved goal');
  active.save();
  active.updateBrief('goal', 'Unsaved goal');
  assert.equal(active.discard(), true);
  assert.equal(active.snapshot().project.brief.goal, 'Saved goal');
  assert.equal(active.snapshot().dirty, false);
});

test('sitemap slugs stay unique and invalid duplicate edits are rejected', () => {
  const active = controller();
  active.createProject('Sitemap site');
  active.addPage('Services');
  active.addPage('Services');
  assert.deepEqual(active.snapshot().project.pages.map(page => page.slug), ['', 'services', 'services-2']);
  const pages = active.snapshot().project.pages;
  active.selectPage(pages[2].id);
  assert.equal(active.updatePage('slug', 'services'), false);
  assert.equal(active.snapshot().project.pages[2].slug, 'services-2');
});

test('preview safely escapes untrusted content and supplies responsive navigation', () => {
  const active = controller();
  active.createProject('Safe site');
  const page = active.snapshot().project.pages[0];
  const section = page.sections[0];
  active.updateSection(section.id, 'heading', '<script>alert(1)</script>');
  const html = active.preview();
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /aria-label="Primary"/);
});

test('export emits independently runnable HTML for every page', () => {
  const active = controller();
  active.createProject('Export site');
  active.addPage('About Us');
  const bundle = active.exportSite();
  assert.deepEqual(Object.keys(bundle.files).sort(), ['about-us.html', 'index.html']);
  for (const html of Object.values(bundle.files)) {
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /Export site/);
  }
});

test('renderer source loads the builder only inside the development gate', () => {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  const root = join(__dirname, '..', '..');
  const app = readFileSync(join(root, 'src', 'renderer', 'app.js'), 'utf8');
  const html = readFileSync(join(root, 'src', 'renderer', 'index.html'), 'utf8');
  assert.match(app, /studio-ui\/website-builder\.js/);
  assert.doesNotMatch(html, /<script src="studio-ui\/website-builder\.js"/);
});

test('undoing a new page keeps selection editable and redo restores the new page', () => {
  const active = controller();
  active.createProject('History site');
  const home = active.snapshot().selectedPageId;
  active.addPage('Services');
  const services = active.snapshot().selectedPageId;
  active.undo();
  assert.equal(active.snapshot().selectedPageId, home);
  active.redo();
  assert.equal(active.snapshot().selectedPageId, services);
  assert.equal(active.updatePage('title', 'Our services'), true);
  assert.equal(active.snapshot().project.pages[1].title, 'Our services');
  active.undo();
  active.undo();
  assert.equal(active.snapshot().selectedPageId, home);
  assert.equal(active.addSection('content'), true);
});

test('failed edits preserve redo and new websites cannot undo into another website', () => {
  const active = controller();
  active.createProject('First site');
  active.updateBrief('tone', 'Direct');
  active.undo();
  assert.equal(active.updateSection('missing', 'heading', 'Rejected'), false);
  assert.equal(active.redo(), true);
  assert.equal(active.snapshot().project.brief.tone, 'Direct');
  active.save();
  active.close();
  active.createProject('Second site');
  assert.equal(active.undo(), false);
  assert.equal(active.snapshot().project.name, 'Second site');
});

test('Index pages cannot overwrite the home file and conflicting imported records fail export', () => {
  const active = controller();
  active.createProject('Filename site');
  active.addPage('Index');
  assert.equal(active.snapshot().project.pages[1].slug, 'index-2');
  assert.equal(active.updatePage('slug', 'index'), false);
  assert.deepEqual(Object.keys(active.exportSite().files).sort(), ['index-2.html', 'index.html']);
  const invalid = active.snapshot().project;
  invalid.pages[1].slug = 'index';
  assert.throws(() => exportSite(invalid), /filename/i);
});

test('scene-to-page copies only same-project synthetic text and preserves its source through save/reopen', () => {
  const active = controller(); active.createProject('Scene site');
  const scene = { projectId: meridianProject.id, sceneId: 'scene-proof', title: 'Proof', notes: '<script>untrusted notes</script>' };
  assert.equal(active.addScenePage({ ...scene, projectId: 'other-project' }), false);
  assert.equal(active.snapshot().project.pages.length, 1);
  assert.equal(active.addScenePage(scene), true);
  assert.equal(active.snapshot().dirty, true);
  assert.match(active.preview(), /&lt;script&gt;/);
  assert.equal(active.save(), true);
  const id = active.snapshot().project.id;
  active.openProject(id);
  const page = active.snapshot().project.pages[1];
  assert.equal(page.source.sceneId, 'scene-proof');
  assert.equal(page.source.projectId, meridianProject.id);
  const invalid = active.snapshot().project;
  invalid.pages[1].source.projectId = 'other-project';
  assert.throws(() => exportSite(invalid), /source does not match/);
});

test('failed website creation reports an error without crashing the local workspace', () => {
  const storage = createMemoryStorage();
  const active = controller(storage);
  storage.setItem = () => { throw new Error('Local storage full'); };
  assert.equal(active.createProject('Cannot create'), false);
  assert.equal(active.snapshot().project, null);
  assert.match(active.snapshot().error, /Local storage full/);
});

test('website recovery rejects a different website identity in every storage candidate', () => {
  const storage = createMemoryStorage();
  const active = controller(storage, 'identity');
  active.createProject('Requested site');
  const requested = active.snapshot().project;
  active.createProject('Other site');
  const other = active.snapshot().project;
  const key = `meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(requested.id)}`;
  const repository = createRepository(storage, meridianProject.id);

  storage.setItem(key, JSON.stringify(other));
  storage.setItem(`${key}.backup`, JSON.stringify(requested));
  assert.equal(repository.open(requested.id).id, requested.id);
  assert.equal(JSON.parse(storage.getItem(key)).id, other.id, 'Opening recovery must preserve the substituted primary for explicit recovery');

  for (const suffix of ['', '.backup', '.pending']) storage.setItem(`${key}${suffix}`, JSON.stringify(other));
  assert.throws(() => repository.open(requested.id), /identity/i);
  assert.deepEqual(repository.list().map(project => project.id), [other.id]);
});

test('section limit rejects the edit before it can make the website unsaveable and preserves redo', () => {
  const active = controller();
  active.createProject('Section limit');
  for (let count = 2; count < 100; count += 1) assert.equal(active.addSection(), true);
  active.updateBrief('tone', 'Direct');
  active.undo();
  assert.equal(active.addSection(), false);
  assert.equal(active.snapshot().project.pages[0].sections.length, 100);
  assert.match(active.snapshot().error, /100 sections/);
  assert.equal(active.redo(), true);
  assert.equal(active.snapshot().project.brief.tone, 'Direct');
  assert.equal(active.save(), true);
});


test('formatted section bodies safely render paragraphs, emphasis and lists in preview and export', () => {
  const active=controller();active.createProject('Formatted');
  const section=active.snapshot().project.pages[0].sections[0];
  active.updateSection(section.id,'body','Hello **bold** and *italic*.\nSecond line.\n\n- First\n- <img src=x onerror=alert(1)>\n\n1. One\n2. Two');
  assert.equal(active.updateSection(section.id,'bodyFormat','formatted'),true);
  for(const html of [active.preview(),active.exportSite().files['index.html']]) {
    assert.match(html,/<p>Hello <strong>bold<\/strong> and <em>italic<\/em>\.<br>Second line\.<\/p>/);
    assert.match(html,/<ul><li>First<\/li><li>&lt;img src=x onerror=alert\(1\)&gt;<\/li><\/ul>/);
    assert.match(html,/<ol><li>One<\/li><li>Two<\/li><\/ol>/);
    assert.doesNotMatch(html,/<img|<script/);
  }
});

test('existing plain text stays literal and formatted mode survives save, checkpoint and undo', () => {
  const storage=createMemoryStorage(),active=controller(storage,'format');active.createProject('Plain');
  const section=active.snapshot().project.pages[0].sections[0];
  active.updateSection(section.id,'body','**literal** <script>alert(1)</script>');
  assert.match(active.preview(),/<p>\*\*literal\*\* &lt;script&gt;/);
  active.updateSection(section.id,'bodyFormat','formatted');active.undo();
  assert.doesNotMatch(active.preview(),/<strong>literal/);
  active.redo();active.save();active.createCheckpoint('Formatted');
  const websiteId=active.snapshot().project.id,checkpoint=active.snapshot().checkpoints[0].id;
  active.updateSection(section.id,'bodyFormat','plain');active.save();active.restoreCheckpoint(checkpoint);
  assert.match(active.preview(),/<strong>literal<\/strong>/);
  active.save();active.openProject(websiteId);assert.equal(active.snapshot().project.pages[0].sections[0].bodyFormat,'formatted');
});

test('formatting commands are single undoable edits and retain Unicode selected text', () => {
  const active=controller();active.createProject('Toolbar');const section=active.snapshot().project.pages[0].sections[0];
  active.updateSection(section.id,'body','Café ☕');
  assert.equal(active.formatSectionText(section.id,'bold',0,4),true);
  assert.equal(active.snapshot().project.pages[0].sections[0].body,'**Café** ☕');
  active.undo();assert.equal(active.snapshot().project.pages[0].sections[0].body,'Café ☕');
  active.redo();assert.match(active.preview(),/<strong>Café<\/strong> ☕/);
  active.updateSection(section.id,'body','First\nSecond');
  active.formatSectionText(section.id,'bullets',0,12);assert.match(active.preview(),/<ul><li>First<\/li><li>Second<\/li><\/ul>/);
});

test('invalid formatting commands, modes, ranges and oversized insertion preserve current work and redo', () => {
  const active=controller();active.createProject('Bounds');const section=active.snapshot().project.pages[0].sections[0];
  active.updateSection(section.id,'body','Current');active.undo();const before=active.snapshot().project;
  assert.equal(active.updateSection(section.id,'bodyFormat','html'),false);
  for(const args of [['link',0,1],['bold',-1,2],['bold',3,1],['bold',0,99999]]) assert.equal(active.formatSectionText(section.id,...args),false);
  assert.deepEqual(active.snapshot().project,before);assert.equal(active.redo(),true);
  active.updateSection(section.id,'body','x'.repeat(8000));assert.equal(active.formatSectionText(section.id,'bold',0,8000),false);
  assert.equal(active.snapshot().project.pages[0].sections[0].body.length,8000);
  const invalid=active.snapshot().project;invalid.pages[0].sections[0].bodyFormat='html';
  assert.throws(()=>exportSite(invalid),/format/i);
});


test('action buttons export only real page destinations and preview stays inert', () => {
  const active=controller();active.createProject('Destinations');
  const home=active.snapshot().selectedPageId,hero=active.snapshot().project.pages[0].sections[0].id;
  assert.doesNotMatch(active.exportSite().files['index.html'],/href="#contact"|class="action"/);
  assert.equal(active.readiness().checks.find(check=>check.id==='actions').passed,false);
  active.addPage('Contact');const contact=active.snapshot().selectedPageId;active.selectPage(home);
  assert.equal(active.updateSection(hero,'actionPageId',contact),true);
  assert.match(active.exportSite().files['index.html'],/<a class="action" href="contact.html">Get started<\/a>/);
  assert.match(active.preview(),/<span class="action">Get started<\/span>/);
  assert.doesNotMatch(active.preview(),/href="contact.html"/);
  assert.equal(active.readiness().checks.find(check=>check.id==='actions').passed,true);
  active.selectPage(contact);active.updatePage('slug','get-in-touch');active.selectPage(home);
  assert.match(active.exportSite().files['index.html'],/class="action" href="get-in-touch.html"/);
  active.save();active.openProject(active.snapshot().project.id);
  assert.equal(active.snapshot().project.pages[0].sections[0].actionPageId,contact);
});

test('removing an action destination clears affected links and Undo restores both', () => {
  const active=controller();active.createProject('Removal');const home=active.snapshot().selectedPageId,hero=active.snapshot().project.pages[0].sections[0].id;
  active.addPage('Contact');const contact=active.snapshot().selectedPageId;active.selectPage(home);active.updateSection(hero,'actionPageId',contact);
  active.removePage(contact);
  assert.equal(active.snapshot().project.pages[0].sections[0].actionPageId,'');
  assert.doesNotMatch(active.exportSite().files['index.html'],/class="action"/);
  assert.equal(active.readiness().checks.find(check=>check.id==='actions').passed,false);
  active.undo();assert.match(active.exportSite().files['index.html'],/class="action" href="contact.html"/);
});

test('foreign or executable action destinations are rejected without losing redo', () => {
  const active=controller();active.createProject('Scoped');const hero=active.snapshot().project.pages[0].sections[0].id;
  active.addPage('Contact');active.undo();
  for(const target of ['foreign-id','javascript:alert(1)','https://example.invalid','../outside']) assert.equal(active.updateSection(hero,'actionPageId',target),false);
  assert.equal(active.redo(),true);
  const invalid=active.snapshot().project;invalid.pages[0].sections[0].actionPageId='foreign-id';
  assert.throws(()=>exportSite(invalid),/destination/i);
});


test('removing a local checkpoint frees a bounded-history slot and survives reopen', () => {
  const storage=createMemoryStorage(),active=controller(storage,'checkpoint-remove');active.createProject('History');
  for(let index=0;index<10;index++) active.createCheckpoint('Checkpoint '+index);
  const id=active.snapshot().checkpoints[0].id,website=active.snapshot().project.id;
  assert.equal(active.removeCheckpoint(id),true);assert.equal(active.snapshot().checkpoints.length,9);
  assert.equal(active.createCheckpoint('Replacement'),true);assert.equal(active.snapshot().checkpoints.length,10);
  active.openProject(website);assert.equal(active.snapshot().checkpoints.some(item=>item.id===id),false);
  assert.equal(active.restoreCheckpoint(id),false);
});

test('checkpoint removal leaves dirty edits, saved primary and editor Undo untouched', () => {
  const storage=createMemoryStorage(),active=controller(storage,'dirty-remove');active.createProject('History');active.createCheckpoint('Saved');
  const id=active.snapshot().checkpoints[0].id,primary=createRepository(storage,meridianProject.id).open(active.snapshot().project.id);
  active.updateBrief('goal','Keep these unsaved edits');assert.equal(active.removeCheckpoint(id),true);
  assert.equal(active.snapshot().project.brief.goal,'Keep these unsaved edits');assert.equal(active.snapshot().dirty,true);
  assert.deepEqual(createRepository(storage,meridianProject.id).open(primary.id),primary);
  active.undo();assert.equal(active.snapshot().project.brief.goal,primary.brief.goal);
  assert.equal(active.snapshot().checkpoints.length,0);
});

test('failed or foreign checkpoint removal preserves the previous history', () => {
  const base=createMemoryStorage();let fail=false;const storage={...base,setItem(key,value){if(fail&&key.startsWith('meridian.website-checkpoints.'))throw Error('Removal storage failure');base.setItem(key,value);}};
  const active=controller(storage,'failed-remove');active.createProject('History');active.createCheckpoint('Keep');
  const before=active.snapshot().checkpoints;fail=true;
  assert.equal(active.removeCheckpoint(before[0].id),false);assert.deepEqual(active.snapshot().checkpoints,before);
  assert.equal(active.removeCheckpoint('foreign'),false);assert.deepEqual(active.snapshot().checkpoints,before);
  fail=false;active.openProject(active.snapshot().project.id);assert.deepEqual(active.snapshot().checkpoints,before);
});


test('nested pages persist and export semantic grouped navigation with unchanged URLs', () => {
  const active=controller();active.createProject('Nested');
  active.addPage('Services');const services=active.snapshot().selectedPageId;
  active.addPage('Repairs');const repairs=active.snapshot().selectedPageId;
  assert.equal(active.updatePage('parentPageId',services),true);
  let html=active.exportSite().files['index.html'];
  assert.match(html,/<a href="services.html">Services<\/a><ul><li><a href="repairs.html">Repairs<\/a>/);
  assert.match(active.preview(),/<span>Services<\/span><ul><li><span aria-current="page">Repairs<\/span>/);
  assert.doesNotMatch(active.preview(),/href="repairs.html"/);
  assert.deepEqual(Object.keys(active.exportSite().files),['index.html','services.html','repairs.html']);
  active.save();active.createCheckpoint('Grouped');const checkpoint=active.snapshot().checkpoints[0].id;
  active.updatePage('parentPageId','');active.save();active.restoreCheckpoint(checkpoint);
  assert.equal(active.snapshot().project.pages.find(page=>page.id===repairs).parentPageId,services);
  active.save();active.openProject(active.snapshot().project.id);
  assert.equal(active.snapshot().project.pages.find(page=>page.id===repairs).parentPageId,services);
});

test('page hierarchy rejects cycles, unknown parents, nested home and excessive depth without losing redo', () => {
  const active=controller();active.createProject('Bounds');const home=active.snapshot().selectedPageId;
  active.addPage('Services');const services=active.snapshot().selectedPageId;
  active.addPage('Repairs');const repairs=active.snapshot().selectedPageId;active.updatePage('parentPageId',services);
  active.addPage('Emergency');const emergency=active.snapshot().selectedPageId;active.updatePage('parentPageId',repairs);
  active.addPage('Fourth');assert.equal(active.updatePage('parentPageId',emergency),false);
  active.selectPage(services);assert.equal(active.updatePage('parentPageId',repairs),false);
  active.selectPage(home);assert.equal(active.updatePage('parentPageId',services),false);
  assert.equal(active.updatePage('parentPageId','foreign-id'),false);
  active.undo();assert.equal(active.redo(),true,'Rejected hierarchy edits retain history');
  const invalid=active.snapshot().project;invalid.pages.find(page=>page.id===services).parentPageId=repairs;
  assert.throws(()=>exportSite(invalid),/hierarchy|cycle|parent/i);
});

test('sibling ordering and parent removal preserve descendants and undo restores the hierarchy', () => {
  const active=controller();active.createProject('Order');active.addPage('Services');const services=active.snapshot().selectedPageId;
  active.addPage('Repairs');const repairs=active.snapshot().selectedPageId;active.updatePage('parentPageId',services);
  active.addPage('Consulting');const consulting=active.snapshot().selectedPageId;active.updatePage('parentPageId',services);
  assert.equal(active.movePage(consulting,-1),true);
  assert.match(active.exportSite().files['index.html'],/<a href="services.html">Services<\/a><ul><li><a href="consulting.html">Consulting<\/a><\/li><li><a href="repairs.html">Repairs<\/a>/);
  assert.equal(active.movePage(consulting,-1),false);
  active.removePage(services);let pages=active.snapshot().project.pages;
  assert.equal(pages.find(page=>page.id===repairs).parentPageId,'');assert.equal(pages.find(page=>page.id===consulting).parentPageId,'');
  active.undo();pages=active.snapshot().project.pages;
  assert.equal(pages.find(page=>page.id===repairs).parentPageId,services);
  active.save();assert.ok(active.exportSite().files['repairs.html']);
});


test('drop reordering is undoable, preserves hierarchy and rejects cross-parent moves', () => {
  const active=controller();active.createProject('Drop');const home=active.snapshot().selectedPageId;
  active.addPage('Services');const services=active.snapshot().selectedPageId;
  active.addPage('Contact');const contact=active.snapshot().selectedPageId;
  assert.equal(active.movePageTo(contact,home,'before'),true);
  assert.deepEqual(active.snapshot().project.pages.map(page=>page.id),[contact,home,services]);
  active.undo();assert.deepEqual(active.snapshot().project.pages.map(page=>page.id),[home,services,contact]);active.redo();
  active.selectPage(contact);active.updatePage('parentPageId',services);
  assert.equal(active.movePageTo(contact,home,'after'),false);
  assert.equal(active.snapshot().project.pages.find(page=>page.id===contact).parentPageId,services);
  active.save();active.openProject(active.snapshot().project.id);
  assert.match(active.exportSite().files['index.html'],/<a href="services.html">Services<\/a><ul><li><a href="contact.html">Contact<\/a>/);
});

test('section drop reordering keeps content and no-op or invalid drops preserve redo', () => {
  const active=controller();active.createProject('Sections');const first=active.snapshot().project.pages[0].sections[0];
  active.addSection('cta');const last=active.snapshot().project.pages[0].sections.at(-1);
  assert.equal(active.moveSectionTo(last.id,first.id,'before'),true);
  assert.deepEqual(active.snapshot().project.pages[0].sections[0],last);
  active.undo();assert.equal(active.moveSectionTo(first.id,first.id,'before'),false);
  assert.equal(active.moveSectionTo(first.id,last.id,'invalid'),false);
  assert.equal(active.redo(),true);
  active.undo();assert.equal(active.moveSectionTo('foreign',first.id,'before'),false);assert.equal(active.redo(),true);
  const original=active.snapshot().project.pages[0].sections;
  active.addPage('Other');const other=active.snapshot().project.pages[1].sections[0];
  assert.equal(active.moveSectionTo(first.id,other.id,'before'),false);
  assert.deepEqual(active.snapshot().project.pages[0].sections,original);
});


test('shared sections update linked copies across pages and survive save, checkpoint and export', () => {
  const active=controller();active.createProject('Shared');const home=active.snapshot().selectedPageId,section=active.snapshot().project.pages[0].sections[1];
  assert.equal(active.makeSectionShared(section.id),true);const shared=active.snapshot().project.pages[0].sections[1].sharedId;
  active.addPage('About');const about=active.snapshot().selectedPageId;
  assert.equal(active.addSharedSection(shared),true);const linked=active.snapshot().project.pages[1].sections.at(-1);
  assert.notEqual(linked.id,section.id);assert.equal(linked.sharedId,shared);
  active.updateSection(linked.id,'heading','One shared promise');active.updateSection(linked.id,'body','Shared useful content');
  for(const html of Object.values(active.exportSite().files)) assert.match(html,/One shared promise/);
  active.save();active.createCheckpoint('Linked');const checkpoint=active.snapshot().checkpoints[0].id;
  active.updateSection(linked.id,'heading','Later');active.save();active.restoreCheckpoint(checkpoint);active.save();active.openProject(active.snapshot().project.id);
  assert.equal(active.snapshot().project.pages[0].sections[1].heading,'One shared promise');
  active.selectPage(about);active.formatSectionText(linked.id,'bold',0,6);
  assert.equal(active.snapshot().project.pages[0].sections[1].bodyFormat,'formatted');
  assert.match(active.exportSite().files['index.html'],/<strong>Shared<\/strong> useful content/);
  active.selectPage(home);
});

test('detaching shared sections and editing linked groups are undoable without changing independent copies', () => {
  const active=controller();active.createProject('Detach');const source=active.snapshot().project.pages[0].sections[1];
  active.makeSectionShared(source.id);const shared=active.snapshot().project.pages[0].sections[1].sharedId;
  active.addPage('About');active.addSharedSection(shared);const linked=active.snapshot().project.pages[1].sections.at(-1);
  active.detachSection(linked.id);assert.equal(active.snapshot().project.pages[1].sections.at(-1).sharedId,undefined);
  active.updateSection(linked.id,'body','Independent copy');assert.notEqual(active.snapshot().project.pages[0].sections[1].body,'Independent copy');
  active.undo();active.undo();assert.equal(active.snapshot().project.pages[1].sections.at(-1).sharedId,shared);
  active.updateSection(linked.id,'heading','Both');assert.equal(active.snapshot().project.pages[0].sections[1].heading,'Both');
  active.undo();assert.equal(active.snapshot().project.pages[0].sections[1].heading,source.heading);
});

test('shared-section identities and divergent imported copies fail validation, and other websites cannot insert them', () => {
  const active=controller();active.createProject('Scoped');const source=active.snapshot().project.pages[0].sections[1];
  active.makeSectionShared(source.id);const shared=active.snapshot().project.pages[0].sections[1].sharedId;
  active.addPage('About');active.addSharedSection(shared);
  const invalid=active.snapshot().project;invalid.pages[1].sections.at(-1).body='Unrelated';
  assert.throws(()=>exportSite(invalid),/shared/i);
  active.createProject('Other');assert.equal(active.addSharedSection(shared),false);
  assert.equal(active.addSharedSection(undefined),false);assert.equal(active.addSharedSection(null),false);
  assert.equal(active.makeSectionShared('foreign-section'),false);
});

test('duplicate maximum-length page and scene names remain saveable with unique bounded slugs', () => {
  const active=controller();active.createProject('Bounded pages');
  for(const title of ['a'.repeat(120), 'a'.repeat(118)+' b']) {
    assert.equal(active.addPage(title),true);assert.equal(active.addPage(title),true);
    assert.equal(active.addScenePage({projectId:meridianProject.id,sceneId:'long-scene',title}),true);
  }
  for(const page of active.snapshot().project.pages)assert.ok(page.slug.length<=120);
  assert.equal(active.save(),true);assert.ok(active.exportArchive());
  assert.equal(active.openProject(active.snapshot().project.id),true);
  assert.equal(new Set(active.snapshot().project.pages.map(p=>p.slug)).size,7);
});

test('home URL remains the portable entry point and rejected edits preserve redo', () => {
  const active=controller();active.createProject('Entry');active.addPage('About');active.undo();
  assert.equal(active.updatePage('slug','moved-home'),false);
  assert.equal(active.redo(),true);
  assert.ok(active.exportSite().files['index.html']);
});

test('structurally corrupt saved drafts recover backup instead of entering a broken editor', () => {
  const storage=createMemoryStorage(),active=controller(storage);active.createProject('Validated');active.save();
  const good=active.snapshot().project, key=`meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(good.id)}`;
  for(const damage of [p=>{delete p.brief;},p=>{p.revision='bad';},p=>{p.pages[0].sections.push({...p.pages[0].sections[0]});},p=>{p.pages[0].sections[0].body={bad:true};}]) {
    const bad=JSON.parse(JSON.stringify(good));damage(bad);storage.setItem(key,JSON.stringify(bad));
    const recovered=createRepository(storage,meridianProject.id).open(good.id);
    assert.ok(recovered.brief);assert.equal(typeof recovered.revision,'number');
    assert.equal(recovered.pages[0].sections.length,2);assert.equal(typeof recovered.pages[0].sections[0].body,'string');
  }
});

test('an interrupted index update does not hide an otherwise saved website', () => {
  const storage=createMemoryStorage(),active=controller(storage);active.createProject('Discoverable');
  storage.setItem(`meridian.website.${encodeURIComponent(meridianProject.id)}.index`,'[]');
  const restarted=controller(storage);assert.equal(restarted.snapshot().projects.length,1);
});

test('stale windows cannot silently overwrite newer website content and retain their edits', () => {
  const storage=createMemoryStorage(),first=controller(storage,'first');first.createProject('Shared device');
  const second=controller(storage,'second'),id=first.snapshot().project.id;second.openProject(id);
  second.updateBrief('goal','Newer saved work');assert.equal(second.save(),true);
  first.updateBrief('offer','Keep my unsaved work');assert.equal(first.save(),false);
  assert.match(first.snapshot().error,/changed elsewhere/);assert.equal(first.snapshot().dirty,true);
  assert.equal(first.snapshot().project.brief.offer,'Keep my unsaved work');
  assert.equal(createRepository(storage,meridianProject.id).open(id).brief.goal,'Newer saved work');
  assert.equal(first.discard(),true);first.updateBrief('offer','Reapplied after reopening');assert.equal(first.save(),true);
});

test('a save interrupted after its primary write can be retried without a false stale-window conflict', () => {
  const base=createMemoryStorage();let failIndex=false;
  const storage={get length(){return base.length;},key:i=>base.key(i),getItem:k=>base.getItem(k),removeItem:k=>base.removeItem(k),setItem(k,v){if(failIndex&&k.endsWith('.index'))throw Error('Index write failed');base.setItem(k,v);}};
  const active=controller(storage);active.createProject('Interrupted own save');active.updateBrief('goal','Retained goal');
  failIndex=true;assert.equal(active.save(),false);assert.equal(active.snapshot().dirty,true);
  failIndex=false;assert.equal(active.save(),true);assert.equal(active.snapshot().dirty,false);
});

test('saving a separate local copy preserves stale edits without overwriting the newer original or linking groups across websites', () => {
  const storage=createMemoryStorage(),first=controller(storage,'original');first.createProject('Original');
  const originalId=first.snapshot().project.id,section=first.snapshot().project.pages[0].sections[0].id;
  first.makeSectionShared(section);first.save();first.createCheckpoint('Original checkpoint');
  const second=controller(storage,'other');second.openProject(originalId);second.updateBrief('goal','Newer original');second.save();
  first.updateSection(section,'heading','Keep my local version');assert.equal(first.save(),false);
  assert.equal(first.saveSeparateCopy(),true);
  const copied=first.snapshot();assert.notEqual(copied.project.id,originalId);assert.equal(copied.dirty,false);assert.deepEqual(copied.checkpoints,[]);
  assert.equal(copied.project.pages[0].sections[0].heading,'Keep my local version');assert.equal(copied.project.name,'Original copy');
  const repo=createRepository(storage,meridianProject.id);assert.equal(repo.open(originalId).brief.goal,'Newer original');
  assert.notEqual(repo.open(originalId).pages[0].sections[0].heading,'Keep my local version');assert.equal(repo.listCheckpoints(originalId).length,1);
  assert.equal(first.undo(),false);first.updateBrief('tone','Independent');assert.equal(first.save(),true);
  assert.equal(repo.open(originalId).brief.tone,'');assert.equal(repo.list().length,2);
});

test('failed separate-copy save retains current identity, unsaved content and history', () => {
  const storage=createMemoryStorage(),active=controller(storage);active.createProject('Copy failure');active.updateBrief('goal','Keep here');
  const original=active.snapshot().project;storage.setItem=()=>{throw Error('Storage full');};
  assert.equal(active.saveSeparateCopy(),false);assert.deepEqual(active.snapshot().project,original);assert.equal(active.snapshot().dirty,true);
  assert.equal(active.undo(),true);active.selectContext(null);assert.equal(active.saveSeparateCopy(),false);
});

test('saving after Undo or checkpoint restore advances from the persisted revision', () => {
  const active=controller();active.createProject('Revision sequence');active.updateBrief('goal','First');active.save();active.createCheckpoint('First save');
  const checkpoint=active.snapshot().checkpoints[0].id;
  active.updateBrief('goal','Second');active.save();const latest=active.snapshot().project.revision;
  active.undo();assert.equal(active.save(),true);assert.equal(active.snapshot().project.revision,latest+1);
  active.restoreCheckpoint(checkpoint);assert.equal(active.save(),true);assert.equal(active.snapshot().project.revision,latest+2);
});

test('catalogue discovers backup-only and pending-only websites after an interrupted first save or missing index', () => {
  for(const suffix of ['.backup','.pending']) {
    const storage=createMemoryStorage(),active=controller(storage);active.createProject('Recovery-only draft');
    const project=active.snapshot().project,key=`meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(project.id)}`;
    storage.setItem(key+suffix,JSON.stringify(project));storage.removeItem(key);storage.removeItem(`meridian.website.${encodeURIComponent(meridianProject.id)}.index`);
    const restarted=controller(storage);assert.equal(restarted.snapshot().projects.length,1);
    assert.equal(restarted.openProject(project.id),true);assert.equal(restarted.snapshot().project.name,'Recovery-only draft');
  }
});

test('unrecoverable local websites remain visible as retained-record warnings and can be retried after repair', () => {
  const storage=createMemoryStorage(),active=controller(storage);active.createProject('Retained record');
  const good=active.snapshot().project,key=`meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(good.id)}`;
  for(const suffix of ['', '.backup','.pending'])storage.setItem(key+suffix,'{malformed');
  const restarted=controller(storage);assert.equal(restarted.snapshot().projects.length,0);
  assert.equal(restarted.snapshot().unavailableProjects.length,1);assert.equal(restarted.snapshot().unavailableProjects[0].id,good.id);
  assert.equal(restarted.openProject(good.id),false);assert.match(restarted.snapshot().error,/Saved website data could not be opened/);assert.doesNotMatch(restarted.snapshot().error,/JSON|malformed/);assert.equal(storage.getItem(key),'{malformed');
  storage.setItem(key,JSON.stringify(good));assert.equal(restarted.openProject(good.id),true);
  restarted.close();assert.deepEqual(restarted.snapshot().unavailableProjects,[]);
  restarted.selectContext({id:'other-project',name:'Other'});assert.deepEqual(restarted.snapshot().unavailableProjects,[]);
});

test('recovery discovery preserves valid website identities that themselves end in a recovery suffix', () => {
  const storage=createMemoryStorage(),active=createController({storage,idFactory:prefix=>`${prefix}.pending`});active.selectContext(meridianProject);
  assert.equal(active.createProject('Suffix identity'),true);const id=active.snapshot().project.id;
  storage.removeItem(`meridian.website.${encodeURIComponent(meridianProject.id)}.index`);
  const restarted=controller(storage);assert.equal(restarted.snapshot().projects[0].id,id);assert.equal(restarted.openProject(id),true);
});

test('recovery catalogue and opening valid copies work without storage writes', () => {
  for (const suffix of ['.backup', '.pending']) {
    const memory=createMemoryStorage(),seed=controller(memory,'read-only');seed.createProject('Readable retained draft');
    const project=seed.snapshot().project,key=`meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(project.id)}`;
    memory.setItem(key+suffix,JSON.stringify(project));memory.setItem(key,'{broken');
    memory.removeItem(`meridian.website.${encodeURIComponent(meridianProject.id)}.index`);
    const before=Array.from({length:memory.length},(_,i)=>[memory.key(i),memory.getItem(memory.key(i))]);
    let writes=0;
    const storage={get length(){return memory.length;},key:i=>memory.key(i),getItem:k=>memory.getItem(k),setItem(){writes++;throw Error('Quota exceeded');},removeItem(){writes++;throw Error('Storage locked');}};
    const active=controller(storage,'locked');
    assert.equal(active.snapshot().projects.length,1,'A valid retained copy is readable even if storage cannot write');
    assert.deepEqual(active.snapshot().unavailableProjects,[]);
    assert.equal(active.openProject(project.id),true);
    assert.match(active.snapshot().status,/recovery copy/i);
    assert.equal(active.snapshot().project.name,project.name);
    assert.equal(active.exportSite().files['index.html'].includes(project.name),true);
    assert.equal(writes,0,'Listing, opening and export must not attempt promotion or repair');
    assert.deepEqual(Array.from({length:memory.length},(_,i)=>[memory.key(i),memory.getItem(memory.key(i))]),before);
    active.updateBrief('goal','Retain edits while storage is full');
    assert.equal(active.save(),false);assert.equal(active.snapshot().dirty,true);
    assert.equal(active.snapshot().project.brief.goal,'Retain edits while storage is full');
    assert.equal(active.undo(),true);assert.equal(active.snapshot().project.brief.goal,project.brief.goal);
  }
});

test('successful recovery reads leave every retained candidate byte-for-byte unchanged', () => {
  const storage=createMemoryStorage(),active=controller(storage);active.createProject('Read without repair');
  const project=active.snapshot().project,key=`meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(project.id)}`;
  storage.setItem(key+'.backup',JSON.stringify(project));storage.setItem(key,'{broken');storage.setItem(key+'.pending','{interrupted');
  const before=['','.backup','.pending'].map(suffix=>storage.getItem(key+suffix));
  const repository=createRepository(storage,meridianProject.id);
  assert.equal(repository.list().length,1);assert.equal(repository.open(project.id).name,project.name);
  assert.deepEqual(['','.backup','.pending'].map(suffix=>storage.getItem(key+suffix)),before);
});

test('explicit save after recovery preserves a valid backup if the primary write is interrupted', () => {
  const memory=createMemoryStorage(),seed=controller(memory);seed.createProject('Recovery then save');
  const project=seed.snapshot().project,key=`meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(project.id)}`;
  memory.setItem(key+'.backup',JSON.stringify(project));memory.setItem(key,'{broken');
  let fail=false;
  const storage={get length(){return memory.length;},key:i=>memory.key(i),getItem:k=>memory.getItem(k),removeItem:k=>memory.removeItem(k),setItem(k,v){if(fail&&k===key)throw Error('Primary write interrupted');memory.setItem(k,v);}};
  const active=controller(storage,'recovered');assert.equal(active.openProject(project.id),true);
  active.updateBrief('goal','New recovered edit');fail=true;
  assert.equal(active.save(),false);assert.equal(active.snapshot().dirty,true);
  assert.deepEqual(JSON.parse(memory.getItem(key+'.backup')),project,'Do not replace the valid recovery copy with the corrupt primary');
  assert.equal(memory.getItem(key),'{broken');
  assert.equal(createRepository(storage,meridianProject.id).open(project.id).brief.goal,project.brief.goal);
  fail=false;assert.equal(active.save(),true);assert.equal(active.snapshot().dirty,false);
  assert.equal(JSON.parse(memory.getItem(key)).brief.goal,'New recovered edit');
  assert.deepEqual(JSON.parse(memory.getItem(key+'.backup')),project);
});

test('new website identity collisions cannot overwrite an existing saved website', () => {
  const storage=createMemoryStorage();
  const first=createController({storage,idFactory:()=> 'website-collision'});first.selectContext(meridianProject);
  assert.equal(first.createProject('First saved website'),true);first.updateBrief('goal','Keep the original');first.save();first.createCheckpoint('Original');
  const original=JSON.stringify(first.snapshot().project);
  const next=createController({storage,idFactory:()=> 'website-collision'});next.selectContext(meridianProject);
  assert.equal(next.createProject('Collision must fail'),false);
  assert.equal(next.snapshot().project,null);assert.match(next.snapshot().error,/identity.*already exists/i);
  assert.equal(JSON.stringify(createRepository(storage,meridianProject.id).open('website-collision')),original);
  assert.equal(createRepository(storage,meridianProject.id).listCheckpoints('website-collision').length,1);
});

test('retrying website creation after an index failure completes one retained identity', () => {
  const memory=createMemoryStorage();let fail=true;
  const storage={get length(){return memory.length;},key:i=>memory.key(i),getItem:k=>memory.getItem(k),removeItem:k=>memory.removeItem(k),setItem(k,v){if(fail&&k.endsWith('.index'))throw Error('Index unavailable');memory.setItem(k,v);}};
  const active=controller(storage,'create-retry');
  assert.equal(active.createProject('One request'),false);
  const retained=createRepository(storage,meridianProject.id).list();assert.equal(retained.length,1);
  fail=false;assert.equal(active.createProject('One request'),true);
  assert.equal(active.snapshot().project.id,retained[0].id);
  assert.equal(createRepository(storage,meridianProject.id).list().length,1);
});

test('retrying a partially written separate copy reuses its identity and includes current edits', () => {
  const memory=createMemoryStorage();let fail=false;
  const storage={get length(){return memory.length;},key:i=>memory.key(i),getItem:k=>memory.getItem(k),removeItem:k=>memory.removeItem(k),setItem(k,v){if(fail&&k.endsWith('.index'))throw Error('Index unavailable');memory.setItem(k,v);}};
  const active=controller(storage,'copy-retry');active.createProject('Original');const original=active.snapshot().project;
  active.updateBrief('goal','Keep this copy');fail=true;assert.equal(active.saveSeparateCopy(),false);
  assert.equal(active.snapshot().project.id,original.id);assert.equal(active.snapshot().dirty,true);
  const pending=createRepository(storage,meridianProject.id).list().find(p=>p.id!==original.id);assert.ok(pending);
  active.updateBrief('tone','Added after failure');fail=false;assert.equal(active.saveSeparateCopy(),true);
  assert.equal(active.snapshot().project.id,pending.id);assert.equal(active.snapshot().project.brief.tone,'Added after failure');
  assert.equal(createRepository(storage,meridianProject.id).list().length,2);
  assert.deepEqual(createRepository(storage,meridianProject.id).open(original.id),original);
});

test('a partially saved copy changed by another window is preserved instead of overwritten on retry', () => {
  const memory=createMemoryStorage();let fail=false;
  const storage={get length(){return memory.length;},key:i=>memory.key(i),getItem:k=>memory.getItem(k),removeItem:k=>memory.removeItem(k),setItem(k,v){if(fail&&k.endsWith('.index'))throw Error('Index unavailable');memory.setItem(k,v);}};
  const active=controller(storage,'copy-foreign');active.createProject('Original');active.updateBrief('goal','My edits');
  const originalId=active.snapshot().project.id;fail=true;assert.equal(active.saveSeparateCopy(),false);fail=false;
  const repo=createRepository(storage,meridianProject.id),pending=repo.list().find(p=>p.id!==originalId);
  const external=controller(storage,'external-copy');external.openProject(pending.id);external.updateBrief('goal','Other window');external.save();
  assert.equal(active.saveSeparateCopy(),false);assert.match(active.snapshot().error,/changed elsewhere/);
  assert.equal(active.snapshot().project.id,originalId);assert.equal(active.snapshot().project.brief.goal,'My edits');
  assert.equal(repo.open(pending.id).brief.goal,'Other window');assert.equal(repo.list().length,2);
  assert.equal(active.saveSeparateCopy(),true,'A subsequent explicit retry can choose a fresh separate identity');
  assert.notEqual(active.snapshot().project.id,pending.id);assert.equal(repo.open(pending.id).brief.goal,'Other window');
});

test('a retained website without its home entry falls back to valid recovery instead of exporting a broken site', () => {
  const storage=createMemoryStorage(),active=controller(storage);active.createProject('Home entry');active.save();
  const good=active.snapshot().project,key=`meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(good.id)}`;
  const broken=JSON.parse(JSON.stringify(good));broken.pages[0].slug='renamed-home';storage.setItem(key,JSON.stringify(broken));
  const repo=createRepository(storage,meridianProject.id);assert.equal(repo.open(good.id).pages[0].slug,'');
  storage.setItem(key+'.backup',JSON.stringify(broken));
  assert.throws(()=>repo.open(good.id),/home/i);
  assert.equal(repo.catalogue().unavailableProjects[0].id,good.id);
  assert.throws(()=>exportSite(broken),/home/i);
});

test('temporary catalogue access failure is visible, retryable and cannot discard an open draft', () => {
  const memory=createMemoryStorage();let denied=false;
  const storage={get length(){if(denied)throw Error('Storage enumeration denied');return memory.length;},key:i=>memory.key(i),getItem:k=>memory.getItem(k),setItem:(k,v)=>memory.setItem(k,v),removeItem:k=>memory.removeItem(k)};
  const active=controller(storage);active.createProject('Retained catalogue');const id=active.snapshot().project.id;
  denied=true;assert.doesNotThrow(()=>active.close());assert.match(active.snapshot().catalogueError,/could not be listed/i);
  assert.deepEqual(active.snapshot().projects,[]);assert.equal(active.refreshProjects(),false);
  denied=false;assert.equal(active.refreshProjects(),true);assert.equal(active.snapshot().catalogueError,null);
  assert.equal(active.snapshot().projects[0].id,id);active.openProject(id);active.updateBrief('goal','Keep current edits');
  assert.equal(active.refreshProjects(),false);assert.equal(active.snapshot().project.brief.goal,'Keep current edits');assert.equal(active.snapshot().dirty,true);
  denied=true;assert.doesNotThrow(()=>active.selectContext({id:'other',name:'Other'}));assert.match(active.snapshot().catalogueError,/could not be listed/i);
  active.selectContext(null);assert.equal(active.snapshot().catalogueError,null);
});

test('a second copy failure before writing must not misidentify the earlier own partial copy as foreign', () => {
  const memory=createMemoryStorage();let failure='none';
  const storage={get length(){return memory.length;},key:i=>memory.key(i),getItem:k=>memory.getItem(k),removeItem:k=>memory.removeItem(k),setItem(k,v){if(failure==='index'&&k.endsWith('.index')||failure==='pending'&&k.endsWith('.pending'))throw Error('Synthetic write failure');memory.setItem(k,v);}};
  const active=controller(storage,'repeated-copy');active.createProject('Original');const originalId=active.snapshot().project.id;
  active.updateBrief('goal','First copy edit');failure='index';assert.equal(active.saveSeparateCopy(),false);
  const repo=createRepository(storage,meridianProject.id),attempt=repo.list().find(p=>p.id!==originalId);
  active.updateBrief('goal','Second copy edit');failure='pending';assert.equal(active.saveSeparateCopy(),false);
  failure='none';assert.equal(active.saveSeparateCopy(),true);
  assert.equal(active.snapshot().project.id,attempt.id);assert.equal(active.snapshot().project.brief.goal,'Second copy edit');assert.equal(repo.list().length,2);
});

test('malformed saved styles and timestamp types recover safely instead of reaching renderer coercion', () => {
  const storage=createMemoryStorage(),active=controller(storage);active.createProject('Validated presentation');active.save();
  const good=active.snapshot().project,key=`meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(good.id)}`;
  const damage=[p=>{p.design.font={toString:1};},p=>{p.design.accent={toString:1};},p=>{p.design=null;},p=>{p.design=[];},p=>{p.updatedAt={toString:1};},p=>{p.createdAt=17;}];
  const repo=createRepository(storage,meridianProject.id),backup=JSON.parse(storage.getItem(key+'.backup'));
  for(const change of damage){const bad=JSON.parse(JSON.stringify(good));change(bad);storage.setItem(key,JSON.stringify(bad));assert.deepEqual(repo.open(good.id),backup);assert.doesNotThrow(()=>repo.catalogue());}
  const bad=JSON.parse(JSON.stringify(good));bad.updatedAt={toString:1};for(const suffix of ['', '.backup','.pending'])storage.setItem(key+suffix,JSON.stringify(bad));
  assert.doesNotThrow(()=>repo.catalogue());assert.equal(repo.catalogue().unavailableProjects[0].id,good.id);
});

test('legacy drafts without style settings open with safe defaults without modifying the retained bytes', () => {
  const storage=createMemoryStorage(),active=controller(storage);active.createProject('Legacy style defaults');
  const legacy=active.snapshot().project;delete legacy.design;
  const key=`meridian.website.${encodeURIComponent(meridianProject.id)}.${encodeURIComponent(legacy.id)}`,raw=JSON.stringify(legacy);storage.setItem(key,raw);
  const reopened=controller(storage,'legacy');assert.equal(reopened.openProject(legacy.id),true);
  assert.deepEqual(reopened.snapshot().project.design,{accent:'#1f6fd6',font:'system-ui'});
  assert.equal(storage.getItem(key),raw);assert.equal(reopened.updateDesign('accent','#16715a'),true);assert.equal(reopened.save(),true);
  assert.equal(JSON.parse(storage.getItem(key)).design.font,'system-ui');
});
