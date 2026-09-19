import { Candle, MarketQuote, Timeframe } from '../../types/market';
import { providerStatusManager } from './providerStatusManager';

class MarketDataProvider {
  private lastQuote: MarketQuote | null = null;
  private quoteCacheTime = 0;
  private readonly QUOTE_TTL_MS = 500; // 500ms cache to allow 1-second live polling without duplicate calls

  private candleCache: Map<string, { candles: Candle[]; timestamp: number }> = new Map();
  private readonly CANDLE_TTL_MS = 5000; // 5s cache

  public async getQuote(): Promise<MarketQuote> {
    const now = Date.now();
    if (this.lastQuote && now - this.quoteCacheTime < this.QUOTE_TTL_MS) {
      return this.lastQuote;
    }

    const startTime = performance.now();

    // 1. Primary: TradingView Official CFD Scanner for OANDA:XAUUSD
    try {
      const tvRes = await fetch('https://scanner.tradingview.com/cfd/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          symbols: { tickers: ['OANDA:XAUUSD'] },
          columns: ['close', 'open', 'high', 'low', 'change', 'change_abs', 'bid', 'ask', 'volume'],
        }),
      });

      if (tvRes.ok) {
        const tvData = await tvRes.json();
        const d = tvData.data?.[0]?.d;
        if (Array.isArray(d) && d[0] > 0) {
          const price = parseFloat(d[0]);
          const open24h = parseFloat(d[1]) || price;
          const high24h = parseFloat(d[2]) || price;
          const low24h = parseFloat(d[3]) || price;
          const changePercent24h = parseFloat(d[4]) || 0;
          const change24h = parseFloat(d[5]) || 0;
          const bid = parseFloat(d[6]) || (price - 0.25);
          const ask = parseFloat(d[7]) || (price + 0.25);
          const spread = parseFloat((ask - bid).toFixed(2));
          const volume = parseFloat(d[8]) || 0;
          const prevClose = parseFloat((price - change24h).toFixed(2));

          const quote: MarketQuote = {
            symbol: 'OANDA:XAUUSD',
            price,
            bid,
            ask,
            spread,
            timestamp: Date.now(),
            source: 'TradingView OANDA:XAUUSD Live Feed',
            isDelayed: false,
            status: 'LIVE',
            change24h: parseFloat(change24h.toFixed(2)),
            changePercent24h: parseFloat(changePercent24h.toFixed(2)),
            high24h,
            low24h,
            open24h,
            prevClose,
            sessionHigh: high24h,
            sessionLow: low24h,
            volume24h: volume,
          };

          this.lastQuote = quote;
          this.quoteCacheTime = now;

          const latency = Math.round(performance.now() - startTime);
          providerStatusManager.updateLatency('xauusd_feed', latency, 'healthy');

          return quote;
        }
      }
    } catch {
      // Continue to fallback 1
    }

    // 2. Fallback 1: Worker Endpoint /api/quote/xauusd
    try {
      const wRes = await fetch('/api/quote/xauusd');
      if (wRes.ok) {
        const wQuote = await wRes.json();
        if (wQuote && wQuote.price > 0) {
          this.lastQuote = wQuote;
          this.quoteCacheTime = now;
          providerStatusManager.updateLatency('xauusd_feed', Math.round(performance.now() - startTime), 'healthy', 'Worker OANDA:XAUUSD Feed');
          return wQuote;
        }
      }
    } catch {
      // Continue to fallback 2
    }

    // 3. Fallback 2: Gold-API live spot
    try {
      const gRes = await fetch('https://api.gold-api.com/price/XAU');
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.price > 0) {
          const price = parseFloat(gData.price);
          const fallbackQuote: MarketQuote = {
            symbol: 'OANDA:XAUUSD (Gold-API Spot)',
            price,
            bid: price - 0.25,
            ask: price + 0.25,
            spread: 0.5,
            timestamp: Date.now(),
            source: 'Gold-API Spot XAU/USD',
            isDelayed: false,
            status: 'LIVE',
            change24h: 0,
            changePercent24h: 0,
            high24h: price,
            low24h: price,
            open24h: price,
            prevClose: price,
            sessionHigh: price,
            sessionLow: price,
            volume24h: 0,
          };
          this.lastQuote = fallbackQuote;
          this.quoteCacheTime = now;
          providerStatusManager.updateLatency('xauusd_feed', Math.round(performance.now() - startTime), 'healthy', 'Gold-API Spot Feed');
          return fallbackQuote;
        }
      }
    } catch {
      // Continue to fallback 3
    }

    // 4. Fallback 3: Binance PAXG / USDT
    try {
      const [tickerRes, bookRes] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT'),
        fetch('https://api.binance.com/api/v3/ticker/bookTicker?symbol=PAXGUSDT'),
      ]);

      if (tickerRes.ok && bookRes.ok) {
        const ticker = await tickerRes.json();
        const book = await bookRes.json();
        const price = parseFloat(ticker.lastPrice);
        const bid = parseFloat(book.bidPrice);
        const ask = parseFloat(book.askPrice);
        const spread = parseFloat((ask - bid).toFixed(2));
        const high24h = parseFloat(ticker.highPrice);
        const low24h = parseFloat(ticker.lowPrice);
        const open24h = parseFloat(ticker.openPrice);
        const prevClose = parseFloat(ticker.prevClosePrice);
        const change24h = parseFloat(ticker.priceChange);
        const changePercent24h = parseFloat(ticker.priceChangePercent);

        const quote: MarketQuote = {
          symbol: 'OANDA:XAUUSD (Proxy: PAXG)',
          price,
          bid,
          ask,
          spread,
          timestamp: Date.now(),
          source: 'Binance PAXG/USDT Proxy',
          isDelayed: false,
          status: 'LIVE',
          change24h,
          changePercent24h,
          high24h,
          low24h,
          open24h,
          prevClose,
          sessionHigh: high24h,
          sessionLow: low24h,
          volume24h: parseFloat(ticker.volume),
        };

        this.lastQuote = quote;
        this.quoteCacheTime = now;
        providerStatusManager.updateLatency('xauusd_feed', Math.round(performance.now() - startTime), 'degraded', 'Using Binance PAXG Proxy');
        return quote;
      }
    } catch (binanceErr) {
      providerStatusManager.markError('xauusd_feed', String(binanceErr));
      if (this.lastQuote) {
        return { ...this.lastQuote, status: 'STALE' };
      }
      throw binanceErr;
    }

    throw new Error('All Gold price providers failed');
  }

  public async getCandles(timeframe: Timeframe = '5m', limit: number = 200): Promise<Candle[]> {
    const cacheKey = `${timeframe}_${limit}`;
    const cached = this.candleCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CANDLE_TTL_MS) {
      return cached.candles;
    }

    // Ensure we have a current quote for price alignment
    let currentQuote = this.lastQuote;
    if (!currentQuote || now - this.quoteCacheTime > 5000) {
      try {
        currentQuote = await this.getQuote();
      } catch {
        // ignore
      }
    }

    const intervalMap: Record<Timeframe, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1H': '1h',
      '4H': '4h',
      '1D': '1d',
    };
    const interval = intervalMap[timeframe] || '5m';

    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${interval}&limit=${limit}`);
      if (!res.ok) throw new Error(`Binance klines error: ${res.status}`);

      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Invalid klines response format');

      const rawCandles: Candle[] = data.map((item: (string | number)[]) => {
        const time = Math.floor(Number(item[0]) / 1000);
        const open = parseFloat(String(item[1]));
        const high = parseFloat(String(item[2]));
        const low = parseFloat(String(item[3]));
        const close = parseFloat(String(item[4]));
        const volume = parseFloat(String(item[5]));
        const buyVolume = parseFloat(String(item[9]));
        const sellVolume = Math.max(0, volume - buyVolume);

        return {
          time,
          open,
          high,
          low,
          close,
          volume,
          buyVolume,
          sellVolume,
        };
      });

      // Calibrate candle prices so the series aligns 1:1 with OANDA:XAUUSD
      const calibratedCandles = this.calibrateCandlesToSpot(rawCandles, currentQuote);

      this.candleCache.set(cacheKey, { candles: calibratedCandles, timestamp: now });
      return calibratedCandles;
    } catch (err) {
      console.warn('Binance klines failed, attempting Yahoo Finance fallback:', err);
      try {
        const yIntervalMap: Record<Timeframe, { interval: string; range: string }> = {
          '1m': { interval: '1m', range: '1d' },
          '5m': { interval: '5m', range: '5d' },
          '15m': { interval: '15m', range: '5d' },
          '1H': { interval: '60m', range: '1mo' },
          '4H': { interval: '60m', range: '3mo' },
          '1D': { interval: '1d', range: '6mo' },
        };

        const { interval: yInt, range: yRng } = yIntervalMap[timeframe] || { interval: '5m', range: '5d' };
        const yRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${yInt}&range=${yRng}`);
        const yData = await yRes.json();
        const result = yData.chart?.result?.[0];
        if (!result || !result.timestamp) throw new Error('No Yahoo candle data');

        const timestamps = result.timestamp;
        const quotes = result.indicators?.quote?.[0];

        const rawCandles: Candle[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const o = quotes.open?.[i];
          const h = quotes.high?.[i];
          const l = quotes.low?.[i];
          const c = quotes.close?.[i];
          const v = quotes.volume?.[i] || 0;
          if (o !== null && h !== null && l !== null && c !== null && !isNaN(o) && !isNaN(c)) {
            rawCandles.push({
              time: timestamps[i],
              open: parseFloat(o.toFixed(2)),
              high: parseFloat(h.toFixed(2)),
              low: parseFloat(l.toFixed(2)),
              close: parseFloat(c.toFixed(2)),
              volume: v,
              buyVolume: v * 0.5,
              sellVolume: v * 0.5,
            });
          }
        }

        const sliced = rawCandles.slice(-limit);
        const calibrated = this.calibrateCandlesToSpot(sliced, currentQuote);
        this.candleCache.set(cacheKey, { candles: calibrated, timestamp: now });
        return calibrated;
      } catch (fallbackErr) {
        if (cached) return cached.candles;
        throw fallbackErr;
      }
    }
  }

  /**
   * Calibrates raw candles (from Binance PAXG or CME GC=F) to match OANDA:XAUUSD spot price levels
   */
  private calibrateCandlesToSpot(candles: Candle[], quote: MarketQuote | null): Candle[] {
    if (!candles || candles.length === 0 || !quote || quote.price <= 0) {
      return candles;
    }

    const lastCandle = candles[candles.length - 1];
    const offset = quote.price - lastCandle.close;

    // Apply offset so the current candle matches the exact OANDA:XAUUSD price
    const calibrated = candles.map((c, idx) => {
      const isLast = idx === candles.length - 1;
      const cOpen = parseFloat((c.open + offset).toFixed(2));
      const cHigh = parseFloat((c.high + offset).toFixed(2));
      const cLow = parseFloat((c.low + offset).toFixed(2));
      const cClose = isLast ? quote.price : parseFloat((c.close + offset).toFixed(2));

      return {
        ...c,
        open: cOpen,
        high: Math.max(cHigh, cOpen, cClose),
        low: Math.min(cLow, cOpen, cClose),
        close: cClose,
      };
    });

    return calibrated;
  }

  /**
   * Dynamically updates the latest candle in real-time when a new 1-second price tick arrives
   */
  public updateLastCandle(candles: Candle[], currentPrice: number): Candle[] {
    if (!candles || candles.length === 0 || !currentPrice || currentPrice <= 0) {
      return candles;
    }

    const updated = [...candles];
    const lastIdx = updated.length - 1;
    const last = { ...updated[lastIdx] };

    last.close = currentPrice;
    last.high = Math.max(last.high, currentPrice);
    last.low = Math.min(last.low, currentPrice);

    updated[lastIdx] = last;
    return updated;
  }
}

export const marketDataProvider = new MarketDataProvider();
