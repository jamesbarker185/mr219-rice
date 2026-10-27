// A four-tier NFT lettuce rack, compared with field lettuce on the same footprint: one pure model drives the heads,
// the lights, the timer and the readout. Lengths in cm, time in days after transplanting onto the rack.
// Field and hydroponic yields and water use are from Barbosa et al. (2015), lettuce in Yuma, Arizona;
// the rack's light follows from the LED settings below. Head growth is an illustrative logistic.

export const TIERS = 4;
export const CHANNELS = 2; // NFT gullies per tier
export const PER_CHANNEL = 9; // net cups per gully, 21 cm apart
export const HEADS_PER_TIER = CHANNELS * PER_CHANNEL;
export const RACK_M2 = 2.0 * 0.6; // footprint of the rack, m²

export const GROW = 28; // days on the rack, transplant to harvest
export const PROPAGATE = 14; // days as a seedling in the propagation cube before that
export const STAGGER = GROW / TIERS; // each tier is planted a week after the one below: one tier is cut every 7 days
export const HEAD_START = 6; // g at transplant
export const HEAD_FULL = 180; // g at harvest, a butterhead (illustrative)
export const HEAD_SPAN = 25; // cm across at harvest

// Light: red and blue LED bars under each shelf, on a 16 h day.
export const PPFD = 250; // µmol/m²/s at the canopy
export const PHOTOPERIOD = 16; // hours of light a day
export const LIGHTS_ON = 6; // the timer switches the bars on at 06:00 and off at 22:00
export const LED_EFFICACY = 2.7; // µmol/J
export const DLI = (PPFD * PHOTOPERIOD * 3600) / 1e6; // mol/m²/day, 14.4
export const LED_KWH_M2_DAY = ((PPFD / LED_EFFICACY) * PHOTOPERIOD) / 1000; // kWh per m² of tier a day

// Nutrient film: about 1 L/min down each gully at a 1 in 40 fall.
export const FLOW_L_MIN = 1;
export const FALL = 1 / 40;
export const EC = 1.6; // mS/cm
export const PH = 5.9;

// Field lettuce outdoors on the same footprint: one bed, two crops in the season.
export const FIELD = {
  days: 70, // sowing to harvest
  crops: 2,
  yieldKgM2: 3.9, // kg/m²/year
  waterLKg: 250, // L/kg
};
export const HYDRO_WATER_L_KG = 20; // L/kg, recirculating hydroponics

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Head mass after `age` days on the rack: a logistic from HEAD_START to HEAD_FULL, half grown at day 19.
export function massOf(age) {
  const raw = (d) => 1 / (1 + Math.exp(-(d - 19) / 3.6));
  const f = (raw(age) - raw(0)) / (raw(GROW) - raw(0));
  return HEAD_START + (HEAD_FULL - HEAD_START) * clamp(f, 0, 1);
}
// Size of the rosette, from the mass: the span grows with the cube root of the mass.
export const spanOf = (age) => HEAD_SPAN * Math.cbrt(massOf(age) / HEAD_FULL);
export const growOf = (age) => (massOf(age) - HEAD_START) / (HEAD_FULL - HEAD_START);

// Age of a tier on the cycle clock: tier 0 (bottom) is the oldest, each one above was planted STAGGER days later.
export const ageOf = (tier, day) => (((day + (TIERS - 1 - tier) * STAGGER) % GROW) + GROW) % GROW;
// Tiers cut by `day`: every time a tier's age wraps past GROW.
export function harvestsBy(day) {
  let n = 0;
  for (let t = 0; t < TIERS; t++) n += Math.floor((day + (TIERS - 1 - t) * STAGGER) / GROW);
  return n;
}

export const cyclesPerYear = 365 / GROW; // per tier
export const rackKgYear = (TIERS * HEADS_PER_TIER * cyclesPerYear * HEAD_FULL) / 1000;
export const rackKgM2Year = rackKgYear / RACK_M2;
export const ledKwhKg = (LED_KWH_M2_DAY * 365 * TIERS * RACK_M2) / rackKgYear;

export function stageOf(age) {
  if (age < 4) return "transplanted";
  if (age < 12) return "rosette";
  if (age < 22) return "heading";
  if (age < GROW - 1.5) return "filling";
  return "ready to cut";
}

// Lights on the timer: 1 when the bars are lit, ramped over a few minutes so nothing pops.
export function lightOf(hour) {
  const h = ((hour % 24) + 24) % 24;
  const on = smooth(LIGHTS_ON - 0.15, LIGHTS_ON + 0.15, h);
  const off = 1 - smooth(LIGHTS_ON + PHOTOPERIOD - 0.15, LIGHTS_ON + PHOTOPERIOD + 0.15, h);
  return Math.min(on, off);
}
// Light received since midnight, mol/m².
export function dliBy(hour) {
  const lit = clamp(hour - LIGHTS_ON, 0, PHOTOPERIOD);
  return (PPFD * lit * 3600) / 1e6;
}
