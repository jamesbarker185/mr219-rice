import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

// World units: 1 cm. x along the rack (drain end left, feed end right), y across, z up from the base plate.
const W = 760;
const H = 560;
const AZIMUTH = 58;
const ELEVATION = 22;

const BASE = { x: -132, y: -60, w: 322, d: 122, r: 10 };
const BASE_H = 12;
const FOOT_H = 5;
const XA = -100; // rack ends (outer faces of the end posts)
const XB = 100;
const YA = -30; // back and front (outer faces of the posts)
const YB = 30;
const PW = 3.5; // post section
const FOOT = 3; // levelling feet under the posts
const TOP = 228; // top of the posts
const TIER_Z = [50, 94, 138, 182]; // top of each shelf frame
const ROOF_Z = 226; // the light frame over the top tier
const SHELVES = [...TIER_Z, ROOF_Z];
const BEAM = 3; // beam and crossbar section
const BEAM_H = 4;
const CHAN_Y = [-13, 13];
const CHAN = { w: 10, h: 5, x0: -104, x1: 98 };
const CROSS_X = [-95, -48, 0, 48, 95];
const PLANT_X = Array.from({ length: M.PER_CHANNEL }, (_, i) => -84 + 21 * i);
const FALL = M.FALL;
const chanZ = (zt, x) => zt + 1 + (x + 98) * FALL; // gully floor: a 1 in 40 fall from the feed end to the drain end
const TANK = { x: -90, y: -22, w: 120, d: 44, r: 3 };
const TANK_H = 36;
const LEVEL = 26; // solution level in the tank
const GUTTER = { x: -111, y: -21, w: 10, d: 42, r: 1 };
const DOWN = [-106, 0]; // the drain downpipe
const RISER = [105.5, 0];
const PIPE_R = 1.5;
const PUMP = { x: 101, y: 0, z: 12 };
const CAB = { x: 134, y: -46, w: 38, d: 34, r: 1.5 };
const CAB_Z = [4, 100];
const DIAL = { x: 153, z: 72, r: 12 };
const CAB_FACE = CAB.y + CAB.d; // y = -12

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [XA - 11, YA, TOP + 1], [XB, YA, TOP + 1], [XA - 11, YB, TOP + 1], [XB + 8, YB, TOP + 1], [CAB.x + CAB.w, CAB.y, 121]],
  W,
  H,
  { pad: 12, azimuth: AZIMUTH, elevation: ELEVATION },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 2, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const poly = (points) => k.pathOf(points.map(at), true);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const TAU = Math.PI * 2;
const X = [1, 0, 0];
const Y = [0, 1, 0];
const Z = [0, 0, 1];
// A round pipe or part along x or y, from s0 to s1 along the axis through `o`.
const along = (o, axis) => (axis === "x" ? G.frameOf(o, X, Y, Z) : G.frameOf(o, Y, Z, X));
const rod = (o, axis, s0, s1, r, style = { tone: "mid" }) => S(G.disc(s0, s1, r, along(o, axis), P), style);
const post = (x, y, z0, z1, r = PIPE_R, style = { tone: "mid" }) => S(k.cylinder(x, y, r, z0, z1 - z0, P, 18), style);
const ball = (p, r, style = { tone: "mid" }) => S(G.sphereOf(p, r, P, { steps: 32 }), style);

const back = [];
const live = [];
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
// A ruler strip along the near edge, a tick every 5 cm and a long one every 25 cm: the rack is drawn to scale.
const STRIP = { x: XA, y: BASE.y + BASE.d - 14, w: 200, d: 7, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
const TICKS = k.topTicks(STRIP.x + 5, STRIP.x + STRIP.w - 5, 5, 5, STRIP.y + 0.8, 0.8, [2, 4], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2.4, STRIP.y + 3.5, 0.8]), at([STRIP.x + STRIP.w - 2.4, STRIP.y + 3.5, 0.8])], { size: 0.45 }));
// Label plate with one engraved line and three rule lines.
const LABEL = { x: 118, y: BASE.y + BASE.d - 34, w: 64, d: 22, r: 1.5 };
back.push(S(k.slabOf(LABEL, 0, 1, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.8), 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 6, LABEL.y + 8.5], 1, P, "x"), "NFT · 4 TIERS · 16 h", { size: 4.2, tone: "lo" }));
back.push(Ln([0, 1, 2].map((row) => k.onTop([[LABEL.x + 6, LABEL.y + 12.5 + row * 2.6], [LABEL.x + [54, 42, 30][row], LABEL.y + 12.5 + row * 2.6]], 1, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + 2.8, LABEL.y + LABEL.d / 2, 1]), at([LABEL.x + LABEL.w - 2.8, LABEL.y + LABEL.d / 2, 1])], { size: 0.45 }));

