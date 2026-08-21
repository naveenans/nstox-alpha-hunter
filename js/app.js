/**
 * NSTOX ALPHA HUNTER — shell, navigation, command center, dashboard, modal.
 */
import { Storage, inr, fmtPct, nowIST, getMarketStatus } from "./storage.js";
import { Market, SECTORS } from "./market.js";
import { Scanner } from "./scanner.js";
import { Options } from "./options.js";
import { Levels } from "./levels.js";
import { Settings } from "./settings.js";
import { Alerts } from "./alerts.js";
import { Paper } from "./paper.js";
import { isFyersConnected } from "./fyers.js";
import { WS } from "./websocket.js";
import { Auth } from "./auth.js";

const NAV = [
  { href: "dashboard.html", id: "dashboard", label: "Dashboard" },
  { href: "scanner.html", id: "scanner", label: "Market Scanner" },
  { href: "nifty50.html", id: "nifty50", label: "NIFTY 50" },
  { href: "fno.html", id: "fno", label: "F&O Stocks" },
  { href: "sectors.html", id: "sectors", label: "Sectors" },
  { href: "options.html", id: "options", label: "Options Finder" },
  { href: "levels.html", id: "levels", label: "Intraday Levels" },
  { href: "watchlist.html", id: "watchlist", label: "Watchlist" },
  { href: "paper.html", id: "paper", label: "Paper Trading" },
  { href: "settings.html", id: "settings", label: "Settings" },
  { href: "about.html", id: "about", label: "About" },
];

const PAGE = document.body?.dataset?.page || "index";

function icon(name) {
  const paths = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    scan: "M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 12h8",
    bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
    cog: "M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2M18 12h2M12 4v2M12 18v2",
    list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  };
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7">${(paths[name] || paths.grid)
    .split(/(?=[ML])/)
    .map((d) => `<path d="${paths[name] || "M4 4h16v16H4z"}"/>`)
    .slice(0, 1)
    .join("")}<path d="${paths[name] || "M4 4h16v16H4z"}"/></svg>`;
}

function scoreRing(score) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(10, score) / 10);
  return `<svg class="ring" viewBox="0 0 72 72">
    <circle cx="36" cy="36" r="${r}" fill="none" stroke="rgba(201,162,39,0.18)" stroke-width="5"/>
    <circle cx="36" cy="36" r="${r}" fill="none" stroke="#e4c56a" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 36 36)"/>
    <text x="36" y="34" text-anchor="middle" fill="#f4ecd4" font-size="16" font-weight="600">${score.toFixed(1)}</text>
    <text x="36" y="48" text-anchor="middle" fill="#9a9588" font-size="8">/10</text>
  </svg>`;
}

function setupCard(row) {
  if (!row) return "";
  return `<article class="setup-card" data-sym="${row.symbol}">
    <header>
      <div>
        <h3>${row.symbol}</h3>
        <p class="muted">${row.name || ""}</p>
      </div>
      <span class="chip ${row.signal === "BUY" ? "buy" : row.signal === "SELL" ? "sell" : "flat"}">${row.signal}</span>
    </header>
    <div class="setup-mid">
      ${scoreRing(row.score)}
      <div class="setup-meta">
        <p class="gold">${row.label.text}</p>
        <p>LTP ${inr(row.ltp)} <span class="${row.chp >= 0 ? "pos" : "neg"}">${fmtPct(row.chp)}</span></p>
      </div>
    </div>
    <dl class="kv">
      <div><dt>Entry</dt><dd>${inr(row.plan.entry)}</dd></div>
      <div><dt>SL</dt><dd>${inr(row.plan.sl)}</dd></div>
      <div><dt>Target</dt><dd>${inr(row.plan.t1)}</dd></div>
      <div><dt>R:R</dt><dd>1:${row.plan.rr.toFixed(1)}</dd></div>
    </dl>
  </article>`;
}

function fmtCcy(ccy, n) {
  const abs = Math.abs(n);
  const body = abs >= 1000 ? inr(abs).replace(/^₹\s?/, "") : abs.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const sign = n < 0 ? "−" : "";
  return `${sign}${ccy}${body}`;
}

function globalCard(g) {
  if (!g) return "";
  const flagSrc = g.flag ? `https://flagcdn.com/w80/${g.flag}.png` : "";
  const flag2x = g.flag ? `https://flagcdn.com/w160/${g.flag}.png 2x` : "";
  return `<article class="global-card">
    <header>
      <span class="led ${g.live ? "live" : "closed"}" title="${g.live ? "LIVE" : "CLOSED"}"></span>
      ${g.flag ? `<img class="flag-logo" src="${flagSrc}" srcset="${flag2x}" alt="${g.region}" width="32" height="24" loading="lazy"/>` : ""}
      <div>
        <h3>${g.name}</h3>
        <p class="muted">${g.region}</p>
      </div>
      <span class="chip ${g.live ? "buy" : "sell"}">${g.live ? "LIVE" : "CLOSED"}</span>
    </header>
    <p class="big-price">${fmtCcy(g.ccy, g.ltp)}</p>
    <p class="${g.ch >= 0 ? "pos" : "neg"}">${g.ch >= 0 ? "+" : ""}${fmtCcy(g.ccy, g.ch)} · ${fmtPct(g.chp)}</p>
  </article>`;
}

