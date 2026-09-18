import { Candle, OrderFlowState } from '../../types/market';

export class OrderFlowEngine {
  /**
   * Analyzes taker order flow, delta, CVD, volume anomalies, and absorption
   */
  public static analyze(candles: Candle[]): OrderFlowState {
    if (!candles || candles.length < 5) {
      return {
        delta: 0,
        cvd: 0,
        buyVolume: 0,
        sellVolume: 0,
        volumeSpike: false,
        deltaSpike: false,
        absorptionState: 'None',
        aggressiveState: 'Neutral',
        source: 'PAXG 1oz Physical Gold Market Proxy',
        isAvailable: false,
      };
    }

    const currentCandle = candles[candles.length - 1];
    const buyVol = currentCandle.buyVolume || currentCandle.volume * 0.5;
    const sellVol = currentCandle.sellVolume || currentCandle.volume * 0.5;
    const delta = buyVol - sellVol;

    // Calculate CVD (Cumulative Volume Delta) over the last 50 candles
    const recent50 = candles.slice(-50);
    let runningCvd = 0;
    const deltas: number[] = [];
    const volumes: number[] = [];

    recent50.forEach(c => {
      const b = c.buyVolume || c.volume * 0.5;
      const s = c.sellVolume || c.volume * 0.5;
      const d = b - s;
      deltas.push(d);
      volumes.push(c.volume);
      runningCvd += d;
    });

    // Volume spike detection: current volume > 2.0x 20-candle average
    const past20Vol = volumes.slice(-21, -1);
    const avgVol = past20Vol.reduce((a, b) => a + b, 0) / Math.max(1, past20Vol.length);
    const volumeSpike = currentCandle.volume > avgVol * 2.0 && currentCandle.volume > 1.0;

    // Delta spike detection
    const pastDeltas = deltas.slice(-21, -1).map(d => Math.abs(d));
    const avgDelta = pastDeltas.reduce((a, b) => a + b, 0) / Math.max(1, pastDeltas.length);
    const deltaSpike = Math.abs(delta) > avgDelta * 2.2 && Math.abs(delta) > 0.5;

    // Absorption detection:
    // Large volume with small body and significant wick into high or low
    const totalRange = currentCandle.high - currentCandle.low;
    const bodySize = Math.abs(currentCandle.close - currentCandle.open);
    const upperWick = currentCandle.high - Math.max(currentCandle.open, currentCandle.close);
    const lowerWick = Math.min(currentCandle.open, currentCandle.close) - currentCandle.low;

    let absorptionState: OrderFlowState['absorptionState'] = 'None';
    if (totalRange > 0.5 && volumeSpike) {
      if (lowerWick > bodySize * 1.5 && delta < 0) {
        // Aggressive sellers hitting bid, but price held and wicked up -> Bullish Absorption
        absorptionState = 'Bullish Absorption';
      } else if (upperWick > bodySize * 1.5 && delta > 0) {
        // Aggressive buyers lifting ask, but price held and wicked down -> Bearish Absorption
        absorptionState = 'Bearish Absorption';
      }
    }

    // Aggressive state
    let aggressiveState: OrderFlowState['aggressiveState'] = 'Neutral';
    const buyRatio = currentCandle.volume > 0 ? buyVol / currentCandle.volume : 0.5;
    if (buyRatio >= 0.65) {
      aggressiveState = 'Aggressive Buyers';
    } else if (buyRatio <= 0.35) {
      aggressiveState = 'Aggressive Sellers';
    }

    return {
      delta: parseFloat(delta.toFixed(2)),
      cvd: parseFloat(runningCvd.toFixed(2)),
      buyVolume: parseFloat(buyVol.toFixed(2)),
      sellVolume: parseFloat(sellVol.toFixed(2)),
      volumeSpike,
      deltaSpike,
      absorptionState,
      aggressiveState,
      source: 'Taker Volume Delta (PAXG 1oz LBMA Gold Proxy)',
      isAvailable: true,
    };
  }
}
