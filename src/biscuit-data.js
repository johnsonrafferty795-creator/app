/* The sixth app: an idle biscuit game.
 *
 * This file is the rules — buildings, upgrades, achievements, and the maths
 * that turns them into a number per second. It holds no React and touches no
 * storage, so the whole economy can be reasoned about (and corrected) without
 * opening the screen code. `biscuit-app.jsx` is the only thing that imports
 * it, which keeps the promise the other five apps make: none can break another.
 *
 * On the genre it belongs to: the shape is the well-worn one — tap a thing,
 * buy something that taps it for you, buy something that buys those. The
 * numbers below are tuned to that shape. Everything written on top of them is
 * this app's own.
 */

/* ============================ numbers ============================ */

/* Short scale, because that is what the game is counted in. Past the end of
   the table it falls back to an exponent, which is honest and unambiguous. */
const SCALE = [
  "", " thousand", " million", " billion", " trillion", " quadrillion",
  " quintillion", " sextillion", " septillion", " octillion", " nonillion",
  " decillion", " undecillion", " duodecillion", " tredecillion",
  " quattuordecillion", " quindecillion",
];

const SHORT = [
  "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No",
  "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc",
];

/* 1.20 reads worse than 1.2, and 4.0 worse than 4. */
const trim = (s) => (s.indexOf(".") < 0 ? s : s.replace(/\.?0+$/, ""));

/* Three significant figures is the most anyone reads off a counter, and the
   least that still shows a number moving. */
export function fmt(n, notation = "words") {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  if (!Number.isFinite(n)) return "∞";
  if (n < 0) return `-${fmt(-n, notation)}`;
  if (n < 1) return n === 0 ? "0" : trim(n.toFixed(n < 0.01 ? 3 : 2));
  if (n < 1000) return n % 1 === 0 ? String(n) : trim(n.toFixed(1));
  if (n < 1e6) return Math.floor(n).toLocaleString("en-GB");

  let tier = Math.floor(Math.log10(n) / 3);
  /* log10 of a number sitting exactly on a power of ten can land a hair low */
  if (n >= Math.pow(1000, tier + 1)) tier += 1;
  if (tier >= SCALE.length) {
    const exp = Math.floor(Math.log10(n));
    return `${trim((n / Math.pow(10, exp)).toFixed(2))}e${exp}`;
  }
  const value = n / Math.pow(1000, tier);
  const digits = value < 10 ? 3 : value < 100 ? 2 : 1;
  const head = trim(value.toFixed(digits));
  return notation === "short" ? `${head}${SHORT[tier]}` : `${head}${SCALE[tier]}`;
}

/* Counts of things — buildings, achievements — are never abbreviated below a
   million, because "you own 1.2 thousand nans" is not how anyone talks. */
export const fmtWhole = (n) =>
  n < 1e6 ? Math.floor(n).toLocaleString("en-GB") : fmt(n);

/* A duration, said the way a person would say it. */
export function fmtTime(secs) {
  if (!Number.isFinite(secs) || secs < 0) return "never";
  if (secs < 1) return "moments";
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  const days = Math.floor(secs / 86400);
  return `${days}d ${Math.floor((secs % 86400) / 3600)}h`;
}

/* ============================ buildings ============================ */

/* Cost climbs 15% per building owned, which is the ratio the whole genre is
   balanced on: cheap enough that the next one is always nearly in reach,
   steep enough that the next tier up is always the better buy eventually. */
export const GROWTH = 1.15;

/* Each building gets six upgrades, unlocked at these counts, each one doubling
   what that building makes. Sixty-four times over by 150 owned. */
export const TIER_AT = [1, 5, 25, 50, 100, 150];
/* …priced as a multiple of the building's own base cost. */
const TIER_COST = [10, 100, 500, 5000, 50000, 500000];

/* …and four achievements, at these counts. */
export const ACH_AT = [1, 25, 100, 200];