// ---------------------------------------------------------------- the control cabinet: timer, EC/pH display, dosing bottles
{
  const plinth = k.insetPlan(CAB, -1.2);
  back.push(`<path class="iso-halo" d="${k.haloOf(plinth, 0, 4, P)}" style="opacity:.6"/>`);
  back.push(S(slab(plinth, 0, CAB_Z[0], 3, 0.4), { tone: "lo" }));
  const fy = CAB_FACE + 0.05;
  const door = [[CAB.x + 3, CAB_Z[0] + 4], [CAB.x + CAB.w - 3, CAB_Z[0] + 4], [CAB.x + CAB.w - 3, CAB_Z[1] - 4], [CAB.x + 3, CAB_Z[1] - 4]];
  const doorLine = poly(door.map(([x, z]) => [x, fy, z]));
  back.push(S(slab(CAB, CAB_Z[0], CAB_Z[1] - CAB_Z[0], 3, 0.6), { tone: "mid", inner: Ln(doorLine, { tone: "faint" }) + Ln(k.sideSeam(CAB, CAB_Z[1] - 6, P, 3), { tone: "faint" }) }));
  // Hinges on the door's left edge, a lock on its right.
  for (const z of [CAB_Z[0] + 14, CAB_Z[1] - 14]) back.push(S(slab({ x: CAB.x + 1.6, y: CAB_FACE, w: 1.4, d: 0.9, r: 0.2 }, z - 4, 8, 2, 0), { tone: "mid" }));
  back.push(S(G.disc(0, 1.2, 1.6, along([CAB.x + CAB.w - 6, CAB_FACE, 60], "y"), P), { tone: "mid" }), Dots([at([CAB.x + CAB.w - 6, CAB_FACE + 1.25, 60])], { size: 0.45 }));
  // Segment timer: a bezel and a rotating dial (drawn live), a fixed pointer at twelve o'clock.
  const DF = G.frameOf([DIAL.x, CAB_FACE, DIAL.z], Y, Z, X);
  back.push(S(G.disc(0, 1.6, DIAL.r + 2, DF, P), { tone: "mid", inner: Ln(G.arcOf(DF, 0.8, DIAL.r + 2, P), { tone: "faint" }) }));
  back.push(S(G.disc(1.6, 2.4, DIAL.r + 0.4, DF, P), { tone: "lo" }));
  back.push(`<g data-part="timer"></g>`);
  back.push(S(G.disc(2.4, 4, 3.2, DF, P), { tone: "mid" }), Dots([at(G.pointOf(DF, 4, 0, 0))], { size: 0.6, tone: "hi" }));
  const tip = G.pointOf(DF, 2.5, DIAL.r - 1, 0);
  const pl = G.pointOf(DF, 2.5, DIAL.r + 1.8, -0.09);
  const pr = G.pointOf(DF, 2.5, DIAL.r + 1.8, 0.09);
  back.push(`<path class="iso-line" data-tone="lit" style="fill:var(--anatomy-lit)" d="${poly([pl, tip, pr])}"/>`);
  // A display window for the EC and pH meter, with its text written live, and three buttons.
  const LCD = { x0: DIAL.x - 11, x1: DIAL.x + 11, z0: 42, z1: 50 };
  back.push(S(G.prismOf(G.frameOf([0, CAB_FACE, 0], Y, X, Z), [[LCD.x0 - 1.2, LCD.z0 - 1.2], [LCD.x1 + 1.2, LCD.z0 - 1.2], [LCD.x1 + 1.2, LCD.z1 + 1.2], [LCD.x0 - 1.2, LCD.z1 + 1.2]], 0, 0.8, P), { tone: "mid" }));
  back.push(`<path class="vf-lcd" d="${poly([[LCD.x0, CAB_FACE + 0.85, LCD.z0], [LCD.x1, CAB_FACE + 0.85, LCD.z0], [LCD.x1, CAB_FACE + 0.85, LCD.z1], [LCD.x0, CAB_FACE + 0.85, LCD.z1]])}"/>`);
  back.push(Ln(poly([[LCD.x0, CAB_FACE + 0.85, LCD.z0], [LCD.x1, CAB_FACE + 0.85, LCD.z0], [LCD.x1, CAB_FACE + 0.85, LCD.z1], [LCD.x0, CAB_FACE + 0.85, LCD.z1]]), { tone: "lo" }));
  back.push(`<text class="iso-face-text vf-lcd-text" data-part="lcd" transform="${k.sideMatrix([LCD.x0 + 2, CAB_FACE + 0.9], LCD.z0 + 1.8, P, "left")}" font-size="5">06:00</text>`);
  for (const [i, x] of [DIAL.x - 8, DIAL.x, DIAL.x + 8].entries()) {
    back.push(S(G.disc(0, 1, 1.7, along([x, CAB_FACE, 34], "y"), P), { tone: i === 0 ? "hi" : "mid" }));
  }
  // Three peristaltic dosing heads (nutrient A, nutrient B, pH down), fed from bottles on the roof.
  const HEADS = [DIAL.x - 11, DIAL.x, DIAL.x + 11];
  for (const x of HEADS) {
    const F = along([x, CAB_FACE, 20], "y");
    back.push(S(G.disc(0, 1.8, 4.2, F, P), { tone: "mid", inner: Ln(G.arcOf(F, 0.9, 4.2, P), { tone: "faint" }) }));
    back.push(S(G.disc(1.8, 2.6, 3.4, F, P), { tone: "lo" }));
    back.push(Dots([0, 1, 2].map((i) => at(G.pointOf(F, 2.65, 2.1, (i / 3) * TAU + 0.4))), { size: 0.5, tone: "mid" }));
    back.push(Dots([at(G.pointOf(F, 2.65, 0, 0))], { size: 0.45, tone: "hi" }));
  }
  // Bottles on the roof.
  const BOTTLES = [CAB.x + 8, CAB.x + 19, CAB.x + 30];
  for (const [i, x] of BOTTLES.entries()) {
    const y = CAB.y + 15;
    back.push(S(k.cylinder(x, y, 4.4, CAB_Z[1], 14, P, 28), { tone: i === 2 ? "mid" : "hi", inner: Ln(k.sideArc(x, y, 4.4, CAB_Z[1] + 4, P), { tone: "faint" }) + Ln(k.sideArc(x, y, 4.4, CAB_Z[1] + 10, P), { tone: "faint" }) }));
    back.push(S(k.cylinder(x, y, 2, CAB_Z[1] + 14, 2, P, 18), { tone: "mid" }));
    back.push(S(k.cylinder(x, y, 2.5, CAB_Z[1] + 16, 2.4, P, 18), { tone: "lo" }));
  }
}

