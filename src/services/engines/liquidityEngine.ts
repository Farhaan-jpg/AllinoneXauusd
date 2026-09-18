import { Candle, LiquidityLevel } from '../../types/market';

export class LiquidityEngine {
  /**
   * Derives key institutional liquidity pools and session extremes
   */
  public static deriveLevels(candles: Candle[], currentPrice: number): LiquidityLevel[] {
    if (!candles || candles.length < 3) return [];

    const levels: LiquidityLevel[] = [];
    const now = Date.now();

    // 1. Group candles by day for PDH / PDL
    const dayGroups: Record<string, Candle[]> = {};
    candles.forEach(c => {
      const dateKey = new Date(c.time * 1000).toISOString().split('T')[0];
      if (!dayGroups[dateKey]) dayGroups[dateKey] = [];
      dayGroups[dateKey].push(c);
    });

    const dayKeys = Object.keys(dayGroups).sort();
    if (dayKeys.length >= 2) {
      const prevDayKey = dayKeys[dayKeys.length - 2];
      const prevDayCandles = dayGroups[prevDayKey];
      const pdh = Math.max(...prevDayCandles.map(c => c.high));
      const pdl = Math.min(...prevDayCandles.map(c => c.low));

      levels.push({
        id: `pdh_${prevDayKey}`,
        label: 'PDH (Prev Day High)',
        price: parseFloat(pdh.toFixed(2)),
        type: 'HIGH',
        category: 'DAILY',
        status: currentPrice > pdh ? 'SWEPT' : 'UNTOUCHED',
        distancePips: parseFloat(Math.abs(currentPrice - pdh).toFixed(2)),
        timestamp: now,
        source: 'Derived Liquidity',
      });

      levels.push({
        id: `pdl_${prevDayKey}`,
        label: 'PDL (Prev Day Low)',
        price: parseFloat(pdl.toFixed(2)),
        type: 'LOW',
        category: 'DAILY',
        status: currentPrice < pdl ? 'SWEPT' : 'UNTOUCHED',
        distancePips: parseFloat(Math.abs(currentPrice - pdl).toFixed(2)),
        timestamp: now,
        source: 'Derived Liquidity',
      });
    } else {
      // Intraday fallback when less than 2 full calendar days in slice
      const half = Math.floor(candles.length / 2);
      const firstHalf = candles.slice(0, half);
      const pdh = Math.max(...firstHalf.map(c => c.high));
      const pdl = Math.min(...firstHalf.map(c => c.low));

      levels.push({
        id: 'pdh_intraday',
        label: 'PDH (Prev Period High)',
        price: parseFloat(pdh.toFixed(2)),
        type: 'HIGH',
        category: 'DAILY',
        status: currentPrice > pdh ? 'SWEPT' : 'UNTOUCHED',
        distancePips: parseFloat(Math.abs(currentPrice - pdh).toFixed(2)),
        timestamp: now,
        source: 'Derived Liquidity',
      });

      levels.push({
        id: 'pdl_intraday',
        label: 'PDL (Prev Period Low)',
        price: parseFloat(pdl.toFixed(2)),
        type: 'LOW',
        category: 'DAILY',
        status: currentPrice < pdl ? 'SWEPT' : 'UNTOUCHED',
        distancePips: parseFloat(Math.abs(currentPrice - pdl).toFixed(2)),
        timestamp: now,
        source: 'Derived Liquidity',
      });
    }

    // 2. Session Highs / Lows (Asian: 00-08 UTC, London: 07-15 UTC, NY: 12-20 UTC)
    const todayCandles = dayKeys.length > 0 ? dayGroups[dayKeys[dayKeys.length - 1]] : candles;
    const asianCandles: Candle[] = [];
    const londonCandles: Candle[] = [];
    const nyCandles: Candle[] = [];

    todayCandles.forEach(c => {
      const hour = new Date(c.time * 1000).getUTCHours();
      if (hour >= 0 && hour < 8) asianCandles.push(c);
      if (hour >= 7 && hour < 15) londonCandles.push(c);
      if (hour >= 12 && hour < 20) nyCandles.push(c);
    });

    if (asianCandles.length > 0) {
      const aHigh = Math.max(...asianCandles.map(c => c.high));
      const aLow = Math.min(...asianCandles.map(c => c.low));
      levels.push({
        id: 'asian_high',
        label: 'Asian Session High',
        price: parseFloat(aHigh.toFixed(2)),
        type: 'HIGH',
        category: 'SESSION',
        status: currentPrice > aHigh ? 'SWEPT' : 'UNTOUCHED',
        distancePips: parseFloat(Math.abs(currentPrice - aHigh).toFixed(2)),
        timestamp: now,
        source: 'Derived Liquidity',
      });
      levels.push({
        id: 'asian_low',
        label: 'Asian Session Low',
        price: parseFloat(aLow.toFixed(2)),
        type: 'LOW',
        category: 'SESSION',
        status: currentPrice < aLow ? 'SWEPT' : 'UNTOUCHED',
        distancePips: parseFloat(Math.abs(currentPrice - aLow).toFixed(2)),
        timestamp: now,
        source: 'Derived Liquidity',
      });
    }

    if (londonCandles.length > 0) {
      const lHigh = Math.max(...londonCandles.map(c => c.high));
      const lLow = Math.min(...londonCandles.map(c => c.low));
      levels.push({
        id: 'london_high',
        label: 'London Session High',
        price: parseFloat(lHigh.toFixed(2)),
        type: 'HIGH',
        category: 'SESSION',
        status: currentPrice > lHigh ? 'SWEPT' : 'UNTOUCHED',
        distancePips: parseFloat(Math.abs(currentPrice - lHigh).toFixed(2)),
        timestamp: now,
        source: 'Derived Liquidity',
      });
      levels.push({
        id: 'london_low',
        label: 'London Session Low',
        price: parseFloat(lLow.toFixed(2)),
        type: 'LOW',
        category: 'SESSION',
        status: currentPrice < lLow ? 'SWEPT' : 'UNTOUCHED',
        distancePips: parseFloat(Math.abs(currentPrice - lLow).toFixed(2)),
        timestamp: now,
        source: 'Derived Liquidity',
      });
    }

    // 3. Detect Equal Highs (EQH) and Equal Lows (EQL)
    // Find local peaks within tolerance ($0.35 on Gold)
    const swingHighs: number[] = [];
    const swingLows: number[] = [];
    const lookback = 2;

    for (let i = lookback; i < candles.length - lookback; i++) {
      const c = candles[i];
      let isH = true;
      let isL = true;
      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].high >= c.high || candles[i + j].high > c.high) isH = false;
        if (candles[i - j].low <= c.low || candles[i + j].low < c.low) isL = false;
      }
      if (isH) swingHighs.push(c.high);
      if (isL) swingLows.push(c.low);
    }

    // Check EQH
    for (let i = 0; i < swingHighs.length; i++) {
      for (let j = i + 1; j < swingHighs.length; j++) {
        if (Math.abs(swingHighs[i] - swingHighs[j]) <= 0.40) {
          const avgPrice = parseFloat(((swingHighs[i] + swingHighs[j]) / 2).toFixed(2));
          levels.push({
            id: `eqh_${i}_${j}`,
            label: 'EQH (Equal Highs Pool)',
            price: avgPrice,
            type: 'HIGH',
            category: 'SWING',
            status: currentPrice > avgPrice ? 'SWEPT' : 'UNTOUCHED',
            distancePips: parseFloat(Math.abs(currentPrice - avgPrice).toFixed(2)),
            timestamp: now,
            source: 'Derived Liquidity',
          });
          break;
        }
      }
    }

    // Check EQL
    for (let i = 0; i < swingLows.length; i++) {
      for (let j = i + 1; j < swingLows.length; j++) {
        if (Math.abs(swingLows[i] - swingLows[j]) <= 0.40) {
          const avgPrice = parseFloat(((swingLows[i] + swingLows[j]) / 2).toFixed(2));
          levels.push({
            id: `eql_${i}_${j}`,
            label: 'EQL (Equal Lows Pool)',
            price: avgPrice,
            type: 'LOW',
            category: 'SWING',
            status: currentPrice < avgPrice ? 'SWEPT' : 'UNTOUCHED',
            distancePips: parseFloat(Math.abs(currentPrice - avgPrice).toFixed(2)),
            timestamp: now,
            source: 'Derived Liquidity',
          });
          break;
        }
      }
    }

    // Sort by distance from current price ascending
    levels.sort((a, b) => a.distancePips - b.distancePips);

    return levels;
  }
}
