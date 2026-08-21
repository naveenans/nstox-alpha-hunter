/**
 * Options finder — live FYERS chain when connected, otherwise a BS-priced demo chain.
 */
import { Storage, inr, fmtPct, fmtNum, mulberry32, hashStr, nowIST } from "./storage.js";
import { Market } from "./market.js";
import { getOptionChain, isFyersConnected } from "./fyers.js";

function strikeStep(underlying, spot) {
  if (underlying === "BANKNIFTY" || underlying === "SENSEX") return 100;
  if (underlying === "NIFTY" || underlying === "FINNIFTY") return 50;
  if (spot >= 5000) return 50;
  if (spot >= 1000) return 20;
  if (spot >= 200) return 5;
  return 2.5;
}

function expiryWeekday(underlying) {
  if (underlying === "BANKNIFTY") return 3;
  if (underlying === "FINNIFTY") return 2;
  return 4;
}

function nextExpiryDate(underlying) {
  const t = nowIST();
  const want = expiryWeekday(underlying);
  const dt = new Date(Date.UTC(t.year, t.month - 1, t.day));
  let add = (want - dt.getUTCDay() + 7) % 7;
  if (add === 0 && (t.wd !== want || t.h >= 15)) add = 7;
  dt.setUTCDate(dt.getUTCDate() + add);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cdf(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * z);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

function blackScholes(spot, strike, days, iv, type) {
  const t = Math.max(days, 0.35) / 365;
  const r = 0.065;
  const s = Math.max(iv, 0.08);
  const d1 = (Math.log(spot / strike) + (r + (s * s) / 2) * t) / (s * Math.sqrt(t));
  const d2 = d1 - s * Math.sqrt(t);
  if (type === "CE") {
    const px = spot * cdf(d1) - strike * Math.exp(-r * t) * cdf(d2);
    return { px: Math.max(0.05, px), delta: cdf(d1) };
  }
  const px = strike * Math.exp(-r * t) * cdf(-d2) - spot * cdf(-d1);
  return { px: Math.max(0.05, px), delta: cdf(d1) - 1 };
}

function daysTo(expiry) {
  const t = nowIST();
  const [y, m, d] = expiry.split("-").map(Number);
  const a = Date.UTC(t.year, t.month - 1, t.day);
  const b = Date.UTC(y, m - 1, d);
  return Math.max(0, Math.round((b - a) / 86400000));
}

function fyUnderlying(sym) {
  if (sym === "NIFTY") return "NSE:NIFTY50-INDEX";
  if (sym === "BANKNIFTY") return "NSE:NIFTYBANK-INDEX";
  if (sym === "FINNIFTY") return "NSE:FINNIFTY-INDEX";
  if (sym === "SENSEX") return "BSE:SENSEX-INDEX";
  return Market.fySymbol(sym);
}

function syntheticChain(underlying) {
  const u = Market.get(underlying) || Market.get("NIFTY");
  const spot = Number(u?.ltp) || (underlying === "BANKNIFTY" ? 52140 : underlying === "FINNIFTY" ? 23880 : 24785);
  const step = strikeStep(underlying, spot);
  const atm = Math.round(spot / step) * step;
  const expiry = nextExpiryDate(underlying);
  const dte = daysTo(expiry);
  const rand = mulberry32(hashStr(underlying + expiry + String(atm)));
  const baseIv = underlying.includes("BANK") ? 0.16 : underlying === "NIFTY" ? 0.12 : 0.22;
  const rows = [];
  for (let i = -8; i <= 8; i++) {
    const strike = atm + i * step;
    for (const type of ["CE", "PE"]) {
      const wing = Math.abs(i) * 0.008;
      const iv = baseIv + wing + (rand() - 0.5) * 0.01;
      const g = blackScholes(spot, strike, dte, iv, type);
      const ltp = Math.round(g.px * 20) / 20;
      const spreadAbs = Math.max(0.05, ltp * 0.004);
      const liquid = Math.exp(-Math.abs(i) * 0.35);
      rows.push({
        underlying,
        expiry,
        strike,
        type,
        ltp,
        chp: (rand() - 0.48) * 6,
        volume: Math.round((420000 * liquid + rand() * 40000) * (type === "CE" ? 1 : 0.95)),
        oi: Math.round((2.4e6 * liquid + rand() * 8e4) * (Math.abs(i) < 2 ? 1.25 : 1)),
        oiChg: Math.round((rand() - 0.4) * 160000 * liquid),
        iv: iv * 100,
        delta: g.delta,
        bid: Math.max(0.05, ltp - spreadAbs / 2),
        ask: ltp + spreadAbs / 2,
        spread: (spreadAbs / ltp) * 100,
        atmDist: Math.abs(i),
      });
    }
  }
  return { spot, atm, expiry, dte, rows, source: "DEMO DATA" };
}

function parseFyersChain(data, underlying) {
  const chain = data?.optionsChain || data?.optionChain || [];
  const expiries = data?.expiryData || [];
  const expiry = expiries[0]?.date || nextExpiryDate(underlying);
  let spot = Number(data?.spot || data?.underlyingValue || 0);
  const rows = [];
  for (const c of chain) {
    const strike = Number(c.strike_price ?? c.strike ?? 0);
    let type = String(c.option_type || c.optionType || "").toUpperCase();
    if (type === "CALL") type = "CE";
    if (type === "PUT") type = "PE";
    const sym = String(c.symbol || "");
    if (type !== "CE" && type !== "PE") {
      if (sym.endsWith("CE")) type = "CE";
      else if (sym.endsWith("PE")) type = "PE";
      else {
        if (c.ltp && !strike) spot = Number(c.ltp);
        continue;
      }
    }
    if (!strike) continue;
    const g = c.greeks || {};
    const ltp = Number(c.ltp ?? c.lp ?? 0);
    const bid = Number(c.bid ?? 0);
    const ask = Number(c.ask ?? 0);
    rows.push({
      underlying,
      expiry,
      strike,
      type,
      symbol: c.symbol,
      ltp,
      chp: Number(c.ltpchp ?? c.chp ?? 0),
      volume: Number(c.volume ?? c.vol ?? 0),
      oi: Number(c.oi ?? 0),
      oiChg: Number(c.oich ?? c.oi_change ?? 0),
      iv: Number(g.iv ?? c.iv ?? 0),
      delta: Number(g.delta ?? c.delta ?? 0),
      bid,
      ask,
      spread: ltp > 0 ? (Math.abs(ask - bid) / ltp) * 100 : 0,
    });
  }
  if (!spot) {
    const u = Market.get(underlying);
    spot = u?.ltp || 0;
  }
  const step = strikeStep(underlying, spot);
  const atm = Math.round(spot / step) * step;
  rows.forEach((r) => {
    r.atmDist = Math.round(Math.abs(r.strike - atm) / step);
  });
  return { spot, atm, expiry, dte: daysTo(String(expiry).replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1")), rows, expiries, source: "LIVE" };
}

function scoreOption(opt, under) {
  const s = Storage.getSettings().options;
  let pts = 0;
  const reasons = [];
  const preferred = (under?.dir === "SELL" && opt.type === "PE") || (under?.dir === "BUY" && opt.type === "CE") || under?.signal === (opt.type === "CE" ? "BUY" : "SELL");
  if (under?.score) {
    pts += Math.min(3, under.score * 0.3);
    reasons.push(`Underlying score ${under.score.toFixed(1)}`);
  }
  if (opt.volume >= s.minVolume) {
    pts += 1.2;
    reasons.push("Volume liquid");
  }
  if (opt.oi >= s.minOI) {
    pts += 1.1;
    reasons.push("OI liquid");
  }
  if (opt.oiChg > 0 && preferred) {
    pts += 0.8;
    reasons.push("OI building");
  }
  if (opt.spread <= s.maxSpreadPct) {
    pts += 1;
    reasons.push("Tight spread");
  } else pts -= 0.6;
  const d = Math.abs(opt.delta);
  if (Math.abs(d - s.preferredDelta) < 0.12) {
    pts += 1.2;
    reasons.push(`Delta ${opt.delta.toFixed(2)}`);
  }
  if (opt.atmDist <= s.atmDistance) {
    pts += 0.8;
    reasons.push("Near ATM");
  }
  if (under?.ta?.momentum && ((opt.type === "CE" && under.ta.momentum > 0) || (opt.type === "PE" && under.ta.momentum < 0))) {
    pts += 0.9;
    reasons.push("Underlying momentum agrees");
  }
  const score = Math.max(0, Math.min(10, pts));
  let signal = "NO TRADE";
  if (score >= 8 && preferred && under?.signal === (opt.type === "CE" ? "BUY" : "SELL")) {
    signal = opt.type === "CE" ? "BUY CE" : "BUY PE";
  }
  return { score, signal, reasons, preferred };
}

function pairChain(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.strike)) map.set(r.strike, { strike: r.strike, ce: null, pe: null });
    if (r.type === "CE") map.get(r.strike).ce = r;
    else map.get(r.strike).pe = r;
  }
  return [...map.values()].sort((a, b) => a.strike - b.strike);
}

