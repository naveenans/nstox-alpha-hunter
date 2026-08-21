/**
 * TradingView Lightweight Charts wrapper (CDN global: LightweightCharts).
 */
import { inr } from "./storage.js";

let chart;
let series;
let vwapLine;
let ema20Line;
let ema50Line;
let priceLines = [];

export function renderChart(container, row, tf = "5") {
  container.innerHTML = "";
  if (!window.LightweightCharts) {
    container.innerHTML = `<div class="empty">Chart library unavailable</div>`;
    return;
  }
  const LC = window.LightweightCharts;
  chart = LC.createChart(container, {
    layout: {
      background: { color: "#0a0a0b" },
      textColor: "#b8b3a6",
      fontFamily: "IBM Plex Mono, ui-monospace, monospace",
    },
    grid: {
      vertLines: { color: "rgba(201,162,39,0.06)" },
      horzLines: { color: "rgba(201,162,39,0.06)" },
    },
    rightPriceScale: { borderColor: "rgba(201,162,39,0.18)" },
    timeScale: { borderColor: "rgba(201,162,39,0.18)", timeVisible: true },
    crosshair: { vertLine: { color: "rgba(201,162,39,0.4)" }, horzLine: { color: "rgba(201,162,39,0.4)" } },
    autoSize: true,
  });
  series = chart.addCandlestickSeries({
    upColor: "#3dba7e",
    downColor: "#d35b5b",
    borderUpColor: "#3dba7e",
    borderDownColor: "#d35b5b",
    wickUpColor: "#3dba7e",
    wickDownColor: "#d35b5b",
  });
  const bars = downsample(row.bars, tf);
  series.setData(
    bars.map((b) => ({
      time: Math.floor(b.t / 1000),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
    })),
  );
  vwapLine = chart.addLineSeries({ color: "#e4c56a", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
  ema20Line = chart.addLineSeries({ color: "#7aa2ff", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
  ema50Line = chart.addLineSeries({ color: "#8a9bb0", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
  const vwap = row.ta.series.vwap;
  const e20 = row.ta.series.e20;
  const e50 = row.ta.series.e50;
  vwapLine.setData(row.bars.map((b, i) => ({ time: Math.floor(b.t / 1000), value: vwap[i] || b.c })).filter((d) => d.value));
  ema20Line.setData(row.bars.map((b, i) => ({ time: Math.floor(b.t / 1000), value: e20[i] })).filter((d) => d.value));
  ema50Line.setData(row.bars.map((b, i) => ({ time: Math.floor(b.t / 1000), value: e50[i] })).filter((d) => d.value));

  addPrice(series, row.plan.entry, "#e4c56a", "ENTRY " + inr(row.plan.entry));
  addPrice(series, row.plan.sl, "#d35b5b", "SL " + inr(row.plan.sl));
  addPrice(series, row.plan.t1, "#3dba7e", "T1 " + inr(row.plan.t1));
  addPrice(series, row.plan.t2, "#2f9e6a", "T2 " + inr(row.plan.t2));
  if (row.ta.levels.pdh) addPrice(series, row.ta.levels.pdh, "#8a8478", "PDH");
  if (row.ta.levels.pdl) addPrice(series, row.ta.levels.pdl, "#8a8478", "PDL");
  if (row.ta.bos.level) {
    series.setMarkers([
      {
        time: Math.floor(row.bars[row.bars.length - 1].t / 1000),
        position: row.ta.bos.bull ? "belowBar" : "aboveBar",
        color: row.ta.bos.bull ? "#3dba7e" : "#d35b5b",
        shape: row.ta.bos.bull ? "arrowUp" : "arrowDown",
        text: "BOS",
      },
    ]);
  }
  chart.timeScale().fitContent();
}

function addPrice(s, price, color, title) {
  if (!s || !price) return;
  const line = s.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, title, axisLabelVisible: true });
  priceLines.push(line);
}

function downsample(bars, tf) {
  const map = { "1": 1, "3": 1, "5": 1, "15": 3, "30": 6, "60": 12, "1H": 12, "1D": 75 };
  const n = map[tf] || 1;
  if (n === 1) return bars;
  const out = [];
  for (let i = 0; i < bars.length; i += n) {
    const slice = bars.slice(i, i + n);
    out.push({
      t: slice[0].t,
      o: slice[0].o,
      h: Math.max(...slice.map((b) => b.h)),
      l: Math.min(...slice.map((b) => b.l)),
      c: slice[slice.length - 1].c,
      v: slice.reduce((a, b) => a + b.v, 0),
    });
  }
  return out;
}

export function renderTechnicalsPage(root, Market) {
  const rows = Market.getUniverse("FNO");
  const sel = Market.getSelected() || rows[0];
  root.innerHTML = `
    <div class="page-head">
      <div>
        <p class="kicker">Structure + indicators</p>
        <h1>Technicals</h1>
      </div>
      <div class="row-gap">
        <select id="tech-sym">${rows.map((r) => `<option ${r.symbol === sel.symbol ? "selected" : ""}>${r.symbol}</option>`).join("")}</select>
        <div class="tf-bar" id="tf-bar">
          ${["1", "3", "5", "15", "30", "1H", "1D"].map((t) => `<button data-tf="${t}" class="${t === "5" ? "on" : ""}">${t}m</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="chart-box" id="chart-box"></div>
    <div class="tech-stats" id="tech-stats"></div>
  `;
  const box = root.querySelector("#chart-box");
  const stats = root.querySelector("#tech-stats");
  let tf = "5";

  function paint() {
    const row = Market.get(root.querySelector("#tech-sym").value);
    Market.select(row.symbol);
    renderChart(box, row, tf);
    const t = row.ta;
    stats.innerHTML = [
      ["LTP", inr(row.ltp)],
      ["VWAP", inr(t.vwap)],
      ["EMA20", inr(t.ema20)],
      ["EMA50", inr(t.ema50)],
      ["EMA200", inr(t.ema200)],
      ["RSI", t.rsi?.toFixed(1)],
      ["ATR", inr(t.atr, 2)],
      ["RVOL", t.rvol.toFixed(2) + "x"],
      ["BOS", t.bos.kind || "—"],
      ["Retest", t.retest.yes ? "YES" : "NO"],
    ]
      .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
      .join("");
  }
  root.querySelector("#tech-sym").onchange = paint;
  root.querySelector("#tf-bar").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    tf = b.dataset.tf;
    root.querySelectorAll("#tf-bar button").forEach((x) => x.classList.toggle("on", x === b));
    paint();
  };
  paint();
}

export const Charts = { renderChart, renderTechnicalsPage };
