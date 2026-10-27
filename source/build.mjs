import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

// World units: 1 cm. x along the plot (tall row left, MR219 right), y across, z up from the base plate.
const W = 760;
const H = 480;
const AZIMUTH = 58;
const ELEVATION = 26;

const BASE = { x: -262, y: -134, w: 446, d: 166, r: 10 };
const BASE_H = 12;
const FOOT_H = 5;
const TRAY = { x: -240, y: -70, w: 400, d: 76, r: 2 };
const BLOCK = { x: -238, y: -68, w: 396, d: 72, r: 0.6 };
const Z0 = 4; // tray floor
const PAN = [20, 25]; // plough pan
const ZS = 44; // soil surface
const ZW = 51; // flood water, 7 cm deep
const ZB = 62; // bund top
const YC = BLOCK.y + BLOCK.d; // the cut face, y = 4
const XL = BLOCK.x;
const XR = BLOCK.x + BLOCK.w;
const BUND_L = [[XL, ZS], [XL + 32, ZS], [XL + 22, ZB], [XL, ZB]];
const BUND_R = [[XR - 32, ZS], [XR, ZS], [XR, ZB], [XR - 22, ZB]];
const bundIn = (side, z) => (side < 0 ? XL + 32 - (10 * (z - ZS)) / (ZB - ZS) : XR - 32 + (10 * (z - ZS)) / (ZB - ZS));
const WATER_X = [bundIn(-1, ZW), bundIn(1, ZW)];

const ROWS = [-48, -23, 2];
const COLS = { tall: [-82, -56], mr219: [56, 82] };
const POST = [0, -23];
const POST_W = 3.2;
const POST_TOP = ZS + 166;
const WHEEL = { x: 66, y: -116, z: 150, r: 34, t: 4 };
const ANEMO = [XR - 10, -58];
const ANEMO_TOP = ZB + 74;

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [-82, -23, ZS + 152], [0, -23, POST_TOP + 6], [WHEEL.x, WHEEL.y, WHEEL.z + WHEEL.r + 4], [ANEMO[0], ANEMO[1], ANEMO_TOP + 6]],
  W,
  H,
  { pad: 14, azimuth: AZIMUTH, elevation: ELEVATION },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 3, bevel = 0.5) => k.slabOf(plan, z, h, P, steps, bevel);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const poly = (points) => k.pathOf(points.map(at), true);
const shadeOf = (normal) => Math.min(3, G.toneOf(normal, P));
const onY = (y, pts) => pts.map(([x, z]) => [x, y, z]);
const onX = (x, pts) => pts.map(([y, z]) => [x, y, z]);

function faceSvg(points, normal, { tone = "mid", inner = "", className } = {}) {
  const d = poly(points);
  return `<g class="iso-solid${className ? ` ${className}` : ""}"><path class="iso-fill" d="${d}"/><path class="iso-shade" data-shade="${shadeOf(normal)}" d="${d}"/>${inner}<path class="iso-line iso-edge" data-tone="${tone}" d="${d}"/></g>`;
}
// A tinted region on a face: a fill only, the face's own edges stay in charge.
const tint = (points, cls) => `<path class="${cls}" d="${poly(points)}"/>`;

// Seeded random, so every build draws the same soil and the same plants.
let seed = 219;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const back = [];
const front = [];