export const BUILDINGS = [
  {
    id: "finger",
    name: "Finger",
    plural: "fingers",
    cost: 15,
    cps: 0.1,
    note: "Someone else's, doing the tapping for you.",
    tiers: ["Licked fingers", "Thimbles", "Rubber thumbs", "Spare knuckles", "Borrowed hands", "A hand from everyone"],
    ach: ["Wet your finger", "Handful", "All hands", "Hands everywhere"],
  },
  {
    id: "nan",
    name: "Nan",
    plural: "nans",
    cost: 100,
    cps: 1,
    note: "A kindly old woman who bakes without being asked twice.",
    tiers: ["Reading glasses", "Elbow grease", "A second oven", "The good apron", "Her own recipe", "A coach party of nans"],
    ach: ["Ask your nan", "A coach party", "The nan network", "Matriarchy"],
  },
  {
    id: "allotment",
    name: "Allotment",
    plural: "allotments",
    cost: 1100,
    cps: 8,
    note: "Grows the flour, more or less. Nobody asks how.",
    tiers: ["Better seed", "A proper greenhouse", "Rotated beds", "Beehives", "Grafted stock", "Weather to order"],
    ach: ["Dig for victory", "Green fingers", "Agribusiness", "Breadbasket"],
  },
  {
    id: "quarry",
    name: "Quarry",
    plural: "quarries",
    cost: 12000,
    cps: 47,
    note: "There is sugar down there, in seams, and it is coming up.",
    tiers: ["Sharper picks", "Pit ponies", "A steam winch", "Deeper shafts", "Seam maps", "Diamond-tipped bits"],
    ach: ["Down the pit", "Seams of sugar", "Strip the county", "Hollow earth"],
  },
  {
    id: "bakery",
    name: "Bakery line",
    plural: "bakery lines",
    cost: 130000,
    cps: 260,
    note: "A conveyor that goes in one end and biscuits out the other.",
    tiers: ["A longer belt", "The night shift", "Bigger tins", "Automatic icing", "Robot arms", "A second floor"],
    ach: ["Mass production", "Round the clock", "Industrial revolution", "The whole Midlands"],
  },
  {
    id: "vault",
    name: "Vault",
    plural: "vaults",
    cost: 1400000,
    cps: 1400,
    note: "Biscuits kept in a vault accrue interest. This is finance.",
    tiers: ["Compound interest", "A second branch", "Offshore tins", "Insider crumbs", "Algorithmic trading", "Own the mint"],
    ach: ["Bank the lot", "Compound interest", "Too big to fail", "Own the economy"],
  },
  {
    id: "chapel",
    name: "Chapel",
    plural: "chapels",
    cost: 20000000,
    cps: 7800,
    note: "Somewhere to be grateful, loudly, in the direction of biscuits.",
    tiers: ["Hymn books", "A bell tower", "Stained glass", "Reliquary tins", "A patron saint", "The divine recipe"],
    ach: ["A quiet word", "Congregation", "State religion", "Answered prayers"],
  },
  {
    id: "shed",
    name: "Wizard's shed",
    plural: "wizards' sheds",
    cost: 330000000,
    cps: 44000,
    note: "He says it is not magic, it is just very good baking.",
    tiers: ["A pointed hat", "A decent wand", "A familiar", "The forbidden cookbook", "Ley lines", "Rewriting the laws"],
    ach: ["Bothered a wizard", "The Circle", "Arch-baker", "Magic is just baking"],
  },
  {
    id: "freighter",
    name: "Freighter",
    plural: "freighters",
    cost: 5100000000,
    cps: 260000,
    note: "Brings biscuits back from places that do not appear on maps.",
    tiers: ["Bigger holds", "Refrigeration", "Twin engines", "Own the port", "Orbital drops", "Wormhole routes"],
    ach: ["Ship it", "The fleet", "Trade routes", "Master of the seas"],
  },
  {
    id: "lab",
    name: "Alchemy lab",
    plural: "alchemy labs",
    cost: 75000000000,
    cps: 1600000,
    note: "Turns gold into biscuits, which everyone agrees is the right way round.",
    tiers: ["Cleaner glassware", "The philosopher's stone", "Transmute lead", "Transmute time", "Transmute nothing at all", "Base elements to biscuit"],
    ach: ["As above, so below", "Base metals", "The stone", "Matter is optional"],
  },
  {
    id: "portal",
    name: "Portal",
    plural: "portals",
    cost: 1000000000000,
    cps: 10000000,
    note: "A hole to somewhere with better flour and no questions.",
    tiers: ["A wider aperture", "A stabilising ring", "A door both ways", "Somewhere with better flour", "A hundred doors", "The door with no far side"],
    ach: ["Mind the gap", "Doors everywhere", "Two-way traffic", "Geography is a suggestion"],
  },
  {
    id: "clock",
    name: "Time machine",
    plural: "time machines",
    cost: 14000000000000,
    cps: 65000000,
    note: "Fetches biscuits from before they were eaten. No paradoxes so far.",
    tiers: ["A flux tin", "Yesterday's batch", "The grandfather clause", "Loop the good afternoon", "Bake before you buy", "Already baked"],
    ach: ["Yesterday's batch", "The long loop", "Grandfather clause", "Time is a flat biscuit"],
  },
  {
    id: "antimatter",
    name: "Antimatter oven",
    plural: "antimatter ovens",
    cost: 170000000000000,
    cps: 430000000,
    note: "Condenses the opposite of a biscuit, then apologises for it.",
    tiers: ["Magnetic trapping", "Cooler containment", "Annihilation glaze", "Broken symmetry", "The vacuum-decay setting", "Bake at absolute zero"],
    ach: ["Careful now", "Containment", "Symmetry broken", "Half of everything"],
  },
  {
    id: "prism",
    name: "Prism",
    plural: "prisms",
    cost: 2100000000000000,
    cps: 2900000000,
    note: "Light goes in. Biscuits come out. The maths is settled.",
    tiers: ["Cleaner facets", "A second spectrum", "Light into dough", "The gamma bake", "A standing-wave oven", "All light, everywhere, always"],
    ach: ["Let there be light", "Full spectrum", "Photon dough", "All light, all the time"],
  },
  {
    id: "fate",
    name: "Fate engine",
    plural: "fate engines",
    cost: 26000000000000000,
    cps: 21000000000,
    note: "Makes it likely that biscuits simply happen. Very likely.",
    tiers: ["Loaded dice", "Marked cards", "Nudge the odds", "Bend the odds", "Write the odds", "Never unlucky again"],
    ach: ["Nudge the odds", "Loaded", "The house always wins", "Determinism"],
  },
  {
    id: "fractal",
    name: "Fractal tin",
    plural: "fractal tins",
    cost: 310000000000000000,
    cps: 150000000000,
    note: "A tin containing tins containing tins. Each one full.",
    tiers: ["Tins in tins", "Self-similar dough", "An infinite edge", "Recursive rising", "Tins all the way down", "The Mandelbrot batch"],
    ach: ["Tins in tins", "Self-similar", "Infinite edge", "All the way down"],
  },
  {
    id: "console",
    name: "Console",
    plural: "consoles",
    cost: 7100000000000000000,
    cps: 1100000000000,
    note: "Biscuits declared into being, then never garbage-collected.",
    tiers: ["Semicolons", "Strict mode", "Garbage collection", "Just-in-time baking", "Undefined is a flavour", "while (true) bake()"],
    ach: ["Hello, world", "It compiles", "No warnings", "Biscuits all the way down"],
  },
  {
    id: "idleverse",
    name: "Idleverse",
    plural: "idleverses",
    cost: 120000000000000000000,
    cps: 8300000000000,
    note: "A whole universe next door, and all it does is bake for you.",
    tiers: ["Look through the wall", "Trade with next door", "Annex a universe", "A universe of nans", "Consensus reality", "Every universe, one recipe"],
    ach: ["Next door", "The neighbourhood", "Annexation", "Every universe, one recipe"],
  },
];

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

