// Meridian's galaxy orb, for Connect (classic script: Connect's page has no ES modules).
// Built from the Overseer's orb-particles.js + orb.js (release core-c6d3490-ui-5719f4e), unchanged
// except: each file keeps its own scope inside one wrapper, "export"/"import" are removed, and the three pictures come from
// orb-pictures.js (data URLs; WebGL may not read pictures from local files). To update, rebuild from a newer Overseer release the same way; don't
// hand-edit the engine here. Connect's own code is in connect-orb.js.
(function () {
'use strict';
// ---------------------------------------------------------------- orb-particles.js
const startParticleOrb = (function () {
// The orb's particle engine (Core docs/overseer/ORB_DESIGN.md, James 2026-10-16: "dynamic, colorful,
// vibrant, and alive"). Now the stand-in for the real orb (orb.js): it shows at once while the
// orb's pictures load, and stays if this device cannot run the real one (no WebGL 2, the
// pictures failed, or the graphics context was lost). One small canvas, a few dozen particles, no libraries. Particles orbit the
// centre with light trails and shifting colour; the orb's state sets speed, spread, pulse and
// palette, eased so changes flow. The loop stops when the canvas leaves the page, sleeps with the tab
// (requestAnimationFrame), and holds a still frame while reduced motion is on.

const TAU = Math.PI * 2;
const PARTICLES = 40;
const CLOUDS = 3;

// Per state: speed (orbit), spread (share of the radius), breathe/pulse (size wave), hues
// (base, width across particles, drift per second), glow (core light) and saturation.
const ORB_PARAMS = {
  idle:     {speed: 1.0, spread: 1.0,  breathe: 0.07, pulse: 0.9, hueBase: 200, hueWidth: 300, hueSpin: 16, glow: 0.55, sat: 88},
  thinking: {speed: 2.8, spread: 0.72, breathe: 0.05, pulse: 2.4, hueBase: 190, hueWidth: 150, hueSpin: 55, glow: 0.85, sat: 92},
  speaking: {speed: 1.5, spread: 1.0,  breathe: 0.2,  pulse: 3.3, hueBase: 150, hueWidth: 130, hueSpin: 28, glow: 0.95, sat: 90},
  call:     {speed: 1.3, spread: 0.95, breathe: 0.13, pulse: 1.7, hueBase: 18,  hueWidth: 40,  hueSpin: 0,  glow: 0.85, sat: 100},
  listening: {speed: 1.0, spread: 0.95, breathe: 0.1, pulse: 1.2, hueBase: 22,  hueWidth: 40,  hueSpin: 0,  glow: 0.75, sat: 100},
  hearing:  {speed: 1.5, spread: 0.85, breathe: 0.16, pulse: 2.6, hueBase: 30,  hueWidth: 50,  hueSpin: 6,  glow: 0.95, sat: 100},
  unread:   {speed: 1.2, spread: 1.05, breathe: 0.1,  pulse: 1.5, hueBase: 285, hueWidth: 170, hueSpin: 24, glow: 1.0,  sat: 96},
};
const MAX_REACH = 0.94;                        // particles stay inside the circle

function makeParticles(n = PARTICLES, rand = Math.random) {
  return Array.from({length: n}, () => ({
    a: rand() * TAU,                            // angle
    r: 0.22 + rand() * 0.66,                    // orbit, as a share of the radius
    w: (0.35 + rand() * 0.95) * (rand() < 0.5 ? -1 : 1),   // angular speed, either way round
    p: rand() * TAU,                            // phase of its breathing
    s: 0.55 + rand() * 0.95,                    // dot size
    h: rand(),                                  // its place in the palette
  }));
}

// Where a particle is at time t, relative to the centre, for an orb of radius R.
function particlePosition(q, t, prm, R) {
  const reach = Math.min(MAX_REACH, q.r * prm.spread * (1 + prm.breathe * Math.sin(t * prm.pulse + q.p)));
  return {x: Math.cos(q.a) * reach * R, y: Math.sin(q.a) * reach * R};
}

// Ease the current look toward the target: numbers linearly, the base hue along the shorter arc.
function blend(cur, target, k) {
  const out = {};
  for (const key of Object.keys(target)) {
    if (key === 'hueBase') {
      const d = ((target.hueBase - cur.hueBase + 540) % 360) - 180;
      out.hueBase = (cur.hueBase + d * k + 360) % 360;
    } else out[key] = cur[key] + (target[key] - cur[key]) * k;
  }
  return out;
}

function hueOf(q, t, prm) { return (prm.hueBase + q.h * prm.hueWidth + t * prm.hueSpin) % 360; }

function prefersStill() {
  try {
    return document.body.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

// Run the orb on a canvas. getState() returns one of ORB_PARAMS' keys; anything else reads as idle.
function startParticleOrb(canvas, getState, {reach = 1} = {}) {
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return {stop() {}};
  const parts = makeParticles();
  let cur = {...ORB_PARAMS.idle}, t = Math.random() * 100, last = performance.now(), frame = 0, timer = 0, stopped = false;

  function draw(dt, still = false) {
    const css = canvas.clientWidth || 68, dpr = Math.min(2, window.devicePixelRatio || 1), px = Math.round(css * dpr);
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
    const R = (px / 2) * reach, scale = (R * 2) / 68, half = px / 2;
    cur = blend(cur, ORB_PARAMS[getState()] || ORB_PARAMS.idle, still ? 1 : Math.min(1, dt * 2.5));
    t += dt;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    // Transparent: the page shows round it. Fading the last frame (not covering it) leaves trails.
    if (still) ctx.clearRect(0, 0, px, px);
    else { ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; ctx.fillRect(0, 0, px, px); }
    ctx.translate(half, half);
    // A dark body for the particles to live in (the real orb's sphere, while its pictures load).
    ctx.globalCompositeOperation = 'source-over';
    const body = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    body.addColorStop(0, 'rgba(12, 26, 51, 0.95)'); body.addColorStop(0.85, 'rgba(4, 8, 16, 0.95)'); body.addColorStop(1, 'rgba(4, 8, 16, 0)');
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    // Colour clouds: three soft glows drifting around the middle, spread across the palette.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < CLOUDS; i++) {
      const a = t * 0.35 * cur.speed + (i * TAU) / CLOUDS, d = R * 0.32 * cur.spread;
      const x = Math.cos(a) * d, y = Math.sin(a * 1.3) * d;
      const hue = (cur.hueBase + (i / CLOUDS) * cur.hueWidth + t * cur.hueSpin) % 360;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.62);
      const breath = 0.85 + 0.15 * Math.sin(t * cur.pulse + i * 2);
      g.addColorStop(0, `hsla(${hue.toFixed(1)}, 100%, 55%, ${(0.2 * cur.glow * breath).toFixed(3)})`);
      g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-half, -half, px, px);
    }
    // Particles in pure colour (painted over, not added, so overlaps stay coloured, not white),
    // each with a faint halo.
    ctx.globalCompositeOperation = 'source-over';
    for (const q of parts) {
      q.a += q.w * cur.speed * dt;
      const {x, y} = particlePosition(q, t, cur, R);
      const hue = hueOf(q, t, cur).toFixed(1), sat = cur.sat.toFixed(0), size = q.s * scale;
      ctx.fillStyle = `hsla(${hue}, ${sat}%, 60%, 0.22)`;
      ctx.beginPath(); ctx.arc(x, y, size * 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = `hsla(${hue}, ${sat}%, 62%, 0.95)`;
      ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
    }
  }
  function tick(now) {
    if (stopped) return;
    if (!canvas.isConnected) { stopped = true; return; }           // the orb left the page
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (prefersStill()) { draw(0, true); timer = setTimeout(() => { last = performance.now(); tick(last); }, 600); return; }
    draw(dt);
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  // step(dt) draws one frame now (previews and checks; the loop runs by itself otherwise).
  return {stop() { stopped = true; cancelAnimationFrame(frame); clearTimeout(timer); }, step: dt => draw(dt)};
}
return startParticleOrb;
})();
// ---------------------------------------------------------------- orb.js
// The Overseer's orb (Core docs/overseer/ORB_VISION.md, James 2026-10-16): his chosen picture of
// a deep blue spiral galaxy in a glass shell, brought to life in WebGL 2. Built and tuned in the
// UI repo's lab (lab/opus3/orb-ref.js); this is the same engine with the console's wrapper.
//
// Two aligned pictures ship in assets/orb: the picture itself, and the same picture with the
// glass removed. Their difference IS the glass, so the galaxy can turn under the glass and the
// glass drift over it, separately; a still frame equals the picture. A third, orb-glass.png, is
// one smooth outline round all the glass (baked in lab/mask): the orb is cut along it, crisply. Live layers, each on its
// own clock: the whole symbol turning (about once a minute at rest, faster while thinking); the
// galaxy turning within it (inner arms swinging ahead and back, bent by the glass); the
// living centre (a heartbeat with a ripple of light, sparks spiralling down the arms into the
// core, energy running inward along the gold filaments, the hot core churning); the glass
// (drift, a light sweep, light running along its gold edges); water droplets on thin gold orbits
// with gold strings flowing off them; drifting gold sparks. Then a gentle bloom, a tone curve that
// keeps the picture's own colours, and a fine sharpening.
//
// Every state has its own character and entrance (STATES, ENTRANCES below). The voice drives
// waves of light: the Overseer's while it speaks (out from the core), James's while it hears him
// on a call (in toward the core).
//
// The particle orb (orb-particles.js) shows at once while the pictures load, and stays if this
// device cannot run the real one (no WebGL 2, only software graphics, the pictures failed, or any
// drawing error). The loop draws 24-30 frames a second (the orb is small), sleeps with the tab and
// while the orb is hidden, stops and frees its graphics memory when the orb leaves the page, and
// holds a still frame (re-drawn every 0.6 s) while reduced motion is on.
// Fable's code review: lab/REVIEW_ORB_V3.md.


const FULL_VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const SCENE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uRef, uGal;
uniform sampler2D uMask;   // the outline round all the glass (orb-glass.png): 1 inside, 0.5 on the edge
uniform vec2 uRes, uCenter;
uniform float uAura;   // 1: the orb keeps its own soft patch of dark space, fading into the page
uniform float uGlow;   // 1: no dark patch; smoky glass, and the orb's light tints the page round it
uniform float uFine;
uniform vec2 uJitter;   // a sub-pixel shift each frame; the temporal pass averages them into a smooth image   // 0 on a small orb, 1 on a large one: how much fine extra detail to add
uniform float uZoom, uRadius, uTime, uSpin, uTwist, uInfallT, uBeat, uGlassT, uBreath, uVoice, uWarm, uFlare, uSparks, uGlassAmt, uStrings, uPx, uSweep;
uniform float uTurn;   // the whole symbol's turn (radians, counter-clockwise)
uniform float uSpinStep;   // how far the galaxy turns between two frames: its motion blur
uniform float uCool, uInfallDir, uInfallCount, uInfallAmt, uCoreGain, uCoreTight, uFilT, uFilAmt, uVoiceIn, uVoiceGlass, uHalo, uDim, uKick, uSweepT;
uniform vec4 uWaves[6];     // waves of light: radius (orb units), strength, kind (0 through the galaxy, 1 a beacon outside), unused
uniform vec4 uHole[7];      // droplets painted into the reference: x, y, radius (uv), which way to fill from
uniform vec4 uDrop[8];
uniform vec4 uDropVel[8];   // per droplet: ring index, angle on it, direction
uniform vec3 uRingU[3];
uniform vec3 uRingV[3];
uniform vec3 uRingR;

float sstep(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float hash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float breathing() { return 0.85 + (0.08 * sin(uTime * 1.1) + 0.32 * uBeat) * uBreath + 0.9 * uVoice + 0.8 * uKick; }

uniform float uBias;   // mipmap bias: -0.55 (crisper) on a large orb, 0 on a small one, where crisper means shimmer
#define BIAS uBias
const float SPHERE = 1.0;   // the dark sphere's edge (orb units)

// Beyond the plates' edges (the orb is drawn a little smaller than the picture, centred): the
// same deep navy, with faint stars.
float plateEdge(vec2 uv) { return sstep(0.01, 0.14, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y))); }
vec3 space(vec2 uv) {
  vec2 out_ = max(max(-uv, uv - 1.0), 0.0);
  vec3 c = textureLod(uGal, clamp(uv, 0.06, 0.94), 8.0).rgb * (0.85 + 0.3 * noise(uv * 5.0)) * exp(-length(out_) * 2.0);
  vec2 g = uv * 160.0;
  float h = hash(floor(g));
  c += vec3(0.7, 0.75, 0.9) * step(0.985, h) * sstep(0.25, 0.0, length(fract(g) - 0.5)) * 0.25;
  return c;
}
vec3 galSample(vec2 uv) { return mix(space(uv), texture(uGal, uv, BIAS).rgb, plateEdge(uv)); }

// The glass at uv: the reference minus the galaxy as the glass lets it through. Where that is
// positive the glass adds light (returned); where negative it tints what is behind it (tint, per
// channel, applied to the moving galaxy). cover = how much glass is here.
// The droplets painted into the reference are cut out and filled from just along the orbit.
vec3 glassRaw(vec2 uv, out float cover, out vec3 tint) {
  vec3 bd = textureLod(uRef, uv, 3.5).rgb - textureLod(uGal, uv, 3.5).rgb;
  cover = sstep(0.006, 0.045, length(bd));
  const float T = 1.0;   // all of the galaxy is the galaxy's (any share of it kept here is a still ghost under the turning one)
  vec3 behind = T * texture(uGal, uv, BIAS).rgb;
  // All of the difference, wherever it is: scaled down by cover, the faint outer ribbons drew at
  // half strength (James: "they're still faded out"). Galaxy plus glass is the picture exactly.
  vec3 g = texture(uRef, uv, BIAS).rgb - behind;
  tint = clamp(1.0 + min(g, 0.0) / max(behind, vec3(0.02)), 0.0, 1.0);
  return max(g, 0.0);
}
vec3 glassAt(vec2 uv, out float cover, out vec3 tint) {
  for (int i = 0; i < 7; i++) {
    vec4 h = uHole[i];
    float d = length(uv - h.xy) / h.z;
    if (d < 1.25) {
      vec2 rel = uv - uCenter;
      float shift = h.w * 2.6 * h.z / max(length(h.xy - uCenter), 1e-3);    // along the orbit, past the droplet
      float c2, c1; vec3 t2, t1;
      vec3 fill = glassRaw(uCenter + rot(shift) * rel, c2, t2);
      vec3 here = glassRaw(uv, c1, t1);
      float k = sstep(1.25, 0.95, d);
      cover = mix(c1, c2, k); tint = mix(t1, t2, k);
      return mix(here, fill, k);
    }
  }
  return glassRaw(uv, cover, tint);
}

// The galaxy with the glass removed, alive, sampled once (sharp): the whole disc turns
// (unbounded, seamless), the inner arms swing a little ahead and back, the hot core churns.
vec3 galaxyAt(vec2 uv) {
  vec2 rel0 = uv - uCenter;
  float r = length(rel0) / uRadius;
  vec2 n = vec2(noise(rel0 * 60.0 + vec2(uTime * 0.35, 0.0)), noise(rel0 * 60.0 + vec2(5.2, -uTime * 0.3))) - 0.5;
  // Blurred a little along its own turn, by as far as it turns in a frame (as a camera would see
  // it): its fine stars and veins glide instead of skipping from pixel to pixel (that read as static).
  vec3 acc = vec3(0.0);
  for (int k = -1; k <= 1; k++) {
    vec2 rel = rot(uSpin + float(k) * 0.5 * uSpinStep) * rel0;
    rel = rot(uTwist * exp(-r * 2.2)) * rel;
    rel += n * 0.0012 * exp(-r * r * 25.0);   // gentle: a stronger churn shimmers
    acc += galSample(uCenter + rel) * (k == 0 ? 0.5 : 0.25);
  }
  return acc;
}

float segDist(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0)); }