// ---------------------------------------------------------------- base plate
back.push(`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`);
for (const [x, y] of byDepth([...k.corners(BASE, 22), [BASE.x + BASE.w / 2, BASE.y + 22], [BASE.x + BASE.w / 2, BASE.y + BASE.d - 22]])) {
  back.push(S(k.cylinder(x, y, 9, -BASE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 7, -BASE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
}
back.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(BASE, 6), 0, P), { tone: "lo" }));
const SCREWS = k.corners(BASE, 13);
back.push(Ln(SCREWS.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
const SIDE = k.sideTicks(BASE.x + 24, BASE.x + BASE.w - 24, 10, 5, BASE.y + BASE.d, 0, [2.2, 4.4], P, "x");
back.push(Ln(SIDE.minor, { tone: "lo" }), Ln(SIDE.major, { tone: "mid" }));
// A ruler strip along the near edge, one tick per 5 cm, a long one every 25 cm: the plot is drawn to scale.
const STRIP = { x: -236, y: BASE.y + BASE.d - 14, w: 250, d: 7, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
const TICKS = k.topTicks(STRIP.x + 5, STRIP.x + STRIP.w - 5, 5, 5, STRIP.y + 0.8, 0.8, [2, 4], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2.4, STRIP.y + 3.5, 0.8]), at([STRIP.x + STRIP.w - 2.4, STRIP.y + 3.5, 0.8])], { size: 0.45 }));
// Label plate with one engraved line and three rule lines.
const LABEL = { x: 76, y: BASE.y + BASE.d - 34, w: 72, d: 22, r: 1.5 };
back.push(S(k.slabOf(LABEL, 0, 1, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.8), 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 6, LABEL.y + 8.5], 1, P, "x"), "MARDI · MR219 · 2001", { size: 4.2, tone: "lo" }));
back.push(Ln([0, 1, 2].map((row) => k.onTop([[LABEL.x + 6, LABEL.y + 12.5 + row * 2.6], [LABEL.x + [60, 46, 32][row], LABEL.y + 12.5 + row * 2.6]], 1, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + 2.8, LABEL.y + LABEL.d / 2, 1]), at([LABEL.x + LABEL.w - 2.8, LABEL.y + LABEL.d / 2, 1])], { size: 0.45 }));

