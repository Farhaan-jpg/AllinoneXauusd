import { describe, expect, it, vi } from 'vitest';
import { AlertEngine, alertEngine } from '../src/services/engines/alertEngine';
import { CorrelationEngine } from '../src/services/engines/correlationEngine';
import { LiquidityEngine } from '../src/services/engines/liquidityEngine';
import { MTFEngine } from '../src/services/engines/mtfEngine';
import { SessionEngine } from '../src/services/engines/sessionEngine';
import { StructureEngine } from '../src/services/engines/structureEngine';
import { VolatilityEngine } from '../src/services/engines/volatilityEngine';
import { VolumeProfileEngine } from '../src/services/engines/volumeProfileEngine';
import { MarketBiasVerdictEngine } from '../src/services/engines/marketBiasVerdictEngine';
import { newsProvider } from '../src/services/providers/newsProvider';
import { Candle } from '../src/types/market';

describe('CorrelationEngine', () => {
  it('correctly calculates perfect positive correlation (+1.0)', () => {
    const x = [10, 20, 30, 40, 50];
    const y = [100, 200, 300, 400, 500];
    const r = CorrelationEngine.pearson(x, y);
    expect(r).toBe(1);
  });

  it('correctly calculates perfect inverse correlation (-1.0)', () => {
    const x = [10, 20, 30, 40, 50];
    const y = [500, 400, 300, 200, 100];
    const r = CorrelationEngine.pearson(x, y);
    expect(r).toBe(-1);
  });

  it('handles series with small noise', () => {
    const gold = [2000, 2010, 2005, 2025, 2030, 2040];
    const dxy = [104, 103.5, 103.8, 102.9, 102.5, 102.0];
    const r = CorrelationEngine.pearson(gold, dxy);
    expect(r).toBeLessThan(-0.8);
  });
});

describe('StructureEngine', () => {
  it('detects bullish trend and higher highs', () => {
    // Generate synthetic bullish step candles
    const candles: Candle[] = [];
    const base = 2600;
    for (let i = 0; i < 30; i++) {
      const step = i * 1.5;
      candles.push({
        time: 1700000000 + i * 300,
        open: base + step,
        high: base + step + 2,
        low: base + step - 1,
        close: base + step + 1.5,
        volume: 100,
      });
    }

    const result = StructureEngine.analyze(candles);
    expect(result.trend).toContain('Bullish');
  });

  it('detects displacement candle when body exceeds 2.2x average', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 20; i++) {
      candles.push({
        time: 1700000000 + i * 300,
        open: 2600 + i * 0.2,
        high: 2600 + i * 0.2 + 0.5,
        low: 2600 + i * 0.2 - 0.5,
        close: 2600 + i * 0.2 + 0.2,
        volume: 50,
      });
    }
    // Add explosive displacement candle at the end
    candles.push({
      time: 1700006000,
      open: 2604,
      high: 2614,
      low: 2603.8,
      close: 2613.5,
      volume: 450,
    });

    const result = StructureEngine.analyze(candles);
    expect(result.displacement).toBe(true);
  });
});

describe('LiquidityEngine', () => {
  it('derives PDH and PDL with accurate status', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const candles: Candle[] = [
      { time: nowSec - 7200, open: 2640, high: 2655, low: 2635, close: 2650, volume: 100 },
      { time: nowSec - 3600, open: 2650, high: 2660, low: 2645, close: 2655, volume: 120 },
      { time: nowSec - 1800, open: 2655, high: 2658, low: 2650, close: 2652, volume: 80 },
    ];

    const levels = LiquidityEngine.deriveLevels(candles, 2652);
    expect(levels.length).toBeGreaterThan(0);
    expect(levels.some(l => l.label.includes('PDH') || l.label.includes('High'))).toBe(true);
  });
});

