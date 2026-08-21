/**
 * High-performance scanner — Map of rows, patch-only DOM updates.
 */
import { Storage, inr, fmtPct, fmtNum, throttle } from "./storage.js";
import { Market } from "./market.js";
import { Alerts } from "./alerts.js";

const rowEls = new Map();
let running = false;
let timer = null;
let lastScanAt = 0;

function passes(row, f) {
  if (f.signal && f.signal !== "ALL" && row.signal !== f.signal) return false;
  if (row.score < (f.minScoreBand || 0)) return false;
  if (row.ta.rvol < (f.minRvol || 0)) return false;
  if (f.aboveVwap && !row.ta.aboveVwap) return false;
  if (f.belowVwap && row.ta.aboveVwap) return false;
  if (f.bos && !(row.ta.bos.bull || row.ta.bos.bear)) return false;
  if (f.retest && !row.ta.retest.yes) return false;
  if (f.breakout && !row.ta.breakout.yes) return false;
  if (f.liquiditySweep && !(row.ta.sweep.high || row.ta.sweep.low)) return false;
  return true;
}

export function filteredRows() {
  const s = Storage.getScanner();
  const universe = Market.getUniverse(s.universe || "NIFTY50");
  const band = s.scoreBand ?? 0;
  return universe
    .filter((r) =>
      passes(r, {
        ...s,
        minScoreBand: band,
        minRvol: rvolFloor(s.rvolBand || s.minRvol),
      }),
    )
    .sort((a, b) => b.score - a.score || b.plan.rr - a.plan.rr || b.ta.rvol - a.ta.rvol);
}

function rvolFloor(v) {
  if (v === "3") return 3;
  if (v === "2") return 2;
  if (v === "1.5") return 1.5;
  if (v === "1") return 1;
  return Number(v) || 0;
}

function yn(v) {
  return v ? `<span class="yn yes">YES</span>` : `<span class="yn no">NO</span>`;
}

function signalChip(sig) {
  const k = sig === "BUY" ? "buy" : sig === "SELL" ? "sell" : "flat";
  return `<span class="chip ${k}">${sig}</span>`;
}

function paintRow(tr, row) {
  const cells = tr.children;
  const vals = [
    row.symbol,
    inr(row.ltp),
    fmtPct(row.chp),
    fmtNum(row.ta.volume, 0),
    row.ta.rvol.toFixed(1) + "x",
    row.ta.aboveVwap ? "Above" : "Below",
    row.ta.ema20 ? inr(row.ta.ema20) : "—",
    row.ta.ema50 ? inr(row.ta.ema50) : "—",
    row.ta.rsi?.toFixed(0) ?? "—",
    inr(row.ta.atr, 2),
    row.ta.bos.bull || row.ta.bos.bear ? "YES" : "NO",
    row.ta.retest.yes ? "YES" : "NO",
    row.ta.breakout.yes ? "YES" : "NO",
    row.ta.sweep.high || row.ta.sweep.low ? "SWEEP" : "—",
    row.ta.momentum.toFixed(2),
    row.score.toFixed(1),
    row.signal,
  ];
  const flags = [10, 11, 12];
  for (let i = 0; i < cells.length; i++) {
    if (i === 0) {
      cells[0].innerHTML = `<button class="sym-btn" data-sym="${row.symbol}">${row.symbol}</button>`;
      continue;
    }
    if (i === 2) {
      cells[2].textContent = vals[2];
      cells[2].className = row.chp >= 0 ? "pos" : "neg";
      continue;
    }
    if (i === 5) {
      cells[5].textContent = vals[5];
      cells[5].className = row.ta.aboveVwap ? "pos" : "neg";
      continue;
    }
    if (flags.includes(i)) {
      cells[i].innerHTML = yn(vals[i] === "YES");
      continue;
    }
    if (i === 15) {
      cells[15].innerHTML = `<b class="gold">${row.score.toFixed(1)}</b>`;
      continue;
    }
    if (i === 16) {
      cells[16].innerHTML = signalChip(row.signal);
      continue;
    }
    if (cells[i].textContent !== String(vals[i])) cells[i].textContent = vals[i];
  }
  tr.dataset.sig = row.signal;
  tr.classList.toggle("is-buy", row.signal === "BUY");
  tr.classList.toggle("is-sell", row.signal === "SELL");
}

