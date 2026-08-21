/**
 * Market engine — demo universe, live ticks, regime, sectors.
 * When FYERS is connected, quotes overlay demo bars. CORS failures stay in demo.
 */
import { Storage, hashStr, mulberry32, getMarketStatus, lastSessionCloseMs, inr, fmtPct } from "./storage.js";
import { analyzeBars } from "./technicals.js";
import { scoreSymbol, decideSignal } from "./scoring.js";
import { buildPlan, classicPivots } from "./levels.js";
import { isFyersConnected, getQuotes } from "./fyers.js";

const NIFTY50 = [
  ["RELIANCE", "Reliance Industries", 1316.0, 2.8, "ENERGY"],
  ["HDFCBANK", "HDFC Bank", 726.95, 1.9, "BANKING"],
  ["BHARTIARTL", "Bharti Airtel", 1946.0, 4.3, "TELECOM"],
  ["TCS", "Tata Consultancy", 2302.0, 4.0, "IT"],
  ["ICICIBANK", "ICICI Bank", 1420.0, 8.1, "BANKING"],
  ["SBIN", "State Bank of India", 1048.7, 0.7, "PSU BANK"],
  ["INFY", "Infosys", 1121.0, -9.0, "IT"],
  ["BAJFINANCE", "Bajaj Finance", 1095.0, 0.0, "FINANCIAL SERVICES"],
  ["HINDUNILVR", "Hindustan Unilever", 2015.0, -13.0, "FMCG"],
  ["ITC", "ITC", 269.4, -2.25, "FMCG"],
  ["LT", "Larsen & Toubro", 4093.0, 12.0, "INFRA"],
  ["MARUTI", "Maruti Suzuki", 13565.0, -244.0, "AUTO"],
  ["AXISBANK", "Axis Bank", 1245.8, -5.2, "BANKING"],
  ["KOTAKBANK", "Kotak Mahindra Bank", 402.8, 5.45, "BANKING"],
  ["SUNPHARMA", "Sun Pharma", 1902.4, -1.6, "PHARMA"],
  ["HCLTECH", "HCL Technologies", 1302.5, -15.9, "IT"],
  ["M&M", "Mahindra & Mahindra", 3412.2, -12.6, "AUTO"],
  ["ETERNAL", "Eternal", 328.0, 0.05, "SERVICES"],
  ["TITAN", "Titan Company", 5086.1, 18.1, "FMCG"],
  ["ULTRACEMCO", "UltraTech Cement", 11570.0, -5.0, "METAL"],
  ["NTPC", "NTPC", 340.0, 2.5, "ENERGY"],
  ["BAJAJFINSV", "Bajaj Finserv", 2032.5, 16.5, "FINANCIAL SERVICES"],
  ["ADANIENT", "Adani Enterprises", 2997.0, 2.1, "ENERGY"],
  ["ONGC", "ONGC", 236.4, -2.1, "ENERGY"],
  ["POWERGRID", "Power Grid", 272.4, 7.6, "ENERGY"],
  ["WIPRO", "Wipro", 180.79, -0.21, "IT"],
  ["ASIANPAINT", "Asian Paints", 2640.0, 14.8, "FMCG"],
  ["ADANIPORTS", "Adani Ports", 1700.0, 4.0, "INFRA"],
  ["COALINDIA", "Coal India", 405.2, 2.7, "ENERGY"],
  ["JSWSTEEL", "JSW Steel", 1293.7, -6.0, "METAL"],
  ["TATASTEEL", "Tata Steel", 183.0, -0.5, "METAL"],
  ["NESTLEIND", "Nestle India", 1477.1, 19.1, "FMCG"],
  ["BEL", "Bharat Electronics", 414.0, 4.6, "PSU"],
  ["JIOFIN", "Jio Financial Services", 244.0, -0.6, "FINANCIAL SERVICES"],
  ["GRASIM", "Grasim Industries", 3308.0, 8.0, "METAL"],
  ["TECHM", "Tech Mahindra", 1584.0, -8.1, "IT"],
  ["TRENT", "Trent", 2924.0, -46.0, "FMCG"],
  ["HINDALCO", "Hindalco", 1034.0, 4.15, "METAL"],
  ["CIPLA", "Cipla", 1432.2, -5.8, "PHARMA"],
  ["TATAPV", "Tata Motors PV", 317.9, -2.35, "AUTO"],
  ["BAJAJ-AUTO", "Bajaj Auto", 11700.0, -93.0, "AUTO"],
  ["EICHERMOT", "Eicher Motors", 8010.0, -32.0, "AUTO"],
  ["DRREDDY", "Dr Reddy's", 1174.7, -5.3, "PHARMA"],
  ["TATACONSUM", "Tata Consumer", 1049.0, -7.3, "FMCG"],
  ["APOLLOHOSP", "Apollo Hospitals", 8693.0, -42.0, "PHARMA"],
  ["SHRIRAMFIN", "Shriram Finance", 1130.0, 1.8, "FINANCIAL SERVICES"],
  ["SBILIFE", "SBI Life", 1792.9, 10.9, "FINANCIAL SERVICES"],
  ["HDFCLIFE", "HDFC Life", 554.8, 12.8, "FINANCIAL SERVICES"],
  ["INDIGO", "InterGlobe Aviation", 5110.0, -55.0, "SERVICES"],
  ["MAXHEALTH", "Max Healthcare", 1000.0, 2.1, "PHARMA"],
];

