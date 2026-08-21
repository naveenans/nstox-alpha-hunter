/**
 * FYERS OAuth: App ID + Secret ID → login → auto-fetch access token.
 */
import { Storage } from "./storage.js";
import {
  fyersAuthUrl,
  connectFyers,
  disconnectFyers,
  testFyersConnection,
  getFyersState,
  exchangeAuthCode,
  defaultRedirectUri,
  hasFyersProxy,
} from "./fyers.js";
import { Alerts } from "./alerts.js";

export function captureRedirectToken() {
  const q = new URLSearchParams(location.search);
  return q.get("auth_code") || q.get("code");
}

function stripOAuthParams() {
  const u = new URL(location.href);
  ["auth_code", "code", "state", "s", "message"].forEach((k) => u.searchParams.delete(k));
  history.replaceState({}, "", u.pathname + u.search + u.hash);
}

export const Auth = {
  captureRedirectToken,

  saveFromForm(form) {
    const fyers = {
      ...Storage.getFyers(),
      appId: form.appId.value.trim(),
      secretId: form.secretId.value.trim(),
      redirectUri: (form.redirectUri.value.trim() || defaultRedirectUri()),
      accessToken: form.accessToken?.value.trim() || Storage.getFyers().accessToken,
      pin: form.pin?.value.trim() || "",
      clientId: form.clientId?.value.trim() || "",
      environment: form.environment.value,
    };
    Storage.setFyers(fyers);
    return fyers;
  },

  loginWithFyers() {
    const f = Storage.getFyers();
    if (!f.appId) {
      Alerts.toast("Enter App ID", "warn");
      return;
    }
    if (!f.secretId) {
      Alerts.toast("Enter Secret ID", "warn");
      return;
    }
    const redirect = f.redirectUri || defaultRedirectUri();
    Storage.setFyers({ ...f, redirectUri: redirect });
    const stateKey = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    sessionStorage.setItem("nstox_oauth_state", stateKey);
    sessionStorage.setItem("nstox_oauth_pending", "1");
    const url = fyersAuthUrl(stateKey);
    if (!url) {
      Alerts.toast("Add App ID and Redirect URI first", "warn");
      return;
    }
    Alerts.toast("Opening FYERS login…", "info");
    try {
      window.top.location.href = url;
    } catch {
      location.href = url;
    }
  },

  async finishOAuth() {
    const q = new URLSearchParams(location.search);
    const code = q.get("auth_code") || q.get("code");
    const errMsg = q.get("message");
    const flag = q.get("s");
    if (!code) {
      if (flag && flag !== "ok") {
        Alerts.toast(errMsg || "FYERS login failed", "warn");
      }
      if ((document.body?.dataset?.page || "") === "callback") {
        location.replace("settings.html");
      }
      return false;
    }
    const state = q.get("state");
    const expected = sessionStorage.getItem("nstox_oauth_state");
    if (expected && state && expected !== state) {
      Alerts.toast("OAuth state mismatch — try Login with FYERS again", "warn");
      stripOAuthParams();
      return false;
    }
    const f = Storage.getFyers();
    if (!f.appId || !f.secretId) {
      Alerts.toast("App ID and Secret ID are required to fetch the access token", "warn");
      return false;
    }
    try {
      Alerts.toast("Fetching access token…", "info");
      const tokens = await exchangeAuthCode(f.appId, f.secretId, code);
      Storage.setFyers({
        ...Storage.getFyers(),
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || "",
        connected: true,
      });
      sessionStorage.removeItem("nstox_oauth_pending");
      sessionStorage.removeItem("nstox_oauth_state");
      stripOAuthParams();
      try {
        await testFyersConnection();
      } catch {
        /* token saved; live quotes may still need proxy */
      }
      Alerts.toast("Access token saved · FYERS connected", "buy");
      window.dispatchEvent(new CustomEvent("nstox:fyers", { detail: getFyersState() }));
      if ((document.body?.dataset?.page || "") === "callback") {
        location.replace("settings.html?connected=1");
      }
      return true;
    } catch (e) {
      stripOAuthParams();
      Alerts.toast(e.message || "Token exchange failed", "warn");
      return false;
    }
  },

  async connect() {
    try {
      await connectFyers();
      Alerts.toast("FYERS connected", "buy");
    } catch (e) {
      Alerts.toast(e.message, "warn");
    }
  },

  disconnect() {
    disconnectFyers();
    Alerts.toast("FYERS disconnected · DEMO MODE", "info");
  },

  async test() {
    try {
      const p = await testFyersConnection();
      Alerts.toast("Connection ok" + (p?.name || p?.display_name ? ` · ${p.name || p.display_name}` : ""), "buy");
      return p;
    } catch (e) {
      Alerts.toast(e.message, "warn");
      throw e;
    }
  },

  state: getFyersState,
  hasProxy: hasFyersProxy,
};