function indexLevelsCard(row) {
  if (!row?.plan?.piv) return "";
  const p = row.plan.piv;
  const ltp = row.ltp;
  const cell = (k, v, tone) => {
    const near = ltp && v && Math.abs(ltp - v) / ltp < 0.0025;
    return `<div class="lvl-cell ${tone}${near ? " now" : ""}"><span>${k}</span><b>${inr(v)}</b></div>`;
  };
  return `<article class="levels-card">
    <header>
      <div>
        <h3>${row.name}</h3>
        <p class="muted">${row.symbol}</p>
      </div>
      <div class="lvl-ltp">
        <b>${inr(row.ltp)}</b>
        <span class="${row.chp >= 0 ? "pos" : "neg"}">${fmtPct(row.chp)}</span>
      </div>
    </header>
    <div class="lvl-ladder">
      ${cell("R2", p.r2, "res")}
      ${cell("R1", p.r1, "res")}
      ${cell("PIVOT", p.p, "mid")}
      ${cell("VWAP", row.ta.vwap, "mid")}
      ${cell("S1", p.s1, "sup")}
      ${cell("S2", p.s2, "sup")}
    </div>
  </article>`;
}

function indexCard(row) {
  if (!row) return "";
  return `<article class="idx-card">
    <header><span>${row.name}</span><span class="chip ${row.ta.align.bias === "BULL" ? "buy" : row.ta.align.bias === "BEAR" ? "sell" : "flat"}">${row.ta.align.bias}</span></header>
    <p class="big-price">${row.symbol === "INDIAVIX" ? row.ltp.toFixed(2) : inr(row.ltp)}</p>
    <p class="${row.chp >= 0 ? "pos" : "neg"}">${fmtPct(row.chp)}</p>
    <ul class="mini-stats">
      <li>VWAP ${inr(row.ta.vwap)}</li>
      <li>RSI ${row.ta.rsi?.toFixed(0)}</li>
      <li>Vol ${row.ta.rvol.toFixed(1)}x</li>
      <li>Score ${row.score.toFixed(1)}</li>
    </ul>
  </article>`;
}