/* What the nth building of a type costs, counting from zero owned. */
export const priceOf = (building, owned) =>
  Math.ceil(building.cost * Math.pow(GROWTH, owned));

/* The cost of the next `count` of them, in one go. Geometric series, so buying
   a hundred is one sum rather than a hundred. */
export function bulkPrice(building, owned, count) {
  if (count <= 0) return 0;
  const first = building.cost * Math.pow(GROWTH, owned);
  return Math.ceil((first * (Math.pow(GROWTH, count) - 1)) / (GROWTH - 1));
}

/* How many can be afforded outright — the inverse of the sum above. */
export function affordable(building, owned, bank) {
  if (bank < priceOf(building, owned)) return 0;
  const first = building.cost * Math.pow(GROWTH, owned);
  const n = Math.floor(
    Math.log((bank * (GROWTH - 1)) / first + 1) / Math.log(GROWTH)
  );
  /* the log can land a hair over; step back until it is honestly affordable */
  let count = Math.max(0, n);
  while (count > 0 && bulkPrice(building, owned, count) > bank) count -= 1;
  return count;
}

/* Selling gives back a quarter, which is the genre's standard discouragement. */
export const REFUND = 0.25;

export function refundFor(building, owned, count) {
  if (count <= 0 || owned <= 0) return 0;
  const n = Math.min(count, owned);
  return Math.floor(bulkPrice(building, owned - n, n) * REFUND);
}

/* ============================ upgrades ============================ */

/* An upgrade is bought once and never sold. `need` decides when it appears in
   the shop at all — everything is hidden until it is nearly relevant, so the
   shop is a short list at the start and a wall of choices by the end.
 *
 * The effect is declared as data rather than a function, so the whole economy
 * can be summed in one pass (see `modsOf`) and nothing can quietly apply twice.
 */

const buildingUpgrades = () =>
  BUILDINGS.flatMap((b) =>
    b.tiers.map((name, i) => ({
      id: `${b.id}-t${i}`,
      name,
      note: `${b.name}s make twice as much.`,
      cost: b.cost * TIER_COST[i],
      icon: b.id,
      kind: "building",
      target: b.id,
      mult: 2,
      need: (c) => (c.owned[b.id] || 0) >= TIER_AT[i],
    }))
  );

/* Fingers are the odd one out: they also earn from every other building on the
   books, which is what makes the cheapest thing in the shop worth buying all
   game. */
const FINGER_FLAT = [
  ["A hand from a friend", 0.1, 10, 1e3],
  ["Ask around", 0.5, 25, 1e5],
  ["A whole queue of them", 5, 50, 1e7],
  ["Everyone you know", 50, 100, 1e10],
  ["Everyone there is", 500, 150, 1e13],
  ["Every hand in every universe", 5000, 200, 1e16],
].map(([name, flat, at, cost], i) => ({
  id: `finger-f${i}`,
  name,
  note: `Fingers earn ${fmt(flat)} more per second for every other building you own.`,
  cost,
  icon: "finger",
  kind: "finger-flat",
  flat,
  need: (c) => (c.owned.finger || 0) >= at,
}));