// Gold strings flowing off one droplet along its own orbit, ahead of it and behind it, curling a
// little off the line and shimmering, thinner and fainter toward the tip, light running out along
// them. orbit = (ring index, the droplet's angle on it, its direction, unused).
float strings(vec2 p, vec4 orbit, float seed, float size, out float lightOut) {
  int ri = int(orbit.x + 0.5);
  float R = ri == 0 ? uRingR.x : (ri == 1 ? uRingR.y : uRingR.z);
  vec3 u = ri == 0 ? uRingU[0] : (ri == 1 ? uRingU[1] : uRingU[2]);
  vec3 v = ri == 0 ? uRingV[0] : (ri == 1 ? uRingV[1] : uRingV[2]);
  float best = 1e3, bestT = 0.0;
  lightOut = 0.0;
  for (int s = 0; s < 2; s++) {
    float side = s == 1 ? -1.0 : 1.0;
    float span = (0.26 + 0.06 * sin(uTime * 0.45 + seed + float(s))) * side;
    float curl = (0.035 + 0.02 * sin(uTime * 0.6 + seed * 2.0 + float(s))) * (s == 2 ? -1.0 : side);
    vec2 prev = vec2(0.0);
    for (int i = 0; i <= 12; i++) {
      float t = float(i) / 12.0;
      float a = orbit.y + span * t;
      float rr = R * (1.0 + curl * t * t + 0.005 * t * sin(t * 7.0 - uTime * 1.6 + seed + float(s) * 2.1));   // smooth: shaking them with the voice read as lightning
      vec2 pt = rr * (u.xy * cos(a) + v.xy * sin(a));
      if (i > 0) {
        float d = segDist(p, prev, pt);
        if (d < best) { best = d; bestT = t; }
      }
      prev = pt;
    }
  }
  float fade = 1.0 - sstep(0.35, 1.0, bestT);
  float w = uPx * (1.1 - 0.7 * bestT) * (0.8 + size * 5.0);
  lightOut = pow(0.5 + 0.5 * cos(9.0 * (bestT - uTime * 0.4 - seed)), 20.0) * fade;
  return (exp(-best * best / (w * w)) * (1.0 + 0.6 * (1.0 - bestT)) + exp(-best * best / (w * w * 30.0)) * 0.1 * (1.0 - bestT)) * fade;
}

float ringNear(int i, vec2 p, out float z) {
  float R = i == 0 ? uRingR.x : (i == 1 ? uRingR.y : uRingR.z);
  vec3 u = uRingU[i], v = uRingV[i];
  z = -1.0;
  float det = u.x * v.y - v.x * u.y;
  if (abs(det) < 0.02) return 0.0;
  float ang = atan((u.x * p.y - p.x * u.y) / (R * det), (p.x * v.y - v.x * p.y) / (R * det));
  z = R * (u.z * cos(ang) + v.z * sin(ang));
  float d = length(p - R * (u.xy * cos(ang) + v.xy * sin(ang)));
  return exp(-d * d / 0.0012);
}
float ringLine(int i, vec2 p, out float z) {
  float R = i == 0 ? uRingR.x : (i == 1 ? uRingR.y : uRingR.z);
  vec3 u = uRingU[i], v = uRingV[i];
  z = 0.0;
  float det = u.x * v.y - v.x * u.y;
  if (abs(det) < 0.02) return 0.0;
  float c = (p.x * v.y - v.x * p.y) / (R * det);
  float s = (u.x * p.y - p.x * u.y) / (R * det);
  float ang = atan(s, c);
  vec2 on = R * (u.xy * cos(ang) + v.xy * sin(ang));
  z = R * (u.z * cos(ang) + v.z * sin(ang));
  float dist = length(p - on);
  float w = uPx * (i == 0 ? 2.0 : 1.0);   // the wrapping ring is a clear gold band; the others fine lines
  float lights = pow(0.5 + 0.5 * cos(4.0 * (ang - uTime * 0.25 - float(i) * 1.3)), 60.0);
  return (exp(-dist * dist / (w * w)) * 0.09 + exp(-dist * dist / (w * w * 6.0)) * (i == 0 ? 0.02 : 0.01)) * (1.0 + 3.0 * lights) * (i == 0 ? 3.0 : 1.0);   // a tight glow: a wide one fogged the orb
}