function renderShell() {
  const fy = isFyersConnected();
  const demo = Market.isDemo();
  const page = PAGE;
  document.getElementById("app").innerHTML = `
    <aside class="sidebar">
      <a class="brand" href="index.html">
        <img src="assets/nstox-alpha-logo.png" onerror="this.onerror=null;this.src='assets/nstox-alpha-logo.svg'" alt="NSTOX ALPHA" width="52" height="52"/>
        <div>
          <strong>NSTOX ALPHA</strong>
          <span>HUNTER</span>
        </div>
      </a>
      <nav class="side-nav">
        ${NAV.map((n) => `<a href="${n.href}" class="${n.id === page || (page === "index" && n.id === "dashboard") ? "active" : ""}">${n.label}</a>`).join("")}
      </nav>
      <div class="side-foot">
        <p class="kicker">FYERS STATUS</p>
        <p class="fy-pill ${fy ? "on" : "off"}"><i></i> ${fy ? "CONNECTED" : "DISCONNECTED"}</p>
      </div>
    </aside>
    <div class="stage">
      <header class="topbar">
        <div class="topbar-brand">
          <img class="topbar-logo" src="assets/nstox-alpha-logo.png" onerror="this.onerror=null;this.src='assets/nstox-alpha-logo.svg'" alt="" width="36" height="36"/>
          <div>
          <p class="brand-line">NSTOX ALPHA HUNTER</p>
          <p class="tag">Live market scanner · Find high-conviction intraday setups</p>
          </div>
        </div>
        <div class="status-pills">
          <span class="pill" id="pill-mkt"></span>
          <span class="pill" id="pill-fy"></span>
          <span class="pill" id="pill-scan"></span>
          <span class="pill" id="pill-clock"></span>
          <span class="badge ${demo ? "demo" : "live"}" id="mode-badge">${demo ? "DEMO MODE" : "LIVE MODE"}</span>
        </div>
      </header>
      <main class="page" id="page"></main>
      <footer class="disclaimer">
        Nstox Alpha Hunter is a technical-analysis and market-scanning tool for educational and decision-support purposes. It does not guarantee profits, accuracy, or successful trades. Trading involves substantial risk. Users are solely responsible for their trading and investment decisions. Confluence > indicator count. Quality > quantity. Risk management > signal frequency. NO TRADE > a weak trade.
      </footer>
    </div>
    <nav class="bottom-nav">
      <a href="index.html" class="${page === "index" || page === "dashboard" ? "active" : ""}">Home</a>
      <a href="scanner.html" class="${page === "scanner" ? "active" : ""}">Scanner</a>
      <a href="paper.html" class="${page === "paper" ? "active" : ""}">Paper</a>
      <a href="watchlist.html" class="${page === "watchlist" ? "active" : ""}">Watch</a>
      <a href="options.html" class="${page === "options" ? "active" : ""}">Options</a>
      <a href="settings.html" class="${page === "settings" ? "active" : ""}">Settings</a>
    </nav>
    <div id="modal-root"></div>
    <div id="toast-root"></div>
  `;
}

function paintStatus() {
  const m = getMarketStatus();
  const ist = nowIST();
  const fy = isFyersConnected();
  const demo = Market.isDemo();
  const el = (id) => document.getElementById(id);
  if (el("pill-mkt"))
    el("pill-mkt").innerHTML = `<i class="${m.code === "OPEN" ? "on" : m.code === "PRE" ? "warn" : "off"}"></i> ${m.label}`;
  if (el("pill-fy")) el("pill-fy").innerHTML = `<i class="${fy ? "on" : "off"}"></i> FYERS ${fy ? "CONNECTED" : "DISCONNECTED"}`;
  if (el("pill-scan")) el("pill-scan").innerHTML = `<i class="on"></i> SCANNER READY`;
  if (el("pill-clock")) el("pill-clock").textContent = `${ist.clock} IST`;
  if (el("mode-badge")) {
    const frozen = Market.isFrozen();
    el("mode-badge").textContent = frozen ? "FROZEN · MARKET CLOSED" : demo ? "DEMO MODE" : "LIVE MODE";
    el("mode-badge").className = `badge ${frozen ? "demo" : demo ? "demo" : "live"}`;
  }
  document.querySelectorAll(".global-row .global-card").forEach((elCard, i) => {
    const g = Market.snapshot().globalIndices?.[i];
    if (!g) return;
    const led = elCard.querySelector(".led");
    const chip = elCard.querySelector(".chip");
    if (led) {
      led.className = `led ${g.live ? "live" : "closed"}`;
      led.title = g.live ? "LIVE" : "CLOSED";
    }
    if (chip) {
      chip.className = `chip ${g.live ? "buy" : "sell"}`;
      chip.textContent = g.live ? "LIVE" : "CLOSED";
    }
  });
}

function freezeNote() {
  if (!Market.isFrozen()) return "";
  const m = getMarketStatus();
  return `<p class="warn-banner">Cash market is closed (${m.session}). Prices are frozen at the previous session — tickers will not move until 09:15 IST Monday–Friday.</p>`;
}

