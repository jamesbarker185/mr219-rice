const D = __DATA__;
const root = document.querySelector(".mr");
const stage = root.querySelector(".mr-stage");
const readout = root.querySelector("[data-readout]");
const said = stage.querySelector(".mr-said");
const part = (name) => stage.querySelector(`[data-part="${name}"]`);
const cell = (name) => root.querySelector(`[data-cell="${name}"]`);
const still = matchMedia("(prefers-reduced-motion: reduce)");
const P = D.P;
const at = (p) => iso(p, P);
const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const f1 = (v) => v.toFixed(1);
const TAU = Math.PI * 2;
const V = { tall: VARIETIES.tall, mr219: VARIETIES.mr219 };

// ------------------------------------------------------------ colours from the theme, mixed in JS
const css = getComputedStyle(root);
const hex = (name) => {
  const s = css.getPropertyValue(name).trim();
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
const C = { leaf: hex("--mr-leaf"), leafLine: hex("--mr-leaf-line"), ripe: hex("--mr-ripe"), ripeLine: hex("--mr-ripe-line"), grain: hex("--mr-grain") };

// ------------------------------------------------------------ seeded plants
let seed = 2001;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const hills = D.HILLS.map((h, index) => {
  const v = V[h.variety];
  const tillers = [];
  for (let i = 0; i < v.tillers; i++) {
    const beta = (i / v.tillers) * TAU + rnd() * 0.6;
    tillers.push({
      i,
      off: [Math.cos(beta) * (0.6 + rnd() * 1.4), Math.sin(beta) * (0.6 + rnd() * 1.4)],
      beta,
      tilt: (h.variety === "tall" ? 0.13 : 0.07) * (0.5 + rnd()),
      size: 0.9 + rnd() * 0.12,
      phase: rnd() * TAU,
      lean: 0.85 + rnd() * 0.3,
      wy: (rnd() - 0.5) * 0.5,
      thr: 1.4 + rnd() * 2.6,
      leafTurn: rnd() * TAU,
      phi: 0,
      rate: 0,
      psi: 0,
      psiRate: 0,
      fall: 0, // 0 standing, else the angle it falls to
    });
  }
  return { ...h, index, v, tillers, el: stage.querySelector(`[data-hill="${index}"]`), near: h.y === Math.max(...D.HILLS.map((o) => o.y)) };
});

// ------------------------------------------------------------ geometry of one tiller
const ZW = D.ZW;
const ZS = D.ZS;
function curve(base, len, n, dirAt) {
  // March up from base, each step's direction from dirAt(s) = [hx, hy, theta]; lie on the water if pushed below it.
  const pts = [base];
  let p = base;
  const step = len / n;
  for (let j = 1; j <= n; j++) {
    const [hx, hy, th] = dirAt((j - 0.5) / n);
    const q = [p[0] + Math.sin(th) * hx * step, p[1] + Math.sin(th) * hy * step, p[2] + Math.cos(th) * step];
    if (q[2] < ZW + 0.5) q[2] = ZW + 0.5;
    pts.push(q);
    p = q;
  }
  return pts;
}
const tiltOf = (vx, vy) => {
  const th = Math.hypot(vx, vy);
  return th < 1e-6 ? [1, 0, 0] : [vx / th, vy / th, th];
};
const pathOfPts = (pts) => "M" + pts.map((p) => { const s = at(p); return f1(s[0]) + " " + f1(s[1]); }).join("L");
function blade(pts, width) {
  // A leaf blade: the projected centreline offset either side in screen space, widest a third of the way up.
  const s = pts.map(at);
  const left = [];
  const right = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(0, i - 1)];
    const b = s[Math.min(s.length - 1, i + 1)];
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const t = i / (s.length - 1);
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.75 + 0.25 * t * t)), 0.7) * (t < 1 ? 1 : 0);
    left.push([s[i][0] + nx * w, s[i][1] + ny * w]);
    right.push([s[i][0] - nx * w, s[i][1] - ny * w]);
  }
  const all = left.concat(right.reverse());
  return "M" + all.map((p) => f1(p[0]) + " " + f1(p[1])).join("L") + "Z";
}
const grainAt = (s, r) => `M${f1(s[0] - r)} ${f1(s[1])}a${f1(r)} ${f1(r * 0.62)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r * 0.62)} 0 1 0 ${f1(-2 * r)} 0`;

