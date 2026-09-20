export type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D';

export interface MarketQuote {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  spread?: number;
  timestamp: number;
  source: string;
  isDelayed: boolean;
  status: 'LIVE' | 'DELAYED' | 'CLOSED' | 'STALE';
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  open24h: number;
  prevClose: number;
  sessionHigh: number;
  sessionLow: number;
  volume24h?: number;
}

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
}

export interface MacroQuoteItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  change5m?: number;
  change1h?: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
  timestamp: number;
  source: string;
  unit: string;
}

export interface MacroQuotes {
  dxy: MacroQuoteItem;
  us10y: MacroQuoteItem;
  us02y: MacroQuoteItem;
  vix: MacroQuoteItem;
  silver: MacroQuoteItem;
  oil: MacroQuoteItem;
  usdjpy?: MacroQuoteItem;
  goldSilverRatio?: number;
  timestamp: number;
}

export interface CorrelationItem {
  pair: string;
  asset: string;
  correlation: number;
  window: number;
  interpretation: string;
}

export interface LiquidityLevel {
  id: string;
  label: string; // PDH, PDL, PWH, PWL, Asian High, Asian Low, London High, London Low, NY High, NY Low, EQH, EQL, Swing High, Swing Low
  price: number;
  type: 'HIGH' | 'LOW';
  category: 'SESSION' | 'DAILY' | 'WEEKLY' | 'SWING';
  status: 'UNTOUCHED' | 'SWEPT' | 'TESTED';
  distancePips: number;
  timestamp: number;
  source: 'Derived Liquidity';
}

export interface VolumeProfileBin {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export interface VolumeProfile {
  poc: number; // Point of Control
  vah: number; // Value Area High (70%)
  val: number; // Value Area Low (70%)
  hvn: number[]; // High Volume Nodes
  lvn: number[]; // Low Volume Nodes
  totalVolume: number;
  bins: VolumeProfileBin[];
  rangeType: 'SESSION' | 'DAY' | 'CUSTOM';
  source: string;
  isAvailable: boolean;
}

export interface OrderFlowState {
  delta: number;
  cvd: number;
  buyVolume: number;
  sellVolume: number;
  volumeSpike: boolean;
  deltaSpike: boolean;
  absorptionState: 'None' | 'Bullish Absorption' | 'Bearish Absorption';
  aggressiveState: 'Neutral' | 'Aggressive Buyers' | 'Aggressive Sellers';
  source: string;
  isAvailable: boolean;
}

export interface MarketStructureState {
  trend: 'Strong Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bearish';
  recentSwing: 'HH' | 'HL' | 'LH' | 'LL';
  bos: { type: 'Bullish BOS' | 'Bearish BOS'; price: number; time: number } | null;
  choch: { type: 'Bullish CHOCH' | 'Bearish CHOCH'; price: number; time: number } | null;
  lastSweep: { level: string; price: number; time: number } | null;
  displacement: boolean;
  consolidation: boolean;
  rangeHigh: number;
  rangeLow: number;
}

export interface TradingZone {
  id: string;
  type: 'Pullback Zone' | 'Reversal Zone';
  priceMin: number;
  priceMax: number;
  strength: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  createdAt: number;
  status: 'ACTIVE' | 'TESTED' | 'INVALIDATED';
  distancePips: number;
  source: 'Derived Zone';
}

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  time: string;
  timestamp: number;
  impact: 'High' | 'Medium' | 'Low';
  forecast: string;
  previous: string;
  actual: string;
  countdownText: string;
  isUpcoming: boolean;
  isHighImpact: boolean;
  relevanceToGold: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: number;
  publishedFormatted: string;
  category: 'FED' | 'US DATA' | 'INFLATION' | 'YIELDS' | 'GEOPOLITICAL' | 'GOLD-SPECIFIC' | 'GLOBAL';
  relevance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  marketRelevanceComment: string;
}

export interface COTReport {
  market: string;
  reportDate: string;
  openInterest: number;
  managedMoneyLong: number;
  managedMoneyShort: number;
  netPosition: number;
  changeLong: number;
  changeShort: number;
  changeNet: number;
  openInterestChange: number;
  percentile52w: number;
  sentiment: 'Bullish' | 'Neutral' | 'Bearish';
  source: 'CFTC Commitments of Traders';
  isWeekly: true;
}