const EXTRA_FNO = [
  ["TATACV", "Tata Motors CV", 472.55, 477.6, "AUTO"],
  ["HEROMOTOCO", "Hero MotoCorp", 5735.0, 5745.0, "AUTO"],
  ["INDUSINDBK", "IndusInd Bank", 1005.6, 1010.6, "BANKING"],
  ["BPCL", "BPCL", 311.0, 316.65, "ENERGY"],
  ["DIVISLAB", "Divi's Labs", 8597.0, 8481.5, "PHARMA"],
  ["BANKBARODA", "Bank of Baroda", 247.0, 246.55, "PSU BANK"],
  ["PNB", "Punjab National Bank", 116.55, 117.32, "PSU BANK"],
  ["CANBK", "Canara Bank", 129.96, 131.1, "PSU BANK"],
  ["DLF", "DLF", 678.1, 671.0, "REALTY"],
  ["GODREJPROP", "Godrej Properties", 2035.0, 2054.0, "REALTY"],
  ["OBEROIRLTY", "Oberoi Realty", 1886.0, 1931.0, "REALTY"],
  ["LODHA", "Macrotech Developers", 1242.0, 1254.0, "REALTY"],
  ["IRFC", "IRFC", 86.4, 87.05, "PSU"],
  ["RECLTD", "REC", 326.65, 340.0, "FINANCIAL SERVICES"],
  ["PFC", "Power Finance", 363.0, 374.4, "FINANCIAL SERVICES"],
  ["VEDL", "Vedanta", 279.0, 269.7, "METAL"],
  ["HINDZINC", "Hindustan Zinc", 594.9, 567.5, "METAL"],
  ["NMDC", "NMDC", 84.61, 85.5, "METAL"],
  ["IOC", "Indian Oil", 135.9, 138.61, "ENERGY"],
  ["GAIL", "GAIL", 172.0, 172.1, "ENERGY"],
  ["TVSMOTOR", "TVS Motor", 4390.0, 4385.9, "AUTO"],
  ["ASHOKLEY", "Ashok Leyland", 173.0, 177.1, "AUTO"],
  ["MOTHERSON", "Samvardhana Motherson", 169.38, 168.06, "AUTO"],
  ["PERSISTENT", "Persistent Systems", 5667.5, 5570.0, "IT"],
  ["COFORGE", "Coforge", 1891.7, 1806.0, "IT"],
  ["LUPIN", "Lupin", 2201.8, 2259.0, "PHARMA"],
  ["AUROPHARMA", "Aurobindo Pharma", 1621.3, 1627.2, "PHARMA"],
  ["DABUR", "Dabur", 400.5, 406.8, "FMCG"],
  ["GODREJCP", "Godrej Consumer", 933.0, 928.0, "FMCG"],
  ["PIDILITIND", "Pidilite", 1649.0, 1669.0, "FMCG"],
  ["HAVELLS", "Havells", 1268.0, 1299.0, "FMCG"],
  ["SIEMENS", "Siemens", 3920.0, 3943.0, "INFRA"],
  ["ABB", "ABB India", 7424.0, 7660.0, "INFRA"],
];