function hillSvg(h, day) {
  const v = h.v;
  const height = heightOf(v, day);
  const grow = clampTo(height / v.height, 0, 1);
  const count = tillersOf(v, day);
  const exsert = exsertOf(v, day);
  const fill = fillOf(v, day);
  const ripe = ripeOf(v, day);
  const tall = v === V.tall;
  const culmShare = tall ? 0.8 : 0.72;
  let stems = "";
  let leaves = "";
  let rachis = "";
  let grains = "";
  for (const t of h.tillers.slice(0, count)) {
    const base = [h.x + t.off[0], h.y + t.off[1], ZW];
    const culm = Math.max(2, (height * culmShare * t.size) - (ZW - ZS));
    const wind = t.phi + t.psi;
    const wx = -1 * t.lean;
    const wy = t.wy;
    const bx = Math.cos(t.beta) * t.tilt;
    const by = Math.sin(t.beta) * t.tilt;
    const stemDir = (s) => {
      const k = t.phi * Math.pow(s, 1.2) + t.psi * smooth(0, 0.22, s);
      return tiltOf(bx + wx * k, by + wy * k);
    };
    const stem = curve(base, culm, 10, stemDir);
    stems += pathOfPts(stem);
    // Leaves: three blades from low nodes and the flag leaf near the top, turning round the stem.
    const L = v.leaf;
    const nodes = [0.16, 0.32, 0.5, 0.86];
    nodes.forEach((s, n) => {
      const flag = n === 3;
      if (flag && grow < 0.55) return;
      const len = (flag ? (tall ? 34 : 30) : L.length * (0.8 + 0.1 * n)) * clampTo(grow * 1.25, 0.25, 1) * t.size;
      const out = flag ? (tall ? 0.3 : 0.06) : L.out;
      const droop = flag ? (tall ? 0.7 : 0.08) : L.droop * (0.8 + 0.2 * n);
      const az = t.leafTurn + n * 2.4;
      const [sx, sy, sth] = stemDir(s);
      const sv = [sx * sth, sy * sth];
      const node = stem[Math.round(s * 10)];
      const sag = 0.25 * ripe * (flag ? 0.3 : 1);
      const pts = curve(node, len, 9, (q) => {
        const bend = out + (droop + sag) * Math.pow(q, 1.5) + wind * 0.5 * q;
        return tiltOf(sv[0] + Math.cos(az) * bend + wx * wind * 0.4 * q, sv[1] + Math.sin(az) * bend + wy * wind * 0.4 * q);
      });
      const age = flag ? ripe * 0.55 : ripe * (0.6 + 0.12 * (3 - n)) + (tall ? 0 : 0);
      leaves += `<path class="leaf" fill="${mix(C.leaf, C.ripe, age)}" stroke="${mix(C.leafLine, C.ripeLine, age)}" d="${blade(pts, (tall ? 1.15 : 1.0) * clampTo(grow * 1.6, 0.5, 1))}"/>`;
    });
    if (exsert <= 0) continue;
    // Panicle: a rachis that arches over and droops as the grain fills, primary branches with grain along them.
    const top = stem[stem.length - 1];
    const [hx0, hy0, th0] = stemDir(1);
    const dirH = th0 > 0.05 ? [hx0, hy0] : [Math.cos(t.beta), Math.sin(t.beta)];
    const plen = v.panicle * exsert * t.size;
    const droop = v.droop * (0.18 + 0.82 * fill);
    const rach = curve(top, plen, 10, (q) => tiltOf(dirH[0] * (th0 + droop * q), dirH[1] * (th0 + droop * q)));
    rachis += pathOfPts(rach);
    const side = [-dirH[1], dirH[0]];
    const gr = 0.45 + 0.45 * fill;
    for (let b = 1; b <= 7; b++) {
      const q = b / 8;
      const from = rach[Math.round(q * 10)];
      const blen = (7 - 3.5 * q) * exsert;
      const sgn = b % 2 ? 1 : -1;
      const th = th0 + droop * q + 0.35 + 0.25 * fill;
      const br = curve(from, blen, 3, (u) => tiltOf(dirH[0] * (th + droop * 0.3 * u) + side[0] * sgn * 0.5, dirH[1] * (th + droop * 0.3 * u) + side[1] * sgn * 0.5));
      rachis += pathOfPts(br);
      if (exsert > 0.5) for (let g = 1; g < br.length; g++) grains += grainAt(at(br[g]), gr);
    }
    if (exsert > 0.5) grains += grainAt(at(rach[rach.length - 1]), gr);
  }
  const line = mix(C.leafLine, C.ripeLine, ripe);
  const ring = h.ring;
  return `${ring}<path class="stem" stroke="${mix(C.leafLine, C.ripeLine, ripe * 0.8)}" d="${stems}"/>${leaves}<path class="rachis" stroke="${line}" d="${rachis}"/><path class="grain" fill="${mix(C.leaf, C.grain, ripe)}" stroke="${line}" d="${grains}"/>`;
}
for (const h of hills) {
  const pts = [];
  for (let i = 0; i <= 20; i++) pts.push(at([h.x + Math.cos((i / 20) * TAU) * 4.2, h.y + Math.sin((i / 20) * TAU) * 4.2, ZW]));
  h.ring = `<path class="ring" d="M${pts.map((p) => f1(p[0]) + " " + f1(p[1])).join("L")}Z"/>`;
}

