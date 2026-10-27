// MR219 (MARDI, 2001) beside a tall traditional variety: one pure model drives the plants, the gauge and the readout.
// Heights in cm, time in days after sowing. Figures marked "illustrative" stand for a typical tall traditional
// variety, not one named cultivar.

export const VARIETIES = {
  tall: {
    name: "Tall traditional",
    height: 148, // 140–150 cm
    heading: 112,
    maturity: 150, // photoperiod-sensitive, one main-season crop (illustrative)
    tillers: 6,
    yield: 2.5, // t/ha, illustrative
    crops: 1,
    strength: 0.9, // relative culm strength, illustrative
    leaf: { length: 62, out: 0.42, droop: 1.5 },
    panicle: 27,
    droop: 2.3,
  },
  mr219: {
    name: "MR219",
    height: 80, // semi-dwarf, 56–90 cm
    heading: 78,
    maturity: 108, // 105–111 days
    tillers: 9,
    yield: 7, // 6–8 t/ha
    yieldRange: [6, 8],
    crops: 2,
    strength: 1.6,
    leaf: { length: 36, out: 0.14, droop: 0.35 },
    panicle: 23,
    droop: 1.7,
  },
};

export const HILLS_PER_M2 = 16; // 25 × 25 cm transplanting grid
export const DAYS = 150;
export const LODGED_LOSS = 0.55; // share of a lodged tiller's grain lost to submergence and harvest (illustrative)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Plant height from the soil, to the top of the plant: logistic stem elongation that ends at heading.
export function heightOf(v, day) {
  const mid = v.heading * 0.58;
  const raw = (d) => 1 / (1 + Math.exp(-(d - mid) / (v.heading * 0.13)));
  const f = (raw(day) - raw(0)) / (raw(v.heading + 8) - raw(0));
  return 6 + (v.height - 6) * clamp(f, 0, 1);
}

// 0 before heading, 1 when the grain is full (a few days before harvest maturity).
export const fillOf = (v, day) => smooth(v.heading + 3, v.maturity - 4, day);
export const ripeOf = (v, day) => smooth(v.maturity - 22, v.maturity, day);
export const exsertOf = (v, day) => smooth(v.heading - 4, v.heading + 4, day);
export const tillersOf = (v, day) => clamp(Math.floor(1 + (day - 12) / 5), 1, v.tillers);

// Grain per hill at full fill, from the yield: 1 t/ha = 100 g/m².
export const fullLoadOf = (v) => (v.yield * 100) / HILLS_PER_M2;
export const loadOf = (v, day) => fullLoadOf(v) * fillOf(v, day);

// Lodging index of a tiller: the base must carry a heavier, higher head against the gust, on a weaker culm.
export function lodgingIndex(v, day, gust) {
  const h = heightOf(v, day) / 100;
  return (h * h * (0.4 + 1.1 * fillOf(v, day)) * gust) / v.strength;
}

export function yieldOf(v, lodged) {
  return v.yield * (1 - LODGED_LOSS * lodged);
}

export function stageOf(v, day) {
  if (day >= v.maturity) return "ripe";
  if (day >= v.heading + 3) return "grain filling";
  if (day >= v.heading - 4) return "heading";
  if (day >= v.heading - 30) return "panicle initiation";
  if (day >= 18) return "tillering";
  return "seedling";
}

// The crop calendar of a granary area (MADA, Kedah), as day of the year 0–365.
export const SEASONS = {
  mr219: [
    { from: 244, days: 108 }, // main season, sown early September
    { from: 60, days: 108 }, // off season, sown early March
  ],
  tall: [{ from: 244, days: 150 }], // one main-season crop, sown with it, cut late January
};
