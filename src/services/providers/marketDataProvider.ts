import { Candle, MarketQuote, Timeframe } from '../../types/market';
import { providerStatusManager } from './providerStatusManager';

class MarketDataProvider {
  private lastQuote: MarketQuote | null = null;
  private quoteCacheTime = 0;
  private readonly QUOTE_TTL_MS = 2500; // 2.5s cache to prevent hammering

  private candleCache: Map<string, { candles: Candle[]; timestamp: number }> = new Map();
  private readonly CANDLE_TTL_MS = 8000; // 8s cache

  public async getQuote(): Promise<MarketQuote> {
    const now = Date.now();
    if (this.lastQuote && now - this.quoteCacheTime < this.QUOTE_TTL_MS) {
      return this.lastQuote;
    }

    const startTime = performance.now();
    try {
      // Primary: Binance PAXG/USDT (1:1 physical gold backed proxy)
      const [tickerRes, bookRes] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT'),
        fetch('https://api.binance.com/api/v3/ticker/bookTicker?symbol=PAXGUSDT'),
      ]);

      if (!tickerRes.ok || !bookRes.ok) {
        throw new Error(`HTTP Error ticker=${tickerRes.status} book=${bookRes.status}`);
      }

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
        source: 'Binance PAXG/USD Spot Proxy',
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

      const latency = Math.round(performance.now() - startTime);
      providerStatusManager.updateLatency('xauusd_feed', latency, 'healthy');

      return quote;
    } catch (err) {
      // Fallback: Yahoo Finance GC=F (CME/COMEX Gold Futures)
      console.warn('Primary Gold feed failed, attempting fallback to Yahoo GC=F:', err);
      try {
        const yRes = await fetch(`/api/yahoo/v8/finance/chart/GC=F?interval=5m&range=1d`).catch(() => fetch(`https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=5m&range=1d`));
        const yData = await yRes.json();
        const meta = yData.chart?.result?.[0]?.meta;
        if (!meta || !meta.regularMarketPrice) {
          throw new Error('Invalid Yahoo response');
        }

        const price = meta.regularMarketPrice;
        const prevClose = meta.previousClose || meta.chartPreviousClose || price;
        const change24h = price - prevClose;
        const changePercent24h = prevClose ? (change24h / prevClose) * 100 : 0;

        const fallbackQuote: MarketQuote = {
          symbol: 'XAUUSD (COMEX GC=F Futures Proxy)',
          price,
          bid: price - 0.2,
          ask: price + 0.2,
          spread: 0.4,
          timestamp: Date.now(),
          source: 'CME/COMEX Gold Futures (GC=F)',
          isDelayed: true,
          status: 'DELAYED',
          change24h: parseFloat(change24h.toFixed(2)),
          changePercent24h: parseFloat(changePercent24h.toFixed(2)),
          high24h: meta.regularMarketDayHigh || price,
          low24h: meta.regularMarketDayLow || price,
          open24h: meta.regularMarketOpen || prevClose,
          prevClose,
          sessionHigh: meta.regularMarketDayHigh || price,
          sessionLow: meta.regularMarketDayLow || price,
        };

        this.lastQuote = fallbackQuote;
        this.quoteCacheTime = now;
        providerStatusManager.updateLatency('xauusd_feed', Math.round(performance.now() - startTime), 'degraded', 'Using CME GC=F Fallback');
        return fallbackQuote;
      } catch (fallbackErr) {
        providerStatusManager.markError('xauusd_feed', String(fallbackErr));
        if (this.lastQuote) {
          return { ...this.lastQuote, status: 'STALE' };
        }
        throw fallbackErr;
      }
    }
  }

  public async getCandles(timeframe: Timeframe = '5m', limit: number = 200): Promise<Candle[]> {
    const cacheKey = `${timeframe}_${limit}`;
    const cached = this.candleCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CANDLE_TTL_MS) {
      return cached.candles;
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

      const candles: Candle[] = data.map((item: (string | number)[]) => {
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

      this.candleCache.set(cacheKey, { candles, timestamp: now });
      return candles;
    } catch (err) {
      console.warn('Binance klines failed, attempting Yahoo Finance fallback:', err);
      // Fallback: Yahoo Finance
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

        const candles: Candle[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const o = quotes.open?.[i];
          const h = quotes.high?.[i];
          const l = quotes.low?.[i];
          const c = quotes.close?.[i];
          const v = quotes.volume?.[i] || 0;
          if (o !== null && h !== null && l !== null && c !== null && !isNaN(o) && !isNaN(c)) {
            candles.push({
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

        const sliced = candles.slice(-limit);
        this.candleCache.set(cacheKey, { candles: sliced, timestamp: now });
        return sliced;
      } catch (fallbackErr) {
        if (cached) return cached.candles;
        throw fallbackErr;
      }
    }
  }
}

export const marketDataProvider = new MarketDataProvider();