// ---------------------------------------------------------------- the rack: posts, shelf frames, gullies, lights
const postPlan = (x, y) => ({ x: x < 0 ? x : x - PW, y: y < 0 ? y : y - PW, w: PW, d: PW, r: 0.3 });
const POSTS = [XA, XB].flatMap((x) => [YA, YB].map((y) => ({ x: x === 0 ? -PW / 2 : x, y, mid: x === 0 })));
function postSvg({ x, y, mid }) {
  const plan = mid ? { x: -PW / 2, y: y < 0 ? y : y - PW, w: PW, d: PW, r: 0.3 } : postPlan(x, y);
  const cx = plan.x + PW / 2;
  const cy = plan.y + PW / 2;
  const out = [];
  out.push(S(k.cylinder(cx, cy, 2.6, 0, 0.8, P, 18), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, 1, 0.8, FOOT - 0.8, P, 12), { tone: "mid" }));
  out.push(S(slab(plan, FOOT, TOP - FOOT, 2, 0.2), { tone: "mid" }));
  // Slotted angle: a hole every 4 cm on the face toward the viewer.
  const holes = [];
  for (let z = FOOT + 6; z < TOP - 4; z += 4) holes.push(at([cx, plan.y + plan.d + 0.05, z]));
  out.push(Dots(holes, { size: 0.32, tone: "lo" }));
  out.push(S(slab(k.insetPlan(plan, -0.6), TOP, 1.2, 2, 0.2), { tone: "mid" }));
  return out.join("");
}
for (const p of POSTS.filter((p) => p.y < 0)) back.push(postSvg(p));

// A frame at height z: back beam, crossbars and front beam, drawn in three slots.
const beamPlan = (side) => ({ x: XA + PW, y: side < 0 ? YA + PW : YB - PW - BEAM, w: XB - XA - 2 * PW, d: BEAM, r: 0.3 });
const beam = (side, z) => S(slab(beamPlan(side), z - BEAM_H, BEAM_H, 2, 0.3), { tone: "mid", inner: Ln(k.sideSeam(beamPlan(side), z - 1.2, P, 2), { tone: "faint" }) });
const crossbars = (z, xs = CROSS_X) => byDepth(xs.map((x) => [x, 0])).map(([x]) => S(slab({ x: x - BEAM / 2, y: YA + PW + BEAM, w: BEAM, d: YB - YA - 2 * PW - 2 * BEAM, r: 0.3 }, z - BEAM_H + 1, BEAM_H - 1, 2, 0.3), { tone: "mid" })).join("");
const boltDots = (z) => Dots([XA + PW + 1.5, XB - PW - 1.5].map((x) => at([x, YB - PW + 0.05, z - BEAM_H / 2])), { size: 0.45 });

