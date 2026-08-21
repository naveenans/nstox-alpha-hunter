/**
 * FYERS API v3 client.
 * OAuth: App ID + Secret ID → generate-authcode → validate-authcode → access_token.
 * Market calls go through the same-origin Hunter proxy when available.
 */
import { Storage } from "./storage.js";

export const FYERS_ENDPOINTS = {
  authCode: "https://api-t1.fyers.in/api/v3/generate-authcode",
  validateAuth: "https://api-t1.fyers.in/api/v3/validate-authcode",
  validateRefresh: "https://api-t1.fyers.in/api/v3/validate-refresh-token",
  apiBase: "https://api-t1.fyers.in/api/v3",
  dataBase: "https://api-t1.fyers.in/data",
  wsData: "wss://api-t1.fyers.in/socket/v2/dataSock",
};

const state = {
  connected: false,
  lastError: null,
  lastProfile: null,
  lastTestAt: 0,
  proxy: null,
};

function cfg() {
  return Storage.getFyers();
}

function authHeader() {
  const { appId, accessToken } = cfg();
  if (!appId || !accessToken) return null;
  return `${appId}:${accessToken}`;
}

export function defaultRedirectUri() {
  try {
    return new URL("callback.html", window.location.href).href.split("#")[0];
  } catch {
    return "";
  }
}

export async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hasFyersProxy() {
  if (state.proxy !== null) return state.proxy;
  try {
    const r = await fetch("/api/fyers/health", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    state.proxy = !!(r.ok && j.ok);
  } catch {
    state.proxy = false;
  }
  return state.proxy;
}

function cleanTokenPayload(json) {
  const access =
    json.access_token || json.data?.access_token || json.data?.accessToken || "";
  const refresh =
    json.refresh_token || json.data?.refresh_token || json.data?.refreshToken || "";
  if (json.s && json.s !== "ok") {
    const err = new Error(json.message || json.data?.message || "FYERS token error");
    err.code = json.code;
    throw err;
  }
  if (!access) {
    throw new Error(json.message || "FYERS did not return an access token");
  }
  return { access_token: access, refresh_token: refresh };
}

export async function exchangeAuthCode(appId, secretId, code) {
  const proxy = await hasFyersProxy();
  if (proxy) {
    const r = await fetch("/api/fyers/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, secretId, authCode: code }),
    });
    const json = await r.json().catch(() => ({}));
    return cleanTokenPayload(json);
  }
  const appIdHash = await sha256hex(`${appId}:${secretId}`);
  let r;
  try {
    r = await fetch(FYERS_ENDPOINTS.validateAuth, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        appIdHash,
        code,
      }),
    });
  } catch (e) {
    const err = new Error(
      "Browser blocked the FYERS token request (CORS). Open Hunter from this preview so the built-in proxy can fetch the token.",
    );
    err.code = "CORS";
    err.cause = e;
    throw err;
  }
  const json = await r.json().catch(() => ({}));
  return cleanTokenPayload(json);
}

export async function refreshAccessToken() {
  const f = cfg();
  if (!f.appId || !f.secretId || !f.refreshToken || !f.pin) {
    throw new Error("Refresh needs App ID, Secret ID, refresh token and PIN");
  }
  const proxy = await hasFyersProxy();
  let json;
  if (proxy) {
    const r = await fetch("/api/fyers/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: f.appId,
        secretId: f.secretId,
        refreshToken: f.refreshToken,
        pin: f.pin,
      }),
    });
    json = await r.json().catch(() => ({}));
  } else {
    const appIdHash = await sha256hex(`${f.appId}:${f.secretId}`);
    const r = await fetch(FYERS_ENDPOINTS.validateRefresh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        appIdHash,
        refresh_token: f.refreshToken,
        pin: f.pin,
      }),
    });
    json = await r.json().catch(() => ({}));
  }
  const tokens = cleanTokenPayload(json);
  Storage.setFyers({
    ...cfg(),
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || f.refreshToken,
    connected: true,
  });
  return tokens;
}