// ------------------------------------------------------------ roots on the cut face
const rootSets = hills.filter((h) => h.near).map((h) => {
  const list = [];
  for (let r = 0; r < 16; r++) {
    const a = -1.25 + (2.5 * r) / 15 + (rnd() - 0.5) * 0.15;
    const len = 0.7 + rnd() * 0.3;
    const wig = rnd() * TAU;
    list.push({ a, len, wig });
  }
  return { h, list };
});
function rootsSvg(day) {
  const reach = 2 + 19 * smooth(4, 75, day);
  let d = "";
  for (const { h, list } of rootSets) {
    for (const r of list) {
      const pts = [];
      let p = [h.x, ZS - 0.6];
      pts.push(p);
      const n = 8;
      for (let j = 1; j <= n; j++) {
        const a = r.a * (0.6 + 0.5 * (j / n)) + 0.12 * Math.sin(r.wig + j * 1.3);
        const step = (reach * r.len) / n;
        p = [p[0] + Math.sin(a) * step, Math.max(D.PAN[0] + 1.5, p[1] - Math.cos(a) * step)];
        pts.push(p);
      }
      d += pathOfPts(pts.map(([x, z]) => [x, D.YC + 0.05, z]));
    }
  }
  return `<path class="mr-root" data-free="end" d="${d}"/>`;
}

// ------------------------------------------------------------ calendar wheel
const F = D.WF;
const onWheel = (r, a) => [F.o[0] + F.a[0] * D.FACE + (F.u[0] * Math.cos(a) + F.v[0] * Math.sin(a)) * r, F.o[1] + F.a[1] * D.FACE + (F.u[1] * Math.cos(a) + F.v[1] * Math.sin(a)) * r, F.o[2] + F.a[2] * D.FACE + (F.u[2] * Math.cos(a) + F.v[2] * Math.sin(a)) * r];
const angleOfDay = (d) => (d / 365) * TAU;
const arcEls = D.ARCS.map((arc) => ({ ...arc, el: stage.querySelector(`[data-arc="${arc.key}"]`) }));
function sector(r0, r1, d0, d1) {
  if (d1 - d0 < 0.3) return "";
  const n = Math.max(3, Math.ceil(((d1 - d0) / 365) * 90));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(onWheel(r1, angleOfDay(d0 + ((d1 - d0) * i) / n)));
  for (let i = n; i >= 0; i--) pts.push(onWheel(r0, angleOfDay(d0 + ((d1 - d0) * i) / n)));
  return pathOfPts(pts) + "Z";
}
// The calendar runs on days since the main-season sowing (1 September = day 244 of the year).
const SOW = SEASONS.mr219[0].from;
function wheelDraw(elapsed) {
  const hand = part("hand");
  const a = angleOfDay(SOW + elapsed);
  hand.setAttribute("d", pathOfPts([onWheel(0, a), onWheel(D.RING.mr[1] + 1.5, a)]));
  for (const arc of arcEls) {
    let start = arc.from - SOW;
    if (start < 0) start += 365;
    const done = clampTo(elapsed - start, 0, arc.days);
    arc.el.setAttribute("d", sector(arc.ring[0], arc.ring[1], arc.from, arc.from + done));
  }
}
function cropsDone(elapsed) {
  const count = (list) => list.filter((s) => { let start = s.from - SOW; if (start < 0) start += 365; return elapsed >= start + s.days; }).length;
  return { mr: count(SEASONS.mr219), tall: count(SEASONS.tall) };
}

