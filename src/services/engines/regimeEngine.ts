import { EconomicEvent, MacroQuotes, MarketQuote, MarketRegime, MarketStructureState, VolatilityState } from '../../types/market';

export class RegimeEngine {
  /**
   * Compiles transparent, factual market context across Price, Macro, Volatility, and News
   */
  public static evaluate(
    quote: MarketQuote,
    structure: MarketStructureState,
    macro: MacroQuotes | null,
    volatility: VolatilityState,
    upcomingEvents: EconomicEvent[]
  ): MarketRegime {
    // 1. USD Pressure
    const dxyChange = macro?.dxy?.change || 0;
    let usdPressure: MarketRegime['usdPressure'] = 'Neutral';
    if (dxyChange < -0.15) usdPressure = 'Bearish pressure';
    else if (dxyChange > 0.15) usdPressure = 'Bullish pressure';

    // 2. Yields State
    const yieldChange = macro?.us10y?.change || 0;
    let yieldsState: MarketRegime['yieldsState'] = 'Consolidating';
    if (yieldChange < -0.03) yieldsState = 'Falling';
    else if (yieldChange > 0.03) yieldsState = 'Rising';

    // 3. Risk Sentiment
    const vixPrice = macro?.vix?.price || 16;
    const vixChange = macro?.vix?.change || 0;
    let riskSentiment: MarketRegime['riskSentiment'] = 'Neutral';
    if (vixPrice > 22 || vixChange > 1.5) riskSentiment = 'Risk-Off';
    else if (vixPrice < 15 && vixChange < -0.5) riskSentiment = 'Risk-On';

    // 4. Gold Momentum
    let momentum: MarketRegime['momentum'] = 'Neutral';
    if (structure.trend.includes('Bullish') || quote.changePercent24h > 0.4) {
      momentum = 'Positive';
    } else if (structure.trend.includes('Bearish') || quote.changePercent24h < -0.4) {
      momentum = 'Negative';
    }

    // 5. Volatility Regime
    let volatilityRegime: MarketRegime['volatilityRegime'] = 'Moderate';
    if (volatility.regime5m === 'LOW') volatilityRegime = 'Low';
    else if (volatility.regime5m === 'HIGH') volatilityRegime = 'Elevated';
    else if (volatility.regime5m === 'EXTREME') volatilityRegime = 'Extreme';

    // 6. News Risk
    const now = Date.now();
    const nextHighImpact = upcomingEvents.find(
      e => e.isHighImpact && e.country === 'USD' && e.timestamp > now && (e.timestamp - now) <= 45 * 60 * 1000
    );

    let newsRisk: MarketRegime['newsRisk'] = 'Low';
    let activeEventWarning: string | null = null;

    if (nextHighImpact) {
      newsRisk = 'CRITICAL EVENT AHEAD';
      activeEventWarning = `HIGH IMPACT EVENT: ${nextHighImpact.title} (${nextHighImpact.countdownText}). Spread and volatility may widen dramatically.`;
    } else {
      const todayHighImpact = upcomingEvents.some(
        e => e.isHighImpact && e.country === 'USD' && Math.abs(e.timestamp - now) < 6 * 3600 * 1000
      );
      if (todayHighImpact) newsRisk = 'High';
      else if (upcomingEvents.some(e => e.isHighImpact)) newsRisk = 'Medium';
    }

    // 7. Alignments
    // Macro alignment is High if DXY and US10Y move in opposite direction to Gold
    const isMacroAligned =
      (momentum === 'Positive' && usdPressure === 'Bearish pressure' && yieldsState === 'Falling') ||
      (momentum === 'Negative' && usdPressure === 'Bullish pressure' && yieldsState === 'Rising');

    const trendAlignment: MarketRegime['trendAlignment'] =
      structure.trend.includes('Strong') ? 'HIGH' : structure.trend === 'Neutral' ? 'LOW' : 'MEDIUM';

    const macroAlignment: MarketRegime['macroAlignment'] = isMacroAligned ? 'HIGH' : 'MEDIUM';

    // 8. Descriptive Overall Context
    let overallContext = 'RANGE-BOUND / NEUTRAL MARKET';
    if (structure.trend.includes('Bullish')) {
      if (newsRisk === 'CRITICAL EVENT AHEAD') {
        overallContext = 'BULLISH STRUCTURE / HIGH EVENT RISK (EXERCISE CAUTION)';
      } else if (isMacroAligned) {
        overallContext = 'STRONG BULLISH ALIGNMENT (MACRO & INTRADAY STRUCTURE CONVERGENCE)';
      } else {
        overallContext = 'BULLISH INTRADAY TREND / MIXED MACRO CONTEXT';
      }
    } else if (structure.trend.includes('Bearish')) {
      if (newsRisk === 'CRITICAL EVENT AHEAD') {
        overallContext = 'BEARISH STRUCTURE / HIGH EVENT RISK (EXERCISE CAUTION)';
      } else if (isMacroAligned) {
        overallContext = 'STRONG BEARISH ALIGNMENT (DOLLAR STRENGTH & RISING YIELDS)';
      } else {
        overallContext = 'BEARISH INTRADAY TREND / MIXED MACRO CONTEXT';
      }
    } else {
      overallContext = 'CONSOLIDATION / EQUILIBRIUM ENVIRONMENT';
    }

    const summaryBullets = [
      `Price Structure: ${structure.trend} on 5M timeframe`,
      `USD Index: ${usdPressure === 'Bearish pressure' ? 'Weakening / Down' : usdPressure === 'Bullish pressure' ? 'Strengthening / Up' : 'Flat / Consolidating'} (${macro?.dxy?.price || '--'})`,
      `US 10Y Yield: ${yieldsState === 'Falling' ? 'Declining' : yieldsState === 'Rising' ? 'Surging' : 'Consolidating'} (${macro?.us10y?.price || '--'}%)`,
      `Intraday Volatility: ${volatilityRegime} (ATR 5M: $${volatility.atr5m})`,
      `Macro Sentiment: ${riskSentiment} (VIX: ${macro?.vix?.price || '--'})`,
      newsRisk === 'CRITICAL EVENT AHEAD' ? `Event Alert: ${activeEventWarning}` : `News Risk: ${newsRisk}`,
    ];

    return {
      usdPressure,
      yieldsState,
      riskSentiment,
      momentum,
      volatilityRegime,
      newsRisk,
      trendAlignment,
      macroAlignment,
      overallContext,
      activeEventWarning,
      summaryBullets,
    };
  }
}