// How solid each droplet is, for the page behind it: mostly clear, firmer toward the rim.
float dropA = 0.0;

// Water droplets: clear, the galaxy seen upside down through them, a bright rim, a sharp glint.
// front = -1: the far ones (behind the glass, hidden behind the sphere); +1: the near ones.
vec3 droplets(vec3 col, vec2 p, float front) {
  vec3 H = normalize(normalize(vec3(-0.55, 0.65, 0.55)) + vec3(0.0, 0.0, 1.0));
  for (int j = 0; j < 8; j++) {
    vec4 dr = uDrop[j];
    if (dr.w <= 0.0 || dr.z * front < 0.0) continue;
    float seenAmt = dr.z < 0.0 ? sstep(0.9, 1.08, length(dr.xy)) : 1.0;   // behind the sphere: hidden
    if (seenAmt <= 0.0) continue;
    float light = 0.0, st = 0.0;
    if (length(p - dr.xy) < 0.75) st = strings(p, uDropVel[j], float(j) * 1.7, dr.w, light);   // far away they add nothing
    // Streamers: gold off some droplets, electric blue off others; one travelling light each.
    vec3 hue = mod(float(j), 2.0) < 0.5 ? vec3(1.0, 0.58, 0.2) : vec3(0.32, 0.62, 1.0);
    col += hue * st * uStrings * (0.55 + 1.8 * light + 0.9 * uVoice) * seenAmt;   // the voice brightens them
    vec2 d = (p - dr.xy) / dr.w;
    vec2 ds = rot(-uTurn) * d;   // the same point on screen: the light stays put while the symbol turns
    float ang = atan(d.y, d.x);
    float wob = 1.0 + 0.008 * sin(2.0 * ang + uTime * 1.1 + float(j) * 1.7) + 0.005 * sin(3.0 * ang - uTime * 1.5 + float(j));   // water, barely trembling
    float dl = length(d) / wob;
    // Water: clear and crisp. A small upside-down image of the orb seen through it, a thin dark band
    // just inside its edge (as water shows), a bright rim toward the light, one sharp glint, and the
    // light focused through it glowing on its far side. The key light is upper right.
    float aa = clamp(uPx / dr.w * 1.2, 0.001, 0.4);
    if (dl >= 1.0 + aa) continue;
    float q = min(dl, 0.999);
    float nz = sqrt(1.0 - q * q);
    vec3 N = normalize(vec3(ds / wob, nz));
    vec2 Ld = normalize(vec2(0.62, 0.5));
    float lit = sstep(-0.4, 0.9, dot(normalize(ds + vec2(1e-5)), Ld));
    vec2 seen = uCenter + (dr.xy * 0.55 - (d / wob) * (0.55 + 0.25 * nz)) * uRadius;   // the orb behind it, upside down
    vec3 c = galaxyAt(seen) * 0.45 + col * 0.25;   // dark glass, as the picture's droplets
    c *= 0.5 + 0.5 * nz;
    c = mix(c, vec3(0.0, 0.004, 0.012), sstep(0.76, 0.9, dl) * (1.0 - sstep(0.94, 0.985, dl)) * 0.3);   // the dark band
    c += vec3(0.8, 0.9, 1.0) * sstep(0.92, 0.98, dl) * (0.3 + 0.9 * lit);                               // the bright rim
    c += vec3(1.0) * pow(max(dot(N, normalize(vec3(0.62, 0.5, 0.6) + vec3(0.0, 0.0, 1.0))), 0.0), 420.0) * 3.5;   // the glint
    vec2 fc = -Ld * 0.5;
    c += vec3(1.0, 0.85, 0.6) * exp(-dot(ds - fc, ds - fc) * 16.0) * 0.45;                             // light come through
    if (j == 0) c += vec3(1.0, 0.68, 0.28) * uFlare * (0.4 + 0.3 * sin(uTime * 4.0)) * (1.0 - nz);
    float inside = sstep(1.0 + aa * 0.5, 1.0 - aa * 0.5, dl) * seenAmt;
    col = mix(col, c, inside);
    dropA = max(dropA, inside * (0.55 + 0.4 * sstep(0.85, 0.98, dl)));
  }
  return col;
}

// Sparks falling into the core along the arms (the arms wind outward clockwise and the galaxy
// turns counter-clockwise, so they spiral in counter-clockwise), faster and hotter as they fall.
// While speaking the same sparks run the other way: out from the core along the arms.
vec3 infall(vec2 p) {
  if (length(p) > 0.95) return vec3(0.0);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 40; i++) {
    float fi = float(i);
    float on = clamp(uInfallCount - fi, 0.0, 1.0);
    if (on <= 0.0) break;
    float h1 = hash(vec2(fi, 1.31)), h2 = hash(vec2(fi, 7.13)), h3 = hash(vec2(fi, 3.77));
    float l = fract(uInfallT * (0.55 + 0.6 * h1) + h2);
    float best = 1e3, bl = l;
    vec2 prev = vec2(0.0);
    for (int k = 0; k < 6; k++) {
      float lk = clamp(l - float(k) * 0.018 * uInfallDir, 0.0, 1.0);
      float rr = 0.035 + 0.82 * (1.0 - lk * lk);
      float a = h3 * 6.2832 + uSpin - 2.4 * log(rr / 0.855);
      vec2 q = rr * vec2(cos(a), sin(a));
      if (k > 0) { float d = segDist(p, prev, q); if (d < best) { best = d; bl = lk; } }
      prev = q;
    }
    float w = uPx * mix(1.6, 1.3, -uBias / 0.55);   // wider on a small orb, so the sparks glide rather than flicker
    float tail = 1.0 - clamp(abs(l - bl) / 0.09, 0.0, 1.0);
    float life = sstep(0.0, 0.15, l) * (1.0 - sstep(0.88, 1.0, l));
    vec3 c = mix(vec3(0.45, 0.7, 1.0), vec3(0.92, 0.96, 1.0), l);   // blue-white: the gold is the picture's
    acc += c * (exp(-best * best / (w * w)) + 0.12 * exp(-best * best / (w * w * 14.0))) * tail * life * (0.5 + 1.6 * l) * on;
  }
  return acc * uInfallAmt * 0.6 * (1.0 + 1.5 * uVoiceIn);
}

vec3 sparks(vec2 p) {
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 q = p * (7.0 + fk * 5.0) + vec2(fk * 13.1, fk * 7.7) + vec2(0.12 * sin(uTime * 0.05 + fk * 2.0), -uTime * 0.05 * (fk + 1.0));   // a slow drift, no spin
    vec2 cell = floor(q);
    float h = hash(cell + fk * 3.3);
    if (h > 0.9) {
      vec2 off = vec2(hash(cell + 1.7), hash(cell + 4.1)) - 0.5;
      float d = length(fract(q) - 0.5 - off * 0.6);
      float tw = pow(0.5 + 0.5 * sin(uTime * (1.5 + h * 3.0) + h * 30.0), 3.0);
      acc += vec3(1.0, 0.6, 0.25) * sstep(0.06 + 0.03 * fk, 0.0, d) * tw * (1.0 - 0.25 * fk);
    }
  }
  float r = length(p);
  return acc * uSparks * sstep(2.0, 1.25, r) * sstep(0.7, 1.05, r);
}