async function fyersFetch(proxyPath, directUrl, retried = false) {
  const header = authHeader();
  if (!header) {
    const err = new Error("FYERS NOT CONNECTED");
    err.code = "NOT_CONNECTED";
    throw err;
  }
  const proxy = await hasFyersProxy();
  let res;
  try {
    if (proxy) {
      res = await fetch(proxyPath, {
        headers: { Authorization: header, Accept: "application/json" },
      });
    } else {
      res = await fetch(directUrl, {
        headers: {
          Authorization: header,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
    }
  } catch (e) {
    const err = new Error(
      "FYERS request blocked (CORS or network). Stay in DEMO MODE, or use Hunter with the built-in proxy.",
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
    if (!retried && cfg().refreshToken && cfg().pin) {
      try {
        await refreshAccessToken();
        return fyersFetch(proxyPath, directUrl, true);
      } catch {
        /* fall through */
      }
    }
    const err = new Error("TOKEN EXPIRED");
    err.code = "TOKEN_EXPIRED";
    state.connected = false;
    Storage.setFyers({ ...cfg(), connected: false });
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (json.s && json.s !== "ok") {
    const err = new Error(json.message || "FYERS error");
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

export function fyersAuthUrl(stateKey = "nstox") {
  const f = cfg();
  const appId = f.appId;
  const redirectUri = f.redirectUri || defaultRedirectUri();
  if (!appId || !redirectUri) return null;
  const u = new URL(FYERS_ENDPOINTS.authCode);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", stateKey);
  return u.toString();
}

export async function connectFyers() {
  const f = cfg();
  if (!f.appId) throw new Error("Enter App ID");
  if (!f.secretId) throw new Error("Enter Secret ID");
  if (!f.accessToken) throw new Error("Login with FYERS first — the access token is fetched automatically");
  await testFyersConnection();
  Storage.setFyers({ ...cfg(), connected: true });
  state.connected = true;
  window.dispatchEvent(new CustomEvent("nstox:fyers", { detail: getFyersState() }));
  return getFyersState();
}

export function disconnectFyers() {
  state.connected = false;
  state.lastProfile = null;
  Storage.setFyers({ ...cfg(), connected: false, accessToken: "", refreshToken: "" });
  window.dispatchEvent(new CustomEvent("nstox:fyers", { detail: getFyersState() }));
}

export async function testFyersConnection() {
  const json = await fyersFetch("/api/fyers/profile", `${FYERS_ENDPOINTS.apiBase}/profile`);
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
  for (let i = 0; i < list.length; i += 50) chunks.push(list.slice(i, 50 + i));
  const out = [];
  for (const c of chunks) {
    const q = `symbols=${encodeURIComponent(c.join(","))}`;
    const json = await fyersFetch(`/api/fyers/quotes?${q}`, `${FYERS_ENDPOINTS.dataBase}/quotes?${q}`);
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
  const q = new URLSearchParams({
    symbol,
    resolution: String(resolution),
    date_format: String(dateFormat),
    range_from: String(rangeFrom),
    range_to: String(rangeTo),
    cont_flag: "1",
  });
  const json = await fyersFetch(
    `/api/fyers/history?${q}`,
    `${FYERS_ENDPOINTS.dataBase}/history?${q}`,
  );
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

export async function getOptionChain({ symbol, strikecount = 16, timestamp } = {}) {
  const q = new URLSearchParams({ symbol, strikecount: String(strikecount), greeks: "1" });
  if (timestamp) q.set("timestamp", String(timestamp));
  const json = await fyersFetch(
    `/api/fyers/option-chain?${q}`,
    `${FYERS_ENDPOINTS.dataBase}/options-chain-v3?${q}`,
  );
  return json.data || json;
}

export async function getMarketDepth(symbol) {
  const q = `symbol=${encodeURIComponent(symbol)}&ohlcv_flag=1`;
  return fyersFetch(`/api/fyers/depth?${q}`, `${FYERS_ENDPOINTS.dataBase}/depth?${q}`);
}

export async function getMarketStatus() {
  return fyersFetch("/api/fyers/market-status", `${FYERS_ENDPOINTS.dataBase}/marketStatus`);
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
  exchangeAuthCode,
  refreshAccessToken,
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
  defaultRedirectUri,
  hasFyersProxy,
};
