import { Candle, MarketStructureState } from '../../types/market';

export class StructureEngine {
  /**
   * Identifies swing points, BOS, CHOCH, displacement, and trend from candles
   */
  public static analyze(candles: Candle[], lookback: number = 3): MarketStructureState {
    if (!candles || candles.length < 15) {
      return {
        trend: 'Neutral',
        recentSwing: 'HL',
        bos: null,
        choch: null,
        lastSweep: null,
        displacement: false,
        consolidation: false,
        rangeHigh: 0,
        rangeLow: 0,
      };
    }

    const swings: { index: number; type: 'HIGH' | 'LOW'; price: number; time: number }[] = [];

    // Detect swing highs and lows using fractal lookback
    for (let i = lookback; i < candles.length - lookback; i++) {
      const current = candles[i];
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].high >= current.high || candles[i + j].high > current.high) {
          isHigh = false;
        }
        if (candles[i - j].low <= current.low || candles[i + j].low < current.low) {
          isLow = false;
        }
      }

      if (isHigh) {
        swings.push({ index: i, type: 'HIGH', price: current.high, time: current.time });
      } else if (isLow) {
        swings.push({ index: i, type: 'LOW', price: current.low, time: current.time });
      }
    }

    const highs = swings.filter(s => s.type === 'HIGH');
    const lows = swings.filter(s => s.type === 'LOW');

    let recentSwing: 'HH' | 'HL' | 'LH' | 'LL' = 'HL';
    let trend: MarketStructureState['trend'] = 'Neutral';

    if (highs.length >= 2 && lows.length >= 2) {
      const lastH = highs[highs.length - 1];
      const prevH = highs[highs.length - 2];
      const lastL = lows[lows.length - 1];
      const prevL = lows[lows.length - 2];

      const isHigherHigh = lastH.price > prevH.price;
      const isHigherLow = lastL.price > prevL.price;
      const isLowerHigh = lastH.price < prevH.price;
      const isLowerLow = lastL.price < prevL.price;

      if (isHigherHigh && isHigherLow) {
        trend = 'Strong Bullish';
        recentSwing = 'HH';
      } else if (isHigherHigh) {
        trend = 'Bullish';
        recentSwing = 'HH';
      } else if (isLowerLow && isLowerHigh) {
        trend = 'Strong Bearish';
        recentSwing = 'LL';
      } else if (isLowerLow) {
        trend = 'Bearish';
        recentSwing = 'LL';
      } else if (isLowerHigh) {
        trend = 'Neutral';
        recentSwing = 'LH';
      } else {
        trend = 'Neutral';
        recentSwing = 'HL';
      }
    } else {
      // Linear slope fallback over available candles
      const firstQuarter = candles.slice(0, Math.floor(candles.length / 4));
      const lastQuarter = candles.slice(-Math.floor(candles.length / 4));
      const avgFirst = firstQuarter.reduce((a, b) => a + b.close, 0) / Math.max(1, firstQuarter.length);
      const avgLast = lastQuarter.reduce((a, b) => a + b.close, 0) / Math.max(1, lastQuarter.length);
      const diff = avgLast - avgFirst;

      if (diff > 2.0) {
        trend = 'Strong Bullish';
        recentSwing = 'HH';
      } else if (diff > 0.5) {
        trend = 'Bullish';
        recentSwing = 'HL';
      } else if (diff < -2.0) {
        trend = 'Strong Bearish';
        recentSwing = 'LL';
      } else if (diff < -0.5) {
        trend = 'Bearish';
        recentSwing = 'LH';
      }
    }

    // Detect BOS (Break of Structure) & CHOCH (Change of Character)
    let bos: MarketStructureState['bos'] = null;
    let choch: MarketStructureState['choch'] = null;
    let lastSweep: MarketStructureState['lastSweep'] = null;

    const currentCandle = candles[candles.length - 1];
    const prevCandles = candles.slice(-10);

    if (highs.length > 0) {
      const lastHigh = highs[highs.length - 1];
      // Check if price closed above swing high -> Bullish BOS or CHOCH
      for (const c of prevCandles) {
        if (c.close > lastHigh.price) {
          if (trend.includes('Bearish')) {
            choch = { type: 'Bullish CHOCH', price: lastHigh.price, time: c.time };
          } else {
            bos = { type: 'Bullish BOS', price: lastHigh.price, time: c.time };
          }
          break;
        } else if (c.high > lastHigh.price && c.close < lastHigh.price) {
          // Wick above high and close below = Liquidity Sweep
          lastSweep = { level: `Swing High (${lastHigh.price.toFixed(2)})`, price: c.high, time: c.time };
        }
      }
    }

    if (lows.length > 0) {
      const lastLow = lows[lows.length - 1];
      for (const c of prevCandles) {
        if (c.close < lastLow.price) {
          if (trend.includes('Bullish')) {
            choch = { type: 'Bearish CHOCH', price: lastLow.price, time: c.time };
          } else {
            bos = { type: 'Bearish BOS', price: lastLow.price, time: c.time };
          }
          break;
        } else if (c.low < lastLow.price && c.close > lastLow.price) {
          // Wick below low and close above = Liquidity Sweep
          lastSweep = { level: `Swing Low (${lastLow.price.toFixed(2)})`, price: c.low, time: c.time };
        }
      }
    }

    // Displacement detection: candle body > 2.2x average candle body of last 14 candles
    const bodies = candles.slice(-15, -1).map(c => Math.abs(c.close - c.open));
    const avgBody = bodies.reduce((a, b) => a + b, 0) / Math.max(1, bodies.length);
    const lastBody = Math.abs(currentCandle.close - currentCandle.open);
    const displacement = lastBody > avgBody * 2.2 && lastBody > 1.5;

    // Consolidation detection: recent 8 candles range is tight (< 60% of average 20-candle range)
    const recent8 = candles.slice(-8);
    const recentHigh = Math.max(...recent8.map(c => c.high));
    const recentLow = Math.min(...recent8.map(c => c.low));
    const recentRange = recentHigh - recentLow;

    const past20 = candles.slice(-20);
    const past20High = Math.max(...past20.map(c => c.high));
    const past20Low = Math.min(...past20.map(c => c.low));
    const past20Range = past20High - past20Low;

    const consolidation = recentRange < past20Range * 0.45;

    return {
      trend,
      recentSwing,
      bos,
      choch,
      lastSweep,
      displacement,
      consolidation,
      rangeHigh: parseFloat(recentHigh.toFixed(2)),
      rangeLow: parseFloat(recentLow.toFixed(2)),
    };
  }
}