// Bottom frame and the tank under it.
back.push(beam(-1, 12));
back.push(crossbars(12, [-95, 95]));
// The nutrient tank: lid, two hatches, a sight tube on the near face showing the level.
{
  back.push(`<path class="iso-halo" d="${k.haloOf(TANK, 0, 2, P)}" style="opacity:.5"/>`);
  const fy = TANK.y + TANK.d + 0.05;
  back.push(S(slab(TANK, 0, TANK_H, 4, 0.4), { tone: "mid", inner: Ln(k.sideSeam(TANK, 6, P, 4) + k.sideSeam(TANK, TANK_H - 6, P, 4), { tone: "faint" }) }));
  const lid = k.insetPlan(TANK, -0.8);
  back.push(S(slab(lid, TANK_H, 2, 4, 0.4), { tone: "mid" }));
  for (const hx of [-80, 6]) {
    const hatch = { x: hx, y: -9, w: 18, d: 18, r: 1.5 };
    back.push(S(slab(hatch, TANK_H + 2, 0.8, 3, 0.2), { tone: "lo" }));
    back.push(Dots(k.corners(hatch, 2.2).map(([x, y]) => at([x, y, TANK_H + 2.8])), { size: 0.4 }));
  }
  // Sight tube: a clear tube in two clips, tinted to the solution level.
  const sx = TANK.x + TANK.w - 14;
  const tube = { x: sx - 1.4, y: fy, w: 2.8, d: 1.6, r: 0.6 };
  back.push(S(slab(tube, 4, TANK_H - 8, 2, 0), { tone: "lo", crease: "none" }));
  back.push(`<path class="vf-water" d="${poly([[sx - 1.2, fy + 1.65, 5], [sx + 1.2, fy + 1.65, 5], [sx + 1.2, fy + 1.65, LEVEL], [sx - 1.2, fy + 1.65, LEVEL]])}"/>`);
  back.push(Ln(k.pathOf([at([sx - 1.4, fy + 1.65, LEVEL]), at([sx + 1.4, fy + 1.65, LEVEL])]), { tone: "mid" }));
  for (const z of [6, TANK_H - 6]) back.push(S(slab({ x: sx - 2.4, y: fy, w: 4.8, d: 2.2, r: 0.4 }, z - 1.2, 2.4, 2, 0.2), { tone: "mid" }));
  // Level marks beside the tube, every 5 cm.
  back.push(Ln([10, 15, 20, 25, 30].map((z) => k.pathOf([at([sx + 3, fy, z]), at([sx + (z % 10 ? 5 : 6.5), fy, z])])).join(""), { tone: "lo", free: "end" }));
  // Drain cock at the bottom of the near face.
  back.push(rod([TANK.x + 12, fy, 4], "y", 0, 3, 1.4), ball([TANK.x + 12, fy + 3.6, 4], 1.8), rod([TANK.x + 12, fy + 3.6, 4], "y", 1.2, 3.4, 0.9));
  back.push(S(slab({ x: TANK.x + 12 - 0.5, y: fy + 3.1, w: 6, d: 1, r: 0.2 }, 5.6, 0.8, 2, 0), { tone: "hi" }));
}
// Suction: from the tank's feed-end face to the pump.
back.push(rod([TANK.x + TANK.w, PUMP.y, PUMP.z], "x", 0, PUMP.x - 7 - (TANK.x + TANK.w), PIPE_R));
back.push(S(G.disc(-0.6, 1.4, PIPE_R + 0.9, along([TANK.x + TANK.w, PUMP.y, PUMP.z], "x"), P), { tone: "mid" }));