const CLICK_MULT = [
  ["A firmer press", 15, 1e2],
  ["Both hands", 100, 5e3],
  ["The whole palm", 500, 2.5e5],
  ["Elbows in", 2000, 2.5e7],
  ["Forehead", 10000, 5e9],
  ["The rest of you", 50000, 1e13],
].map(([name, at, cost], i) => ({
  id: `click-m${i}`,
  name,
  note: "Tapping is worth twice as much.",
  cost,
  icon: "tap",
  kind: "click-mult",
  mult: 2,
  need: (c) => c.clicks >= at,
}));

const CLICK_SHARE = [
  ["Buttered fingers", 0.01, 1e6, 5e6],
  ["Sticky fingers", 0.02, 1e9, 5e9],
  ["Honeyed fingers", 0.05, 1e12, 5e12],
  ["Fingers of golden syrup", 0.1, 1e15, 5e15],
].map(([name, share, at, cost], i) => ({
  id: `click-s${i}`,
  name,
  note: `Tapping also earns ${Math.round(share * 100)}% of what you make in a second.`,
  cost,
  icon: "tap",
  kind: "click-share",
  share,
  need: (c) => c.baked >= at,
}));

/* Tea is the achievement bonus. Every badge earned is worth 1% more per
   second, and each of these multiplies that 1% by its own factor — so badges
   are worth having even when the badge itself does nothing. */
const TEA = [
  ["Builder's tea", 0.05, 5, 9e6],
  ["Two sugars", 0.1, 15, 9e9],
  ["A proper pot", 0.15, 25, 9e12],
  ["Loose leaf", 0.2, 40, 9e15],
  ["Bone china", 0.25, 55, 9e18],
  ["The good biscuits with it", 0.3, 70, 9e21],
].map(([name, k, at, cost], i) => ({
  id: `tea-${i}`,
  name,
  note: `Every badge you have earned is worth ${Math.round(k * 100)}% more per second.`,
  cost,
  icon: "tea",
  kind: "tea",
  k,
  need: (c) => c.ach >= at,
}));

const GLOBAL = [
  ["The family recipe", 1.05, 100, 1e8],
  ["Word of mouth", 1.05, 200, 1e11],
  ["A queue round the block", 1.1, 300, 1e14],
  ["A royal warrant", 1.15, 400, 1e17],
  ["National treasure", 1.2, 500, 1e20],
  ["A household name in every household", 1.25, 700, 1e23],
].map(([name, mult, at, cost], i) => ({
  id: `all-${i}`,
  name,
  note: `Everything makes ${Math.round((mult - 1) * 100)}% more.`,
  cost,
  icon: "all",
  kind: "global",
  mult,
  need: (c) => c.buildings >= at,
}));

const GOLDEN = [
  { id: "gold-0", name: "Crumbs of gold", note: "Golden biscuits turn up twice as often.", cost: 77777, freq: 2, at: 1 },
  { id: "gold-1", name: "Sharp eyes", note: "Golden biscuits sit there twice as long.", cost: 777777, stay: 2, at: 7 },
  { id: "gold-2", name: "Sweeter luck", note: "Golden biscuits are half again as generous.", cost: 7777777, power: 1.5, at: 27 },
  { id: "gold-3", name: "Lingering luck", note: "Golden effects last half again as long.", cost: 77777777, long: 1.5, at: 77 },
  { id: "gold-4", name: "A golden habit", note: "Golden biscuits turn up half again as often.", cost: 7.7e9, freq: 1.5, at: 177 },
].map((u) => ({
  id: u.id,
  name: u.name,
  note: u.note,
  cost: u.cost,
  icon: "golden",
  kind: "golden",
  freq: u.freq || 1,
  stay: u.stay || 1,
  power: u.power || 1,
  long: u.long || 1,
  need: (c) => c.goldens >= u.at,
}));