const INDICES = [
  ["NIFTY", "Nifty 50", 24252.0, 24231.85],
  ["BANKNIFTY", "Bank Nifty", 57761.95, 57495.9],
  ["SENSEX", "Sensex", 77540.83, 77537.72],
  ["FINNIFTY", "FinNifty", 26261.0, 26203.9],
  ["INDIAVIX", "India VIX", 11.2, 10.76],
];

const SECTORS = [
  "BANKING",
  "IT",
  "PHARMA",
  "AUTO",
  "FMCG",
  "METAL",
  "ENERGY",
  "REALTY",
  "PSU BANK",
  "FINANCIAL SERVICES",
];

const HERO_BUY = new Set(["RELIANCE", "SBIN", "TATAPV", "TATACV", "HINDALCO", "BEL", "TRENT"]);
const HERO_SELL = new Set(["INFY", "WIPRO", "ASIANPAINT", "HINDUNILVR", "TECHM"]);

const FY_SYMBOL = {
  NIFTY: "NSE:NIFTY50-INDEX",
  BANKNIFTY: "NSE:NIFTYBANK-INDEX",
  SENSEX: "BSE:SENSEX-INDEX",
  INDIAVIX: "NSE:INDIAVIX-INDEX",
  FINNIFTY: "NSE:FINNIFTY-INDEX",
  TATAPV: "NSE:TMPV-EQ",
  TATACV: "NSE:TMCV-EQ",
  TMPV: "NSE:TMPV-EQ",
  TMCV: "NSE:TMCV-EQ",
};

const FY_TO_INTERNAL = {
  "NSE:TMPV-EQ": "TATAPV",
  "NSE:TMCV-EQ": "TATACV",
  TMPV: "TATAPV",
  TMCV: "TATACV",
  TATAMOTORS: "TATAPV",
  ZOMATO: "ETERNAL",
  "NSE:ETERNAL-EQ": "ETERNAL",
  "NSE:NIFTY50-INDEX": "NIFTY",
  NIFTY50: "NIFTY",
  "NSE:NIFTYBANK-INDEX": "BANKNIFTY",
  NIFTYBANK: "BANKNIFTY",
  "BSE:SENSEX-INDEX": "SENSEX",
  "NSE:INDIAVIX-INDEX": "INDIAVIX",
  "NSE:FINNIFTY-INDEX": "FINNIFTY",
};

function fySymbol(sym) {
  return FY_SYMBOL[sym] || `NSE:${sym}-EQ`;
}

function internalFromFy(n) {
  const raw = String(n || "");
  if (FY_TO_INTERNAL[raw]) return FY_TO_INTERNAL[raw];
  const short = raw.replace(/^NSE:/, "").replace(/^BSE:/, "").replace(/-EQ$/, "").replace(/-INDEX$/, "");
  return FY_TO_INTERNAL[short] || short;
}

function isCashSessionOpen() {
  return getMarketStatus().open === true;
}

function makeBar(t, o, r) {
  const drift = (r() - 0.48) * 0.004;
  const shock = r() > 0.97 ? (r() - 0.5) * 0.012 : 0;
  const c = o * (1 + drift + shock);
  const spread = Math.abs(c - o) + o * (0.001 + r() * 0.003);
  const h = Math.max(o, c) + spread * r() * 0.6;
  const l = Math.min(o, c) - spread * r() * 0.6;
  const v = 40000 + r() * 180000;
  return { t, o, h, l, c, v };
}

