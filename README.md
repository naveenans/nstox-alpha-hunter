# NSTOX ALPHA HUNTER

**Find High-Conviction Intraday Setups**

A static, HTML-only market scanner for manual intraday traders. Open `index.html` (or GitHub Pages) — no Node, no backend, no build step.

Hunter answers one question on the first screen:

> What are the best intraday setups right now?

It scores names with a transparent confluence checklist and **prefers NO TRADE** over a weak print.

## What this is

- Rule-based technical scanner (VWAP, EMA, RSI, ATR, RVOL, BOS, retest, breakout, liquidity **proxies**)
- BUY / SELL / NO TRADE engine with a minimum 1:2 R:R
- Intraday levels, ATR stops, options finder, watchlists, alerts
- FYERS v3 client architecture + demo mode when disconnected
- LocalStorage only — nothing is sent to a NSTOX server

## What this is not

- Not a broker, not an order router, not investment advice
- Not “95% accurate”, not a sure shot, not a guaranteed profit
- Liquidity / BOS labels are **price/volume-based proxies**. The engine cannot see institutional orders.

> Nstox Alpha Hunter is a technical-analysis and market-scanning tool for educational and decision-support purposes. It does not guarantee profits, accuracy, or successful trades. Trading involves substantial risk. Users are solely responsible for their trading and investment decisions.

## Open it

1. Clone or download this folder.
2. Open `index.html` in a modern browser **or** serve the folder with any static host.
3. Demo data loads immediately. Look for the **DEMO MODE** badge.

### GitHub Pages (this repo)

Live site after Pages is enabled:

**https://naveenans.github.io/nstox-alpha-hunter/**

1. Open [github.com/naveenans/nstox-alpha-hunter](https://github.com/naveenans/nstox-alpha-hunter)
2. **Settings → Pages**
3. Under **Build and deployment → Source**, choose **Deploy from a branch**
4. Branch: **main** · Folder: **/ (root)** · **Save**
5. Wait 1–2 minutes, then open the Pages URL above

Optional: drag `nstox-alpha-logo.png` into `assets/` on GitHub if you want the coin photo instead of the SVG mark.

Do not point Pages at a localhost URL. There is no server to run. Never commit FYERS tokens.

## FYERS configuration

Settings → **FYERS API connection**

| Field | Notes |
| --- | --- |
| App ID | From [FYERS API dashboard](https://myapi.fyers.in/dashboard/) |
| Secret ID | From the same FYERS app. Stored on this device only. Never committed. |
| Redirect URI | Copy the value shown in Settings into the FYERS app (exact match). Default is `callback.html` on this origin. |
| PIN | Optional 4-digit FYERS PIN — used only to auto-refresh the daily access token |
| Access Token | Filled automatically after Login with FYERS |
| Environment | Live or sandbox |

### Login flow (automatic token)

1. Create an API app at [myapi.fyers.in](https://myapi.fyers.in/dashboard/).
2. Copy **Redirect URI** from Hunter Settings into that FYERS app.
3. Enter **App ID** and **Secret ID**.
4. Click **Login with FYERS**.
5. After you approve access, Hunter exchanges the auth code (`SHA-256(appId:secretId)`) and **saves the access token automatically**.

Buttons: Login with FYERS · Connect · Disconnect · Test connection · Refresh data · Save / Clear / Reset

### OAuth and live quotes

Token exchange and market data go through Hunter’s same-origin proxy (`/api/fyers/*`) so the browser is not blocked by FYERS CORS.

- **This live preview** includes the proxy — OAuth should complete here.
- **GitHub Pages is static** — the browser cannot talk to FYERS directly. Use this preview for live login, or serve the folder with `server.py`.

The FYERS secret is sent only to Hunter’s proxy to build `appIdHash`. It is not logged and not written to the repo.

Do **not** use Hunter on a shared/public computer with a live Secret ID or token.

### Endpoints used (FYERS API v3)

| Action | URL |
| --- | --- |
| Auth code | `https://api-t1.fyers.in/api/v3/generate-authcode` |
| Token (backend only) | `https://api-t1.fyers.in/api/v3/validate-authcode` |
| Profile | `https://api-t1.fyers.in/api/v3/profile` |
| Quotes | `https://api-t1.fyers.in/data/quotes` |
| History | `https://api-t1.fyers.in/data/history` |
| Depth | `https://api-t1.fyers.in/data/depth` |
| Option chain | `https://api-t1.fyers.in/data/options-chain-v3` |
| Market status | `https://api-t1.fyers.in/data/marketStatus` |
| Data socket | `wss://api-t1.fyers.in/socket/v2/dataSock` |

Header: `Authorization: <APP_ID>:<ACCESS_TOKEN>`

## Demo mode

If FYERS is disconnected, CORS fails, or the token is empty, Hunter uses realistic demo tapes for NIFTY, Bank Nifty, Sensex, India VIX, NIFTY 50, selected F&O names and a synthetic option chain. The **DEMO MODE** / **DEMO DATA** labels stay visible so demo is never confused with live.

## Scanner logic

Universe: NIFTY 50 · NIFTY 500 · F&O · Watchlist

Default **BUY**

- Score ≥ 8
- R:R ≥ 1:2
- Bullish confluence
- No major bearish conflict

Default **SELL** — mirror of the above.

**NO TRADE** if score, R:R, volume, liquidity, regime or structure disagree, the tape is choppy, or the cash market is closed (unless Analysis mode is on).

IST hours: Pre-market 09:00–09:15 · Open 09:15–15:30 · otherwise closed.

## Scoring (max 10)

| Sleeve | Default weight |
| --- | --- |
| Market regime | 1.0 |
| Trend / EMA | 1.0 |
| VWAP | 1.0 |
| Momentum / RSI | 1.0 |
| Volume / RVOL | 1.0 |
| BOS | 1.0 |
| Retest | 0.75 |
| Breakout | 0.75 |
| Liquidity proxy | 0.75 |
| Risk / Reward | 0.75 |

9.0–10 VERY STRONG · 8.0–8.9 HIGH CONVICTION · 7.0–7.9 MODERATE · 6.0–6.9 WEAK · below 6 NO TRADE

Every weight is editable in Settings.

## Risk

- BUY stop = Entry − ATR × multiplier (default 1.2)
- SELL stop = Entry + ATR × multiplier
- Targets from ATR, pivots, previous day high/low
- Minimum planned R:R 1:2

## Alerts

Browser notification + optional tone when score, BUY/SELL, BOS, breakout, VWAP, RVOL or a liquidity sweep fire. **No orders are sent.**

## Local storage keys

`nstox_settings` · `nstox_watchlist` · `nstox_fyers_token` (non-secret config only)

Export / import / reset live on the Settings page.

## Security

- Never commit access tokens
- Never put `const secretId = "..."` in this repo
- Clear tokens before leaving a machine

## Disclaimer

Nstox Alpha Hunter is a technical-analysis and market-scanning tool for educational and decision-support purposes. It does not guarantee profits, accuracy, or successful trades. Trading involves substantial risk. Users are solely responsible for their trading and investment decisions.

**Confluence > indicator count. Quality > quantity. Risk management > signal frequency. NO TRADE > a weak trade.**