function ensureRow(tbody, row, onOpen) {
  let tr = rowEls.get(row.symbol);
  if (!tr) {
    tr = document.createElement("tr");
    tr.dataset.sym = row.symbol;
    for (let i = 0; i < 17; i++) tr.appendChild(document.createElement("td"));
    tr.addEventListener("click", () => onOpen(row.symbol));
    tbody.appendChild(tr);
    rowEls.set(row.symbol, tr);
  }
  paintRow(tr, row);
  return tr;
}

function renderCards(host, rows, onOpen) {
  const seen = new Set();
  for (const row of rows) {
    seen.add(row.symbol);
    let el = host.querySelector(`[data-sym="${row.symbol}"]`);
    if (!el) {
      el = document.createElement("article");
      el.className = "scan-card";
      el.dataset.sym = row.symbol;
      el.addEventListener("click", () => onOpen(row.symbol));
      host.appendChild(el);
    }
    el.classList.toggle("is-buy", row.signal === "BUY");
    el.classList.toggle("is-sell", row.signal === "SELL");
    el.innerHTML = `
      <header>
        <h3>${row.symbol}</h3>
        ${signalChip(row.signal)}
      </header>
      <div class="scan-card-grid">
        <div><span>Score</span><b class="gold">${row.score.toFixed(1)}</b></div>
        <div><span>Entry</span><b>${inr(row.plan.entry)}</b></div>
        <div><span>SL</span><b>${inr(row.plan.sl)}</b></div>
        <div><span>Target</span><b>${inr(row.plan.t1)}</b></div>
        <div><span>R:R</span><b>1:${row.plan.rr.toFixed(1)}</b></div>
        <div><span>LTP</span><b>${inr(row.ltp)}</b></div>
      </div>
    `;
  }
  for (const node of [...host.children]) {
    if (!seen.has(node.dataset.sym)) node.remove();
  }
}

