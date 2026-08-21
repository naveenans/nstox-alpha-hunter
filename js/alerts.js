/**
 * Browser notifications + optional tone. Never places orders.
 */
import { Storage } from "./storage.js";

let audioCtx = null;
const seen = new Set();

function tone(freq = 660, dur = 0.12) {
  if (!Storage.getSettings().alerts.sound) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    o.type = "sine";
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {
    /* autoplay lock */
  }
}

async function notify(title, body) {
  const cfg = Storage.getSettings().alerts;
  if (!cfg.browser) return;
  try {
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission === "granted") new Notification(title, { body, silent: true });
  } catch {
    /* unsupported */
  }
}

function toast(text, kind = "info") {
  const host = document.getElementById("toast-root");
  if (!host) return;
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

export const Alerts = {
  async permission() {
    try {
      if (Notification.permission === "default") await Notification.requestPermission();
    } catch {
      /* ignore */
    }
  },
  ingest(rows) {
    const cfg = Storage.getSettings().alerts;
    const threshold = cfg.scoreAlert || 8;
    for (const r of rows) {
      const keyBuy = r.symbol + ":BUY:" + Math.floor(Date.now() / 120000);
      const keySell = r.symbol + ":SELL:" + Math.floor(Date.now() / 120000);
      if (cfg.onBuy && r.signal === "BUY" && r.score >= threshold && !seen.has(keyBuy)) {
        seen.add(keyBuy);
        const msg = `${r.symbol} BUY · ${r.score.toFixed(1)}/10 · R:R 1:${r.plan.rr.toFixed(1)}`;
        toast(msg, "buy");
        notify("NSTOX · High-confluence BUY", msg);
        tone(720);
        Storage.logAlert({ type: "BUY", symbol: r.symbol, score: r.score });
      }
      if (cfg.onSell && r.signal === "SELL" && r.score >= threshold && !seen.has(keySell)) {
        seen.add(keySell);
        const msg = `${r.symbol} SELL · ${r.score.toFixed(1)}/10 · R:R 1:${r.plan.rr.toFixed(1)}`;
        toast(msg, "sell");
        notify("NSTOX · High-confluence SELL", msg);
        tone(420);
        Storage.logAlert({ type: "SELL", symbol: r.symbol, score: r.score });
      }
      if (cfg.onBos && (r.ta.bos.bull || r.ta.bos.bear)) {
        const k = r.symbol + ":BOS:" + Math.floor(Date.now() / 180000);
        if (!seen.has(k)) {
          seen.add(k);
          toast(`${r.symbol} BOS · price-structure proxy`, "info");
        }
      }
      if (cfg.onBreakout && r.ta.breakout.yes) {
        const k = r.symbol + ":BRK:" + Math.floor(Date.now() / 180000);
        if (!seen.has(k)) {
          seen.add(k);
          toast(`${r.symbol} breakout ${r.ta.breakout.label || ""}`.trim(), "info");
        }
      }
      if (cfg.onRvol && r.ta.rvol >= 3) {
        const k = r.symbol + ":RVOL:" + Math.floor(Date.now() / 180000);
        if (!seen.has(k)) {
          seen.add(k);
          toast(`${r.symbol} RVOL ${r.ta.rvol.toFixed(1)}x`, "info");
        }
      }
      if (cfg.onSweep && (r.ta.sweep.high || r.ta.sweep.low)) {
        const k = r.symbol + ":SWP:" + Math.floor(Date.now() / 180000);
        if (!seen.has(k)) {
          seen.add(k);
          toast(`${r.symbol} liquidity sweep (proxy)`, "info");
        }
      }
    }
    if (seen.size > 400) seen.clear();
  },
  toast,
};
