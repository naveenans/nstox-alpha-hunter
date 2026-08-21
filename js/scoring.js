/**
 * Transparent confluence scoring. Max 10.
 * Not a probability. Not accuracy. A weighted rule-based score.
 */
import { Storage } from "./storage.js";

export function scoreLabel(score) {
  if (score >= 9) return { key: "VERY_STRONG", text: "VERY STRONG" };
  if (score >= 8) return { key: "HIGH", text: "HIGH CONVICTION" };
  if (score >= 7) return { key: "MODERATE", text: "MODERATE" };
  if (score >= 6) return { key: "WEAK", text: "WEAK" };
  return { key: "NONE", text: "NO TRADE" };
}

function w() {
  return Storage.getSettings().weights;
}

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

export function scoreSymbol(ta, ctx = {}) {
  const weights = w();
  const reasons = [];
  const risks = [];
  const parts = {};

  const regime = ctx.regime || "NEUTRAL";
  const regimeDir = /BULL/.test(regime) ? 1 : /BEAR/.test(regime) ? -1 : 0;
  const price = ta.price;
  const dirHint = ta.align.bias === "BULL" ? 1 : ta.align.bias === "BEAR" ? -1 : ta.aboveVwap ? 1 : -1;

  // Regime 1.0 — alignment with market
  let regimePts = 0.35;
  if (regimeDir === 0) regimePts = 0.45;
  else if ((regimeDir > 0 && dirHint > 0) || (regimeDir < 0 && dirHint < 0)) regimePts = weights.regime;
  else regimePts = 0.1;
  if (/STRONG/.test(regime) && regimeDir === dirHint) regimePts = weights.regime;
  parts.regime = regimePts;
  if (regimeDir === dirHint && regimeDir !== 0) reasons.push(`Market regime ${regime}`);
  else if (regimeDir && regimeDir !== dirHint) risks.push("Against market regime");

  // Trend / EMA 1.0
  let trendPts = 0.25;
  if (ta.align.bias === "BULL" && ta.ema20 > ta.ema50) {
    trendPts = weights.trend;
    reasons.push("EMA20 > EMA50");
  } else if (ta.align.bias === "BEAR" && ta.ema20 < ta.ema50) {
    trendPts = weights.trend;
    reasons.push("EMA20 < EMA50");
  } else if (ta.align.bias !== "NEUTRAL") trendPts = 0.55;
  if (ta.ema200 && ((dirHint > 0 && price > ta.ema200) || (dirHint < 0 && price < ta.ema200))) {
    trendPts = Math.min(weights.trend, trendPts + 0.15);
    reasons.push(dirHint > 0 ? "Price above EMA200" : "Price below EMA200");
  }
  parts.trend = Math.min(weights.trend, trendPts);

  // VWAP 1.0
  let vwapPts = 0.2;
  if (dirHint > 0 && ta.aboveVwap) {
    vwapPts = weights.vwap;
    reasons.push("Above VWAP");
  } else if (dirHint < 0 && !ta.aboveVwap) {
    vwapPts = weights.vwap;
    reasons.push("Below VWAP");
  } else {
    vwapPts = 0.15;
    risks.push("Wrong side of VWAP");
  }
  parts.vwap = vwapPts;

  // Momentum / RSI 1.0
  let momPts = 0.3;
  if (dirHint > 0 && ta.rsi >= 52 && ta.rsi <= 72 && ta.momentum > 0) {
    momPts = weights.momentum;
    reasons.push(`RSI ${ta.rsi.toFixed(0)} · momentum strong`);
  } else if (dirHint < 0 && ta.rsi <= 48 && ta.rsi >= 28 && ta.momentum < 0) {
    momPts = weights.momentum;
    reasons.push(`RSI ${ta.rsi.toFixed(0)} · downside momentum`);
  } else if (ta.rsi > 78) {
    momPts = 0.25;
    risks.push("RSI stretched (overbought)");
  } else if (ta.rsi < 22) {
    momPts = 0.25;
    risks.push("RSI stretched (oversold)");
  } else if ((dirHint > 0 && ta.momentum > 0) || (dirHint < 0 && ta.momentum < 0)) {
    momPts = 0.6;
  }
  parts.momentum = momPts;

  // Volume / RVOL 1.0
  let volPts = 0.2;
  if (ta.rvol >= 2) {
    volPts = weights.volume;
    reasons.push(`RVOL ${ta.rvol.toFixed(1)}x`);
  } else if (ta.rvol >= 1.5) {
    volPts = 0.75;
    reasons.push(`RVOL ${ta.rvol.toFixed(1)}x`);
  } else if (ta.rvol >= 1.1) volPts = 0.45;
  else {
    volPts = 0.1;
    risks.push("Weak volume");
  }
  parts.volume = volPts;

  // BOS 1.0
  let bosPts = 0;
  if ((dirHint > 0 && ta.bos.bull) || (dirHint < 0 && ta.bos.bear)) {
    bosPts = weights.bos;
    reasons.push(ta.bos.bull ? "Bullish BOS" : "Bearish BOS");
  } else if (ta.bos.bull || ta.bos.bear) {
    bosPts = 0.15;
    risks.push("BOS conflicts with trend");
  }
  parts.bos = bosPts;

  // Retest 0.75
  let retestPts = 0;
  if (ta.retest.yes && ((dirHint > 0 && ta.retest.side === "BULL") || (dirHint < 0 && ta.retest.side === "BEAR"))) {
    retestPts = weights.retest;
    reasons.push("Retest confirmed");
  }
  parts.retest = retestPts;

  // Breakout 0.75
  let brkPts = 0;
  if (ta.breakout.yes && ((dirHint > 0 && ta.breakout.bull) || (dirHint < 0 && ta.breakout.bear))) {
    brkPts = weights.breakout;
    reasons.push(`${ta.breakout.label || "Level"} breakout`);
  }
  parts.breakout = brkPts;

  // Liquidity 0.75 — proxies only
  let liqPts = 0.2;
  if ((dirHint > 0 && ta.sweep.low) || (dirHint < 0 && ta.sweep.high)) {
    liqPts = weights.liquidity;
    reasons.push("Liquidity sweep (price/volume proxy)");
  } else if (ta.eqh.length || ta.eql.length) {
    liqPts = 0.4;
  }
  if (ta.displacement.bull && dirHint > 0) liqPts = Math.min(weights.liquidity, liqPts + 0.2);
  if (ta.displacement.bear && dirHint < 0) liqPts = Math.min(weights.liquidity, liqPts + 0.2);
  parts.liquidity = liqPts;

  // R:R 0.75
  const rr = ctx.rr ?? 0;
  let rrPts = 0;
  if (rr >= 2.5) {
    rrPts = weights.rr;
    reasons.push(`R:R 1:${rr.toFixed(1)}`);
  } else if (rr >= 2) {
    rrPts = weights.rr * 0.9;
    reasons.push(`R:R 1:${rr.toFixed(1)}`);
  } else if (rr >= 1.5) rrPts = 0.35;
  else if (rr > 0) {
    rrPts = 0.1;
    risks.push("R:R below 1:2");
  }
  parts.rr = rrPts;

  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  const score = clamp(Math.round(total * 10) / 10, 0, 10);

  if (ta.atr / price > 0.028) risks.push("High ATR — wide stops");
  if (dirHint > 0 && ta.levels.pdh && price > ta.levels.pdh * 0.998) risks.push("Near previous day high");
  if (dirHint < 0 && ta.levels.pdl && price < ta.levels.pdl * 1.002) risks.push("Near previous day low");

  return { score, parts, reasons, risks, dir: dirHint > 0 ? "BUY" : dirHint < 0 ? "SELL" : "NONE", label: scoreLabel(score) };
}

