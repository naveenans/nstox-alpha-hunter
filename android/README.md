# NSTOX ALPHA Android

Screenshot-first Android dashboard for market groups/channels.

## Screens
- Global Indices
- Indian Indices
- Top Gainers & Losers
- FII & DII
- Block & Bulk Deals
- Volume Shockers
- Near / Fresh 52-week High Breakouts
- AI News

Every screen displays NSTOX ALPHA branding and is designed to fit cleanly into shareable screenshots.

## Data architecture
Use provider adapters behind one normalized repository. Do not hard-code exchange scraping into the Android client.

Suggested free/low-cost bootstrap:
1. Alpha Vantage: global indices and supported BSE symbols; free key available, with rate limits.
2. Twelve Data: optional second adapter for global markets; Basic plan is rate/market limited.
3. Exchange/public disclosures: FII/DII, block/bulk deals and corporate announcements should be ingested by a backend only where the source's terms permit it.
4. Scanner calculations: volume shockers and 52-week breakout distance should be calculated from licensed/permitted OHLCV data, not copied from third-party screeners.

## AI news pipeline
Public/authorized sources only:
RSS / official exchange announcements / company filings / approved news APIs / user-configured social APIs
→ normalize
→ remove duplicates
→ map tickers/entities
→ source credibility score
→ sentiment + event classification
→ concise summary
→ retain original source URL + timestamp.

Never represent an unsourced social post as confirmed news. Mark social-only items as UNVERIFIED until corroborated.

## Secrets
Never commit API keys. Use local.properties for development or GitHub Actions secrets for CI.

Expected secret for current workflow:
`ALPHA_VANTAGE_KEY`

## Build
From the repository root:
`gradle -p android :app:assembleDebug`

APK output:
`android/app/build/outputs/apk/debug/app-debug.apk`