export const UPGRADES = [
  ...buildingUpgrades(),
  ...FINGER_FLAT,
  ...CLICK_MULT,
  ...CLICK_SHARE,
  ...TEA,
  ...GLOBAL,
  ...GOLDEN,
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

/* The recipe book (a crumb upgrade) hands back everything cheap on ascension.
   Cheap is defined once, here, so the shop and the reset agree. */
export const RECIPE_BOOK_UNDER = 1e6;
export const RECIPE_BOOK_IDS = UPGRADES.filter((u) => u.cost <= RECIPE_BOOK_UNDER).map((u) => u.id);

/* ============================ badges ============================ */

/* Achievements, called badges on screen because "achievement" is four
   syllables of nothing. Each is worth 1% more per second once tea is brewing,
   so none of them is only decorative. */

const buildingBadges = () =>
  BUILDINGS.flatMap((b) =>
    b.ach.map((name, i) => ({
      id: `${b.id}-a${i}`,
      name,
      note: `Own ${fmtWhole(ACH_AT[i])} ${ACH_AT[i] === 1 ? b.name.toLowerCase() : b.plural}.`,
      icon: b.id,
      test: (c) => (c.owned[b.id] || 0) >= ACH_AT[i],
    }))
  );

const BAKED = [
  [1, "First crumb"], [1e3, "A packet"], [1e6, "A tin"], [1e9, "A pallet"],
  [1e12, "A warehouse"], [1e15, "A mountain"], [1e18, "A moon"],
  [1e21, "A galaxy"], [1e24, "A universe"], [1e27, "Everything, ever"],
].map(([at, name], i) => ({
  id: `baked-${i}`,
  name,
  note: at === 1 ? "Bake your first biscuit." : `Bake ${fmt(at)} biscuits in one run.`,
  icon: "biscuit",
  test: (c) => c.baked >= at,
}));

const CLICKED = [
  [100, "Warming up"], [1e3, "Repetitive"], [1e4, "A thumb of steel"],
  [1e5, "Clinically concerning"], [1e6, "See someone about it"],
].map(([at, name], i) => ({
  id: `click-a${i}`,
  name,
  note: `Tap the biscuit ${fmtWhole(at)} times.`,
  icon: "tap",
  test: (c) => c.clicks >= at,
}));

const RATE = [
  [1, "Ticking over"], [100, "A going concern"], [1e6, "Serious about biscuits"],
  [1e9, "Frankly absurd"], [1e12, "Complete nonsense"],
].map(([at, name], i) => ({
  id: `rate-${i}`,
  name,
  note: `Make ${fmt(at)} biscuits a second.`,
  icon: "all",
  test: (c) => c.cps >= at,
}));

const OTHER = [
  { id: "gold-a0", name: "Caught one", note: "Tap a golden biscuit.", icon: "golden", test: (c) => c.goldens >= 1 },
  { id: "gold-a1", name: "Sharp-eyed", note: "Tap ten golden biscuits.", icon: "golden", test: (c) => c.goldens >= 10 },
  { id: "gold-a2", name: "The golden touch", note: "Tap fifty golden biscuits.", icon: "golden", test: (c) => c.goldens >= 50 },
  { id: "gold-a3", name: "It's a living", note: "Tap a hundred golden biscuits.", icon: "golden", test: (c) => c.goldens >= 100 },
  { id: "burnt-a0", name: "Should have known", note: "Tap a burnt one. Once is enough.", icon: "burnt", test: (c) => c.burnt >= 1 },
  { id: "hand-a0", name: "No help needed", note: "Bake a thousand biscuits by hand.", icon: "tap", test: (c) => c.handMade >= 1e3 },
  { id: "hand-a1", name: "All by yourself", note: "Bake a million biscuits by hand.", icon: "tap", test: (c) => c.handMade >= 1e6 },
  { id: "shop-a0", name: "A shopping list", note: "Own ten upgrades.", icon: "all", test: (c) => c.upgrades >= 10 },
  { id: "shop-a1", name: "Well equipped", note: "Own fifty upgrades.", icon: "all", test: (c) => c.upgrades >= 50 },
  { id: "shop-a2", name: "The full set", note: "Own a hundred upgrades.", icon: "all", test: (c) => c.upgrades >= 100 },
  { id: "shop-a3", name: "Completionist", note: "Own a hundred and fifty upgrades.", icon: "all", test: (c) => c.upgrades >= 150 },
  { id: "town-a0", name: "A hundred hands", note: "Own a hundred buildings.", icon: "all", test: (c) => c.buildings >= 100 },
  { id: "town-a1", name: "An empire", note: "Own three hundred buildings.", icon: "all", test: (c) => c.buildings >= 300 },
  { id: "town-a2", name: "A civilisation", note: "Own five hundred buildings.", icon: "all", test: (c) => c.buildings >= 500 },
  { id: "town-a3", name: "Overkill", note: "Own a thousand buildings.", icon: "all", test: (c) => c.buildings >= 1000 },
  { id: "one-each", name: "One of everything", note: "Own at least one of every building.", icon: "all", test: (c) => c.distinct >= BUILDINGS.length },
  { id: "away-a0", name: "Idle hands", note: "Come back to biscuits baked while you were away.", icon: "sleep", test: (c) => c.offlineEarned >= 1 },
  { id: "asc-a0", name: "Start again", note: "Tip the tin once.", icon: "crumb", test: (c) => c.ascensions >= 1 },
  { id: "asc-a1", name: "Round and round", note: "Tip the tin five times.", icon: "crumb", test: (c) => c.ascensions >= 5 },
  { id: "asc-a2", name: "The eternal batch", note: "Tip the tin ten times.", icon: "crumb", test: (c) => c.ascensions >= 10 },
];

export const BADGES = [...buildingBadges(), ...BAKED, ...CLICKED, ...RATE, ...OTHER];

export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));

/* ============================ crumbs ============================ */

/* Tipping the tin throws the run away and keeps the crumbs. Crumbs are earned
   from everything ever baked, never lost, and buy the things below — which
   survive every reset and are the reason to start again at all.
 *
 * The bonus per crumb is counted from crumbs *earned*, not crumbs left, so
 * spending them never makes the next run slower. */