// ---------------------------------------------------------------- calendar wheel on its stand, behind the plot
// A disc standing in the x–z plane facing +y. Angle 0 is 1 January at the top, turning clockwise as seen.
const WF = G.frameOf([WHEEL.x, WHEEL.y, WHEEL.z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
const STAND = { x: WHEEL.x - 3, y: WHEEL.y - 4, w: 6, d: 6, r: 1 };
const FOOT = { x: WHEEL.x - 16, y: WHEEL.y - 10, w: 32, d: 18, r: 2 };
back.push(`<path class="iso-halo" d="${k.haloOf(FOOT, 0, 3, P)}" style="opacity:.5"/>`);
back.push(S(slab(FOOT, 0, 3, 3, 0.5), { tone: "lo" }));
back.push(Dots([at([FOOT.x + 4, FOOT.y + 4, 3]), at([FOOT.x + FOOT.w - 4, FOOT.y + 4, 3]), at([FOOT.x + 4, FOOT.y + FOOT.d - 4, 3]), at([FOOT.x + FOOT.w - 4, FOOT.y + FOOT.d - 4, 3])], { size: 0.45 }));
back.push(S(slab(STAND, 3, WHEEL.z - 3, 2, 0.4), { tone: "mid", inner: Ln(k.sideSeam(STAND, 40, P, 2) + k.sideSeam(STAND, 80, P, 2), { tone: "faint" }) }));
back.push(S(G.disc(-1, 0, 6, WF, P), { tone: "mid" }));
back.push(S(G.disc(0, WHEEL.t, WHEEL.r, WF, P), { tone: "mid", inner: Ln(G.arcOf(WF, WHEEL.t / 2, WHEEL.r, P), { tone: "faint" }) }));
const FACE = WHEEL.t + 0.05;
const onWheel = (r, a) => G.pointOf(WF, FACE, r, a);
const TAU = Math.PI * 2;
const YEAR = 365;
const angleOfDay = (d) => (d / YEAR) * TAU;
const RING = { mr: [24, 30.5], tall: [15, 21] };
back.push(Ln(G.circleOf(WF, FACE, RING.mr[0], P) + G.circleOf(WF, FACE, RING.mr[1], P) + G.circleOf(WF, FACE, RING.tall[0], P) + G.circleOf(WF, FACE, RING.tall[1], P), { tone: "faint" }));
// Month ticks from the rim: one per month, long at each quarter, short half-month ticks between.
{
  const minor = [];
  const major = [];
  for (let m = 0; m < 24; m++) {
    const a = (m / 24) * TAU;
    const long = m % 6 === 0;
    const len = m % 2 ? 1.6 : long ? 4 : 2.6;
    (long ? major : minor).push(k.pathOf([at(onWheel(WHEEL.r - 0.4, a)), at(onWheel(WHEEL.r - 0.4 - len, a))]));
  }
  back.push(Ln(minor.join(""), { tone: "lo" }), Ln(major.join(""), { tone: "mid" }));
}
// The crop arcs: an outline for each season, and a fill that grows as the hand sweeps past (live).
const sector = (r0, r1, d0, d1) => {
  const pts = [];
  const n = Math.max(6, Math.ceil(((d1 - d0) / YEAR) * 90));
  for (let i = 0; i <= n; i++) pts.push(onWheel(r1, angleOfDay(d0 + ((d1 - d0) * i) / n)));
  for (let i = n; i >= 0; i--) pts.push(onWheel(r0, angleOfDay(d0 + ((d1 - d0) * i) / n)));
  return pts;
};
const ARCS = [
  ...M.SEASONS.mr219.map((s, i) => ({ key: `mr${i}`, ring: RING.mr, from: s.from, days: s.days })),
  ...M.SEASONS.tall.map((s, i) => ({ key: `tall${i}`, ring: RING.tall, from: s.from, days: s.days })),
];
for (const arc of ARCS) {
  back.push(`<path data-arc="${arc.key}" class="mr-arc mr-arc-${arc.key.startsWith("mr") ? "mr" : "tall"}" d=""/>`);
  back.push(Ln(poly(sector(arc.ring[0], arc.ring[1], arc.from, arc.from + arc.days)), { tone: arc.key.startsWith("mr") ? "hi" : "mid" }));
}
back.push(`<path data-part="hand" class="iso-line" data-tone="hi" data-free="end" style="stroke-width:1" d=""/>`);
back.push(S(G.disc(FACE, FACE + 1.6, 3, WF, P), { tone: "mid" }));
back.push(Dots([at(G.pointOf(WF, FACE + 1.6, 0, 0))], { size: 0.6, tone: "hi" }));
back.push(Dots([0.25, 0.75].flatMap((f) => [onWheel(WHEEL.r - 7.5, f * TAU)]).map(at), { size: 0.4 }));

// ---------------------------------------------------------------- the soil box: tray, cut block, bunds, water
back.push(`<path class="iso-halo" d="${k.haloOf(TRAY, 0, 4, P)}" style="opacity:.6"/>`);
back.push(S(slab(TRAY, 0, Z0, 3, 0.4), { tone: "lo" }));
back.push(S(slab(BLOCK, Z0, ZS - Z0, 2, 0), { tone: "mid", crease: "none" }));
// Horizons on the cut face (+y) and the end face (+x): puddled mud, the plough pan, subsoil.
const fy = YC + 0.05;
const fx = XR + 0.05;
back.push(tint(onY(fy, [[XL, PAN[1]], [XR, PAN[1]], [XR, ZS], [XL, ZS]]), "mr-mud"));
back.push(tint(onY(fy, [[XL, PAN[0]], [XR, PAN[0]], [XR, PAN[1]], [XL, PAN[1]]]), "mr-pan"));
back.push(tint(onY(fy, [[XL, Z0], [XR, Z0], [XR, PAN[0]], [XL, PAN[0]]]), "mr-sub"));
back.push(tint(onX(fx, [[BLOCK.y, PAN[1]], [YC, PAN[1]], [YC, ZS], [BLOCK.y, ZS]]), "mr-mud"));
back.push(tint(onX(fx, [[BLOCK.y, PAN[0]], [YC, PAN[0]], [YC, PAN[1]], [BLOCK.y, PAN[1]]]), "mr-pan"));
back.push(tint(onX(fx, [[BLOCK.y, Z0], [YC, Z0], [YC, PAN[0]], [BLOCK.y, PAN[0]]]), "mr-sub"));
back.push(Ln(k.pathOf(onY(fy, [[XL, PAN[0]], [XR, PAN[0]]]).map(at)) + k.pathOf(onY(fy, [[XL, PAN[1]], [XR, PAN[1]]]).map(at)) + k.pathOf(onX(fx, [[BLOCK.y, PAN[0]], [YC, PAN[0]]]).map(at)) + k.pathOf(onX(fx, [[BLOCK.y, PAN[1]], [YC, PAN[1]]]).map(at)), { tone: "lo" }));
// Specks: grit and shell in the mud, stones in the subsoil, cracks in the pan.
{
  const grit = [];
  const stones = [];
  for (let i = 0; i < 150; i++) {
    const x = XL + 4 + rnd() * (BLOCK.w - 8);
    const z = PAN[1] + 1.5 + rnd() * (ZS - PAN[1] - 3);
    grit.push(at([x, fy, z]));
  }
  for (let i = 0; i < 26; i++) {
    const x = XL + 8 + rnd() * (BLOCK.w - 16);
    const z = Z0 + 3 + rnd() * (PAN[0] - Z0 - 6);
    const r = 0.8 + rnd() * 1.4;
    const pts = [];
    for (let j = 0; j < 9; j++) {
      const a = (j / 9) * TAU;
      pts.push([x + Math.cos(a) * r * (0.8 + 0.4 * rnd()), z + Math.sin(a) * r * 0.7]);
    }
    stones.push(poly(onY(fy, pts)));
  }
  back.push(Dots(grit, { size: 0.35, tone: "lo" }));
  back.push(`<path class="mr-stone" d="${stones.join("")}"/>`, Ln(stones.join(""), { tone: "lo" }));
  const cracks = [];
  for (let x = XL + 14; x < XR - 10; x += 19 + rnd() * 12) cracks.push(k.pathOf([at([x, fy, PAN[0]]), at([x + 1.2, fy, PAN[0] + 2.4]), at([x + 0.4, fy, PAN[1]])]));
  back.push(Ln(cracks.join(""), { tone: "lo" }));
}
// Bunds at both ends: earth ridges, trapezoids along y, with their cut ends on the face.
const BF = G.frameOf([0, BLOCK.y, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const bund = (section) => S(G.prismOf(BF, section, 0, BLOCK.d, P), { tone: "mid" });
back.push(bund(BUND_L));
// Water: a translucent sheet between the bunds, and its band on the cut face.
const WATER_TOP = [[WATER_X[0], BLOCK.y, ZW], [WATER_X[1], BLOCK.y, ZW], [WATER_X[1], YC, ZW], [WATER_X[0], YC, ZW]];
back.push(`<path class="mr-water" d="${poly(WATER_TOP)}"/>`);
back.push(`<path class="mr-water mr-water-face" d="${poly(onY(fy, [[bundIn(-1, ZS), ZS], [bundIn(1, ZS), ZS], [WATER_X[1], ZW], [WATER_X[0], ZW]]))}"/>`);
back.push(Ln(k.pathOf([at([WATER_X[0], YC, ZW]), at([WATER_X[1], YC, ZW]), at([WATER_X[1], BLOCK.y, ZW])]), { tone: "mid" }));
back.push(`<g data-part="ripples"></g>`);
// A water-depth board on the right bund's cut end.
back.push(bund(BUND_R));
{
  const bx = XR - 18;
  const by = -2;
  back.push(faceSvg([[bx - 2.5, by, ZS - 2], [bx + 2.5, by, ZS - 2], [bx + 2.5, by, ZB + 10], [bx - 2.5, by, ZB + 10]], [0, 1, 0], { tone: "lo" }));
}
// The roots on the cut face, drawn live.
back.push(`<g data-part="roots"></g>`);

// ---------------------------------------------------------------- anemometer on the right bund
{
  const [ax, ay] = ANEMO;
  back.push(S(k.cylinder(ax, ay, 4, ZB, 2, P, 20), { tone: "lo" }));
  back.push(S(k.cylinder(ax, ay, 1.1, ZB + 2, ANEMO_TOP - ZB - 6, P, 14), { tone: "mid", crease: "none" }));
  back.push(S(k.cylinder(ax, ay, 2.2, ANEMO_TOP - 4, 4, P, 18), { tone: "mid" }));
  back.push(`<g data-part="cups"></g>`);
}

// ---------------------------------------------------------------- the plants and the gauge post, drawn live in depth order
const HILLS = [];
for (const [variety, xs] of Object.entries(COLS)) for (const x of xs) for (const y of ROWS) HILLS.push({ variety, x, y });
const ITEMS = [...HILLS.map((h, i) => ({ kind: "hill", i, depth: k.depthOf([h.x, h.y, 0], P) })), { kind: "post", depth: k.depthOf([POST[0], POST[1], 0], P) }].sort((a, b) => a.depth - b.depth);
const live = [];
for (const item of ITEMS) {
  if (item.kind === "hill") {
    live.push(`<g data-hill="${item.i}" class="mr-hill"></g>`);
    continue;
  }
  // The gauge post: square, planted in the mud, a cm scale on its two visible faces from the soil surface.
  const [px, py] = POST;
  const h = POST_W / 2;
  const plan = { x: px - h, y: py - h, w: POST_W, d: POST_W, r: 0.3 };
  const out = [];
  out.push(Ln(k.ring(px, py, 3.4, ZW, P, 18), { tone: "lo" }));
  out.push(S(slab(plan, ZW, POST_TOP - ZW, 2, 0.3), { tone: "hi", crease: "faint" }));
  const minor = [];
  const major = [];
  for (let cm = 10; cm <= POST_TOP - ZS - 2; cm += 5) {
    const z = ZS + cm;
    const big = cm % 50 === 0;
    const mid = cm % 10 === 0;
    const len = big ? 2.2 : mid ? 1.5 : 0.9;
    (big || mid ? major : minor).push(k.segment([px + h - len, py + h + 0.05, z], [px + h, py + h + 0.05, z], P) + k.segment([px + h + 0.05, py + h, z], [px + h + 0.05, py + h - len, z], P));
  }
  out.push(Ln(minor.join(""), { tone: "lo" }), Ln(major.join(""), { tone: "mid" }));
  out.push(S(slab({ x: px - h - 0.5, y: py - h - 0.5, w: POST_W + 1, d: POST_W + 1, r: 0.4 }, POST_TOP, 1.6, 2, 0.3), { tone: "mid" }));
  // Two cursors that ride the post: the tall variety's to the left, MR219's (lit) to the right.
  const cursor = (dir, lit) => {
    const collar = { x: px - h - 0.8, y: py - h - 0.8, w: POST_W + 1.6, d: POST_W + 1.6, r: 0.4 };
    const armPlan = dir > 0 ? { x: px + h + 0.8, y: py - 0.6, w: 13, d: 1.2, r: 0.2 } : { x: px - h - 0.8 - 13, y: py - 0.6, w: 13, d: 1.2, r: 0.2 };
    const tipX = dir > 0 ? armPlan.x + armPlan.w : armPlan.x;
    return (
      S(slab(collar, -1.2, 2.4, 2, 0.3), { tone: "mid" }) +
      S(slab(armPlan, -0.5, 1, 2, 0), { tone: lit ? "hi" : "mid" }) +
      Ln(k.lineOnTop([px + h + 0.8 * Math.sign(dir), py], [tipX, py], 0.5, P), { tone: lit ? "lit" : "lo" }) +
      Dots([at([tipX, py, 0.5])], { size: 0.55, tone: lit ? "hi" : "mid" })
    );
  };
  out.push(`<g data-part="cursor-tall">${cursor(-1, false)}</g>`);
  out.push(`<g data-part="cursor-mr">${cursor(1, true)}</g>`);
  live.push(out.join(""));
}

// ---------------------------------------------------------------- the box frame: steel angle at the four corners, a rim along the back
const corner = (x, y) => S(slab({ x: x - 1.4, y: y - 1.4, w: 2.8, d: 2.8, r: 0.3 }, Z0, ZB + 4 - Z0, 2, 0.3), { tone: "mid" });
const BACK_CORNERS = [corner(XL - 1, BLOCK.y - 1), corner(XR + 1, BLOCK.y - 1)];
back.splice(back.findIndex((s) => s.includes("iso-halo") && s.includes("opacity:.6")) + 2, 0, ...BACK_CORNERS);
front.push(corner(XL - 1, YC + 1), corner(XR + 1, YC + 1));
front.push(Dots([[XL - 1, YC + 1], [XR + 1, YC + 1]].flatMap(([x, y]) => [at([x, y + 1.4, Z0 + 6]), at([x, y + 1.4, ZB - 2])]), { size: 0.4 }));
front.push(`<g data-part="rain"></g>`);

// ---------------------------------------------------------------- data for the page
const DATA = { P, ZS, ZW, YC, XL, XR, WATER_X, BLOCK, HILLS, POST, ANEMO, ANEMO_TOP, WF, FACE, WHEEL, RING, ARCS, PAN };

const LABEL_TEXT =
  "A cutaway box of a flooded rice plot, to scale, between two earth bunds. The cut face shows puddled mud, the plough pan and subsoil, with roots. On the left grow hills of a tall traditional rice variety, on the right the semi-dwarf MR219, with a measuring post between them marked in centimetres. Behind stands a calendar wheel with the crop seasons of the year. As the season runs, both rows grow from seedlings to ripe drooping panicles; then a gust of wind and rain bends the tall row over into the water while MR219 sways and stays upright; then the wheel turns through a year, fitting two MR219 crops against one tall crop.";

const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, `<g data-part="live">${live.join("")}</g>`, ...front] });
const stage = `<div class="mr-stage" tabindex="0" role="slider" aria-roledescription="season" aria-valuemin="0" aria-valuemax="${M.DAYS}" aria-valuenow="0" aria-label="MR219 and a tall rice variety. Move the pointer across the figure, or press the arrow keys, to run the season from sowing to ripe grain. Press G or click for a gust of wind and rain, and Y to turn the calendar through a year."><span class="mr-said" aria-live="polite"></span>${svg}</div>`;

const row = (label, key) => `<tr><th>${label}</th><td data-cell="tall-${key}">—</td><td data-cell="mr-${key}">—</td></tr>`;
const table = `<table class="mr-table" aria-label="Live readout"><thead><tr><th></th><th>Tall traditional<span>illustrative</span></th><th>MR219</th></tr></thead><tbody>${row("Plant height", "height")}${row("Grain load per hill", "load")}${row("Lodged plants", "lodged")}${row("Yield per hectare", "yield")}${row("Crops per year", "crops")}</tbody></table>`;

const T = M.VARIETIES.tall;
const R = M.VARIETIES.mr219;
const caption = `MARDI declared MR219 in 2001. Older tall varieties grew ${T.height - 8}–${T.height + 2} cm high on soft, hollow culms; once the panicles filled, wind and rain pushed them over (lodging) into the flood water, where the grain rots, sprouts or cannot be cut. MR219 is a semi-dwarf, about 56–90 cm, with stiff culms and short, erect leaves, so a heavy panicle bends its head but not the plant. It yields about ${R.yieldRange[0]}–${R.yieldRange[1]} t/ha and matures in about 105–111 days from sowing, short enough for two crops a year in the granary areas, main season and off season. On the calendar wheel (January at the top) the gold arcs are MR219's two crops, main season from early September and off season from early March; the grey arc is the tall variety's single crop. Plants, soil and water are drawn to scale (1 unit = 1 cm; ruler ticks every 5 cm). The tall variety's height, ${T.maturity}-day season, ${T.yield} t/ha and its lodging are illustrative, and so are the grain loads, from yield at ${M.HILLS_PER_M2} hills/m² (25 × 25 cm).`;

const body = `<div class="mr">${k.plateHtml({
  fig: "Fig 1",
  title: "MR219 rice, MARDI, 2001",
  hint: "Move across for the season · G gust · Y year",
  readout: "Day 0 · seedlings",
  keys: [
    { mark: "lit", label: "MR219's height on the post" },
    { mark: "raised", label: "Soil box, bunds, post and calendar wheel" },
    { mark: "flat", label: "Flood water, 7 cm deep" },
  ],
  caption,
  body: `<span class="mr-credit">Bred by MARDI</span>${stage}${table}`,
})}</div>`;

const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const CSS = readFileSync(join(HERE, "mr.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "MR219 rice", theme, body: `<style>${CSS}</style>${body}`, script: kitScript() + MODEL + LIVE, width: 800 });
const name = theme === "light" ? "mr219-rice.html" : "mr219-rice-dark.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`);