function generateBars(symbol, base, bias, n = 160) {
  const rand = mulberry32(hashStr(symbol + ":bars:v4"));
  const bars = [];
  const end = getMarketStatus().open ? Math.floor(Date.now() / 300000) * 300000 : lastSessionCloseMs();
  const t0 = end - (n - 1) * 5 * 60 * 1000;
  let px = base * (0.985 + rand() * 0.02);
  for (let i = 0; i < n; i++) {
    let local = bias;
    if (i > n - 28 && HERO_BUY.has(symbol)) local = "bull";
    if (i > n - 28 && HERO_SELL.has(symbol)) local = "bear";
    const tilt = local === "bull" ? 0.0011 : local === "bear" ? -0.0011 : 0;
    const o = px;
    const drift = (rand() - 0.48) * 0.0038 + tilt;
    const volCluster = i > n - 18 ? 1.8 : 1;
    let c = o * (1 + drift);
    if (local === "bull" && i === n - 12) c = o * 1.006;
    if (local === "bear" && i === n - 12) c = o * 0.994;
    const spread = Math.abs(c - o) + o * (0.0009 + rand() * 0.0025);
    const h = Math.max(o, c) + spread * rand() * 0.7;
    const l = Math.min(o, c) - spread * rand() * 0.7;
    const v = (50000 + rand() * 220000) * volCluster * (local === "chop" ? 0.7 : 1.15);
    bars.push({ t: t0 + i * 5 * 60 * 1000, o, h, l, c, v });
    px = c;
  }
  const last = bars[bars.length - 1].c || base;
  const scale = base / last;
  return bars.map((b, i) => {
    const o = +(b.o * scale).toFixed(2);
    const h = +(b.h * scale).toFixed(2);
    const l = +(b.l * scale).toFixed(2);
    let c = +(b.c * scale).toFixed(2);
    if (i === bars.length - 1) c = +base.toFixed(2);
    return { ...b, o, h: Math.max(h, o, c), l: Math.min(l, o, c), c };
  });
}

function tickBar(bar, bias, rand) {
  if (!isCashSessionOpen()) return bar;
  const tilt = bias === "bull" ? 0.00025 : bias === "bear" ? -0.00025 : 0;
  const d = (rand() - 0.5) * 0.0018 + tilt;
  const c = bar.c * (1 + d);
  return {
    ...bar,
    c,
    h: Math.max(bar.h, c),
    l: Math.min(bar.l, c),
    v: bar.v + 800 + rand() * 4000,
    t: Date.now(),
  };
}

const universe = new Map();
const listeners = new Set();
let selected = "RELIANCE";
let regime = { label: "NEUTRAL", score: 50, note: "" };
let ticking = false;
let tickTimer = null;
let liveMode = false;

function catalog() {
  const rows = [];
  for (const [sym, name, close, chg, sector] of NIFTY50) {
    rows.push({
      symbol: sym,
      name,
      base: close,
      prevClose: +(close - chg).toFixed(2),
      sector,
      nifty50: true,
      fno: true,
    });
  }
  for (const [sym, name, close, prev, sector] of EXTRA_FNO) {
    rows.push({ symbol: sym, name, base: close, prevClose: prev, sector, nifty50: false, fno: true });
  }
  return rows;
}

function biasFor(sym) {
  if (HERO_BUY.has(sym)) return "bull";
  if (HERO_SELL.has(sym)) return "bear";
  const r = mulberry32(hashStr(sym))();
  if (r > 0.7) return "bull";
  if (r < 0.3) return "bear";
  return "chop";
}

function enrich(row) {
  const settings = Storage.getSettings();
  const sessionStart = Math.max(0, row.bars.length - 75);
  const ta = analyzeBars(row.bars, settings, { sessionStart, regime: regime.label });
  const piv = classicPivots(ta.levels.pdh, ta.levels.pdl, ta.levels.pdc);
  ta.levels.r1 = piv.r1;
  ta.levels.s1 = piv.s1;
  const dirHint = ta.align.bias === "BEAR" ? "SELL" : ta.align.bias === "BULL" ? "BUY" : ta.aboveVwap ? "BUY" : "SELL";
  const plan = buildPlan(ta, dirHint);
  const scored = scoreSymbol(ta, { regime: regime.label, rr: plan.rr });
  const mkt = getMarketStatus();
  const marketOpen = mkt.code === "OPEN";
  const decided = decideSignal({
    score: scored.score,
    dir: scored.dir,
    rr: plan.rr,
    ta,
    regime: regime.label,
    marketOpen,
    analysisMode: settings.scanner.analysisMode,
  });
  const prev = row.bars.length > 2 ? row.bars[row.bars.length - 2].c : row.base;
  const ch = ta.price - (row.prevClose || prev);
  const chp = (ch / (row.prevClose || prev)) * 100;
  return {
    ...row,
    ltp: ta.price,
    ch,
    chp,
    ta,
    plan,
    score: scored.score,
    scoreParts: scored.parts,
    reasons: scored.reasons,
    risks: scored.risks,
    label: scored.label,
    signal: decided.signal,
    signalWhy: decided.why,
    dir: scored.dir,
    fy: fySymbol(row.symbol),
  };
}