export function decideSignal({ score, dir, rr, ta, regime }) {
  const s = Storage.getSettings().scanner;
  const minScore = s.minScore ?? 8;
  const minRR = s.minRR ?? 2;
  const minRvol = s.minRvol ?? 1.5;

  const choppy = Math.abs(ta.momentum) < 0.15 && ta.rvol < 1.1 && ta.align.bias === "NEUTRAL";
  const weakVol = ta.rvol < minRvol;
  const poorLiq = ta.volume < (ta.avgVolume || 1) * 0.4;
  const conflict =
    (dir === "BUY" && /BEAR/.test(regime)) || (dir === "SELL" && /BULL/.test(regime) && score < 8.5);
  const rrFail = rr < minRR;
  const scoreFail = score < minScore;

  if (choppy) return { signal: "NO TRADE", why: "Choppy / low-quality tape" };
  if (weakVol) return { signal: "NO TRADE", why: "Volume below threshold" };
  if (poorLiq) return { signal: "NO TRADE", why: "Poor liquidity" };
  if (conflict) return { signal: "NO TRADE", why: "Conflicting trend" };
  if (rrFail) return { signal: "NO TRADE", why: "R:R below 1:2" };
  if (scoreFail) return { signal: "NO TRADE", why: "Score below threshold" };

  if (dir === "BUY" && score >= minScore && rr >= minRR) return { signal: "BUY", why: "Bullish confluence" };
  if (dir === "SELL" && score >= minScore && rr >= minRR) return { signal: "SELL", why: "Bearish confluence" };
  return { signal: "NO TRADE", why: "Insufficient confluence" };
}
