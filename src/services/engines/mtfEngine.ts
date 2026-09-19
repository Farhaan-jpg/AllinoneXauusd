import { Candle, Timeframe } from '../../types/market';

export type MTFTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type MTFRsiStatus = 'OVERBOUGHT' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'OVERSOLD';

export interface MTFTimeframeData {
  timeframe: Timeframe;
  trend: MTFTrend;
  ema20: number;
  ema50: number;
  emaAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
  rsiStatus: MTFRsiStatus;
  currentClose: number;
  recentHigh: number;
  recentLow: number;
  changePct: number;
  candleCount: number;
}

export interface MTFMatrixState {
  timeframes: MTFTimeframeData[];
  confluenceScore: number; // 0 to 100
  overallBias: 'STRONG_BULLISH' | 'MODERATE_BULLISH' | 'NEUTRAL' | 'MODERATE_BEARISH' | 'STRONG_BEARISH';
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  summary: string;
  lastUpdated: number;
}

export class MTFEngine {
  private static readonly TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D'];

  /**
   * Calculates Exponential Moving Average (EMA)
   */
  public static calculateEMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    if (values.length < period) {
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    const k = 2 / (period + 1);
    // Initial SMA
    let ema = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;

    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return parseFloat(ema.toFixed(2));
  }

  /**
   * Calculates Relative Strength Index (RSI 14) using Wilder's Smoothing
   */
  public static calculateRSI(closes: number[], period: number = 14): number {
    if (closes.length <= period) return 50.0;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100.0;
    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    return parseFloat(rsi.toFixed(1));
  }

