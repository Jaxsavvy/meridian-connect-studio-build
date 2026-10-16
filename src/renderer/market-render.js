/* Market Analysis report renderer (shared by Meridian's Projects page and Connect's project workspace). 2026-10-11
   MarketRender.render(element, report)   report = report.json from market_intel (owner or employee view)
   Rules: every number shows its source on hover; estimates/assumptions are labelled; missing data says why. */
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d = 0) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
  const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }));
  const dom = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');

  const CSS = `
.mr{container:mr/inline-size;--bg:#050E1A;--card:#0C1622;--line:#1B2A3C;--text:#E8EEF7;--mute:#8A9AB0;--blue:#1A84F8;--cyan:#4FB8FF;--good:#3DD68C;--warn:#F5B947;--bad:#F06B7E;
  color:var(--text);font-family:Inter,"Segoe UI",system-ui,sans-serif;font-size:14px;line-height:1.5;font-variant-numeric:tabular-nums}
.mr *{box-sizing:border-box}
.mr h2,.mr .serif{font-family:"Source Serif 4","Source Serif Pro",Georgia,serif;font-weight:600;letter-spacing:-.01em}
.mr .hero{padding:28px 28px 24px;border-radius:14px;background:radial-gradient(120% 140% at 85% 0%,#17365C 0%,#0A1828 55%,#050E1A 100%);border:1px solid var(--line);margin-bottom:14px}
.mr .kicker{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);font-weight:600}
.mr .hero h2{font-size:34px;line-height:1.1;margin:8px 0 6px}
.mr .hero p{color:#B8C6D9;max-width:640px;margin:0}
.mr .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.mr .pill{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--line);color:var(--mute);background:#0A1420}
.mr .pill.warn{color:var(--warn);border-color:#4A3A16}
.mr .sec{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:14px}
.mr .num-label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);font-weight:600}
.mr .sec h2{font-size:22px;margin:4px 0 6px}
.mr .lead{color:#B8C6D9;margin:0 0 12px;max-width:680px}
.mr .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.mr .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.mr .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.mr .stat{padding:14px;border:1px solid var(--line);border-radius:10px;background:#0A1420}
.mr .stat b{display:block;font-size:26px;font-weight:600;line-height:1.15}
.mr .stat>span{display:block;color:var(--text);font-size:13px}
.mr .stat>small{color:var(--mute);font-size:12px}
.mr [data-src]{cursor:help;border-bottom:1px dotted #33475F}
.mr .tag{font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:1px 6px;border-radius:4px;margin-left:6px;vertical-align:2px;font-weight:600}
.mr .tag.estimate{background:#3A2E10;color:var(--warn)}.mr .tag.assumption{background:#2A2140;color:#B9A2F5}
.mr .na{color:var(--mute);font-style:italic;font-size:13px}
.mr .bottom{display:grid;grid-template-columns:1.1fr .9fr 1.2fr;gap:18px;align-items:center}
.mr .signals div{display:flex;gap:10px;margin-bottom:10px}
.mr .signals i{flex:0 0 8px;height:8px;border-radius:50%;margin-top:7px;background:var(--cyan)}
.mr .signals b{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--cyan)}
.mr .signals span{color:#B8C6D9;font-size:13px}
.mr .bar{height:8px;background:#122033;border-radius:6px;position:relative;overflow:hidden}
.mr .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,#1A84F8,#4FB8FF)}
.mr .row{display:grid;grid-template-columns:minmax(150px,200px) 1fr 56px;gap:10px;align-items:center;margin:8px 0;font-size:13px}
.mr .row.me{color:#fff;font-weight:600}
.mr .sat{height:10px;border-radius:6px;background:linear-gradient(90deg,#3DD68C,#F5B947 60%,#F06B7E);position:relative;margin:26px 0 6px}
.mr .sat em{position:absolute;top:-6px;width:22px;height:22px;margin-left:-11px;border-radius:50%;background:#fff;border:5px solid var(--blue)}
.mr .sat-l{display:flex;justify-content:space-between;color:var(--mute);font-size:11px}
.mr table{width:100%;border-collapse:collapse;font-size:13px}
.mr th{text-align:left;color:var(--mute);font-weight:500;font-size:12px;padding:6px 8px;border-bottom:1px solid var(--line)}
.mr td{padding:7px 8px;border-bottom:1px solid #132234}
.mr tr.me td{background:#0F2340}
.mr .cell{display:inline-block;width:100%;height:18px;border-radius:4px}
.mr .cell.strong{background:#1A84F8}.mr .cell.moderate{background:#6E87A6}.mr .cell.weak{background:#1B2A3C}.mr .cell.unknown{background:repeating-linear-gradient(45deg,#111D2C,#111D2C 4px,#0C1622 4px,#0C1622 8px)}
.mr .legend{display:flex;gap:14px;color:var(--mute);font-size:12px;margin-top:8px}.mr .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.mr .opp{border:1px solid var(--line);border-radius:10px;padding:16px;background:#0A1420}
.mr .opp h3{margin:0 0 6px;font-size:15px;color:#fff}
.mr .opp p{margin:0 0 10px;color:#B8C6D9;font-size:13px}
.mr .impact{font-size:11px;letter-spacing:.08em;text-transform:uppercase;border:1px solid #1E4E86;color:var(--cyan);border-radius:999px;padding:2px 10px}
.mr .chk{display:grid;grid-template-columns:22px 1fr;gap:6px;margin:5px 0;font-size:13px}
.mr .chk .y{color:var(--good)}.mr .chk .n{color:var(--bad)}.mr .chk small{color:var(--mute)}
.mr .kw-svc{font-size:11px;color:var(--mute)}
.mr .int{font-size:11px;padding:1px 7px;border-radius:999px;background:#122033;color:#B8C6D9}
.mr .int.urgent{background:#3A1620;color:#F59AA8}.mr .int.buying{background:#0F2C4E;color:#8CC6FF}
.mr details summary{cursor:pointer;color:var(--cyan);font-size:13px;margin-top:8px}
.mr .src{font-size:12px;color:var(--mute)}.mr .src td{padding:5px 8px}
.mr .muted{color:var(--mute)}
@container mr (max-width:1000px){.mr .grid3{grid-template-columns:1fr 1fr}.mr .bottom{grid-template-columns:1fr 1fr}.mr .bottom>div:first-child{grid-column:1/-1}}
@container mr (max-width:760px){.mr .grid2,.mr .grid3,.mr .bottom{grid-template-columns:1fr}.mr .stats{grid-template-columns:1fr 1fr}}`;

  function injectCss() {
    if (document.getElementById('mr-css')) return;
    const s = document.createElement('style');
    s.id = 'mr-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function srcText(m) {
    if (!m) return '';
    const parts = [];
    if (m.source) parts.push('Source: ' + m.source);
    if (m.method) parts.push('How: ' + m.method);
    if (m.as_of) parts.push('Period: ' + m.as_of);
    parts.push('Confidence: ' + m.confidence);
    if (m.note) parts.push('Note: ' + m.note);
    return parts.join('\n');
  }
  function tag(m) { return m && (m.confidence === 'estimate' || m.confidence === 'assumption') ? `<span class="tag ${m.confidence}">${m.confidence}</span>` : ''; }
  function val(m) { return m && m.confidence !== 'missing' ? m.value : null; }
  function show(m, fmt) {
    if (!m) return '<span class="na">not measured</span>';
    if (m.confidence === 'missing') return `<span class="na" title="${esc(m.note || '')}">not available</span>`;
    return `<span data-src title="${esc(srcText(m))}">${fmt ? fmt(m.value) : esc(m.value)}</span>${tag(m)}`;
  }

  function gauge(score, band) {
    const r = 62, c = Math.PI * 1.5 * r, v = Math.max(0, Math.min(100, score || 0));
    return `<svg viewBox="0 0 160 140" width="190" role="img" aria-label="Business Success Score ${score == null ? 'not available' : score}">
      <defs><linearGradient id="mrg" x1="0" x2="1"><stop offset="0" stop-color="#1A84F8"/><stop offset="1" stop-color="#4FB8FF"/></linearGradient></defs>
      <circle cx="80" cy="78" r="${r}" fill="none" stroke="#1B2A3C" stroke-width="12" stroke-dasharray="${c} 999" transform="rotate(135 80 78)" stroke-linecap="round"/>
      <circle cx="80" cy="78" r="${r}" fill="none" stroke="url(#mrg)" stroke-width="12" stroke-dasharray="${c * v / 100} 999" transform="rotate(135 80 78)" stroke-linecap="round"/>
      <text x="80" y="88" text-anchor="middle" font-size="40" font-weight="600" fill="#fff">${score == null ? '—' : score}</text>
      <text x="80" y="112" text-anchor="middle" font-size="12" letter-spacing="2" fill="#4FB8FF">${esc(band || '')}</text></svg>`;
  }

  function trendChart(series) {
    if (!series || series.length < 2) return '<div class="na">No search history returned.</div>';
    const W = 560, H = 190, P = 34;
    const ys = series.map((d) => d.searches), max = Math.max(...ys) * 1.1 || 1;
    const x = (i) => P + (i * (W - P - 10)) / (series.length - 1), y = (v) => H - 24 - (v / max) * (H - 40);
    const pts = series.map((d, i) => `${x(i).toFixed(1)},${y(d.searches).toFixed(1)}`).join(' ');
    const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
    const labels = series.map((d, i) => (d.month.endsWith('-01') || i === 0 || i === series.length - 1) ? `<text x="${x(i)}" y="${H - 6}" font-size="10" fill="#8A9AB0" text-anchor="${i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}">${esc(d.month)}</text>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Monthly local searches over time">
      <defs><linearGradient id="mra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1A84F8" stop-opacity=".45"/><stop offset="1" stop-color="#1A84F8" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map((t) => `<line x1="${P}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="#16273A"/><text x="${P - 6}" y="${y(t) + 3}" font-size="10" fill="#8A9AB0" text-anchor="end">${t >= 1000 ? (t / 1000).toFixed(1) + 'K' : t}</text>`).join('')}
      <polygon points="${x(0)},${H - 24} ${pts} ${x(series.length - 1)},${H - 24}" fill="url(#mra)"/>
      <polyline points="${pts}" fill="none" stroke="#4FB8FF" stroke-width="2.2"/>${labels}</svg>`;
  }

  function positions(report) {
    const me = dom((report.job || {}).website || '');
    const out = {};
    (report.serps || []).forEach((s) => {
      const mp = (s.map_pack || []).find((r) => r.domain === me);
      const org = (s.organic || []).find((r) => r.domain === me);
      out[s.keyword] = { map: mp ? mp.position : null, organic: org ? org.position : null };
    });
    return out;
  }

  function level(v, hi, mid) { return v == null ? 'unknown' : v >= hi ? 'strong' : v >= mid ? 'moderate' : 'weak'; }

  function matrix(report) {
    const comps = (report.competitors || []).filter((c) => !c.is_prospect).slice(0, 3);
    const me = (report.competitors || []).find((c) => c.is_prospect) || { name: report.business_name, relative_visibility: null };
    const sites = report.competitor_sites || {};
    const ckPct = (ck) => { if (!ck) return null; const k = Object.values(ck).filter((v) => v != null); return k.length ? k.filter(Boolean).length / k.length * 100 : null; };
    const myCk = report.checklist, mySoc = Object.keys((report.site || {}).social_links || {}).length;
    const row = (c, isMe) => {
      const s = isMe ? { checklist: myCk, social_links: (report.site || {}).social_links } : (sites[c.domain] || {});
      const web = level(ckPct(s.checklist), 75, 50);
      const search = level(c.relative_visibility, 66, 25);
      const social = s.checklist || s.social_links ? level(Object.keys(s.social_links || {}).length, 3, 1) : 'unknown';
      const ads = c.runs_google_ads == null ? 'unknown' : c.runs_google_ads ? 'strong' : 'weak';
      return `<tr class="${isMe ? 'me' : ''}"><td>${esc(c.name)}${isMe ? ' <span class="muted">(you)</span>' : ''}</td>${[web, search, social, ads].map((l) => `<td><span class="cell ${l}" title="${l}"></span></td>`).join('')}</tr>`;
    };
    void mySoc;
    return `<table><thead><tr><th></th><th>Website</th><th>Search</th><th>Social</th><th>Google Ads</th></tr></thead><tbody>${row(me, true)}${comps.map((c) => row(c, false)).join('')}</tbody></table>
      <div class="legend"><span><i style="background:#1A84F8"></i>Strong</span><span><i style="background:#6E87A6"></i>Moderate</span><span><i style="background:#1B2A3C"></i>Weak</span><span><i style="background:repeating-linear-gradient(45deg,#111D2C,#111D2C 3px,#0C1622 3px,#0C1622 6px)"></i>Not measured</span></div>
      <details><summary>How these are graded</summary><p class="muted" style="font-size:12px">Website: share of the conversion checklist passed (75%+ strong, 50%+ moderate). Search: share of local search clicks vs the market leader (66%+ strong, 25%+ moderate). Social: active profiles linked from the website (3+ strong, 1+ moderate). Google Ads: an ad seen on any tracked keyword.</p></details>`;
  }

  function render(el, report) {
    injectCss();
    if (!report) { el.innerHTML = '<div class="mr"><div class="sec"><span class="na">No market analysis has been run for this project yet.</span></div></div>'; return; }
    const m = report.metrics || {}, sc = report.score || {}, job = report.job || {};
    const comps = report.competitors || [];
    const me = comps.find((c) => c.is_prospect);
    const others = comps.filter((c) => !c.is_prospect);
    const leader = others.slice().sort((a, b) => (b.click_share || 0) - (a.click_share || 0))[0];
    const trend = val(m.demand_trend), sat = val(m.saturation), vis = val(m.visibility);
    const pos = positions(report);
    const kws = (report.keywords || {}).keywords || [];
    const ranking = kws.filter((k) => pos[k.keyword] && (pos[k.keyword].map || (pos[k.keyword].organic && pos[k.keyword].organic <= 10)));
    const tracked = (report.serps || []).length;
    const ck = report.checklist || {};
    const ckMissing = Object.entries(ck).filter(([, v]) => v === false).map(([k]) => k.replace(/_/g, ' '));
    const q = report.data_quality || {};
    const name = report.business_name || job.business_name || 'This business';
    const dt = String(report.generated_at || '').slice(0, 10);

    // Plain-language signals computed from the numbers (no AI text).
    const sigDemand = trend == null ? 'Search trend not available.' : trend > 5 ? `Local searches are up ${num(trend, 1)}% vs the year before.` : trend < -5 ? `Local searches are down ${num(Math.abs(trend), 1)}% vs the year before.` : 'Local search demand is steady year over year.';
    const sigComp = sat == null ? 'Competition level not available.' : `${val(m.saturation_vs_us) != null ? num(val(m.saturation_vs_us), 2) + '× ' : ''}the U.S. average number of competitors per resident (${(m.saturation || {}).note || ''}).`;
    const sigGap = vis == null ? 'Visibility not available.' : !leader ? `${name} gets ${num(vis, 1)}% of local search clicks.`
      : vis >= (leader.click_share || 0) ? `${name} gets ${num(vis, 1)}% of local search clicks, the most of any business; next is ${leader.name} with ${num(leader.click_share, 1)}%.`
      : `${name} gets ${num(vis, 1)}% of local search clicks; the leader, ${leader.name}, gets ${num(leader.click_share, 1)}%.`;

    const PART = { visibility: 'search visibility', reputation: 'reviews and reputation', website: 'website', channels: 'marketing channels' };
    const parts = Object.entries(sc.parts || {}).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
    const partsLine = parts.length > 1 ? `Strongest area: ${PART[parts[0][0]]} (${Math.round(parts[0][1] * 100)}/100). Biggest gap: ${PART[parts[parts.length - 1][0]]} (${Math.round(parts[parts.length - 1][1] * 100)}/100).`
      : 'Score parts could not be measured yet.';
    const zones = (report.zones || {}).zones || [];
    const repRows = [me].concat(others.slice(0, 3)).filter(Boolean);
    const visRows = [me].concat(others.slice(0, 3)).filter(Boolean);

    el.innerHTML = `<div class="mr">
      <section class="hero"><div class="kicker">Prepared for ${esc(name)}</div><h2 class="serif">Market Opportunity Analysis</h2>
        <p>${esc(job.industry || '')} in ${esc(job.city || '')}${job.state ? ', ' + esc(job.state) : ''}: real search, map and census data, measured ${esc(dt)}.</p>
        <div class="meta"><span class="pill">${num(q.measured || 0)} measured · ${num(q.computed || 0)} calculated · ${num(q.estimate || 0)} estimated</span>
          ${q.missing ? `<span class="pill warn">${q.missing} not available</span>` : ''}
          ${sc.provisional ? '<span class="pill warn">Score is provisional: part of it could not be measured</span>' : ''}
          ${report.owner_view && report.cost_usd != null ? `<span class="pill">Data cost $${num(report.cost_usd, 2)}</span>` : ''}</div></section>

      <section class="sec"><div class="bottom">
        <div><div class="num-label">01 · The bottom line</div><h2>${sc.band === 'DOMINANT' ? 'A market leader with a strong position.' : sc.band === 'HEALTHY' ? 'A healthy position with clear room to grow.' : sc.band === 'EMERGING' ? 'An active presence with real gaps to close.' : sc.band ? 'Significant ground to make up.' : 'Not enough data for a verdict yet.'}</h2>
          <p class="lead">${esc(partsLine)}</p></div>
        <div style="text-align:center"><div class="num-label">Business Success Score</div><span data-src title="${esc(srcText(m.success_score))}">${gauge(sc.score, sc.band)}</span></div>
        <div class="signals"><div><i></i><div><b>Demand</b><span>${esc(sigDemand)}</span></div></div>
          <div><i></i><div><b>Competition</b><span>${esc(sigComp)}</span></div></div>
          <div><i></i><div><b>Visibility</b><span>${esc(sigGap)}</span></div></div></div></div></section>

      <section class="sec"><div class="num-label">02 · Market snapshot</div><div class="stats" style="margin-top:10px">
        <div class="stat"><b>${show(m.population, (v) => num(v))}</b><span>Service-area population</span><small>${m.population_growth && val(m.population_growth) != null ? (val(m.population_growth) >= 0 ? '+' : '') + num(val(m.population_growth), 1) + '% since 2020' : esc(job.radius_mi ? job.radius_mi + '-mile radius' : '')}</small></div>
        <div class="stat"><b>${show(m.competitors_found, (v) => num(v))}</b><span>Competitors on Google Maps</span><small>${sat != null ? esc((m.saturation || {}).note || '') + ' saturation' : ''}</small></div>
        <div class="stat"><b>${show(m.monthly_searches, (v) => num(v))}</b><span>Monthly local searches</span><small>${show(m.keywords_tracked, (v) => num(v) + ' keywords')}</small></div>
        <div class="stat"><b>${show(m.demand_trend, (v) => (v >= 0 ? '+' : '') + num(v, 1) + '%')}</b><span>Demand trend</span><small>last 12 months vs prior 12</small></div></div></section>

      <div class="grid2">
        <section class="sec"><div class="num-label">03 · Demand trend</div><h2>Monthly local searches</h2>${trendChart(val(m.demand_series))}</section>
        <section class="sec"><div class="num-label">04 · Market saturation</div><h2>How crowded the market is</h2>
          ${sat == null ? `<div class="na">${esc((m.saturation || {}).note || 'not available')}</div>` : `<div class="sat"><em style="left:${sat}%" title="${esc(srcText(m.saturation))}"></em></div><div class="sat-l"><span>Low</span><span>Medium</span><span>High</span><span>Oversaturated</span></div>
          <p class="muted" style="font-size:12px">${num(val(m.establishments_per_10k), 2)} businesses per 10,000 residents in ${esc((report.establishments || {}).county || 'the county')}; 50 on this scale = U.S. average.</p>`}
          ${zones.length ? `<div style="margin-top:10px">${zones.map((z) => `<div class="row"><span>${esc(z.zone)} <span class="muted">${num(z.competitors)} competitor${z.competitors === 1 ? '' : 's'} · ${num(z.population)} people</span></span><div class="bar"><i style="width:${z.pct}%"></i></div><span>${z.pct}%</span></div>`).join('')}<p class="muted" style="font-size:12px">Zones: competitors per resident vs the whole service area (50% = area average).</p></div>` : ''}</section>
      </div>

      <div class="grid3">
        <section class="sec"><div class="num-label">05 · Competitive landscape</div><h2>Where each one is strong</h2>${matrix(report)}</section>
        <section class="sec"><div class="num-label">06 · Reviews &amp; reputation</div><h2>Credibility on Google</h2>
          <table><tbody>${repRows.map((c) => `<tr class="${c.is_prospect ? 'me' : ''}"><td>${esc(c.name)}</td><td>${c.rating == null ? '<span class="na">—</span>' : '★ ' + num(c.rating, 1)}</td><td class="muted">${c.reviews == null ? '' : '(' + num(c.reviews) + ')'}</td></tr>`).join('') || '<tr><td class="na">No review data.</td></tr>'}</tbody></table>
          ${m.rating_adjusted ? `<p class="muted" style="font-size:12px">Adjusted rating for ${esc(name)}: ${show(m.rating_adjusted, (v) => num(v, 2))} (accounts for review count).</p>` : ''}</section>
        <section class="sec"><div class="num-label">07 · Online visibility</div><h2>Share of local search clicks</h2>
          ${visRows.map((c) => `<div class="row ${c.is_prospect ? 'me' : ''}"><span>${esc(c.name)}</span><div class="bar"><i style="width:${Math.min(100, (c.click_share || 0) / Math.max(1, ...visRows.map((x) => x.click_share || 0)) * 100)}%"></i></div><span>${num(c.click_share, 1)}%</span></div>`).join('') || '<div class="na">No live Google results.</div>'}
          <p class="muted" style="font-size:12px">${tracked} keywords searched live from ${esc(job.city || 'the city')}; map pack + regular results, weighted by searches and typical click rates.</p></section>
      </div>

      <section class="sec"><div class="num-label">08 · Opportunity gap</div><h2>Three ways to grow</h2><div class="grid3" style="margin-top:8px">
        <div class="opp"><h3>Search capture</h3><p>${tracked ? `Ranks on page one or in the map pack for ${ranking.length} of ${tracked} high-value searches${leader ? `${(leader.click_share || 0) > (vis || 0) ? `; ${esc(leader.name)} leads with ${num(leader.click_share, 1)}% of clicks` : ''}` : ''}.` : 'Live Google results were not available.'}</p><span class="impact">${vis != null && vis < 15 ? 'Highest impact' : 'High impact'}</span></div>
        <div class="opp"><h3>Conversion experience</h3><p>${ckMissing.length ? `Website is missing: ${esc(ckMissing.join(', '))}.` : Object.keys(ck).length ? 'Website passes the conversion checklist.' : 'Website could not be inspected.'}${val(m.pagespeed_mobile) != null ? ` Mobile speed score ${val(m.pagespeed_mobile)}/100.` : ''}</p><span class="impact">${ckMissing.length >= 3 || (val(m.pagespeed_mobile) || 100) < 50 ? 'Highest impact' : 'High impact'}</span></div>
        <div class="opp"><h3>Reputation engine</h3><p>${me && leader && me.reviews != null && leader.reviews != null ? (leader.reviews > me.reviews ? `${num(leader.reviews - me.reviews)} fewer Google reviews than ${esc(leader.name)} (${num(me.reviews)} vs ${num(leader.reviews)}).` : `More Google reviews than the search leader (${num(me.reviews)} vs ${num(leader.reviews)}).`) : 'Review comparison not available.'}</p><span class="impact">High impact</span></div></div>
        ${m.missed_revenue_monthly ? `<p style="margin:14px 0 0">Estimated revenue left on the table: <b>${show(m.missed_revenue_monthly, (v) => money(v) + '/month')}</b> <span class="muted" style="font-size:12px">(extra customers if it held the #1 map spot on every tracked keyword; assumptions below)</span></p>` : ''}</section>

      <div class="grid2">
        <section class="sec"><div class="num-label">09 · Website inspection</div><h2>${esc(dom((report.site || {}).final_url || job.website))}</h2>
          ${Object.keys(ck).length ? Object.entries(ck).map(([k, v]) => `<div class="chk"><span class="${v ? 'y' : 'n'}">${v ? '✓' : '✗'}</span><span>${esc(k.replace(/_/g, ' '))}</span></div>`).join('') : '<div class="na">Website not inspected.</div>'}
          ${val(m.pagespeed_mobile) != null ? `<p style="margin:10px 0 0">Google PageSpeed (mobile): ${show(m.pagespeed_mobile, (v) => v + '/100')}${(report.pagespeed || {}).lcp_s ? ` · largest content loads in ${report.pagespeed.lcp_s}s` : ''}</p>` : ''}</section>
        <section class="sec"><div class="num-label">10 · Keywords</div><h2>What people search for</h2>
          <p class="muted" style="font-size:12px">${num(kws.length)} keywords tracked${report.coverage && report.coverage.share != null ? ` · covers ${num(report.coverage.share * 100)}% of the search volume the top competitors rank for` : ''}${report.gaps_added && report.gaps_added.length ? ` · ${report.gaps_added.length} gaps found from competitors` : ''}</p>
          <table><thead><tr><th>Keyword</th><th>Intent</th><th style="text-align:right">Searches/mo</th><th style="text-align:right">You</th></tr></thead><tbody>
          ${kws.slice(0, 15).map((k) => { const p = pos[k.keyword] || {}; const you = p.map ? 'Map #' + p.map : p.organic ? '#' + p.organic : (report.serps || []).some((s) => s.keyword === k.keyword) ? '<span class="muted">not top 20</span>' : '<span class="muted">—</span>';
            return `<tr><td>${esc(k.keyword)}<div class="kw-svc">${esc(k.service)}</div></td><td><span class="int ${esc(k.intent)}">${esc(k.intent)}</span></td><td style="text-align:right">${num(k.volume)}</td><td style="text-align:right">${you}</td></tr>`; }).join('')}</tbody></table>
          ${kws.length > 15 ? `<details><summary>All ${kws.length} keywords</summary><table><tbody>${kws.slice(15).map((k) => `<tr><td>${esc(k.keyword)}</td><td class="muted">${esc(k.service)}</td><td style="text-align:right">${num(k.volume)}</td></tr>`).join('')}</tbody></table></details>` : ''}</section>
      </div>

      <section class="sec src"><div class="num-label">Sources &amp; method</div>
        <p class="muted" style="font-size:12px;margin:4px 0 8px">Hover any number above for its source. Nothing in this report is written or guessed by AI: numbers come from the data sources below or from the formulas shown.</p>
        <table><thead><tr><th>Figure</th><th>Value</th><th>Source</th><th>Confidence</th></tr></thead><tbody>
        ${Object.entries(m).filter(([k]) => !['demand_series', 'click_curve'].includes(k)).map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, ' '))}</td><td>${v.confidence === 'missing' ? '<span class="na">—</span>' : esc(typeof v.value === 'object' ? '…' : v.value) + ' ' + esc(v.unit || '')}</td><td>${esc(v.source || v.method)}${v.as_of ? ' · ' + esc(v.as_of) : ''}${v.confidence === 'missing' ? '<br><span class="na">' + esc(v.note) + '</span>' : ''}</td><td>${esc(v.confidence)}</td></tr>`).join('')}</tbody></table>
        ${report.assumptions ? `<p style="margin:10px 0 4px"><b>Money assumptions</b> (edit them in the project's analysis settings)</p>${Object.entries(report.assumptions).map(([k, a]) => `<div>${esc(k.replace(/_/g, ' '))}: <b>${k === 'avg_job' ? money(a.value) : num(a.value * 100) + '%'}</b> <span class="muted">${esc(a.method)}</span></div>`).join('')}` : ''}
        ${(report.steps || []).some((s) => !s.ok) ? `<p style="margin:10px 0 0;color:var(--warn)">Steps that did not complete: ${(report.steps || []).filter((s) => !s.ok).map((s) => esc(s.step) + ' (' + esc(s.error) + ')').join('; ')}</p>` : ''}</section>
    </div>`;
  }

  window.MarketRender = { render };
})();