export const CRUMB_UPGRADES = [
  { id: "headstart", name: "A head start", cost: 1, note: "Every run opens with 1,000 biscuits for each crumb you have earned." },
  { id: "nap1", name: "Deeper naps", cost: 5, note: "Baking while the app is shut counts for up to 12 hours instead of 3." },
  { id: "rich1", name: "Bake in your sleep", cost: 15, note: "Time away earns 80% of the usual rate instead of half." },
  { id: "luck", name: "Born lucky", cost: 30, note: "Golden biscuits turn up a quarter more often." },
  { id: "strongtea", name: "Strong tea", cost: 60, note: "Every badge is worth half again as much." },
  { id: "nap2", name: "Hibernation", cost: 120, note: "Time away counts for up to three days." },
  { id: "rich2", name: "The oven stays on", cost: 250, note: "Time away earns the full rate." },
  { id: "power", name: "Crumb power", cost: 500, note: "Each crumb earned is worth 1.5% more per second instead of 1%." },
  { id: "recipes", name: "The recipe book", cost: 1000, note: `Every run opens with all ${RECIPE_BOOK_IDS.length} upgrades under a million already bought.` },
  { id: "twin", name: "Twin ovens", cost: 2500, note: "Tapping is worth double, for good." },
];

export const CRUMB_BY_ID = Object.fromEntries(CRUMB_UPGRADES.map((u) => [u.id, u]));

/* A thousand billion baked is the first crumb; a thousand times that is ten
   crumbs. The cube root is what keeps the tenth reset from being trivial. */
export const crumbsFrom = (bakedAll) =>
  bakedAll <= 0 ? 0 : Math.floor(Math.cbrt(bakedAll / 1e12));

export const crumbsWaiting = (state) =>
  Math.max(0, crumbsFrom(state.bakedAll) - state.crumbsAll);

/* What the next crumb costs, so the ascend screen can say how far off it is. */
export const bakedForCrumbs = (n) => Math.pow(n, 3) * 1e12;

/* ============================ the sums ============================ */

/* Every owned upgrade folded into one set of numbers, so nothing is applied
   twice and the per-second figure is a single pass over the buildings. */
export function modsOf(upgrades, crumbUpgrades) {
  const m = {
    building: {},
    fingerFlat: 0,
    clickMult: 1,
    clickShare: 0,
    teaFactors: [],
    global: 1,
    goldFreq: 1,
    goldStay: 1,
    goldPower: 1,
    goldLong: 1,
  };

  upgrades.forEach((id) => {
    const u = UPGRADE_BY_ID[id];
    if (!u) return;
    switch (u.kind) {
      case "building":
        m.building[u.target] = (m.building[u.target] || 1) * u.mult;
        break;
      case "finger-flat":
        m.fingerFlat += u.flat;
        break;
      case "click-mult":
        m.clickMult *= u.mult;
        break;
      case "click-share":
        m.clickShare += u.share;
        break;
      case "tea":
        m.teaFactors.push(u.k);
        break;
      case "global":
        m.global *= u.mult;
        break;
      case "golden":
        m.goldFreq *= u.freq;
        m.goldStay *= u.stay;
        m.goldPower *= u.power;
        m.goldLong *= u.long;
        break;
      default:
        break;
    }
  });

  if (crumbUpgrades.has("luck")) m.goldFreq *= 1.25;
  if (crumbUpgrades.has("twin")) m.clickMult *= 2;

  return m;
}

/* Everything the screen needs to draw itself, worked out in one place so the
   header, the shop and the stats page can never disagree. */
export function stats(state, now = Date.now()) {
  const upgrades = new Set(state.upgrades);
  const crumbUpgrades = new Set(state.crumbUpgrades);
  const m = modsOf(state.upgrades, crumbUpgrades);

  const badges = state.badges.length;
  const tea = badges * 0.01 * (crumbUpgrades.has("strongtea") ? 1.5 : 1);
  let teaMult = 1;
  m.teaFactors.forEach((k) => {
    teaMult *= 1 + tea * k;
  });

  const perCrumb = crumbUpgrades.has("power") ? 0.015 : 0.01;
  const prestige = 1 + state.crumbsAll * perCrumb;

  let buildings = 0;
  let distinct = 0;
  BUILDINGS.forEach((b) => {
    const n = state.owned[b.id] || 0;
    buildings += n;
    if (n > 0) distinct += 1;
  });
  const others = buildings - (state.owned.finger || 0);

  const per = {};
  const each = {};
  let base = 0;
  BUILDINGS.forEach((b) => {
    const n = state.owned[b.id] || 0;
    let one = b.cps * (m.building[b.id] || 1);
    if (b.id === "finger") one += m.fingerFlat * others;
    each[b.id] = one;
    per[b.id] = one * n;
    base += per[b.id];
  });

  const steady = base * m.global * teaMult * prestige;

  let cpsBuff = 1;
  let clickBuff = 1;
  state.buffs.forEach((b) => {
    if (b.until <= now) return;
    if (b.on === "click") clickBuff *= b.mult;
    else cpsBuff *= b.mult;
  });

  const cps = steady * cpsBuff;
  /* the share of per-second added to a tap is taken after buffs, so a frenzy
     and a tap frenzy landing together is the payoff it looks like */
  const click = (m.clickMult + cps * m.clickShare) * clickBuff;

  /* everything that sits on top of a building's own output: the global
     upgrades, the tea, the crumbs and whatever a golden biscuit is doing */
  const factor = m.global * teaMult * prestige * cpsBuff;

  /* what each building contributes once those are on, which is the honest
     answer to "is this one worth buying" */
  const share = {};
  BUILDINGS.forEach((b) => {
    share[b.id] = per[b.id] * factor;
  });

  return {
    mods: m,
    upgrades,
    crumbUpgrades,
    badges,
    tea,
    teaMult,
    prestige,
    perCrumb,
    buildings,
    distinct,
    base,
    steady,
    cps,
    cpsBuff,
    clickBuff,
    factor,
    click,
    per,
    each,
    share,
  };
}

