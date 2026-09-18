import { Candle, VolatilityState } from '../../types/market';

export class VolatilityEngine {
  /**
   * Calculates ATR, range expansion ratio, and multi-timeframe volatility regimes
   */
  public static calculate(candles: Candle[], high24h?: number, low24h?: number): VolatilityState {
    if (!candles || candles.length < 15) {
      return {
        atr5m: 1.8,
        atr15m: 3.2,
        atr1h: 6.5,
        atrDaily: 18.0,
        regime5m: 'MEDIUM',
        regime1h: 'MEDIUM',
        current5mRange: 1.8,
        avg5mRange: 1.8,
        rangeExpansionRatio: 1.0,
        percentile: 50,
      };
    }

    // 1. Calculate True Ranges for 5m candles
    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i - 1];
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close)
      );
      trueRanges.push(tr);
    }

    const period14 = trueRanges.slice(-14);
    const atr5m = period14.reduce((a, b) => a + b, 0) / Math.max(1, period14.length);

    // Current candle range vs average range
    const currentCandle = candles[candles.length - 1];
    const current5mRange = currentCandle.high - currentCandle.low;
    const avg5mRange = atr5m;
    const rangeExpansionRatio = avg5mRange > 0 ? current5mRange / avg5mRange : 1.0;

    // Multi-timeframe approximations from 5m base
    const atr15m = atr5m * Math.sqrt(3);
    const atr1h = atr5m * Math.sqrt(12);
    const dailyRange = high24h && low24h ? high24h - low24h : atr5m * Math.sqrt(72);
    const atrDaily = dailyRange;

    // Classify 5m regime
    let regime5m: VolatilityState['regime5m'] = 'MEDIUM';
    if (atr5m < 1.0) regime5m = 'LOW';
    else if (atr5m <= 2.2) regime5m = 'MEDIUM';
    else if (atr5m <= 3.8) regime5m = 'HIGH';
    else regime5m = 'EXTREME';

    // Classify 1h regime
    let regime1h: VolatilityState['regime1h'] = 'MEDIUM';
    if (atr1h < 4.0) regime1h = 'LOW';
    else if (atr1h <= 8.5) regime1h = 'MEDIUM';
    else regime1h = 'HIGH';

    // Volatility percentile relative to past 60 candles
    const past60Ranges = trueRanges.slice(-60).sort((a, b) => a - b);
    const rank = past60Ranges.filter(r => r <= current5mRange).length;
    const percentile = Math.round((rank / Math.max(1, past60Ranges.length)) * 100);

    return {
      atr5m: parseFloat(atr5m.toFixed(2)),
      atr15m: parseFloat(atr15m.toFixed(2)),
      atr1h: parseFloat(atr1h.toFixed(2)),
      atrDaily: parseFloat(atrDaily.toFixed(2)),
      regime5m,
      regime1h,
      current5mRange: parseFloat(current5mRange.toFixed(2)),
      avg5mRange: parseFloat(avg5mRange.toFixed(2)),
      rangeExpansionRatio: parseFloat(rangeExpansionRatio.toFixed(2)),
      percentile,
    };
  }
}