// The drain end: a gutter at each tier and one downpipe back to the tank lid.
{
  const [dx, dy] = DOWN;
  const elbowZ = TANK_H + 8;
  const lidX = TANK.x + 6;
  back.push(post(dx, dy, elbowZ, TIER_Z[0] - 6));
  back.push(ball([dx, dy, elbowZ], PIPE_R + 0.5));
  back.push(rod([dx, dy, elbowZ], "x", 0, lidX - dx, PIPE_R));
  back.push(ball([lidX, dy, elbowZ], PIPE_R + 0.5));
  back.push(post(lidX, dy, TANK_H + 2.8, elbowZ));
  back.push(S(k.cylinder(lidX, dy, PIPE_R + 1, TANK_H + 2, 1.4, P, 18), { tone: "mid" }));
  TIER_Z.forEach((zt, t) => {
    const top = zt - 0.2;
    const bottom = zt - 6;
    if (t > 0) back.push(post(dx, dy, TIER_Z[t - 1] - 0.2, bottom));
    // Two brackets from the end posts.
    for (const y of [GUTTER.y + 3, GUTTER.y + GUTTER.d - 6]) back.push(S(slab({ x: GUTTER.x + GUTTER.w, y, w: XA - GUTTER.x - GUTTER.w + 0.01, d: 3, r: 0.2 }, bottom + 1, 1.5, 2, 0), { tone: "lo" }));
    back.push(S(slab(GUTTER, bottom, top - bottom, 2, 0), { tone: "mid" }));
    back.push(`<path class="iso-fill" d="${k.planOutline(k.insetPlan(GUTTER, 1), top, P, 2)}"/>`);
    back.push(`<path class="vf-water vf-water-deep" d="${k.planOutline(k.insetPlan(GUTTER, 1), top, P, 2)}"/>`);
    back.push(Ln(k.planOutline(k.insetPlan(GUTTER, 1), top, P, 2), { tone: "lo" }));
  });
}
back.push(`<g data-part="drips"></g>`);

// Bottom frame, near side.
const BOTTOM_FRONT = [beam(1, 12), boltDots(12)];

// Gullies: a rectangular channel along a 1 in 40 fall, with a lid holed for nine net cups, an end cap at the feed end.
const AXIS = G.unit3([1, 0, FALL]);
const UP = G.unit3([-FALL, 0, 1]);
const chanFrame = (zt, y) => G.frameOf([CHAN.x0, y, chanZ(zt, CHAN.x0)], AXIS, Y, UP);
const chanLen = (CHAN.x1 - CHAN.x0) / AXIS[0];
const PROFILE = [[-CHAN.w / 2, 0], [CHAN.w / 2, 0], [CHAN.w / 2, CHAN.h - 0.6], [CHAN.w / 2 - 0.6, CHAN.h], [-CHAN.w / 2 + 0.6, CHAN.h], [-CHAN.w / 2, CHAN.h - 0.6]];
const CAP = [[-CHAN.w / 2 - 0.5, -0.5], [CHAN.w / 2 + 0.5, -0.5], [CHAN.w / 2 + 0.5, CHAN.h + 0.5], [-CHAN.w / 2 - 0.5, CHAN.h + 0.5]];
const cupZ = (zt, x) => chanZ(zt, x) + CHAN.h;
function gullySvg(zt, y) {
  const F = chanFrame(zt, y);
  const out = [];
  // Shims on the crossbars set the fall.
  for (const x of byDepth(CROSS_X.map((x) => [x, y])).map(([x]) => x)) {
    const h = chanZ(zt, x) - zt;
    out.push(S(slab({ x: x - 1.5, y: y - 4, w: 3, d: 8, r: 0.2 }, zt, h, 2, 0), { tone: "lo", crease: "none" }));
  }
  const ribs = [0.3, 0.7].map((f) => k.pathOf([at(G.add3(F.o, G.add3(G.mul3(Y, CHAN.w / 2 + 0.03), G.mul3(UP, CHAN.h * f)))), at(G.add3(G.add3(F.o, G.mul3(AXIS, chanLen)), G.add3(G.mul3(Y, CHAN.w / 2 + 0.03), G.mul3(UP, CHAN.h * f))))])).join("");
  out.push(S(G.prismOf(F, PROFILE, 0, chanLen, P), { tone: "mid", inner: Ln(ribs, { tone: "faint" }) }));
  // Net cups: a rim in each hole of the lid.
  const rims = [];
  for (const x of PLANT_X) {
    const z = cupZ(zt, x);
    const rim = k.ring(x, y, 2.8, z + 0.3, P, 16);
    rims.push(`<path class="iso-fill" d="${rim}"/>`, Ln(rim, { tone: "lo" }));
  }
  out.push(rims.join(""));
  // End cap at the feed end.
  out.push(S(G.prismOf(F, CAP, chanLen, chanLen + 1.6, P), { tone: "mid" }));
  return out.join("");
}