// ------------------------------------------------------------ anemometer, rain and ripples
const cupsEl = part("cups");
let cupAngle = 0;
function cupsSvg() {
  const [ax, ay] = D.ANEMO;
  const z = D.ANEMO_TOP;
  let arms = "";
  let cups = "";
  const items = [0, 1, 2].map((i) => {
    const a = cupAngle + (i * TAU) / 3;
    const tip = [ax + Math.cos(a) * 8, ay + Math.sin(a) * 8, z];
    return { tip, a, depth: depthOf(tip, P) };
  }).sort((p, q) => p.depth - q.depth);
  for (const { tip, a } of items) {
    arms += pathOfPts([[ax, ay, z], tip]);
    const s = at(tip);
    const c = at([tip[0] - Math.sin(a) * 1.4, tip[1] + Math.cos(a) * 1.4, z]);
    cups += `M${f1(c[0] - 1.9)} ${f1(c[1])}a1.9 1.5 0 1 0 3.8 0a1.9 1.5 0 1 0 -3.8 0`;
    void s;
  }
  const hub = at([ax, ay, z]);
  return `<path class="iso-line" data-tone="mid" d="${arms}"/><path class="iso-fill" d="${cups}"/><path class="iso-line" data-tone="mid" d="${cups}"/><circle cx="${f1(hub[0])}" cy="${f1(hub[1])}" r="1.4" class="iso-fill"/><circle cx="${f1(hub[0])}" cy="${f1(hub[1])}" r="0.6" fill="var(--anatomy-dot)"/>`;
}
const rainEl = part("rain");
const ripplesEl = part("ripples");
const drops = [];
const ripples = [];
const newDrop = (top) => ({ x: D.XL + 20 + Math.random() * (D.XR - D.XL - 10), y: D.BLOCK.y + Math.random() * D.BLOCK.d, z: top ? 175 + Math.random() * 25 : ZW + Math.random() * 145 });
for (let i = 0; i < 90; i++) drops.push(newDrop(false));
function rainStep(dt, wind, amount) {
  for (const d of drops) {
    d.z -= 420 * dt;
    d.x -= 180 * wind * dt;
    if (d.z < ZW) {
      if (amount > 0.2 && d.x > D.WATER_X[0] && d.x < D.WATER_X[1] && ripples.length < 60) ripples.push({ x: d.x, y: d.y, age: 0 });
      Object.assign(d, newDrop(true));
    }
  }
  for (const r of ripples) r.age += dt;
  while (ripples.length && ripples[0].age > 0.7) ripples.shift();
}
function rainDraw(amount, wind) {
  if (amount < 0.01) {
    if (rainEl.innerHTML) rainEl.innerHTML = "";
    if (ripplesEl.innerHTML) ripplesEl.innerHTML = "";
    return;
  }
  const shown = Math.round(drops.length * amount);
  let d = "";
  for (let i = 0; i < shown; i++) {
    const p = drops[i];
    d += pathOfPts([[p.x, p.y, p.z], [p.x + 180 * wind * 0.025, p.y, p.z + 420 * 0.025]]);
  }
  rainEl.innerHTML = `<path class="mr-rain" data-free="both" style="opacity:${f1(0.85 * amount)}" d="${d}"/>`;
  let r = "";
  for (const q of ripples) {
    const rad = 0.6 + q.age * 6;
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push(at([q.x + Math.cos((i / 12) * TAU) * rad, q.y + Math.sin((i / 12) * TAU) * rad, ZW]));
    r += "M" + pts.map((p) => f1(p[0]) + " " + f1(p[1])).join("L");
  }
  ripplesEl.innerHTML = `<path class="mr-ripple" style="opacity:${f1(0.8 * amount)}" d="${r}"/>`;
}

// ------------------------------------------------------------ state
let day = 0;
let target = 0;
let gustT = -1; // seconds since the gust began, -1 when none
let elapsed = 0; // calendar: days since sowing, can run past the season to a full year
let yearRun = false;
let wind = 0;
let rainAmount = 0;
let clock = 0;
let lastDrawnDay = -1;
const GUST = { attack: 0.7, hold: 2.8, decay: 1.4 };
const gustLevel = (t) => (t < 0 ? 0 : t < GUST.attack ? smooth(0, GUST.attack, t) : t < GUST.attack + GUST.hold ? 1 : 1 - smooth(GUST.attack + GUST.hold, GUST.attack + GUST.hold + GUST.decay, t));
const gustOver = (t) => t > GUST.attack + GUST.hold + GUST.decay;