/* The facts an upgrade's `need` or a badge's `test` is allowed to look at. */
export function contextOf(state, s) {
  return {
    owned: state.owned,
    baked: state.baked,
    bakedAll: state.bakedAll,
    clicks: state.clicks,
    handMade: state.handMade,
    ach: s.badges,
    upgrades: state.upgrades.length,
    buildings: s.buildings,
    distinct: s.distinct,
    goldens: state.goldens,
    burnt: state.burnt,
    offlineEarned: state.offlineEarned,
    ascensions: state.ascensions,
    cps: s.steady,
  };
}

/* What is on the shelf: unlocked, not yet owned, cheapest first. */
export function shopFor(state, ctx) {
  const owned = new Set(state.upgrades);
  return UPGRADES.filter((u) => !owned.has(u.id) && u.need(ctx)).sort(
    (a, b) => a.cost - b.cost
  );
}

/* Badges just earned, if any. Cheap enough to run on every tick. */
export function newBadges(state, ctx) {
  const have = new Set(state.badges);
  return BADGES.filter((b) => !have.has(b.id) && b.test(ctx)).map((b) => b.id);
}

/* ============================ time away ============================ */

export function offlineRules(crumbUpgrades) {
  const cap = crumbUpgrades.has("nap2") ? 259200 : crumbUpgrades.has("nap1") ? 43200 : 10800;
  const rate = crumbUpgrades.has("rich2") ? 1 : crumbUpgrades.has("rich1") ? 0.8 : 0.5;
  return { cap, rate };
}

export function offlineGain(state, s, seconds) {
  const { cap, rate } = offlineRules(s.crumbUpgrades);
  const counted = Math.min(Math.max(0, seconds), cap);
  /* a minute over the cap is not worth telling anyone about */
  const capped = seconds > cap + 60;
  /* buffs do not run while the app is shut — steady, not cps */
  return { seconds: counted, capped, cap, rate, gain: s.steady * counted * rate };
}

/* ============================ golden biscuits ============================ */

/* One turns up every few minutes and sits there for a few seconds. Tapping it
   is the only thing in the game that is not simply a matter of waiting, which
   is why the good ones are worth so much and the burnt ones cost you. */
export const GOLD_MIN = 300;
export const GOLD_MAX = 780;
export const GOLD_LIFE = 13;
export const BURNT_CHANCE = 0.08;

export function nextGoldenAt(now, mods) {
  const span = GOLD_MIN + Math.random() * (GOLD_MAX - GOLD_MIN);
  return now + (span / mods.goldFreq) * 1000;
}

const pick = (table) => {
  let roll = Math.random();
  for (const row of table) {
    roll -= row.weight;
    if (roll <= 0) return row;
  }
  return table[table.length - 1];
};

const GOLD_TABLE = [
  { id: "frenzy", weight: 0.4 },
  { id: "lucky", weight: 0.3 },
  { id: "windfall", weight: 0.15 },
  { id: "clickfrenzy", weight: 0.1 },
  { id: "storm", weight: 0.05 },
];

const BURNT_TABLE = [
  { id: "clot", weight: 0.6 },
  { id: "crumble", weight: 0.25 },
  { id: "burntsugar", weight: 0.15 },
];

export const rollEffect = (burnt) => pick(burnt ? BURNT_TABLE : GOLD_TABLE).id;

/* What tapping one does. Returns the biscuits to add and any buff to start —
   the caller applies them, so this stays a pure description of the rules. */
export function effectOf(id, state, s, now) {
  const power = s.mods.goldPower;
  const long = s.mods.goldLong;
  const secs = (n) => now + n * long * 1000;

  switch (id) {
    case "frenzy":
      return { name: "Frenzy", blurb: "Seven times as many biscuits a second.", buff: { on: "cps", mult: 7, until: secs(77), id: "frenzy" } };
    case "clickfrenzy":
      return { name: "Tap frenzy", blurb: "Tapping is worth 777 times as much.", buff: { on: "click", mult: 777, until: secs(13), id: "clickfrenzy" } };
    case "lucky": {
      const gain = Math.min(state.biscuits * 0.15, s.cps * 900) * power + 13;
      return { name: "Lucky", blurb: `${fmt(gain)} biscuits, on the house.`, gain };
    }
    case "windfall": {
      const gain = (s.cps * 1800 + 13) * power;
      return { name: "Windfall", blurb: `Half an hour's baking, right now — ${fmt(gain)}.`, gain };
    }
    case "storm":
      return { name: "Biscuit storm", blurb: "Seven seconds of them. Tap everything.", storm: secs(7) };
    case "clot":
      return { name: "Clotted", blurb: "Half as many biscuits a second for a minute.", bad: true, buff: { on: "cps", mult: 0.5, until: secs(66), id: "clot" } };
    case "crumble": {
      const loss = state.biscuits * 0.03;
      return { name: "Crumbled", blurb: `${fmt(loss)} biscuits, gone.`, bad: true, gain: -loss };
    }
    case "burntsugar":
      return { name: "Burnt sugar", blurb: "Tapping is worth 666 times as much. Briefly.", bad: true, buff: { on: "click", mult: 666, until: secs(6), id: "burntsugar" } };
    default:
      return { name: "Nothing", blurb: "It was just a biscuit.", gain: 0 };
  }
}