void main() {
  // The orb centred in the canvas, and the whole symbol turning: galaxy, glass, orbit lines and
  // droplets all live in its frame (rot(a) turns a point by -a, so this samples the turned symbol).
  vec2 vuv = vUv + uJitter;
  vec2 ps = (vuv - 0.5) / uZoom / uRadius;                 // on the screen (orb units): the background stays still
  vec2 uv = uCenter + rot(uTurn) * ((vuv - 0.5) / uZoom);
  vec2 p = (uv - uCenter) / uRadius;
  float r = length(p);
  const float still = 0.0;

  // The glass, drifting a degree or two on its own (round the sphere's centre) and breathing a
  // little in scale. Its height (its brightness, blurred) bends whatever is behind it.
  // The glass is the vessel: it holds still (James: "it should stay stagnant, like it's containing
  // something swirling inside"); only what is inside it turns.
  const float ga = 0.0, gs = 1.0;
  vec2 guv = uCenter + rot(ga) * (uv - uCenter) / gs;
  float cover; vec3 tint;
  vec3 glass = glassAt(guv, cover, tint) * uGlassAmt * plateEdge(guv);
  cover *= plateEdge(guv);
  tint = mix(vec3(1.0), tint, uGlassAmt);
  const float e = 0.006;                                   // a smooth lens: coherent bending, no smear
  float hx = lum(textureLod(uRef, guv + vec2(e, 0.0), 4.0).rgb) - lum(textureLod(uRef, guv - vec2(e, 0.0), 4.0).rgb);
  float hy = lum(textureLod(uRef, guv + vec2(0.0, e), 4.0).rgb) - lum(textureLod(uRef, guv - vec2(0.0, e), 4.0).rgb);
  vec2 bend = vec2(hx, hy) * 0.006 * cover * (1.0 - still);   // slight: the picture's refraction is painted in   // what turns inside bends as it passes behind the glass

  // Behind the glass: the galaxy, turning and flowing, bent by it.
  // Where the glass is bright enough to be opaque, the picture's own galaxy (what the glass was cut
  // from); elsewhere the turning one. A frozen fragment over a turned galaxy read as a double image.
  vec3 gal = mix(galaxyAt(uv - bend), galSample(uv), sstep(0.3, 0.8, lum(glass)));
  // On the page: the picture's dark space is cut away; only the orb (and what orbits it) stays.
  // A crisp cut-out (James: "sharpen the edges, it's about to go over the dark background"): the
  // sphere, and the glass ribbons wrapping it as the picture has them, inside one smooth outline
  // that runs just outside their rims (cutting the ribbons into pieces read as splashes: "make it
  // like this", his picture). Both edges are cut a pixel wide.
  float edgePx = clamp(uPx * 0.75, 0.0005, 0.02);
  float sphere = sstep(SPHERE + edgePx, SPHERE - edgePx, r);
  float mGlass = texture(uMask, guv).r;
  float mStep = max(fwidth(mGlass), 1e-4);   // how much the outline's value changes across a pixel
  float crisp = max(sphere, clamp((mGlass - 0.5) / mStep + 0.5, 0.0, 1.0));
  float keep = mix(crisp, sstep(1.5, 1.25, r), uAura);
  gal *= keep; glass *= keep; cover *= keep;
  const float T = 1.0;   // the glass's own darkening is in the picture already (as its tint)
  // The living centre. Gold filaments: specks twinkle, energy pulses run inward along them.
  float gold = clamp((gal.r - gal.b) * 2.0, 0.0, 1.0) * sstep(0.08, 0.5, lum(gal)) * (1.0 - still);
  float inward = pow(0.5 + 0.5 * sin(r * 20.0 + uFilT), 6.0) * sstep(0.95, 0.12, r) * uFilAmt * (1.0 + 1.5 * uVoiceIn) * mix(0.25, 0.5, uFine);
  // The gold flecks glow and fade in broad, slow patches (random per-frame twinkle read as static).
  float glow = noise(uv * 7.0 + vec2(uTime * 0.11, -uTime * 0.07)) * 0.6 + noise(uv * 13.0 - vec2(uTime * 0.05, uTime * 0.09)) * 0.4;
  gal *= 1.0 + gold * ((glow - 0.5) * 0.35 + inward * 1.1);
  // Waves of light (the pulse, the voice, entrances) running out through the arms, or in.
  float wave = 0.0, waveGlass = 0.0, beacon = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 wv = uWaves[i];
    if (wv.y <= 0.0) continue;
    if (wv.z < 0.5) {
      float dr = (r - wv.x) / 0.075;                   // squares written out: pow() of a negative is undefined on GPUs
      float ring = exp(-dr * dr) * wv.y;
      wave += ring * sstep(1.1, 0.6, r);
      waveGlass += ring * sstep(0.5, 0.8, r) * sstep(1.3, 1.05, r);
    } else {
      float b1 = (r - wv.x) / 0.022, b2 = (r - wv.x) / 0.12;
      beacon += (exp(-b1 * b1) + 0.25 * exp(-b2 * b2)) * wv.y * sstep(1.02, 1.18, r);
    }
  }
  wave *= 1.0 - still; waveGlass *= 1.0 - still; beacon *= 1.0 - still;
  // The blue is alive: light flows out along the arms all the time, and each heartbeat's ripple
  // lights the blue as it passes, so the core, the arms and the light beat together.
  float blue = clamp((gal.b - max(gal.r, gal.g * 0.85)) * 5.0, 0.0, 1.0) * sstep(0.015, 0.2, lum(gal)) * (1.0 - still);
  float arm = atan(p.y, p.x) - 2.4 * log(max(r, 0.03));   // the same along an arm, so waves follow the arms
  float stream = pow(0.5 + 0.5 * sin(7.0 * log(max(r, 0.03)) - uTime * 0.9 + 1.7 * sin(arm)), 3.0) * sstep(1.05, 0.25, r);
  gal *= 1.0 + wave * (0.15 + 0.8 * blue) + blue * stream * 0.15;
  // Sparks spiralling down the arms into the core.
  gal += infall(p) * uSparks * mix(0.5, 0.6, uFine) * (1.0 - still);
  float b = breathing();
  float ct = uCoreTight;
  gal += vec3(1.0, 0.45, 0.12) * exp(-r * r * 70.0 * ct) * 0.12 * (b - 0.85) * uCoreGain * (1.0 - still);
  gal += vec3(1.0, 0.82, 0.6) * exp(-r * r * 320.0 * ct) * 0.4 * (b - 0.85) * uCoreGain * (1.0 - still);
  gal += vec3(1.0, 0.9, 0.75) * exp(-r * r * 120.0 * ct) * 0.35 * max(uCoreGain - 1.0, 0.0) * (1.0 - still);   // running hot
  gal = mix(gal, gal * vec3(1.3, 0.95, 0.65), uWarm * 0.45);
  gal = mix(gal, gal * vec3(0.82, 1.02, 1.45), uCool * 0.4);   // thinking: the arms run electric

  vec3 col = gal * T * tint;

  // Far halves of the orbit lines and far droplets sit behind the glass.
  float z;
  for (int i = 0; i < 3; i++) { float l = ringLine(i, p, z); if (z < 0.0) col += vec3(1.0, 0.55, 0.2) * l * 0.45 * mix(0.06, 1.0, sstep(0.97, 1.08, r)) * (1.0 - still); }   // behind the sphere: hidden
  if (still < 0.5) col = droplets(col, p, -1.0);

  // The glass itself: its own light, a slow sweep travelling across it, light running along its
  // gold edges.
  vec3 gp = max(glass, 0.0);
  float goldEdge = clamp((gp.r - gp.b) / max(lum(gp), 0.02) - 0.45, 0.0, 1.0) * sstep(0.12, 0.5, lum(gp));
  float ang = atan(p.y, p.x);
  float run = pow(0.5 + 0.5 * sin(ang * 2.0 - uTime * 0.9 + r * 6.0), 24.0);
  vec2 dir = normalize(vec2(cos(uSweepT * 0.07), sin(uSweepT * 0.07)));
  float sw = (dot(p, dir) - (fract(uSweepT * 0.055) * 3.6 - 1.8)) / 0.22;
  float sweep = exp(-sw * sw) * uSweep;
  col += glass + gp * goldEdge * 0.08;   // the picture's glass, its gold edges a touch brighter
  // Light reflecting off the glass: a fixed key light (upper left) and a warm rim light (lower
  // right). The glass's surface turns with the symbol, so its highlights glide over the ribbons.
  vec2 nSym = -vec2(hx, hy) * 7.0;
  vec3 Ns = normalize(vec3(rot(-uTurn) * nSym, 1.0));   // its surface, as the screen sees it
  float shine = cover * sstep(0.02, 0.2, lum(gp)) * (1.0 - still);
  vec3 Hkey = normalize(normalize(vec3(0.62, 0.5, 0.6)) + vec3(0.0, 0.0, 1.0));     // the key light, upper right
  vec3 Hrim = normalize(normalize(vec3(-0.7, -0.45, 0.45)) + vec3(0.0, 0.0, 1.0));  // a warm fill, lower left
  col += vec3(1.0, 0.97, 0.9) * pow(max(dot(Ns, Hkey), 0.0), 40.0) * 0.15 * shine;
  col += vec3(1.0, 0.66, 0.3) * pow(max(dot(Ns, Hrim), 0.0), 22.0) * 0.06 * shine;
  col += gp * (goldEdge * (run * 0.3 + waveGlass * 1.0 + uVoice * uVoiceGlass) + sweep * 0.25 + waveGlass * 0.2) * (1.0 - still);
  // Light and shadow (James's mockup: "dark areas, shadowing, depth"), gentle: the picture has its
  // own, and more buried the glass's detail ("there's no detailing"). A warm key light from the
  // upper right; the far side a little darker; a gold rim light on the lit edge.
  {
    float rv = length(ps);
    vec3 Nb = vec3(ps / 1.12, sqrt(max(0.0, 1.0 - dot(ps, ps) / (1.12 * 1.12))));   // the vessel, as a ball
    vec3 Lk = normalize(vec3(0.62, 0.5, 0.6));
    float facing = max(dot(Nb, Lk), 0.0);
    float inVessel = sstep(1.24, 1.06, rv) * (1.0 - still);
    col *= mix(1.0, mix(0.97, 1.02, pow(facing, 0.8)), inVessel);   // a whisper: the picture's light is painted in
    // The gold band's shadow on the sphere, cast away from the light.
    float zb;
    float bandShadow = ringNear(0, p + normalize(Lk.xy) * 0.07, zb);
    col *= 1.0 - 0.35 * bandShadow * step(0.0, zb) * sstep(1.0, 0.9, r) * (1.0 - still);
  }
  // On a call: a warm halo round the orb. Unread: gold beacon rings going out.
  col += vec3(1.0, 0.6, 0.25) * exp(-max(r - 1.12, 0.0) * 5.0) * sstep(1.0, 1.15, r) * 0.12 * uHalo * (1.0 - still);
  col += vec3(1.0, 0.64, 0.28) * beacon * 0.45;

  // In front: near orbit lines, near droplets and their strings, sparks.
  if (still < 0.5) {
    for (int i = 0; i < 3; i++) { float l = ringLine(i, p, z); if (z >= 0.0) col += vec3(1.0, 0.58, 0.22) * l; }
    col = droplets(col, p, 1.0);
    col += sparks(ps) * 0.12;   // a few faint stars only: the dust read as fuzz round the outline
  }
  col *= uDim * mix(0.5, 1.0, sstep(2.4, 1.35, r));      // deep corners: the eye stays on the orb
  col = max(col, 0.0);
  // How solid this pixel must be over the page (light adds its own, in the final pass): the
  // sphere is solid, the glass a light smoky veil, the droplets mostly clear.
  // Solid inside the whole outline, the glass and the dark between it as the picture has them
  // (James: "they're still faded out ... make none of this transparent right now").
  float body = crisp;
  float aura = uAura * sstep(1.5, 1.18, r);   // its own dark space, feathered into the page
  // 'glow': the glass is smoky (dark like the picture's, still see-through), and the orb's blue and
  // gold light tints the page round it, breathing with the heartbeat, as a lamp lights a desk.
  // The veil is where the glass itself is (its light), not over the picture's dark space between
  // the ribbons, which read as smoky patches with a hard edge.
  float smoke = mix(0.3, 0.62, uGlow) * sstep(0.01, 0.06, lum(glass));
  float spill = 0.0;   // (a light tint on the page round it read as a blur round the outline)
  vec3 spillCol = mix(vec3(0.25, 0.48, 1.0), vec3(1.0, 0.62, 0.25), 0.35 + 0.25 * sin(atan(ps.y, ps.x) * 2.0 + uTime * 0.2));
  col += spillCol * spill;
  outColor = vec4(col, max(max(max(body, aura), spill), max(cover * smoke, dropA)));
}`;

// Bloom: only light brighter than the picture's own whites adds glow (the painting has its glow
// already); blurred at two sizes.
const BRIGHT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uSrc; uniform float uThreshold;
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = clamp((l - uThreshold) / 0.35, 0.0, 1.0);
  outColor = vec4(c * k * k, 1.0);
}`;
const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uSrc; uniform vec2 uDir;
void main() {
  vec3 c = texture(uSrc, vUv).rgb * 0.227027;
  c += texture(uSrc, vUv + uDir * 1.3846).rgb * 0.316216; c += texture(uSrc, vUv - uDir * 1.3846).rgb * 0.316216;
  c += texture(uSrc, vUv + uDir * 3.2308).rgb * 0.070270; c += texture(uSrc, vUv - uDir * 3.2308).rgb * 0.070270;
  outColor = vec4(c, 1.0);
}`;
// Temporal anti-aliasing (as shader packs do): each frame is blended with the last ones, which are
// first turned by exactly how far the symbol turned, then held within this frame's neighbourhood
// (so moving droplets leave no trails). Fine detail stops crawling and flickering; light glides.
const TAA_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uCur, uHist; uniform vec2 uTexel; uniform float uTurnStep, uKeep;
// The history is read with a sharp (Catmull-Rom) filter: a plain blend, repeated every frame as
// the history turns, would blur it more and more.
vec4 catmullRom(sampler2D tex, vec2 uv) {
  vec2 size = 1.0 / uTexel, pos = uv * size, t1 = floor(pos - 0.5) + 0.5, f = pos - t1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2, t0 = (t1 - 1.0) * uTexel, t3 = (t1 + 2.0) * uTexel, t12 = (t1 + w2 / w12) * uTexel;
  return texture(tex, vec2(t0.x, t0.y)) * w0.x * w0.y + texture(tex, vec2(t12.x, t0.y)) * w12.x * w0.y + texture(tex, vec2(t3.x, t0.y)) * w3.x * w0.y
       + texture(tex, vec2(t0.x, t12.y)) * w0.x * w12.y + texture(tex, vec2(t12.x, t12.y)) * w12.x * w12.y + texture(tex, vec2(t3.x, t12.y)) * w3.x * w12.y
       + texture(tex, vec2(t0.x, t3.y)) * w0.x * w3.y + texture(tex, vec2(t12.x, t3.y)) * w12.x * w3.y + texture(tex, vec2(t3.x, t3.y)) * w3.x * w3.y;
}
void main() {
  vec4 c = texture(uCur, vUv), lo = c, hi = c;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec4 n = texture(uCur, vUv + vec2(float(x), float(y)) * uTexel);
    lo = min(lo, n); hi = max(hi, n);
  }
  vec2 q = vUv - 0.5;                                      // the orb turns about the canvas's centre
  float cs = cos(uTurnStep), sn = sin(uTurnStep);
  vec2 prev = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y) + 0.5;   // where this point was a frame ago
  vec4 h = max(min(catmullRom(uHist, prev), hi), lo);
  if (any(isnan(h))) h = c;   // a bad value never lives on in the history
  float keep = (prev.x < 0.0 || prev.y < 0.0 || prev.x > 1.0 || prev.y > 1.0) ? 0.0 : uKeep;
  outColor = mix(c, h, keep);
}`;
const COPY_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uSharp;
void main() {
  vec4 c = texture(uSrc, vUv);
  vec4 around = (texture(uSrc, vUv + vec2(uTexel.x, 0.0)) + texture(uSrc, vUv - vec2(uTexel.x, 0.0))
               + texture(uSrc, vUv + vec2(0.0, uTexel.y)) + texture(uSrc, vUv - vec2(0.0, uTexel.y))) * 0.25;
  vec4 o = c + (c - around) * uSharp;
  o.a = clamp(o.a, 0.0, 1.0);
  outColor = vec4(clamp(o.rgb, 0.0, o.a), o.a);   // still premultiplied
}`;
// Sub-pixel offsets that cover a pixel evenly over 8 frames (Halton 2, 3).
const JITTER = Array.from({length: 8}, (_, i) => {
  const halton = (n, b) => { let f = 1, r = 0; for (n += 1; n > 0; n = Math.floor(n / b)) { f /= b; r += f * (n % b); } return r; };
  return [halton(i, 2) - 0.5, halton(i, 3) - 0.5];
});

// Tone: the picture's colours pass through unchanged up to 0.8; only light beyond it rolls off
// softly. Then the exact sRGB curve, so a still frame matches the reference. Then a fine
// sharpening (in display space, so bright light gets no dark rings).
const FINAL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uScene, uBloomA; uniform float uBloom, uTime, uSharp, uSS; uniform vec2 uTexel;
float hash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
vec3 shoulder(vec3 c) { const float k = 0.8; return mix(c, k + (1.0 - k) * (1.0 - exp(-(c - k) / (1.0 - k))), step(k, c)); }
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 disp(vec3 c) { return srgb(clamp(shoulder(c), 0.0, 1.0)); }
float sstep(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
void main() {
  vec3 s0 = texture(uScene, vUv).rgb;   // .a: how solid the scene asks this pixel to be
  vec3 bloom = texture(uBloomA, vUv).rgb * 0.06 * uBloom;   // a tight glow on the very brightest points: more hazed the outline
  vec3 around = (disp(texture(uScene, vUv + uTexel).rgb) + disp(texture(uScene, vUv - uTexel).rgb)
               + disp(texture(uScene, vUv + vec2(uTexel.x, -uTexel.y)).rgb) + disp(texture(uScene, vUv + vec2(-uTexel.x, uTexel.y)).rgb)) * 0.25;
  // A 2x scene is shrunk in display space (the four 2x texels of this pixel, averaged after the
  // tone curve), as a picture viewer shrinks a picture; light averaged first reads as fog.
  vec2 hq = uTexel * 0.25;
  vec3 d0 = uSS > 1.5
    ? (disp(texture(uScene, vUv + vec2(-hq.x, -hq.y)).rgb) + disp(texture(uScene, vUv + vec2(hq.x, -hq.y)).rgb)
     + disp(texture(uScene, vUv + vec2(-hq.x, hq.y)).rgb) + disp(texture(uScene, vUv + vec2(hq.x, hq.y)).rgb)) * 0.25
    : disp(s0);
  vec3 c = clamp(d0 + (disp(s0 + bloom) - disp(s0)) + clamp((d0 - around) * uSharp, -0.05, 0.05), 0.0, 1.0);
  // Over the page: as solid as the scene asks (the sphere, the glass veil, droplets), and light
  // as solid as it is bright, so gold lines and sparks sit on the page and its dark space is gone.
  // Premultiplied: over black this is exactly the picture.
  // Faint haze (bloom, the glass's soft light) stays light only, so it never fogs the page.
  float m = max(c.r, max(c.g, c.b));
  float a = clamp(max(texture(uScene, vUv).a, sstep(0.12, 0.75, m)), 0.0, 1.0);
  c *= min(1.0, a / max(m, 1e-4));
  c = clamp(c + (hash(gl_FragCoord.xy) - 0.5) / 255.0 * a, 0.0, a);   // a still dither: one that changes each frame is noise
  outColor = vec4(c, a);
}`;

