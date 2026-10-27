'use strict';
(function (root, factory) {
  const api = factory(() => root ? root.MeridianDeckData : require('../../decks/deck-data.js'));
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianPitchBoard = api;
})(typeof window === 'undefined' ? null : window, function (getDeckData) {
  // The Market Opportunity board (v12 design): one HTML page built only from a checked deck and its assets.
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[ch]);
  const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const ICON = Object.freeze({ search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 5 2 5 5"/>',
    trend: '<path d="M4 20V14M9 20V10M14 20V13M19 20V6M4 9l5-4 5 4 6-5"/>', store: '<path d="M4 9h16v11H4zM3 9l2-5h14l2 5M10 20v-6h4v6"/>',
    window: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 13h6"/>', star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2-5.5-3-5.5 3 1-6.2L3 9.7l6.2-.9z"/>' });
  const icon = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ICON.search}</svg>`;

  /** An image URL from the assets argument: web links or plain relative paths only (never data: or script URLs). */
  function assetUrl(assets, key) {
    const raw = assets && key ? assets[key] : null, value = typeof raw === 'string' ? raw : raw && typeof raw.url === 'string' ? raw.url : '';
    if (/^https?:\/\//i.test(value)) { try { return new URL(value).href; } catch (_) { return ''; } }
    return /^(?!\/\/)(?!.*\.\.)[A-Za-z0-9_./-]{1,300}$/.test(value) ? value : '';
  }
  const img = (url, cls, alt = '') => url ? `<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy">` : '';
  const source = s => `<p class="src">Source: <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a></p>`;
  const head = (n, label, title, text) => `<p class="eyebrow">${String(n).padStart(2, '0')}. ${label}</p><h2>${esc(title)}</h2>${text ? `<p class="lede">${esc(text)}</p>` : ''}`;

  function gauge(score) {
    const C = 2 * Math.PI * 80, arc = C * 0.75, fill = arc * Math.min(Math.max(score.value, 0), 100) / 100;
    return `<svg class="gauge" viewBox="0 0 200 200" role="img" aria-label="Score ${score.value} of 100, ${esc(score.band)}">`
      + `<circle class="t" cx="100" cy="100" r="80" stroke-dasharray="${arc} ${C}"/><circle class="f" cx="100" cy="100" r="80" stroke-dasharray="${fill} ${C}"/>`
      + `<text x="100" y="108" class="v">${score.value}</text><text x="100" y="136" class="b">${esc(score.band.toUpperCase())}</text></svg>`;
  }
  function trend(series) {
    const max = Math.max(...series), min = Math.min(...series), span = max - min || 1;
    const pts = series.map((v, i) => `${(i / (series.length - 1)) * 600},${110 - ((v - min) / span) * 100}`).join(' ');
    return `<svg class="trend" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
  }
  const bar = (label, value, cls = '', tail = '') => `<div class="bar ${cls}"><span>${esc(label)}</span><i><b style="width:${Math.min(Math.max(Number(value) || 0, 0), 100)}%"></b></i><em>${tail}</em></div>`;
  const level = p => p >= 67 ? 'p3' : p >= 34 ? 'p2' : p > 0 ? 'p1' : 'p0';

  function tierCard(t, assets) {
    // A tier with no capture yet shows "In progress"; its link shows as soon as it has one.
    const desktop = assetUrl(assets, t.desktopAsset), phone = assetUrl(assets, t.phoneAsset);
    const frame = desktop ? img(desktop, 'cap', `${t.name} on a computer`) + img(phone, 'cap-phone', `${t.name} on a phone`)
      : '<p class="wip">In progress</p>';
    return `<article class="tier"><p class="eyebrow">Concept visualization</p><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p>`
      + `<div class="frame"><div class="dots"><i></i><i></i><i></i></div>${frame}</div>`
      + (t.url ? `<a class="look" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Look inside ${esc(t.name)}</a>` : '')
      + '</article>';
  }

  /** Builds the board. Refuses a deck that fails the deck checker; every piece of deck text is escaped. */
  function renderDeck(input, assets = {}) {
    const checked = getDeckData().validateDeck(input);
    if (!checked.ok) throw new Error(`The deck has ${checked.errors.length} thing(s) to fix before the board can be built.`);
    const d = checked.deck, c = d.client, rows = d.competitors.rows;
    const logo = img(assetUrl(assets, 'logo'), 'logo', 'Breakthrough Ventures');
    const sections = [
      `<header class="hero">${img(assetUrl(assets, 'hero'), 'bg')}<div class="top">${logo}</div><div class="in"><p class="eyebrow">Prepared exclusively for</p>`
        + `<p class="who">${esc(c.name)}</p><h1>Market Opportunity Analysis</h1><p class="lede">${esc(c.town)} · ${esc(c.preparedOn)}</p></div></header>`,
      `<section id="bottom-line" class="split"><div>${head(1, 'The bottom line', d.bottomLine.headline, d.bottomLine.text)}</div>`
        + `<div class="score"><p class="eyebrow">Business success score</p>${gauge(d.score)}<ul class="parts">`
        + d.score.parts.map(p => `<li><span>${esc(p.name)}</span><strong>${fmt(p.points)} of ${fmt(p.max)}</strong></li>`).join('') + '</ul></div>'
        + '<ul class="finds">' + d.bottomLine.findings.map(f => `<li>${icon(f.icon)}<div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div></li>`).join('') + '</ul></section>',
      `<section id="market">${head(2, 'Market snapshot', d.market.headline)}<ul class="stats">`
        + d.market.stats.map(s => `<li>${icon(s.icon)}<strong>${esc(s.prefix)}${fmt(s.value)}${esc(s.unit)}</strong><span>${esc(s.label)}</span>`
          + `${s.note || s.estimate ? `<em>${esc(s.note || 'est.')}</em>` : ''}${source(s.source)}</li>`).join('') + '</ul></section>',
      `<section id="demand" class="split"><div>${head(3, 'Demand (estimate)', d.demand.headline, d.demand.text)}<p class="basis">${esc(d.demand.basis)}</p>${source(d.demand.source)}</div>`
        + `<div class="chart"><p class="change">${esc(d.demand.change)}</p>${trend(d.demand.series)}</div></section>`,
      `<section id="saturation">${head(4, 'Market saturation', d.saturation.headline)}<div class="scale"><u style="left:${d.saturation.level * 100}%"></u></div>`
        + `<p class="ticks"><span>Low</span><span>Medium</span><span>High</span><span>Oversaturated</span></p><p class="band">Overall: ${esc(d.saturation.band)}</p>`
        + d.saturation.zones.map(z => bar(z.name, z.density, z.open ? 'open' : '', z.open ? 'Open' : '')).join('') + source(d.saturation.source) + '</section>',
      `<section id="competitors">${head(5, 'Competitive landscape', d.competitors.headline, d.competitors.text)}<table class="grid"><thead><tr><th></th>`
        + d.competitors.channels.map(ch => `<th>${esc(ch)}</th>`).join('') + '</tr></thead><tbody>'
        + rows.map(r => `<tr${r.you ? ' class="you"' : ''}><th>${esc(r.name)}</th>${r.presence.map(p => `<td class="${level(p)}"></td>`).join('')}</tr>`).join('')
        + `</tbody></table><p class="legend"><i class="p3"></i>Strong <i class="p2"></i>Moderate <i class="p1"></i>Weak</p>${source(d.competitors.source)}</section>`,
      `<section id="reputation">${head(6, 'Reviews and reputation', d.reputation.headline, d.reputation.text)}<ul class="reviews">`
        // Ratings and review counts are never stored: #127 fills each [data-field] live from Google Maps.
        + rows.map(r => `<li${r.you ? ' class="you"' : ''}><span>${esc(r.name)}</span>${r.placeId
          ? ['rating', 'reviews'].map(f => `<span class="live"><small>${f === 'rating' ? 'Rating' : 'Reviews'}</small>`
            + `<b data-place-id="${esc(r.placeId)}" data-field="${f}">Live from Google Maps</b></span>`).join('')
          : '<span class="live">Not on Google Maps</span>'}</li>`).join('') + '</ul><p class="credit">Google Maps</p></section>',
      `<section id="visibility">${head(7, 'Online visibility', d.visibility.headline, d.visibility.text)}`
        + rows.map(r => bar(r.name, r.visibility, r.you ? 'you' : '', fmt(r.visibility))).join('') + '<p class="src">Visibility rating out of 100.</p></section>',
      `<section id="gaps">${head(8, 'Opportunity gap', d.gaps.headline, d.gaps.text)}<div class="lanes">`
        + d.gaps.lanes.map(l => `<article>${icon(l.icon)}<h3>${esc(l.title)}</h3><p>${esc(l.problem)}</p><p class="k">Build</p><p>${esc(l.build)}</p>`
          + `<p class="k">Expected effect</p><p>${esc(l.effect)}</p></article>`).join('') + '</div></section>',
      `<section id="home-pages">${head(9, 'Home-page concepts', d.homePages.headline, d.homePages.text)}<div class="tiers">`
        + d.homePages.tiers.map(t => tierCard(t, assets)).join('') + '</div></section>',
      `<section id="plan">${head(10, 'The plan', d.plan.headline)}<div class="moves">`
        + d.plan.moves.map((m, i) => `<article><p class="eyebrow">0${i + 1}</p><h3>${esc(m.name)}</h3><p class="goal">${esc(m.goal)}</p><p>${esc(m.detail)}</p></article>`).join('')
        + '</div><ol class="timeline">' + d.plan.timeline.map(t => `<li><strong>${esc(t.when)}</strong><span>${esc(t.label)}</span></li>`).join('') + '</ol></section>',
      `<footer class="close">${img(assetUrl(assets, 'closing'), 'bg')}<div class="in">${logo}<p>Prepared for ${esc(c.name)}, ${esc(c.town)}. Every number on this page comes from the source shown with it.</p></div></footer>`,
    ];
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\' https: http:; style-src \'unsafe-inline\' https://fonts.googleapis.com; font-src https://fonts.gstatic.com">'
      + `<title>Market Opportunity Analysis · ${esc(c.name)}</title>`
      + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400&display=swap">'
      + `<style>${BOARD_CSS}</style></head><body>${sections.join('')}</body></html>`;
  }

  const BOARD_CSS = `:root{--navy:#050b16;--panel:#0b1526;--line:#1b2a42;--text:#eef3fa;--muted:#9fb0c6;--blue:#3d8bff;--sky:#5fb4ff}
*{box-sizing:border-box}body{margin:0;background:var(--navy);color:var(--text);font:16px/1.55 Figtree,system-ui,sans-serif}
h1,h2,h3{font-family:Newsreader,Georgia,serif;font-weight:400;margin:0 0 .6rem}h2{font-size:clamp(1.8rem,3.4vw,2.6rem);line-height:1.12}
h3{font-family:Figtree,system-ui,sans-serif;font-weight:600;font-size:1.05rem}a{color:var(--sky)}
section{max-width:1080px;margin:0 auto;padding:4.5rem 1.25rem;border-top:1px solid var(--line)}
.eyebrow{color:var(--sky);font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;margin:0 0 .6rem}.lede,.src,.basis,.legend,.ticks{color:var(--muted)}
.src,.legend,.credit{font-size:.8rem}.ic{width:22px;height:22px;fill:none;stroke:var(--sky);stroke-width:1.6;flex:none}
.hero,.close{position:relative;min-height:88vh;display:grid;align-items:center;overflow:hidden;background:#0a1830}
.close{min-height:60vh}.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:72% center;z-index:0}
.hero::after,.close::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,11,22,.85),rgba(5,11,22,.15) 65%),linear-gradient(0deg,var(--navy),transparent 30%)}
.hero .in,.close .in,.top{position:relative;z-index:1;max-width:1080px;width:100%;margin:0 auto;padding:0 1.25rem}.top{position:absolute;top:1.5rem;left:0;right:0}
.logo{height:46px;width:auto}.who{letter-spacing:.2em;text-transform:uppercase;font-weight:600}h1{font-size:clamp(3rem,8vw,5.6rem);line-height:.98;max-width:9ch}
.split{display:grid;grid-template-columns:1.1fr 1fr;gap:2.5rem;align-items:start}.finds{grid-column:1/-1}
.score{text-align:center}.gauge{width:220px;transform:rotate(135deg)}.gauge circle{fill:none;stroke-width:14;stroke-linecap:round}.gauge .t{stroke:var(--line)}.gauge .f{stroke:var(--sky)}
.gauge text{transform:rotate(-135deg);transform-origin:100px 100px;text-anchor:middle;fill:var(--text)}.gauge .v{font-size:44px;font-weight:600}.gauge .b{font-size:12px;letter-spacing:.15em;fill:var(--sky)}
.parts,.finds,.stats,.reviews,.timeline{list-style:none;margin:0;padding:0}.parts li{display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0;border-bottom:1px solid var(--line)}
.finds,.stats,.lanes,.tiers,.moves{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem}.finds li{display:flex;gap:.8rem}.finds p{margin:0;color:var(--muted)}
.stats{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}.stats li{border-left:1px solid var(--line);padding-left:1rem}.stats strong{display:block;font-size:2.4rem;font-weight:500}.stats em{display:block;color:var(--muted);font-size:.8rem}
.chart{position:relative}.change{color:var(--sky);font-size:1.6rem;font-weight:600;margin:0}.trend{width:100%;height:160px}.trend polyline{fill:none;stroke:var(--sky);stroke-width:3;vector-effect:non-scaling-stroke}
.scale{position:relative;height:8px;border-radius:4px;background:linear-gradient(90deg,#2bb39a,#3d8bff 40%,#e8a33c 70%,#e2533c)}.scale u{position:absolute;top:-5px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:#fff;border:3px solid var(--blue)}
.ticks{display:flex;justify-content:space-between;font-size:.8rem}.bar{display:grid;grid-template-columns:minmax(7rem,12rem) 1fr 3.5rem;gap:1rem;align-items:center;margin:.55rem 0}
.bar i{height:8px;border-radius:4px;background:var(--line)}.bar b{display:block;height:100%;border-radius:4px;background:#7f8ea6}.bar.you span,.bar.open em{color:var(--sky)}.bar.you b,.bar.open b{background:var(--blue)}.bar em{font-style:normal;color:var(--muted)}
.grid{border-spacing:6px;width:100%;max-width:560px}.grid th{font-weight:400;color:var(--muted);text-align:left;font-size:.85rem}.grid td{height:48px;border-radius:3px}.grid .you th{color:var(--sky)}
.p3{background:#8392ad}.p2{background:#33435f}.p1{background:#18243a}.p0{background:#0d1626}.you .p3{background:var(--blue)}.you .p2{background:#1e4f9a}
.legend i{display:inline-block;width:10px;height:10px;margin:0 .3rem 0 .8rem}.reviews li{display:grid;grid-template-columns:1fr auto auto;gap:1rem;padding:.8rem 1rem;border:1px solid var(--line);border-radius:8px;margin:.5rem 0}
.reviews .you{border-color:var(--blue);color:var(--sky)}.live{color:var(--muted);font-size:.85rem}.live small{display:block;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}.live b{font-weight:500}.credit{color:var(--muted)}
.lanes article,.moves article{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:1.4rem}.lanes h3{color:var(--sky)}.lanes p{margin:.2rem 0 .6rem}.k{color:var(--muted);font-size:.72rem;letter-spacing:.15em;text-transform:uppercase}
.tier p{color:var(--muted)}.frame{position:relative;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel);aspect-ratio:4/3}
.dots{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid var(--line)}.dots i{width:7px;height:7px;border-radius:50%;background:#33435f}
.cap{width:100%;display:block}.cap-phone{position:absolute;right:8px;bottom:8px;width:24%;aspect-ratio:9/18;object-fit:cover;object-position:top;border-radius:8px;border:2px solid var(--line)}.wip{display:grid;place-items:center;height:80%;margin:0}
.look{display:inline-block;margin-top:.6rem}.moves .goal{color:var(--text);font-weight:600}.moves p{color:var(--muted);margin:.2rem 0}
.timeline{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem;margin-top:2rem;border-top:1px solid var(--line)}.timeline li{padding-top:1rem}.timeline strong{display:block}.timeline span{color:var(--muted)}
.close p{max-width:36rem;color:var(--text)}
@media (max-width:760px){section{padding:3rem 1rem}.split,.finds,.lanes,.tiers,.moves,.timeline{grid-template-columns:1fr}.bar{grid-template-columns:7rem 1fr 2.5rem}
.reviews li{grid-template-columns:1fr}.stats strong{font-size:2rem}.hero{min-height:80vh}}`;

  return { esc, assetUrl, renderDeck };
});
