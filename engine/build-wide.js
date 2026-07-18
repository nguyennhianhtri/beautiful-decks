/* ============================================================================
   build-wide.js — 48:9 WIDESCREEN deck generator for the Fluent Slide System
   ----------------------------------------------------------------------------
   Reuses the 16:9 engine wholesale (logo, brandbar, icon, footer, tokens) and
   adds templates that genuinely EARN the extra width — journey maps, swimlanes,
   roadmaps, triptychs, constellations. Canvas = 3840×720 (= 3 × 1280×720), so
   the whole type scale + motion layer carry over unchanged.

   Usage: node build-wide.js <deckModule.js> <out.html>
   The deck module exports { title, customer?, foot?, gallery?, slides:[...] }.
   Each slide: { type:'wjourney'|'wswim'|..., ...fields }.
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const B = require('./build.js');                 // shared engine (guarded main)
const { icon, logo, brandbar, customerLogo, footer, productIcon, productIconInfo } = B;

const ROOT = __dirname;
const WIDE_W = 3840, WIDE_H = 720;
const PAD_X = 130;
const TRACK_W = WIDE_W - 2 * PAD_X;              // 3580 — usable inner width

// ---- small local helpers ---------------------------------------------------
const esc = B.escapeText;
// wide header: kicker eyebrow + title + accent rule (+ optional subtitle).
// No top-left logo here — the brandbar (top-right) carries the deck + optional customer,
// so we never double the logo. (Matches "brandbar = logo, every slide".)
function whead(s) {
  return `<div class="wkicker">${s.kicker ? `<span class="eyebrow bar">${esc(s.kicker)}</span>` : ''}</div>
    <h2 class="wtitle">${esc(s.title)}</h2>
    <div class="waccent"></div>
    ${s.subtitle ? `<p class="wsub">${esc(s.subtitle)}</p>` : ''}`;
}
const assistRow = a => a ? `<div class="st-assist"><span class="sa-ico">${icon(a.icon || 'sparkle')}</span>`+
  `<span class="sa-t">${esc(a.t)}</span></div>` : '';

// ============================================================================
//  WIDE TEMPLATES
// ============================================================================
const W = {};

// ---- 01 PANORAMIC COVER ----------------------------------------------------
W.wcover = (s) => `
<section class="slide wcover dark">
  <div class="wc-wrap">
    <div>
      <div class="eyebrow bar on-dark">${esc(s.eyebrow || 'Beautiful Decks')}</div>
      <h1 class="wc-title">${esc(s.title)}</h1>
      ${s.subtitle ? `<p class="wc-sub">${esc(s.subtitle)}</p>` : ''}
      ${s.meta ? `<div class="wc-meta">${s.meta.map(m =>
        `<div><div class="m-k">${esc(m.k)}</div><div class="m-v">${esc(m.v)}</div></div>`).join('')}</div>` : ''}
    </div>
    <div class="wc-art ${s.img ? '' : 'motif'}">${s.img ? `<img src="${B.IMG(s.img)}" alt="">` : ''}</div>
  </div>
</section>`;

// ---- 02 CUSTOMER / USER JOURNEY MAP (the signature wide template) ----------
// stations across the spine + an EMOTION CURVE plotted above them.
// MOTION-AWARE: in a motion deck the curve DRAWS itself L→R, stations rise in a
// staggered wave, and emotion dots pop in after the line passes. Inert (static)
// when wide-motion.css isn't loaded (gallery / theme:'light' non-motion decks).
W.wjourney = (s) => {
  const st = s.stations, N = st.length;
  const colW = TRACK_W / N;
  // emotion curve geometry — author SVG at exact px so it aligns 1:1 with stations
  const EH = 150, top = 20, bot = 18, usable = EH - top - bot;
  const pts = st.map((x, i) => ({
    x: (i + 0.5) * colW,
    y: top + (1 - (x.emo == null ? 50 : x.emo) / 100) * usable,
    emo: x.emo == null ? 50 : x.emo
  }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[N - 1].x.toFixed(1)},${EH} L${pts[0].x.toFixed(1)},${EH} Z`;
  const drawDur = 2.0; // s — matches .drawpath
  const dots = pts.map((p, i) => {
    const cls = p.emo >= 66 ? 'high' : (p.emo <= 38 ? 'low' : '');
    const d = (0.3 + (i / Math.max(1, N - 1)) * drawDur).toFixed(2); // pop as the line reaches it
    return `<circle class="emo-pt ridein ${cls}" style="--d:${d}s" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7"></circle>`;
  }).join('');
  return `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="journey">
      <div class="jr-emo">
        <svg viewBox="0 0 ${TRACK_W} ${EH}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="emoGrad" x1="0" y1="0" x2="${TRACK_W}" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#C94F4F"/><stop offset=".5" stop-color="#00A4EF"/><stop offset="1" stop-color="#7FBA00"/>
            </linearGradient>
            <linearGradient id="emoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#00A4EF" stop-opacity=".22"/><stop offset="1" stop-color="#00A4EF" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <text class="emo-band" x="2" y="14">Sentiment</text>
          <path class="emo-area" d="${area}"></path>
          <path class="emo-line drawpath" pathLength="1" d="${line}"></path>
          ${dots}
        </svg>
      </div>
      <div class="jr-track">
        <div class="jr-spine drawx"></div>
        <div class="jr-stations" style="grid-template-columns:repeat(${N},1fr);">
          ${st.map((x, i) => `
          <div class="station wrise${x.tone ? ' ' + x.tone : ''}" style="--d:${(0.4 + i * 0.34).toFixed(2)}s">
            <div class="st-dot">${i + 1}</div>
            <div class="st-phase">${esc(x.phase)}</div>
            ${x.when ? `<div class="st-when">${esc(x.when)}</div>` : ''}
            ${x.doing ? `<div class="st-doing">${esc(x.doing)}</div>` : ''}
            ${assistRow(x.assist)}
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>
</section>`;
};

// ---- 03 HORIZONTAL SWIMLANES ----------------------------------------------
W.wswim = (s) => {
  const cols = s.cols, NC = cols.length;
  return `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="swim" style="grid-template-rows:repeat(${s.lanes.length},1fr);">
      ${s.lanes.map(ln => `
      <div class="swim-row ${ln.cls || ''}">
        <div class="sl-actor"><span class="sa-ic">${icon(ln.icon || 'people')}</span>${esc(ln.actor)}</div>
        <div class="sl-track" style="grid-template-columns:repeat(${NC},1fr);">
          ${(ln.steps || []).map(stp => `
          <div class="sl-step ${stp.accent ? 'accent' : ''}" style="grid-column:${stp.col}/span ${stp.span || 1};">
            <div class="ss-t">${esc(stp.t)}</div>${stp.b ? `<div class="ss-b">${esc(stp.b)}</div>` : ''}
          </div>`).join('')}
        </div>
      </div>`).join('')}
    </div>
    <div class="swim-axis">
      <div></div>
      <div class="sx-rail" style="grid-template-columns:repeat(${NC},1fr);">
        ${cols.map(c => `<div class="sx-c">${esc(c)}</div>`).join('')}
      </div>
    </div>
  </div>
</section>`;
};

// ---- 04 MATURITY RAMP ------------------------------------------------------
W.wramp = (s) => `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="ramp" style="grid-template-columns:repeat(${s.steps.length},1fr);">
      ${s.steps.map((p, i) => `
      <div class="rstep l${i}" style="margin-bottom:${i * (s.rise || 34)}px;">
        <div class="rs-lvl">${esc(p.lvl || 'Level ' + i)}</div>
        <div class="rs-t">${esc(p.t)}</div>
        <div class="rs-b">${esc(p.b)}</div>
        ${p.x ? `<div class="rs-x">${esc(p.x)}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>
</section>`;

// ---- 05 ROADMAP (phases × workstreams) -------------------------------------
W.wroad = (s) => {
  const NP = s.phases.length;
  return `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="road">
      <div class="road-head" style="grid-template-columns:175px repeat(${NP},1fr);">
        <div></div>
        ${s.phases.map(p => `<div class="rh-phase"><div class="rp-t">${esc(p.t)}</div>${p.w ? `<div class="rp-w">${esc(p.w)}</div>` : ''}</div>`).join('')}
      </div>
      <div class="road-body">
        ${s.rows.map((r, ri) => `
        <div class="road-row">
          <div class="rr-lbl">${esc(r.lbl)}</div>
          <div class="rr-track" style="grid-template-columns:repeat(${NP},1fr);">
            ${r.bars.map((b, bi) => `<div class="rr-bar ${b.cls || 'b1'}${b.ghost ? ' ghost' : ''}" style="grid-column:${b.col}/span ${b.span || 1};--d:${(0.2 + ri * 0.18 + bi * 0.06).toFixed(2)}s;">${esc(b.t)}</div>`).join('')}
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>
</section>`;
};

// ---- 06 SCOREBOARD RIBBON (KPI tiles) --------------------------------------
function sparkline(data, color) {
  if (!Array.isArray(data) || data.length === 0) return '';
  const w = 200, h = 34, mn = Math.min(...data), mx = Math.max(...data), rng = (mx - mn) || 1;
  const denom = Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [(i / denom) * w, h - ((v - mn) / rng) * (h - 4) - 2]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${esc(color)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
W.wribbon = (s) => {
  const per = s.perRow || s.kpis.length;
  const rows = [];
  for (let i = 0; i < s.kpis.length; i += per) rows.push(s.kpis.slice(i, i + per));
  // a plain integer (optionally with a + or % suffix) can count up; else render static
  const countable = (v) => /^\d{1,4}[+%]?$/.test(String(v));
  const numCell = (v, ci) => {
    if (countable(v)) {
      const m = String(v).match(/^(\d+)([+%]?)$/);
      return `<span data-countup data-to="${m[1]}">0</span>${m[2]}`;
    }
    return esc(v);
  };
  let gi = 0;
  return `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="ribbon">
      ${rows.map(row => `<div class="rb-row" style="grid-template-columns:repeat(${per},1fr);">
        ${row.map(k => { const i = gi++; return `
        <div class="kpi-w wrise" style="--kc:${k.color || 'var(--accent)'};--d:${(0.2 + i * 0.12).toFixed(2)}s;">
          <div class="kw-l">${esc(k.l)}</div>
          <div class="kw-n">${numCell(k.n, i)}</div>
          ${k.d ? `<div class="kw-d ${k.dir || 'up'}" style="--dd:${(1.1 + i * 0.12).toFixed(2)}s;">${k.dir === 'down' ? '▼' : '▲'} ${esc(k.d)}</div>` : ''}
          ${k.spark ? `<div class="kw-s" style="--ds:${(1.3 + i * 0.12).toFixed(2)}s;">${sparkline(k.spark, k.color || '#0078D4')}</div>` : ''}
        </div>`; }).join('')}
      </div>`).join('')}
    </div>
  </div>
</section>`;
};

// ---- 07 TRIPTYCH (three acts, one per screen) ------------------------------
W.wtript = (s) => `
<section class="slide">
  ${s.kicker ? `<div class="slide-pad" style="padding-bottom:0;flex:0 0 auto;">${whead({ kicker: s.kicker, title: s.title, subtitle: s.subtitle })}</div>` : ''}
  <div class="tript">
    ${s.acts.map((a, i) => `
    <div class="tri-act ${a.dark ? 'dark' : ''}">
      <div class="ta-n">${esc(a.n || 'Act ' + (i + 1))}</div>
      <div class="ta-t">${esc(a.t)}</div>
      <div class="ta-b">${esc(a.b)}</div>
      ${a.foot ? `<div class="ta-foot">${esc(a.foot)}</div>` : ''}
    </div>`).join('')}
  </div>
</section>`;

// ---- 08 VALUE-CHAIN PIPELINE (inputs → platform → outcomes) ----------------
const chArrow = `<div class="chain-arrow">${icon('trending') || ''}<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
W.wchain = (s) => `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="chain">
      <div class="chain-col">
        <div class="cc-cap">${esc(s.leftCap || 'Inputs')}</div>
        ${s.inputs.map(it => `<div class="cc-item"><span class="ci-ic">${icon(it.icon || 'database')}</span>${esc(it.t)}</div>`).join('')}
      </div>
      ${chArrow}
      <div class="chain-col core">
        <div class="chain-core">
          <div class="core-t">${esc(s.core.t)}</div>
          <div class="core-b">${esc(s.core.b)}</div>
        </div>
      </div>
      ${chArrow}
      <div class="chain-col">
        <div class="cc-cap">${esc(s.rightCap || 'Outcomes')}</div>
        ${s.outputs.map(it => `<div class="cc-item"><span class="ci-ic">${icon(it.icon || 'trending')}</span>${esc(it.t)}</div>`).join('')}
      </div>
    </div>
  </div>
</section>`;

// ---- 09 STAT TRIPTYCH (three giant numbers) --------------------------------
W.wbigtri = (s) => `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="bigtri">
      ${s.stats.map(st => `
      <div class="bt-cell ${st.tone || ''}">
        <div class="bt-fig">${esc(st.n)}</div>
        <div class="bt-cap">${esc(st.l)}</div>
      </div>`).join('')}
    </div>
  </div>
</section>`;

// ---- 10 ECOSYSTEM CONSTELLATION (one hub, spokes across the width) ---------
W.wconstel = (s) => {
  const cx = WIDE_W / 2, cy = 330;                 // hub centre, below the title band
  const N = s.nodes.length;
  const spanX = 1620;                              // half-width of the spread
  const baseEven = 456, baseOdd = 582;            // two tiers so 8 labels never collide
  const nodes = s.nodes.map((nd, i) => {
    const t = N === 1 ? 0.5 : i / (N - 1);          // 0..1 left→right
    const x = cx + (t - 0.5) * 2 * spanX;
    const arc = Math.pow(Math.abs(t - 0.5) * 2, 1.5) * 34;   // gentle dip toward the edges
    const y = (i % 2 === 0 ? baseEven : baseOdd) + arc;
    const len = Math.hypot(x - cx, y - cy);         // spoke length for the draw-out dash
    return { ...nd, x, y, len };
  });
  // MOTION-AWARE: hub pops first (--d 0), each spoke DRAWS OUT from the hub via a
  // length-based stroke-dash, then the node + labels pop as the spoke arrives.
  const spokes = nodes.map((n, i) => {
    const d = (0.5 + i * 0.16).toFixed(2);          // spokes draw in sequence
    return `<line class="cn-spoke drawspoke" style="--len:${n.len.toFixed(0)};--d:${d}s" x1="${cx}" y1="${cy}" x2="${n.x.toFixed(0)}" y2="${n.y.toFixed(0)}"></line>`;
  }).join('');
  const dots = nodes.map((n, i) => {
    const ly = n.y + 30;
    const nd = (0.5 + i * 0.16 + 0.42).toFixed(2);   // node pops just after its spoke lands
    return `<circle class="cn-node ridein" style="--d:${nd}s" cx="${n.x.toFixed(0)}" cy="${n.y.toFixed(0)}" r="13"></circle>
      <text class="cn-lbl ridein" style="--d:${(+nd + 0.08).toFixed(2)}s" x="${n.x.toFixed(0)}" y="${ly.toFixed(0)}" text-anchor="middle">${esc(n.t)}</text>
      ${n.b ? `<text class="cn-sub ridein" style="--d:${(+nd + 0.16).toFixed(2)}s" x="${n.x.toFixed(0)}" y="${(ly + 19).toFixed(0)}" text-anchor="middle">${esc(n.b)}</text>` : ''}`;
  }).join('');
  // SVG <text> glyph-range boxes are unreliable under a full-bleed absolutely-positioned
  // svg, so opt this stage out of the OVERLAP check (geometry is hand-placed + verified).
  return `
<section class="slide">
  <div class="slide-pad" style="position:relative;z-index:2;flex:0 0 auto;padding-bottom:0;">
    ${whead(s)}
  </div>
  <div class="constel" data-qa-ignore="overlap">
    <svg viewBox="0 0 ${WIDE_W} ${WIDE_H}" preserveAspectRatio="none">
      ${spokes}
      ${dots}
      <circle class="cn-hub-c cn-hub-pop" cx="${cx}" cy="${cy}" r="78"></circle>
      <text class="cn-hub-t cn-hub-pop" x="${cx}" y="${cy + 9}" text-anchor="middle">${esc(s.hub)}</text>
    </svg>
  </div>
</section>`;
};

// ---- 11 PERSONA SPREAD -----------------------------------------------------
W.wpersona = (s) => `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="pers" style="grid-template-columns:repeat(${s.personas.length},1fr);">
      ${s.personas.map(p => `
      <div class="pcard">
        <div class="pc-top"><div class="pc-av">${esc(p.initials || (p.name || '?').slice(0, 1))}</div>
          <div><div class="pc-nm">${esc(p.name)}</div><div class="pc-rl">${esc(p.role)}</div></div></div>
        ${(p.sections || []).map(sec => `
        <div class="pc-sec ${sec.gain ? 'gain' : ''}">
          <div class="pc-h">${esc(sec.h)}</div>
          <ul class="pc-list">${sec.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>
        </div>`).join('')}
      </div>`).join('')}
    </div>
  </div>
</section>`;

// ---- 12 DAY IN THE LIFE ----------------------------------------------------
W.wday = (s) => `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="dayl" style="grid-template-columns:repeat(${s.segments.length},1fr);">
      ${s.segments.map(g => `
      <div class="dl-seg">
        <div class="dl-time">${esc(g.time)}</div>
        <div class="dl-moment">${esc(g.moment)}</div>
        <div class="dl-b">${esc(g.b)}</div>
        ${g.assist ? `<div class="dl-assist"><span class="da-ic">${icon(g.icon || 'sparkle')}</span><span>${esc(g.assist)}</span></div>` : ''}
      </div>`).join('')}
    </div>
  </div>
</section>`;

// ---- 13 WIDE SECTION DIVIDER -----------------------------------------------
// Spatial logic: a giant section NUMBER anchors the LEFT screen as a structural
// element (so screen A isn't dead space), the title sits on the focal MIDDLE
// screen, and the RIGHT screen stays as intentional negative space with a faint
// rule. The number USES the width instead of floating text in a void.
W.wsection = (s) => `
<section class="slide dark wsection">
  <div class="wsec-grid">
    <div class="wsec-num">${esc(s.num || '')}</div>
    <div class="wsec-body">
      <div class="eyebrow bar on-dark">${esc(s.eyebrow || 'Section')}</div>
      <h1 class="wsec-title">${esc(s.title)}</h1>
      ${s.subtitle ? `<p class="wsec-sub">${esc(s.subtitle)}</p>` : ''}
    </div>
    <div class="wsec-rule"></div>
  </div>
</section>`;

// ---- 14 WIDE STATEMENT -----------------------------------------------------
// Spatial logic: ONE focal point on the MIDDLE screen (where the eye rests),
// outer screens are deliberate negative space framed by two thin brand ticks so
// the wings read as 'intentional frame', not 'empty/broken' (the LED-wall rule:
// big screens want CLEAR content + negative space, not edge-to-edge text).
W.wstatement = (s) => `
<section class="slide dark wstatement">
  <span class="wst-tick left"></span>
  <div class="wst-stage">
    ${s.eyebrow ? `<div class="eyebrow bar on-dark" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
    <h1 class="wst-title">${esc(s.title)}</h1>
    ${s.attribution ? `<div class="wst-attr">${esc(s.attribution)}</div>` : ''}
  </div>
  <span class="wst-tick right"></span>
</section>`;

// ============================================================================
//  ANIMATED HERO TEMPLATES (cinematic — use the full 3-screen stage)
//  Each needs motion:true on the deck so wide-motion.css + deck-engine load.
// ============================================================================

// ---- 15 CURTAIN REVEAL — two velvet panels part from the centre, unveiling
//      the title across the whole width. The signature theatrical open.
W.wcurtain = (s) => `
<section class="slide dark wcover wcurtain">
  <div class="curtain"><span class="panel l"></span><span class="panel r"></span></div>
  <div class="curtain-stage wc-wrap" style="grid-template-columns:1fr;justify-items:center;text-align:center;padding:0;">
    <div style="max-width:2800px;">
      ${s.eyebrow ? `<div class="eyebrow bar on-dark" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
      <h1 class="wc-title" style="font-size:84px;max-width:none;">${esc(s.title)}</h1>
      ${s.subtitle ? `<p class="wc-sub" style="max-width:1900px;margin-left:auto;margin-right:auto;">${esc(s.subtitle)}</p>` : ''}
    </div>
  </div>
</section>`;

// ---- 16 SPLIT-FLAP BOARD — a Solari departures board flips the title in,
//      cell by cell across the panorama. Great for a number/word reveal.
W.wflap = (s) => {
  const chars = [...String(s.word || '')];
  let d = 0;
  const cells = chars.map(ch => {
    if (ch === ' ') return `<span class="flap sp"></span>`;
    const cell = `<span class="flap" style="--d:${d.toFixed(2)}s">${esc(ch)}</span>`;
    d += 0.09;
    return cell;
  }).join('');
  return `
<section class="slide dark wstatement wflapboard">
  <div class="wst-stage" style="left:0;width:3840px;padding:0 ${PAD_X}px;">
    ${s.eyebrow ? `<div class="eyebrow bar on-dark reveal" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
    <div class="flapline" style="justify-content:center;margin-top:18px;">${cells}</div>
    ${s.caption ? `<div class="wst-attr reveal" style="margin-top:30px;">${esc(s.caption)}</div>` : ''}
  </div>
</section>`;
};

// ---- 17 SPOTLIGHT ROW — a soft light sweeps L→R across the width, lighting
//      each item as it passes. The rest sit dim until the beam reaches them.
W.wspotlight = (s) => {
  const N = s.items.length;
  return `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="spotwrap" style="flex:1;display:grid;grid-template-columns:repeat(${N},1fr);gap:30px;align-items:center;margin-top:8px;">
      <span class="spotbeam" data-qa-ignore="offcanvas overflow"></span>
      ${s.items.map((it, i) => `
      <div class="spotlit" style="--d:${(i * 0.42).toFixed(2)}s;text-align:center;padding:0 24px;">
        ${it.icon ? `<div style="width:74px;height:74px;margin:0 auto 18px;border-radius:18px;background:rgba(0,164,239,.14);display:grid;place-items:center;color:#5cc8ff;">${icon(it.icon)}</div>` : ''}
        ${it.n ? `<div style="font-size:62px;font-weight:850;line-height:1;letter-spacing:-.02em;background:linear-gradient(135deg,#5cc8ff,#0078D4);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">${esc(it.n)}</div>` : ''}
        <div style="font-size:23px;font-weight:700;margin-top:10px;">${esc(it.t)}</div>
        ${it.b ? `<div style="font-size:15px;color:rgba(255,255,255,.6);margin-top:8px;line-height:1.4;">${esc(it.b)}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>
</section>`;
};

// ---- 18 HORIZON / DAWN — a luminous line splits at centre and a glow rises
//      across all three screens. For an opening or a 'new era' beat.
W.whorizon = (s) => `
<section class="slide dark wstatement whorizonslide">
  <div class="horizon"><span class="hglow" data-qa-ignore="offcanvas overflow"></span><span class="hline"></span></div>
  <div class="wst-stage" style="left:0;width:3840px;">
    ${s.eyebrow ? `<div class="eyebrow bar on-dark reveal" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
    <h1 class="wst-title reveal" style="animation-delay:1s;">${esc(s.title)}</h1>
    ${s.attribution ? `<div class="wst-attr reveal" style="animation-delay:1.4s;">${esc(s.attribution)}</div>` : ''}
  </div>
</section>`;

// ---- 19 UNFOLD TRIPTYCH — the three acts swing open like an altarpiece.
//      (Animated sibling of wtript; same data shape.)
W.wunfold = (s) => `
<section class="slide">
  ${s.kicker ? `<div class="slide-pad" style="padding-bottom:0;flex:0 0 auto;">${whead({ kicker: s.kicker, title: s.title, subtitle: s.subtitle })}</div>` : ''}
  <div class="tript">
    ${s.acts.map((a, i) => {
      const cls = i === 0 ? 'unfold-l' : (i === s.acts.length - 1 ? 'unfold-r' : 'unfold-c');
      return `
    <div class="tri-act ${a.dark ? 'dark' : ''} ${cls}">
      <div class="ta-n">${esc(a.n || 'Act ' + (i + 1))}</div>
      <div class="ta-t">${esc(a.t)}</div>
      <div class="ta-b">${esc(a.b)}</div>
      ${a.foot ? `<div class="ta-foot">${esc(a.foot)}</div>` : ''}
    </div>`;
    }).join('')}
  </div>
</section>`;

// ---- 20 IRIS COVER — a circular aperture opens from centre revealing the title.
W.wiris = (s) => `
<section class="slide dark wstatement wiris-slide">
  <div class="iris" style="position:absolute;inset:0;background:radial-gradient(120% 120% at 50% 42%,rgba(0,164,239,.16),rgba(0,0,0,0) 55%),#000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
    <div style="max-width:2700px;padding:0 90px;">
      ${s.eyebrow ? `<div class="eyebrow bar on-dark" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
      <h1 class="wc-title" style="font-size:84px;max-width:none;color:#fff;">${esc(s.title)}</h1>
      ${s.subtitle ? `<p class="wc-sub" style="max-width:1900px;margin:18px auto 0;">${esc(s.subtitle)}</p>` : ''}
    </div>
  </div>
</section>`;

// ---- 21 SHUTTER REVEAL — vertical slats flip open in sequence, unveiling the
//      title behind. A crisp, mechanical alternative to the curtain.
W.wshutter = (s) => {
  const SLATS = 12;
  let slats = '';
  for (let i = 0; i < SLATS; i++) slats += `<span class="slat" style="--d:${(i * 0.07).toFixed(2)}s"></span>`;
  return `
<section class="slide dark wcover wshutter-slide">
  <div class="shutter">${slats}</div>
  <div class="shutter-stage wc-wrap" style="grid-template-columns:1fr;justify-items:center;text-align:center;padding:0;">
    <div style="max-width:2800px;">
      ${s.eyebrow ? `<div class="eyebrow bar on-dark" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
      <h1 class="wc-title" style="font-size:82px;max-width:none;">${esc(s.title)}</h1>
      ${s.subtitle ? `<p class="wc-sub" style="max-width:1900px;margin:18px auto 0;">${esc(s.subtitle)}</p>` : ''}
    </div>
  </div>
</section>`;
};

// ---- 22 TYPEWRITER — a headline types itself across the width with a caret.
//      For a 'we asked the agent…' or a quote that assembles live.
W.wtypewriter = (s) => `
<section class="slide dark wstatement wtype-slide">
  <div class="wst-stage" style="left:0;width:3840px;align-items:center;">
    ${s.eyebrow ? `<div class="eyebrow bar on-dark reveal" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
    <h1 class="wst-title" style="white-space:nowrap;max-width:none;"><span class="typeline" style="--tw:100%;">${esc(s.title)}</span><span class="caret"></span></h1>
    ${s.attribution ? `<div class="wst-attr reveal" style="animation-delay:2.2s;">${esc(s.attribution)}</div>` : ''}
  </div>
</section>`;

// ---- 23 FILM-STRIP — the stage advances in from the right like a film frame,
//      sprocket holes marching top + bottom. For a 'next scene' beat.
W.wfilmstrip = (s) => {
  const holes = Array.from({ length: 30 }, () => '<i></i>').join('');
  return `
<section class="slide dark wstatement wfilm-slide">
  <div class="sprockets top">${holes}</div>
  <div class="filmslide wst-stage" style="left:0;width:3840px;">
    ${s.eyebrow ? `<div class="eyebrow bar on-dark" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
    <h1 class="wst-title" style="max-width:2600px;">${esc(s.title)}</h1>
    ${s.attribution ? `<div class="wst-attr">${esc(s.attribution)}</div>` : ''}
  </div>
  <div class="sprockets bot">${holes}</div>
</section>`;
};

// ---- 24 DEPTH DOLLY — the scene pushes back (scale-down) as content rises,
//      a back glow layer drifting for parallax depth. 'Stepping into the room.'
W.wdolly = (s) => `
<section class="slide dark wstatement wdolly-slide">
  <div class="dolly-back" style="position:absolute;inset:0;background:radial-gradient(60% 80% at 50% 40%,rgba(0,140,255,.22),rgba(0,0,0,0) 60%);"></div>
  <div class="dolly wst-stage" style="left:0;width:3840px;">
    ${s.eyebrow ? `<div class="eyebrow bar on-dark" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
    <h1 class="wst-title" style="max-width:2600px;">${esc(s.title)}</h1>
    ${s.attribution ? `<div class="wst-attr">${esc(s.attribution)}</div>` : ''}
  </div>
</section>`;

// ---- 25 LIGHT-LEAK — an anamorphic lens flare streaks L→R across the panorama
//      once on entry, leaving the content lit. Ambient, cinematic statement.
W.wleak = (s) => `
<section class="slide dark wstatement wleak-slide">
  <span class="leak"></span>
  <div class="wst-stage reveal" style="left:0;width:3840px;animation-delay:.5s;">
    ${s.eyebrow ? `<div class="eyebrow bar on-dark" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
    <h1 class="wst-title" style="max-width:2600px;">${esc(s.title)}</h1>
    ${s.attribution ? `<div class="wst-attr">${esc(s.attribution)}</div>` : ''}
  </div>
</section>`;

// ---- 26 PANORAMIC SCREENSHOT GALLERY — N product shots laid across the wall,
//      each with a caption + IQ chips under it. EARNS the width by showing the
//      demo as a filmstrip the eye reads L→R. Raw img paths (relative to the
//      deck HTML) so live captures drop straight in.
W.wshots = (s) => {
  const N = s.shots.length;
  return `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="wshots" style="grid-template-columns:repeat(${N},1fr);">
      ${s.shots.map((sh, i) => `
      <figure class="wshot wrise" style="--d:${(0.3 + i * 0.16).toFixed(2)}s;">
        <div class="wsh-img"><img src="${esc(sh.img)}" alt="${esc(sh.cap || '')}"></div>
        ${sh.cap ? `<figcaption class="wsh-cap">${esc(sh.cap)}</figcaption>` : ''}
        ${sh.chips ? `<div class="wsh-chips">${sh.chips.map(c =>
          `<span class="wsh-chip" style="--cc:${c.color || 'var(--ms-blue)'};"><b>${esc(c.k)}</b> ${esc(c.t)}</span>`).join('')}</div>` : ''}
      </figure>`).join('')}
    </div>
  </div>
</section>`;
};


// ============================================================================
//  COUNCIL-DERIVED TEMPLATES (v2) — built from the 3-model design review of the
//  EY×MS deck. Each encapsulates a panoramic visual learning: use the width,
//  native product icons, brand-accent (EY yellow) reserved for value/outcome.
//  Generic icons may tint; PRODUCT icons (p_*) render NATIVE, never recolored.
// ============================================================================

// helper: a product-icon chip (native, on a soft plate) vs a generic tinted icon.
// pIcon resolves to the REAL official Microsoft logo via the product-icon library
// (productIcon → verbatim SVG, never recolored). Falls back to the legacy p_*.svg
// placeholder in assets/icons/ if there's no confident match, so nothing ever renders blank.
const pIcon = (name, sz = 40) => {
  const real = (typeof productIcon === 'function') ? productIcon(name, { warn: false }) : '';
  const svg = real || icon(name);   // real logo first, legacy placeholder fallback
  return `<span class="wp-ico" style="--isz:${sz}px;">${svg}</span>`;
};
const gIcon = (name, sz = 40, col = 'var(--accent)') => `<span class="wg-ico" style="--isz:${sz}px;--ic:${col};">${icon(name)}</span>`;

// ---- 27 BRAND COVER — hard-left title on charcoal, full-width accent horizon,
//      optional image bleed on the right. The signature open. (council: slide 1)
W.wbrandcover = (s) => `
<section class="slide dark wbrandcover">
  ${s.img ? `<div class="wbc-bleed"><img src="${esc(/^(\.|\/|https?:|data:)/.test(s.img) ? s.img : B.IMG(s.img))}" alt=""></div>` : '<div class="wbc-motif"></div>'}
  <div class="wbc-horizon"></div>
  <div class="wbc-wrap">
    <div class="eyebrow bar on-dark">${esc(s.eyebrow || 'Beautiful Decks')}</div>
    <h1 class="wbc-title">${esc(s.title)}</h1>
    ${s.subtitle ? `<p class="wbc-sub">${esc(s.subtitle)}</p>` : ''}
    ${s.meta ? `<div class="wbc-meta">${s.meta.map(m => `<div><div class="m-k">${esc(m.k)}</div><div class="m-v">${esc(m.v)}</div></div>`).join('')}</div>` : ''}
  </div>
</section>`;

// ---- 28 STATION TIMELINE — L→R spine with N icon-nodes pinned to clock times.
//      Fixes the "empty agenda" void. (council: slide 2, top fix)
W.wtimeline = (s) => {
  const N = s.stations.length;
  return `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="wtl">
      <div class="wtl-spine"></div>
      <div class="wtl-row" style="grid-template-columns:repeat(${N},1fr);">
        ${s.stations.map((st, i) => `
        <div class="wtl-st ${st.hot ? 'hot' : ''} wrise" style="--d:${(0.3 + i * 0.12).toFixed(2)}s;">
          <div class="wtl-node">${st.product ? pIcon(st.icon, 38) : gIcon(st.icon || 'sparkle', 34)}</div>
          ${st.time ? `<div class="wtl-time">${esc(st.time)}</div>` : ''}
          <div class="wtl-t">${esc(st.t)}</div>
          ${st.b ? `<div class="wtl-b">${esc(st.b)}</div>` : ''}
          ${st.who ? `<div class="wtl-who">${esc(st.who)}</div>` : ''}
          ${st.chips ? `<div class="wtl-chips">${st.chips.map(c => pIcon(c, 26)).join('')}</div>` : ''}
        </div>`).join('')}
      </div>
    </div>
  </div>
</section>`;
};

// ---- 29 STAIRCASE + WALL — ascending steps with a figure stalled at the wall.
//      Makes "scaling problem" visceral. (council: slide 3)
W.wstair = (s) => {
  const N = s.steps.length;
  return `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="wstair" style="grid-template-columns:repeat(${N},1fr);">
      ${s.steps.map((p, i) => `
      <div class="wstep ${p.wall ? 'wall' : ''} ${p.goal ? 'goal' : ''} wrise" style="--lift:${i * (s.rise || 64)}px;--d:${(0.3 + i * 0.14).toFixed(2)}s;">
        <div class="wstep-ico">${p.wall ? gIcon('people', 40, '#fff') : (p.product ? pIcon(p.icon, 38) : gIcon(p.icon || 'trending', 36))}</div>
        <div class="wstep-n">${esc(p.lvl || ('0' + (i + 1)))}</div>
        <div class="wstep-t">${esc(p.t)}</div>
        <div class="wstep-b">${esc(p.b)}</div>
        ${p.tag ? `<div class="wstep-tag">${esc(p.tag)}</div>` : ''}
      </div>`).join('')}
    </div>
    ${s.seam ? `<div class="wstair-seam">${esc(s.seam)}</div>` : ''}
  </div>
</section>`;
};

// ---- 30 GUT-PUNCH — one enormous count-up number over a field of dim dots.
//      The pressure peak. (council: slide 4/5, "$100M / zero agents")
W.wgutpunch = (s) => {
  const dots = Array.from({ length: 120 }, (_, i) =>
    `<span class="gp-dot${(s.litDots || []).includes(i) ? ' lit' : ''}"></span>`).join('');
  const m = String(s.figure || '').match(/^([^\d]*)(\d[\d,]*)(.*)$/);
  const fig = m
    ? `${esc(m[1])}<span data-countup data-to="${m[2].replace(/,/g, '')}">${esc(m[2])}</span>${esc(m[3])}`
    : esc(s.figure);
  return `
<section class="slide dark wgutpunch">
  <div class="gp-field">${dots}</div>
  <div class="gp-stage">
    ${s.eyebrow ? `<div class="eyebrow bar on-dark" style="justify-content:center;">${esc(s.eyebrow)}</div>` : ''}
    <div class="gp-fig">${fig}</div>
    ${s.line ? `<div class="gp-line">${esc(s.line)}</div>` : ''}
    ${s.quote ? `<div class="gp-quote">${esc(s.quote)}</div>` : ''}
  </div>
</section>`;
};

// ---- 31 VALUE RIVER — three zones (left brings · core layer · right gets) with
//      widening flow arrows + a NATIVE product-icon core. (council: slide 6)
W.wriver = (s) => `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="wriver">
      <div class="wrv-side left">
        <div class="wrv-cap">${esc(s.leftCap || 'Strategy brings')}</div>
        ${s.left.map(it => `<div class="wrv-item">${gIcon(it.icon || 'sparkle', 30)}<span>${esc(it.t)}</span></div>`).join('')}
      </div>
      <div class="wrv-flow l"></div>
      <div class="wrv-core">
        <div class="wrv-core-t">${esc(s.core.t)}</div>
        <div class="wrv-core-grid">${(s.core.icons || []).map(n => pIcon(n, 46)).join('')}</div>
        <div class="wrv-core-b">${esc(s.core.b || '')}</div>
      </div>
      <div class="wrv-flow r"></div>
      <div class="wrv-side right">
        <div class="wrv-cap">${esc(s.rightCap || 'The client gets')}</div>
        ${s.right.map(it => `<div class="wrv-item">${gIcon(it.icon || 'trending', 30)}<span>${esc(it.t)}</span></div>`).join('')}
      </div>
    </div>
    ${s.bridge ? `<div class="wrv-bridge">${esc(s.bridge)}</div>` : ''}
  </div>
</section>`;

// ---- 32 TWO FORCES — split canvas (Intelligence | Trust), pillar icons each.
//      (council: slide 7)
W.wforces = (s) => `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="wforces">
      ${s.forces.map((f, fi) => `
      <div class="wforce ${fi === 1 ? 'b' : 'a'}">
        <div class="wforce-h">${esc(f.name)}</div>
        <div class="wforce-grid" style="grid-template-columns:repeat(${f.items.length},1fr);">
          ${f.items.map(it => `<div class="wforce-i wrise" style="--d:${(0.3 + fi * 0.1).toFixed(2)}s;">${it.product ? pIcon(it.icon, 42) : gIcon(it.icon || 'sparkle', 40)}<div class="wfi-t">${esc(it.t)}</div>${it.b ? `<div class="wfi-b">${esc(it.b)}</div>` : ''}</div>`).join('')}
        </div>
      </div>`).join('<div class="wforce-seam"></div>')}
    </div>
    ${s.cap ? `<div class="wforces-cap">${esc(s.cap)}</div>` : ''}
  </div>
</section>`;

// ---- 33 PRODUCT CONSTELLATION (whub) — a real hub-and-spoke with NATIVE product
//      icons spread across the 3 screens, pulsing spokes. Rebuild of the ugly
//      circle-node constel for product surfaces. (council: slide 9, top icon fix)
W.whub = (s) => {
  const H = 430;                                          // fixed stage band height (px)
  const cx = WIDE_W / 2, cy = H / 2, N = s.nodes.length;  // hub vertically centered in the band
  const rx = 1320, ry = 120;                              // gentle arc, stays within the band
  const nodes = s.nodes.map((nd, i) => {
    const t = N === 1 ? 0.5 : i / (N - 1);
    const ang = Math.PI - t * Math.PI;              // left→right arc
    const x = cx + Math.cos(ang) * rx;
    const y = cy - Math.sin(ang) * ry;                    // peaks ABOVE the hub line; ends level with hub
    return { ...nd, x, y };
  });
  const spokes = nodes.map((n, i) =>
    `<line class="hub-spoke" style="--d:${(0.8 + i * 0.12).toFixed(2)}s;" x1="${cx}" y1="${cy}" x2="${n.x.toFixed(0)}" y2="${n.y.toFixed(0)}"></line>`).join('');
  const dots = nodes.map((n, i) =>
    `<div class="hub-node wrise" style="left:${n.x.toFixed(0)}px;top:${n.y.toFixed(0)}px;--d:${(1.0 + i * 0.12).toFixed(2)}s;">
       <div class="hub-node-ico">${pIcon(n.icon, 50)}</div>
       <div class="hub-node-t">${esc(n.t)}</div>
       ${n.b ? `<div class="hub-node-b">${esc(n.b)}</div>` : ''}
     </div>`).join('');
  return `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="whub" style="height:${H}px;">
      <svg class="hub-svg" viewBox="0 0 ${WIDE_W} ${H}" preserveAspectRatio="none">${spokes}</svg>
      <div class="hub-core" style="left:${cx}px;top:${cy}px;">
        <div class="hub-core-ico">${pIcon(s.hubIcon || 'p_multiagent', 56)}</div>
        <div class="hub-core-t">${esc(s.hub || 'ONE AGENT')}</div>
      </div>
      ${dots}
    </div>
  </div>
</section>`;
};

// ---- 34 ZIPPER SWIMLANE — two rails that mesh at column seams (the alliance,
//      merged). Joint-outcome strip along the bottom. (council: merge 9+10)
W.wzipper = (s) => {
  const NC = s.cols.length;
  return `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="wzip">
      <div class="wzip-rail top">
        <div class="wzip-actor">${gIcon(s.topIcon || 'people', 30)}<span>${esc(s.topActor)}</span></div>
        <div class="wzip-cells" style="grid-template-columns:repeat(${NC},1fr);">
          ${s.top.map((c, i) => `<div class="wzip-cell wrise" style="--d:${(0.3 + i * 0.08).toFixed(2)}s;">${esc(c)}</div>`).join('')}
        </div>
      </div>
      <div class="wzip-seam"><div class="wzip-cols" style="grid-template-columns:repeat(${NC},1fr);">${s.cols.map(c => `<div class="wzip-col">${esc(c)}</div>`).join('')}</div></div>
      <div class="wzip-rail bot">
        <div class="wzip-actor">${(s.botProduct ? pIcon(s.botIcon || 'p_workiq', 30) : gIcon(s.botIcon || 'bot', 30))}<span>${esc(s.botActor)}</span></div>
        <div class="wzip-cells" style="grid-template-columns:repeat(${NC},1fr);">
          ${s.bot.map((c, i) => `<div class="wzip-cell wrise" style="--d:${(0.4 + i * 0.08).toFixed(2)}s;">${esc(c)}</div>`).join('')}
        </div>
      </div>
      ${s.outcome ? `<div class="wzip-outcome"><span class="wzo-lbl">${esc(s.outcomeLabel || 'What the client sees')}</span><div class="wzo-cells" style="grid-template-columns:repeat(${NC},1fr);">${s.outcome.map(c => `<div class="wzo-cell">${esc(c)}</div>`).join('')}</div></div>` : ''}
    </div>
  </div>
</section>`;
};

// ---- 35 PITCH CANVAS — fill-in-the-blank board-pitch Mad-Lib with a worked
//      example pre-filled. The workshop's working slide. (council: slide 16)
W.wpitchcanvas = (s) => `
<section class="slide">
  <div class="slide-pad">
    ${whead(s)}
    <div class="wpitch">
      ${s.cards.map((c, i) => `
      <div class="wpitch-card wrise" style="--d:${(0.3 + i * 0.12).toFixed(2)}s;">
        <div class="wpc-n">${esc(c.n || ('0' + (i + 1)))}</div>
        <div class="wpc-ico">${c.product ? pIcon(c.icon, 38) : gIcon(c.icon || 'sparkle', 36)}</div>
        <div class="wpc-prompt">${esc(c.prompt)}</div>
        ${c.example ? `<div class="wpc-eg"><span class="wpc-eg-tag">e.g.</span>${esc(c.example)}</div>` : ''}
      </div>`).join('<div class="wpitch-join"></div>')}
    </div>
    ${s.foot2 ? `<div class="wpitch-foot">${esc(s.foot2)}</div>` : ''}
  </div>
</section>`;


// ============================================================================
//  PAGE ASSEMBLY
// ============================================================================
function validateWideDeck(deck) {
  if (!deck || typeof deck !== 'object') throw new TypeError('wide deck spec must export an object');
  if (!Array.isArray(deck.slides) || deck.slides.length === 0) throw new TypeError('deck.slides must be a non-empty array');
  deck.slides.forEach((slide, index) => {
    if (!slide || typeof slide !== 'object') throw new TypeError(`slide ${index + 1} must be an object`);
    if (!slide.type || !W[slide.type]) throw new Error(`unknown wide slide type "${slide.type || ''}" at slide ${index + 1}`);
  });
}
function buildWideDeck(deck) {
  validateWideDeck(deck);
  B.resetBuildState();
  const A = (deck._assetBase || '..').replace(/\/$/, '');
  B.setAssetBase(A);
  // WIDE CHROME — vertical brand rail (right edge) + centred footer, built once.
  const ms4 = `<span class="wr-ms"><i></i><i></i><i></i><i></i></span>`;
  const cust = deck.customer ? (typeof deck.customer === 'string' ? { key: deck.customer } : deck.customer) : null;
  const rawCustSvg = cust ? (cust.logoSvg || customerLogo(cust.key)) : '';
  const rail = () => {
    const custSvg = rawCustSvg ? B.namespaceSvgIds(rawCustSvg) : '';
    const railCust = custSvg
      ? `<span class="wr-div"></span><span class="wr-cust${cust.plate !== false ? ' plate' : ''}">${custSvg}</span>`
      : '';
    return `<div class="wrail">${ms4}${railCust}</div>`;
  };
  const present = !deck.gallery;
  const motion = Boolean(deck.motion) && present;

  // BRAND THEME — per-deck accent override injected as a :root cascade so the
  // whole wide deck re-tints (accents, rules, eyebrows, highlights) to the
  // customer's brand instead of the default Microsoft blue. deck.brand = {
  //   accent:'#FFE600', accent2:'#F5C24B', ink:'#2E2E38' }  (all optional).
  const bA = deck.brand && deck.brand.accent;
  const bA2 = (deck.brand && deck.brand.accent2) || bA;
  const brandCss = deck.brand ? `<style>
body.wide{
  ${bA ? `--accent:${bA};--blue-primary:${bA};` : ''}
  ${bA2 ? `--accent2:${bA2};` : ''}
  ${deck.brand.ink ? `--brand-ink:${deck.brand.ink};` : ''}
}
${bA ? `
/* re-tint every blue-leak surface to the brand accent */
body.wide .waccent{background:linear-gradient(90deg,${bA},${bA2});}
body.wide .eyebrow.bar::before{background:${bA};}
body.wide.theme-dark .eyebrow.bar,
body.wide.theme-dark .eyebrow.on-dark,
body.wide .eyebrow.bar.on-dark{color:${bA};}
body.wide .wsec-num{background:linear-gradient(160deg,${bA},${bA2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
body.wide .grad-text{background:linear-gradient(120deg,${bA},${bA2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
body.wide .tri-act .ta-foot{color:${bA};}
body.wide .wst-tick{background:linear-gradient(90deg,${bA},transparent);}
body.wide .wst-tick.right{background:linear-gradient(270deg,${bA},transparent);}
body.wide .eyebrow.on-dark{color:${bA};}
` : ''}
</style>` : '';

  const renderSlide = (sp, i) => {
    const fn = W[sp.type];
    sp.page = String(i + 1).padStart(2, '0');
    if (sp.foot === undefined) sp.foot = deck.foot;
    let html = fn(sp);
    // centred footer (under the focal middle screen) — single readable unit, not two
    // scraps stranded at the far edges
    const cap = sp.foot ? `<span class="wf-cap">${esc(sp.foot)}</span><span class="wf-dot"></span>` : '';
    const foot = `<div class="wfoot">${cap}<span class="wf-pg">${sp.page}</span></div>`;
    html = html.replace(/<\/section>\s*$/, `${rail()}\n  ${foot}\n</section>`);
    return html;
  };

  const bodyClasses = ['wide'];
  if (deck.gallery) bodyClasses.push('gallery');
  // DARK is the DEFAULT for widescreen — big theatre screens make a light field harsh.
  // Opt out per-deck with theme:'light'.
  if (deck.theme !== 'light') bodyClasses.push('theme-dark');
  if (motion) bodyClasses.push('motion-on');
  if (deck.seams) bodyClasses.push('seams');

  const slidesHtml = deck.gallery
    ? deck.slides.map((sp, i) => `<div class="g-label">${String(i + 1).padStart(2, '0')} · ${esc(sp.label || sp.type)}${sp.note ? ` <span>${esc(sp.note)}</span>` : ''}</div>\n${renderSlide(sp, i)}`).join('\n')
    : deck.slides.map(renderSlide).join('\n');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(deck.title || 'Wide Deck')}</title>
<link rel="stylesheet" href="${A}/css/fluent.css">
<link rel="stylesheet" href="${A}/css/wide.css">
<link rel="stylesheet" href="${A}/css/wide-v2.css">
${motion ? `<link rel="stylesheet" href="${A}/css/motion.css">
<link rel="stylesheet" href="${A}/css/wide-motion.css">` : ''}
<style>${B.BRANDBAR_CSS}</style>
${brandCss}
${deck.gallery ? `<style>body.wide.gallery{padding:40px 0 70px;}
.g-label{width:3840px;margin:0 auto 10px;color:#9ad0ff;font-size:15px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-family:var(--font);}
.g-label span{color:#777;font-weight:500;text-transform:none;letter-spacing:0;margin-left:12px;}</style>` : ''}
${present ? `<style>html,body{margin:0;background:#000;height:100%;overflow:hidden;}
.wide .slide{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(var(--fit,1));transform-origin:center;display:none;}
.wide .slide.active{display:flex;flex-direction:column;}
#ov{position:fixed;inset:0;background:#0b0b0d;z-index:80;display:none;overflow:auto;padding:24px;}
#ov.on{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-content:start;}
.ovcell{appearance:none;text-align:left;font-family:var(--font);aspect-ratio:16/3;border-radius:8px;border:1px solid #222;position:relative;cursor:pointer;background:#0a1326;color:#cfe0ff;font-size:14px;font-weight:600;padding:26px 12px 0;}
.ovcell:hover{border-color:var(--accent);}.ovcell:focus-visible{outline:3px solid var(--accent);outline-offset:2px;}
.ovcell .nn{position:absolute;top:6px;left:8px;font-size:10px;color:#5a7099;}</style>` : ''}
</head><body class="${bodyClasses.join(' ')}">
${slidesHtml}
${present ? `<script src="${A}/js/deck-engine.js"></script>\n<script src="${A}/js/deck-steps.js"></script>` : ''}
</body></html>`;
}

// ---- main ------------------------------------------------------------------
function main() {
  const deckPath = process.argv[2], outPath = process.argv[3];
  if (!deckPath || !outPath) { console.error('usage: node build-wide.js <deck.js> <out.html>'); process.exit(1); }
  const deck = require(path.resolve(deckPath));
  if (deck._assetBase === undefined) {
    const outDir = path.dirname(path.resolve(outPath));
    let rel = path.relative(outDir, ROOT).split(path.sep).join('/');
    deck._assetBase = rel || '.';
  }
  const html = buildWideDeck(deck);
  const resolvedOut = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, html);
  console.log(`✓ ${deck.slides.length} wide slides → ${outPath}  (48:9 · 3840×720 · assets: ${deck._assetBase})`);
}
if (require.main === module) main();
module.exports = { W, buildWideDeck, validateWideDeck, WIDE_W, WIDE_H };
