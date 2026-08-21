/**
 * Support / resistance, pivots, ATR stops, target engine, intraday levels page.
 */
import { Storage, inr } from "./storage.js";

export function classicPivots(prevHigh, prevLow, prevClose) {
  const p = (prevHigh + prevLow + prevClose) / 3;
  const r1 = 2 * p - prevLow;
  const s1 = 2 * p - prevHigh;
  const r2 = p + (prevHigh - prevLow);
  const s2 = p - (prevHigh - prevLow);
  const r3 = prevHigh + 2 * (p - prevLow);
  const s3 = prevLow - 2 * (prevHigh - p);
  return { p, r1, r2, r3, s1, s2, s3 };
}

export function buildPlan(ta, dir) {
  const settings = Storage.getSettings();
  const atrMult = settings.technical.atrMult || 1.2;
  const minRR = settings.scanner.minRR || 2;
  const price = ta.price;
  const atr = ta.atr || price * 0.01;
  const piv = classicPivots(ta.levels.pdh, ta.levels.pdl, ta.levels.pdc);
  const side = dir === "SELL" ? "SELL" : "BUY";

  let entry, sl, t1, t2, t3;
  if (side === "BUY") {
    entry = price;
    sl = entry - atr * atrMult;
    const r = entry - sl;
    t1 = entry + r * minRR;
    t2 = entry + r * (minRR + 1);
    t3 = entry + r * (minRR + 2);
    if (piv.r1 > t1 && piv.r1 < t2 * 1.15) t1 = Math.min(t1, piv.r1 - atr * 0.15);
    if (ta.levels.pdh > entry) t2 = Math.max(t2, ta.levels.pdh);
  } else {
    entry = price;
    sl = entry + atr * atrMult;
    const r = sl - entry;
    t1 = entry - r * minRR;
    t2 = entry - r * (minRR + 1);
    t3 = entry - r * (minRR + 2);
    if (piv.s1 < t1 && piv.s1 > t2 * 0.85) t1 = Math.max(t1, piv.s1 + atr * 0.15);
    if (ta.levels.pdl < entry) t2 = Math.min(t2, ta.levels.pdl);
  }

  const risk = Math.abs(entry - sl);
  const reward = Math.abs(t1 - entry);
  const rr = risk ? reward / risk : 0;
  const buyAbove = side === "BUY" ? entry : ta.levels.orh || piv.r1;
  const sellBelow = side === "SELL" ? entry : ta.levels.orl || piv.s1;

  return {
    side,
    entry,
    sl,
    t1,
    t2,
    t3,
    rr,
    atr,
    atrMult,
    buyAbove,
    sellBelow,
    piv,
    vwap: ta.vwap,
  };
}

export function nearestLevels(price, plan) {
  const rows = [
    { k: "R3", v: plan.piv.r3, kind: "res" },
    { k: "R2", v: plan.piv.r2, kind: "res" },
    { k: "R1", v: plan.piv.r1, kind: "res" },
    { k: "PDH", v: plan.pdh, kind: "res" },
    { k: "VWAP", v: plan.vwap, kind: "mid" },
    { k: "PIVOT", v: plan.piv.p, kind: "mid" },
    { k: "S1", v: plan.piv.s1, kind: "sup" },
    { k: "S2", v: plan.piv.s2, kind: "sup" },
    { k: "S3", v: plan.piv.s3, kind: "sup" },
    { k: "PDL", v: plan.pdl, kind: "sup" },
  ].filter((r) => typeof r.v === "number" && !Number.isNaN(r.v));
  rows.sort((a, b) => b.v - a.v);
  return rows;
}

export function renderLevelsPage(root, Market) {
  const rows = Market.getUniverse("FNO");
  const selected = Market.getSelected() || rows[0];
  if (!selected) {
    root.innerHTML = `<div class="empty">NO DATA</div>`;
    return;
  }
  const ta = selected.ta;
  const plan = selected.plan;
  const ladder = nearestLevels(selected.ltp, { ...plan, pdh: ta.levels.pdh, pdl: ta.levels.pdl });

  root.innerHTML = `
    <div class="page-head">
      <div>
        <p class="kicker">Intraday level finder</p>
        <h1>Levels</h1>
      </div>
      <label class="field compact">
        <span>Symbol</span>
        <select id="lvl-sym">${rows
          .map((r) => `<option value="${r.symbol}" ${r.symbol === selected.symbol ? "selected" : ""}>${r.symbol}</option>`)
          .join("")}</select>
      </label>
    </div>
    <div class="levels-hero">
      <div>
        <p class="muted">Current price</p>
        <p class="big-price">${inr(selected.ltp)}</p>
        <p class="chip ${selected.signal === "BUY" ? "buy" : selected.signal === "SELL" ? "sell" : "flat"}">${selected.signal}</p>
      </div>
      <div class="lvl-actions">
        <div><span>Buy above</span><b>${inr(plan.buyAbove)}</b></div>
        <div><span>Sell below</span><b>${inr(plan.sellBelow)}</b></div>
        <div><span>VWAP</span><b>${inr(ta.vwap)}</b></div>
        <div><span>ATR</span><b>${inr(ta.atr, 2)}</b></div>
      </div>
    </div>
    <div class="grid-2">
      <section class="card">
        <header class="card-h">Ladder</header>
        <div class="ladder">
          ${ladder
            .map((r) => {
              const here = Math.abs(r.v - selected.ltp) / selected.ltp < 0.0015;
              return `<div class="ladder-row ${r.kind} ${here ? "here" : ""}">
                <span>${r.k}</span>
                <b>${inr(r.v)}</b>
                ${here ? "<em>CURRENT</em>" : ""}
              </div>`;
            })
            .join("")}
        </div>
      </section>
      <section class="card">
        <header class="card-h">Plan · ATR stop · min 1:${Storage.getSettings().scanner.minRR}</header>
        <div class="plan-grid">
          <div><span>Entry</span><b>${inr(plan.entry)}</b></div>
          <div><span>Stop loss</span><b class="neg">${inr(plan.sl)}</b></div>
          <div><span>Target 1</span><b class="pos">${inr(plan.t1)}</b></div>
          <div><span>Target 2</span><b class="pos">${inr(plan.t2)}</b></div>
          <div><span>Target 3</span><b class="pos">${inr(plan.t3)}</b></div>
          <div><span>Risk / Reward</span><b class="gold">1:${plan.rr.toFixed(1)}</b></div>
        </div>
        <p class="footnote">SL = Entry ${plan.side === "BUY" ? "−" : "+"} ATR × ${plan.atrMult}. Targets from ATR, S/R and previous day extremes. Not a guaranteed path.</p>
      </section>
    </div>
  `;
  root.querySelector("#lvl-sym")?.addEventListener("change", (e) => {
    Market.select(e.target.value);
    renderLevelsPage(root, Market);
  });
}

export const Levels = { classicPivots, buildPlan, nearestLevels, renderLevelsPage };