// Each state's character. Everything eases between states over about half a second.
//   idle      calm: slow turn, a slow heartbeat, a few sparks drifting down into the core.
//   thinking  concentrating: the galaxy spins up and winds tighter, the core contracts and runs
//             hot, sparks pour in as a stream, energy races inward along the filaments, droplets
//             speed up on tighter orbits, light scans across the glass. Enters with an implosion.
//   speaking  projecting: the energy reverses, sparks stream OUT along the arms; every syllable
//             flares the core and sends a wave of light out through the arms and the glass edges;
//             the gold strings tremble with the voice. Enters with a flash.
//   listening on a call, waiting for James: quieter, warm, a warm halo, the orb gently breathing.
//   hearing   on a call, James talking: his voice draws waves of light IN toward the core, sparks
//             surge inward with it, the filaments brighten. The orb is taking it in.
//   call      on a call otherwise: warm, a warm halo.
//   unread    a reply is waiting: gold beacon rings go out from the orb with each heartbeat, the
//             largest droplet glows gold, the strings brighten. Enters with a ping.
const STATES = {
  idle:      { turn: 1.0, cool: 0.0,spin: 1.0, flow: 1.0, wind: 0.0,   pulse: 1.0,  beat: 0.8,  infall: 1.0, dir: 1,  count: 18, sparkAmt: 1.0, core: 1.0,  tight: 1.0,  fil: 1.0, filAmt: 1.0, glass: 1.0, sweep: 1.0, sweepRate: 1.0, orbit: 1.0, orbitR: 1.0,  strings: 1.0, warm: 0.0,  flare: 0.0, halo: 0.0, dim: 1.0,  scale: 0.0,   vCore: 1.0,  vIn: 0.0, vGlass: 0.5, vWave: 0,  ping: 0, breath: 0.8, sparks: 1.0},
  thinking:  { turn: 1.7, cool: 0.7,spin: 3.5, flow: 2.4, wind: 0.22,  pulse: 1.8,  beat: 0.35, infall: 2.6, dir: 1,  count: 24, sparkAmt: 1.25, core: 1.35, tight: 1.7,  fil: 1.7, filAmt: 1.8, glass: 1.3, sweep: 1.5, sweepRate: 1.7, orbit: 1.4, orbitR: 0.95, strings: 1.5, warm: 0.0,  flare: 0.0, halo: 0.0, dim: 1.0,  scale: 0.0,   vCore: 1.0,  vIn: 0.0, vGlass: 0.5, vWave: 0,  ping: 0, breath: 0.8, sparks: 1.1},
  speaking:  { turn: 1.4, cool: 0.0,spin: 1.5, flow: 1.3, wind: -0.08, pulse: 0.6,  beat: 0.25, infall: 1.5, dir: -1, count: 30, sparkAmt: 1.5, core: 1.1,  tight: 0.85, fil: 1.4, filAmt: 1.3, glass: 1.3, sweep: 1.2, sweepRate: 1.4, orbit: 1.3, orbitR: 1.03, strings: 1.4, warm: 0.12, flare: 0.0, halo: 0.0, dim: 1.0,  scale: 0.0,   vCore: 1.0,  vIn: 0.0, vGlass: 1.2, vWave: 1,  ping: 0, breath: 1.0, sparks: 1.2},
  listening: { turn: 0.7, cool: 0.0,spin: 0.8, flow: 0.8, wind: 0.0,   pulse: 0.85, beat: 0.6,  infall: 0.8, dir: 1,  count: 14, sparkAmt: 0.9, core: 0.95, tight: 1.1,  fil: 0.8, filAmt: 0.8, glass: 0.8, sweep: 0.8, sweepRate: 0.8, orbit: 0.8, orbitR: 0.98, strings: 1.1, warm: 0.8,  flare: 0.0, halo: 0.7, dim: 0.94, scale: 0.012, vCore: 0.3,  vIn: 1.0, vGlass: 0.5, vWave: -1, ping: 0, breath: 0.8, sparks: 1.0},
  hearing:   { turn: 1.0, cool: 0.0,spin: 1.0, flow: 1.0, wind: 0.1,   pulse: 0.7,  beat: 0.3,  infall: 1.8, dir: 1,  count: 30, sparkAmt: 1.4, core: 1.1,  tight: 1.3,  fil: 1.8, filAmt: 1.5, glass: 1.0, sweep: 1.0, sweepRate: 1.0, orbit: 1.0, orbitR: 0.97, strings: 1.2, warm: 0.8,  flare: 0.0, halo: 0.9, dim: 1.0,  scale: 0.006, vCore: 0.35, vIn: 1.0, vGlass: 0.8, vWave: -1, ping: 0, breath: 0.8, sparks: 1.1},
  call:      { turn: 0.9, cool: 0.0,spin: 1.0, flow: 1.0, wind: 0.0,   pulse: 0.9,  beat: 0.7,  infall: 1.0, dir: 1,  count: 18, sparkAmt: 1.0, core: 1.0,  tight: 1.0,  fil: 1.0, filAmt: 1.0, glass: 1.0, sweep: 1.0, sweepRate: 1.0, orbit: 1.0, orbitR: 1.0,  strings: 1.1, warm: 1.0,  flare: 0.0, halo: 0.8, dim: 1.0,  scale: 0.008, vCore: 1.0,  vIn: 0.0, vGlass: 0.8, vWave: 1,  ping: 0, breath: 0.9, sparks: 1.15},
  unread:    { turn: 1.25, cool: 0.0,spin: 1.0, flow: 1.0, wind: 0.0,   pulse: 1.3,  beat: 0.9,  infall: 1.0, dir: 1,  count: 18, sparkAmt: 1.0, core: 1.05, tight: 1.0,  fil: 1.0, filAmt: 1.0, glass: 1.0, sweep: 1.0, sweepRate: 1.0, orbit: 1.0, orbitR: 1.0,  strings: 1.4, warm: 0.0,  flare: 1.0, halo: 0.0, dim: 1.0,  scale: 0.0,   vCore: 1.0,  vIn: 0.0, vGlass: 0.5, vWave: 0,  ping: 1, breath: 0.8, sparks: 1.0},
};
// How each state makes its entrance: waves (kind 0 through the galaxy, 1 a beacon outside;
// speed > 0 out, < 0 in) and a flash of the core.
const ENTRANCES = {
  thinking:  {waves: [{r: 1.15, amp: 1.2, kind: 0, speed: -1.4}], kick: 0.15},
  speaking:  {waves: [{r: 0.0, amp: 1.1, kind: 0, speed: 1.2}], kick: 0.9},
  listening: {waves: [{r: 0.0, amp: 0.5, kind: 0, speed: 0.9}], kick: 0.1},
  hearing:   {waves: [{r: 1.15, amp: 0.7, kind: 0, speed: -1.1}], kick: 0.0},
  call:      {waves: [{r: 0.0, amp: 0.6, kind: 0, speed: 0.9}], kick: 0.3},
  unread:    {waves: [{r: 1.05, amp: 1.3, kind: 1, speed: 0.9}, {r: 0.0, amp: 0.6, kind: 0, speed: 1.0}], kick: 0.5},
};
const PULSE_S = 3.4;   // seconds between heartbeats at rest
const TURN_RATE = 0.12;   // the whole symbol's turn at rest, radians a second (one turn in about 52 s)

