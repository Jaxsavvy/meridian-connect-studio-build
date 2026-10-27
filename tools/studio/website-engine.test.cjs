'use strict';
// Core: shared site engine (#157). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../src/renderer/studio/website/site-engine.js');

function sample() {
  return {
    version: 1, name: 'Sample Roofing Co', concept: true,
    theme: { colors: { bg: '#0b1220', text: '#f4f4f4', accent: '#3b82f6' }, fonts: { heading: 'Figtree', body: 'Inter' } },
    pages: [{ id: 'home', path: '/', title: 'Sample Roofing Co', description: 'Roofs done right.', sections: [
      { id: 'hero', label: 'Hero', tree: { tag: 'header', attrs: { class: 'hero' }, children: [
        { tag: 'h1', attrs: { 'data-edit': 'headline', 'data-motion': 'fade-up' }, children: [{ text: 'Roofs done <right>' }] },
        { tag: 'img', attrs: { src: 'asset:hero1', alt: 'A new roof' } },
        { tag: 'a', attrs: { href: 'tel:+15415550100', class: 'cta', 'data-edit': 'cta' }, children: [{ text: 'Call now' }] }] },
      styles: [{ sel: ':scope', decl: { 'background-image': 'url(asset:hero1)', padding: '80px 24px' } },
        { sel: 'h1, .cta:hover', decl: { color: 'var(--c-accent)' } },
        { sel: 'h1', media: '(max-width: 700px)', decl: { 'font-size': '2rem' } }] },
      { id: 'services', label: 'Services', tree: { tag: 'section', children: [{ tag: 'h2', attrs: { 'data-edit': 'services-title' }, children: [{ text: 'Services' }] }] } }] }],
  };
}
const errorsFor = site => E.validateSite(site).errors.map(e => e.path);
const heroTree = s => s.pages[0].sections[0].tree;

test('a good site passes', () => {
  assert.deepEqual(E.validateSite(sample()), { ok: true, errors: [] });
});

test('blocks scripts, frames, handlers, bad links and unknown fields', () => {
  const bad = [
    s => { heroTree(s).children.push({ tag: 'script', children: [{ text: 'alert(1)' }] }); },
    s => { heroTree(s).children.push({ tag: 'iframe', attrs: { src: 'https://evil.test' } }); },
    s => { heroTree(s).attrs.onclick = 'alert(1)'; },
    s => { heroTree(s).attrs.style = 'color:red'; },
    s => { heroTree(s).children[2].attrs.href = 'javascript:alert(1)'; },
    s => { heroTree(s).children[2].attrs.href = 'data:text/html,hi'; },
    s => { heroTree(s).children[1].attrs.src = 'https://hotlink.test/a.jpg'; },
    s => { delete heroTree(s).children[1].attrs.alt; },
    s => { s.pages[0].sections[0].html = '<b>raw</b>'; },
    s => { s.pricing = 1200; },
    s => { heroTree(s).children[0].attrs['data-motion'] = 'spin-forever'; },
  ];
  for (const change of bad) { const s = sample(); change(s); assert.equal(E.validateSite(s).ok, false, change.toString()); }
});

test('CSS: only asset urls, no escapes out of the style block', () => {
  const values = ['url(https://track.test/p.gif)', 'red;} body{display:none', 'expression(alert(1))', '</style><script>', '@import "x"'];
  for (const v of values) {
    const s = sample(); s.pages[0].sections[0].styles[0].decl.color = v;
    assert.equal(E.validateSite(s).ok, false, v);
  }
  const s = sample(); s.pages[0].sections[0].styles[0].sel = 'h1 { } body';
  assert.ok(errorsFor(s).some(p => p.endsWith('.sel')));
});

test('IDs, paths and edit keys must be unique; a home page is required', () => {
  const s = sample(); s.pages[0].sections[1].id = 'hero';
  assert.ok(errorsFor(s).some(p => p.endsWith('sections[1].id')));
  const k = sample(); k.pages[0].sections[1].tree.children[0].attrs['data-edit'] = 'headline';
  assert.equal(E.validateSite(k).ok, false);
  const h = sample(); h.pages[0].path = '/about';
  assert.ok(errorsFor(h).includes('site.pages'));
  const p = sample(); p.pages.push({ ...sample().pages[0], id: 'copy' });
  assert.ok(errorsFor(p).some(x => x.endsWith('.path')));
});