// LED bars under a shelf at height z, lighting the tier below; a glow wash fills the tier while they are lit.
const barZ = (z) => z - BEAM_H + 1 - 0.8 - 1.6;
function ledSvg(z, tier) {
  const out = [];
  const z0 = barZ(z);
  for (const y of byDepth(CHAN_Y.map((y) => [0, y])).map(([, y]) => y)) {
    const bar = { x: -90, y: y - 2.6, w: 180, d: 5.2, r: 1 };
    out.push(S(slab(bar, z0, 1.6, 3, 0.3), { tone: "mid", inner: Ln(k.sideSeam(bar, z0 + 0.6, P, 3), { tone: "faint" }) }));
    // The lit diffuser shows as a bright lip along the bar's near lower edge.
    out.push(`<path class="vf-led" data-led="${tier}" d="${k.pathOf([at([-89, y + 2.65, z0 + 0.1]), at([89, y + 2.65, z0 + 0.1])])}"/>`);
    for (const x of [-48, 0, 48]) out.push(S(slab({ x: x - 1, y: y - 1.6, w: 2, d: 3.2, r: 0.2 }, z0 + 1.6, 0.8, 2, 0), { tone: "lo", crease: "none" }));
    // Power lead into the bar's feed end.
    out.push(Dots([at([88.4, y + 2.65, z0 + 0.8])], { size: 0.4, tone: "mid" }));
  }
  return out.join("");
}
function glowSvg(t) {
  const z0 = TIER_Z[t] + 1;
  const z1 = barZ(SHELVES[t + 1]);
  const pts = [];
  for (const x of [-94, 94]) for (const y of [-24, 24]) for (const z of [z0, z1]) pts.push(at([x, y, z]));
  const hull = G.hullOf(pts);
  return `<path class="vf-glow" data-glow="${t}" fill="url(#vf-glow-${t})" d="${k.pathOf(hull, true)}"/>`;
}
const glowDefs = TIER_Z.map((zt, t) => {
  const a = at([0, 0, barZ(SHELVES[t + 1])]);
  const b = at([0, 0, zt + 2]);
  return `<linearGradient id="vf-glow-${t}" gradientUnits="userSpaceOnUse" x1="0" y1="${a[1].toFixed(1)}" x2="0" y2="${(b[1] + 12).toFixed(1)}"><stop offset="0" stop-color="var(--vf-glow)" stop-opacity=".5"/><stop offset=".55" stop-color="var(--vf-glow)" stop-opacity=".2"/><stop offset="1" stop-color="var(--vf-glow)" stop-opacity=".05"/></linearGradient>`;
}).join("");

// Plants, drawn live, in the slot of their gully.
const PLANTS = [];
const plantSlots = (t, y) =>
  byDepth(PLANT_X.map((x) => [x, y]))
    .map(([x]) => {
      const i = PLANTS.length;
      PLANTS.push({ tier: t, x, y, z: cupZ(TIER_Z[t], x) + 0.5 });
      return `<g data-plant="${i}" class="vf-plant"></g>`;
    })
    .join("");

const rack = [];
TIER_Z.forEach((zt, t) => {
  rack.push(beam(-1, zt));
  if (t > 0) rack.push(ledSvg(zt, t - 1));
  rack.push(crossbars(zt));
  // The light wash sits behind this tier's gullies and heads, so the leaves keep their own colour.
  rack.push(glowSvg(t));
  rack.push(gullySvg(zt, CHAN_Y[0]));
  rack.push(plantSlots(t, CHAN_Y[0]));
  rack.push(gullySvg(zt, CHAN_Y[1]));
  rack.push(plantSlots(t, CHAN_Y[1]));
  rack.push(beam(1, zt), boltDots(zt));
});
rack.push(beam(-1, ROOF_Z), ledSvg(ROOF_Z, TIER_Z.length - 1), crossbars(ROOF_Z, [-95, -48, 0, 48, 95]), beam(1, ROOF_Z), boltDots(ROOF_Z));

