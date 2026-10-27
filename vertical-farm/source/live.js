const D = __DATA__;
const root = document.querySelector(".vf");
const stage = root.querySelector(".vf-stage");
const readout = root.querySelector("[data-readout]");
const said = stage.querySelector(".vf-said");
const part = (name) => stage.querySelector(`[data-part="${name}"]`);
const cell = (name) => root.querySelector(`[data-cell="${name}"]`);
const still = matchMedia("(prefers-reduced-motion: reduce)");
const P = D.P;
const at = (p) => iso(p, P);
const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const f1 = (v) => v.toFixed(1);
const TAU = Math.PI * 2;

// ------------------------------------------------------------ colours from the theme, mixed in JS
const css = getComputedStyle(root);
const hex = (name) => {
  const s = css.getPropertyValue(name).trim();
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * clampTo(t, 0, 1))).join(",")})`;
const C = { leaf: hex("--vf-leaf"), leafLine: hex("--vf-leaf-line"), heart: hex("--vf-heart"), heartLine: hex("--vf-heart-line"), led: hex("--vf-led"), ledOff: hex("--vf-led-off") };

// ------------------------------------------------------------ seeded heads
let seed = 2015;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const plants = D.PLANTS.map((p, index) => ({
  ...p,
  index,
  phase: rnd() * TAU,
  size: 0.92 + rnd() * 0.14,
  lag: (rnd() - 0.5) * 1.2, // a day or so ahead or behind its tier
  jit: Array.from({ length: 18 }, () => ({ len: 0.9 + rnd() * 0.2, az: (rnd() - 0.5) * 0.35, rise: (rnd() - 0.5) * 0.18 })),
  el: stage.querySelector(`[data-plant="${index}"]`),
  age: -1,
}));

// ------------------------------------------------------------ one butterhead: a rosette of round leaves, cupped, the inner ones folding over the heart
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function headSvg(p, age) {
  const g = growOf(age);
  const span = spanOf(age) * p.size;
  const n = Math.round(6 + 10 * g);
  const base = [p.x, p.y, p.z];
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1); // 0 the outermost, oldest leaf; 1 the heart
    const j = p.jit[i];
    const len = span * 0.5 * (1.1 - 0.52 * f) * j.len;
    const rise = 0.16 + 1.12 * f + (1 - g) * 0.4 + j.rise;
    const az = p.phase + i * 2.39996 + j.az;
    const h = [Math.cos(az), Math.sin(az), 0];
    const side = [-Math.sin(az), Math.cos(az), 0];
    const dir = [h[0] * Math.cos(rise), h[1] * Math.cos(rise), Math.sin(rise)];
    const nrm = cross(dir, side);
    const width = len * (0.74 + 0.22 * g);
    const droop = len * 0.34 * (1 - f) * (0.3 + 0.7 * g);
    const curl = f > 0.5 ? (f - 0.5) * 1.5 * g : 0;
    const cup = 0.25 + 0.8 * f;
    const m = 9;
    const mid = [];
    const left = [];
    const right = [];
    for (let s = 0; s <= m; s++) {
      const u = s / m;
      const c = [
        base[0] + (dir[0] * u - h[0] * curl * u * u * 0.5) * len,
        base[1] + (dir[1] * u - h[1] * curl * u * u * 0.5) * len,
        base[2] + dir[2] * u * len - droop * u * u + 0.2,
      ];
      const w = (width / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.62) * (s === m ? 0 : 1);
      const lift = cup * (w * w) / (width / 2);
      mid.push(c);
      left.push([c[0] + side[0] * w + nrm[0] * lift, c[1] + side[1] * w + nrm[1] * lift, c[2] + nrm[2] * lift]);
      right.push([c[0] - side[0] * w + nrm[0] * lift, c[1] - side[1] * w + nrm[1] * lift, c[2] + nrm[2] * lift]);
    }
    const outline = left.concat(right.slice(0, -1).reverse()).map(at);
    const tone = clampTo(f * 0.9 * g + (1 - g) * 0.25, 0, 1);
    leaves.push({
      depth: depthOf(mid[Math.round(m * 0.55)], P),
      d: "M" + outline.map((q) => f1(q[0]) + " " + f1(q[1])).join("L") + "Z",
      rib: g > 0.15 ? "M" + mid.slice(1, Math.round(m * 0.75)).map(at).map((q) => f1(q[0]) + " " + f1(q[1])).join("L") : "",
      fill: mix(C.leaf, C.heart, tone),
      line: mix(C.leafLine, C.heartLine, tone),
    });
  }
  leaves.sort((a, b) => a.depth - b.depth);
  return leaves.map((l) => `<path class="leaf" fill="${l.fill}" stroke="${l.line}" d="${l.d}"/>${l.rib ? `<path class="rib" d="${l.rib}"/>` : ""}`).join("");
}

// ------------------------------------------------------------ the timer dial: 96 pins, the 16 lit hours pushed in, turning under a fixed pointer
const DF = { o: [D.DIAL.x, D.CAB_FACE, D.DIAL.z], a: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] };
const onDial = (s, r, ang) => [DF.o[0] + DF.v[0] * Math.sin(ang) * r, DF.o[1] + s, DF.o[2] + Math.cos(ang) * r];
const seg = (a, b) => { const p = at(a); const q = at(b); return `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}`; };
function timerSvg(hour) {
  let on = "";
  let off = "";
  let minor = "";
  let major = "";
  const r = D.DIAL.r;
  for (let i = 0; i < 96; i++) {
    const h = i / 4 + 0.125;
    const ang = ((h - hour) / 24) * TAU;
    const lit = h >= LIGHTS_ON && h < LIGHTS_ON + PHOTOPERIOD;
    const piece = seg(onDial(2.45, r - 3.2, ang), onDial(2.45, r - 0.8, ang));
    if (lit) on += piece;
    else off += piece;
  }
  for (let hr = 0; hr < 24; hr++) {
    const ang = ((hr - hour) / 24) * TAU;
    const big = hr % 6 === 0;
    const piece = seg(onDial(2.45, r - 4.4, ang), onDial(2.45, r - (big ? 7.6 : 6), ang));
    if (big) major += piece;
    else minor += piece;
  }
  return `<path class="vf-pin-off" d="${off}"/><path class="vf-pin-on" d="${on}"/><path class="iso-line" data-tone="lo" data-free="both" d="${minor}"/><path class="iso-line" data-tone="mid" data-free="both" d="${major}"/>`;
}

// ------------------------------------------------------------ nutrient film leaving each gully into its gutter
function dripsSvg(clock) {
  let streams = "";
  for (const [x, y, z] of D.chanEnd) {
    for (const dy of [-2.2, 0, 2.2]) {
      const top = [x - 0.2, y + dy, z + 0.2];
      const t = (clock * 1.6 + (y + dy) * 0.37 + z * 0.11) % 1;
      const fall = 1.4 + 2.4 * t;
      streams += seg(top, [x - 0.6 - 0.8 * t, y + dy, z - fall]);
    }
  }
  return `<path class="vf-drip" d="${streams}"/>`;
}

// ------------------------------------------------------------ state
const ROTA = TIERS * HEADS_PER_TIER;
let day = 0; // cycle clock, days
let target = 0;
let hour = 12;
let dayRun = -1; // hours run in the light day, -1 when none
let yearT = -1; // days run in the year, -1 when none
let yearFrom = 0;
let clock = 0;
let held = false; // a pose set from outside, for screenshots
let drawnDay = -1;
let drawnHour = -1;

const ageAt = (p, d) => clampTo(ageOf(p.tier, d) + (ageOf(p.tier, d) > 2 && ageOf(p.tier, d) < GROW - 2 ? p.lag : 0), 0, GROW);
const nowDay = () => (yearT >= 0 ? yearFrom + yearT : day);

function draw(force = false) {
  const d = nowDay();
  if (force || Math.abs(d - drawnDay) > 0.004) {
    for (const p of plants) {
      const age = ageAt(p, d);
      if (force || Math.abs(age - p.age) > 0.004) {
        p.el.innerHTML = headSvg(p, age);
        p.age = age;
      }
    }
    drawnDay = d;
  }
  if (force || hour !== drawnHour) {
    part("timer").innerHTML = timerSvg(hour);
    const light = lightAt(hour);
    stage.querySelectorAll("[data-glow]").forEach((el) => el.setAttribute("opacity", f1(light)));
    const ledColor = mix(C.ledOff, C.led, light);
    stage.querySelectorAll("[data-led]").forEach((el) => (el.style.stroke = ledColor));
    const h = ((hour % 24) + 24) % 24;
    const text = `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
    const lcd = part("lcd");
    if (lcd.textContent !== text) lcd.textContent = text;
    drawnHour = hour;
  }
  if (!still.matches) part("drips").innerHTML = dripsSvg(clock);
  else if (!part("drips").innerHTML) part("drips").innerHTML = dripsSvg(0.4);

  const mass = plants.reduce((s, p) => s + massOf(p.age), 0) / 1000;
  const h = ((hour % 24) + 24) % 24;
  const set = (name, text) => { const el = cell(name); if (el.textContent !== text) el.textContent = text; };
  set("rack-crop", `${ROTA} heads · ${mass.toFixed(1)} kg`);
  set("rack-days", `${PROPAGATE + GROW} days`);
  set("rack-water", `${HYDRO_WATER_L_KG} L`);
  set("rack-power", `${Math.round(ledKwhKg)} kWh, LEDs alone`);
  const perYear = Math.round(TIERS * cyclesPerYear);
  let text;
  if (yearT >= 0) {
    const cuts = harvestsBy(yearFrom + yearT) - harvestsBy(yearFrom);
    const kg = (cuts * HEADS_PER_TIER * HEAD_FULL) / 1000;
    const months = Math.min(12, Math.floor((yearT / 365) * 12 + 1e-6));
    set("rack-harvests", `${cuts} of ${perYear}`);
    set("rack-yield", `${Math.round(kg / RACK_M2)} of ${Math.round(rackKgM2Year)} kg`);
    set("rack-light", `${DLI.toFixed(1)} mol/m², ${PHOTOPERIOD} h`);
    text = `${months} month${months === 1 ? "" : "s"} · ${cuts} tier cuts · ${Math.round(kg)} kg`;
  } else {
    set("rack-harvests", `${perYear}, a tier a week`);
    set("rack-yield", `${Math.round(rackKgM2Year)} kg`);
    if (dayRun >= 0) {
      const lit = lightAt(hour) > 0.5;
      set("rack-light", `${dliBy(h).toFixed(1)} of ${DLI.toFixed(1)} mol/m²`);
      text = `${part("lcd").textContent} · lights ${lit ? "on" : "off"} · ${dliBy(h).toFixed(1)} mol/m²`;
    } else {
      set("rack-light", `${DLI.toFixed(1)} mol/m², ${PHOTOPERIOD} h`);
      const dd = Math.round(day);
      const cuts = harvestsBy(day);
      const next = Math.min(...[0, 1, 2, 3].map((t) => GROW - ageOf(t, day)));
      text = `Day ${dd} · ${cuts ? `${cuts} tier${cuts === 1 ? "" : "s"} cut · ` : ""}next cut in ${Math.max(0, Math.round(next))} d`;
    }
  }
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(day)));
  stage.setAttribute("aria-valuetext", text);
}