function clearLodging() {
  for (const h of hills) for (const t of h.tillers) Object.assign(t, { phi: 0, rate: 0, psi: 0, psiRate: 0, fall: 0 });
}
function physics(dt) {
  for (const h of hills) {
    const v = h.v;
    const tall = v === V.tall;
    const grow = heightOf(v, day) / v.height;
    const k = tall ? 22 : 70;
    const c = 2 * (tall ? 0.22 : 0.3) * Math.sqrt(k);
    const defl = (tall ? 0.42 : 0.3) * (0.4 + 0.6 * grow);
    for (const t of h.tillers) {
      const gusting = wind * (0.78 + 0.22 * Math.sin(clock * 2.6 + t.phase) + 0.08 * Math.sin(clock * 7.3 + t.phase * 2));
      const sub = 4;
      for (let i = 0; i < sub; i++) {
        t.rate += (k * (defl * gusting - t.phi) - c * t.rate) * (dt / sub);
        t.phi += t.rate * (dt / sub);
        t.psiRate += (14 * (t.fall - t.psi) - 4.5 * t.psiRate) * (dt / sub);
        t.psi += t.psiRate * (dt / sub);
      }
      if (!t.fall && lodgingIndex(v, day, gusting) > t.thr) t.fall = 1.2 + 0.25 * Math.sin(t.phase * 3);
    }
  }
}
const lodgedShare = (key) => {
  const h = hills.filter((x) => x.variety === key);
  const count = tillersOf(V[key], day);
  const all = h.flatMap((x) => x.tillers.slice(0, count));
  return all.filter((t) => t.fall).length / all.length;
};
const canopyOf = (key) => {
  const h = hills.filter((x) => x.variety === key);
  const count = tillersOf(V[key], day);
  const all = h.flatMap((x) => x.tillers.slice(0, count));
  const drop = all.reduce((s, t) => s + Math.min(1, t.psi / 1.3) * 0.62 + Math.abs(t.phi) * 0.15, 0) / all.length;
  return heightOf(V[key], day) * (1 - drop);
};

function stageWord(v) {
  return stageOf(v, day);
}
function draw(force = false) {
  const moving = force || wind > 0.001 || hills.some((h) => h.tillers.some((t) => Math.abs(t.rate) > 1e-4 || Math.abs(t.psiRate) > 1e-4));
  if (moving || Math.abs(day - lastDrawnDay) > 0.01) {
    for (const h of hills) h.el.innerHTML = hillSvg(h, day);
  }
  if (Math.abs(day - lastDrawnDay) > 0.01) part("roots").innerHTML = rootsSvg(day);
  lastDrawnDay = day;
  const hTall = canopyOf("tall");
  const hMr = canopyOf("mr219");
  part("cursor-tall").setAttribute("transform", translateAlong(P, [0, 0, ZS + hTall]));
  part("cursor-mr").setAttribute("transform", translateAlong(P, [0, 0, ZS + hMr]));
  cupsEl.innerHTML = cupsSvg();
  rainDraw(rainAmount, wind);
  wheelDraw(elapsed);

  const lt = lodgedShare("tall");
  const lm = lodgedShare("mr219");
  const done = cropsDone(elapsed);
  const set = (name, text) => { const el = cell(name); if (el.textContent !== text) el.textContent = text; };
  set("tall-height", `${Math.round(hTall)} cm`);
  set("mr-height", `${Math.round(hMr)} cm`);
  set("tall-load", `${Math.round(loadOf(V.tall, day))} g`);
  set("mr-load", `${Math.round(loadOf(V.mr219, day))} g`);
  set("tall-lodged", `${Math.round(lt * 100)}%`);
  set("mr-lodged", `${Math.round(lm * 100)}%`);
  set("tall-yield", lt > 0 ? `${yieldOf(V.tall, lt).toFixed(1)} t/ha (${V.tall.yield} standing)` : `${V.tall.yield} t/ha`);
  set("mr-yield", `${V.mr219.yieldRange[0]}–${V.mr219.yieldRange[1]} t/ha`);
  set("tall-crops", elapsed > 160 ? `${done.tall} of 1` : "1");
  set("mr-crops", elapsed > 160 ? `${done.mr} of 2` : "2");

  let text;
  if (elapsed > 160) {
    const months = Math.min(12, Math.round((elapsed / 365) * 12));
    text = `${months} months · MR219 ${done.mr} crop${done.mr === 1 ? "" : "s"} · tall ${done.tall}`;
  } else {
    const d = Math.round(day);
    text = `Day ${d} · MR219 ${stageWord(V.mr219)} · tall ${stageWord(V.tall)}`;
    if (wind > 0.05) text = `Day ${d} · gust · tall lodged ${Math.round(lt * 100)}% · MR219 ${Math.round(lm * 100)}%`;
  }
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(day)));
  stage.setAttribute("aria-valuetext", text);
}

