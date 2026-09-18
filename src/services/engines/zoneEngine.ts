import { Candle, LiquidityLevel, TradingZone, VolumeProfile } from '../../types/market';

export class ZoneEngine {
  /**
   * Identifies potential pullback and reversal reaction zones on 5m timeframe
   */
  public static identifyZones(
    candles: Candle[],
    currentPrice: number,
    profile?: VolumeProfile,
    liquidityLevels?: LiquidityLevel[]
  ): TradingZone[] {
    if (!candles || candles.length < 20) return [];

    const zones: TradingZone[] = [];
    const now = Date.now();

    // 1. Pullback Zones based on Displacement Origins & Consolidation Breakouts
    for (let i = candles.length - 15; i >= 5; i--) {
      const c = candles[i];
      const prev = candles[i - 1];
      const body = Math.abs(c.close - c.open);
      const isBullishDisplacement = c.close > c.open && body > 1.8 && c.volume > 1.2;
      const isBearishDisplacement = c.close < c.open && body > 1.8 && c.volume > 1.2;

      if (isBullishDisplacement && c.low < currentPrice) {
        // Bullish displacement base (demand/pullback zone)
        const minP = Math.min(prev.low, c.low);
        const maxP = Math.min(c.open, minP + 1.2);

        // Check if price has broken below minP (invalidated)
        let status: TradingZone['status'] = 'ACTIVE';
        for (let k = i + 1; k < candles.length; k++) {
          if (candles[k].low <= minP) {
            status = 'INVALIDATED';
            break;
          } else if (candles[k].low <= maxP) {
            status = 'TESTED';
          }
        }

        if (status !== 'INVALIDATED') {
          zones.push({
            id: `zone_pb_bull_${i}`,
            type: 'Pullback Zone',
            priceMin: parseFloat(minP.toFixed(2)),
            priceMax: parseFloat(maxP.toFixed(2)),
            strength: c.volume > 2.5 ? 'HIGH' : 'MEDIUM',
            reason: `5M Bullish displacement origin ($${minP.toFixed(2)} - $${maxP.toFixed(2)})`,
            createdAt: c.time * 1000,
            status,
            distancePips: parseFloat(Math.abs(currentPrice - (minP + maxP) / 2).toFixed(2)),
            source: 'Derived Zone',
          });
          break; // Keep cleanest recent
        }
      } else if (isBearishDisplacement && c.high > currentPrice) {
        // Bearish displacement origin (supply/pullback zone)
        const maxP = Math.max(prev.high, c.high);
        const minP = Math.max(c.open, maxP - 1.2);

        let status: TradingZone['status'] = 'ACTIVE';
        for (let k = i + 1; k < candles.length; k++) {
          if (candles[k].high >= maxP) {
            status = 'INVALIDATED';
            break;
          } else if (candles[k].high >= minP) {
            status = 'TESTED';
          }
        }

        if (status !== 'INVALIDATED') {
          zones.push({
            id: `zone_pb_bear_${i}`,
            type: 'Pullback Zone',
            priceMin: parseFloat(minP.toFixed(2)),
            priceMax: parseFloat(maxP.toFixed(2)),
            strength: c.volume > 2.5 ? 'HIGH' : 'MEDIUM',
            reason: `5M Bearish displacement origin ($${minP.toFixed(2)} - $${maxP.toFixed(2)})`,
            createdAt: c.time * 1000,
            status,
            distancePips: parseFloat(Math.abs(currentPrice - (minP + maxP) / 2).toFixed(2)),
            source: 'Derived Zone',
          });
          break;
        }
      }
    }

    // 2. Pullback Zone based on Volume Profile POC / Value Area boundary
    if (profile && profile.poc > 0) {
      const pocRangeMin = parseFloat((profile.poc - 0.45).toFixed(2));
      const pocRangeMax = parseFloat((profile.poc + 0.45).toFixed(2));
      zones.push({
        id: 'zone_poc_reaction',
        type: 'Pullback Zone',
        priceMin: pocRangeMin,
        priceMax: pocRangeMax,
        strength: 'HIGH',
        reason: `Volume Profile Point of Control (POC) high liquidity node at $${profile.poc.toFixed(2)}`,
        createdAt: now,
        status: currentPrice >= pocRangeMin && currentPrice <= pocRangeMax ? 'TESTED' : 'ACTIVE',
        distancePips: parseFloat(Math.abs(currentPrice - profile.poc).toFixed(2)),
        source: 'Derived Zone',
      });
    }

    // 3. Reversal Reaction Zones based on Liquidity Sweeps of Major Extremes
    if (liquidityLevels) {
      const keyExtremes = liquidityLevels.filter(
        l => l.category === 'DAILY' || l.category === 'SESSION'
      ).slice(0, 4);

      keyExtremes.forEach((lvl, idx) => {
        const isAbove = lvl.price > currentPrice;
        const minP = isAbove ? lvl.price - 0.2 : lvl.price - 0.6;
        const maxP = isAbove ? lvl.price + 0.6 : lvl.price + 0.2;

        zones.push({
          id: `zone_rev_${idx}`,
          type: 'Reversal Zone',
          priceMin: parseFloat(minP.toFixed(2)),
          priceMax: parseFloat(maxP.toFixed(2)),
          strength: lvl.category === 'DAILY' ? 'HIGH' : 'MEDIUM',
          reason: `Potential liquidity reaction zone at ${lvl.label} ($${lvl.price.toFixed(2)})`,
          createdAt: now,
          status: lvl.status === 'SWEPT' ? 'TESTED' : 'ACTIVE',
          distancePips: parseFloat(Math.abs(currentPrice - lvl.price).toFixed(2)),
          source: 'Derived Zone',
        });
      });
    }

    // Sort by distance from current price ascending
    zones.sort((a, b) => a.distancePips - b.distancePips);

    return zones.slice(0, 6);
  }
}