// ---------------------------------------------------------------- the feed end: pump, riser, a manifold at each tier
const plumbing = [];
{
  const F = along([PUMP.x, PUMP.y, PUMP.z], "x");
  plumbing.push(S(slab({ x: PUMP.x - 2, y: -8, w: 28, d: 16, r: 1 }, 0, 2, 3, 0.4), { tone: "lo" }));
  for (const x of [PUMP.x + 4, PUMP.x + 15]) plumbing.push(S(slab({ x: x - 2, y: -5, w: 4, d: 10, r: 0.4 }, 2, PUMP.z - 6 - 2 + 1, 2, 0), { tone: "mid" }));
  plumbing.push(S(G.disc(-7, -4.8, 2.6, F, P), { tone: "mid" }));
  plumbing.push(S(G.disc(-4.8, 0, 7, F, P), { tone: "mid", inner: Ln(G.arcOf(F, -2.4, 7, P), { tone: "faint" }) }));
  plumbing.push(S(G.disc(0, 1.2, 6.4, F, P), { tone: "lo" }));
  const fins = G.ribsOf(F, 1.2, 15, 6, 18, P, { fade: [0.04, 0.4], seams: true });
  plumbing.push(S(G.disc(1.2, 15, 6, F, P), { tone: "hi", inner: k.fadedSvg(fins, { tone: "faint" }) }));
  plumbing.push(S(G.disc(15, 17, 5, F, P), { tone: "mid" }));
  plumbing.push(S(slab({ x: PUMP.x + 6, y: -3, w: 6, d: 6, r: 0.6 }, PUMP.z + 5.6, 3, 2, 0.3), { tone: "mid" }));
  plumbing.push(Dots([at([PUMP.x + 9, 3.05, PUMP.z + 7.1])], { size: 0.45 }));
}
{
  const [rx, ry] = RISER;
  plumbing.push(S(k.cylinder(rx, ry, PIPE_R + 1, PUMP.z + 6.6, 1.6, P, 18), { tone: "mid" }));
  const valves = [];
  TIER_Z.forEach((zt) => {
    const zm = zt + 12;
    const zf = chanZ(zt, CHAN.x1) + CHAN.h / 2;
    const half = (side) => {
      const out = [];
      const y = CHAN_Y[side];
      const F = along([rx, 0, zm], "y");
      out.push(S(G.disc(side ? 1.6 : y + 0.6, side ? y - 0.6 : -1.6, PIPE_R * 0.8, F, P), { tone: "mid" }));
      out.push(ball([rx, y, zm], PIPE_R + 0.2));
      out.push(post(rx, y, zf, zm, PIPE_R * 0.8));
      out.push(ball([rx, y, zf], PIPE_R + 0.2));
      out.push(rod([CHAN.x1 + 1.6, y, zf], "x", 0, rx - CHAN.x1 - 1.6, PIPE_R * 0.8));
      return out.join("");
    };
    plumbing.push(half(0));
    valves.push({ zm, front: half(1) });
  });
  // Riser in front of the back halves, the tee and the near halves (each with a quarter-turn valve) in front of it.
  plumbing.push(post(rx, ry, PUMP.z + 8.2, TIER_Z[3] + 12));
  for (const { zm, front: near } of valves) {
    plumbing.push(ball([rx, ry, zm], PIPE_R + 0.6));
    plumbing.push(near);
    const vy = 6.5;
    plumbing.push(S(G.disc(-1.6, 1.6, 2.2, along([rx, vy, zm], "y"), P), { tone: "mid" }));
    plumbing.push(S(k.cylinder(rx, vy, 0.6, zm + 2, 1.4, P, 10), { tone: "mid" }));
    plumbing.push(S(slab({ x: rx - 0.6, y: vy - 0.5, w: 7, d: 1, r: 0.2 }, zm + 3.4, 0.8, 2, 0), { tone: "mid" }));
  }
  plumbing.push(S(k.cylinder(rx, ry, PIPE_R + 0.6, TIER_Z[3] + 12, 1.4, P, 18), { tone: "mid" }));
}
// A cable from the pump's terminal box to the cabinet gland.
plumbing.push(k.wireSvg(at([PUMP.x + 12, 0, PUMP.z + 7.1]), at([CAB.x + 6, CAB_FACE, 10]), { via: [at([PUMP.x + 15, 3, PUMP.z + 9]), at([CAB.x + 2, CAB_FACE + 4, 14])], tone: "lo", size: 0.8 }));

// Front posts and the bottom frame, in front of everything inside the rack.
const POST_FRONT = POSTS.filter((p) => p.y > 0).map(postSvg);

// ---------------------------------------------------------------- data for the page
const DATA = { P, PLANTS, CHAN_Y, TIER_Z, CHAN, DIAL, CAB_FACE, GUTTER, FALL, chanEnd: TIER_Z.flatMap((zt) => CHAN_Y.map((y) => [CHAN.x0, y, chanZ(zt, CHAN.x0)])) };

const LABEL_TEXT =
  "A model of a four-tier vertical farm rack, to scale. Each tier carries two sloping hydroponic gullies of butterhead lettuce, nine heads each, lit by red and blue LED bars under the shelf above. Nutrient solution is pumped from a tank under the rack up a riser to every gully, runs down the gullies in a thin film past the roots and drains back from gutters at the far end. A cabinet beside it holds a 24-hour segment timer, an EC and pH display and dosing pumps. Each tier is planted a week after the one below, so the lettuce on the four tiers is at four ages and one tier is cut every week.";

const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [`<defs>${glowDefs}</defs>`, ...back, ...BOTTOM_FRONT, `<g data-part="live">${rack.join("")}</g>`, ...plumbing, ...POST_FRONT, ...front] });
const stage = `<div class="vf-stage" tabindex="0" role="slider" aria-roledescription="crop cycle" aria-valuemin="0" aria-valuemax="${M.GROW}" aria-valuenow="0" aria-label="A four-tier vertical farm rack of lettuce. Move the pointer across the figure, or press the arrow keys, to run four weeks of the crop cycle. Press L or click to run one day on the light timer, and Y to run a year of harvests."><span class="vf-said" aria-live="polite"></span>${svg}</div>`;