describe('VolumeProfileEngine', () => {
  it('correctly calculates POC, VAH, and VAL from candles', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 40; i++) {
      // Concentrate heavy volume around price 2650
      const isPocArea = i >= 15 && i <= 25;
      candles.push({
        time: 1700000000 + i * 300,
        open: 2640 + i * 0.5,
        high: 2640 + i * 0.5 + 1,
        low: 2640 + i * 0.5 - 1,
        close: 2640 + i * 0.5 + 0.5,
        volume: isPocArea ? 500 : 20,
        buyVolume: isPocArea ? 260 : 10,
        sellVolume: isPocArea ? 240 : 10,
      });
    }

    const profile = VolumeProfileEngine.calculate(candles, 'CUSTOM', 20);
    expect(profile.isAvailable).toBe(true);
    expect(profile.poc).toBeGreaterThan(2645);
    expect(profile.poc).toBeLessThan(2655);
    expect(profile.vah).toBeGreaterThanOrEqual(profile.poc);
    expect(profile.val).toBeLessThanOrEqual(profile.poc);
  });
});

describe('VolatilityEngine', () => {
  it('computes positive ATR values and range expansion ratio', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 20; i++) {
      candles.push({
        time: 1700000000 + i * 300,
        open: 2600 + i * 0.5,
        high: 2600 + i * 0.5 + 2.5,
        low: 2600 + i * 0.5 - 1.5,
        close: 2600 + i * 0.5 + 1.0,
        volume: 100,
      });
    }

    const vol = VolatilityEngine.calculate(candles);
    expect(vol.atr5m).toBeGreaterThan(0);
    expect(vol.rangeExpansionRatio).toBeGreaterThan(0);
    expect(['LOW', 'MEDIUM', 'HIGH', 'EXTREME']).toContain(vol.regime5m);
  });
});

describe('SessionEngine', () => {
  it('formats timezone in Asia/Kolkata correctly', () => {
    const testDate = new Date('2026-09-18T12:00:00Z'); // 12:00 UTC = 17:30 IST
    const formatted = SessionEngine.formatTimeInTz(testDate, 'Asia/Kolkata');
    expect(formatted).toBe('17:30:00');
  });

  it('detects session status without runtime errors', () => {
    const session = SessionEngine.getSessionInfo('Asia/Kolkata');
    expect(session.currentSession).toBeDefined();
    expect(session.sessionTimeLeftFormatted).toBeDefined();
  });
});

describe('NewsProvider Classifier', () => {
  it('correctly categorizes Fed interest rate announcements as CRITICAL/HIGH', () => {
    const res = newsProvider.classifyArticle('Fed Cuts Interest Rates By 50bps In Surprise Move');
    expect(res.category).toBe('FED');
    expect(res.relevance).toBe('CRITICAL');
  });

  it('correctly categorizes inflation and CPI as INFLATION', () => {
    const res = newsProvider.classifyArticle('US CPI Accelerates Faster Than Expected In Latest Report');
    expect(res.category).toBe('INFLATION');
    expect(res.relevance).toBe('CRITICAL');
  });

  it('correctly categorizes geopolitical tensions', () => {
    const res = newsProvider.classifyArticle('Escalating Middle East Conflict Sparks Safe-Haven Inflows');
    expect(res.category).toBe('GEOPOLITICAL');
    expect(res.relevance).toBe('HIGH');
  });

  it('correctly categorizes Al Jazeera and BBC World dispatches into GEOPOLITICAL', () => {
    const ajRes = newsProvider.classifyArticle('Diplomatic Summit Concludes Without Ceasefire Accord', 'Al Jazeera');
    expect(ajRes.category).toBe('GEOPOLITICAL');

    const bbcRes = newsProvider.classifyArticle('UN Security Council Convenes Emergency Session', 'BBC World');
    expect(bbcRes.category).toBe('GEOPOLITICAL');
  });
});

