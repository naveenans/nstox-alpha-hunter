/**
 * FYERS API v3 client for a static browser app.
 *
 * Auth header:  Authorization: <APP_ID>:<ACCESS_TOKEN>
 * Docs: https://myapi.fyers.in/docsv3
 *
 * OAuth token exchange requires SHA-256(appId + appSecret) and MUST NOT be
 * performed in this static client. Use the manually pasted access-token path.
 */
import { Storage } from "./storage.js";

export const FYERS_ENDPOINTS = {
  authCode: "https://api-t1.fyers.in/api/v3/generate-authcode",
  validateAuth: "https://api-t1.fyers.in/api/v3/validate-authcode",
  apiBase: "https://api-t1.fyers.in/api/v3",
  dataBase: "https://api-t1.fyers.in/data",
  wsData: "wss://api-t1.fyers.in/socket/v2/dataSock",
  wsOrder: "wss://api-t1.fyers.in/socket/v2/orderSock",
};

const state = {
  connected: false,
  lastError: null,
  lastProfile: null,
  lastTestAt: 0,
};

function cfg() {
  return Storage.getFyers();
}

function authHeader() {
  const { appId, accessToken } = cfg();
  if (!appId || !accessToken) return null;
  return `${appId}:${accessToken}`;
}

async function fyersFetch(url, options = {}) {
  const header = authHeader();
  if (!header) {
    const err = new Error("FYERS NOT CONNECTED");
    err.code = "NOT_CONNECTED";
    throw err;
  }
  const headers = {
    Authorization: header,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e) {
    const err = new Error(
      "Browser blocked the FYERS request (CORS or network). Static HTML cannot complete a confidential OAuth exchange. Stay in DEMO MODE or paste a token and use a CORS-permitted origin.",
    );
    err.code = "CORS";
    err.cause = e;
    throw err;
  }
  if (res.status === 429) {
    const err = new Error("RATE LIMIT");
    err.code = "RATE_LIMIT";
    throw err;
  }
  if (res.status === 401 || res.status === 403) {
    const err = new Error("TOKEN EXPIRED");
    err.code = "TOKEN_EXPIRED";
    state.connected = false;
    Storage.setFyers({ ...cfg(), connected: false });
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (json.s && json.s !== "ok") {
    const msg = json.message || "FYERS error";
    const err = new Error(msg);
    err.code = json.code;
    throw err;
  }
  return json;
}

export function isFyersConnected() {
  const f = cfg();
  return !!(f.connected && f.appId && f.accessToken);
}

export function getFyersState() {
  return { ...state, connected: isFyersConnected(), config: cfg() };
}

export function fyersAuthUrl() {
  const { appId, redirectUri } = cfg();
  if (!appId || !redirectUri) return null;
  const u = new URL(FYERS_ENDPOINTS.authCode);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", "nstox");
  return u.toString();
}

export async function connectFyers() {
  const f = cfg();
  if (!f.appId) throw new Error("Enter App ID");
  if (!f.accessToken) {
    const err = new Error(
      "OAuth token exchange requires a secure backend. Use the manually supplied access-token mode for this static HTML version.",
    );
    err.code = "NEEDS_TOKEN";
    throw err;
  }
  await testFyersConnection();
  Storage.setFyers({ ...cfg(), connected: true });
  state.connected = true;
  window.dispatchEvent(new CustomEvent("nstox:fyers", { detail: getFyersState() }));
  return getFyersState();
}

export function disconnectFyers() {
  state.connected = false;
  state.lastProfile = null;
  Storage.setFyers({ ...cfg(), connected: false });
  window.dispatchEvent(new CustomEvent("nstox:fyers", { detail: getFyersState() }));
}

export async function testFyersConnection() {
  const json = await fyersFetch(`${FYERS_ENDPOINTS.apiBase}/profile`);
  state.lastProfile = json.data || json;
  state.lastTestAt = Date.now();
  state.connected = true;
  state.lastError = null;
  Storage.setFyers({ ...cfg(), connected: true });
  window.dispatchEvent(new CustomEvent("nstox:fyers", { detail: getFyersState() }));
  return state.lastProfile;
}

export async function getQuotes(symbols) {
  const list = (Array.isArray(symbols) ? symbols : [symbols]).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < list.length; i += 50) chunks.push(list.slice(i, i + 50));
  const out = [];
  for (const c of chunks) {
    const url = `${FYERS_ENDPOINTS.dataBase}/quotes?symbols=${encodeURIComponent(c.join(","))}`;
    const json = await fyersFetch(url);
    const rows = json.d || json.data || [];
    for (const row of rows) {
      const v = row.v || row;
      out.push({
        symbol: row.n || v.symbol,
        ltp: v.lp ?? v.ltp,
        ch: v.ch,
        chp: v.chp,
        open: v.open_price ?? v.open,
        high: v.high_price ?? v.high,
        low: v.low_price ?? v.low,
        prevClose: v.prev_close_price ?? v.prev_close,
        volume: v.volume,
        bid: v.bid,
        ask: v.ask,
        atp: v.atp,
      });
    }
  }
  return out;
}

export async function getHistoricalData({ symbol, resolution = "5", rangeFrom, rangeTo, dateFormat = "1" }) {
  const u = new URL(`${FYERS_ENDPOINTS.dataBase}/history`);
  u.searchParams.set("symbol", symbol);
  u.searchParams.set("resolution", String(resolution));
  u.searchParams.set("date_format", String(dateFormat));
  u.searchParams.set("range_from", rangeFrom);
  u.searchParams.set("range_to", rangeTo);
  u.searchParams.set("cont_flag", "1");
  const json = await fyersFetch(u.toString());
  const candles = json.candles || [];
  return candles.map((c) => ({
    t: c[0] * (c[0] < 1e12 ? 1000 : 1),
    o: c[1],
    h: c[2],
    l: c[3],
    c: c[4],
    v: c[5],
  }));
}

export async function getOptionChain({ symbol, strikecount = 10, timestamp } = {}) {
  const u = new URL(`${FYERS_ENDPOINTS.dataBase}/options-chain-v3`);
  u.searchParams.set("symbol", symbol);
  u.searchParams.set("strikecount", String(strikecount));
  if (timestamp) u.searchParams.set("timestamp", String(timestamp));
  const json = await fyersFetch(u.toString());
  return json.data || json;
}

export async function getMarketDepth(symbol) {
  const u = new URL(`${FYERS_ENDPOINTS.dataBase}/depth`);
  u.searchParams.set("symbol", symbol);
  u.searchParams.set("ohlcv_flag", "1");
  return fyersFetch(u.toString());
}

export async function getMarketStatus() {
  return fyersFetch(`${FYERS_ENDPOINTS.dataBase}/marketStatus`);
}

export function subscribeMarketData(symbols, onTick) {
  return { symbols, onTick, live: false };
}

export function unsubscribeMarketData() {
  return true;
}

export const Fyers = {
  endpoints: FYERS_ENDPOINTS,
  connectFyers,
  disconnectFyers,
  testFyersConnection,
  getQuotes,
  getHistoricalData,
  getOptionChain,
  getMarketDepth,
  getMarketStatus,
  subscribeMarketData,
  unsubscribeMarketData,
  isFyersConnected,
  getFyersState,
  fyersAuthUrl,
};
