import { describe, expect, it } from 'vitest';
import { CorrelationEngine } from '../src/services/engines/correlationEngine';
import { LiquidityEngine } from '../src/services/engines/liquidityEngine';
import { SessionEngine } from '../src/services/engines/sessionEngine';
import { StructureEngine } from '../src/services/engines/structureEngine';
import { VolatilityEngine } from '../src/services/engines/volatilityEngine';
import { VolumeProfileEngine } from '../src/services/engines/volumeProfileEngine';
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
});
