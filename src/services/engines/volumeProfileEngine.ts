import { Candle, VolumeProfile, VolumeProfileBin } from '../../types/market';

export class VolumeProfileEngine {
  /**
   * Computes POC, VAH (70%), VAL (70%), HVN, LVN, and volume distribution bins
   */
  public static calculate(
    candles: Candle[],
    rangeType: 'SESSION' | 'DAY' | 'CUSTOM' = 'SESSION',
    numBins: number = 30
  ): VolumeProfile {
    if (!candles || candles.length < 5) {
      return {
        poc: 0,
        vah: 0,
        val: 0,
        hvn: [],
        lvn: [],
        totalVolume: 0,
        bins: [],
        rangeType,
        source: 'Aggregated 5M Candles',
        isAvailable: false,
      };
    }

    // Filter candles based on rangeType if needed
    let targetCandles = candles;
    if (rangeType === 'SESSION') {
      targetCandles = candles.slice(-72); // ~6 hours of 5m candles
    } else if (rangeType === 'DAY') {
      targetCandles = candles.slice(-288); // 24 hours of 5m candles
    }

    const high = Math.max(...targetCandles.map(c => c.high));
    const low = Math.min(...targetCandles.map(c => c.low));
    const priceRange = high - low;

    if (priceRange <= 0.001) {
      return {
        poc: high,
        vah: high,
        val: low,
        hvn: [high],
        lvn: [],
        totalVolume: 0,
        bins: [],
        rangeType,
        source: 'Aggregated 5M Candles',
        isAvailable: true,
      };
    }

    const binSize = priceRange / numBins;
    const bins: VolumeProfileBin[] = Array.from({ length: numBins }, (_, i) => ({
      price: parseFloat((low + (i + 0.5) * binSize).toFixed(2)),
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
    }));

    let totalVolume = 0;

    // Distribute candle volume across bins
    targetCandles.forEach(c => {
      const cHigh = c.high;
      const cLow = c.low;
      const cVol = c.volume || 1;
      const cBuy = c.buyVolume || cVol * 0.5;
      const cSell = c.sellVolume || cVol * 0.5;

      totalVolume += cVol;

      // Find bins overlapped by this candle
      const startBin = Math.max(0, Math.min(numBins - 1, Math.floor((cLow - low) / binSize)));
      const endBin = Math.max(0, Math.min(numBins - 1, Math.floor((cHigh - low) / binSize)));
      const span = Math.max(1, endBin - startBin + 1);

      const volPerBin = cVol / span;
      const buyPerBin = cBuy / span;
      const sellPerBin = cSell / span;

      for (let b = startBin; b <= endBin; b++) {
        bins[b].volume += volPerBin;
        bins[b].buyVolume += buyPerBin;
        bins[b].sellVolume += sellPerBin;
      }
    });

    // 1. Identify POC (Point of Control)
    let maxVol = -1;
    let pocIndex = 0;
    bins.forEach((b, idx) => {
      if (b.volume > maxVol) {
        maxVol = b.volume;
        pocIndex = idx;
      }
    });
    const poc = bins[pocIndex]?.price || (high + low) / 2;

    // 2. Identify Value Area (70% of total volume around POC)
    const targetValueAreaVol = totalVolume * 0.70;
    let accumulatedVol = bins[pocIndex].volume;
    let upIdx = pocIndex + 1;
    let downIdx = pocIndex - 1;

    while (accumulatedVol < targetValueAreaVol && (upIdx < numBins || downIdx >= 0)) {
      const upVol = upIdx < numBins ? bins[upIdx].volume : -1;
      const downVol = downIdx >= 0 ? bins[downIdx].volume : -1;

      if (upVol >= downVol && upIdx < numBins) {
        accumulatedVol += bins[upIdx].volume;
        upIdx++;
      } else if (downIdx >= 0) {
        accumulatedVol += bins[downIdx].volume;
        downIdx--;
      } else if (upIdx < numBins) {
        accumulatedVol += bins[upIdx].volume;
        upIdx++;
      } else {
        break;
      }
    }

    const val = bins[Math.max(0, downIdx + 1)]?.price || low;
    const vah = bins[Math.min(numBins - 1, upIdx - 1)]?.price || high;

    // 3. Detect HVN (High Volume Nodes) & LVN (Low Volume Nodes)
    const hvn: number[] = [];
    const lvn: number[] = [];

    for (let i = 1; i < numBins - 1; i++) {
      const prev = bins[i - 1].volume;
      const curr = bins[i].volume;
      const next = bins[i + 1].volume;

      if (curr > prev && curr > next && curr > totalVolume / numBins * 1.2) {
        hvn.push(bins[i].price);
      }
      if (curr < prev && curr < next && curr < totalVolume / numBins * 0.6) {
        lvn.push(bins[i].price);
      }
    }

    return {
      poc: parseFloat(poc.toFixed(2)),
      vah: parseFloat(vah.toFixed(2)),
      val: parseFloat(val.toFixed(2)),
      hvn,
      lvn,
      totalVolume: parseFloat(totalVolume.toFixed(2)),
      bins,
      rangeType,
      source: 'Calculated from 5M Intraday Candles',
      isAvailable: true,
    };
  }
}