// ------------------------------------------------------------ the tour: four weeks, a day on the timer, a year of cuts, again
const TOUR = { grow: 14, hold: 1.2, day: 8, after: 1.2, year: 12, rest: 2.5 };
let tour = { phase: "grow", t: 0 };
let touring = !still.matches;
function tourStep(dt) {
  tour.t += dt;
  if (tour.phase === "grow") {
    target = GROW * Math.min(1, tour.t / TOUR.grow) * 0.999;
    if (tour.t > TOUR.grow + TOUR.hold) { tour = { phase: "day", t: 0 }; startDay(); }
  } else if (tour.phase === "day") {
    if (dayRun < 0 && tour.t > TOUR.day + TOUR.after) { tour = { phase: "year", t: 0 }; startYear(); }
  } else if (tour.phase === "year") {
    if (yearT >= 365 && tour.t > TOUR.year + TOUR.rest) restart();
  }
}
function restart() {
  tour = { phase: "grow", t: 0 };
  yearT = -1;
  target = day = 0;
}
function startDay() {
  yearT = -1;
  dayRun = 0;
  hour = 12;
}
function startYear() {
  dayRun = -1;
  hour = 12;
  yearFrom = day;
  yearT = 0;
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
  if (yearT < 0) {
    day = still.matches ? target : day + (target - day) * (1 - Math.exp(-dt / 0.25));
    if (Math.abs(target - day) < 0.005) day = target;
  }
  if (dayRun >= 0 && !held) {
    dayRun += (24 / TOUR.day) * dt;
    hour = 12 + Math.min(24, dayRun);
    if (dayRun >= 24) { dayRun = -1; hour = 12; }
  }
  if (yearT >= 0 && yearT < 365 && !held) {
    yearT = Math.min(365, yearT + (365 / TOUR.year) * dt);
    if (yearT >= 365) { day = (yearFrom + 365) % GROW; target = day; }
  }
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const pause = () => {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) { touring = true; yearT = -1; dayRun = -1; hour = 12; tour = { phase: "grow", t: (day / GROW) * TOUR.grow }; } run(); }, 4500);
};
const steer = (next) => {
  pause();
  if (yearT >= 0) { day = target = ((yearFrom + yearT) % GROW + GROW) % GROW; yearT = -1; }
  dayRun = -1;
  hour = 12;
  target = clampTo(next, 0, GROW);
  run();
};
const lightDay = () => {
  pause();
  if (yearT >= 0) { day = target = (yearFrom + yearT) % GROW; }
  startDay();
  if (still.matches) { dayRun = -1; hour = 23; draw(true); }
  run();
};
const year = () => {
  pause();
  startYear();
  if (still.matches) { yearT = 365; draw(true); }
  run();
};

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const box = stage.getBoundingClientRect();
  const share = clampTo(((event.clientX - box.left) / box.width - 0.1) / 0.8, 0, 1);
  if (Math.abs(share * GROW - target) < 0.05 && (yearT >= 0 || dayRun >= 0)) return;
  steer(share * GROW * 0.999);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") {
    const box = stage.getBoundingClientRect();
    steer(clampTo(((event.clientX - box.left) / box.width - 0.1) / 0.8, 0, 1) * GROW * 0.999);
  }
});
stage.addEventListener("click", () => lightDay());
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = GROW * 0.999;
  if (event.key === "l" || event.key === "L" || event.key === " ") { event.preventDefault(); lightDay(); said.textContent = "One day on the light timer: on at 06:00, off at 22:00"; return; }
  if (event.key === "y" || event.key === "Y") { event.preventDefault(); year(); said.textContent = `A year of harvests: ${Math.round(TIERS * cyclesPerYear)} tier cuts`; return; }
  if (to === null) return;
  event.preventDefault();
  steer(to);
  said.textContent = `Day ${Math.round(target)}`;
});
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

if (still.matches) {
  // One still picture: day 4, the four tiers a week apart in age, lights on.
  target = day = 4;
}
draw(true);
window.__vf = {
  get day() { return day; },
  setDay(d) { touring = false; yearT = -1; dayRun = -1; target = day = d; draw(true); },
  setHour(h) { touring = false; held = true; hour = h; dayRun = 0.01; draw(true); },
  setYear(t) { touring = false; held = true; yearFrom = day; yearT = t; draw(true); },
  set touring(v) { touring = v; },
};
