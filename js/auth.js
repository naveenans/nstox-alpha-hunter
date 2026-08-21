/**
 * Browser-safe FYERS auth helpers.
 * App secret is never stored. Token exchange is not performed here.
 */
import { Storage } from "./storage.js";
import { fyersAuthUrl, connectFyers, disconnectFyers, testFyersConnection, getFyersState } from "./fyers.js";
import { Alerts } from "./alerts.js";

export function captureRedirectToken() {
  const q = new URLSearchParams(location.search);
  const authCode = q.get("auth_code") || q.get("code");
  if (!authCode) return null;
  return authCode;
}

export const Auth = {
  captureRedirectToken,
  loginWithFyers() {
    const url = fyersAuthUrl();
    if (!url) {
      Alerts.toast("Add App ID and Redirect URI first", "warn");
      return;
    }
    const code = captureRedirectToken();
    if (code) {
      Alerts.toast(
        "OAuth token exchange requires a secure backend. Use the manually supplied access-token mode for this static HTML version.",
        "warn",
      );
      return;
    }
    window.open(url, "_blank", "noopener");
    Alerts.toast("Complete login at FYERS, then paste the access token here.", "info");
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
      Alerts.toast("Connection ok" + (p?.name ? ` · ${p.name}` : ""), "buy");
      return p;
    } catch (e) {
      Alerts.toast(e.message, "warn");
      throw e;
    }
  },
  state: getFyersState,
  saveFromForm(form) {
    const fyers = {
      ...Storage.getFyers(),
      appId: form.appId.value.trim(),
      redirectUri: form.redirectUri.value.trim(),
      accessToken: form.accessToken.value.trim(),
      clientId: form.clientId.value.trim(),
      environment: form.environment.value,
    };
    Storage.setFyers(fyers);
    Alerts.toast("Saved on this device only", "info");
  },
};