// ------------------------------------------------------------ the tour: grow, gust, a year on the wheel, again
const TOUR = { grow: 13, hold: 1.2, gustWait: 0.3, after: 2.2, year: 7, rest: 2.5 };
let tour = { phase: "grow", t: 0 };
let touring = !still.matches;
function tourStep(dt) {
  tour.t += dt;
  if (tour.phase === "grow") {
    target = DAYS * Math.min(1, tour.t / TOUR.grow);
    if (tour.t > TOUR.grow + TOUR.hold) { tour = { phase: "gust", t: 0 }; startGust(); }
  } else if (tour.phase === "gust") {
    if (gustOver(gustT) && tour.t > TOUR.after) { tour = { phase: "year", t: 0 }; yearRun = true; }
  } else if (tour.phase === "year") {
    if (elapsed >= 365 && tour.t > TOUR.year + TOUR.rest) restart();
  }
}
function restart() {
  tour = { phase: "grow", t: 0 };
  target = 0;
  day = 0;
  elapsed = 0;
  yearRun = false;
  clearLodging();
}
function startGust() {
  gustT = 0;
}

let frame = 0;
let last = 0;
let visible = false;
let idleTimer = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring) tourStep(dt);
  const before = day;
  day = still.matches ? target : day + (target - day) * (1 - Math.exp(-dt / 0.25));
  if (Math.abs(target - day) < 0.02) day = target;
  if (day < before - 2) clearLodging();
  if (yearRun) elapsed = Math.min(365, elapsed + (365 / TOUR.year) * dt);
  else elapsed = day;
  if (gustT >= 0) {
    gustT += dt;
    if (gustOver(gustT)) gustT = -1;
  }
  wind = gustLevel(gustT);
  rainAmount = wind;
  cupAngle += (0.4 + 16 * wind) * dt;
  physics(dt);
  rainStep(dt, wind, rainAmount);
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const pause = () => {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) { touring = true; tour = { phase: "grow", t: (day / DAYS) * TOUR.grow }; yearRun = false; } run(); }, 4500);
};
const steer = (next) => {
  pause();
  yearRun = false;
  target = clampTo(next, 0, DAYS);
  run();
};
const gust = () => { pause(); yearRun = false; startGust(); if (still.matches) settleGust(); run(); };
const year = () => { pause(); yearRun = true; elapsed = Math.max(elapsed, day); run(); if (still.matches) { elapsed = 365; draw(); } };
function settleGust() {
  // Reduced motion: no sway, only the outcome of the gust.
  for (const h of hills) for (const t of h.tillers) if (lodgingIndex(h.v, day, 1) > t.thr) { t.fall = 1.2 + 0.25 * Math.sin(t.phase * 3); t.psi = t.fall; }
  gustT = -1;
  draw(true);
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const box = stage.getBoundingClientRect();
  const share = clampTo(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1);
  steer(share * DAYS);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") {
    const box = stage.getBoundingClientRect();
    steer(clampTo(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1) * DAYS);
  }
});
stage.addEventListener("click", () => gust());
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + 5;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - 5;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = DAYS;
  if (event.key === "g" || event.key === "G" || event.key === " ") { event.preventDefault(); gust(); said.textContent = "Gust of wind and rain"; return; }
  if (event.key === "y" || event.key === "Y") { event.preventDefault(); year(); said.textContent = "A year on the crop calendar: two MR219 crops, one tall crop"; return; }
  if (to === null) return;
  event.preventDefault();
  steer(to);
  said.textContent = `Day ${Math.round(target)}`;
});
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

if (still.matches) {
  // One still picture: the end of the season after the gust, with the year on the wheel.
  target = day = DAYS;
  settleGust();
  yearRun = true;
  elapsed = 365;
}
draw();
window.__mr = { get day() { return day; }, setDay(d) { touring = false; yearRun = false; target = day = d; clearLodging(); }, gust: () => { touring = false; startGust(); }, settleGust, year: () => { touring = false; yearRun = true; }, setElapsed(e) { yearRun = true; elapsed = e; }, set touring(v) { touring = v; }, lodged: () => [lodgedShare("tall"), lodgedShare("mr219")] };