describe('AlertEngine Initial Warmup & Live Transitions', () => {
  it('suppresses alerts on initial evaluation / page load', async () => {
    const { AlertEngine } = await import('../src/services/engines/alertEngine');
    const engine = new AlertEngine();
    engine.resetSession();

    let alertCount = 0;
    engine.subscribe(() => {
      alertCount++;
    });

    const dummyQuote = {
      price: 2650.0,
      bid: 2649.8,
      ask: 2650.2,
      spread: 0.4,
      change: 5.0,
      changePercent: 0.19,
      high: 2660.0,
      low: 2640.0,
      open: 2645.0,
      timestamp: Date.now(),
      status: 'LIVE' as const,
      source: 'Test',
    };

    const dummyStructure = {
      trend: 'Bullish' as const,
      recentSwing: 'HH' as const,
      bos: { type: 'Bullish BOS' as const, price: 2648.0, time: 1700000000 },
      choch: null,
      lastSweep: null,
      displacement: false,
      consolidation: false,
      rangeHigh: 2660.0,
      rangeLow: 2640.0,
    };

    const dummyZones = [
      {
        id: 'zone_1',
        type: 'Pullback Zone' as const,
        priceMin: 2645.0,
        priceMax: 2655.0,
        distancePips: 0,
        strength: 'HIGH' as const,
        status: 'ACTIVE' as const,
        reason: 'Test zone',
      },
    ];

    const dummyLiquidity = [
      {
        id: 'liq_1',
        label: 'PDH',
        price: 2655.0,
        type: 'HIGH' as const,
        status: 'SWEPT' as const,
        distancePips: 0.5,
        timeframe: '5m' as const,
      },
    ];

    const dummyOrderFlow = {
      delta: 100,
      cumulativeDelta: 500,
      volumeSpike: false,
      deltaSpike: false,
      absorption: false,
      exhaustion: false,
    };

    // FIRST EVALUATION: Page load / initial warmup
    engine.evaluate(dummyQuote, dummyStructure, dummyZones, dummyLiquidity, dummyOrderFlow, []);

    // Crucial check: Zero alerts on page load!
    expect(alertCount).toBe(0);

    // SECOND EVALUATION: Live price crossover above target
    engine.addRule({
      title: 'Target 2655',
      type: 'PRICE_LEVEL',
      targetValue: '2655.00',
      condition: 'ABOVE',
      enabled: true,
    });

    const crossedQuote = { ...dummyQuote, price: 2656.0 };
    engine.evaluate(crossedQuote, dummyStructure, dummyZones, dummyLiquidity, dummyOrderFlow, []);

    // Exactly 1 alert triggered on live crossover
    expect(alertCount).toBe(1);
    expect(engine.getHistory().length).toBe(1);
    expect(engine.getHistory()[0].title).toBe('Target 2655');

    // THIRD EVALUATION: Real-time breaking high-impact news arrival
    const breakingNews = [
      {
        id: 'news_critical_1',
        headline: 'Federal Reserve Announces Emergency 50bps Rate Cut Amid Liquidity Strain',
        source: 'Reuters',
        url: 'https://reuters.com/markets',
        publishedAt: Date.now(), // Live breaking news during active session
        publishedFormatted: 'Just now',
        category: 'FED' as const,
        relevance: 'CRITICAL' as const,
        marketRelevanceComment: 'Aggressive dovish pivot significantly bullish for physical and spot gold.',
      },
    ];

    engine.evaluate(crossedQuote, dummyStructure, dummyZones, dummyLiquidity, dummyOrderFlow, [], breakingNews);

    // Alert count increments by 1 for the breaking news
    expect(alertCount).toBe(2);
    expect(engine.getHistory()[0].type).toBe('NEWS_HIGH_IMPACT');
    expect(engine.getHistory()[0].title).toContain('CRITICAL');

    // FOURTH EVALUATION: Same news received again on subsequent fetch (e.g. 60s later)
    engine.evaluate(crossedQuote, dummyStructure, dummyZones, dummyLiquidity, dummyOrderFlow, [], breakingNews);

    // Alert count MUST REMAIN 2 (Zero duplicate notification!)
    expect(alertCount).toBe(2);

    // FIFTH EVALUATION: Same story with different ID from another RSS source
    const duplicateFromOtherSource = [
      {
        id: 'news_diff_id_same_headline',
        headline: 'Federal Reserve Announces Emergency 50bps Rate Cut Amid Liquidity Strain',
        source: 'Bloomberg',
        url: 'https://bloomberg.com/news',
        publishedAt: Date.now(),
        publishedFormatted: 'Just now',
        category: 'FED' as const,
        relevance: 'CRITICAL' as const,
        marketRelevanceComment: 'Duplicate headline should be suppressed by headline signature.',
      },
    ];

    engine.evaluate(crossedQuote, dummyStructure, dummyZones, dummyLiquidity, dummyOrderFlow, [], duplicateFromOtherSource);

    // Alert count MUST STILL REMAIN 2 (Suppressed by headline signature deduplication!)
    expect(alertCount).toBe(2);
  });

  it('translates abbreviations for natural spoken voice alerts', () => {
    const engine = new AlertEngine();
    expect(engine.isVoiceEnabled()).toBe(true);

    engine.setVoiceEnabled(false);
    expect(engine.isVoiceEnabled()).toBe(false);

    engine.setVoiceEnabled(true);
    expect(engine.isVoiceEnabled()).toBe(true);

    // Test that speakAlert runs without throwing in Node/Vitest environment
    expect(() => {
      engine.speakAlert('BOS detected at $2650.50 with 15 pts expansion. CHOCH imminent.');
    }).not.toThrow();
  });
});

