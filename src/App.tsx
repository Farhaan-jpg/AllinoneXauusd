import React, { useCallback, useEffect, useState } from 'react';
import { CalendarPanel } from './components/CalendarPanel';
import { ChartSection } from './components/ChartSection';
import { COTPanel } from './components/COTPanel';
import { DiagnosticsView } from './components/DiagnosticsView';
import { Header } from './components/Header';
import { HeroPriceBar } from './components/HeroPriceBar';
import { LiquidityOrderFlowPanel } from './components/LiquidityOrderFlowPanel';
import { MacroPanel } from './components/MacroPanel';
import { MarketRegimeCard } from './components/MarketRegimeCard';
import { MobileNav, MobileTab } from './components/MobileNav';
import { MTFMatrixPanel } from './components/MTFMatrixPanel';
import { NewsPanel } from './components/NewsPanel';
import { SettingsModal } from './components/SettingsModal';
import { ZonesAlertsPanel } from './components/ZonesAlertsPanel';

import { alertEngine } from './services/engines/alertEngine';
import { CorrelationEngine } from './services/engines/correlationEngine';
import { LiquidityEngine } from './services/engines/liquidityEngine';
import { MTFEngine, MTFMatrixState } from './services/engines/mtfEngine';
import { OrderFlowEngine } from './services/engines/orderFlowEngine';
import { RegimeEngine } from './services/engines/regimeEngine';
import { SessionEngine } from './services/engines/sessionEngine';
import { StructureEngine } from './services/engines/structureEngine';
import { VolatilityEngine } from './services/engines/volatilityEngine';
import { VolumeProfileEngine } from './services/engines/volumeProfileEngine';
import { ZoneEngine } from './services/engines/zoneEngine';

import { calendarProvider } from './services/providers/calendarProvider';
import { cotProvider } from './services/providers/cotProvider';
import { macroDataProvider } from './services/providers/macroDataProvider';
import { marketDataProvider } from './services/providers/marketDataProvider';
import { newsProvider } from './services/providers/newsProvider';
import { providerStatusManager } from './services/providers/providerStatusManager';

import {
  AlertEvent,
  AlertRule,
  Candle,
  CorrelationItem,
  EconomicEvent,
  LiquidityLevel,
  MacroQuotes,
  MarketQuote,
  MarketRegime,
  MarketStructureState,
  NewsArticle,
  OrderFlowState,
  ProviderHealth,
  SessionInfo,
  TerminalSettings,
  Timeframe,
  TradingZone,
  VolatilityState,
  VolumeProfile,
} from './types/market';

const DEFAULT_SETTINGS: TerminalSettings = {
  defaultSymbol: 'OANDA:XAUUSD',
  defaultTimeframe: '5m',
  timezone: 'Asia/Kolkata',
  theme: 'dark',
  soundAlerts: true,
  voiceAlerts: true,
  browserNotifications: false,
  newsFilterThreshold: 'MEDIUM',
  telegramBotToken: '',
  telegramChatId: '',
  telegramNewsAlerts: true,
  userApiKeys: {},
};