export async function loadChain(underlying = "NIFTY") {
  const under = Market.get(underlying) || Market.get("NIFTY");
  let pack;
  if (isFyersConnected()) {
    try {
      const data = await getOptionChain({ symbol: fyUnderlying(underlying), strikecount: 16 });
      pack = parseFyersChain(data, underlying);
      if (!pack.rows.length) pack = { ...syntheticChain(underlying), source: "DEMO DATA · empty live chain" };
    } catch {
      pack = { ...syntheticChain(underlying), source: "DEMO DATA · live chain failed" };
    }
  } else {
    pack = syntheticChain(underlying);
  }
  const scored = pack.rows.map((r) => ({ ...r, ...scoreOption(r, under) }));
  scored.sort((a, b) => b.score - a.score);
  const callOi = pack.rows.filter((r) => r.type === "CE").reduce((a, b) => a + (b.oi || 0), 0);
  const putOi = pack.rows.filter((r) => r.type === "PE").reduce((a, b) => a + (b.oi || 0), 0);
  return { ...pack, rows: scored, under, pairs: pairChain(scored), pcr: callOi ? putOi / callOi : 0 };
}

export function renderOptions(root) {
  const underlyings = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX", "RELIANCE", "HDFCBANK", "TATAPV", "TATACV", "TCS"];
  root.innerHTML = `
    <div class="page-head">
      <div>
        <p class="kicker">Chain from underlying + OI / volume / spread</p>
        <h1>Options Finder</h1>
      </div>
      <label class="field compact">Underlying
        <select id="opt-u">${underlyings.map((u) => `<option>${u}</option>`).join("")}</select>
      </label>
    </div>
    <p class="footnote">Live FYERS chain is used when connected (Greeks on). Otherwise a Black-Scholes demo chain is shown and labelled. Never trade from premium alone.</p>
    ${Market.isFrozen() ? `<p class="warn-banner">Cash market is closed. Option prices are last-session / model values — they will not tick.</p>` : ""}
    <div id="opt-body" class="opt-body"></div>
  `;
  const body = root.querySelector("#opt-body");
  const sel = root.querySelector("#opt-u");

  async function paint() {
    body.innerHTML = `<div class="empty">Loading chain…</div>`;
    const pack = await loadChain(sel.value);
    const topCe = pack.rows.find((r) => r.type === "CE");
    const topPe = pack.rows.find((r) => r.type === "PE");
    const atm = pack.pairs.find((p) => p.strike === pack.atm) || pack.pairs[Math.floor(pack.pairs.length / 2)];
    body.innerHTML = `
      <div class="opt-hero">
        <div>
          <p class="muted">${pack.under?.symbol || sel.value} · Expiry ${pack.expiry} · ${pack.source}</p>
          <p class="big-price">${inr(pack.spot)}</p>
          <p>ATM ${pack.atm} · PCR ${pack.pcr.toFixed(2)} · DTE ${pack.dte ?? "—"}
            <span class="chip ${pack.under?.signal === "BUY" ? "buy" : pack.under?.signal === "SELL" ? "sell" : "flat"}">${pack.under?.signal || "NO TRADE"}</span>
          </p>
        </div>
        <div class="top-opt">
          <p class="kicker">Top CE</p>
          <h2>${topCe ? `${topCe.strike} CE` : "—"}</h2>
          <p>${topCe ? `LTP ${inr(topCe.ltp)} · OI ${fmtNum(topCe.oi, 0)} · ${topCe.score.toFixed(1)}/10` : ""}</p>
        </div>
        <div class="top-opt">
          <p class="kicker">Top PE</p>
          <h2>${topPe ? `${topPe.strike} PE` : "—"}</h2>
          <p>${topPe ? `LTP ${inr(topPe.ltp)} · OI ${fmtNum(topPe.oi, 0)} · ${topPe.score.toFixed(1)}/10` : ""}</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="scan-table">
          <thead>
            <tr>
              <th>CE LTP</th><th>CE Vol</th><th>CE OI</th><th>CE Δ</th><th>CE IV</th>
              <th>Strike</th>
              <th>PE LTP</th><th>PE Vol</th><th>PE OI</th><th>PE Δ</th><th>PE IV</th>
            </tr>
          </thead>
          <tbody>
            ${pack.pairs
              .map((p) => {
                const hi = p.strike === pack.atm ? "here" : "";
                const ce = p.ce;
                const pe = p.pe;
                return `<tr class="${hi}">
                  <td>${ce ? inr(ce.ltp) : "—"}</td>
                  <td>${ce ? fmtNum(ce.volume, 0) : "—"}</td>
                  <td>${ce ? fmtNum(ce.oi, 0) : "—"}</td>
                  <td>${ce ? ce.delta.toFixed(2) : "—"}</td>
                  <td>${ce ? ce.iv.toFixed(1) : "—"}</td>
                  <td><b class="gold">${p.strike}</b></td>
                  <td>${pe ? inr(pe.ltp) : "—"}</td>
                  <td>${pe ? fmtNum(pe.volume, 0) : "—"}</td>
                  <td>${pe ? fmtNum(pe.oi, 0) : "—"}</td>
                  <td>${pe ? pe.delta.toFixed(2) : "—"}</td>
                  <td>${pe ? pe.iv.toFixed(1) : "—"}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="muted">${atm ? `ATM ${atm.strike} · CE ${atm.ce ? inr(atm.ce.ltp) : "—"} · PE ${atm.pe ? inr(atm.pe.ltp) : "—"}` : ""}</p>
    `;
  }
  sel.addEventListener("change", paint);
  paint();
}

export const Options = { loadChain, render: renderOptions, scoreOption };