function rotation(x, y, z) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  const m = [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx, sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx, -sy, cy * sx, cy * cx];
  return v => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
// Orbits in orb units (the galaxy's radius is 1; the glass reaches about 1.15).
const RINGS = [   // radius is scaled by the state's orbitR
  {radius: 1.2, tilt: [0.38, 0.0, 0.32], precess: 0.12, rate: 0.03},    // the wrapping ring: in front below, behind above
  {radius: 1.32, tilt: [0.95, 0.0, -0.9], precess: 0.12, rate: 0.03},
  {radius: 1.44, tilt: [0.62, 0.0, 1.45], precess: 0.12, rate: 0.03},
];
const DROPS = [
  {ring: 0, phase: 0.6, speed: 0.06, radius: 0.16},     // the largest: in front of the sphere, then behind it
  {ring: 0, phase: 3.4, speed: 0.06, radius: 0.045},
  {ring: 1, phase: 1.9, speed: 0.045, radius: 0.06},
  {ring: 1, phase: 4.8, speed: 0.045, radius: 0.04},
  {ring: 2, phase: 0.2, speed: 0.035, radius: 0.055},
  {ring: 2, phase: 3.0, speed: 0.035, radius: 0.035},
  {ring: 0, phase: 5.2, speed: 0.06, radius: 0.05},
];
// Where the reference has droplets painted in (uv, y up, radius): cut out, the live ones replace them.
// The fill direction (+1/-1) is chosen so no hole copies another painted droplet.
const HOLES = [
  [0.173, 0.797, 0.028, 1], [0.836, 0.770, 0.022, -1], [0.886, 0.682, 0.017, 1], [0.802, 0.264, 0.068, -1],
  [0.214, 0.204, 0.027, 1], [0.632, 0.103, 0.032, 1], [0.092, 0.672, 0.01, 1],
];


const PICTURES = window.MERIDIAN_ORB_PICTURES   // Connect: data URLs (orb-pictures.js), see the note at the top
  ? [window.MERIDIAN_ORB_PICTURES.picture, window.MERIDIAN_ORB_PICTURES.galaxy, window.MERIDIAN_ORB_PICTURES.glass]
  : [new URL('orb/orb-picture.jpg', document.baseURI).href, new URL('orb/orb-galaxy.jpg', document.baseURI).href, new URL('orb/orb-glass.png', document.baseURI).href];   // where the glass pieces are (lab/mask)
const CENTER = [0.510, 0.552], RADIUS = 0.35;   // the galaxy's centre and radius in the pictures
const TAU = Math.PI * 2, WRAP = 7200;   // clocks sent to the GPU wrap (a two-hourly blip) so float precision holds

// Waves of light: each moves and fades; finished ones go; at most six at once.
function stepWaves(waves, dt) {
  return waves.map(w => ({...w, r: w.r + w.speed * dt, amp: w.amp * Math.exp(-dt * 0.5)}))
    .filter(w => w.amp > 0.02 && (w.kind ? w.r < 2.4 : w.r > -0.05 && w.r < 1.35)).slice(-6);
}
// The heartbeat: a slow double pulse; s is seconds into the beat.
function heartbeat(s) {
  return Math.exp(-(((s - 0.15) / 0.1) ** 2)) + 0.55 * Math.exp(-(((s - 0.45) / 0.12) ** 2));
}
// A syllable starts when the level jumps well above its slow average (not more than ~6 a second).
function isOnset(level, slow, sinceLast) { return level > 0.25 && level - slow > 0.16 && sinceLast > 0.16; }
// How loud some audio is (time-domain samples, -1..1), as 0..1 for the orb.
function levelFromSamples(samples) {
  let sum = 0;
  for (const x of samples) sum += x * x;
  return Math.min(1, Math.sqrt(sum / Math.max(1, samples.length)) / 0.16);
}
// Anything the console asks for that the orb does not know reads as idle.
function stateLook(name) { return Object.hasOwn(STATES, name) ? name : 'idle'; }

let motionQuery = null;
function prefersStill() {
  try {
    motionQuery ??= matchMedia('(prefers-reduced-motion: reduce)');
    return document.body.classList.contains('reduced-motion') || motionQuery.matches;
  } catch { return false; }
}
let picturesOnce = null;   // the pictures load once per page, however often the orb is rebuilt
function pictures() {
  picturesOnce ??= Promise.all(PICTURES.map(loadImage)).catch(error => { picturesOnce = null; throw error; });
  return picturesOnce;
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im); im.onerror = () => reject(new Error(`could not load ${src}`));
    im.src = src;
  });
}