function renderCommand(root) {
  const snap = Market.snapshot();
  const rows = snap.rows.slice().sort((a, b) => b.score - a.score);
  const buys = rows.filter((r) => r.signal === "BUY");
  const sells = rows.filter((r) => r.signal === "SELL");
  const brk = rows.filter((r) => r.ta.breakout.yes).sort((a, b) => b.ta.rvol - a.ta.rvol)[0];
  const rg = snap.regime;
  root.innerHTML = `
    ${freezeNote()}
    <section class="hero-regime">
      <div>
        <p class="kicker">What are the best intraday setups right now?</p>
        <h1>Market regime</h1>
        <p class="regime-label ${/BULL/.test(rg.label) ? "pos" : /BEAR/.test(rg.label) ? "neg" : ""}">${rg.label}</p>
        <p>Confluence ${rg.score}% · ${rg.note}</p>
      </div>
      ${scoreRing(Math.min(10, rg.score / 10))}
    </section>
    <div class="flow-grid">
      <div>
        <p class="kicker">Top buy</p>
        ${setupCard(buys[0]) || `<div class="empty">NO TRADE — no buy with score ≥ 8 and R:R ≥ 1:2</div>`}
      </div>
      <div>
        <p class="kicker">Top sell</p>
        ${setupCard(sells[0]) || `<div class="empty">NO TRADE — no sell with score ≥ 8 and R:R ≥ 1:2</div>`}
      </div>
      <div>
        <p class="kicker">Top breakout</p>
        ${
          brk
            ? `<article class="setup-card" data-sym="${brk.symbol}">
          <header><h3>${brk.symbol}</h3><span class="chip">${brk.ta.breakout.label || "BRK"}</span></header>
          <p>RVOL ${brk.ta.rvol.toFixed(1)}x · BOS ${brk.ta.bos.kind ? "YES" : "NO"} · Retest ${brk.ta.retest.yes ? "YES" : "NO"}</p>
          <p>LTP ${inr(brk.ltp)} · Score ${brk.score.toFixed(1)}</p>
        </article>`
            : `<div class="empty">No confirmed breakout</div>`
        }
      </div>
    </div>
    <div class="idx-row" id="idx-row">${snap.indices.map(indexCard).join("")}</div>
    <p class="kicker">Intraday levels</p>
    <div class="idx-row levels-row">${["NIFTY", "SENSEX", "BANKNIFTY", "FINNIFTY"].map((s) => indexLevelsCard(snap.indices.find((i) => i.symbol === s))).join("")}</div>
  `;
  bindSetupClicks(root);
}

function renderDashboard(root) {
  const snap = Market.snapshot();
  const rows = snap.rows.slice().sort((a, b) => b.score - a.score);
  const buys = rows.filter((r) => r.signal === "BUY").slice(0, 4);
  const brk = rows.filter((r) => r.ta.breakout.yes).sort((a, b) => b.ta.rvol - a.ta.rvol).slice(0, 4);
  const rvol = rows.slice().sort((a, b) => b.ta.rvol - a.ta.rvol).slice(0, 4);
  const n50 = rows.filter((r) => r.nifty50).slice(0, 6);
  const fno = rows.filter((r) => r.fno && !r.nifty50).slice(0, 6);
  const rg = snap.regime;
  root.innerHTML = `
    ${freezeNote()}
    <div class="page-head">
      <div>
        <p class="kicker">Command deck</p>
        <h1>Dashboard</h1>
      </div>
    </div>
    <section class="hero-regime compact">
      <div>
        <p class="kicker">Market regime</p>
        <p class="regime-label ${/BULL/.test(rg.label) ? "pos" : /BEAR/.test(rg.label) ? "neg" : ""}">${rg.label}</p>
        <p>Confluence ${rg.score}% · breadth ${snap.regime.breadth.adv}/${snap.regime.breadth.dec}</p>
      </div>
    </section>
    <p class="kicker">Broad indices</p>
    <div class="idx-row broad-row">${snap.indices.map(indexCard).join("")}</div>
    <p class="kicker">Midcap · Smallcap · Microcap</p>
    <div class="idx-row cap-row">${(snap.capIndices || []).map(indexCard).join("")}</div>
    <p class="kicker">Global Indices</p>
    <div class="idx-row global-row">${(snap.globalIndices || []).map(globalCard).join("")}</div>
    <div class="grid-2">
      <section class="card"><header class="card-h">NIFTY 50 · leaders</header>${miniTable(n50)}</section>
      <section class="card"><header class="card-h">F&O · leaders</header>${miniTable(fno)}</section>
    </div>
    <div class="grid-2">
      <section class="card"><header class="card-h">Top breakouts</header>${miniTable(brk)}</section>
      <section class="card"><header class="card-h">Top RVOL</header>${miniTable(rvol)}</section>
    </div>
    <p class="kicker">High conviction setups</p>
    <div class="setup-row">${buys.map(setupCard).join("") || `<div class="empty">NO TRADE — filters prefer silence over a weak print</div>`}</div>
    <p class="kicker">Intraday levels</p>
    <div class="idx-row levels-row">${["NIFTY", "SENSEX", "BANKNIFTY", "FINNIFTY"].map((s) => indexLevelsCard(snap.indices.find((i) => i.symbol === s))).join("")}</div>
  `;
  bindSetupClicks(root);
}

