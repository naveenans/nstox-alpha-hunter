/**
 * Technical engine — EMA, RSI, ATR, VWAP, RVOL, momentum, candle strength.
 * Pure functions over OHLCV bars: { t, o, h, l, c, v }
 */
export function ema(values, period) {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out = new Array(values.length);
  let prev = values[0];
  out[0] = prev;
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let ag = gain / period;
  let al = loss / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    ag = (ag * (period - 1) + g) / period;
    al = (al * (period - 1) + l) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

export function trueRange(bar, prevClose) {
  return Math.max(bar.h - bar.l, Math.abs(bar.h - prevClose), Math.abs(bar.l - prevClose));
}

export function atr(bars, period = 14) {
  const out = new Array(bars.length).fill(null);
  if (bars.length < 2) return out;
  const trs = new Array(bars.length).fill(0);
  trs[0] = bars[0].h - bars[0].l;
  for (let i = 1; i < bars.length; i++) trs[i] = trueRange(bars[i], bars[i - 1].c);
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += trs[i];
    if (i >= period) sum -= trs[i - period];
    if (i === period - 1) out[i] = sum / period;
    else if (i >= period) out[i] = (out[i - 1] * (period - 1) + trs[i]) / period;
  }
  return out;
}

export function sessionVwap(bars, sessionStartIndex = 0) {
  const out = new Array(bars.length).fill(null);
  let pv = 0;
  let vol = 0;
  for (let i = sessionStartIndex; i < bars.length; i++) {
    const tp = (bars[i].h + bars[i].l + bars[i].c) / 3;
    pv += tp * bars[i].v;
    vol += bars[i].v;
    out[i] = vol ? pv / vol : tp;
  }
  return out;
}

export function typicalPrice(bar) {
  return (bar.h + bar.l + bar.c) / 3;
}

export function rvol(currentVolume, avgVolume) {
  if (!avgVolume) return 0;
  return currentVolume / avgVolume;
}

export function momentum(closes, lookback = 10) {
  const i = closes.length - 1;
  if (i < lookback) return 0;
  return ((closes[i] - closes[i - lookback]) / closes[i - lookback]) * 100;
}

export function candleStrength(bar) {
  const range = bar.h - bar.l;
  if (range <= 0) return 0;
  const body = Math.abs(bar.c - bar.o);
  const dir = bar.c >= bar.o ? 1 : -1;
  const closeLoc = (bar.c - bar.l) / range;
  return dir * (0.6 * (body / range) + 0.4 * (dir > 0 ? closeLoc : 1 - closeLoc));
}

export function last(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i];
  }
  return null;
}

export function findSwings(bars, left = 3, right = 3) {
  const swings = [];
  for (let i = left; i < bars.length - right; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (bars[j].h >= bars[i].h) isHigh = false;
      if (bars[j].l <= bars[i].l) isLow = false;
    }
    if (isHigh) swings.push({ type: "H", i, price: bars[i].h, t: bars[i].t });
    if (isLow) swings.push({ type: "L", i, price: bars[i].l, t: bars[i].t });
  }
  return swings;
}

function lastOf(swings, type) {
  for (let i = swings.length - 1; i >= 0; i--) if (swings[i].type === type) return swings[i];
  return null;
}

export function detectBOS(bars, swings, thresholdPct = 0.05) {
  if (!bars.length) return { bull: false, bear: false, level: null, kind: null };
  const lastBar = bars[bars.length - 1];
  const sh = lastOf(swings, "H");
  const sl = lastOf(swings, "L");
  const bull = sh && lastBar.c > sh.price * (1 + thresholdPct / 100) && lastBar.c > lastBar.o;
  const bear = sl && lastBar.c < sl.price * (1 - thresholdPct / 100) && lastBar.c < lastBar.o;
  if (bull && (!bear || lastBar.c - sh.price >= sl.price - lastBar.c)) {
    return { bull: true, bear: false, level: sh.price, kind: "BULLISH_BOS", swing: sh };
  }
  if (bear) return { bull: false, bear: true, level: sl.price, kind: "BEARISH_BOS", swing: sl };
  return { bull: false, bear: false, level: null, kind: null, swing: null };
}

export function detectCHOCH(bars, swings) {
  if (swings.length < 4) return { bull: false, bear: false };
  const recent = swings.slice(-6);
  const highs = recent.filter((s) => s.type === "H");
  const lows = recent.filter((s) => s.type === "L");
  const last = bars[bars.length - 1];
  const bear =
    highs.length >= 2 && highs[highs.length - 1].price < highs[highs.length - 2].price && lows.length && last.c < lows[lows.length - 1].price;
  const bull =
    lows.length >= 2 && lows[lows.length - 1].price > lows[lows.length - 2].price && highs.length && last.c > highs[highs.length - 1].price;
  return { bull, bear };
}

export function detectFVG(bars) {
  const gaps = [];
  for (let i = 2; i < bars.length; i++) {
    const a = bars[i - 2];
    const c = bars[i];
    if (a.h < c.l) gaps.push({ type: "BULL", low: a.h, high: c.l, i });
    if (a.l > c.h) gaps.push({ type: "BEAR", low: c.h, high: a.l, i });
  }
  return gaps.slice(-8);
}