// The WebGL side. Throws if anything cannot be set up (the caller keeps the particles then).
function createEngine(canvas, [pictureImg, galaxyImg, glassImg], zoom, aura, glowOn, maxDpr = 2) {
  const gl = canvas.getContext('webgl2', {antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: true, powerPreference: 'low-power'});   // software graphics: particles instead
  if (!gl) throw new Error('WebGL 2 is not available');
  // Light is kept in half floats where the GPU can draw into them; otherwise 8-bit sRGB (never
  // 8-bit linear, which bands in the navy).
  const half = gl.getExtension('EXT_color_buffer_float') ? gl.RGBA16F : gl.SRGB8_ALPHA8;
  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader error');
    return s;
  };
  const vert = compile(gl.VERTEX_SHADER, FULL_VERT);
  const program = frag => {
    const p = gl.createProgram(); gl.attachShader(p, vert); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link error');
    const loc = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); loc[name] = gl.getUniformLocation(p, name); }
    return {p, loc};
  };
  const scene = program(SCENE_FRAG), bright = program(BRIGHT_FRAG), blur = program(BLUR_FRAG), final = program(FINAL_FRAG);
  const taa = program(TAA_FRAG), copy = program(COPY_FRAG);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  // format: sRGB for the pictures (read as linear light); plain for the outline (its values are
  // levels, not light, and are taken as they are).
  const texture = (image, format = gl.SRGB8_ALPHA8) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, format === gl.SRGB8_ALPHA8 ? gl.BROWSER_DEFAULT_WEBGL : gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return t;
  };
  const refTex = texture(pictureImg), galTex = texture(galaxyImg), glassTex = texture(glassImg, gl.RGBA8);
  const err = gl.getError();
  if (err !== gl.NO_ERROR) throw new Error(`WebGL error ${err}`);

  const targets = {};
  const target = (name, w, h) => {
    let t = targets[name];
    if (t && t.w === w && t.h === h) return t;
    if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, half, w, h, 0, gl.RGBA, half === gl.RGBA16F ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`cannot draw into ${name}`);
    targets[name] = t = {tex, fb, w, h};
    if (name === 'histA' || name === 'histB') histValid = false;   // a new size: start the history again
    return t;
  };
  const pass = (pr, out, w, h, bind) => {
    gl.useProgram(pr.p); gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null); gl.viewport(0, 0, w, h);
    bind(pr.loc); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const tex = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };

  let stateName = 'idle', want = {...STATES.idle}, cur = {...STATES.idle}, checked = false;
  let histValid = false, histFlip = false, frameNo = 0, lastTurn = null;   // the temporal pass's memory
  let voice = 0, voiceSlow = 0, lastOnset = 0, kick = 0, waves = [];
  // The galaxy starts as the picture has it, its arms flowing into the glass.
  let t = Math.random() * 40, turn = 0, spin = 0, twistT = t, infallT = t * 0.12, filT = 0, sweepT = t, beatT = 0, glassT = t, orbitT = t;
  const holes = HOLES.flat();

  function enter(name) {
    stateName = name; want = {...STATES[name]};
    const entrance = ENTRANCES[name];
    if (entrance) { waves.push(...entrance.waves.map(w => ({...w}))); kick = Math.max(kick, entrance.kick); }
  }

  // One frame. still: show the state's look at once, with nothing moving (reduced motion).
  function draw(dt, askedState, level, still) {
    const name = stateLook(askedState);
    if (name !== stateName) enter(name);
    const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round((canvas.clientWidth || canvas.width) * dpr));
    const h = Math.max(2, Math.round((canvas.clientHeight || canvas.height) * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const target_ = Math.max(0, Math.min(1, Number(level) || 0));
    if (still) { dt = 0; cur = {...want}; waves = []; kick = 0; voice = voiceSlow = 0; }
    else {
      const k = Math.min(1, dt * 2.2);
      for (const key of Object.keys(cur)) cur[key] += (want[key] - cur[key]) * k;
      voice += (target_ - voice) * Math.min(1, dt * (target_ > voice ? 28 : 7));
      voiceSlow += (target_ - voiceSlow) * Math.min(1, dt * 1.6);
      if (want.vWave !== 0 && isOnset(target_, voiceSlow, t - lastOnset)) {
        lastOnset = t;
        const out = want.vWave > 0;
        waves.push({r: out ? 0.0 : 1.15, amp: 0.35 + 0.8 * target_, kind: 0, speed: out ? 1.25 : -1.3});
      }
      kick *= Math.exp(-dt / 0.45);
    }
    t += dt;
    // The vessel holds still (turn stays 0); the galaxy inside it turns, faster as the state asks.
    const spinBefore = spin;
    spin += dt * (0.012 * cur.spin + 0.6 * TURN_RATE * cur.turn);
    const spinStep = Math.min(0.03, spin - spinBefore);
    twistT += dt * cur.flow;
    infallT += dt * 0.11 * (cur.infall + 2.0 * voice * cur.vIn) * Math.sign(cur.dir || 1);
    filT += dt * 2.6 * cur.fil;
    sweepT += dt * cur.sweepRate;
    const prevBeat = beatT;
    beatT += dt * cur.pulse / PULSE_S;
    if (Math.floor(beatT) !== Math.floor(prevBeat)) {   // each heartbeat: a ripple out; unread: a beacon too
      waves.push({r: 0.0, amp: 0.55 * cur.beat * cur.breath, kind: 0, speed: 0.75});
      if (want.ping) waves.push({r: 1.05, amp: 1.0, kind: 1, speed: 0.8});
    }
    waves = stepWaves(waves, dt);
    const twist = 0.035 * Math.sin(twistT * 0.33) + 0.02 * Math.sin(twistT * 0.71 + 1) + cur.wind;
    const beat = heartbeat((beatT % 1) * PULSE_S) * cur.beat / 0.8 * (still ? 0 : 1);
    glassT += dt * cur.glass;
    orbitT += dt * cur.orbit;
    const zoomNow = zoom * (1 + cur.scale * Math.sin(t * 0.9) + 0.012 * voice * cur.vCore);
    // How much fine detail the screen can hold: 0 for a small orb (the sphere under ~250 px), 1 from ~600 px.
    const fine = Math.max(0, Math.min(1, (2 * RADIUS * zoomNow * Math.min(w, h) - 250) / 350));

    const ringU = [], ringV = [], basis = [];
    for (const rg of RINGS) {
      const R = rotation(rg.tilt[0], rg.tilt[1] + rg.precess * Math.sin(orbitT * rg.rate), rg.tilt[2]);
      const u = R([1, 0, 0]), v = R([0, 0, 1]);
      ringU.push(...u); ringV.push(...v); basis.push({u, v, r: rg.radius * cur.orbitR});
    }
    const drops = [], vels = [];
    DROPS.forEach((d, j) => {
      const {u, v, r} = basis[d.ring], way = Math.sign(u[0] * v[1] - u[1] * v[0]) || 1;
      const a = d.phase + orbitT * d.speed * way;
      const bob = 1 + 0.018 * Math.sin(t * 0.5 + j * 1.3);
      drops.push(...[0, 1, 2].map(i => r * bob * (u[i] * Math.cos(a) + v[i] * Math.sin(a))), d.radius);
      vels.push(d.ring, a, way, 0);
    });
    while (drops.length < 32) { drops.push(0, 0, 0, 0); vels.push(0, 0, 0, 0); }
    const wavesU = waves.flatMap(wv => [wv.r, wv.amp, wv.kind, 0]);
    while (wavesU.length < 24) wavesU.push(0, 0, 0, 0);

    // A small orb is drawn at twice its size and shrunk in the final pass (an even 2x2 average),
    // so it is sharp like a well-shrunk photo and does not shimmer as it turns.
    // A small orb is drawn at 2x and shrunk in display space in the final pass, as a picture viewer
    // shrinks a picture: shrinking it through the GPU's mipmaps (in linear light) lifted the darks
    // 70% and washed the blue (Fable, lab/REVIEW_ORB_MATCH.md 1: the fog).
    const ss = fine < 1 ? 2 : 1, sw = w * ss, sh = h * ss;
    const jitter = [0, 0];   // (no history to average jittered frames into: see the temporal pass below)
    const sceneT = target('scene', sw, sh);
    pass(scene, sceneT, sw, sh, L => {
      tex(0, refTex, L.uRef); tex(1, galTex, L.uGal); tex(2, glassTex, L.uMask);
      gl.uniform2f(L.uRes, sw, sh); gl.uniform1f(L.uAura, aura ? 1 : 0); gl.uniform1f(L.uGlow, glowOn ? 1 : 0); gl.uniform1f(L.uFine, fine);
      gl.uniform2f(L.uJitter, jitter[0] / w, jitter[1] / h);
      gl.uniform2f(L.uCenter, CENTER[0], CENTER[1]); gl.uniform1f(L.uRadius, RADIUS); gl.uniform1f(L.uZoom, zoomNow);
      gl.uniform1f(L.uTime, t % WRAP); gl.uniform1f(L.uSpin, spin % TAU); gl.uniform1f(L.uTurn, turn); gl.uniform1f(L.uSpinStep, spinStep); gl.uniform1f(L.uTwist, twist); gl.uniform1f(L.uInfallT, infallT % 720); gl.uniform1f(L.uGlassT, glassT % WRAP);
      gl.uniform1f(L.uBeat, beat); gl.uniform4fv(L.uWaves, wavesU); gl.uniform1f(L.uKick, kick);
      gl.uniform1f(L.uBreath, cur.breath); gl.uniform1f(L.uVoice, voice * cur.vCore);
      gl.uniform1f(L.uVoiceIn, voice * cur.vIn); gl.uniform1f(L.uVoiceGlass, cur.vGlass);
      gl.uniform1f(L.uInfallDir, Math.max(-1, Math.min(1, cur.dir))); gl.uniform1f(L.uInfallCount, cur.count); gl.uniform1f(L.uInfallAmt, cur.sparkAmt);
      gl.uniform1f(L.uCoreGain, cur.core); gl.uniform1f(L.uCoreTight, cur.tight); gl.uniform1f(L.uFilT, filT % (TAU * 100)); gl.uniform1f(L.uFilAmt, cur.filAmt);
      gl.uniform1f(L.uHalo, cur.halo); gl.uniform1f(L.uCool, cur.cool); gl.uniform1f(L.uDim, cur.dim); gl.uniform1f(L.uSweepT, sweepT % WRAP);
      gl.uniform1f(L.uWarm, cur.warm); gl.uniform1f(L.uFlare, cur.flare); gl.uniform1f(L.uSparks, cur.sparks);
      gl.uniform1f(L.uGlassAmt, 1); gl.uniform1f(L.uStrings, cur.strings); gl.uniform1f(L.uSweep, cur.sweep);
      gl.uniform1f(L.uPx, 1 / (h * RADIUS * zoomNow)); gl.uniform1f(L.uBias, -0.5);   // sharp at every size: the 2x scene and the jitter do the averaging
      gl.uniform4fv(L.uHole, holes);
      gl.uniform4fv(L.uDrop, drops); gl.uniform4fv(L.uDropVel, vels);
      gl.uniform3fv(L.uRingU, ringU); gl.uniform3fv(L.uRingV, ringV);
      gl.uniform3f(L.uRingR, basis[0].r, basis[1].r, basis[2].r);
    });
    const hw = Math.max(1, sw >> 1), hh = Math.max(1, sh >> 1);
    const brightT = target('bright', hw, hh), a1 = target('a1', hw, hh);
    pass(bright, brightT, hw, hh, L => { tex(0, sceneT.tex, L.uSrc); gl.uniform1f(L.uThreshold, 1.05); });
    pass(blur, a1, hw, hh, L => { tex(0, brightT.tex, L.uSrc); gl.uniform2f(L.uDir, 1 / hw, 0); });
    pass(blur, brightT, hw, hh, L => { tex(0, a1.tex, L.uSrc); gl.uniform2f(L.uDir, 0, 1 / hh); });
    const curT = target('cur', w, h);
    pass(final, curT, w, h, L => {
      tex(0, sceneT.tex, L.uScene); tex(1, brightT.tex, L.uBloomA);
      gl.uniform1f(L.uBloom, 1 + 0.6 * voice * cur.vCore + 0.8 * kick); gl.uniform1f(L.uTime, t % WRAP);
      gl.uniform1f(L.uSharp, 0.2 * fine); gl.uniform2f(L.uTexel, 1 / w, 1 / h); gl.uniform1f(L.uSS, ss);
    });
    // The temporal pass: blend with the history (turned by this frame's turn), then show it.
    const histPrev = target(histFlip ? 'histB' : 'histA', w, h), histNext = target(histFlip ? 'histA' : 'histB', w, h);
    const turnStep = lastTurn === null ? 0 : Math.atan2(Math.sin(turn - lastTurn), Math.cos(turn - lastTurn));
    pass(taa, histNext, w, h, L => {
      tex(0, curT.tex, L.uCur); tex(1, histPrev.tex, L.uHist); gl.uniform2f(L.uTexel, 1 / w, 1 / h);
      gl.uniform1f(L.uTurnStep, turnStep); gl.uniform1f(L.uKeep, 0);   // off: the 2x scene does the anti-shimmer work now, and the history cost a third of the detail (measured)
    });
    pass(copy, null, w, h, L => { tex(0, histNext.tex, L.uSrc); gl.uniform2f(L.uTexel, 1 / w, 1 / h); gl.uniform1f(L.uSharp, 0.0); });
    histValid = true; histFlip = !histFlip; lastTurn = turn;
    if (!checked) { checked = true; const error = gl.getError(); if (error !== gl.NO_ERROR) throw new Error(`WebGL error ${error}`); }
  }
  // Free the graphics memory now rather than whenever the page collects it.
  function dispose() { try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ } }
  return {draw, dispose};
}