export interface VolatilityState {
  atr5m: number;
  atr15m: number;
  atr1h: number;
  atrDaily: number;
  regime5m: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  regime1h: 'LOW' | 'MEDIUM' | 'HIGH';
  current5mRange: number;
  avg5mRange: number;
  rangeExpansionRatio: number;
  percentile: number;
}

export interface SessionInfo {
  currentSession: string;
  isAsian: boolean;
  isLondon: boolean;
  isNewYork: boolean;
  isLondonNYOverlap: boolean;
  asianRange?: { high: number; low: number };
  londonRange?: { high: number; low: number };
  nyRange?: { high: number; low: number };
  sessionTimeLeftFormatted: string;
  timezone: string;
}

export interface MarketRegime {
  usdPressure: 'Bearish pressure' | 'Bullish pressure' | 'Neutral';
  yieldsState: 'Falling' | 'Rising' | 'Consolidating';
  riskSentiment: 'Risk-On' | 'Risk-Off' | 'Neutral';
  momentum: 'Positive' | 'Negative' | 'Neutral';
  volatilityRegime: 'Low' | 'Moderate' | 'Elevated' | 'Extreme';
  newsRisk: 'Low' | 'Medium' | 'High' | 'CRITICAL EVENT AHEAD';
  trendAlignment: 'HIGH' | 'MEDIUM' | 'LOW';
  macroAlignment: 'HIGH' | 'MEDIUM' | 'LOW';
  overallContext: string;
  activeEventWarning: string | null;
  summaryBullets: string[];
}

export interface MarketBiasVerdict {
  bias: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  confidenceScore: number; // 0 to 100
  verdictTitle: string;
  executiveSummary: string;
  pillars: {
    technicals: {
      score: number; // -100 to +100
      rating: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      weight: number;
      summary: string;
      details: string[];
    };
    macro: {
      score: number; // -100 to +100
      rating: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      weight: number;
      summary: string;
      details: string[];
    };
    orderflow: {
      score: number; // -100 to +100
      rating: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      weight: number;
      summary: string;
      details: string[];
    };
    eventRisk: {
      score: number; // -100 to +100
      rating: 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK';
      weight: number;
      summary: string;
      details: string[];
    };
  };
  playbook: {
    biasAction: string;
    primaryZone: { label: string; min: number; max: number; type: 'SUPPORT' | 'RESISTANCE' };
    invalidationPrice: number;
    targetResistance: number;
  };
  updatedAt: number;
}

export interface AlertRule {
  id: string;
  title: string;
  type: 'PRICE_LEVEL' | 'STRUCTURE_BREAK' | 'ZONE_ENTER' | 'VOLUME_SPIKE' | 'MACRO_SPIKE' | 'NEWS_HIGH_IMPACT';
  targetValue: number | string;
  condition: 'ABOVE' | 'BELOW' | 'TOUCH' | 'BREAK' | 'TRIGGER';
  enabled: boolean;
  createdAt: number;
  lastTriggered?: number;
}

export interface AlertEvent {
  id: string;
  ruleId?: string;
  type: string;
  title: string;
  message: string;
  timestamp: number;
  level: 'info' | 'warning' | 'critical';
  read: boolean;
}

export interface ProviderHealth {
  id: string;
  name: string;
  category: string;
  status: 'healthy' | 'degraded' | 'rate_limited' | 'offline' | 'stale';
  latencyMs: number;
  lastUpdated: number;
  endpoint: string;
  attribution: string;
  details?: string;
}

export interface TerminalSettings {
  defaultSymbol: string;
  defaultTimeframe: Timeframe;
  timezone: string;
  theme: 'dark';
  soundAlerts: boolean;
  voiceAlerts?: boolean;
  browserNotifications: boolean;
  newsFilterThreshold: 'HIGH' | 'MEDIUM' | 'LOW';
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramNewsAlerts?: boolean;
  userApiKeys: {
    fredApiKey?: string;
    finnhubKey?: string;
    goldApiKey?: string;
  };
}