/* ============================ the save ============================ */

export const SAVE_VERSION = 1;

/* Everything that survives a reset lives in the second half of this object;
   everything above `crumbs` is thrown away when the tin is tipped. */
export function blankState(keep) {
  const now = Date.now();
  const kept = keep || {};
  const crumbUpgrades = kept.crumbUpgrades || [];
  const crumbsAll = kept.crumbsAll || 0;
  const book = crumbUpgrades.includes("recipes");
  const headStart = crumbUpgrades.includes("headstart") ? crumbsAll * 1000 : 0;

  return {
    v: SAVE_VERSION,
    biscuits: headStart,
    baked: headStart,
    bakedAll: kept.bakedAll || 0,
    clicks: 0,
    handMade: 0,
    owned: {},
    upgrades: book ? RECIPE_BOOK_IDS.slice() : [],
    badges: kept.badges || [],
    goldens: kept.goldens || 0,
    burnt: kept.burnt || 0,
    offlineEarned: kept.offlineEarned || 0,
    crumbs: kept.crumbs || 0,
    crumbsAll,
    crumbUpgrades,
    ascensions: kept.ascensions || 0,
    buffs: [],
    startedAt: kept.startedAt || now,
    runStartedAt: now,
    lastSeen: now,
    nextGolden: 0,
  };
}

/* A save read off a phone is not to be trusted: it may be from an older
   version, a half-written write, or a backup file someone edited by hand.
   Everything is coerced to the shape the game expects or replaced. */
const num = (v, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const list = (v, known) =>
  Array.isArray(v) ? v.filter((id) => typeof id === "string" && known[id]) : [];

export function reviveState(raw) {
  if (!raw || typeof raw !== "object") return blankState();
  const base = blankState();
  const owned = {};
  if (raw.owned && typeof raw.owned === "object") {
    BUILDINGS.forEach((b) => {
      const n = Math.floor(num(raw.owned[b.id]));
      if (n > 0) owned[b.id] = n;
    });
  }
  const buffs = Array.isArray(raw.buffs)
    ? raw.buffs
        .filter((b) => b && typeof b === "object" && num(b.until) > Date.now())
        .map((b) => ({
          id: String(b.id || "buff"),
          on: b.on === "click" ? "click" : "cps",
          mult: num(b.mult, 1),
          until: num(b.until),
          label: String(b.label || "Golden biscuit"),
          span: Math.max(1, num(b.span, 13)),
        }))
    : [];

  return {
    ...base,
    biscuits: Math.max(0, num(raw.biscuits)),
    baked: Math.max(0, num(raw.baked)),
    bakedAll: Math.max(0, num(raw.bakedAll, num(raw.baked))),
    clicks: Math.max(0, Math.floor(num(raw.clicks))),
    handMade: Math.max(0, num(raw.handMade)),
    owned,
    upgrades: list(raw.upgrades, UPGRADE_BY_ID),
    badges: list(raw.badges, BADGE_BY_ID),
    goldens: Math.max(0, Math.floor(num(raw.goldens))),
    burnt: Math.max(0, Math.floor(num(raw.burnt))),
    offlineEarned: Math.max(0, num(raw.offlineEarned)),
    crumbs: Math.max(0, Math.floor(num(raw.crumbs))),
    crumbsAll: Math.max(0, Math.floor(num(raw.crumbsAll))),
    crumbUpgrades: list(raw.crumbUpgrades, CRUMB_BY_ID),
    ascensions: Math.max(0, Math.floor(num(raw.ascensions))),
    buffs,
    startedAt: num(raw.startedAt, base.startedAt),
    runStartedAt: num(raw.runStartedAt, base.runStartedAt),
    lastSeen: num(raw.lastSeen, base.lastSeen),
    nextGolden: 0,
  };
}

/* Tipping the tin. The crumbs waiting are banked first, then the run is
   cleared — badges, crumbs and everything bought with them stay. */
export function ascend(state) {
  const won = crumbsWaiting(state);
  return blankState({
    bakedAll: state.bakedAll,
    badges: state.badges,
    goldens: state.goldens,
    burnt: state.burnt,
    offlineEarned: state.offlineEarned,
    crumbs: state.crumbs + won,
    crumbsAll: state.crumbsAll + won,
    crumbUpgrades: state.crumbUpgrades,
    ascensions: state.ascensions + 1,
    startedAt: state.startedAt,
  });
}
