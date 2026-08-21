/**
 * Market engine — demo universe, live ticks, regime, sectors.
 * When FYERS is connected, quotes overlay demo bars. CORS failures stay in demo.
 */
import { Storage, hashStr, mulberry32, getMarketStatus, inr, fmtPct } from "./storage.js";
import { analyzeBars } from "./technicals.js";
import { scoreSymbol, decideSignal } from "./scoring.js";
import { buildPlan, classicPivots } from "./levels.js";
import { isFyersConnected, getQuotes } from "./fyers.js";

const NIFTY50 = [
  ["RELIANCE", "Reliance Industries", 1392, "ENERGY"],
  ["HDFCBANK", "HDFC Bank", 1678, "BANKING"],
  ["BHARTIARTL", "Bharti Airtel", 1642, "TELECOM"],
  ["TCS", "Tata Consultancy", 4185, "IT"],
  ["ICICIBANK", "ICICI Bank", 1228, "BANKING"],
  ["SBIN", "State Bank of India", 842, "PSU BANK"],
  ["INFY", "Infosys", 1864, "IT"],
  ["BAJFINANCE", "Bajaj Finance", 912, "FINANCIAL SERVICES"],
  ["HINDUNILVR", "Hindustan Unilever", 2488, "FMCG"],
  ["ITC", "ITC", 492, "FMCG"],
  ["LT", "Larsen & Toubro", 3610, "INFRA"],
  ["MARUTI", "Maruti Suzuki", 12740, "AUTO"],
  ["AXISBANK", "Axis Bank", 1148, "BANKING"],
  ["KOTAKBANK", "Kotak Mahindra Bank", 1865, "BANKING"],
  ["SUNPHARMA", "Sun Pharma", 1722, "PHARMA"],
  ["HCLTECH", "HCL Technologies", 1788, "IT"],
  ["M&M", "Mahindra & Mahindra", 2785, "AUTO"],
  ["ETERNAL", "Eternal", 328, "SERVICES"],
  ["TITAN", "Titan Company", 3488, "FMCG"],
  ["ULTRACEMCO", "UltraTech Cement", 11890, "METAL"],
  ["NTPC", "NTPC", 368, "ENERGY"],
  ["BAJAJFINSV", "Bajaj Finserv", 1988, "FINANCIAL SERVICES"],
  ["ADANIENT", "Adani Enterprises", 3012, "ENERGY"],
  ["ONGC", "ONGC", 268, "ENERGY"],
  ["POWERGRID", "Power Grid", 332, "ENERGY"],
  ["WIPRO", "Wipro", 498, "IT"],
  ["ASIANPAINT", "Asian Paints", 2482, "FMCG"],
  ["ADANIPORTS", "Adani Ports", 1448, "INFRA"],
  ["COALINDIA", "Coal India", 412, "ENERGY"],
  ["JSWSTEEL", "JSW Steel", 978, "METAL"],
  ["TATASTEEL", "Tata Steel", 162, "METAL"],
  ["NESTLEIND", "Nestle India", 2388, "FMCG"],
  ["BEL", "Bharat Electronics", 312, "PSU"],
  ["JIOFIN", "Jio Financial Services", 246, "FINANCIAL SERVICES"],
  ["GRASIM", "Grasim Industries", 2688, "METAL"],
  ["TECHM", "Tech Mahindra", 1588, "IT"],
  ["TRENT", "Trent", 5488, "FMCG"],
  ["HINDALCO", "Hindalco", 698, "METAL"],
  ["CIPLA", "Cipla", 1544, "PHARMA"],
  ["TATAPV", "Tata Motors PV", 318, "AUTO"],
  ["TATACV", "Tata Motors CV", 467, "AUTO"],
  ["BAJAJ-AUTO", "Bajaj Auto", 9188, "AUTO"],
  ["EICHERMOT", "Eicher Motors", 5488, "AUTO"],
  ["DRREDDY", "Dr Reddy's", 1288, "PHARMA"],
  ["TATACONSUM", "Tata Consumer", 1142, "FMCG"],
  ["APOLLOHOSP", "Apollo Hospitals", 6988, "PHARMA"],
  ["SHRIRAMFIN", "Shriram Finance", 668, "FINANCIAL SERVICES"],
  ["SBILIFE", "SBI Life", 1688, "FINANCIAL SERVICES"],
  ["HDFCLIFE", "HDFC Life", 748, "FINANCIAL SERVICES"],
  ["INDIGO", "InterGlobe Aviation", 5620, "SERVICES"],
  ["MAXHEALTH", "Max Healthcare", 1128, "PHARMA"],
];

