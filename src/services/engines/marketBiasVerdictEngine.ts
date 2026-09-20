import {
  EconomicEvent,
  MacroQuotes,
  MarketBiasVerdict,
  MarketQuote,
  MarketStructureState,
  NewsArticle,
  OrderFlowState,
  TradingZone,
  VolatilityState,
} from '../../types/market';
import { MTFMatrixState, MTFTimeframeData } from './mtfEngine';

export class MarketBiasVerdictEngine {
  /**
   * Institutional Multi-Pillar Quantitative Synthesis
   * Aggregates Technicals (35%), Macro (25%), Order Flow (20%), and Event/News Risk (20%)
   * to determine the final, definitive market bias verdict for XAUUSD.
   */
  public static evaluate(
    quote: MarketQuote | null,
    mtf: MTFMatrixState | null,
    structure: MarketStructureState,
    macro: MacroQuotes | null,
    orderFlow: OrderFlowState,
    volatility: VolatilityState,
    zones: TradingZone[],
    events: EconomicEvent[],
    news: NewsArticle[]
  ): MarketBiasVerdict {
    const currentPrice = quote?.price || 4378.38;

    // ==========================================
    // 1. PILLAR 1: MULTI-TIMEFRAME TECHNICALS (35%)
    // ==========================================
    let techScore = 0;
    const techDetails: string[] = [];

    if (mtf) {
      const netTfs = mtf.bullishCount - mtf.bearishCount;
      const tfTotal = Math.max(1, mtf.timeframes.length);
      techScore += Math.round((netTfs / tfTotal) * 60);

      techDetails.push(
        `MTF Confluence: ${mtf.bullishCount} Bullish vs ${mtf.bearishCount} Bearish across ${tfTotal} timeframes`
      );

      // Check Higher-Timeframe Dominance (1D & 4H)
      const dailyTf = mtf.timeframes.find((t: MTFTimeframeData) => t.timeframe === '1D');
      const h4Tf = mtf.timeframes.find((t: MTFTimeframeData) => t.timeframe === '4H');

      if (dailyTf?.trend === 'BULLISH' && h4Tf?.trend === 'BULLISH') {
        techScore += 20;
        techDetails.push('Higher Timeframe (1D + 4H) Macro Bullish Trend intact');
      } else if (dailyTf?.trend === 'BEARISH' && h4Tf?.trend === 'BEARISH') {
        techScore -= 20;
        techDetails.push('Higher Timeframe (1D + 4H) Macro Bearish Trend prevailing');
      } else {
        techDetails.push('HTF Divergence: Mixed directional posture on 4H/1D');
      }
    }

    // Market Structure Influence
    if (structure.trend.includes('Bullish')) {
      techScore += 15;
      techDetails.push(`Market Structure: Bullish swings (${structure.recentSwing})`);
    } else if (structure.trend.includes('Bearish')) {
      techScore -= 15;
      techDetails.push(`Market Structure: Bearish swings (${structure.recentSwing})`);
    }

    if (structure.displacement) {
      const dispBonus = structure.trend.includes('Bullish') ? 10 : -10;
      techScore += dispBonus;
      techDetails.push('Institutional displacement candle detected');
    }

    techScore = Math.max(-100, Math.min(100, techScore));
    const techRating: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
      techScore >= 20 ? 'BULLISH' : techScore <= -20 ? 'BEARISH' : 'NEUTRAL';
    const techSummary =
      techRating === 'BULLISH'
        ? 'Broad trend alignment with higher highs and multi-timeframe EMA expansion.'
        : techRating === 'BEARISH'
        ? 'Lower swing structures and downward momentum across intraday timeframes.'
        : 'Conflicting timeframes with rotational consolidation between support and resistance.';

    // ==========================================
    // 2. PILLAR 2: MACROECONOMIC ENVIRONMENT (25%)
    // ==========================================
    let macroScore = 0;
    const macroDetails: string[] = [];

    // US Dollar Index (DXY) - Inverse correlation
    const dxyChange = macro?.dxy?.change || 0;
    const dxyPrice = macro?.dxy?.price || 100.22;
    if (dxyChange < -0.05) {
      macroScore += 30;
      macroDetails.push(`USD Index (DXY) softening (${dxyPrice}, ${dxyChange > 0 ? '+' : ''}${dxyChange.toFixed(2)}) — Bullish tailwind for gold`);
    } else if (dxyChange > 0.05) {
      macroScore -= 30;
      macroDetails.push(`USD Index (DXY) firming (${dxyPrice}, +${dxyChange.toFixed(2)}) — Bearish headwind for gold`);
    } else {
      macroDetails.push(`USD Index (DXY) steady at ${dxyPrice} (${dxyChange >= 0 ? '+' : ''}${dxyChange.toFixed(2)})`);
    }

    // US 10-Year Yields (^TNX) - Inverse correlation
    const yieldChange = macro?.us10y?.change || 0;
    const yieldPrice = macro?.us10y?.price || 4.998;
    if (yieldChange < -0.02) {
      macroScore += 25;
      macroDetails.push(`US 10Y Yields falling to ${yieldPrice}% (${yieldChange.toFixed(3)}%) — Reduces opportunity cost of holding bullion`);
    } else if (yieldChange > 0.02) {
      macroScore -= 25;
      macroDetails.push(`US 10Y Yields rising to ${yieldPrice}% (+${yieldChange.toFixed(3)}%) — Pressuring non-yielding precious metals`);
    } else {
      macroDetails.push(`US 10Y Yields consolidating near ${yieldPrice}%`);
    }

    // VIX & Safe Haven Sentiment
    const vix = macro?.vix?.price || 14.81;
    if (vix > 18) {
      macroScore += 25;
      macroDetails.push(`VIX elevated at ${vix.toFixed(2)} — Safe-haven hedge flows active`);
    } else if (vix < 14) {
      macroScore -= 10;
      macroDetails.push(`VIX subdued at ${vix.toFixed(2)} — Normal risk-on market appetite`);
    } else {
      macroDetails.push(`VIX balanced at ${vix.toFixed(2)} pts`);
    }

    // Silver & Gold/Silver Ratio (GSR)
    const gsr = macro?.goldSilverRatio || 65.2;
    if (macro?.silver?.direction === 'UP') {
      macroScore += 15;
      macroDetails.push(`Silver leading higher ($${macro.silver.price}/oz) — Broad precious metals participation`);
    }

    macroScore = Math.max(-100, Math.min(100, macroScore));
    const macroRating: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
      macroScore >= 20 ? 'BULLISH' : macroScore <= -20 ? 'BEARISH' : 'NEUTRAL';
    const macroSummary =
      macroRating === 'BULLISH'
        ? 'Macro environment favors Gold: Dollar weakness and stabilizing real yields provide tailwinds.'
        : macroRating === 'BEARISH'
        ? 'Macro headwinds: Dollar strength or rising Treasury yields increase opportunity cost.'
        : 'Macro equilibrium: Balanced Dollar Index and Treasury yields offsetting directional drivers.';

    // ==========================================
    // 3. PILLAR 3: ORDER FLOW & LIQUIDITY (20%)
    // ==========================================
    let flowScore = 0;
    const flowDetails: string[] = [];

    if (orderFlow.isAvailable) {
      if (orderFlow.aggressiveState === 'Aggressive Buyers') {
        flowScore += 35;
        flowDetails.push(`Order Flow: Aggressive buyer dominance (Delta: ${orderFlow.delta > 0 ? '+' : ''}${orderFlow.delta.toFixed(0)})`);
      } else if (orderFlow.aggressiveState === 'Aggressive Sellers') {
        flowScore -= 35;
        flowDetails.push(`Order Flow: Aggressive seller dominance (Delta: ${orderFlow.delta.toFixed(0)})`);
      } else {
        flowDetails.push('Order Flow: Neutral delta balance between bids and asks');
      }

      if (orderFlow.absorptionState === 'Bullish Absorption') {
        flowScore += 25;
        flowDetails.push('Institutional passive buying absorbing sell-side liquidity at support');
      } else if (orderFlow.absorptionState === 'Bearish Absorption') {
        flowScore -= 25;
        flowDetails.push('Institutional passive selling capping upward momentum at resistance');
      }

      if (orderFlow.cvd > 0) {
        flowScore += 15;
      } else if (orderFlow.cvd < 0) {
        flowScore -= 15;
      }
    } else {
      // Proxy from 24h change & high/low position
      const quoteChange = quote?.changePercent24h || 0;
      flowScore += quoteChange > 0.3 ? 30 : quoteChange < -0.3 ? -30 : 0;
      flowDetails.push(`24h Price Action: ${quoteChange > 0 ? '+' : ''}${quoteChange.toFixed(2)}% net change`);
    }

    // Valuation within 24h Range
    if (quote && quote.high24h > quote.low24h) {
      const rangePos = (currentPrice - quote.low24h) / (quote.high24h - quote.low24h);
      if (rangePos > 0.65) {
        flowDetails.push(`Pricing: Trading in upper quartile of 24h range ($${quote.low24h.toFixed(1)} - $${quote.high24h.toFixed(1)})`);
      } else if (rangePos < 0.35) {
        flowDetails.push(`Pricing: Trading in discount quartile of 24h range ($${quote.low24h.toFixed(1)} - $${quote.high24h.toFixed(1)})`);
      } else {
        flowDetails.push(`Pricing: Trading near daily equilibrium ($${currentPrice.toFixed(2)})`);
      }
    }

    flowScore = Math.max(-100, Math.min(100, flowScore));
    const flowRating: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
      flowScore >= 20 ? 'BULLISH' : flowScore <= -20 ? 'BEARISH' : 'NEUTRAL';
    const flowSummary =
      flowRating === 'BULLISH'
        ? 'Net buying delta and volume absorption defending key discount zones.'
        : flowRating === 'BEARISH'
        ? 'Aggressive market selling and absorption capping upward liquidity expansion.'
        : 'Balanced two-way transaction volume with neither side establishing control.';

    // ==========================================
    // 4. PILLAR 4: GEOPOLITICAL & EVENT RISK (20%)
    // ==========================================
    let eventScore = 0;
    const eventDetails: string[] = [];
    const now = Date.now();

    // Check Upcoming High-Impact Economic Events (FOMC, CPI, NFP)
    const nextHighImpact = events.find(
      e => e.isHighImpact && e.country === 'USD' && e.timestamp > now && e.timestamp - now <= 45 * 60 * 1000
    );

    let eventRiskRating: 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK' = 'LOW_RISK';

    if (nextHighImpact) {
      eventRiskRating = 'HIGH_RISK';
      eventScore -= 30; // High imminent event risk discounts conviction
      eventDetails.push(`CRITICAL EVENT: ${nextHighImpact.title} (${nextHighImpact.countdownText}). Spreads and slippage likely to widen.`);
    } else {
      const upcomingToday = events.filter(
        e => e.isHighImpact && e.country === 'USD' && Math.abs(e.timestamp - now) <= 12 * 3600 * 1000
      );
      if (upcomingToday.length > 0) {
        eventRiskRating = 'MODERATE_RISK';
        eventDetails.push(`${upcomingToday.length} High-impact US release(s) scheduled on today's calendar.`);
      } else {
        eventDetails.push('Economic Calendar: No imminent high-impact US macro catalysts in the next 4 hours.');
      }
    }

    // Geopolitical / Safe-Haven Headlines
    const freshGeopolitical = news.filter(
      n => n.category === 'GEOPOLITICAL' && n.relevance === 'HIGH' && (now - n.publishedAt) <= 4 * 3600 * 1000
    );

    if (freshGeopolitical.length > 0) {
      eventScore += 25;
      eventDetails.push(`Safe-Haven News: ${freshGeopolitical.length} breaking headline(s) supporting gold reserve bid.`);
    } else {
      eventDetails.push('Geopolitical baseline: Steady safe-haven premium with no sudden conflict escalation.');
    }

    eventScore = Math.max(-100, Math.min(100, eventScore));
    const eventSummary =
      eventRiskRating === 'HIGH_RISK'
        ? 'Extreme event risk ahead: Wait for macro release actuals before committing to breakout entries.'
        : eventScore > 10
        ? 'Geopolitical backdrop and news sentiment supportive of precious metals accumulation.'
        : 'Calm news environment allowing technical levels and macro yields to drive price discovery.';

    // ==========================================
    // 5. COMPOSITE SYNTHESIS & FINAL VERDICT
    // ==========================================
    const compositeScore = Math.round(
      techScore * 0.35 +
      macroScore * 0.25 +
      flowScore * 0.20 +
      eventScore * 0.20
    );

    let finalBias: MarketBiasVerdict['bias'] = 'NEUTRAL';
    let verdictTitle = 'NEUTRAL / RANGE-BOUND CONSOLIDATION';

    if (compositeScore >= 45) {
      finalBias = 'STRONG_BULLISH';
      verdictTitle = 'STRONG BULLISH EXPANSION BIAS';
    } else if (compositeScore >= 15) {
      finalBias = 'BULLISH';
      verdictTitle = 'MODERATE BULLISH BIAS';
    } else if (compositeScore <= -45) {
      finalBias = 'STRONG_BEARISH';
      verdictTitle = 'STRONG BEARISH TREND BIAS';
    } else if (compositeScore <= -15) {
      finalBias = 'BEARISH';
      verdictTitle = 'MODERATE BEARISH BIAS';
    } else {
      finalBias = 'NEUTRAL';
      verdictTitle = 'BALANCED RANGE-BOUND EQUILIBRIUM';
    }

    // Confidence Score (50% to 96%)
    const confidenceScore = Math.min(
      96,
      Math.max(52, Math.round(52 + Math.abs(compositeScore) * 0.44))
    );

    // Playbook & Execution Zones
    const activeZones = zones.filter(z => z.status === 'ACTIVE');
    const supportZones = activeZones.filter(z => z.priceMax <= currentPrice);
    const resistanceZones = activeZones.filter(z => z.priceMin >= currentPrice);

    const primarySupport = supportZones.length > 0
      ? supportZones.reduce((prev, curr) => (curr.priceMax > prev.priceMax ? curr : prev))
      : { label: 'Confluence Demand', priceMin: currentPrice - 18, priceMax: currentPrice - 12 };

    const primaryResistance = resistanceZones.length > 0
      ? resistanceZones.reduce((prev, curr) => (curr.priceMin < prev.priceMin ? curr : prev))
      : { label: 'Confluence Supply', priceMin: currentPrice + 14, priceMax: currentPrice + 22 };

    let biasAction = '';
    let invalidationPrice = 0;
    let targetResistance = 0;

    if (finalBias.includes('BULLISH')) {
      biasAction = `Favor buy-side execution on corrective dips into confluence support ($${primarySupport.priceMin.toFixed(1)} - $${primarySupport.priceMax.toFixed(1)}). Avoid chasing extended highs.`;
      invalidationPrice = parseFloat((primarySupport.priceMin - 6).toFixed(2));
      targetResistance = parseFloat((primaryResistance.priceMax + 8).toFixed(2));
    } else if (finalBias.includes('BEARISH')) {
      biasAction = `Favor sell-side opportunities on rallies into overhead supply ($${primaryResistance.priceMin.toFixed(1)} - $${primaryResistance.priceMax.toFixed(1)}).`;
      invalidationPrice = parseFloat((primaryResistance.priceMax + 6).toFixed(2));
      targetResistance = parseFloat((primarySupport.priceMin - 8).toFixed(2));
    } else {
      biasAction = `Market is in two-way equilibrium ($${primarySupport.priceMax.toFixed(1)} - $${primaryResistance.priceMin.toFixed(1)}). Focus on mean-reversion at range boundaries; await breakout confirmation.`;
      invalidationPrice = parseFloat((primarySupport.priceMin - 5).toFixed(2));
      targetResistance = parseFloat((primaryResistance.priceMax + 5).toFixed(2));
    }

    // Executive Summary Synthesis
    const change24hVal = quote?.change24h ?? 0;
    const changePctVal = quote?.changePercent24h ?? 0;
    const changeTxt = quote ? `${change24hVal >= 0 ? '+' : ''}$${change24hVal.toFixed(2)} (${changePctVal >= 0 ? '+' : ''}${changePctVal.toFixed(2)}%)` : '';
    const executiveSummary =
      `Gold is trading at $${currentPrice.toFixed(2)} (${changeTxt}) with an overall ${finalBias.replace('_', ' ')} posture (${confidenceScore}% conviction). ` +
      `Technicals reflect ${techRating.toLowerCase()} alignment across timeframes, while macro conditions (DXY at ${dxyPrice} and 10Y Yields at ${yieldPrice}%) ` +
      `are providing ${macroRating === 'BULLISH' ? 'supportive tailwinds' : macroRating === 'BEARISH' ? 'persistent headwinds' : 'neutral directionality'}. ` +
      `Order flow shows ${flowRating.toLowerCase()} activity, and event risk is currently ${eventRiskRating.replace('_', ' ').toLowerCase()}.`;

    return {
      bias: finalBias,
      confidenceScore,
      verdictTitle,
      executiveSummary,
      pillars: {
        technicals: {
          score: techScore,
          rating: techRating,
          weight: 35,
          summary: techSummary,
          details: techDetails,
        },
        macro: {
          score: macroScore,
          rating: macroRating,
          weight: 25,
          summary: macroSummary,
          details: macroDetails,
        },
        orderflow: {
          score: flowScore,
          rating: flowRating,
          weight: 20,
          summary: flowSummary,
          details: flowDetails,
        },
        eventRisk: {
          score: eventScore,
          rating: eventRiskRating,
          weight: 20,
          summary: eventSummary,
          details: eventDetails,
        },
      },
      playbook: {
        biasAction,
        primaryZone: {
          label: finalBias.includes('BULLISH') ? 'Primary Support / Demand' : 'Primary Resistance / Supply',
          min: finalBias.includes('BULLISH') ? primarySupport.priceMin : primaryResistance.priceMin,
          max: finalBias.includes('BULLISH') ? primarySupport.priceMax : primaryResistance.priceMax,
          type: finalBias.includes('BULLISH') ? 'SUPPORT' : 'RESISTANCE',
        },
        invalidationPrice,
        targetResistance,
      },
      updatedAt: now,
    };
  }
}