export function equalLevels(swings, atrVal, kind) {
  const items = swings.filter((s) => s.type === kind);
  const eq = [];
  const tol = Math.max(atrVal * 0.15, items[0] ? items[0].price * 0.0008 : 0);
  for (let i = 1; i < items.length; i++) {
    if (Math.abs(items[i].price - items[i - 1].price) <= tol) {
      eq.push({
        type: kind === "H" ? "EQH" : "EQL",
        price: (items[i].price + items[i - 1].price) / 2,
      });
    }
  }
  return eq;
}

export function detectSweep(bars, swings, atrVal) {
  if (bars.length < 3) return { high: false, low: false };
  const last = bars[bars.length - 1];
  const prevH = lastOf(swings, "H");
  const prevL = lastOf(swings, "L");
  const wickTop = last.h - Math.max(last.o, last.c);
  const wickBot = Math.min(last.o, last.c) - last.l;
  const high = prevH && last.h > prevH.price && last.c < prevH.price && wickTop > atrVal * 0.25;
  const low = prevL && last.l < prevL.price && last.c > prevL.price && wickBot > atrVal * 0.25;
  return { high, low };
}

export function detectDisplacement(bars, atrVal) {
  if (bars.length < 3) return { bull: false, bear: false };
  const last = bars[bars.length - 1];
  const body = Math.abs(last.c - last.o);
  const range = last.h - last.l;
  const strong = body > atrVal * 0.9 && body / Math.max(range, 1e-9) > 0.55;
  return { bull: strong && last.c > last.o, bear: strong && last.c < last.o };
}

export function detectRetest(bars, bos, vwap, ema20, tolerancePct = 0.15) {
  if (!bos || !bos.kind || !bos.level) return { yes: false, side: null };
  const last = bars[bars.length - 1];
  const band = bos.level * (tolerancePct / 100);
  const near = Math.abs(last.c - bos.level) <= Math.max(band, last.c * 0.0015);
  const holdVwap = vwap ? (bos.bull ? last.c >= vwap * 0.998 : last.c <= vwap * 1.002) : true;
  const holdEma = ema20 ? (bos.bull ? last.c >= ema20 * 0.997 : last.c <= ema20 * 1.003) : true;
  const bounce = bos.bull ? last.c > last.o : last.c < last.o;
  const yes = near && holdVwap && (holdEma || bounce);
  return { yes, side: bos.bull ? "BULL" : "BEAR", level: bos.level };
}

export function detectBreakout(bars, levels, rvolNow, regime) {
  const last = bars[bars.length - 1];
  const close = last.c;
  const volOk = rvolNow >= 1.4;
  const pdh = levels.pdh;
  const pdl = levels.pdl;
  const orh = levels.orh;
  const orl = levels.orl;
  const res = levels.r1;
  const sup = levels.s1;
  const pdhBrk = pdh && close > pdh && last.c > last.o;
  const pdlBrk = pdl && close < pdl && last.c < last.o;
  const orbUp = orh && close > orh;
  const orbDn = orl && close < orl;
  const resBrk = res && close > res;
  const supBrk = sup && close < sup;
  const range = bars.slice(-20);
  const hi = Math.max(...range.map((b) => b.h));
  const lo = Math.min(...range.map((b) => b.l));
  const rangeBrk = close > hi * 0.999 || close < lo * 1.001;
  const bull = volOk && (pdhBrk || orbUp || resBrk) && regime !== "BEARISH" && regime !== "STRONG BEARISH";
  const bear = volOk && (pdlBrk || orbDn || supBrk) && regime !== "BULLISH" && regime !== "STRONG BULLISH";
  return {
    yes: bull || bear,
    bull,
    bear,
    pdh: !!pdhBrk,
    pdl: !!pdlBrk,
    orb: !!(orbUp || orbDn),
    range: !!rangeBrk && volOk,
    label: pdhBrk ? "PDH" : pdlBrk ? "PDL" : orbUp || orbDn ? "ORB" : resBrk ? "RES" : supBrk ? "SUP" : rangeBrk ? "RANGE" : null,
  };
}

export function openingRange(bars, sessionStart, minutes = 15, barMinutes = 5) {
  const n = Math.max(1, Math.round(minutes / barMinutes));
  const slice = bars.slice(sessionStart, sessionStart + n);
  if (!slice.length) return { high: null, low: null };
  return { high: Math.max(...slice.map((b) => b.h)), low: Math.min(...slice.map((b) => b.l)) };
}

export function emaAlignment(e9, e20, e50, e200, price) {
  const bull = e9 > e20 && e20 > e50 && price > e20;
  const bear = e9 < e20 && e20 < e50 && price < e20;
  const vs200 = e200 ? (price > e200 ? 1 : -1) : 0;
  if (bull && vs200 >= 0) return { bias: "BULL", label: "EMA Bullish" };
  if (bear && vs200 <= 0) return { bias: "BEAR", label: "EMA Bearish" };
  if (bull) return { bias: "BULL", label: "EMA Mixed-Bull" };
  if (bear) return { bias: "BEAR", label: "EMA Mixed-Bear" };
  return { bias: "NEUTRAL", label: "EMA Mixed" };
}

