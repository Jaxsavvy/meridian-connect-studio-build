/* Pitch deck research: the evidence model (#124). Core lane, pure code (no network).
 * The research agent (server) turns what it finds into evidence records. This file turns evidence into the
 * deck's NUMBERS, scores the business with a visible formula, and checks a deck so no number can appear that
 * isn't backed by evidence. The AI writes words only.
 * Google terms: Places content isn't stored. Rating and review count are LIVE references (place ID + field);
 * their values are passed in only for the moment of scoring (liveValues) and are never written into a deck. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianResearchModel = api;
})(typeof window === 'undefined' ? null : window, function () {
  const METHODS = Object.freeze(['api', 'page-read', 'census', 'person', 'ai-estimate']);
  // kind -> allowed fields. 'place' records carry placeId + rank (1 = first in the category search).
  const KINDS = Object.freeze({
    place: [],
    google: ['rating', 'reviews'], // always live
    profile: ['website', 'phone', 'hours', 'categories', 'photos'],
    website: ['speed', 'https', 'phoneLink', 'contactForm', 'adsPixel', 'social'],
    census: ['population', 'households'],
    demand: ['monthlySearches'],
  });
  const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
  const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
  const SCORE_PARTS = Object.freeze([['Reputation', 30], ['Google profile', 25], ['Website', 25], ['Visibility', 20]]);

  const httpUrl = v => { try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:'; } catch (_) { return false; } };

  /** Checks a list of evidence records. Returns { ok, errors: [{ index, message }] }. */
  function validateEvidence(list) {
    const errors = [];
    if (!Array.isArray(list)) return { ok: false, errors: [{ index: -1, message: 'Evidence must be a list.' }] };
    const ids = new Set();
    list.forEach((e, index) => {
      const bad = message => errors.push({ index, message });
      if (!e || typeof e !== 'object') return bad('Must be a record.');
      if (!SAFE_ID.test(String(e.id)) || ids.has(e.id)) bad('Needs a unique id.');
      ids.add(e.id);
      if (!Object.prototype.hasOwnProperty.call(KINDS, e.kind)) return bad('Unknown kind.');
      if (e.kind !== 'place' && !KINDS[e.kind].includes(e.field)) bad('Unknown field for this kind.');
      if (!['client', 'competitor', 'market'].includes(e.subject)) bad('Subject must be client, competitor or market.');
      if ((e.kind === 'place' || e.kind === 'google' || e.subject === 'competitor') && !PLACE_ID.test(String(e.placeId))) bad('Needs a Google place ID.');
      if (e.kind === 'place' && !(Number.isInteger(e.rank) && e.rank >= 1)) bad('Place needs its rank in the search.');
      if (e.kind === 'google') {
        if (e.value !== undefined && e.value !== null) bad('Google ratings and review counts are live; never store the value.');
      } else if (e.kind !== 'place' && !(typeof e.value === 'number' || typeof e.value === 'boolean')) bad('Needs a number or yes/no value.');
      if (!METHODS.includes(e.method)) bad('Unknown method.');
      if (!e.source || typeof e.source.label !== 'string' || !e.source.label.trim() || !httpUrl(e.source.url)) bad('Needs a source with a label and a web link.');
      if (Number.isNaN(Date.parse(e.fetchedAt))) bad('Needs the date it was found.');
    });
    return { ok: errors.length === 0, errors };
  }

  const find = (ev, kind, field, subject = 'client', placeId) => ev.find(e => e.kind === kind && e.field === field
    && e.subject === subject && (placeId === undefined || e.placeId === placeId));
  const val = (ev, kind, field, subject, placeId) => { const e = find(ev, kind, field, subject, placeId); return e ? e.value : undefined; };
  const places = ev => ev.filter(e => e.kind === 'place').sort((a, b) => a.rank - b.rank);
  const clientPlace = ev => ev.find(e => e.kind === 'place' && e.subject === 'client') || null;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const round1 = n => Math.round(n * 10) / 10;

  // Search presence from rank among the 4: 1st = 100, 2nd = 75, 3rd = 50, 4th = 25.
  const rankScore = rank => clamp(125 - rank * 25, 0, 100);
  function presenceFor(ev, place) {
    const s = place.subject, id = s === 'competitor' ? place.placeId : undefined;
    const speed = val(ev, 'website', 'speed', s, id);
    return [typeof speed === 'number' ? clamp(Math.round(speed), 0, 100) : 0, rankScore(place.rank),
      val(ev, 'website', 'social', s, id) === true ? 100 : 0, val(ev, 'website', 'adsPixel', s, id) === true ? 100 : 0];
  }

  /** The 4-part score. liveValues: { [placeId]: { rating, reviews } } fetched live for this moment only.
   *  Returns { value, band, parts: [{ name, points, max }], missing: [what couldn't be scored] }. */
  function scoreFromEvidence(ev, liveValues = {}) {
    const missing = [];
    const me = clientPlace(ev);
    const live = id => (id && liveValues && liveValues[id]) || {};
    // Reputation (30): rating vs competitors' average (15), review count vs theirs (15).
    let reputation = 0;
    const mine = me ? live(me.placeId) : {};
    const rivals = places(ev).filter(p => p.subject === 'competitor').map(p => live(p.placeId));
    const avg = key => { const xs = rivals.map(r => r[key]).filter(Number.isFinite); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
    if (Number.isFinite(mine.rating) && avg('rating') !== null) reputation += clamp(7.5 + (mine.rating - avg('rating')) * 15, 0, 15);
    else missing.push('Rating compared with competitors');
    if (Number.isFinite(mine.reviews) && avg('reviews')) reputation += clamp((mine.reviews / avg('reviews')) * 7.5, 0, 15);
    else missing.push('Review count compared with competitors');
    // Google profile (25): 5 points per item present.
    let profile = 0;
    for (const f of KINDS.profile) {
      const v = val(ev, 'profile', f, 'client');
      if (v === undefined) missing.push(`Google profile: ${f}`);
      else if (v === true) profile += 5;
    }
    // Website (25): mobile speed (10), HTTPS (5), phone link (5), contact or booking form (5).
    let website = 0;
    const speed = val(ev, 'website', 'speed', 'client');
    if (typeof speed === 'number') website += clamp(speed, 0, 100) / 10; else missing.push('Website speed');
    for (const f of ['https', 'phoneLink', 'contactForm']) {
      const v = val(ev, 'website', f, 'client');
      if (v === undefined) missing.push(`Website: ${f}`); else if (v === true) website += 5;
    }
    // Visibility (20): rank among the 4 in the category search.
    let visibility = 0;
    if (me) visibility = rankScore(me.rank) / 5; else missing.push('Search rank');
    const points = [reputation, profile, website, visibility].map(round1);
    const parts = SCORE_PARTS.map(([name, max], i) => ({ name, points: points[i], max }));
    const value = Math.round(points.reduce((a, b) => a + b, 0));
    const band = value >= 80 ? 'Strong' : value >= 60 ? 'Healthy' : value >= 40 ? 'Fair' : 'Weak';
    return { value, band, parts, missing };
  }

  const compact = n => (n >= 1e6 ? { value: round1(n / 1e6), unit: 'M' } : n >= 1e3 ? { value: round1(n / 1e3), unit: 'K' } : { value: n, unit: '' });
  const mapsUrl = id => `https://www.google.com/maps/place/?q=place_id:${id}`;
  const sourceOf = e => ({ label: e.source.label, url: e.source.url });

  /** Deck numbers filled from evidence; every text field is left empty for the AI and the person. The result
   *  still needs words before it passes validateDeck. names: { [placeId]: name } for competitors (typed or
   *  confirmed by a person, since Places names aren't stored). */
  function draftDeckFromEvidence(ev, { name = '', town = '', preparedOn = '', names = {} } = {}, liveValues = {}) {
    const score = scoreFromEvidence(ev, liveValues);
    const me = clientPlace(ev);
    const stats = [];
    for (const f of ['population', 'households']) {
      const e = find(ev, 'census', f, 'market');
      if (e) stats.push({ icon: 'people', ...compact(e.value), prefix: '', label: '', note: '', estimate: false, source: sourceOf(e) });
    }
    const d = find(ev, 'demand', 'monthlySearches', 'market');
    if (d) stats.push({ icon: 'search', ...compact(d.value), prefix: d.method === 'ai-estimate' ? '~' : '', label: '', note: d.method === 'ai-estimate' ? 'est.' : '',
      estimate: d.method === 'ai-estimate', source: sourceOf(d) });
    const rows = places(ev).slice(0, 5).map(p => ({ name: p.subject === 'client' ? name : (names[p.placeId] || ''), you: p.subject === 'client',
      placeId: p.placeId, presence: presenceFor(ev, p), visibility: rankScore(p.rank) }));
    return {
      version: 1,
      client: { name, town, preparedOn, placeId: me ? me.placeId : null },
      score: { value: score.value, band: score.band, parts: score.parts },
      market: { headline: '', stats: stats.slice(0, 4) },
      competitors: { headline: '', text: '', channels: ['Website', 'Search', 'Social', 'Ads'], rows,
        source: { label: 'Google Maps', url: me ? mapsUrl(me.placeId) : 'https://www.google.com/maps' } },
      missing: score.missing,
    };
  }

  /** Lists every number in the deck that evidence doesn't back. Returns [{ path, message }] (empty = clean).
   *  Recomputes what the evidence gives and compares field by field, so the AI can't add or change a number. */
  function checkDeckAgainstEvidence(deck, ev, liveValues = {}) {
    const problems = [];
    const draft = draftDeckFromEvidence(ev, {}, liveValues);
    const same = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.05;
    const check = (path, got, want) => { if (!same(got, want)) problems.push({ path, message: `Doesn't match the evidence (expected ${want}).` }); };
    check('score.value', deck?.score?.value, draft.score.value);
    (deck?.score?.parts || []).forEach((p, i) => check(`score.parts.${i}.points`, p && p.points, draft.score.parts[i] && draft.score.parts[i].points));
    (deck?.market?.stats || []).forEach((s, i) => {
      const twin = draft.market.stats.find(x => x.source.url === s?.source?.url && same(x.value, s.value) && x.unit === (s.unit || ''));
      if (!twin) problems.push({ path: `market.stats.${i}.value`, message: 'No evidence backs this number.' });
    });
    (deck?.competitors?.rows || []).forEach((r, i) => {
      const twin = draft.competitors.rows.find(x => x.placeId && x.placeId === r?.placeId);
      if (!twin) { problems.push({ path: `competitors.rows.${i}`, message: 'This business isn\'t in the research.' }); return; }
      (r.presence || []).forEach((v, k) => check(`competitors.rows.${i}.presence.${k}`, v, twin.presence[k]));
      check(`competitors.rows.${i}.visibility`, r.visibility, twin.visibility);
    });
    if (Array.isArray(deck?.demand?.series) && deck.demand.series.length && !ev.some(e => e.kind === 'demand')) {
      problems.push({ path: 'demand.series', message: 'No demand evidence backs this trend.' });
    }
    return problems;
  }

  return Object.freeze({ METHODS, KINDS, validateEvidence, scoreFromEvidence, draftDeckFromEvidence, checkDeckAgainstEvidence });
});