function miniTable(rows) {
  if (!rows.length) return `<div class="empty">NO DATA</div>`;
  return `<table class="mini"><thead><tr><th>Symbol</th><th>LTP</th><th>Chg</th><th>Score</th><th></th></tr></thead><tbody>
    ${rows
      .map(
        (r) => `<tr data-sym="${r.symbol}"><td>${r.symbol}</td><td>${inr(r.ltp)}</td>
        <td class="${r.chp >= 0 ? "pos" : "neg"}">${fmtPct(r.chp)}</td>
        <td class="gold">${r.score.toFixed(1)}</td><td>${r.signal}</td></tr>`,
      )
      .join("")}
  </tbody></table>`;
}

function heatTone(chp) {
  const mag = Math.min(3, Math.abs(chp));
  const a = 0.08 + mag * 0.12;
  return chp >= 0 ? `rgba(61,186,126,${a})` : `rgba(211,91,91,${a})`;
}

function renderSectors(root) {
  const snap = Market.snapshot();
  const idx = snap.sectorIndices || [];
  const cards = snap.sectors || [];
  let active = cards[0]?.name || SECTORS[0];

  const paint = () => {
    const stocks = Market.getBySector(active).sort((a, b) => b.chp - a.chp);
    const meta = cards.find((s) => s.name === active);
    const ix = idx.find((i) => i.sector === active);
    root.querySelector("#sec-body").innerHTML = `
      <div class="sec-detail">
        <div>
          <p class="kicker">${active}</p>
          <h2>${active}</h2>
          <p>${meta ? `${meta.n} names · ${meta.adv} up / ${meta.dec} down · ${meta.trend}` : ""}</p>
          <p>Breadth RS vs Nifty ${meta ? meta.rs.toFixed(2) : "—"} · RVOL ${meta ? meta.rvol.toFixed(1) : "—"}x</p>
        </div>
        <div class="sec-idx">
          <p class="muted">${ix ? ix.name : "Sector basket"}</p>
          <p class="big-price">${ix ? inr(ix.ltp) : meta ? fmtPct(meta.chp) : "—"}</p>
          <p class="${(ix?.chp ?? meta?.chp ?? 0) >= 0 ? "pos" : "neg"}">${fmtPct(ix?.chp ?? meta?.chp ?? 0)}</p>
        </div>
      </div>
      <p class="muted">Leaders ${meta?.leaders?.join(" · ") || "—"} · Laggards ${meta?.laggards?.join(" · ") || "—"}</p>
      <div class="table-wrap desktop-only">
        <table class="scan-table">
          <thead><tr><th>Symbol</th><th>Name</th><th>Cap</th><th>LTP</th><th>Change</th><th>RVOL</th><th>VWAP</th><th>Score</th><th>Signal</th></tr></thead>
          <tbody>
            ${stocks
              .map(
                (r) => `<tr data-sym="${r.symbol}">
              <td>${r.symbol}</td><td class="muted">${r.name || ""}</td>
              <td>${r.cap || (r.nifty50 ? "LARGE" : "—")}</td>
              <td>${inr(r.ltp)}</td>
              <td class="${r.chp >= 0 ? "pos" : "neg"}">${fmtPct(r.chp)}</td>
              <td>${r.ta.rvol.toFixed(1)}x</td>
              <td class="${r.ta.aboveVwap ? "pos" : "neg"}">${r.ta.aboveVwap ? "Above" : "Below"}</td>
              <td class="gold">${r.score.toFixed(1)}</td>
              <td><span class="chip ${r.signal === "BUY" ? "buy" : r.signal === "SELL" ? "sell" : "flat"}">${r.signal}</span></td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="scan-cards mobile-only">${stocks.map(setupCard).join("") || `<div class="empty">No names in this sector yet</div>`}</div>
    `;
    bindSetupClicks(root.querySelector("#sec-body"));
    root.querySelectorAll("[data-sec]").forEach((el) => {
      el.classList.toggle("on", el.dataset.sec === active);
    });
  };

  root.innerHTML = `
    ${freezeNote()}
    <div class="page-head">
      <div>
        <p class="kicker">NSE sectoral tape</p>
        <h1>Sectors</h1>
      </div>
    </div>
    <p class="footnote">Index levels are Friday 21 Aug 2026 close. Open a sector for every tracked name in that group — Large / Mid / Small / Micro.</p>
    <div class="heat-grid">
      ${idx
        .map(
          (i) => `<button class="heat-cell" data-sec="${i.sector || ""}" style="background:${heatTone(i.chp)}">
        <span>${i.name.replace("Nifty ", "")}</span>
        <b class="${i.chp >= 0 ? "pos" : "neg"}">${fmtPct(i.chp)}</b>
        <small>${inr(i.ltp)}</small>
      </button>`,
        )
        .join("")}
    </div>
    <p class="kicker">Stock baskets</p>
    <div class="sec-chips">
      ${SECTORS.map((s) => `<button class="chip-btn" data-sec="${s}">${s}</button>`).join("")}
    </div>
    <div id="sec-body"></div>
  `;
  root.querySelectorAll("[data-sec]").forEach((el) => {
    el.addEventListener("click", () => {
      active = el.dataset.sec;
      paint();
    });
  });
  paint();
}

function renderUniverse(root, kind, title) {
  const rows = Market.getUniverse(kind).sort((a, b) => b.score - a.score);
  root.innerHTML = `
    ${freezeNote()}
    <div class="page-head"><div><p class="kicker">Universe</p><h1>${title}</h1></div></div>
    <div class="table-wrap desktop-only">
      <table class="scan-table">
        <thead><tr><th>Symbol</th><th>LTP</th><th>Change</th><th>RVOL</th><th>VWAP</th><th>RSI</th><th>Score</th><th>Signal</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr data-sym="${r.symbol}">
            <td>${r.symbol}</td><td>${inr(r.ltp)}</td>
            <td class="${r.chp >= 0 ? "pos" : "neg"}">${fmtPct(r.chp)}</td>
            <td>${r.ta.rvol.toFixed(1)}x</td>
            <td class="${r.ta.aboveVwap ? "pos" : "neg"}">${r.ta.aboveVwap ? "Above" : "Below"}</td>
            <td>${r.ta.rsi?.toFixed(0)}</td>
            <td class="gold">${r.score.toFixed(1)}</td>
            <td><span class="chip ${r.signal === "BUY" ? "buy" : r.signal === "SELL" ? "sell" : "flat"}">${r.signal}</span></td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="scan-cards mobile-only">${rows.map(setupCard).join("")}</div>
  `;
  bindSetupClicks(root);
}

function renderWatchlist(root) {
  let lists = Storage.getWatchlists();
  let active = lists[0]?.id;
  const paint = () => {
    lists = Storage.getWatchlists();
    const cur = lists.find((l) => l.id === active) || lists[0];
    const rows = (cur?.symbols || []).map((s) => Market.get(s)).filter(Boolean);
    root.innerHTML = `
      <div class="page-head">
        <div><p class="kicker">Saved locally</p><h1>Watchlist</h1></div>
        <div class="row-gap">
          <select id="wl-sel">${lists.map((l) => `<option value="${l.id}" ${l.id === cur.id ? "selected" : ""}>${l.name}</option>`).join("")}</select>
          <button class="btn ghost" id="wl-new">New</button>
          <button class="btn ghost" id="wl-ren">Rename</button>
        </div>
      </div>
      <form class="add-row" id="wl-add">
        <input name="sym" placeholder="Add symbol (e.g. RELIANCE)" required/>
        <button class="btn gold" type="submit">Add</button>
      </form>
      <div class="table-wrap">
        <table class="scan-table">
          <thead><tr><th>Symbol</th><th>LTP</th><th>Score</th><th>Signal</th><th></th></tr></thead>
          <tbody>
            ${rows
              .map(
                (r) => `<tr data-sym="${r.symbol}">
              <td>${r.symbol}</td><td>${inr(r.ltp)}</td>
              <td class="gold">${r.score.toFixed(1)}</td>
              <td>${r.signal}</td>
              <td><button class="btn ghost sm" data-del="${r.symbol}">Remove</button></td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    root.querySelector("#wl-sel").onchange = (e) => {
      active = e.target.value;
      paint();
    };
    root.querySelector("#wl-new").onclick = () => {
      const name = prompt("Watchlist name");
      if (!name) return;
      lists.push({ id: "wl-" + Date.now(), name, symbols: [] });
      Storage.setWatchlists(lists);
      active = lists[lists.length - 1].id;
      paint();
    };
    root.querySelector("#wl-ren").onclick = () => {
      const name = prompt("Rename", cur.name);
      if (!name) return;
      cur.name = name;
      Storage.setWatchlists(lists);
      paint();
    };
    root.querySelector("#wl-add").onsubmit = (e) => {
      e.preventDefault();
      const sym = e.target.sym.value.trim().toUpperCase();
      if (!cur.symbols.includes(sym)) cur.symbols.push(sym);
      Storage.setWatchlists(lists);
      paint();
    };
    root.querySelectorAll("[data-del]").forEach((b) => {
      b.onclick = (ev) => {
        ev.stopPropagation();
        cur.symbols = cur.symbols.filter((s) => s !== b.dataset.del);
        Storage.setWatchlists(lists);
        paint();
      };
    });
    bindSetupClicks(root);
  };
  paint();
}

function renderAbout(root) {
  root.innerHTML = `
    <div class="page-head"><div><p class="kicker">NSTOX ALPHA</p><h1>About Hunter</h1></div></div>
    <section class="card prose">
      <p>Hunter is a rule-based confluence scanner for manual intraday traders. It does not predict the future and it does not place trades.</p>
      <ul>
        <li><b>What?</b> High-confluence names after regime, trend, VWAP, momentum, volume, BOS, retest and breakout agree.</li>
        <li><b>Why?</b> Every score is a weighted checklist — open any name for the reasons and risks.</li>
        <li><b>Where?</b> Entry, stop (ATR × multiplier) and targets with a minimum 1:2 R:R.</li>
        <li><b>When?</b> Session VWAP and IST market hours. Analysis mode is available when the cash market is shut.</li>
        <li><b>Risk?</b> Prefer NO TRADE. Liquidity labels are price/volume-based proxies — not institutional order flow.</li>
      </ul>
      <p>Scoring max 10: Regime 1 · Trend/EMA 1 · VWAP 1 · Momentum/RSI 1 · Volume/RVOL 1 · BOS 1 · Retest 0.75 · Breakout 0.75 · Liquidity 0.75 · R:R 0.75. Weights are configurable.</p>
      <p class="footnote">Nstox Alpha Hunter is a technical-analysis and market-scanning tool for educational and decision-support purposes. It does not guarantee profits, accuracy, or successful trades. Trading involves substantial risk. Users are solely responsible for their trading and investment decisions.</p>
    </section>
  `;
}

function bindSetupClicks(root) {
  root.querySelectorAll("[data-sym]").forEach((el) => {
    el.addEventListener("click", () => openDetail(el.dataset.sym));
  });
}

function openDetail(sym) {
  const row = Market.get(sym);
  if (!row) return;
  Market.select(sym);
  const host = document.getElementById("modal-root");
  host.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>${row.symbol}</h2>
            <p class="muted">${row.name || ""} · ${row.sector || ""}</p>
          </div>
          <span class="chip ${row.signal === "BUY" ? "buy" : row.signal === "SELL" ? "sell" : "flat"}">${row.signal}</span>
          <button class="icon-x" id="modal-x" aria-label="Close">×</button>
        </header>
        <div class="modal-score">
          ${scoreRing(row.score)}
          <div>
            <p class="gold">${row.label.text}</p>
            <p>${row.signalWhy}</p>
          </div>
        </div>
        <dl class="kv">
          <div><dt>Entry</dt><dd>${inr(row.plan.entry)}</dd></div>
          <div><dt>Stop loss</dt><dd>${inr(row.plan.sl)}</dd></div>
          <div><dt>Target 1</dt><dd>${inr(row.plan.t1)}</dd></div>
          <div><dt>Target 2</dt><dd>${inr(row.plan.t2)}</dd></div>
          <div><dt>R:R</dt><dd>1:${row.plan.rr.toFixed(1)}</dd></div>
          <div><dt>RVOL</dt><dd>${row.ta.rvol.toFixed(2)}x</dd></div>
        </dl>
        <h3>Why</h3>
        <ul class="why">${row.reasons.map((r) => `<li>${r}</li>`).join("") || "<li>Insufficient confluence</li>"}</ul>
        <h3>Risks</h3>
        <ul class="risks">${row.risks.map((r) => `<li>${r}</li>`).join("") || "<li>Standard market risk</li>"}</ul>
        <div class="row-gap" style="margin-top:16px">
          <button class="btn gold" id="modal-paper">Paper trade</button>
        </div>
      </div>
    </div>`;
  host.querySelector("#modal-x").onclick = closeDetail;
  host.querySelector("#modal-paper").onclick = () => {
    Paper.takeFromRow(row, "hunter");
  };
  host.querySelector("#modal-bg").addEventListener("click", (e) => {
    if (e.target.id === "modal-bg") closeDetail();
  });
}

function closeDetail() {
  const host = document.getElementById("modal-root");
  if (host) host.innerHTML = "";
}

function renderPage() {
  const root = document.getElementById("page");
  if (!root) return;
  switch (PAGE) {
    case "index":
      renderCommand(root);
      break;
    case "dashboard":
      renderDashboard(root);
      break;
    case "scanner":
      Scanner.render(root);
      break;
    case "nifty50":
      renderUniverse(root, "NIFTY50", "NIFTY 50");
      break;
    case "fno":
      renderUniverse(root, "FNO", "F&O Stocks");
      break;
    case "sectors":
      renderSectors(root);
      break;
    case "options":
      Options.render(root);
      break;
    case "levels":
      Levels.renderLevelsPage(root, Market);
      break;
    case "watchlist":
      renderWatchlist(root);
      break;
    case "paper":
      Paper.render(root);
      break;
    case "settings":
      Settings.render(root);
      break;
    case "callback":
      root.innerHTML = `<section class="card callback-card"><p class="kicker">FYERS</p><h1>Completing login</h1><p class="muted">Fetching access token automatically…</p></section>`;
      break;
    case "about":
      renderAbout(root);
      break;
    default:
      renderCommand(root);
  }
}

function boot() {
  const settings = Storage.getSettings();
  document.body.classList.toggle("compact", settings.ui.compact);
  document.body.classList.toggle("no-anim", !settings.ui.animations);
  Auth.finishOAuth();
  Market.init();
  renderShell();
  renderPage();
  paintStatus();
  Market.startTicks(2800);
  Scanner.start();
  WS.connect();
  Alerts.permission();
  setInterval(paintStatus, 1000);
  Market.subscribe(() => {
    if (["index", "dashboard", "nifty50", "fno", "sectors"].includes(PAGE)) {
      if (document.getElementById("modal-root")?.innerHTML) return;
      const pageEl = document.querySelector(".page");
      const y = pageEl?.scrollTop;
      renderPage();
      if (y && pageEl) pageEl.scrollTop = y;
    }
    paintStatus();
  });
  window.addEventListener("nstox:open-detail", (e) => openDetail(e.detail.symbol));
  window.addEventListener("nstox:fyers", () => {
    paintStatus();
    if (PAGE === "settings") renderPage();
  });
  window.addEventListener("nstox:refresh", () => Market.refresh());
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
  });
}

boot();