function computeRegime(rows) {
  const nifty = rows.find((r) => r.symbol === "NIFTY") || indexFromMean(rows, "NIFTY");
  const vix = rows.find((r) => r.symbol === "INDIAVIX");
  const n50 = rows.filter((r) => r.nifty50);
  const aboveVwap = n50.filter((r) => r.ta.aboveVwap).length / Math.max(1, n50.length);
  const emaBull = n50.filter((r) => r.ta.align.bias === "BULL").length / Math.max(1, n50.length);
  const adv = n50.filter((r) => r.chp > 0).length;
  const dec = n50.filter((r) => r.chp < 0).length;
  const breadth = adv / Math.max(1, adv + dec);
  const ta = nifty?.ta;
  let pts = 0;
  if (ta) {
    if (ta.price > ta.vwap) pts += 1.2;
    else pts -= 1.2;
    if (ta.price > ta.ema20) pts += 1;
    else pts -= 1;
    if (ta.ema20 > ta.ema50) pts += 1;
    else pts -= 1;
    if (ta.ema50 && ta.ema200 && ta.ema50 > ta.ema200) pts += 0.8;
    else pts -= 0.6;
    if (ta.rsi > 55) pts += 0.7;
    else if (ta.rsi < 45) pts -= 0.7;
    if (ta.momentum > 0.2) pts += 0.6;
    else if (ta.momentum < -0.2) pts -= 0.6;
    if (ta.rvol > 1.2) pts += 0.4;
  }
  pts += (aboveVwap - 0.5) * 2.2;
  pts += (emaBull - 0.5) * 2;
  pts += (breadth - 0.5) * 2;
  const vixPx = vix?.ltp || 13;
  if (vixPx > 18) pts -= 0.8;
  else if (vixPx < 12) pts += 0.4;
  const conf = Math.min(92, Math.max(54, 50 + Math.abs(pts) * 8));
  let label = "NEUTRAL";
  if (pts >= 3.2) label = "STRONG BULLISH";
  else if (pts >= 1.2) label = "BULLISH";
  else if (pts <= -3.2) label = "STRONG BEARISH";
  else if (pts <= -1.2) label = "BEARISH";
  return {
    label,
    score: Math.round(conf),
    pts,
    breadth: { adv, dec, aboveVwap, emaBull },
    vix: vixPx,
    note: "Confluence score from NIFTY vs VWAP/EMA, RSI, momentum, volume, breadth and VIX. Not a probability.",
  };
}

function indexFromMean() {
  return null;
}

function buildIndex(symbol, name, close, prevClose) {
  const bars = generateBars(symbol, close, "chop");
  return enrich({
    symbol,
    name,
    base: close,
    sector: "INDEX",
    nifty50: false,
    fno: true,
    bars,
    prevClose,
    isIndex: true,
  });
}

function sectorCards(rows) {
  const map = {};
  for (const s of SECTORS) map[s] = [];
  for (const r of rows) {
    if (r.isIndex) continue;
    if (map[r.sector]) map[r.sector].push(r);
  }
  const cards = Object.entries(map)
    .map(([name, list]) => {
      if (!list.length) return null;
      const chp = list.reduce((a, b) => a + b.chp, 0) / list.length;
      const rvol = list.reduce((a, b) => a + b.ta.rvol, 0) / list.length;
      const bull = list.filter((x) => x.ta.align.bias === "BULL").length / list.length;
      const rs = chp - (rows.find((x) => x.symbol === "NIFTY")?.chp || 0);
      let trend = "NEUTRAL";
      if (bull > 0.6 && chp > 0.3) trend = "BULLISH";
      else if (bull < 0.4 && chp < -0.3) trend = "BEARISH";
      const score = Math.max(1, Math.min(10, 5 + chp * 1.4 + (rvol - 1) * 1.2 + rs * 0.8));
      return { name, chp, rvol, rs, trend, score, n: list.length };
    })
    .filter(Boolean);
  cards.sort((a, b) => b.score - a.score);
  return cards;
}

function emit() {
  const detail = snapshot();
  for (const fn of listeners) fn(detail);
  window.dispatchEvent(new CustomEvent("nstox:market", { detail }));
}

