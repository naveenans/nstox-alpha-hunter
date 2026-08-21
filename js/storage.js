/**
 * LocalStorage layer for NSTOX ALPHA HUNTER.
 * Never persist FYERS app secrets. Tokens are user-supplied and stay on-device.
 */
const KEYS = {
  fyers: "nstox_fyers_token",
  settings: "nstox_settings",
  watchlist: "nstox_watchlist",
  scanner: "nstox_scanner_settings",
  ui: "nstox_ui",
  alerts: "nstox_alerts_log",
};

export const DEFAULT_SETTINGS = {
  fyers: {
    appId: "",
    redirectUri: "",
    accessToken: "",
    clientId: "",
    environment: "live",
    connected: false,
  },
  scanner: {
    universe: "NIFTY50",
    signal: "ALL",
    minScore: 8,
    minRR: 2,
    minRvol: 1.5,
    intervalSec: 10,
    autoScan: true,
    analysisMode: true,
    aboveVwap: false,
    belowVwap: false,
    bos: false,
    retest: false,
    breakout: false,
    liquiditySweep: false,
  },
  technical: {
    rsiPeriod: 14,
    ema9: 9,
    ema20: 20,
    ema50: 50,
    ema100: 100,
    ema200: 200,
    atrPeriod: 14,
    atrMult: 1.2,
  },
  structure: {
    swingSensitivity: 3,
    bosThreshold: 0.05,
    retestTolerance: 0.15,
    breakoutThreshold: 0.1,
  },
  options: {
    minVolume: 50000,
    minOI: 100000,
    maxSpreadPct: 1.5,
    preferredDelta: 0.4,
    atmDistance: 3,
  },
  alerts: {
    browser: true,
    sound: true,
    scoreAlert: 8,
    onBuy: true,
    onSell: true,
    onBos: true,
    onBreakout: true,
    onVwap: true,
    onRvol: true,
    onSweep: true,
  },
  ui: {
    compact: false,
    animations: true,
  },
  weights: {
    regime: 1,
    trend: 1,
    vwap: 1,
    momentum: 1,
    volume: 1,
    bos: 1,
    retest: 0.75,
    breakout: 0.75,
    liquidity: 0.75,
    rr: 0.75,
  },
};

export const DEFAULT_WATCHLISTS = [
  { id: "momentum", name: "Momentum", symbols: ["RELIANCE", "SBIN", "TATAMOTORS", "HINDALCO", "BEL"] },
  { id: "breakout", name: "Breakout", symbols: ["TRENT", "BAJFINANCE", "ADANIENT", "BEL", "POWERGRID"] },
  { id: "fno", name: "F&O", symbols: ["NIFTY", "BANKNIFTY", "RELIANCE", "HDFCBANK", "ICICIBANK"] },
  { id: "options", name: "Options", symbols: ["NIFTY", "BANKNIFTY", "FINNIFTY"] },
  { id: "mystocks", name: "My Stocks", symbols: ["RELIANCE", "TCS", "INFY", "ITC", "TATAMOTORS"] },
];

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    return JSON.parse(raw);
  } catch {
    return structuredClone(fallback);
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function deepMerge(base, extra) {
  if (!extra || typeof extra !== "object") return structuredClone(base);
  const out = structuredClone(base);
  for (const k of Object.keys(extra)) {
    if (
      extra[k] &&
      typeof extra[k] === "object" &&
      !Array.isArray(extra[k]) &&
      out[k] &&
      typeof out[k] === "object"
    ) {
      out[k] = deepMerge(out[k], extra[k]);
    } else if (extra[k] !== undefined) {
      out[k] = extra[k];
    }
  }
  return out;
}

export const Storage = {
  getSettings() {
    return deepMerge(DEFAULT_SETTINGS, read(KEYS.settings, {}));
  },
  setSettings(s) {
    write(KEYS.settings, s);
    window.dispatchEvent(new CustomEvent("nstox:settings", { detail: s }));
  },
  patchSettings(partial) {
    const next = deepMerge(this.getSettings(), partial);
    this.setSettings(next);
    return next;
  },
  getFyers() {
    const s = this.getSettings();
    return s.fyers;
  },
  setFyers(fyers) {
    return this.patchSettings({ fyers });
  },
  clearToken() {
    const s = this.getSettings();
    s.fyers.accessToken = "";
    s.fyers.connected = false;
    this.setSettings(s);
  },
  getWatchlists() {
    return read(KEYS.watchlist, DEFAULT_WATCHLISTS);
  },
  setWatchlists(lists) {
    write(KEYS.watchlist, lists);
    window.dispatchEvent(new CustomEvent("nstox:watchlist", { detail: lists }));
  },
  getScanner() {
    return this.getSettings().scanner;
  },
  setScanner(scanner) {
    return this.patchSettings({ scanner });
  },
  exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      watchlists: this.getWatchlists(),
    };
  },
  importAll(payload) {
    if (!payload || typeof payload !== "object") throw new Error("Invalid settings file");
    if (payload.settings) this.setSettings(deepMerge(DEFAULT_SETTINGS, payload.settings));
    if (payload.watchlists) this.setWatchlists(payload.watchlists);
  },
  resetAll() {
    localStorage.removeItem(KEYS.settings);
    localStorage.removeItem(KEYS.watchlist);
    localStorage.removeItem(KEYS.scanner);
    localStorage.removeItem(KEYS.fyers);
    localStorage.removeItem(KEYS.ui);
    window.dispatchEvent(new CustomEvent("nstox:settings", { detail: this.getSettings() }));
    window.dispatchEvent(new CustomEvent("nstox:watchlist", { detail: this.getWatchlists() }));
  },
  logAlert(entry) {
    const log = read(KEYS.alerts, []);
    log.unshift({ ...entry, t: Date.now() });
    write(KEYS.alerts, log.slice(0, 80));
  },
  getAlertLog() {
    return read(KEYS.alerts, []);
  },
};

export function inr(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 2 : d;
  return (
    (n < 0 ? "-" : "") +
    "₹" +
    abs.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })
  );
}

export function fmtPct(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = n.toFixed(d);
  return (n > 0 ? "+" : "") + s + "%";
}

export function fmtNum(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

export function fmtVol(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
  if (abs >= 1e5) return (n / 1e5).toFixed(2) + " L";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

export function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nowIST() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value;
  return {
    h: +g("hour"),
    m: +g("minute"),
    s: +g("second"),
    w: g("weekday"),
    date: `${g("year")}-${g("month")}-${g("day")}`,
    clock: `${g("hour")}:${g("minute")}:${g("second")}`,
  };
}

export function getMarketStatus() {
  const { h, m, w } = nowIST();
  const mins = h * 60 + m;
  const weekend = w === "Sat" || w === "Sun";
  if (weekend) return { code: "CLOSED", label: "MARKET CLOSED", session: "Weekend" };
  if (mins >= 9 * 60 && mins < 9 * 60 + 15)
    return { code: "PRE", label: "PRE-MARKET", session: "09:00–09:15 IST" };
  if (mins >= 9 * 60 + 15 && mins < 15 * 60 + 30)
    return { code: "OPEN", label: "MARKET OPEN", session: "09:15–15:30 IST" };
  return { code: "CLOSED", label: "MARKET CLOSED", session: "Opens 09:15 IST" };
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function throttle(fn, ms) {
  let last = 0;
  let pending;
  return (...args) => {
    const now = Date.now();
    const remain = ms - (now - last);
    if (remain <= 0) {
      last = now;
      fn(...args);
    } else {
      clearTimeout(pending);
      pending = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, remain);
    }
  };
}