export const App: React.FC = () => {
  // --- SETTINGS STATE ---
  const [settings, setSettings] = useState<TerminalSettings>(() => {
    try {
      const saved = localStorage.getItem('xauusd_terminal_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          userApiKeys: { ...DEFAULT_SETTINGS.userApiKeys, ...(parsed.userApiKeys || {}) },
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>(() => {
    try {
      const saved = localStorage.getItem('xauusd_terminal_timeframe');
      if (saved) return saved as Timeframe;
    } catch {
      // ignore
    }
    return settings.defaultTimeframe;
  });

  const [profileRange, setProfileRange] = useState<'SESSION' | 'DAY' | 'CUSTOM'>(() => {
    try {
      const saved = localStorage.getItem('xauusd_terminal_profile_range');
      if (saved === 'SESSION' || saved === 'DAY' || saved === 'CUSTOM') return saved;
    } catch {
      // ignore
    }
    return 'SESSION';
  });

  const [correlationWindow, setCorrelationWindow] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('xauusd_terminal_correlation_window');
      if (saved) return Number(saved) || 20;
    } catch {
      // ignore
    }
    return 20;
  });

  const [mobileTab, setMobileTab] = useState<MobileTab>('OVERVIEW');

  const handleSelectTimeframe = (tf: Timeframe) => {
    setCurrentTimeframe(tf);
    try {
      localStorage.setItem('xauusd_terminal_timeframe', tf);
    } catch {
      // ignore
    }
  };

  const handleSelectProfileRange = (range: 'SESSION' | 'DAY' | 'CUSTOM') => {
    setProfileRange(range);
    try {
      localStorage.setItem('xauusd_terminal_profile_range', range);
    } catch {
      // ignore
    }
  };

  const handleSelectCorrelationWindow = (win: number) => {
    setCorrelationWindow(win);
    try {
      localStorage.setItem('xauusd_terminal_correlation_window', String(win));
    } catch {
      // ignore
    }
  };

  // --- MODAL STATES ---
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  // --- MARKET DATA STATE ---
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [macro, setMacro] = useState<MacroQuotes | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<EconomicEvent[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [cot, setCot] = useState<any | null>(null);

  // --- QUANTITATIVE ENGINE DERIVED STATES ---
  const [structure, setStructure] = useState<MarketStructureState>({
    trend: 'Neutral',
    recentSwing: 'HL',
    bos: null,
    choch: null,
    lastSweep: null,
    displacement: false,
    consolidation: false,
    rangeHigh: 0,
    rangeLow: 0,
  });
  const [liquidityLevels, setLiquidityLevels] = useState<LiquidityLevel[]>([]);
  const [volumeProfile, setVolumeProfile] = useState<VolumeProfile | null>(null);
  const [orderFlow, setOrderFlow] = useState<OrderFlowState>({
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
  });
  const [zones, setZones] = useState<TradingZone[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationItem[]>([]);
  const [volatility, setVolatility] = useState<VolatilityState>({
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
  });
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>(() =>
    SessionEngine.getSessionInfo(settings.timezone)
  );
  const [regime, setRegime] = useState<MarketRegime | null>(null);

  // --- MULTI-TIMEFRAME (MTF) MATRIX STATE (Feature 5) ---
  const [candlesByTf, setCandlesByTf] = useState<Partial<Record<Timeframe, Candle[]>>>({});
  const [mtfState, setMtfState] = useState<MTFMatrixState>(() =>
    MTFEngine.computeMatrix({}, 2650)
  );

  // --- PROVIDER HEALTH & ALERTS ---
  const [providers, setProviders] = useState<ProviderHealth[]>(() =>
    providerStatusManager.getAll()
  );
  const [alertRules, setAlertRules] = useState<AlertRule[]>(() => alertEngine.getRules());
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>(() => alertEngine.getHistory());

  // Subscribe to AlertEngine and ProviderHealth
  useEffect(() => {
    alertEngine.setSoundEnabled(settings.soundAlerts);
    alertEngine.setVoiceEnabled(settings.voiceAlerts ?? true);
    const unsubAlerts = alertEngine.subscribe(() => {
      setAlertEvents([...alertEngine.getHistory()]);
    });
    const unsubHealth = providerStatusManager.subscribe(h => {
      setProviders(Object.values(h));
    });
    return () => {
      unsubAlerts();
      unsubHealth();
    };
  }, [settings.soundAlerts, settings.voiceAlerts]);

  // Update session info every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionInfo(SessionEngine.getSessionInfo(settings.timezone));
    }, 30000);
    return () => clearInterval(timer);
  }, [settings.timezone]);

  // --- DATA FETCHING LOOPS ---

  // 1. High-frequency Quote Loop (every 1s real-time)
  const fetchQuote = useCallback(async () => {
    try {
      const q = await marketDataProvider.getQuote();
      setQuote(q);
      // Immediately update last candle with new 1-second tick price
      if (q && q.price > 0) {
        setCandles(prev => marketDataProvider.updateLastCandle(prev, q.price));
      }
    } catch (e) {
      console.warn('Quote fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchQuote();
    const timer = setInterval(fetchQuote, 1000);
    return () => clearInterval(timer);
  }, [fetchQuote]);

  // 2. Candle Loop (every 10s or when timeframe changes)
  const fetchCandles = useCallback(async () => {
    try {
      const c = await marketDataProvider.getCandles(currentTimeframe, 150);
      setCandles(c);
      setCandlesByTf(prev => ({
        ...prev,
        [currentTimeframe]: c,
      }));
    } catch (e) {
      console.warn('Candle fetch error:', e);
    }
  }, [currentTimeframe]);

  useEffect(() => {
    fetchCandles();
    const timer = setInterval(fetchCandles, 10000);
    return () => clearInterval(timer);
  }, [fetchCandles]);

  // Preload other timeframes in background with low frequency (every 60s)
  useEffect(() => {
    const preloadOtherTimeframes = async () => {
      const otherTfs: Timeframe[] = (['1m', '5m', '15m', '1H', '4H', '1D'] as Timeframe[])
        .filter(tf => tf !== currentTimeframe);
      for (const tf of otherTfs) {
        try {
          const c = await marketDataProvider.getCandles(tf, 60);
          if (c.length > 0) {
            setCandlesByTf(prev => ({ ...prev, [tf]: c }));
          }
        } catch {
          // ignore background fetch error
        }
      }
    };
    preloadOtherTimeframes();
    const interval = setInterval(preloadOtherTimeframes, 60000);
    return () => clearInterval(interval);
  }, [currentTimeframe]);

  // 3. Macro Loop (every 15s)
  const fetchMacro = useCallback(async () => {
    try {
      const m = await macroDataProvider.getMacroQuotes(quote?.price);
      setMacro(m);
    } catch (e) {
      console.warn('Macro fetch error:', e);
    }
  }, [quote?.price]);

  useEffect(() => {
    fetchMacro();
    const timer = setInterval(fetchMacro, 15000);
    return () => clearInterval(timer);
  }, [fetchMacro]);

  // 4. Calendar Events (every 3m)
  const fetchCalendar = useCallback(async () => {
    try {
      const events = await calendarProvider.getEvents();
      setCalendarEvents(events);
    } catch (e) {
      console.warn('Calendar fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchCalendar();
    const timer = setInterval(fetchCalendar, 180000);
    return () => clearInterval(timer);
  }, [fetchCalendar]);

  // 5. News Loop (every 60s)
  const fetchNews = useCallback(async () => {
    try {
      const news = await newsProvider.getNews();
      setNewsArticles(news);
    } catch (e) {
      console.warn('News fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const timer = setInterval(fetchNews, 60000);
    return () => clearInterval(timer);
  }, [fetchNews]);

  // 6. CFTC COT Loop (initial load)
  useEffect(() => {
    cotProvider.getCOTReport().then(setCot).catch(console.warn);
  }, []);

  // --- RE-EVALUATE QUANTITATIVE ENGINES ON DATA CHANGE ---
  useEffect(() => {
    if (!quote || candles.length < 5) return;

    // 1. Structure
    const newStructure = StructureEngine.analyze(candles);
    setStructure(newStructure);

    // 2. Liquidity Levels
    const newLiquidity = LiquidityEngine.deriveLevels(candles, quote.price);
    setLiquidityLevels(newLiquidity);

    // 3. Volume Profile
    const newProfile = VolumeProfileEngine.calculate(candles, profileRange);
    setVolumeProfile(newProfile);

    // 4. Order Flow
    const newOrderFlow = OrderFlowEngine.analyze(candles);
    setOrderFlow(newOrderFlow);

    // 5. Reaction Zones
    const newZones = ZoneEngine.identifyZones(candles, quote.price, newProfile, newLiquidity);
    setZones(newZones);

    // 6. Volatility
    const newVol = VolatilityEngine.calculate(candles, quote.high24h, quote.low24h);
    setVolatility(newVol);

    // 7. Correlations
    const goldSeries = candles.map(c => c.close);
    const macroMap: Record<string, number[]> = {
      dxy: macroDataProvider.getCachedSeries('dxy'),
      us10y: macroDataProvider.getCachedSeries('us10y'),
      us02y: macroDataProvider.getCachedSeries('us02y'),
      vix: macroDataProvider.getCachedSeries('vix'),
      silver: macroDataProvider.getCachedSeries('silver'),
      oil: macroDataProvider.getCachedSeries('oil'),
      usdjpy: macroDataProvider.getCachedSeries('usdjpy'),
    };
    const newCorrs = CorrelationEngine.calculateAll(goldSeries, macroMap, correlationWindow);
    setCorrelations(newCorrs);

    // 8. Regime & Context
    const newRegime = RegimeEngine.evaluate(quote, newStructure, macro, newVol, calendarEvents);
    setRegime(newRegime);

    // 9. Alert Evaluation
    alertEngine.evaluate(
      quote,
      newStructure,
      newZones,
      newLiquidity,
      newOrderFlow,
      calendarEvents,
      newsArticles,
      {
        botToken: settings.telegramBotToken,
        chatId: settings.telegramChatId,
        sendNewsAlerts: settings.telegramNewsAlerts ?? true,
      }
    );

    // 10. Multi-Timeframe Matrix (Feature 5)
    const newMtf = MTFEngine.computeMatrix(
      { ...candlesByTf, [currentTimeframe]: candles },
      quote.price
    );
    setMtfState(newMtf);
  }, [quote, candles, macro, calendarEvents, newsArticles, profileRange, correlationWindow, settings.telegramBotToken, settings.telegramChatId, settings.telegramNewsAlerts, candlesByTf, currentTimeframe]);

  // --- SETTINGS HANDLERS ---
  const handleSaveSettings = (newSettings: TerminalSettings) => {
    setSettings(newSettings);
    setCurrentTimeframe(newSettings.defaultTimeframe);
    try {
      localStorage.setItem('xauusd_terminal_settings', JSON.stringify(newSettings));
    } catch {
      // ignore
    }
  };

  const handleToggleSound = () => {
    const next = !settings.soundAlerts;
    handleSaveSettings({ ...settings, soundAlerts: next });
  };

  const isLive = quote?.status === 'LIVE';
  const isDelayed = quote?.status === 'DELAYED';
  const unreadAlerts = alertEvents.filter(e => !e.read).length;

  return (
    <div className="min-h-screen bg-[#090b10] text-[#cbd5e1] flex flex-col font-sans pb-16 lg:pb-6">
      {/* 1. Master Header */}
      <Header
        sessionInfo={sessionInfo}
        isLive={isLive}
        isDelayed={isDelayed}
        settings={settings}
        unreadAlertsCount={unreadAlerts}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onToggleSound={handleToggleSound}
      />

      {/* 2. Hero Price & Market State Bar */}
      <HeroPriceBar
        quote={quote}
        structure={structure}
        regime={regime}
        volatility={volatility}
        currentTimeframe={currentTimeframe}
        onSelectTimeframe={handleSelectTimeframe}
      />

      {/* 3. Main Terminal Content Grid */}
      <main className="max-w-7xl w-full mx-auto px-2 sm:px-4 py-3 sm:py-4 space-y-4 flex-1">
        {/* Multi-Timeframe Trend Matrix Ribbon (Feature 5) */}
        <MTFMatrixPanel
          matrixState={mtfState}
          currentTimeframe={currentTimeframe}
          onSelectTimeframe={handleSelectTimeframe}
        />

        {/* Mobile Tab Filtering: On mobile (screen < lg), switch views cleanly */}
        <div className="lg:block">
          {/* CHART VIEW (Shown on desktop OR when mobileTab is OVERVIEW or CHART) */}
          <div className={`${mobileTab === 'OVERVIEW' || mobileTab === 'CHART' ? 'block' : 'hidden lg:block'}`}>
            <ChartSection
              timeframe={currentTimeframe}
              candles={candles}
              liquidityLevels={liquidityLevels}
              profile={volumeProfile}
              zones={zones}
              structure={structure}
              quote={quote}
            />
          </div>
        </div>

        {/* OVERVIEW & CONTEXT (Desktop: below chart; Mobile: on OVERVIEW tab) */}
        <div className={`${mobileTab === 'OVERVIEW' ? 'block' : 'hidden lg:block'} space-y-4`}>
          {/* Regime & Factual Context Summary */}
          <MarketRegimeCard regime={regime} />

          {/* Dual Panel: Liquidity & Order Flow / Macro Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LiquidityOrderFlowPanel
              liquidityLevels={liquidityLevels}
              profile={volumeProfile}
              orderFlow={orderFlow}
              currentPrice={quote?.price || 0}
              profileRange={profileRange}
              onChangeProfileRange={handleSelectProfileRange}
            />

            <MacroPanel
              macro={macro}
              correlations={correlations}
              selectedWindow={correlationWindow}
              onSelectWindow={handleSelectCorrelationWindow}
            />
          </div>
        </div>

        {/* MACRO TAB (Mobile specific when MACRO tab selected) */}
        <div className={`${mobileTab === 'MACRO' ? 'block' : 'hidden'}`}>
          <MacroPanel
            macro={macro}
            correlations={correlations}
            selectedWindow={correlationWindow}
            onSelectWindow={handleSelectCorrelationWindow}
          />
        </div>

        {/* NEWS & CALENDAR GRID (Desktop: 2 columns; Mobile: on NEWS tab) */}
        <div className={`${mobileTab === 'OVERVIEW' || mobileTab === 'NEWS' ? 'block' : 'hidden lg:block'} space-y-4`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <NewsPanel articles={newsArticles} />
            <CalendarPanel events={calendarEvents} />
          </div>
        </div>

        {/* CFTC POSITIONING & REACTION ZONES (Desktop: 2 columns; Mobile: on OVERVIEW tab) */}
        <div className={`${mobileTab === 'OVERVIEW' ? 'block' : 'hidden lg:block'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <COTPanel cot={cot} />
            <ZonesAlertsPanel
              zones={zones}
              rules={alertRules}
              events={alertEvents}
              currentPrice={quote?.price || 0}
              onAddRule={rule => {
                alertEngine.addRule(rule);
                setAlertRules(alertEngine.getRules());
              }}
              onRemoveRule={id => {
                alertEngine.removeRule(id);
                setAlertRules(alertEngine.getRules());
              }}
              onToggleRule={(id, enabled) => {
                alertEngine.toggleRule(id, enabled);
                setAlertRules(alertEngine.getRules());
              }}
              onClearHistory={() => {
                alertEngine.clearHistory();
                setAlertEvents([]);
              }}
            />
          </div>
        </div>
      </main>

      {/* 4. Mobile Bottom Navigation */}
      <MobileNav
        activeTab={mobileTab}
        onSelectTab={tab => {
          if (tab === 'SETTINGS') {
            setIsSettingsOpen(true);
          } else {
            setMobileTab(tab);
          }
        }}
      />

      {/* 5. Modals */}
      <DiagnosticsView
        providers={providers}
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        onRefreshAll={() => {
          fetchQuote();
          fetchCandles();
          fetchMacro();
          fetchNews();
          fetchCalendar();
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onSave={handleSaveSettings}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Floating Alerts History Modal */}
      {isAlertsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 z-50">
          <div className="bg-[#0f131a] border border-[#252f42] rounded-lg max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono">
            <div className="p-3 bg-[#131822] border-b border-[#202738] flex items-center justify-between">
              <span className="text-sm font-bold text-amber-400">Terminal Alert History & Triggers</span>
              <button
                onClick={() => setIsAlertsOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
              {alertEvents.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  No alerts triggered in current session.
                </div>
              ) : (
                alertEvents.map(evt => (
                  <div
                    key={evt.id}
                    className="p-2.5 rounded border border-[#222a3a] bg-[#121620] text-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-zinc-200">{evt.title}</span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-zinc-400 mt-1">{evt.message}</div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 bg-[#131822] border-t border-[#202738] flex justify-between">
              <button
                onClick={() => {
                  alertEngine.clearHistory();
                  setAlertEvents([]);
                }}
                className="px-3 py-1 bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs rounded"
              >
                Clear
              </button>
              <button
                onClick={() => setIsAlertsOpen(false)}
                className="px-3 py-1 bg-amber-500 text-zinc-950 font-bold text-xs rounded hover:bg-amber-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
