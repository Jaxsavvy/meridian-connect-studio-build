/* Pitch deck data: the one format a prospect's Market Opportunity board is built from (#114, part 1).
 * Core lane. Rules (docs/PLAN.md, Pitch deck): every number is the prospect's own and has a source;
 * nothing internal (pricing, team, BV pipeline) can ever be in here, so unknown fields are refused.
 * Google terms: Places content (ratings, review counts...) must not be stored, so a deck keeps only Google
 * place IDs; the board fills those numbers live from Google Maps when it opens. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianDeckData = api;
})(typeof window === 'undefined' ? null : window, function () {
  const ICONS = Object.freeze(['search', 'people', 'trend', 'store', 'window', 'star']);
  const SCORE_BANDS = Object.freeze(['Weak', 'Fair', 'Healthy', 'Strong']);
  const SATURATION_BANDS = Object.freeze(['Low', 'Medium', 'High', 'Oversaturated']);
  const PLACEHOLDER = /\b(tbd|todo|lorem ipsum|placeholder|xxx)\b|\{\{|\}\}/i;
  const ASSET_ID = /^[A-Za-z0-9_-]{1,128}$/;
  const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

  // Field makers. Each returns a checker (value, path, errors) -> cleaned value.
  const str = (max, { optional = false } = {}) => (v, path, errors) => {
    if (v === undefined || v === null || v === '') {
      if (!optional) errors.push({ path, message: 'Required.' });
      return '';
    }
    if (typeof v !== 'string') { errors.push({ path, message: 'Must be text.' }); return ''; }
    const t = v.trim();
    if (t.length > max) errors.push({ path, message: `Too long (max ${max} characters).` });
    if (PLACEHOLDER.test(t)) errors.push({ path, message: 'Still has placeholder text.' });
    return t;
  };
  const num = (min, max, { integer = false } = {}) => (v, path, errors) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push({ path, message: 'Must be a number.' }); return 0; }
    if (integer && !Number.isInteger(v)) errors.push({ path, message: 'Must be a whole number.' });
    if (v < min || v > max) errors.push({ path, message: `Must be between ${min} and ${max}.` });
    return v;
  };
  const bool = (fallback = false) => (v, path, errors) => {
    if (v === undefined) return fallback;
    if (typeof v !== 'boolean') errors.push({ path, message: 'Must be yes or no.' });
    return v === true;
  };
  const oneOf = options => (v, path, errors) => {
    if (!options.includes(v)) errors.push({ path, message: `Must be one of: ${options.join(', ')}.` });
    return v;
  };
  const link = ({ optional = false } = {}) => (v, path, errors) => {
    const t = str(500, { optional })(v, path, errors);
    if (!t) return '';
    try {
      const u = new URL(t);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad');
      return u.href;
    } catch (_) { errors.push({ path, message: 'Must be a web link starting with http:// or https://.' }); return ''; }
  };
  const assetId = () => (v, path, errors) => {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string' || !ASSET_ID.test(v)) errors.push({ path, message: 'Must be an asset from this project.' });
    return v;
  };
  const placeId = () => (v, path, errors) => {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string' || !PLACE_ID.test(v)) errors.push({ path, message: 'Must be a Google place ID.' });
    return v;
  };
  const list = (item, min, max) => (v, path, errors) => {
    if (!Array.isArray(v)) { errors.push({ path, message: 'Must be a list.' }); return []; }
    if (v.length < min || v.length > max) {
      errors.push({ path, message: min === max ? `Needs exactly ${min}.` : `Needs ${min} to ${max}.` });
    }
    return v.slice(0, max).map((x, i) => item(x, `${path}.${i}`, errors));
  };
  const obj = shape => (v, path, errors) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) { errors.push({ path: path || '(deck)', message: 'Must be a group of fields.' }); return {}; }
    for (const key of Object.keys(v)) {
      if (!Object.prototype.hasOwnProperty.call(shape, key)) errors.push({ path: path ? `${path}.${key}` : key, message: 'Unknown field.' });
    }
    const out = {};
    for (const [key, check] of Object.entries(shape)) out[key] = check(v[key], path ? `${path}.${key}` : key, errors);
    return out;
  };

  // NO-GOOGLE 2026-10-29 (Jax: no paid Google for now): a section with no free source is left out (null), a part of
  // the score Google would give is "not checked", and a number nobody measured is null (shown as "Not checked", never 0).
  const optional = check => (v, path, errors) => (v === undefined || v === null ? null : check(v, path, errors));
  const numOrNull = (min, max) => (v, path, errors) => (v === null ? null : num(min, max)(v, path, errors));
  const COVERAGE = Object.freeze(['full', 'website-only', 'no-website']);
  const siteLink = () => (v, path, errors) => (v === undefined || v === null || v === '' ? null : link()(v, path, errors));
  const source = () => obj({ label: str(120), url: link() });
  const headline = () => str(160);
  const blurb = () => str(600);

  const SHAPE = obj({
    version: oneOf([1]),
    client: obj({ name: str(120), town: str(80), preparedOn: str(40), placeId: placeId() }),
    // parts: how the score was reached (shown on the board), e.g. Website 21 of 35 (#287: no ratings-based part).
    // checked: false = this part wasn't measured (e.g. Google profile with no Google data); it's left out of the value.
    score: obj({ value: num(0, 100, { integer: true }), band: oneOf(SCORE_BANDS),
      parts: list(obj({ name: str(40), points: num(0, 100), max: num(1, 100), checked: bool(true) }), 1, 6),
      coverage: optional(oneOf(COVERAGE)) }),
    bottomLine: obj({ headline: headline(), text: blurb(),
      findings: list(obj({ icon: oneOf(ICONS), title: str(60), text: str(200) }), 3, 3) }),
    market: obj({ headline: headline(),
      stats: list(obj({ icon: oneOf(ICONS), value: num(0, 1e9), prefix: str(2, { optional: true }), unit: str(4, { optional: true }),
        label: str(60), note: str(60, { optional: true }), estimate: bool(), source: source() }), 0, 4) }),
    // Demand is always shown as a labeled estimate (Jax, 2026-10-27); basis says how it was estimated.
    // Demand and saturation have no free source: null = not checked, and the board leaves the section out.
    demand: optional(obj({ headline: headline(), change: str(12), text: blurb(), series: list(num(0, 1e9), 6, 36), basis: str(160), source: source() })),
    saturation: optional(obj({ headline: headline(), level: num(0, 1), band: oneOf(SATURATION_BANDS),
      zones: list(obj({ name: str(40), density: num(0, 100), open: bool() }), 1, 6), source: source() })),
    competitors: obj({ headline: headline(), text: blurb(), channels: list(str(20), 4, 4),
      // Rating and review count are NOT stored (Google terms): the board fills them live from placeId.
      // site: the business's own website (https), how a row is known when there's no Google place ID.
      rows: list(obj({ name: str(60), you: bool(), placeId: placeId(), site: siteLink(), presence: list(numOrNull(0, 100), 4, 4),
        visibility: numOrNull(0, 100) }), 2, 5), source: source() }),
    reputation: obj({ headline: headline(), text: blurb() }),
    visibility: obj({ headline: headline(), text: blurb() }),
    gaps: obj({ headline: headline(), text: blurb(),
      lanes: list(obj({ icon: oneOf(ICONS), title: str(60), problem: str(200), build: str(200), effect: str(200) }), 3, 3) }),
    homePages: obj({ headline: headline(), text: blurb(),
      tiers: list(obj({ name: str(40), description: str(200), url: link({ optional: true }),
        desktopAsset: assetId(), phoneAsset: assetId() }), 3, 3) }),
    plan: obj({ headline: headline(),
      moves: list(obj({ name: str(40), goal: str(120), detail: str(200) }), 3, 3),
      timeline: list(obj({ when: str(20), label: str(40) }), 3, 3) }),
  });

  /** Checks a deck. Returns { ok, errors: [{ path, message }], deck } where deck is the cleaned copy.
   *  path names the field (e.g. "market.stats.0.source.url") so a form can show the error next to it. */
  function validateDeck(input) {
    const errors = [];
    const deck = SHAPE(input, '', errors);
    if (Array.isArray(input?.competitors?.rows)) {
      const yours = input.competitors.rows.filter(r => r && r.you === true).length;
      if (yours !== 1) errors.push({ path: 'competitors.rows', message: 'Mark exactly one row as the prospect.' });
    }
    const parts = Array.isArray(input?.score?.parts) ? input.score.parts : [];
    if (parts.length && parts.every(x => x && Number.isFinite(x.points) && Number.isFinite(x.max))) {
      const max = parts.reduce((t, x) => t + x.max, 0), used = parts.filter(x => x.checked !== false);
      if (max !== 100) errors.push({ path: 'score.parts', message: 'The parts must add up to 100 points in total.' });
      if (!used.length) errors.push({ path: 'score.parts', message: 'At least one part must be checked.' });
      // All parts checked: the value is their sum. Some not checked: the checked parts scaled to 100.
      const usedMax = used.reduce((t, x) => t + x.max, 0), sum = used.reduce((t, x) => t + x.points, 0);
      const want = used.length === parts.length ? Math.round(sum) : usedMax ? Math.round((100 * sum) / usedMax) : 0;
      if (used.length && want !== input.score.value) errors.push({ path: 'score.value', message: used.length === parts.length
        ? 'Must equal the sum of the parts.' : `Must equal the checked parts scaled to 100 (${want}).` });
      if (parts.some(x => x.checked === false && x.points !== 0)) errors.push({ path: 'score.parts', message: "A part that wasn't checked scores 0 points." });
      if (parts.some(x => x.points > x.max)) errors.push({ path: 'score.parts', message: 'A part can\'t score more than its maximum.' });
    }
    return { ok: errors.length === 0, errors, deck };
  }

  /** A blank deck for the Research + write stage, with the prospect's name and town already in. */
  function emptyDeck({ name = '', town = '', preparedOn = '' } = {}) {
    const src = () => ({ label: '', url: '' });
    const three = make => [make(), make(), make()];
    return {
      version: 1,
      client: { name, town, preparedOn, placeId: null },
      score: { value: 0, band: 'Fair', parts: [
        { name: 'Google profile', points: 0, max: 35 },
        { name: 'Website', points: 0, max: 35 }, { name: 'Visibility', points: 0, max: 30 }] },
      bottomLine: { headline: '', text: '', findings: three(() => ({ icon: 'search', title: '', text: '' })) },
      market: { headline: '', stats: [{ icon: 'people', value: 0, prefix: '', unit: '', label: '', note: '', estimate: false, source: src() }] },
      demand: { headline: '', change: '', text: '', series: [], basis: '', source: src() },
      saturation: { headline: '', level: 0, band: 'Medium', zones: [{ name: '', density: 0, open: false }], source: src() },
      competitors: { headline: '', text: '', channels: ['Website', 'Search', 'Social', 'Ads'],
        rows: [{ name, you: true, placeId: null, presence: [0, 0, 0, 0], visibility: 0 }], source: src() },
      reputation: { headline: '', text: '' },
      visibility: { headline: '', text: '' },
      gaps: { headline: '', text: '', lanes: three(() => ({ icon: 'search', title: '', problem: '', build: '', effect: '' })) },
      homePages: { headline: '', text: '', tiers: [
        { name: 'Tier 1', description: '', url: '', desktopAsset: null, phoneAsset: null },
        { name: 'Tier 2', description: '', url: '', desktopAsset: null, phoneAsset: null },
        { name: 'Tier 3', description: '', url: '', desktopAsset: null, phoneAsset: null }] },
      plan: { headline: '', moves: three(() => ({ name: '', goal: '', detail: '' })),
        timeline: [{ when: '30 days', label: '' }, { when: '60 days', label: '' }, { when: '90 days', label: '' }] },
    };
  }

  /** Research summary saved to the project's files: every number on the board with where it came from.
   *  Plain Markdown; only call it on a deck that passed validateDeck. */
  function researchSummary(deck) {
    const md = s => String(s).replace(/([\\`*_[\]#<>|])/g, '\\$1');
    const ref = s => `[${md(s.label)}](${s.url})`;
    const lines = [`# Research summary: ${md(deck.client.name)}, ${md(deck.client.town)}`, '', `Prepared ${md(deck.client.preparedOn)}.`, '',
      `Business score: ${deck.score.value} (${deck.score.band}): ${deck.score.parts.map(x => x.checked === false ? `${md(x.name)} not checked` : `${md(x.name)} ${x.points} of ${x.max}`).join(', ')}`
        + (deck.score.coverage === 'website-only' ? ' (based on the website only)' : deck.score.coverage === 'no-website' ? ' (no website found)' : ''),
      '', '## Market', ''];
    for (const s of deck.market.stats) {
      lines.push(`- ${md(s.label)}: ${md(s.prefix)}${s.value}${md(s.unit)}${s.estimate ? ' (estimate)' : ''}. Source: ${ref(s.source)}`);
    }
    if (deck.demand) {
      lines.push('', '## Demand (estimate)', '', `- Change: ${md(deck.demand.change)} over ${deck.demand.series.length} points. Source: ${ref(deck.demand.source)}`,
        `- How it was estimated: ${md(deck.demand.basis)}`);
    } else lines.push('', '## Demand', '', '- Not checked (no free source).');
    if (deck.saturation) {
      lines.push('', '## Saturation', '', `- Overall: ${deck.saturation.band}. Source: ${ref(deck.saturation.source)}`);
      for (const z of deck.saturation.zones) lines.push(`- ${md(z.name)}: density ${z.density}${z.open ? ' (open)' : ''}`);
    } else lines.push('', '## Saturation', '', '- Not checked (no free source).');
    lines.push('', '## Competitors', '', `Source: ${ref(deck.competitors.source)}`, '');
    for (const r of deck.competitors.rows) {
      const live = r.placeId ? `rating and reviews live from Google Maps (https://www.google.com/maps/place/?q=place_id:${r.placeId})`
        : r.site ? `website ${r.site}` : 'not on Google Maps';
      lines.push(`- ${md(r.name)}${r.you ? ' (this business)' : ''}: ${live}, visibility ${r.visibility === null ? 'not checked' : r.visibility}`);
    }
    lines.push('', '## Home-page builds', '');
    for (const t of deck.homePages.tiers) lines.push(`- ${md(t.name)}: ${t.url ? t.url : 'no live link yet'}`);
    return lines.join('\n') + '\n';
  }

  return Object.freeze({ ICONS, SCORE_BANDS, SATURATION_BANDS, COVERAGE, validateDeck, emptyDeck, researchSummary });
});