const EXTRA_FNO = [
  ["HEROMOTOCO", "Hero MotoCorp", 4988, "AUTO"],
  ["INDUSINDBK", "IndusInd Bank", 1022, "BANKING"],
  ["BPCL", "BPCL", 318, "ENERGY"],
  ["DIVISLAB", "Divi's Labs", 4988, "PHARMA"],
  ["BANKBARODA", "Bank of Baroda", 248, "PSU BANK"],
  ["PNB", "Punjab National Bank", 108, "PSU BANK"],
  ["CANBK", "Canara Bank", 112, "PSU BANK"],
  ["DLF", "DLF", 848, "REALTY"],
  ["GODREJPROP", "Godrej Properties", 2288, "REALTY"],
  ["OBEROIRLTY", "Oberoi Realty", 1788, "REALTY"],
  ["LODHA", "Macrotech Developers", 1288, "REALTY"],
  ["IRFC", "IRFC", 148, "PSU"],
  ["RECLTD", "REC", 498, "FINANCIAL SERVICES"],
  ["PFC", "Power Finance", 468, "FINANCIAL SERVICES"],
  ["VEDL", "Vedanta", 468, "METAL"],
  ["HINDZINC", "Hindustan Zinc", 498, "METAL"],
  ["NMDC", "NMDC", 78, "METAL"],
  ["IOC", "Indian Oil", 148, "ENERGY"],
  ["GAIL", "GAIL", 198, "ENERGY"],
  ["TVSMOTOR", "TVS Motor", 2688, "AUTO"],
  ["ASHOKLEY", "Ashok Leyland", 232, "AUTO"],
  ["MOTHERSON", "Samvardhana Motherson", 148, "AUTO"],
  ["PERSISTENT", "Persistent Systems", 5988, "IT"],
  ["COFORGE", "Coforge", 7888, "IT"],
  ["LUPIN", "Lupin", 1988, "PHARMA"],
  ["AUROPHARMA", "Aurobindo Pharma", 1288, "PHARMA"],
  ["DABUR", "Dabur", 548, "FMCG"],
  ["GODREJCP", "Godrej Consumer", 1188, "FMCG"],
  ["PIDILITIND", "Pidilite", 2988, "FMCG"],
  ["HAVELLS", "Havells", 1688, "FMCG"],
  ["SIEMENS", "Siemens", 5488, "INFRA"],
  ["ABB", "ABB India", 7988, "INFRA"],
];

const EXTRA_500 = [
  ["PAYTM", "One97 Communications", 812, "FINANCIAL SERVICES"],
  ["POLYCAB", "Polycab", 5988, "INFRA"],
  ["DIXON", "Dixon Technologies", 12880, "IT"],
  ["KALYANKJIL", "Kalyan Jewellers", 548, "FMCG"],
  ["FEDERALBNK", "Federal Bank", 198, "BANKING"],
  ["IDFCFIRSTB", "IDFC First Bank", 72, "BANKING"],
  ["BANDHANBNK", "Bandhan Bank", 178, "BANKING"],
  ["YESBANK", "Yes Bank", 22, "BANKING"],
  ["IRCTC", "IRCTC", 812, "SERVICES"],
  ["POLICYBZR", "PB Fintech", 1688, "FINANCIAL SERVICES"],
  ["NAUKRI", "Info Edge", 6988, "IT"],
  ["MCX", "MCX", 5488, "FINANCIAL SERVICES"],
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
  return getMarketStatus().code === "OPEN";
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
  const rand = mulberry32(hashStr(symbol + ":bars:v3"));
  const bars = [];
  let px = base * (0.985 + rand() * 0.02);
  const t0 = Date.now() - n * 5 * 60 * 1000;
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
  return bars;
}

function tickBar(bar, bias, rand) {
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
  for (const [sym, name, px, sector, n50] of NIFTY50) {
    rows.push({ symbol: sym, name, base: px, sector, nifty50: true, fno: true, nifty500: true });
  }
  for (const [sym, name, px, sector] of EXTRA_FNO) {
    rows.push({ symbol: sym, name, base: px, sector, nifty50: false, fno: true, nifty500: true });
  }
  for (const [sym, name, px, sector] of EXTRA_500) {
    rows.push({ symbol: sym, name, base: px, sector, nifty50: false, fno: false, nifty500: true });
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

function buildIndex(symbol, name, base, members, sector = "INDEX") {
  const bars = generateBars(symbol, base, members.filter((m) => m.ta.align.bias === "BULL").length > members.length / 2 ? "bull" : "chop");
  const row = { symbol, name, base, sector, nifty50: false, fno: true, nifty500: false, bars, prevClose: base * 0.997, isIndex: true };
  return enrich(row);
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
    const prevClose = bars[Math.max(0, bars.length - 76)]?.c || meta.base;
    universe.set(meta.symbol, { ...meta, bars, prevClose, bias });
  }
  const tmp = [...universe.values()].map((r) => enrich(r));
  for (const r of tmp) universe.set(r.symbol, r);
  const n50 = tmp.filter((r) => r.nifty50);
  universe.set("NIFTY", buildIndex("NIFTY", "Nifty 50", 24785, n50));
  universe.set("BANKNIFTY", buildIndex("BANKNIFTY", "Bank Nifty", 52140, n50.filter((r) => r.sector === "BANKING" || r.sector === "PSU BANK")));
  universe.set("SENSEX", buildIndex("SENSEX", "Sensex", 81120, n50));
  universe.set("FINNIFTY", buildIndex("FINNIFTY", "FinNifty", 23880, n50.filter((r) => r.sector === "FINANCIAL SERVICES" || r.sector === "BANKING")));
  const vixBars = generateBars("INDIAVIX", 12.8, "chop", 160);
  universe.set(
    "INDIAVIX",
    enrich({
      symbol: "INDIAVIX",
      name: "India VIX",
      base: 12.8,
      sector: "INDEX",
      bars: vixBars,
      prevClose: 13.1,
      isIndex: true,
      nifty50: false,
      fno: false,
      nifty500: false,
    }),
  );
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
    if (kind === "NIFTY500") return all.filter((r) => r.nifty500);
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
