# Gold Intelligence Terminal (XAUUSD Intraday Market Intelligence)

A free, lightweight, mobile-responsive market-intelligence dashboard built for discretionary day traders focusing on **Gold Spot / U.S. Dollar (OANDA:XAUUSD)**, primarily on the **5-minute timeframe**.

Runs at **$0 infrastructure cost** using public datasets, with complete transparency regarding data sources and limitations.

---

## Key Features

* **Real-time XAUUSD Price Engine**: Continuous live quotes and 5m candles via 1 fine troy oz allocated LBMA physical gold proxy (`PAXG/USDT`) with CME Gold Futures (`GC=F`) fallback.
* **TradingView Integration**: Official `OANDA:XAUUSD` embed on the 5-minute interval with direct "OPEN IN TRADINGVIEW" buttons and timeframe shortcuts (5M, 15M, 1H).
* **Terminal Analytics Chart**: Interactive canvas chart featuring toggleable overlays:
  * Derived Liquidity (PDH, PDL, Asian/London/NY session extremes, EQH/EQL pools)
  * Volume Profile (POC, VAH 70%, VAL 70%)
  * Potential Reaction Zones (Pullback & Reversal zones)
  * Market Structure (BOS, CHOCH, displacement, consolidation)
* **Macro & Correlation Panel**: Live monitoring of DXY, US 10Y Yield, US 2Y Yield Proxy, VIX, COMEX Silver, WTI Crude Oil, USD/JPY, and Gold/Silver Ratio with rolling Pearson correlation matrices (20p, 50p, 100p).
* **Gold Market Regime Engine**: Descriptive synthesis of USD pressure, yield movements, risk sentiment, and volatility (strictly non-predictive, no "buy/sell" hype).
* **Economic Calendar**: Real-time event countdowns for high-impact USD events (CPI, FOMC, NFP, Jobless Claims, PCE) with gold volatility relevance commentary.
* **Gold & Macro News**: Curated news stream with deduplication, category filtering, and relevance classification (CRITICAL, HIGH, MEDIUM, LOW).
* **CFTC Commitments of Traders (COT)**: Weekly institutional positioning reports tracking Managed Money long/short, net change, open interest, and 52-week percentile.
* **Alert Engine**: Multi-condition alerts (Price, BOS/CHOCH, Zone Touch, Volume Spike) with Web Audio chimes, browser push notifications, and optional Telegram bot dispatch.
* **System Diagnostics**: Real-time `/diagnostics` telemetry reporting provider latency, health status, and cache compliance.
* **Mobile First**: Clean institutional dark theme with bottom navigation bar (`Overview`, `Chart`, `Macro`, `News`, `Settings`) optimized for Android and iOS touchscreens.

---

## Tech Stack

* **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Canvas Chart Engine
* **Backend**: Cloudflare Workers, Hono / Worker Router, Cloudflare D1 (SQLite), Cloudflare KV
* **Testing**: Vitest (13 unit tests covering all quantitative engines)

---

## Getting Started

### Prerequisites
* Node.js v18+
* npm

### Installation & Local Run

```bash
# Clone repository
git clone https://github.com/Farhaan-jpg/AllinoneXauusd.git
cd AllinoneXauusd

# Install dependencies
npm install

# Run unit tests
npm run test

# Start development server
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser.

---

## Cloudflare Deployment

### 1. Build the production bundle
```bash
npm run build
```

### 2. Deploy to Cloudflare Workers / Pages
```bash
# Login to Cloudflare (one-time setup)
npx wrangler login

# Deploy Worker & Static Assets
npx wrangler deploy
```

---

## License

MIT License. Designed for discretionary traders.
