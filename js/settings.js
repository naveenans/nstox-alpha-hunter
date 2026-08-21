/**
 * Settings page — FYERS OAuth, scanner, technicals, structure, options, alerts, UI.
 */
import { Storage, DEFAULT_SETTINGS } from "./storage.js";
import { Auth } from "./auth.js";
import { isFyersConnected, defaultRedirectUri, hasFyersProxy } from "./fyers.js";
import { Alerts } from "./alerts.js";

function esc(v) {
  const amp = "\u0026";
  return String(v ?? "")
    .replace(/&/g, amp + "amp;")
    .replace(/"/g, amp + "quot;")
    .replace(/</g, amp + "lt;");
}

function field(label, name, value, type = "text", extra = "") {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}/></label>`;
}

export async function renderSettings(root) {
  const s = Storage.getSettings();
  const fy = s.fyers;
  const live = isFyersConnected();
  const redirect = fy.redirectUri || defaultRedirectUri();
  const proxy = await hasFyersProxy();
  root.innerHTML = `
    <div class="page-head">
      <div>
        <p class="kicker">Device-local configuration</p>
        <h1>Settings</h1>
      </div>
    </div>
    <p class="warn-banner">Enter App ID and Secret ID from the FYERS API dashboard. Copy the Redirect URI into your FYERS app (exact match). Login with FYERS fetches the access token automatically. Secret ID stays on this device — do not use a shared computer.</p>

    <section class="card">
      <header class="card-h">FYERS API connection</header>
      <ol class="prose oauth-steps">
        <li>Create an app at <a href="https://myapi.fyers.in/dashboard/" target="_blank" rel="noopener">myapi.fyers.in</a></li>
        <li>Paste the Redirect URI below into that app and save</li>
        <li>Enter App ID and Secret ID here</li>
        <li>Click <b>Login with FYERS</b> — access token is fetched automatically</li>
      </ol>
      <form id="fyers-form" class="form-grid" autocomplete="off">
        ${field("App ID", "appId", fy.appId, "text", 'autocomplete="off" required')}
        ${field("Secret ID", "secretId", fy.secretId, "password", 'autocomplete="new-password" required')}
        <label class="field span-2"><span>Redirect URI · register this exact URL on FYERS</span>
          <span class="add-row">
            <input name="redirectUri" type="url" value="${esc(redirect)}"/>
            <button type="button" class="btn sm" id="copy-redir">Copy</button>
          </span>
        </label>
        ${field("FYERS PIN (optional, for auto-refresh)", "pin", fy.pin, "password", 'autocomplete="off" inputmode="numeric"')}
        ${field("Access Token (auto-filled after login)", "accessToken", fy.accessToken, "password", 'autocomplete="off"')}
        <label class="field"><span>Environment</span>
          <select name="environment">
            <option value="live" ${fy.environment === "live" ? "selected" : ""}>Live</option>
            <option value="sandbox" ${fy.environment === "sandbox" ? "selected" : ""}>Sandbox</option>
          </select>
        </label>
        <div class="form-actions">
          <button type="button" class="btn gold" id="fy-login">Login with FYERS</button>
          <button type="button" class="btn" id="fy-connect">Connect</button>
          <button type="button" class="btn ghost" id="fy-test">Test connection</button>
          <button type="button" class="btn ghost" id="fy-refresh">Refresh data</button>
          <button type="button" class="btn danger" id="fy-disc">Disconnect</button>
          <button type="submit" class="btn ghost">Save</button>
        </div>
      </form>
      <p class="status-line">FYERS status · <b class="${live ? "pos" : "neg"}">${live ? "CONNECTED" : "DISCONNECTED"}</b> · ${live ? "LIVE MODE" : "DEMO MODE"} · ${proxy ? "OAuth proxy ready" : "No OAuth proxy — login may fail on a static host"}</p>
    </section>

    <section class="card">
      <header class="card-h">Scanner</header>
      <div class="form-grid" id="scan-set">
        ${field("Minimum score", "minScore", s.scanner.minScore, "number", 'step="0.1" min="0" max="10"')}
        ${field("Minimum R:R", "minRR", s.scanner.minRR, "number", 'step="0.1"')}
        ${field("Minimum RVOL", "minRvol", s.scanner.minRvol, "number", 'step="0.1"')}
        <label class="field"><span>Universe</span>
          <select name="universe">
            <option>NIFTY50</option><option>FNO</option><option>WATCHLIST</option>
          </select>
        </label>
        <p class="hint">Scanner scores last-session bars at all hours. Prices stay frozen when cash is closed. Use Refresh on the scanner page to re-run.</p>
      </div>
    </section>

    <section class="card">
      <header class="card-h">Technical</header>
      <div class="form-grid" id="tech-set">
        ${field("RSI period", "rsiPeriod", s.technical.rsiPeriod, "number")}
        ${field("EMA 9", "ema9", s.technical.ema9, "number")}
        ${field("EMA 20", "ema20", s.technical.ema20, "number")}
        ${field("EMA 50", "ema50", s.technical.ema50, "number")}
        ${field("EMA 100", "ema100", s.technical.ema100, "number")}
        ${field("EMA 200", "ema200", s.technical.ema200, "number")}
        ${field("ATR period", "atrPeriod", s.technical.atrPeriod, "number")}
        ${field("ATR multiplier", "atrMult", s.technical.atrMult, "number", 'step="0.1"')}
      </div>
    </section>

    <section class="card">
      <header class="card-h">Market structure · price/volume proxies</header>
      <div class="form-grid" id="st-set">
        ${field("Swing sensitivity", "swingSensitivity", s.structure.swingSensitivity, "number")}
        ${field("BOS threshold %", "bosThreshold", s.structure.bosThreshold, "number", 'step="0.01"')}
        ${field("Retest tolerance %", "retestTolerance", s.structure.retestTolerance, "number", 'step="0.01"')}
        ${field("Breakout threshold %", "breakoutThreshold", s.structure.breakoutThreshold, "number", 'step="0.01"')}
      </div>
    </section>

    <section class="card">
      <header class="card-h">Score weights (total 10)</header>
      <div class="form-grid" id="w-set">
        ${Object.entries(s.weights)
          .map(([k, v]) => field(k, k, v, "number", 'step="0.05" min="0" max="1.5"'))
          .join("")}
      </div>
    </section>

    <section class="card">
      <header class="card-h">Options</header>
      <div class="form-grid" id="opt-set">
        ${field("Min volume", "minVolume", s.options.minVolume, "number")}
        ${field("Min OI", "minOI", s.options.minOI, "number")}
        ${field("Max spread %", "maxSpreadPct", s.options.maxSpreadPct, "number", 'step="0.1"')}
        ${field("Preferred delta", "preferredDelta", s.options.preferredDelta, "number", 'step="0.05"')}
        ${field("ATM distance (strikes)", "atmDistance", s.options.atmDistance, "number")}
      </div>
    </section>

    <section class="card">
      <header class="card-h">Alerts · no order routing</header>
      <div class="form-grid" id="al-set">
        <label class="chk"><input type="checkbox" name="browser" ${s.alerts.browser ? "checked" : ""}/> Browser notifications</label>
        <label class="chk"><input type="checkbox" name="sound" ${s.alerts.sound ? "checked" : ""}/> Sound</label>
        ${field("Score alert", "scoreAlert", s.alerts.scoreAlert, "number")}
      </div>
    </section>

    <section class="card">
      <header class="card-h">UI</header>
      <div class="form-grid">
        <label class="chk"><input type="checkbox" id="ui-compact" ${s.ui.compact ? "checked" : ""}/> Compact mode</label>
        <label class="chk"><input type="checkbox" id="ui-anim" ${s.ui.animations ? "checked" : ""}/> Animations</label>
      </div>
    </section>

    <section class="card">
      <header class="card-h">Backup</header>
      <div class="form-actions">
        <button class="btn" id="exp">Export settings</button>
        <label class="btn ghost">Import settings<input type="file" id="imp" accept="application/json" hidden/></label>
        <button class="btn ghost" id="clr">Clear tokens</button>
        <button class="btn danger" id="rst">Reset all</button>
      </div>
    </section>
  `;

  root.querySelector("#scan-set select[name=universe]").value = s.scanner.universe;

  const bindGroup = (id, path) => {
    root.querySelector(`#${id}`)?.addEventListener("change", (e) => {
      const t = e.target;
      if (!t.name) return;
      const val = t.type === "checkbox" ? t.checked : t.type === "number" ? Number(t.value) : t.value;
      Storage.patchSettings({ [path]: { [t.name]: val } });
    });
  };
  bindGroup("scan-set", "scanner");
  bindGroup("tech-set", "technical");
  bindGroup("st-set", "structure");
  bindGroup("w-set", "weights");
  bindGroup("opt-set", "options");
  bindGroup("al-set", "alerts");

  root.querySelector("#ui-compact").onchange = (e) => {
    Storage.patchSettings({ ui: { compact: e.target.checked } });
    document.body.classList.toggle("compact", e.target.checked);
  };
  root.querySelector("#ui-anim").onchange = (e) => {
    Storage.patchSettings({ ui: { animations: e.target.checked } });
    document.body.classList.toggle("no-anim", !e.target.checked);
  };

  const form = root.querySelector("#fyers-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    Auth.saveFromForm(form);
    Alerts.toast("Saved on this device only", "info");
  });
  root.querySelector("#copy-redir").onclick = async () => {
    const v = form.redirectUri.value.trim() || defaultRedirectUri();
    form.redirectUri.value = v;
    try {
      await navigator.clipboard.writeText(v);
      Alerts.toast("Redirect URI copied", "buy");
    } catch {
      form.redirectUri.select();
      Alerts.toast("Copy the Redirect URI from the field", "info");
    }
  };
  root.querySelector("#fy-login").onclick = () => {
    Auth.saveFromForm(form);
    Auth.loginWithFyers();
  };
  root.querySelector("#fy-connect").onclick = () => {
    Auth.saveFromForm(form);
    Auth.connect();
  };
  root.querySelector("#fy-test").onclick = () => {
    Auth.saveFromForm(form);
    Auth.test();
  };
  root.querySelector("#fy-disc").onclick = () => Auth.disconnect();
  root.querySelector("#fy-refresh").onclick = () => {
    window.dispatchEvent(new CustomEvent("nstox:refresh"));
    Alerts.toast("Refresh requested", "info");
  };

  root.querySelector("#exp").onclick = () => {
    const blob = new Blob([JSON.stringify(Storage.exportAll(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nstox-settings.json";
    a.click();
  };
  root.querySelector("#imp").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      Storage.importAll(JSON.parse(await f.text()));
      Alerts.toast("Imported", "buy");
      renderSettings(root);
    } catch {
      Alerts.toast("Invalid file", "warn");
    }
  };
  root.querySelector("#clr").onclick = () => {
    Storage.clearToken();
    Alerts.toast("Token cleared", "info");
    renderSettings(root);
  };
  root.querySelector("#rst").onclick = () => {
    if (confirm("Reset all settings and watchlists?")) {
      Storage.resetAll();
      renderSettings(root);
    }
  };
}

export const Settings = { render: renderSettings, defaults: DEFAULT_SETTINGS };
