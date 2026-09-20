import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Layers, ShieldCheck, Zap } from 'lucide-react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  LineStyle,
  UTCTimestamp,
} from 'lightweight-charts';
import { Candle, LiquidityLevel, MarketQuote, MarketStructureState, Timeframe, TradingZone, VolumeProfile } from '../types/market';

interface ChartSectionProps {
  timeframe: Timeframe;
  candles: Candle[];
  liquidityLevels: LiquidityLevel[];
  profile: VolumeProfile | null;
  zones: TradingZone[];
  structure: MarketStructureState;
  quote?: MarketQuote | null;
}

export const ChartSection: React.FC<ChartSectionProps> = ({
  timeframe,
  candles,
  liquidityLevels,
  profile,
  zones,
  structure,
  quote,
}) => {
  const [chartMode, setChartMode] = useState<'TRADINGVIEW' | 'TERMINAL_ANALYTICS'>(() => {
    try {
      const saved = localStorage.getItem('xauusd_terminal_chart_mode');
      if (saved === 'TRADINGVIEW' || saved === 'TERMINAL_ANALYTICS') return saved;
    } catch {}
    return 'TRADINGVIEW';
  });

  const [showLiquidity, setShowLiquidity] = useState(() => {
    try {
      const saved = localStorage.getItem('xauusd_overlay_liquidity');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const [showProfile, setShowProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('xauusd_overlay_profile');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const [showZones, setShowZones] = useState(() => {
    try {
      const saved = localStorage.getItem('xauusd_overlay_zones');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const [showStructure, setShowStructure] = useState(() => {
    try {
      const saved = localStorage.getItem('xauusd_overlay_structure');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const handleSetChartMode = (mode: 'TRADINGVIEW' | 'TERMINAL_ANALYTICS') => {
    setChartMode(mode);
    try {
      localStorage.setItem('xauusd_terminal_chart_mode', mode);
    } catch {}
  };

  const handleToggleLiquidity = (val: boolean) => {
    setShowLiquidity(val);
    try { localStorage.setItem('xauusd_overlay_liquidity', String(val)); } catch {}
  };

  const handleToggleProfile = (val: boolean) => {
    setShowProfile(val);
    try { localStorage.setItem('xauusd_overlay_profile', String(val)); } catch {}
  };

  const handleToggleZones = (val: boolean) => {
    setShowZones(val);
    try { localStorage.setItem('xauusd_overlay_zones', String(val)); } catch {}
  };

  const handleToggleStructure = (val: boolean) => {
    setShowStructure(val);
    try { localStorage.setItem('xauusd_overlay_structure', String(val)); } catch {}
  };

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // Map timeframe to TradingView interval format
  const tvIntervalMap: Record<Timeframe, string> = {
    '1m': '1',
    '5m': '5',
    '15m': '15',
    '1H': '60',
    '4H': '240',
    '1D': 'D',
  };
  const tvInterval = tvIntervalMap[timeframe] || '5';

  // Initialize and update Lightweight Charts
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Create chart instance if not already created
    if (!chartRef.current) {
      const chart = createChart(container, {
        width: container.clientWidth || 800,
        height: 480,
        layout: {
          background: { type: ColorType.Solid, color: '#0a0d14' },
          textColor: '#94a3b8',
          fontFamily: 'monospace',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: '#141923' },
          horzLines: { color: '#141923' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: '#3b82f6',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#1e293b',
          },
          horzLine: {
            color: '#3b82f6',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#1e293b',
          },
        },
        rightPriceScale: {
          borderColor: '#232b3c',
          scaleMargins: {
            top: 0.12,
            bottom: 0.12,
          },
        },
        timeScale: {
          borderColor: '#232b3c',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      chartRef.current = chart;
      seriesRef.current = series;

      // Responsive resize
      const handleResize = () => {
        if (container && chart) {
          chart.applyOptions({ width: container.clientWidth });
        }
      };

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
        priceLinesRef.current = [];
      };
    } else if (chartMode === 'TERMINAL_ANALYTICS') {
      // When switching into TERMINAL_ANALYTICS mode, fit content and resize
      setTimeout(() => {
        if (container && chartRef.current) {
          chartRef.current.applyOptions({ width: container.clientWidth });
          chartRef.current.timeScale().fitContent();
        }
      }, 50);
    }
  }, [chartMode]);

  // Update Candlestick Data and Overlays
  useEffect(() => {
    if (chartMode !== 'TERMINAL_ANALYTICS' || !seriesRef.current || candles.length === 0) return;

    const series = seriesRef.current;

    // Deduplicate and sort candles by timestamp
    const sorted = [...candles]
      .sort((a, b) => a.time - b.time)
      .filter((c, idx, arr) => idx === 0 || c.time > arr[idx - 1].time);

    const chartData = sorted.map(c => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    series.setData(chartData);

    // Clear previous price lines
    priceLinesRef.current.forEach(line => {
      try {
        series.removePriceLine(line);
      } catch {
        // ignore
      }
    });
    priceLinesRef.current = [];

    // 1. Overlay: Volume Profile (POC, VAH, VAL)
    if (showProfile && profile && profile.poc > 0) {
      const pocLine = series.createPriceLine({
        price: profile.poc,
        color: '#fbbf24',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `POC: $${profile.poc.toFixed(2)}`,
      });
      priceLinesRef.current.push(pocLine);

      if (profile.vah > 0) {
        const vahLine = series.createPriceLine({
          price: profile.vah,
          color: '#d97706',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `VAH: $${profile.vah.toFixed(2)}`,
        });
        priceLinesRef.current.push(vahLine);
      }

      if (profile.val > 0) {
        const valLine = series.createPriceLine({
          price: profile.val,
          color: '#d97706',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `VAL: $${profile.val.toFixed(2)}`,
        });
        priceLinesRef.current.push(valLine);
      }
    }

    // 2. Overlay: Liquidity Levels
    if (showLiquidity && liquidityLevels) {
      liquidityLevels.slice(0, 5).forEach(lvl => {
        const isHigh = lvl.type === 'HIGH';
        const line = series.createPriceLine({
          price: lvl.price,
          color: isHigh ? '#34d399' : '#f87171',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${lvl.label} (${lvl.status})`,
        });
        priceLinesRef.current.push(line);
      });
    }

    // 3. Overlay: Reaction Zones
    if (showZones && zones) {
      zones.slice(0, 3).forEach(z => {
        const isPullback = z.type === 'Pullback Zone';
        const color = isPullback ? '#3b82f6' : '#ef4444';
        const lineTop = series.createPriceLine({
          price: z.priceMax,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: false,
          title: `${z.type} Top`,
        });
        const lineBot = series.createPriceLine({
          price: z.priceMin,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: `${z.type} ($${z.priceMin.toFixed(1)}-$${z.priceMax.toFixed(1)})`,
        });
        priceLinesRef.current.push(lineTop, lineBot);
      });
    }

    // 4. Overlay: Market Structure Markers (BOS / CHOCH)
    if (showStructure && sorted.length > 0) {
      const markers: any[] = [];
      const latestTime = sorted[sorted.length - 1].time as UTCTimestamp;

      if (structure.bos) {
        const isBull = structure.bos.type.includes('Bullish');
        markers.push({
          time: latestTime,
          position: isBull ? 'belowBar' : 'aboveBar',
          color: '#38bdf8',
          shape: isBull ? 'arrowUp' : 'arrowDown',
          text: `⚡ ${structure.bos.type}`,
        });
      }

      if (structure.choch) {
        const isBull = structure.choch.type.includes('Bullish');
        markers.push({
          time: latestTime,
          position: isBull ? 'belowBar' : 'aboveBar',
          color: '#c084fc',
          shape: 'circle',
          text: `🔄 ${structure.choch.type}`,
        });
      }

      try {
        createSeriesMarkers(series, markers);
      } catch {
        // ignore marker errors if timestamps align differently
      }
    }
  }, [chartMode, candles, liquidityLevels, profile, zones, structure, showLiquidity, showProfile, showZones, showStructure]);

  return (
    <div className="terminal-card overflow-hidden">
      {/* Chart Header Bar */}
      <div className="terminal-header flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-200 font-bold tracking-wider font-mono">
            XAUUSD {timeframe.toUpperCase()} CHART
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {chartMode === 'TRADINGVIEW' ? 'TradingView OANDA:XAUUSD Feed' : 'Overlay Engine (Lightweight Charts)'}
          </span>
          {quote && (
            <span className="text-[11px] font-mono font-bold text-amber-400 bg-[#151a24] px-1.5 py-0.5 rounded border border-[#232b3c]">
              ${quote.price.toFixed(2)}
            </span>
          )}
        </div>

        {/* Mode Selector & Quick Links */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Chart Mode Toggle */}
          <div className="bg-[#151a24] p-0.5 rounded border border-[#232b3c] flex items-center">
            <button
              onClick={() => handleSetChartMode('TRADINGVIEW')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                chartMode === 'TRADINGVIEW'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              TradingView Official
            </button>
            <button
              onClick={() => handleSetChartMode('TERMINAL_ANALYTICS')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors flex items-center gap-1 ${
                chartMode === 'TERMINAL_ANALYTICS'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-400" />
              Overlay Engine
            </button>
          </div>

          {/* Direct TV Timeframe Shortcuts */}
          <div className="hidden sm:flex items-center gap-1 font-mono text-[11px]">
            <a
              href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD&interval=5"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-blue-400 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800"
              title="Open 5M in TradingView"
            >
              5M
            </a>
            <a
              href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD&interval=15"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-blue-400 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800"
              title="Open 15M in TradingView"
            >
              15M
            </a>
            <a
              href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD&interval=60"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-blue-400 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800"
              title="Open 1H in TradingView"
            >
              1H
            </a>
          </div>

          <a
            href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-mono text-[11px]"
          >
            <span>Full TV</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Interactive Overlay Intelligence HUD (Visible in both modes for instant situational awareness) */}
      <div className="bg-[#0f131d] border-b border-[#1a202c] px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] font-mono flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Reaction Zone Indicator */}
          {zones.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#151b27] px-2 py-0.5 rounded border border-[#232d40]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-zinc-400">Zone:</span>
              <span className="text-blue-300 font-semibold">{zones[0].type}</span>
              <span className="text-zinc-500 font-mono">(${zones[0].priceMin.toFixed(1)} - ${zones[0].priceMax.toFixed(1)})</span>
            </div>
          )}

          {/* Volume Profile POC */}
          {profile && profile.poc > 0 && (
            <div className="flex items-center gap-1.5 bg-[#151b27] px-2 py-0.5 rounded border border-[#232d40]">
              <span className="text-amber-400 font-bold">POC:</span>
              <span className="text-amber-300 font-semibold">${profile.poc.toFixed(2)}</span>
              {profile.vah > 0 && profile.val > 0 && (
                <span className="text-zinc-500 text-[10px]">VA: ${profile.val.toFixed(0)}-${profile.vah.toFixed(0)}</span>
              )}
            </div>
          )}

          {/* Liquidity High/Low Targets */}
          {liquidityLevels.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 bg-[#151b27] px-2 py-0.5 rounded border border-[#232d40]">
              <span className="text-emerald-400 font-semibold">Target:</span>
              <span className="text-zinc-300">{liquidityLevels[0].label} (${liquidityLevels[0].price.toFixed(2)})</span>
              <span className="text-[10px] text-zinc-500 uppercase">{liquidityLevels[0].status}</span>
            </div>
          )}

          {/* Market Structure (BOS / CHOCH) */}
          {(structure.bos || structure.choch) && (
            <div className="flex items-center gap-1.5 bg-[#151b27] px-2 py-0.5 rounded border border-[#232d40]">
              {structure.bos && (
                <span className="text-cyan-400 font-semibold flex items-center gap-1">
                  ⚡ {structure.bos.type}
                </span>
              )}
              {structure.choch && (
                <span className="text-purple-400 font-semibold flex items-center gap-1">
                  🔄 {structure.choch.type}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-400 font-semibold">TradingView OANDA:XAUUSD Synced</span>
        </div>
      </div>

      {/* Analytics Overlay Toggles (when in TERMINAL_ANALYTICS mode) */}
      {chartMode === 'TERMINAL_ANALYTICS' && (
        <div className="bg-[#121622] border-b border-[#1e2430] px-3 py-1.5 flex items-center gap-3 text-[11px] font-mono flex-wrap">
          <span className="text-zinc-500 font-semibold flex items-center gap-1">
            <Layers className="w-3 h-3" /> OVERLAYS:
          </span>
          <label className="flex items-center gap-1 text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showLiquidity}
              onChange={e => handleToggleLiquidity(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span>Liquidity Levels</span>
          </label>
          <label className="flex items-center gap-1 text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showProfile}
              onChange={e => handleToggleProfile(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>Volume Profile (POC/VAH/VAL)</span>
          </label>
          <label className="flex items-center gap-1 text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showZones}
              onChange={e => handleToggleZones(e.target.checked)}
              className="accent-blue-500 rounded"
            />
            <span>Reaction Zones</span>
          </label>
          <label className="flex items-center gap-1 text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showStructure}
              onChange={e => handleToggleStructure(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <span>BOS / CHOCH</span>
          </label>
        </div>
      )}

      {/* Chart Canvas & TradingView Embed (Both persistent in DOM for instantaneous switching) */}
      <div className="relative w-full bg-[#0a0d14] min-h-[440px] sm:min-h-[480px]">
        <div className={chartMode === 'TRADINGVIEW' ? 'w-full h-[440px] sm:h-[500px]' : 'hidden'}>
          <iframe
            title="TradingView OANDA XAUUSD"
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=OANDA%3AXAUUSD&interval=${tvInterval}&theme=dark&style=1&locale=en&enable_publishing=false&hide_top_toolbar=false&hide_legend=false&save_image=false`}
            className="w-full h-full border-0"
            loading="eager"
            allowFullScreen
          />
        </div>
        <div
          ref={chartContainerRef}
          className={chartMode === 'TERMINAL_ANALYTICS' ? 'w-full h-[440px] sm:h-[480px]' : 'hidden'}
        />
      </div>

      {/* Chart Footer Note */}
      <div className="px-3 py-1.5 bg-[#090b10] border-t border-[#1a202c] text-[10px] text-zinc-500 font-mono flex items-center justify-between">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          Primary reference: OANDA:XAUUSD • Timeframe: {timeframe.toUpperCase()}
        </span>
        <span>TradingView Engine Synced • Real-Time Spot Data</span>
      </div>
    </div>
  );
};