function snapshot() {
  const rows = [...universe.values()].filter((r) => !r.isIndex);
  const indices = [...universe.values()].filter((r) => r.isIndex);
  return {
    rows,
    indices,
    regime,
    sectors: sectorCards([...universe.values()]),
    live: liveMode && isFyersConnected(),
    demo: !(liveMode && isFyersConnected()),
    frozen: !isCashSessionOpen(),
    selected: universe.get(selected),
    market: getMarketStatus(),
  };
}

function seed() {
  universe.clear();
  for (const meta of catalog()) {
    const bias = biasFor(meta.symbol);
    const bars = generateBars(meta.symbol, meta.base, bias);
    universe.set(meta.symbol, { ...meta, bars, bias });
  }
  const tmp = [...universe.values()].map((r) => enrich(r));
  for (const r of tmp) universe.set(r.symbol, r);
  for (const [sym, name, close, prev] of INDICES) {
    universe.set(sym, buildIndex(sym, name, close, prev));
  }
  regime = computeRegime([...universe.values()]);
  for (const [k, v] of universe) universe.set(k, enrich(v));
  regime = computeRegime([...universe.values()]);
}

function stepTicks() {
  if (!isCashSessionOpen()) return;
  const rand = Math.random;
  for (const row of universe.values()) {
    const last = row.bars[row.bars.length - 1];
    row.bars[row.bars.length - 1] = tickBar(last, row.bias || "chop", rand);
    const next = enrich(row);
    universe.set(row.symbol, next);
  }
  regime = computeRegime([...universe.values()]);
  emit();
}

async function overlayLiveQuotes() {
  if (!isFyersConnected()) return;
  try {
    const syms = [...universe.values()].slice(0, 40).map((r) => r.fy);
    const quotes = await getQuotes(syms);
    liveMode = true;
    for (const q of quotes) {
      const short = internalFromFy(q.symbol);
      const row = universe.get(short);
      if (!row || !q.ltp) continue;
      const last = row.bars[row.bars.length - 1];
      last.c = q.ltp;
      last.h = Math.max(last.h, q.high || q.ltp);
      last.l = Math.min(last.l, q.low || q.ltp);
      if (q.volume) last.v = q.volume;
      if (q.prevClose) row.prevClose = q.prevClose;
      universe.set(short, enrich(row));
    }
    emit();
  } catch {
    liveMode = false;
  }
}

export const Market = {
  init() {
    seed();
    emit();
    return snapshot();
  },
  snapshot,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get(sym) {
    const mapped = FY_TO_INTERNAL[sym] || sym;
    return universe.get(mapped) || universe.get(sym);
  },
  getSelected() {
    return universe.get(selected);
  },
  select(sym) {
    if (universe.has(sym)) selected = sym;
    emit();
  },
  getUniverse(kind = "NIFTY50") {
    const all = [...universe.values()].filter((r) => !r.isIndex);
    if (kind === "NIFTY50") return all.filter((r) => r.nifty50);
    if (kind === "FNO") return all.filter((r) => r.fno);
    if (kind === "WATCHLIST") {
      const lists = Storage.getWatchlists();
      const set = new Set(lists.flatMap((l) => l.symbols).map((s) => FY_TO_INTERNAL[s] || s));
      return all.filter((r) => set.has(r.symbol));
    }
    return all;
  },
  indices() {
    return ["NIFTY", "BANKNIFTY", "SENSEX", "INDIAVIX"].map((s) => universe.get(s)).filter(Boolean);
  },
  regime() {
    return regime;
  },
  sectors() {
    return sectorCards([...universe.values()]);
  },
  startTicks(ms = 2500) {
    if (ticking) return;
    ticking = true;
    tickTimer = setInterval(() => {
      if (!isCashSessionOpen()) return;
      stepTicks();
      if (isFyersConnected()) overlayLiveQuotes();
    }, ms);
  },
  stopTicks() {
    ticking = false;
    clearInterval(tickTimer);
  },
  refresh() {
    if (!isCashSessionOpen()) return;
    stepTicks();
  },
  fySymbol,
  internalFromFy,
  isDemo() {
    return !(liveMode && isFyersConnected());
  },
  isFrozen() {
    return !isCashSessionOpen();
  },
};

export { inr, fmtPct, SECTORS, fySymbol };
