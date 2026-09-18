import { ProviderHealth } from '../../types/market';

type HealthListener = (health: Record<string, ProviderHealth>) => void;

class ProviderStatusManager {
  private healthMap: Map<string, ProviderHealth> = new Map();
  private listeners: Set<HealthListener> = new Set();

  constructor() {
    this.initDefaultProviders();
  }

  private initDefaultProviders() {
    this.setHealth('xauusd_feed', {
      id: 'xauusd_feed',
      name: 'XAUUSD Gold Price Feed',
      category: 'Market Data',
      status: 'healthy',
      latencyMs: 120,
      lastUpdated: Date.now(),
      endpoint: 'api.binance.com/klines (PAXG/USDT 1oz Spot Gold Proxy)',
      attribution: 'Binance Spot PAXG / CME GC=F Fallback',
    });

    this.setHealth('tradingview_widget', {
      id: 'tradingview_widget',
      name: 'TradingView OANDA:XAUUSD',
      category: 'Chart Reference',
      status: 'healthy',
      latencyMs: 50,
      lastUpdated: Date.now(),
      endpoint: 'TradingView Advanced Chart (OANDA:XAUUSD)',
      attribution: 'OANDA via TradingView Official Widget',
    });

    this.setHealth('macro_feed', {
      id: 'macro_feed',
      name: 'Macro Assets (DXY, US10Y, VIX, Silver, Oil)',
      category: 'Macro Data',
      status: 'healthy',
      latencyMs: 210,
      lastUpdated: Date.now(),
      endpoint: 'query1.finance.yahoo.com/v8/finance/chart',
      attribution: 'Yahoo Finance Market Data',
    });

    this.setHealth('calendar_feed', {
      id: 'calendar_feed',
      name: 'Economic Calendar',
      category: 'Events',
      status: 'healthy',
      latencyMs: 180,
      lastUpdated: Date.now(),
      endpoint: 'nfs.faireconomy.media/ff_calendar_thisweek.json',
      attribution: 'ForexFactory Public Calendar',
    });

    this.setHealth('news_feed', {
      id: 'news_feed',
      name: 'Gold & Central Bank News RSS',
      category: 'News Aggregator',
      status: 'healthy',
      latencyMs: 250,
      lastUpdated: Date.now(),
      endpoint: 'feeds.finance.yahoo.com/rss/2.0/headline',
      attribution: 'Yahoo Finance & Federal Reserve RSS',
    });

    this.setHealth('cftc_cot', {
      id: 'cftc_cot',
      name: 'CFTC Commitments of Traders (COT)',
      category: 'Positioning',
      status: 'healthy',
      latencyMs: 340,
      lastUpdated: Date.now(),
      endpoint: 'publicreporting.cftc.gov/resource/jun7-fc8e.json',
      attribution: 'U.S. Commodity Futures Trading Commission (Weekly)',
    });

    this.setHealth('order_flow', {
      id: 'order_flow',
      name: 'Order Flow Delta & CVD',
      category: 'Order Flow',
      status: 'healthy',
      latencyMs: 95,
      lastUpdated: Date.now(),
      endpoint: 'Taker Volume Delta (PAXG/USDT Proxy)',
      attribution: '1oz LBMA Physical Gold Market Proxy',
    });
  }

  public setHealth(id: string, health: ProviderHealth) {
    this.healthMap.set(id, health);
    this.notify();
  }

  public updateLatency(id: string, latencyMs: number, status: ProviderHealth['status'] = 'healthy', details?: string) {
    const existing = this.healthMap.get(id);
    if (existing) {
      this.healthMap.set(id, {
        ...existing,
        latencyMs,
        status,
        lastUpdated: Date.now(),
        details: details ?? existing.details,
      });
      this.notify();
    }
  }

  public markError(id: string, error: string) {
    const existing = this.healthMap.get(id);
    if (existing) {
      this.healthMap.set(id, {
        ...existing,
        status: 'degraded',
        details: error,
        lastUpdated: Date.now(),
      });
      this.notify();
    }
  }

  public getAll(): ProviderHealth[] {
    return Array.from(this.healthMap.values());
  }

  public subscribe(listener: HealthListener): () => void {
    this.listeners.add(listener);
    listener(this.toObject());
    return () => this.listeners.delete(listener);
  }

  private toObject(): Record<string, ProviderHealth> {
    const obj: Record<string, ProviderHealth> = {};
    this.healthMap.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  }

  private notify() {
    const obj = this.toObject();
    this.listeners.forEach(fn => fn(obj));
  }
}

export const providerStatusManager = new ProviderStatusManager();
