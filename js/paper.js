/**
 * Paper trading — virtual book, named strategies, last-session replay.
 * Never places real orders.
 */
import { Storage, inr } from "./storage.js";
import { Market } from "./market.js";
import { Alerts } from "./alerts.js";

export const STRATEGIES = [
  {
    id: "hunter",
    name: "Hunter Confluence",
    tag: "Core",
    when: "Score ≥ 8 with BUY or SELL and R:R ≥ 1:2",
    entry: "Plan entry at LTP",
    sl: "ATR × multiplier stop",
    target: "T1 at min 1:2",
    match(row) {
      if (row.signal === "BUY") return { ok: true, side: "BUY", why: row.signalWhy || "Bullish confluence" };
      if (row.signal === "SELL") return { ok: true, side: "SELL", why: row.signalWhy || "Bearish confluence" };
      return { ok: false };
    },
  },
  {
    id: "vwap",
    name: "VWAP Magnet",
    tag: "Mean",
    when: "Price on the right side of VWAP with RVOL ≥ 1.3",
    entry: "Reclaim / reject of session VWAP",
    sl: "Other side of VWAP + ATR buffer",
    target: "Session extreme / T1",
    match(row) {
      const ta = row.ta;
      if (ta.aboveVwap && ta.rvol >= 1.3 && ta.rsi >= 48 && ta.rsi <= 70 && ta.align.bias !== "BEAR")
        return { ok: true, side: "BUY", why: "Above VWAP · RVOL " + ta.rvol.toFixed(1) + "x" };
      if (!ta.aboveVwap && ta.rvol >= 1.3 && ta.rsi <= 52 && ta.rsi >= 30 && ta.align.bias !== "BULL")
        return { ok: true, side: "SELL", why: "Below VWAP · RVOL " + ta.rvol.toFixed(1) + "x" };
      return { ok: false };
    },
  },
  {
    id: "bos",
    name: "BOS + Retest",
    tag: "Structure",
    when: "Break of structure then a clean retest",
    entry: "Retest of broken level",
    sl: "Beyond the swing that broke",
    target: "Measured move / T1",
    match(row) {
      if (row.ta.bos.bull && row.ta.retest.yes) return { ok: true, side: "BUY", why: "Bullish BOS + retest" };
      if (row.ta.bos.bear && row.ta.retest.yes) return { ok: true, side: "SELL", why: "Bearish BOS + retest" };
      return { ok: false };
    },
  },
  {
    id: "breakout",
    name: "RVOL Breakout",
    tag: "Momentum",
    when: "Confirmed breakout with RVOL ≥ 2x",
    entry: "Break of PDH / range high",
    sl: "Back inside the range",
    target: "ATR extension",
    match(row) {
      if (!row.ta.breakout.yes || row.ta.rvol < 2) return { ok: false };
      const side = row.ta.align.bias === "BEAR" || (!row.ta.aboveVwap && row.ta.momentum < 0) ? "SELL" : "BUY";
      return { ok: true, side, why: (row.ta.breakout.label || "Breakout") + " · RVOL " + row.ta.rvol.toFixed(1) + "x" };
    },
  },
  {
    id: "ema",
    name: "EMA Pullback",
    tag: "Trend",
    when: "Trend stack holds; price tags EMA20 in the trend",
    entry: "EMA20 bounce with EMA20 > EMA50 (buy) or < (sell)",
    sl: "Beyond EMA50",
    target: "Prior swing",
    match(row) {
      const { ema20, ema50, rsi, price } = row.ta;
      if (!ema20 || !ema50) return { ok: false };
      const near20 = Math.abs(price - ema20) / price < 0.008;
      if (ema20 > ema50 && near20 && rsi >= 42 && rsi <= 62 && price > ema50)
        return { ok: true, side: "BUY", why: "Pullback to rising EMA20" };
      if (ema20 < ema50 && near20 && rsi <= 58 && rsi >= 38 && price < ema50)
        return { ok: true, side: "SELL", why: "Pullback to falling EMA20" };
      return { ok: false };
    },
  },
  {
    id: "orb",
    name: "Opening Range Break",
    tag: "ORB",
    when: "Price leaves the 09:15–09:30 range with volume",
    entry: "Break of ORH / ORL",
    sl: "Opposite side of the opening range",
    target: "1:2 from range width",
    match(row) {
      const orh = row.ta.levels?.orh;
      const orl = row.ta.levels?.orl;
      if (!orh || !orl || orh <= orl) return { ok: false };
      if (row.ta.rvol < 1.2) return { ok: false };
      if (row.ltp > orh) return { ok: true, side: "BUY", why: "Break above ORH " + inr(orh) };
      if (row.ltp < orl) return { ok: true, side: "SELL", why: "Break below ORL " + inr(orl) };
      return { ok: false };
    },
  },
  {
    id: "sweep",
    name: "Liquidity Sweep",
    tag: "Reversal",
    when: "Stops taken beyond equal highs/lows, then reclaim",
    entry: "Reclaim after the sweep",
    sl: "Beyond the sweep wick",
    target: "Opposite liquidity",
    match(row) {
      if (row.ta.sweep?.low && row.ta.aboveVwap) return { ok: true, side: "BUY", why: "Low sweep then reclaim" };
      if (row.ta.sweep?.high && !row.ta.aboveVwap) return { ok: true, side: "SELL", why: "High sweep then reject" };
      return { ok: false };
    },
  },
  {
    id: "rsi",
    name: "RSI Extreme",
    tag: "Revert",
    when: "RSI ≤ 32 (buy) or ≥ 68 (sell) in a non-runaway tape",
    entry: "Fade the extreme candle close",
    sl: "1.2 × ATR beyond the extreme",
    target: "Mid-range / VWAP",
    match(row) {
      if (row.ta.rsi <= 32 && row.ta.rvol < 3) return { ok: true, side: "BUY", why: "RSI " + row.ta.rsi.toFixed(0) + " oversold" };
      if (row.ta.rsi >= 68 && row.ta.rvol < 3) return { ok: true, side: "SELL", why: "RSI " + row.ta.rsi.toFixed(0) + " overbought" };
      return { ok: false };
    },
  },
];