export function renderScanner(root) {
  const s = Storage.getScanner();
  root.innerHTML = `
    <div class="page-head">
      <div>
        <p class="kicker">Rule-based confluence</p>
        <h1>Market Scanner</h1>
      </div>
      <div class="scan-controls">
        <button class="btn gold" id="scan-start">Start</button>
        <button class="btn ghost" id="scan-stop">Stop</button>
        <button class="btn ghost" id="scan-refresh">Refresh</button>
        <label class="toggle"><input type="checkbox" id="scan-auto" ${s.autoScan ? "checked" : ""}/> Auto</label>
      </div>
    </div>
    <div class="filters" id="scan-filters">
      <label>Universe
        <select data-k="universe">
          <option ${s.universe === "NIFTY50" ? "selected" : ""}>NIFTY50</option>
          <option ${s.universe === "FNO" ? "selected" : ""}>FNO</option>
          <option ${s.universe === "NIFTY500" ? "selected" : ""}>NIFTY500</option>
          <option ${s.universe === "WATCHLIST" ? "selected" : ""}>WATCHLIST</option>
        </select>
      </label>
      <label>Signal
        <select data-k="signal">
          <option ${s.signal === "ALL" ? "selected" : ""}>ALL</option>
          <option ${s.signal === "BUY" ? "selected" : ""}>BUY</option>
          <option ${s.signal === "SELL" ? "selected" : ""}>SELL</option>
          <option value="NO TRADE" ${s.signal === "NO TRADE" ? "selected" : ""}>NO TRADE</option>
        </select>
      </label>
      <label>Score
        <select data-k="scoreBand">
          <option value="0">All</option>
          <option value="8" ${String(s.scoreBand) === "8" ? "selected" : ""}>8+</option>
          <option value="7" ${String(s.scoreBand) === "7" ? "selected" : ""}>7+</option>
          <option value="6" ${String(s.scoreBand) === "6" ? "selected" : ""}>6+</option>
        </select>
      </label>
      <label>RVOL
        <select data-k="rvolBand">
          <option value="0">All</option>
          <option value="1" ${String(s.rvolBand) === "1" ? "selected" : ""}>1x+</option>
          <option value="1.5" ${String(s.rvolBand) === "1.5" ? "selected" : ""}>1.5x+</option>
          <option value="2" ${String(s.rvolBand) === "2" ? "selected" : ""}>2x+</option>
          <option value="3" ${String(s.rvolBand) === "3" ? "selected" : ""}>3x+</option>
        </select>
      </label>
      <label>Interval
        <select data-k="intervalSec">
          ${[5, 10, 15, 30, 60]
            .map((n) => `<option value="${n}" ${Number(s.intervalSec) === n ? "selected" : ""}>${n}s</option>`)
            .join("")}
        </select>
      </label>
      <label class="chk"><input type="checkbox" data-k="aboveVwap" ${s.aboveVwap ? "checked" : ""}/> Above VWAP</label>
      <label class="chk"><input type="checkbox" data-k="belowVwap" ${s.belowVwap ? "checked" : ""}/> Below VWAP</label>
      <label class="chk"><input type="checkbox" data-k="bos" ${s.bos ? "checked" : ""}/> BOS</label>
      <label class="chk"><input type="checkbox" data-k="retest" ${s.retest ? "checked" : ""}/> Retest</label>
      <label class="chk"><input type="checkbox" data-k="breakout" ${s.breakout ? "checked" : ""}/> Breakout</label>
      <label class="chk"><input type="checkbox" data-k="liquiditySweep" ${s.liquiditySweep ? "checked" : ""}/> Liquidity sweep</label>
    </div>
    <p class="scan-meta" id="scan-meta"></p>
    <div class="table-wrap desktop-only">
      <table class="scan-table" id="scan-table">
        <thead>
          <tr>
            <th>Symbol</th><th>LTP</th><th>Change</th><th>Volume</th><th>RVOL</th>
            <th>VWAP</th><th>EMA20</th><th>EMA50</th><th>RSI</th><th>ATR</th>
            <th>BOS</th><th>Retest</th><th>Breakout</th><th>Liquidity</th>
            <th>Mom</th><th>Score</th><th>Signal</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="scan-cards mobile-only" id="scan-cards"></div>
  `;

  const tbody = root.querySelector("#scan-table tbody");
  const cards = root.querySelector("#scan-cards");
  const meta = root.querySelector("#scan-meta");

  const onOpen = (sym) => {
    Market.select(sym);
    window.dispatchEvent(new CustomEvent("nstox:open-detail", { detail: { symbol: sym } }));
  };

  const patch = throttle(() => {
    const rows = filteredRows();
    const seen = new Set();
    for (const row of rows) {
      seen.add(row.symbol);
      ensureRow(tbody, row, onOpen);
    }
    for (const [sym, tr] of rowEls) {
      if (!seen.has(sym)) {
        tr.remove();
        rowEls.delete(sym);
      }
    }
    renderCards(cards, rows, onOpen);
    const buys = rows.filter((r) => r.signal === "BUY").length;
    const sells = rows.filter((r) => r.signal === "SELL").length;
    meta.textContent = `${rows.length} names · ${buys} buy · ${sells} sell · last scan ${new Date(lastScanAt || Date.now()).toLocaleTimeString("en-IN", { hour12: false })} IST · Prefer NO TRADE over a weak print`;
  }, 80);

  const applyFilter = (e) => {
    const el = e.target;
    const k = el.dataset.k;
    if (!k) return;
    const val = el.type === "checkbox" ? el.checked : el.value;
    Storage.setScanner({ ...Storage.getScanner(), [k]: val });
    patch();
  };
  root.querySelector("#scan-filters").addEventListener("change", applyFilter);
  root.querySelector("#scan-start").onclick = () => Scanner.start();
  root.querySelector("#scan-stop").onclick = () => Scanner.stop();
  root.querySelector("#scan-refresh").onclick = () => {
    Market.refresh();
    lastScanAt = Date.now();
    patch();
  };
  root.querySelector("#scan-auto").onchange = (e) => {
    Storage.setScanner({ ...Storage.getScanner(), autoScan: e.target.checked });
    if (e.target.checked) Scanner.start();
    else Scanner.stop();
  };

  Market.subscribe(patch);
  patch();
}

export const Scanner = {
  render: renderScanner,
  filteredRows,
  isRunning() {
    return running;
  },
  start() {
    if (running) return;
    running = true;
    const tick = () => {
      lastScanAt = Date.now();
      Market.refresh();
      const rows = filteredRows();
      Alerts.ingest(rows);
      window.dispatchEvent(new CustomEvent("nstox:scan", { detail: { n: rows.length, running } }));
    };
    tick();
    const sec = Number(Storage.getScanner().intervalSec) || 10;
    timer = setInterval(tick, sec * 1000);
    window.dispatchEvent(new CustomEvent("nstox:scan", { detail: { running: true } }));
  },
  stop() {
    running = false;
    clearInterval(timer);
    window.dispatchEvent(new CustomEvent("nstox:scan", { detail: { running: false } }));
  },
};