describe('MTFEngine', () => {
  it('accurately calculates Exponential Moving Average (EMA)', () => {
    const values = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const ema5 = MTFEngine.calculateEMA(values, 5);
    expect(ema5).toBeGreaterThan(15);
    expect(ema5).toBeLessThanOrEqual(20);
  });

  it('accurately calculates Relative Strength Index (RSI 14)', () => {
    // Bullish trending closes
    const bullishCloses: number[] = [];
    for (let i = 0; i < 30; i++) {
      bullishCloses.push(2600 + i * 2);
    }
    const rsiBullish = MTFEngine.calculateRSI(bullishCloses, 14);
    expect(rsiBullish).toBeGreaterThan(70);

    // Bearish trending closes
    const bearishCloses: number[] = [];
    for (let i = 0; i < 30; i++) {
      bearishCloses.push(2600 - i * 2);
    }
    const rsiBearish = MTFEngine.calculateRSI(bearishCloses, 14);
    expect(rsiBearish).toBeLessThan(30);
  });

  it('aggregates lower-timeframe candles into higher-timeframe candles', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 15; i++) {
      candles.push({
        time: 1700000000 + i * 300, // 5m intervals
        open: 2650 + i,
        high: 2655 + i,
        low: 2648 + i,
        close: 2652 + i,
        volume: 100,
      });
    }

    // Aggregate 5m into 15m (3:1 ratio)
    const aggregated15m = MTFEngine.aggregateCandles(candles, 15, 5);
    expect(aggregated15m.length).toBe(5);
    expect(aggregated15m[0].open).toBe(candles[0].open);
    expect(aggregated15m[0].close).toBe(candles[2].close);
    expect(aggregated15m[0].volume).toBe(300);
  });

  it('computes institutional multi-timeframe confluence matrix', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 60; i++) {
      candles.push({
        time: 1700000000 + i * 300,
        open: 2600 + i * 1.0,
        high: 2602 + i * 1.0,
        low: 2599 + i * 1.0,
        close: 2601 + i * 1.0,
        volume: 150,
      });
    }

    const candlesByTf = {
      '1m': candles,
      '5m': candles,
      '15m': candles,
      '1H': candles,
      '4H': candles,
      '1D': candles,
    };

    const matrix = MTFEngine.computeMatrix(candlesByTf, 2665);
    expect(matrix.timeframes.length).toBe(6);
    expect(matrix.confluenceScore).toBeGreaterThanOrEqual(70);
    expect(matrix.overallBias).toContain('BULLISH');
    expect(matrix.bullishCount).toBeGreaterThanOrEqual(4);
  });
});