// Calm states need fewer frames than busy ones.
const BUSY = new Set(['thinking', 'speaking', 'hearing']);

// Pacing (2026-10-18, James: "the orb does not move on every page"). A frame is due once the real time
// since the last one reaches the frame interval; only the step the motion takes is capped, so a long
// sleep can't make it jump. The cap used to be applied before this check: a capped 0.05 s never
// reached a 15 fps frame's 0.065 s, so every orb paced under 20 fps (the page orbs when calm, and any
// orb slowed on a struggling device) never drew another frame.
const MAX_STEP_S = 0.15;
function frameDue(elapsedS, rate) { return elapsedS >= 1 / rate - 0.002; }
function frameStep(elapsedS) { return Math.min(MAX_STEP_S, Math.max(0, elapsedS)); }

// Run the orb on the dock's canvas. getState() returns one of STATES' keys (anything else reads
// as idle); getVoice() returns the loudness now, 0..1 (the Overseer's voice while it speaks,
// James's on a call while it hears him). The canvas is bigger than the sphere (zoom 0.89: the
// sphere fills 62% of it) so droplets, gold lines and sparks spread onto the page around it.
// backdrop: 'page' (transparent: the page shows round the sphere and between the glass), 'aura'
// (the orb keeps a soft patch of its own dark space, so it looks like the picture, fading into the
// page) or 'glow' (no dark patch: smoky glass, and the orb's light tints the page round it).
// maxDpr: the most device pixels per CSS pixel to draw (a large orb passes 1: it is drawn at 2x below
// a sphere of 600 px anyway, and 2x of that again costs four times the frame).
function startOrb(canvas, getState, getVoice = () => 0, {zoom = 0.89, fps = 30, calmFps = 20, backdrop = 'page', maxDpr = 2} = {}) {
  const particlesOn = () => startParticleOrb(canvas, getState, {reach: 0.62});   // the sphere's share of the canvas
  let particles = particlesOn();   // at once, while the pictures load
  let engine = null, glCanvas = null, frame = 0, timer = 0, stopped = false, last = 0, stillShown = null;
  let slowAvg = 0, struggling = false;   // the device's measured pace
  let offscreen = false, seen = null;   // scrolled out of view (a sky orb above a long page): sleep
  const level = () => { try { return getVoice(); } catch { return 0; } };
  const later = (ms) => { timer = setTimeout(() => { frame = requestAnimationFrame(tick); }, ms); };

  function fallBack(why) {
    if (why) console.warn('The orb runs as particles here:', why);
    cancelAnimationFrame(frame); clearTimeout(timer); seen?.disconnect(); seen = null;
    engine?.dispose(); engine = null;
    if (glCanvas?.isConnected) glCanvas.replaceWith(canvas);
    glCanvas = null;
    if (!stopped && canvas.isConnected) particles = particlesOn();
  }
  function tick(now) {
    if (stopped || !engine) return;
    if (!glCanvas.isConnected) { stop(); return; }   // the orb left the page
    if (!glCanvas.clientWidth || offscreen || document.hidden) { last = now; later(500); return; }   // hidden, scrolled away or the tab is: sleep
    const elapsed = Math.max(0, (now - last) / 1000);
    if (prefersStill()) {
      last = now;
      const asked = getState();
      if (asked !== stillShown) {   // a still frame is redrawn only when the state changes
        try { engine.draw(0, asked, 0, true); } catch (error) { fallBack(error.message); return; }
        stillShown = asked;
      }
      later(600);
      return;
    }
    stillShown = null;
    const state = getState();
    const rate = (BUSY.has(state) ? fps : calmFps) * (struggling ? 0.5 : 1);
    if (!frameDue(elapsed, rate)) { frame = requestAnimationFrame(tick); return; }
    // If frames keep arriving late, this device is struggling: halve the frame rate.
    slowAvg += ((elapsed > 1.5 / rate ? 1 : 0) - slowAvg) * 0.03;
    if (!struggling && slowAvg > 0.6) struggling = true;
    last = now;
    try { engine.draw(frameStep(elapsed), state, level(), false); } catch (error) { fallBack(error.message); return; }
    frame = requestAnimationFrame(tick);
  }
  function stop() {
    stopped = true; cancelAnimationFrame(frame); clearTimeout(timer); seen?.disconnect();
    particles?.stop(); particles = null;
    engine?.dispose(); engine = null;
  }

  if (typeof WebGL2RenderingContext !== 'undefined') {
    pictures().then(images => {
      if (stopped || !canvas.isConnected) return;
      glCanvas = document.createElement('canvas');
      glCanvas.className = canvas.className; glCanvas.setAttribute('aria-hidden', 'true');
      glCanvas.width = canvas.width; glCanvas.height = canvas.height;
      canvas.replaceWith(glCanvas);
      if (typeof IntersectionObserver !== 'undefined') { seen = new IntersectionObserver(([e]) => { offscreen = !e.isIntersecting; }); seen.observe(glCanvas); }
      try { engine = createEngine(glCanvas, images, zoom, backdrop === 'aura', backdrop === 'glow', maxDpr); engine.draw(0, getState(), 0, false); }
      catch (error) { engine?.dispose?.(); engine = null; glCanvas.replaceWith(canvas); glCanvas = null; console.warn('The orb runs as particles here:', error.message); return; }
      particles.stop(); particles = null;
      // The context can be lost (a driver reset, too many contexts): the particles take over.
      glCanvas.addEventListener('webglcontextlost', () => { if (!stopped) fallBack('the graphics context was lost'); });
      last = performance.now(); frame = requestAnimationFrame(tick);
    }).catch(error => console.warn('The orb runs as particles here:', error.message));
  }
  // step(dt) draws one frame now (previews and checks; the loop runs by itself otherwise).
  return {stop, step: dt => (engine ? engine.draw(dt, getState(), level(), false) : particles?.step(dt))};
}

window.MeridianOrb = { startOrb, STATES, levelFromSamples };
})();