test('renderPage escapes text, scopes CSS, sets theme and resolves assets', () => {
  const html = E.renderPage(sample(), 'home', { assets: { hero1: 'https://cdn.example.com/hero.jpg' } });
  assert.match(html, /Roofs done &lt;right&gt;/);
  assert.doesNotMatch(html, /<right>/);
  assert.match(html, /\[data-s="hero"\]\{background-image:url\("https:\/\/cdn\.example\.com\/hero\.jpg"\)/);
  assert.match(html, /\[data-s="hero"\] h1, \[data-s="hero"\] \.cta:hover\{color:var\(--c-accent\)\}/);
  assert.match(html, /@media \(max-width: 700px\)\{\[data-s="hero"\] h1\{font-size:2rem\}\}/);
  assert.match(html, /--c-accent:#3b82f6/);
  assert.match(html, /<img src="https:\/\/cdn\.example\.com\/hero\.jpg" alt="A new roof">/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /Concept for discussion, not affiliated with Sample Roofing Co\./);
});

test('motion script only when a section uses a named effect', () => {
  assert.match(E.renderPage(sample(), 'home'), /IntersectionObserver/);
  const s = sample(); delete heroTree(s).children[0].attrs['data-motion'];
  assert.doesNotMatch(E.renderPage(s, 'home'), /<script>/);
  assert.match(E.renderPage(sample(), 'home'), /prefers-reduced-motion/);
});

test('renderPage refuses a site that fails the checker', () => {
  const s = sample(); heroTree(s).tag = 'script';
  assert.throws(() => E.renderPage(s, 'home'), /Site has problems/);
});

test('renderSite makes one file per page', () => {
  const s = sample();
  s.pages.push({ id: 'services', path: '/services', title: 'Services', sections: [sample().pages[0].sections[1]] });
  assert.deepEqual(Object.keys(E.renderSite(s)).sort(), ['index.html', 'services/index.html']);
});

test('fromHomePage starts the client site from the picked tier and drops the concept line', () => {
  const home = sample();
  const out = E.fromHomePage(home, { tier: 2, jobId: 'job-1' });
  assert.equal(out.ok, true);
  assert.deepEqual(out.site.origin, { from: 'pitch-deck', tier: 2, jobId: 'job-1' });
  assert.equal(out.site.concept, false);
  assert.deepEqual(out.site.theme, home.theme);
  assert.doesNotMatch(E.renderPage(out.site, 'home'), /Concept for discussion/);
  assert.equal(home.concept, true, 'original untouched');
  assert.equal(E.fromHomePage(home, { tier: 5 }).ok, false);
});

test('click-to-edit: find an element by key and replace only its section', () => {
  const s = sample();
  const hit = E.findEditable(s, 'home', 'cta');
  assert.deepEqual({ sectionId: hit.sectionId, path: hit.path, tag: hit.node.tag }, { sectionId: 'hero', path: [2], tag: 'a' });
  assert.equal(E.findEditable(s, 'home', 'nope'), null);
  const newServices = { id: 'services', label: 'Services', tree: { tag: 'section', children: [{ text: 'Roof repair, gutters' }] } };
  const out = E.replaceSection(s, 'home', newServices);
  assert.equal(out.ok, true);
  assert.equal(out.site.pages[0].sections[1].tree.children[0].text, 'Roof repair, gutters');
  assert.equal(s.pages[0].sections[1].tree.children[0].tag, 'h2', 'original untouched');
  const added = E.replaceSection(s, 'home', { id: 'reviews', label: 'Reviews', tree: { tag: 'section' } }, { after: 'hero' });
  assert.deepEqual(added.site.pages[0].sections.map(x => x.id), ['hero', 'reviews', 'services']);
  assert.equal(E.replaceSection(s, 'home', { id: 'bad', label: 'Bad', tree: { tag: 'script' } }).ok, false);
});