const row = (label, key, field) => `<tr><th>${label}</th><td data-cell="field-${key}">${field}</td><td data-cell="rack-${key}">—</td></tr>`;
const table = `<table class="vf-table" aria-label="Live readout"><thead><tr><th></th><th>Field, outdoors<span>same footprint</span></th><th>This rack<span>4 tiers</span></th></tr></thead><tbody>${row("Lettuce on the footprint now", "crop", "—")}${row("Seed to harvest", "days", `${M.FIELD.days} days`)}${row("Harvests a year", "harvests", `${M.FIELD.crops}`)}${row("Yield per m² of floor, a year", "yield", `${M.FIELD.yieldKgM2} kg`)}${row("Water per kg", "water", `${M.FIELD.waterLKg} L`)}${row("Light today", "light", "sun")}${row("Electricity per kg", "power", "—")}</tbody></table>`;

const caption = `Each tier carries ${M.CHANNELS} gullies of ${M.PER_CHANNEL} butterhead lettuce (${M.HEADS_PER_TIER} heads on ${M.RACK_M2.toFixed(1)} m²). Seedlings come from ${M.PROPAGATE} days in a propagation cube and spend ${M.GROW} days on the rack, growing to about ${M.HEAD_FULL} g. The tiers are planted ${M.STAGGER} days apart, so one tier is cut and replanted every week and the rack never stands empty: ${Math.round(M.TIERS * M.cyclesPerYear)} tier harvests a year, about ${Math.round(M.rackKgYear)} kg, or ${Math.round(M.rackKgM2Year)} kg per m² of floor against about ${M.FIELD.yieldKgM2} kg for field lettuce. A pump lifts the solution (EC ${M.EC} mS/cm, pH ${M.PH}) to every gully; it runs down a 1 in 40 fall past the roots and back to the tank, so the rack uses about ${M.HYDRO_WATER_L_KG} L of water per kg instead of ${M.FIELD.waterLKg} L. The price is light: the LED bars give ${M.PPFD} µmol/m²/s for ${M.PHOTOPERIOD} h a day, a daily light integral of ${M.DLI.toFixed(1)} mol/m², which at ${M.LED_EFFICACY} µmol/J is about ${M.LED_KWH_M2_DAY.toFixed(1)} kWh per m² of tier a day, or ${Math.round(M.ledKwhKg)} kWh per kg of lettuce before cooling. Field and hydroponic yield and water figures are from Barbosa et al. (2015); head growth and mass are illustrative. Drawn to scale, 1 unit = 1 cm, ruler ticks every 5 cm.`;

const body = `<div class="vf">${k.plateHtml({
  fig: "Fig 1",
  title: "Vertical farm, four tiers",
  hint: "Move for 4 weeks · L day · Y year",
  readout: "Day 0",
  keys: [
    { mark: "lit", label: "Timer pointer: lights on 06:00–22:00" },
    { mark: "raised", label: "Rack, gullies, tank and cabinet" },
    { mark: "flat", label: "LED light and nutrient film" },
  ],
  caption,
  body: `<span class="vf-credit">NFT lettuce · LED</span>${stage}${table}`,
})}</div>`;

const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "").replace(/\blightOf\b/g, "lightAt");
const CSS = readFileSync(join(HERE, "vf.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Vertical farm", theme, body: `<style>${CSS}</style>${body}`, script: kitScript() + MODEL + LIVE, width: 800 });
const URL = "https://jamesbarker185.github.io/mr219-rice/vertical-farm/";
const META = [
  `<meta name="description" content="How a four-tier vertical farm rack grows lettuce: LED light, a nutrient film and staggered planting, against field lettuce on the same footprint.">`,
  `<meta property="og:title" content="Vertical farm, four tiers">`,
  `<meta property="og:description" content="Four tiers of NFT lettuce under LED bars, planted a week apart: a tier cut every week, about ${Math.round(M.rackKgM2Year)} kg per m² of floor a year, paid for in light.">`,
  `<meta property="og:image" content="${URL}preview.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="1200">`,
  `<meta property="og:url" content="${URL}"><meta name="twitter:card" content="summary_large_image">`,
].join("");
const name = theme === "light" ? "vertical-farm.html" : "vertical-farm-dark.html";
writeFileSync(join(HERE, name), page.replace("</title>", `</title>${META}`));
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`);
