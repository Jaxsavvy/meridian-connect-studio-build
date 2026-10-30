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
    // NO-GOOGLE: the business's own website (url: its https address), how it's known without Google; none: true when a
    // web search found no website of its own (NO-WEBSITE, Jax 10-29: "they need one", so that is the finding).
    site: ['url', 'none'],
  });
  const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
  const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
  // #287 (Jax 2026-10-29): Google ratings and review counts are never stored and a published deck can't load them, so
  // the stored score doesn't use them at all (no 'Reputation' part scored as 0). Three visible parts, same proportions.
  const SCORE_PARTS = Object.freeze([['Google profile', 35], ['Website', 35], ['Visibility', 30]]);

  const httpUrl = v => { try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:'; } catch (_) { return false; } };
  // NO-GOOGLE 2026-10-29 (Jax: no paid Google for now): without Google, a business is known by its website. Two sites
  // are the same business when their origin matches (https://host, any path).
  const origin = v => { try { const u = new URL(String(v)); return u.protocol === 'https:' ? u.origin : ''; } catch (_) { return ''; } };
  const keyOf = e => e.placeId || origin(e.site);

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
      if (e.kind === 'place' || e.kind === 'google') { if (!PLACE_ID.test(String(e.placeId))) bad('Needs a Google place ID.'); }
      else if (e.subject === 'competitor' && !PLACE_ID.test(String(e.placeId)) && !origin(e.site)) bad('Needs a Google place ID or the business\'s https website.');
      if (e.kind === 'place' && !(Number.isInteger(e.rank) && e.rank >= 1)) bad('Place needs its rank in the search.');
      if (e.kind === 'google') {
        if (e.value !== undefined && e.value !== null) bad('Google ratings and review counts are live; never store the value.');
      } else if (e.kind === 'site' && e.field === 'none') {
        if (e.value !== true || e.subject !== 'client') bad('Only the prospect can be marked as having no website.');
      } else if (e.kind === 'site') {
        if (!origin(e.value) || (e.subject === 'competitor' && origin(e.value) !== origin(e.site))) bad('Needs the business\'s https website.');
      } else if (e.kind !== 'place' && !(typeof e.value === 'number' || typeof e.value === 'boolean')) bad('Needs a number or yes/no value.');
      if (!METHODS.includes(e.method)) bad('Unknown method.');
      if (!e.source || typeof e.source.label !== 'string' || !e.source.label.trim() || !httpUrl(e.source.url)) bad('Needs a source with a label and a web link.');
      if (Number.isNaN(Date.parse(e.fetchedAt))) bad('Needs the date it was found.');
    });
    return { ok: errors.length === 0, errors };
  }

  // key: a competitor's place ID, or its website origin when there's no Google (NO-GOOGLE).
  const find = (ev, kind, field, subject = 'client', key) => ev.find(e => e.kind === kind && e.field === field
    && e.subject === subject && (key === undefined || keyOf(e) === key));
  const val = (ev, kind, field, subject, placeId) => { const e = find(ev, kind, field, subject, placeId); return e ? e.value : undefined; };
  const places = ev => ev.filter(e => e.kind === 'place').sort((a, b) => a.rank - b.rank);
  /** No Google data at all (no place, no Google profile): the score and rows come from websites only. */
  const websiteOnly = ev => ev.some(e => e.kind === 'site' && e.subject === 'client')
    && !ev.some(e => e.kind === 'place' || e.kind === 'profile' || e.kind === 'google');
  const noWebsite = ev => ev.some(e => e.kind === 'site' && e.field === 'none' && e.subject === 'client' && e.value === true)
    && !ev.some(e => e.kind === 'site' && e.field === 'url' && e.subject === 'client');
  /** Website part as a share of the website checks that were made (speed 14, HTTPS 7, phone link 7, form 7). */
  function websiteShare(ev, subject, key) {
    let got = 0, avail = 0;
    const speed = val(ev, 'website', 'speed', subject, key);
    if (typeof speed === 'number') { got += clamp(speed, 0, 100) * 0.14; avail += 14; }
    for (const f of ['https', 'phoneLink', 'contactForm']) {
      const v = val(ev, 'website', f, subject, key);
      if (v !== undefined) { avail += 7; if (v === true) got += 7; }
    }
    return avail ? got / avail : null;
  }
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

  /** The 3-part score from stored evidence only. liveValues is kept for callers but no longer used (#287).
   *  Returns { value, band, parts: [{ name, points, max }], missing: [what couldn't be scored] }. */
  function scoreFromEvidence(ev, liveValues = {}) {
    const missing = [];
    if (noWebsite(ev)) {   // NO-WEBSITE: the Website part is measured, and it's 0: there's no website to score
      const parts = SCORE_PARTS.map(([name, max]) => ({ name, points: 0, max, checked: name === 'Website' }));
      return { value: 0, band: 'Weak', parts, missing: ['Google profile (not checked)', 'Search rank (not checked)'], coverage: 'no-website' };
    }
    if (websiteOnly(ev)) {   // NO-GOOGLE: only the Website part is measured; Google profile and Visibility aren't checked
      const share = websiteShare(ev, 'client');
      if (val(ev, 'website', 'speed', 'client') === undefined) missing.push('Website speed');
      for (const f of ['https', 'phoneLink', 'contactForm']) if (val(ev, 'website', f, 'client') === undefined) missing.push(`Website: ${f}`);
      missing.push('Google profile (not checked)', 'Search rank (not checked)');
      const website = share === null ? 0 : round1(35 * share), value = share === null ? 0 : Math.round(100 * share);
      const parts = SCORE_PARTS.map(([name, max]) => (name === 'Website' ? { name, points: website, max, checked: share !== null }
        : { name, points: 0, max, checked: false }));
      const band = value >= 80 ? 'Strong' : value >= 60 ? 'Healthy' : value >= 40 ? 'Fair' : 'Weak';
      return { value, band, parts, missing, coverage: 'website-only' };
    }
    const me = clientPlace(ev);
    // Google profile (35): 7 points per item present.
    let profile = 0;
    for (const f of KINDS.profile) {
      const v = val(ev, 'profile', f, 'client');
      if (v === undefined) missing.push(`Google profile: ${f}`);
      else if (v === true) profile += 7;
    }
    // Website (35): mobile speed (14), HTTPS (7), phone link (7), contact or booking form (7).
    let website = 0;
    const speed = val(ev, 'website', 'speed', 'client');
    if (typeof speed === 'number') website += clamp(speed, 0, 100) * 0.14; else missing.push('Website speed');
    for (const f of ['https', 'phoneLink', 'contactForm']) {
      const v = val(ev, 'website', f, 'client');
      if (v === undefined) missing.push(`Website: ${f}`); else if (v === true) website += 7;
    }
    // Visibility (30): rank among the 4 in the category search.
    let visibility = 0;
    if (me) visibility = rankScore(me.rank) * 0.3; else missing.push('Search rank');
    const points = [profile, website, visibility].map(round1);
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
      if (e) stats.push({ icon: 'people', ...compact(e.value), prefix: '', label: f === 'population' ? 'People living here' : 'Households', note: '', estimate: false, source: sourceOf(e) });
    }
    const d = find(ev, 'demand', 'monthlySearches', 'market');
    // Search demand is always labeled an estimate (Jax, 2026-10-27); "~" when it isn't from Google Ads data.
    if (d) stats.push({ icon: 'search', ...compact(d.value), prefix: d.method === 'ai-estimate' ? '~' : '', label: '', note: 'est.',
      estimate: true, source: sourceOf(d) });
    if (score.coverage === 'website-only' || score.coverage === 'no-website') {   // NO-GOOGLE: rows are the businesses whose websites were read
      const sites = ev.filter(e => e.kind === 'site').sort((a, b) => (a.subject === 'client' ? -1 : 0) - (b.subject === 'client' ? -1 : 0));
      const rows = sites.slice(0, 5).map(e => {
        if (e.field === 'none') return { name, you: true, placeId: null, site: null, presence: [0, null, null, null], visibility: null };   // no website: 0, the rest unknown
        const you = e.subject === 'client', key = you ? undefined : origin(e.value), share = websiteShare(ev, e.subject, key);
        const yes = f => { const v = val(ev, 'website', f, e.subject, key); return v === undefined ? null : v === true ? 100 : 0; };
        return { name: you ? name : (names[origin(e.value)] || ''), you, placeId: null, site: origin(e.value),
          presence: [share === null ? null : Math.round(100 * share), null, yes('social'), yes('adsPixel')], visibility: null };
      });
      const mine = sites.find(e => e.subject === 'client');
      return {
        version: 1,
        client: { name, town, preparedOn, placeId: null },
        score: { value: score.value, band: score.band, parts: score.parts, coverage: score.coverage },
        market: { headline: '', stats: stats.slice(0, 4) },
        demand: null, saturation: null,
        competitors: { headline: '', text: '', channels: ['Website', 'Search', 'Social', 'Ads'], rows,
          source: mine ? sourceOf(mine) : (sites[0] ? sourceOf(sites[0]) : { label: '', url: '' }) },
        missing: score.missing,
      };
    }
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
    const same = (a, b) => (a === null && b === null) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.05);
    const check = (path, got, want) => { if (!same(got, want)) problems.push({ path, message: `Doesn't match the evidence (expected ${want}).` }); };
    check('score.value', deck?.score?.value, draft.score.value);
    (deck?.score?.parts || []).forEach((p, i) => check(`score.parts.${i}.points`, p && p.points, draft.score.parts[i] && draft.score.parts[i].points));
    (deck?.market?.stats || []).forEach((s, i) => {
      const twin = draft.market.stats.find(x => x.source.url === s?.source?.url && same(x.value, s.value) && x.unit === (s.unit || ''));
      if (!twin) problems.push({ path: `market.stats.${i}.value`, message: 'No evidence backs this number.' });
    });
    (deck?.competitors?.rows || []).forEach((r, i) => {
      const twin = draft.competitors.rows.find(x => (x.placeId && x.placeId === r?.placeId) || (!x.placeId && x.site && x.site === origin(r?.site))
        || (x.you && r?.you === true && !x.placeId && !x.site && !r.placeId && !r.site));   // NO-WEBSITE: the prospect's own row
      if (!twin) { problems.push({ path: `competitors.rows.${i}`, message: 'This business isn\'t in the research.' }); return; }
      (r.presence || []).forEach((v, k) => check(`competitors.rows.${i}.presence.${k}`, v, twin.presence[k]));
      check(`competitors.rows.${i}.visibility`, r.visibility, twin.visibility);
    });
    if (['website-only', 'no-website'].includes(draft.score.coverage) && (deck?.score?.parts || []).some((p, i) => p && draft.score.parts[i] && p.checked !== draft.score.parts[i].checked)) {
      problems.push({ path: 'score.parts', message: 'Only the parts the research measured can be marked checked.' });
    }
    if (Array.isArray(deck?.demand?.series) && deck.demand.series.length && !ev.some(e => e.kind === 'demand')) {
      problems.push({ path: 'demand.series', message: 'No demand evidence backs this trend.' });
    }
    return problems;
  }

  return Object.freeze({ METHODS, KINDS, origin, websiteOnly, noWebsite, validateEvidence, scoreFromEvidence, draftDeckFromEvidence, checkDeckAgainstEvidence });
});