/**
 * Full snapshot used by scanner / scoring.
 */
export function analyzeBars(bars, settings = {}, extras = {}) {
  const tech = settings.technical || {};
  const structure = settings.structure || {};
  const rsiP = tech.rsiPeriod || 14;
  const atrP = tech.atrPeriod || 14;
  const swingN = structure.swingSensitivity || 3;
  const sessionStart = extras.sessionStart ?? Math.max(0, bars.length - 75);

  const closes = bars.map((b) => b.c);
  const volumes = bars.map((b) => b.v);
  const e9 = ema(closes, tech.ema9 || 9);
  const e20 = ema(closes, tech.ema20 || 20);
  const e50 = ema(closes, tech.ema50 || 50);
  const e100 = ema(closes, tech.ema100 || 100);
  const e200 = ema(closes, Math.min(tech.ema200 || 200, Math.max(20, closes.length - 1)));
  const rsiArr = rsi(closes, rsiP);
  const atrArr = atr(bars, atrP);
  const vwapArr = sessionVwap(bars, sessionStart);
  const avgVol = sma(volumes, 20);
  const lastBar = bars[bars.length - 1];
  const price = lastBar.c;
  const e9v = last(e9);
  const e20v = last(e20);
  const e50v = last(e50);
  const e100v = last(e100);
  const e200v = last(e200);
  const rsiV = last(rsiArr);
  const atrV = last(atrArr) || price * 0.01;
  const vwapV = last(vwapArr) || price;
  const vol = lastBar.v;
  const avgV = last(avgVol) || vol;
  const rvolV = rvol(vol, avgV);
  const mom = momentum(closes, 10);
  const cs = candleStrength(lastBar);
  const swings = findSwings(bars, swingN, swingN);
  const bos = detectBOS(bars, swings, structure.bosThreshold || 0.05);
  const choch = detectCHOCH(bars, swings);
  const fvg = detectFVG(bars);
  const eqh = equalLevels(swings, atrV, "H");
  const eql = equalLevels(swings, atrV, "L");
  const sweep = detectSweep(bars, swings, atrV);
  const disp = detectDisplacement(bars, atrV);
  const align = emaAlignment(e9v, e20v, e50v, e200v, price);
  const prevDay = bars.slice(0, sessionStart);
  const today = bars.slice(sessionStart);
  const pdh = prevDay.length ? Math.max(...prevDay.map((b) => b.h)) : Math.max(...bars.map((b) => b.h));
  const pdl = prevDay.length ? Math.min(...prevDay.map((b) => b.l)) : Math.min(...bars.map((b) => b.l));
  const pdc = prevDay.length ? prevDay[prevDay.length - 1].c : bars[0].c;
  const dayOpen = today.length ? today[0].o : lastBar.o;
  const weekSlice = bars.slice(-Math.min(bars.length, 75 * 5));
  const wh = Math.max(...weekSlice.map((b) => b.h));
  const wl = Math.min(...weekSlice.map((b) => b.l));
  const orb = openingRange(bars, sessionStart, 15, 5);
  const levels = {
    pdh,
    pdl,
    pdc,
    dayOpen,
    weekHigh: wh,
    weekLow: wl,
    orh: orb.high,
    orl: orb.low,
    vwap: vwapV,
    ema20: e20v,
    ema50: e50v,
    ema200: e200v,
  };
  const retest = detectRetest(bars, bos, vwapV, e20v, structure.retestTolerance || 0.15);
  const brk = detectBreakout(bars, { ...levels, r1: extras.r1, s1: extras.s1 }, rvolV, extras.regime);
  const liqHigh = eqh.length > 0 || (swings.filter((s) => s.type === "H").slice(-1)[0]?.price ?? 0);
  const liqLow = eql.length > 0 || (swings.filter((s) => s.type === "L").slice(-1)[0]?.price ?? 0);

  return {
    price,
    bar: lastBar,
    ema9: e9v,
    ema20: e20v,
    ema50: e50v,
    ema100: e100v,
    ema200: e200v,
    rsi: rsiV,
    atr: atrV,
    vwap: vwapV,
    volume: vol,
    avgVolume: avgV,
    rvol: rvolV,
    momentum: mom,
    candle: cs,
    align,
    aboveVwap: price >= vwapV,
    swings,
    bos,
    choch,
    fvg,
    eqh,
    eql,
    sweep,
    displacement: disp,
    retest,
    breakout: brk,
    levels,
    series: { e9, e20, e50, e200, rsi: rsiArr, atr: atrArr, vwap: vwapArr },
    liquidity: {
      high: typeof liqHigh === "number" ? liqHigh : eqh[0]?.price,
      low: typeof liqLow === "number" ? liqLow : eql[0]?.price,
      sweepHigh: sweep.high,
      sweepLow: sweep.low,
      proxy: true,
    },
  };
}