function emit() {
  window.dispatchEvent(new CustomEvent("nstox:paper", { detail: book() }));
}

export function book() {
  return Storage.getPaper();
}

function save(next) {
  Storage.setPaper(next);
  emit();
}

function qtyFor(entry, sl, cash, riskPct) {
  const risk = cash * (riskPct / 100);
  const dist = Math.abs(entry - sl);
  if (!dist || dist < 0.05) return 0;
  return Math.max(1, Math.floor(risk / dist));
}

function mtm(t, ltp) {
  const px = ltp ?? t.ltp ?? t.entry;
  return t.side === "BUY" ? (px - t.entry) * t.qty : (t.entry - px) * t.qty;
}

function rMult(t, exit) {
  const risk = Math.abs(t.entry - t.sl) * t.qty;
  if (!risk) return 0;
  const pnl = t.side === "BUY" ? (exit - t.entry) * t.qty : (t.entry - exit) * t.qty;
  return pnl / risk;
}

export function scanStrategy(id, universe = "NIFTY50") {
  const strat = STRATEGIES.find((s) => s.id === id);
  if (!strat) return [];
  return Market.getUniverse(universe)
    .map((row) => {
      const hit = strat.match(row);
      if (!hit.ok) return null;
      const plan = row.plan;
      return {
        strategy: id,
        strategyName: strat.name,
        symbol: row.symbol,
        name: row.name,
        side: hit.side,
        why: hit.why,
        score: row.score,
        ltp: row.ltp,
        entry: plan.entry,
        sl: plan.sl,
        t1: plan.t1,
        rr: plan.rr,
        rvol: row.ta.rvol,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

export function takePaper(setup) {
  const b = book();
  if (b.open.length >= b.maxOpen) {
    Alerts.toast("Max open paper trades reached", "warn");
    return null;
  }
  if (b.open.some((t) => t.symbol === setup.symbol && t.strategy === setup.strategy)) {
    Alerts.toast(setup.symbol + " already open in this strategy", "warn");
    return null;
  }
  const qty = qtyFor(setup.entry, setup.sl, b.cash, b.riskPct);
  if (!qty) {
    Alerts.toast("Stop too tight — no size", "warn");
    return null;
  }
  const notional = qty * setup.entry;
  if (notional > b.cash) {
    Alerts.toast("Not enough paper cash", "warn");
    return null;
  }
  const trade = {
    id: "p" + Date.now().toString(36) + setup.symbol.slice(0, 4),
    ts: Date.now(),
    strategy: setup.strategy,
    strategyName: setup.strategyName,
    symbol: setup.symbol,
    name: setup.name,
    side: setup.side,
    qty,
    entry: setup.entry,
    sl: setup.sl,
    t1: setup.t1,
    rr: setup.rr,
    why: setup.why,
    status: "OPEN",
    ltp: setup.ltp,
  };
  b.open.unshift(trade);
  b.cash -= notional;
  save(b);
  Alerts.toast("Paper " + trade.side + " " + trade.symbol + " × " + qty, "buy");
  return trade;
}

function closeTrade(b, trade, exit, reason) {
  const pnl = trade.side === "BUY" ? (exit - trade.entry) * trade.qty : (trade.entry - exit) * trade.qty;
  const closed = {
    ...trade,
    status: "CLOSED",
    exit,
    exitReason: reason,
    pnl,
    rMult: rMult(trade, exit),
    closedAt: Date.now(),
  };
  b.open = b.open.filter((t) => t.id !== trade.id);
  b.closed.unshift(closed);
  b.cash += trade.qty * exit;
  b.closed = b.closed.slice(0, 80);
  return closed;
}

export function flatten(id, reason = "MANUAL") {
  const b = book();
  const t = b.open.find((x) => x.id === id);
  if (!t) return;
  const row = Market.get(t.symbol);
  closeTrade(b, t, row?.ltp ?? t.ltp ?? t.entry, reason);
  save(b);
}

export function replayOpen() {
  const b = book();
  let n = 0;
  for (const t of [...b.open]) {
    const row = Market.get(t.symbol);
    if (!row?.bars?.length) continue;
    const today = row.bars.slice(-75);
    let hit = null;
    let exit = row.ltp;
    for (const bar of today) {
      if (t.side === "BUY") {
        if (bar.l <= t.sl) {
          hit = "SL";
          exit = t.sl;
          break;
        }
        if (bar.h >= t.t1) {
          hit = "T1";
          exit = t.t1;
          break;
        }
      } else {
        if (bar.h >= t.sl) {
          hit = "SL";
          exit = t.sl;
          break;
        }
        if (bar.l <= t.t1) {
          hit = "T1";
          exit = t.t1;
          break;
        }
      }
    }
    if (!hit) {
      hit = "EOD";
      exit = today[today.length - 1]?.c ?? row.ltp;
    }
    closeTrade(b, t, exit, hit);
    n += 1;
  }
  save(b);
  Alerts.toast(n ? "Replayed " + n + " paper trade(s) vs last session" : "No open paper trades", n ? "buy" : "info");
}

export function markOpen() {
  const b = book();
  for (const t of [...b.open]) {
    const row = Market.get(t.symbol);
    if (!row) continue;
    t.ltp = row.ltp;
    if (t.side === "BUY") {
      if (row.ltp <= t.sl) closeTrade(b, t, t.sl, "SL");
      else if (row.ltp >= t.t1) closeTrade(b, t, t.t1, "T1");
    } else if (row.ltp >= t.sl) closeTrade(b, t, t.sl, "SL");
    else if (row.ltp <= t.t1) closeTrade(b, t, t.t1, "T1");
  }
  save(b);
}

export function resetBook() {
  Storage.setPaper(null);
  emit();
  Alerts.toast("Paper book reset to ₹5,00,000", "info");
}

export function stats() {
  const b = book();
  const openPnl = b.open.reduce((s, t) => {
    const row = Market.get(t.symbol);
    return s + mtm(t, row?.ltp);
  }, 0);
  const realized = b.closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const wins = b.closed.filter((t) => t.pnl > 0).length;
  const losses = b.closed.filter((t) => t.pnl <= 0).length;
  const equity = b.cash + b.open.reduce((s, t) => s + t.qty * (Market.get(t.symbol)?.ltp ?? t.entry), 0);
  return {
    cash: b.cash,
    capital: b.capital,
    equity,
    openPnl,
    realized,
    open: b.open.length,
    closed: b.closed.length,
    wins,
    losses,
    winRate: wins + losses ? (100 * wins) / (wins + losses) : 0,
    riskPct: b.riskPct,
  };
}

function takeFromRow(row, strategyId) {
  const strat = STRATEGIES.find((s) => s.id === strategyId) || STRATEGIES[0];
  const hit = strat.match(row);
  const side = hit.ok ? hit.side : row.signal === "SELL" ? "SELL" : "BUY";
  return takePaper({
    strategy: strat.id,
    strategyName: strat.name,
    symbol: row.symbol,
    name: row.name,
    side,
    why: hit.why || row.signalWhy || "Manual paper",
    score: row.score,
    ltp: row.ltp,
    entry: row.plan.entry,
    sl: row.plan.sl,
    t1: row.plan.t1,
    rr: row.plan.rr,
  });
}

export function renderPaper(root) {
  let active = STRATEGIES[0].id;
  let universe = "NIFTY50";
  const paint = () => {
    markOpen();
    const st = stats();
    const b = book();
    const hits = scanStrategy(active, universe);
    const strat = STRATEGIES.find((s) => s.id === active);
    root.innerHTML = `
      ${Market.isFrozen() ? `<p class="warn-banner">Cash market is closed. Paper trades use last-session prices. Replay last session to see if SL or T1 would have tagged.</p>` : ""}
      <div class="page-head">
        <div>
          <p class="kicker">Virtual book · no live orders</p>
          <h1>Paper Trading</h1>
        </div>
        <div class="scan-controls">
          <button class="btn gold" id="pp-replay">Replay last session</button>
          <button class="btn ghost" id="pp-reset">Reset book</button>
        </div>
      </div>
      <div class="idx-row paper-stats">
        <article class="global-card"><header><h3>Equity</h3></header><p class="big-price">${inr(st.equity, 0)}</p><p class="muted">Start ${inr(st.capital, 0)}</p></article>
        <article class="global-card"><header><h3>Cash</h3></header><p class="big-price">${inr(st.cash, 0)}</p><p class="muted">Risk ${st.riskPct}% / trade</p></article>
        <article class="global-card"><header><h3>Open P&L</h3></header><p class="big-price ${st.openPnl >= 0 ? "pos" : "neg"}">${inr(st.openPnl)}</p><p class="muted">${st.open} open</p></article>
        <article class="global-card"><header><h3>Realized</h3></header><p class="big-price ${st.realized >= 0 ? "pos" : "neg"}">${inr(st.realized)}</p><p class="muted">Win rate ${st.winRate.toFixed(0)}% · ${st.wins}W ${st.losses}L</p></article>
      </div>
      <p class="kicker">Strategies</p>
      <div class="idx-row strat-row">
        ${STRATEGIES.map(
          (s) => `<article class="levels-card strat-card ${s.id === active ? "on" : ""}" data-sid="${s.id}">
            <header><div><h3>${s.name}</h3><p class="muted">${s.tag}</p></div><span class="chip">${s.id === active ? "ACTIVE" : "SCAN"}</span></header>
            <p class="why-line"><b>When</b> ${s.when}</p>
            <p class="why-line"><b>Entry</b> ${s.entry}</p>
            <p class="why-line"><b>SL</b> ${s.sl}</p>
            <p class="why-line"><b>Target</b> ${s.target}</p>
          </article>`,
        ).join("")}
      </div>
      <div class="page-head tight">
        <div>
          <p class="kicker">${strat.name} · setups</p>
          <h2>${hits.length} names</h2>
        </div>
        <label>Universe
          <select id="pp-uni">
            <option value="NIFTY50" ${universe === "NIFTY50" ? "selected" : ""}>NIFTY50</option>
            <option value="FNO" ${universe === "FNO" ? "selected" : ""}>FNO</option>
            <option value="WATCHLIST" ${universe === "WATCHLIST" ? "selected" : ""}>WATCHLIST</option>
          </select>
        </label>
      </div>
      <div class="table-wrap desktop-only">
        <table class="scan-table">
          <thead><tr><th>Symbol</th><th>Side</th><th>Score</th><th>LTP</th><th>Entry</th><th>SL</th><th>T1</th><th>R:R</th><th>Why</th><th></th></tr></thead>
          <tbody>
            ${
              hits
                .map(
                  (h) => `<tr>
              <td><button class="sym-btn" data-sym="${h.symbol}">${h.symbol}</button></td>
              <td><span class="chip ${h.side === "BUY" ? "buy" : "sell"}">${h.side}</span></td>
              <td class="gold">${h.score.toFixed(1)}</td>
              <td>${inr(h.ltp)}</td><td>${inr(h.entry)}</td><td>${inr(h.sl)}</td><td>${inr(h.t1)}</td>
              <td>1:${h.rr.toFixed(1)}</td>
              <td class="muted">${h.why}</td>
              <td><button class="btn gold sm" data-take='${JSON.stringify(h).replace(/'/g, "&#39;")}'>Paper trade</button></td>
            </tr>`,
                )
                .join("") || `<tr><td colspan="10">NO TRADE — this strategy is silent on the last session</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div class="scan-cards mobile-only">
        ${hits
          .map(
            (h) => `<article class="scan-card is-${h.side.toLowerCase()}">
          <header><h3>${h.symbol}</h3><span class="chip ${h.side === "BUY" ? "buy" : "sell"}">${h.side}</span></header>
          <p class="muted">${h.why}</p>
          <div class="scan-card-grid">
            <div><span>Entry</span><b>${inr(h.entry)}</b></div>
            <div><span>SL</span><b>${inr(h.sl)}</b></div>
            <div><span>T1</span><b>${inr(h.t1)}</b></div>
          </div>
          <button class="btn gold sm" data-take='${JSON.stringify(h).replace(/'/g, "&#39;")}'>Paper trade</button>
        </article>`,
          )
          .join("")}
      </div>
      <p class="kicker">Open paper positions</p>
      <div class="table-wrap">
        <table class="scan-table">
          <thead><tr><th>Symbol</th><th>Strategy</th><th>Side</th><th>Qty</th><th>Entry</th><th>LTP</th><th>SL</th><th>T1</th><th>MTM</th><th></th></tr></thead>
          <tbody>
            ${
              b.open
                .map((t) => {
                  const row = Market.get(t.symbol);
                  const px = row?.ltp ?? t.entry;
                  const pnl = mtm(t, px);
                  return `<tr>
                  <td>${t.symbol}</td><td class="muted">${t.strategyName}</td>
                  <td><span class="chip ${t.side === "BUY" ? "buy" : "sell"}">${t.side}</span></td>
                  <td>${t.qty}</td><td>${inr(t.entry)}</td><td>${inr(px)}</td><td>${inr(t.sl)}</td><td>${inr(t.t1)}</td>
                  <td class="${pnl >= 0 ? "pos" : "neg"}">${inr(pnl)}</td>
                  <td><button class="btn ghost sm" data-flat="${t.id}">Close</button></td>
                </tr>`;
                })
                .join("") || `<tr><td colspan="10">No open paper trades</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <p class="kicker">Journal</p>
      <div class="table-wrap">
        <table class="scan-table">
          <thead><tr><th>Symbol</th><th>Strategy</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>Reason</th><th>P&L</th><th>R</th></tr></thead>
          <tbody>
            ${
              b.closed
                .slice(0, 20)
                .map(
                  (t) => `<tr>
                <td>${t.symbol}</td><td class="muted">${t.strategyName}</td>
                <td>${t.side}</td><td>${t.qty}</td>
                <td>${inr(t.entry)}</td><td>${inr(t.exit)}</td>
                <td>${t.exitReason}</td>
                <td class="${t.pnl >= 0 ? "pos" : "neg"}">${inr(t.pnl)}</td>
                <td>${t.rMult >= 0 ? "+" : ""}${t.rMult.toFixed(2)}R</td>
              </tr>`,
                )
                .join("") || `<tr><td colspan="9">Empty journal — take a paper trade</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <p class="scan-meta">Paper trading is educational. No orders are sent to FYERS or any broker. Size uses ${st.riskPct}% of cash vs the ATR stop. Prefer NO TRADE over a weak print.</p>
    `;
    root.querySelectorAll("[data-sid]").forEach((el) => {
      el.onclick = () => {
        active = el.dataset.sid;
        paint();
      };
    });
    root.querySelector("#pp-uni").onchange = (e) => {
      universe = e.target.value;
      paint();
    };
    root.querySelector("#pp-replay").onclick = () => {
      replayOpen();
      paint();
    };
    root.querySelector("#pp-reset").onclick = () => {
      if (confirm("Reset the paper book to ₹5,00,000 and clear the journal?")) {
        resetBook();
        paint();
      }
    };
    root.querySelectorAll("[data-take]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        try {
          takePaper(JSON.parse(btn.getAttribute("data-take")));
          paint();
        } catch {
          /* ignore */
        }
      };
    });
    root.querySelectorAll("[data-flat]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        flatten(btn.dataset.flat);
        paint();
      };
    });
    root.querySelectorAll("[data-sym]").forEach((el) => {
      el.onclick = () => window.dispatchEvent(new CustomEvent("nstox:open-detail", { detail: { symbol: el.dataset.sym } }));
    });
  };
  paint();
}

export const Paper = { STRATEGIES, scanStrategy, takePaper, takeFromRow, flatten, replayOpen, render: renderPaper, stats, book };
