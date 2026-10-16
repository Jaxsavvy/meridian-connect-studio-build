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
  assert.equal(JSON.parse(storage.getItem(key)).id, requested.id);

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