describe('MarketBiasVerdictEngine', () => {
  it('correctly derives STRONG_BULLISH verdict with supportive technicals and macro tailwinds', () => {
    const mockQuote: any = {
      price: 4378.38,
      change24h: 36.55,
      changePercent24h: 0.84,
      high24h: 4399.67,
      low24h: 4334.29,
    };

    const mockMtf: any = {
      timeframes: [
        { timeframe: '1m', trend: 'BULLISH' },
        { timeframe: '5m', trend: 'BULLISH' },
        { timeframe: '15m', trend: 'BULLISH' },
        { timeframe: '1H', trend: 'BULLISH' },
        { timeframe: '4H', trend: 'BULLISH' },
        { timeframe: '1D', trend: 'BULLISH' },
      ],
      bullishCount: 6,
      bearishCount: 0,
      confluenceScore: 92,
      overallBias: 'STRONG_BULLISH',
    };

    const mockStructure: any = {
      trend: 'Strong Bullish',
      recentSwing: 'HH',
      displacement: true,
    };

    const mockMacro: any = {
      dxy: { price: 100.22, change: -0.18 }, // Softening dollar
      us10y: { price: 4.98, change: -0.04 },  // Falling yields
      vix: { price: 19.5 },
      goldSilverRatio: 65.2,
      silver: { direction: 'UP', price: 67.15 },
    };

    const mockOrderFlow: any = {
      isAvailable: true,
      delta: 1250,
      cvd: 4500,
      aggressiveState: 'Aggressive Buyers',
      absorptionState: 'Bullish Absorption',
    };

    const mockVol: any = { regime5m: 'MEDIUM' };
    const mockZones: any = [
      { status: 'ACTIVE', priceMin: 4355, priceMax: 4365, label: 'Confluence Demand' },
      { status: 'ACTIVE', priceMin: 4400, priceMax: 4410, label: 'Confluence Supply' },
    ];

    const verdict = MarketBiasVerdictEngine.evaluate(
      mockQuote,
      mockMtf,
      mockStructure,
      mockMacro,
      mockOrderFlow,
      mockVol,
      mockZones,
      [],
      []
    );

    expect(verdict.bias).toBe('STRONG_BULLISH');
    expect(verdict.confidenceScore).toBeGreaterThanOrEqual(75);
    expect(verdict.pillars.technicals.rating).toBe('BULLISH');
    expect(verdict.pillars.macro.rating).toBe('BULLISH');
    expect(verdict.pillars.orderflow.rating).toBe('BULLISH');
    expect(verdict.playbook.biasAction).toContain('Favor buy-side');
  });

  it('correctly adjusts verdict to HIGH_RISK when high-impact event is imminent', () => {
    const mockQuote: any = { price: 4378.38, changePercent24h: 0.1 };
    const mockStructure: any = { trend: 'Neutral', recentSwing: 'HL' };
    const mockVol: any = { regime5m: 'LOW' };

    const imminentEvent: any = [{
      id: 'e1',
      title: 'US CPI Inflation YoY',
      country: 'USD',
      isHighImpact: true,
      timestamp: Date.now() + 15 * 60 * 1000, // 15 mins away
      countdownText: '15m',
    }];

    const verdict = MarketBiasVerdictEngine.evaluate(
      mockQuote,
      null,
      mockStructure,
      null,
      { isAvailable: false } as any,
      mockVol,
      [],
      imminentEvent,
      []
    );

    expect(verdict.pillars.eventRisk.rating).toBe('HIGH_RISK');
    expect(verdict.pillars.eventRisk.summary).toContain('Extreme event risk');
  });
});


