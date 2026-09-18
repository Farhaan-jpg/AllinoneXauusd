import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Layers, Maximize2, ShieldCheck } from 'lucide-react';
import { Candle, LiquidityLevel, MarketStructureState, Timeframe, TradingZone, VolumeProfile } from '../types/market';

interface ChartSectionProps {
  timeframe: Timeframe;
  candles: Candle[];
  liquidityLevels: LiquidityLevel[];
  profile: VolumeProfile | null;
  zones: TradingZone[];
  structure: MarketStructureState;
}

export const ChartSection: React.FC<ChartSectionProps> = ({
  timeframe,
  candles,
  liquidityLevels,
  profile,
  zones,
  structure,
}) => {
  const [chartMode, setChartMode] = useState<'TRADINGVIEW' | 'TERMINAL_ANALYTICS'>('TRADINGVIEW');
  const [showLiquidity, setShowLiquidity] = useState(true);
  const [showProfile, setShowProfile] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showStructure, setShowStructure] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Render Terminal Analytics Chart on HTML5 Canvas
  useEffect(() => {
    if (chartMode !== 'TERMINAL_ANALYTICS') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    const height = (canvas.height = 420);

    // Background
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    if (candles.length < 5) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Loading candles...', width / 2, height / 2);
      return;
    }

    const visibleCandles = candles.slice(-60);
    const high = Math.max(...visibleCandles.map(c => c.high));
    const low = Math.min(...visibleCandles.map(c => c.low));
    const range = high - low || 1;

    const priceToY = (price: number) => {
      const pad = 24;
      return pad + (height - 2 * pad) * (1 - (price - low) / range);
    };

    // Draw grid lines
    ctx.strokeStyle = '#181e2b';
    ctx.lineWidth = 1;
    for (let p = Math.ceil(low); p <= Math.floor(high); p += Math.max(1, Math.round(range / 5))) {
      const y = priceToY(p);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width - 55, y);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`$${p.toFixed(2)}`, width - 50, y + 3);
    }

    // Draw Reaction Zones
    if (showZones && zones) {
      zones.slice(0, 4).forEach(z => {
        const topY = priceToY(z.priceMax);
        const botY = priceToY(z.priceMin);
        const zHeight = Math.max(2, botY - topY);

        ctx.fillStyle = z.type === 'Pullback Zone' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(0, topY, width - 55, zHeight);

        ctx.strokeStyle = z.type === 'Pullback Zone' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(0, topY, width - 55, zHeight);
        ctx.setLineDash([]);

        ctx.fillStyle = z.type === 'Pullback Zone' ? '#60a5fa' : '#f87171';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${z.type} ($${z.priceMin.toFixed(1)}-$${z.priceMax.toFixed(1)})`, width - 60, topY + 12);
      });
    }

    // Draw Volume Profile lines (POC, VAH, VAL)
    if (showProfile && profile && profile.poc > 0) {
      // POC Line
      const pocY = priceToY(profile.poc);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, pocY);
      ctx.lineTo(width - 55, pocY);
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`POC: $${profile.poc.toFixed(2)}`, 8, pocY - 4);

      // VAH / VAL Lines
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      const vahY = priceToY(profile.vah);
      ctx.beginPath();
      ctx.moveTo(0, vahY);
      ctx.lineTo(width - 55, vahY);
      ctx.stroke();
      ctx.fillText(`VAH: $${profile.vah.toFixed(2)}`, 8, vahY - 4);

      const valY = priceToY(profile.val);
      ctx.beginPath();
      ctx.moveTo(0, valY);
      ctx.lineTo(width - 55, valY);
      ctx.stroke();
      ctx.fillText(`VAL: $${profile.val.toFixed(2)}`, 8, valY + 12);
      ctx.setLineDash([]);
    }

    // Draw Derived Liquidity Levels
    if (showLiquidity && liquidityLevels) {
      liquidityLevels.slice(0, 4).forEach(l => {
        if (l.price >= low && l.price <= high) {
          const y = priceToY(l.price);
          ctx.strokeStyle = l.type === 'HIGH' ? '#059669' : '#dc2626';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width - 55, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = l.type === 'HIGH' ? '#34d399' : '#f87171';
          ctx.font = '10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`${l.label} (${l.status})`, width * 0.45, y - 3);
        }
      });
    }

    // Draw Candlesticks
    const chartW = width - 60;
    const candleW = Math.max(3, chartW / visibleCandles.length - 2);

    visibleCandles.forEach((c, idx) => {
      const x = 10 + idx * (chartW / visibleCandles.length);
      const isUp = c.close >= c.open;
      const bodyTop = priceToY(Math.max(c.open, c.close));
      const bodyBot = priceToY(Math.min(c.open, c.close));
      const wickTop = priceToY(c.high);
      const wickBot = priceToY(c.low);

      const color = isUp ? '#10b981' : '#ef4444';

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + candleW / 2, wickTop);
      ctx.lineTo(x + candleW / 2, wickBot);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      ctx.fillRect(x, bodyTop, candleW, Math.max(1.5, bodyBot - bodyTop));
    });

    // Structure Markers (BOS / CHOCH / Sweep)
    if (showStructure) {
      if (structure.bos) {
        const y = priceToY(structure.bos.price);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`⚡ ${structure.bos.type}`, width - 70, y - 6);
      }
      if (structure.choch) {
        const y = priceToY(structure.choch.price);
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`🔄 ${structure.choch.type}`, width - 70, y - 6);
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
            {chartMode === 'TRADINGVIEW' ? 'OANDA:XAUUSD Feed' : 'Terminal Overlay Canvas'}
          </span>
        </div>

        {/* Mode Selector & Quick Links */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Chart Mode Toggle */}
          <div className="bg-[#151a24] p-0.5 rounded border border-[#232b3c] flex items-center">
            <button
              onClick={() => setChartMode('TRADINGVIEW')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                chartMode === 'TRADINGVIEW'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              TradingView Official
            </button>
            <button
              onClick={() => setChartMode('TERMINAL_ANALYTICS')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                chartMode === 'TERMINAL_ANALYTICS'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
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
              onChange={e => setShowLiquidity(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span>Liquidity Levels</span>
          </label>
          <label className="flex items-center gap-1 text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showProfile}
              onChange={e => setShowProfile(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>Volume Profile (POC/VAH/VAL)</span>
          </label>
          <label className="flex items-center gap-1 text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showZones}
              onChange={e => setShowZones(e.target.checked)}
              className="accent-blue-500 rounded"
            />
            <span>Reaction Zones</span>
          </label>
          <label className="flex items-center gap-1 text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showStructure}
              onChange={e => setShowStructure(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <span>BOS / CHOCH</span>
          </label>
        </div>
      )}

      {/* Chart Canvas or TradingView Embed */}
      <div className="relative w-full bg-[#0a0d14] min-h-[420px] sm:min-h-[480px]">
        {chartMode === 'TRADINGVIEW' ? (
          <iframe
            title="TradingView OANDA XAUUSD"
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=OANDA%3AXAUUSD&interval=${tvInterval}&theme=dark&style=1&locale=en&enable_publishing=false&hide_top_toolbar=false&hide_legend=false&save_image=false`}
            className="w-full h-[440px] sm:h-[500px] border-0"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-[420px] p-2 flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full block" />
          </div>
        )}
      </div>

      {/* Chart Footer Note */}
      <div className="px-3 py-1.5 bg-[#090b10] border-t border-[#1a202c] text-[10px] text-zinc-500 font-mono flex items-center justify-between">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          Primary reference: OANDA:XAUUSD • Timeframe: {timeframe.toUpperCase()}
        </span>
        <span>Zero scraping • Official TradingView embed compliant</span>
      </div>
    </div>
  );
};
