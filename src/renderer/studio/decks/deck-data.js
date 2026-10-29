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
  const bool = () => (v, path, errors) => {
    if (v === undefined) return false;
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

  const source = () => obj({ label: str(120), url: link() });
  const headline = () => str(160);
  const blurb = () => str(600);

  const SHAPE = obj({
    version: oneOf([1]),
    client: obj({ name: str(120), town: str(80), preparedOn: str(40), placeId: placeId() }),
    // parts: how the score was reached (shown on the board), e.g. Website 21 of 35 (#287: no ratings-based part).
    score: obj({ value: num(0, 100, { integer: true }), band: oneOf(SCORE_BANDS),
      parts: list(obj({ name: str(40), points: num(0, 100), max: num(1, 100) }), 1, 6) }),
    bottomLine: obj({ headline: headline(), text: blurb(),
      findings: list(obj({ icon: oneOf(ICONS), title: str(60), text: str(200) }), 3, 3) }),
    market: obj({ headline: headline(),
      stats: list(obj({ icon: oneOf(ICONS), value: num(0, 1e9), prefix: str(2, { optional: true }), unit: str(4, { optional: true }),
        label: str(60), note: str(60, { optional: true }), estimate: bool(), source: source() }), 1, 4) }),
    // Demand is always shown as a labeled estimate (Jax, 2026-10-27); basis says how it was estimated.
    demand: obj({ headline: headline(), change: str(12), text: blurb(), series: list(num(0, 1e9), 6, 36), basis: str(160), source: source() }),
    saturation: obj({ headline: headline(), level: num(0, 1), band: oneOf(SATURATION_BANDS),
      zones: list(obj({ name: str(40), density: num(0, 100), open: bool() }), 1, 6), source: source() }),
    competitors: obj({ headline: headline(), text: blurb(), channels: list(str(20), 4, 4),
      // Rating and review count are NOT stored (Google terms): the board fills them live from placeId.
      rows: list(obj({ name: str(60), you: bool(), placeId: placeId(), presence: list(num(0, 100), 4, 4),
        visibility: num(0, 100) }), 2, 5), source: source() }),
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
      const sum = parts.reduce((t, x) => t + x.points, 0), max = parts.reduce((t, x) => t + x.max, 0);
      if (max !== 100) errors.push({ path: 'score.parts', message: 'The parts must add up to 100 points in total.' });
      if (Math.round(sum) !== input.score.value) errors.push({ path: 'score.value', message: 'Must equal the sum of the parts.' });
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
      `Business score: ${deck.score.value} (${deck.score.band}): ${deck.score.parts.map(x => `${md(x.name)} ${x.points} of ${x.max}`).join(', ')}`,
      '', '## Market', ''];
    for (const s of deck.market.stats) {
      lines.push(`- ${md(s.label)}: ${md(s.prefix)}${s.value}${md(s.unit)}${s.estimate ? ' (estimate)' : ''}. Source: ${ref(s.source)}`);
    }
    lines.push('', '## Demand (estimate)', '', `- Change: ${md(deck.demand.change)} over ${deck.demand.series.length} points. Source: ${ref(deck.demand.source)}`,
      `- How it was estimated: ${md(deck.demand.basis)}`,
      '', '## Saturation', '', `- Overall: ${deck.saturation.band}. Source: ${ref(deck.saturation.source)}`);
    for (const z of deck.saturation.zones) lines.push(`- ${md(z.name)}: density ${z.density}${z.open ? ' (open)' : ''}`);
    lines.push('', '## Competitors', '', `Source: ${ref(deck.competitors.source)}`, '');
    for (const r of deck.competitors.rows) {
      const live = r.placeId ? `rating and reviews live from Google Maps (https://www.google.com/maps/place/?q=place_id:${r.placeId})` : 'not on Google Maps';
      lines.push(`- ${md(r.name)}${r.you ? ' (this business)' : ''}: ${live}, visibility ${r.visibility}`);
    }
    lines.push('', '## Home-page builds', '');
    for (const t of deck.homePages.tiers) lines.push(`- ${md(t.name)}: ${t.url ? t.url : 'no live link yet'}`);
    return lines.join('\n') + '\n';
  }

  return Object.freeze({ ICONS, SCORE_BANDS, SATURATION_BANDS, validateDeck, emptyDeck, researchSummary });
});