  /**
   * Evaluates RSI status category
   */
  public static getRsiStatus(rsi: number): MTFRsiStatus {
    if (rsi >= 70) return 'OVERBOUGHT';
    if (rsi >= 55) return 'BULLISH';
    if (rsi <= 30) return 'OVERSOLD';
    if (rsi <= 45) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Aggregates lower-timeframe candles into higher-timeframe candles
   */
  public static aggregateCandles(candles: Candle[], targetTfMinutes: number, sourceTfMinutes: number = 5): Candle[] {
    if (candles.length === 0) return [];
    if (targetTfMinutes <= sourceTfMinutes) return candles;

    const ratio = Math.max(1, Math.round(targetTfMinutes / sourceTfMinutes));
    const aggregated: Candle[] = [];

    for (let i = 0; i < candles.length; i += ratio) {
      const chunk = candles.slice(i, i + ratio);
      if (chunk.length === 0) continue;

      const open = chunk[0].open;
      const close = chunk[chunk.length - 1].close;
      const high = Math.max(...chunk.map(c => c.high));
      const low = Math.min(...chunk.map(c => c.low));
      const volume = chunk.reduce((sum, c) => sum + (c.volume || 0), 0);
      const time = chunk[chunk.length - 1].time;

      aggregated.push({
        time,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    return aggregated;
  }

  /**
   * Analyzes a single timeframe candle series
   */
  public static analyzeTimeframe(candles: Candle[], tf: Timeframe, spotPrice?: number): MTFTimeframeData {
    if (candles.length === 0) {
      const fallbackPrice = spotPrice || 2650;
      return {
        timeframe: tf,
        trend: 'NEUTRAL',
        ema20: fallbackPrice,
        ema50: fallbackPrice,
        emaAlignment: 'NEUTRAL',
        rsi: 50.0,
        rsiStatus: 'NEUTRAL',
        currentClose: fallbackPrice,
        recentHigh: fallbackPrice + 5,
        recentLow: fallbackPrice - 5,
        changePct: 0,
        candleCount: 0,
      };
    }

    const closes = candles.map(c => c.close);
    const currentClose = spotPrice || closes[closes.length - 1];
    const prevClose = closes.length > 1 ? closes[closes.length - 2] : currentClose;
    const changePct = prevClose > 0 ? parseFloat((((currentClose - prevClose) / prevClose) * 100).toFixed(2)) : 0;

    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const rsi = this.calculateRSI(closes, 14);
    const rsiStatus = this.getRsiStatus(rsi);

    const recentCandles = candles.slice(-20);
    const recentHigh = Math.max(...recentCandles.map(c => c.high));
    const recentLow = Math.min(...recentCandles.map(c => c.low));

    // EMA Alignment
    let emaAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (ema20 > ema50 + 0.1) emaAlignment = 'BULLISH';
    else if (ema20 < ema50 - 0.1) emaAlignment = 'BEARISH';

    // Comprehensive Trend Determination
    let trend: MTFTrend = 'NEUTRAL';
    if (currentClose > ema20 && ema20 >= ema50 && rsi >= 48) {
      trend = 'BULLISH';
    } else if (currentClose < ema20 && ema20 <= ema50 && rsi <= 52) {
      trend = 'BEARISH';
    } else if (currentClose > ema20 && rsi >= 55) {
      trend = 'BULLISH';
    } else if (currentClose < ema20 && rsi <= 45) {
      trend = 'BEARISH';
    }

    return {
      timeframe: tf,
      trend,
      ema20,
      ema50,
      emaAlignment,
      rsi,
      rsiStatus,
      currentClose,
      recentHigh,
      recentLow,
      changePct,
      candleCount: candles.length,
    };
  }

  /**
   * Computes the complete multi-timeframe matrix and confluence score
   */
  public static computeMatrix(
    candlesByTf: Partial<Record<Timeframe, Candle[]>>,
    currentQuotePrice: number
  ): MTFMatrixState {
    const minutesMap: Record<Timeframe, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1H': 60,
      '4H': 240,
      '1D': 1440,
    };

    // Base fallback candles from whichever timeframe is available
    const baseCandles = candlesByTf['5m'] || candlesByTf['1m'] || candlesByTf['15m'] || candlesByTf['1H'] || [];

    const tfResults: MTFTimeframeData[] = this.TIMEFRAMES.map(tf => {
      let candles = candlesByTf[tf];
      if (!candles || candles.length < 10) {
        // Synthesize from base candles if direct candles aren't loaded
        if (baseCandles.length > 0) {
          candles = this.aggregateCandles(baseCandles, minutesMap[tf], 5);
        } else {
          candles = [];
        }
      }
      return this.analyzeTimeframe(candles, tf, currentQuotePrice);
    });

    // Confluence Scoring
    let bullishScore = 0;
    let bearishScore = 0;

    tfResults.forEach(r => {
      if (r.trend === 'BULLISH') bullishScore += 1;
      else if (r.trend === 'BEARISH') bearishScore += 1;
      else {
        // Fractional score based on RSI bias
        if (r.rsi > 52) bullishScore += 0.5;
        else if (r.rsi < 48) bearishScore += 0.5;
      }
    });

    const totalTfs = tfResults.length;
    const maxScore = Math.max(bullishScore, bearishScore);
    const confluenceScore = Math.round((maxScore / totalTfs) * 100);

    const bullishCount = tfResults.filter(r => r.trend === 'BULLISH').length;
    const bearishCount = tfResults.filter(r => r.trend === 'BEARISH').length;
    const neutralCount = tfResults.filter(r => r.trend === 'NEUTRAL').length;

    let overallBias: MTFMatrixState['overallBias'] = 'NEUTRAL';
    let summary = '';

    if (bullishCount >= 5) {
      overallBias = 'STRONG_BULLISH';
      summary = `High institutional alignment (${bullishCount}/${totalTfs} TFs Bullish). Momentum favors continuation.`;
    } else if (bullishCount >= 4) {
      overallBias = 'MODERATE_BULLISH';
      summary = `Bullish bias across major timeframes (${bullishCount}/${totalTfs} TFs). Watch intraday pullbacks.`;
    } else if (bearishCount >= 5) {
      overallBias = 'STRONG_BEARISH';
      summary = `High institutional alignment (${bearishCount}/${totalTfs} TFs Bearish). Downward pressure dominant.`;
    } else if (bearishCount >= 4) {
      overallBias = 'MODERATE_BEARISH';
      summary = `Bearish bias across major timeframes (${bearishCount}/${totalTfs} TFs). Rallies likely to be sold.`;
    } else {
      overallBias = 'NEUTRAL';
      summary = `Mixed multi-timeframe signals (${bullishCount} Bull / ${bearishCount} Bear / ${neutralCount} Neutral). Consolidation active.`;
    }

    return {
      timeframes: tfResults,
      confluenceScore,
      overallBias,
      bullishCount,
      bearishCount,
      neutralCount,
      summary,
      lastUpdated: Date.now(),
    };
  }
}
