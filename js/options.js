/**
 * Options finder — liquid CE/PE from underlying technicals, not option tape alone.
 */
import { Storage, inr, fmtPct, fmtNum, mulberry32, hashStr } from "./storage.js";
import { Market } from "./market.js";
import { getOptionChain, isFyersConnected } from "./fyers.js";

function nextThursday(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay();
  const add = (4 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d;
}

function syntheticChain(underlying) {
  const u = Market.get(underlying) || Market.get("NIFTY");
  const spot = u?.ltp || 24780;
  const step = underlying.includes("BANK") ? 100 : underlying === "NIFTY" || underlying === "FINNIFTY" ? 50 : 20;
  const atm = Math.round(spot / step) * step;
  const rand = mulberry32(hashStr(underlying + String(atm)));
  const expiry = nextThursday();
  const expStr = expiry.toISOString().slice(0, 10);
  const dir = u?.dir === "SELL" ? "PE" : "CE";
  const rows = [];
  for (let i = -6; i <= 6; i++) {
    const strike = atm + i * step;
    for (const type of ["CE", "PE"]) {
      const otm = type === "CE" ? strike - spot : spot - strike;
      const moneyness = -otm / spot;
      const delta = type === "CE" ? Math.max(0.05, Math.min(0.95, 0.5 + moneyness * 8)) : -Math.max(0.05, Math.min(0.95, 0.5 + moneyness * 8));
      const iv = 12 + Math.abs(i) * 0.7 + rand() * 2;
      const ltp = Math.max(2, (Math.abs(delta) * (u?.ta.atr || spot * 0.01) * 14 + rand() * 12));
      const vol = Math.round((180000 - Math.abs(i) * 18000) * (0.7 + rand()));
      const oi = Math.round((1.2e6 - Math.abs(i) * 9e4) * (0.8 + rand()));
      const oiChg = Math.round((rand() - 0.42) * 180000);
      const bid = ltp - (0.05 + rand() * 0.8);
      const ask = ltp + (0.05 + rand() * 0.8);
      const spread = ((ask - bid) / ltp) * 100;
      const chp = (rand() - 0.45) * 8;
      rows.push({
        underlying,
        expiry: expStr,
        strike,
        type,
        ltp,
        chp,
        volume: vol,
        oi,
        oiChg,
        iv,
        delta,
        bid,
        ask,
        spread,
        atm: Math.abs(i),
        preferred: type === dir,
      });
    }
  }
  return { spot, atm, expiry: expStr, rows, source: "DEMO DATA" };
}

function scoreOption(opt, under) {
  const s = Storage.getSettings().options;
  let pts = 0;
  const reasons = [];
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
  if (opt.oiChg > 0 && opt.preferred) {
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
  if (opt.atm <= s.atmDistance) {
    pts += 0.8;
    reasons.push("Near ATM");
  }
  if (under?.ta?.momentum && ((opt.type === "CE" && under.ta.momentum > 0) || (opt.type === "PE" && under.ta.momentum < 0))) {
    pts += 0.9;
    reasons.push("Underlying momentum agrees");
  }
  const score = Math.max(0, Math.min(10, pts));
  let signal = "NO TRADE";
  if (score >= 8 && opt.preferred && under?.signal === (opt.type === "CE" ? "BUY" : "SELL")) signal = opt.type === "CE" ? "BUY CE" : "BUY PE";
  return { score, signal, reasons };
}

export async function loadChain(underlying = "NIFTY") {
  const under = Market.get(underlying) || Market.get("NIFTY");
  let pack;
  if (isFyersConnected()) {
    try {
      const fy = underlying === "NIFTY" ? "NSE:NIFTY50-INDEX" : Market.fySymbol(underlying);
      const data = await getOptionChain({ symbol: fy, strikecount: 10 });
      pack = { spot: under?.ltp, rows: [], expiry: "", source: "LIVE", raw: data };
    } catch {
      pack = syntheticChain(underlying);
    }
  } else {
    pack = syntheticChain(underlying);
  }
  const scored = pack.rows.map((r) => {
    const sc = scoreOption(r, under);
    return { ...r, ...sc };
  });
  scored.sort((a, b) => b.score - a.score);
  return { ...pack, rows: scored, under };
}

export function renderOptions(root) {
  const underlyings = ["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE", "HDFCBANK", "TCS"];
  root.innerHTML = `
    <div class="page-head">
      <div>
        <p class="kicker">Never from option premium alone</p>
        <h1>Options Finder</h1>
      </div>
      <label class="field compact">Underlying
        <select id="opt-u">${underlyings.map((u) => `<option>${u}</option>`).join("")}</select>
      </label>
    </div>
    <p class="footnote">Contracts scored from underlying technicals, volume, OI, OI change, spread, delta, IV and ATM distance.</p>
    <div id="opt-body" class="opt-body"></div>
  `;
  const body = root.querySelector("#opt-body");
  const sel = root.querySelector("#opt-u");

  async function paint() {
    body.innerHTML = `<div class="empty">Loading chain…</div>`;
    const pack = await loadChain(sel.value);
    const top = pack.rows[0];
    const list = pack.rows.filter((r) => r.preferred).slice(0, 16);
    body.innerHTML = `
      <div class="opt-hero">
        <div>
          <p class="muted">${pack.under?.symbol || sel.value} · Expiry ${pack.expiry} · ${pack.source}</p>
          <p class="big-price">${inr(pack.spot)}</p>
          <p>Underlying signal <span class="chip ${pack.under?.signal === "BUY" ? "buy" : pack.under?.signal === "SELL" ? "sell" : "flat"}">${pack.under?.signal || "NO TRADE"}</span></p>
        </div>
        ${
          top
            ? `<div class="top-opt">
          <p class="kicker">Top contract</p>
          <h2>${top.strike} ${top.type}</h2>
          <p>LTP ${inr(top.ltp)} · OI ${fmtNum(top.oi, 0)} · Vol ${fmtNum(top.volume, 0)}</p>
          <p class="gold">${top.score.toFixed(1)} / 10 · ${top.signal}</p>
        </div>`
            : ""
        }
      </div>
      <div class="table-wrap desktop-only">
        <table class="scan-table">
          <thead>
            <tr>
              <th>Strike</th><th>CE/PE</th><th>LTP</th><th>Chg%</th><th>Vol</th><th>OI</th>
              <th>OI Chg</th><th>IV</th><th>Delta</th><th>Bid</th><th>Ask</th><th>Spread</th><th>Score</th><th>Signal</th>
            </tr>
          </thead>
          <tbody>
            ${list
              .map(
                (r) => `<tr>
              <td>${r.strike}</td><td>${r.type}</td><td>${inr(r.ltp)}</td>
              <td class="${r.chp >= 0 ? "pos" : "neg"}">${fmtPct(r.chp)}</td>
              <td>${fmtNum(r.volume, 0)}</td><td>${fmtNum(r.oi, 0)}</td>
              <td class="${r.oiChg >= 0 ? "pos" : "neg"}">${fmtNum(r.oiChg, 0)}</td>
              <td>${r.iv.toFixed(1)}</td><td>${r.delta.toFixed(2)}</td>
              <td>${inr(r.bid)}</td><td>${inr(r.ask)}</td>
              <td>${r.spread.toFixed(2)}%</td>
              <td class="gold">${r.score.toFixed(1)}</td>
              <td><span class="chip ${r.signal.includes("BUY") ? "buy" : "flat"}">${r.signal}</span></td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="scan-cards mobile-only">
        ${list
          .slice(0, 8)
          .map(
            (r) => `<article class="scan-card">
            <header><h3>${r.strike} ${r.type}</h3><span class="chip ${r.signal.includes("BUY") ? "buy" : "flat"}">${r.signal}</span></header>
            <div class="scan-card-grid">
              <div><span>Score</span><b class="gold">${r.score.toFixed(1)}</b></div>
              <div><span>LTP</span><b>${inr(r.ltp)}</b></div>
              <div><span>OI</span><b>${fmtNum(r.oi, 0)}</b></div>
              <div><span>Vol</span><b>${fmtNum(r.volume, 0)}</b></div>
            </div>
          </article>`,
          )
          .join("")}
      </div>
    `;
  }
  sel.addEventListener("change", paint);
  paint();
}

export const Options = { loadChain, render: renderOptions, scoreOption };
