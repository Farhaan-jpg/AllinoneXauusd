import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { Candle, LiquidityLevel, MarketQuote, MarketStructureState, Timeframe, TradingZone, VolumeProfile } from '../types/market';

interface ChartSectionProps {
  timeframe: Timeframe;
  candles?: Candle[];
  liquidityLevels?: LiquidityLevel[];
  profile?: VolumeProfile | null;
  zones?: TradingZone[];
  structure?: MarketStructureState;
  quote?: MarketQuote | null;
  onSelectTimeframe?: (tf: Timeframe) => void;
}

export const ChartSection: React.FC<ChartSectionProps> = ({
  timeframe,
  quote,
  onSelectTimeframe,
}) => {
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

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D'];

  return (
    <div className="terminal-card overflow-hidden">
      {/* Chart Header Bar */}
      <div className="terminal-header flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-200 font-bold tracking-wider font-mono">
            XAUUSD {timeframe.toUpperCase()} CHART
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            TradingView OANDA:XAUUSD Official Feed
          </span>
          {quote && quote.price > 0 && (
            <span className="text-[11px] font-mono font-bold text-amber-400 bg-[#151a24] px-1.5 py-0.5 rounded border border-[#232b3c]">
              ${quote.price.toFixed(2)}
            </span>
          )}
        </div>

        {/* Timeframe Selector & TradingView Links */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Timeframe quick switches */}
          <div className="bg-[#151a24] p-0.5 rounded border border-[#232b3c] flex items-center font-mono">
            {timeframes.map(tf => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe?.(tf)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Full TV external link */}
          <a
            href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 transition-colors"
          >
            <span>TradingView Full</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Official Authentic TradingView Chart Embed */}
      <div className="relative w-full bg-[#0a0d14] h-[480px] sm:h-[540px]">
        <iframe
          title="TradingView OANDA XAUUSD"
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=OANDA%3AXAUUSD&interval=${tvInterval}&theme=dark&style=1&locale=en&enable_publishing=false&hide_top_toolbar=false&hide_legend=false&save_image=false`}
          className="w-full h-full border-0"
          loading="eager"
          allowFullScreen
        />
      </div>

      {/* Chart Footer Note */}
      <div className="px-3 py-1.5 bg-[#090b10] border-t border-[#1a202c] text-[10px] text-zinc-500 font-mono flex items-center justify-between">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          Primary Reference: OANDA:XAUUSD • Timeframe: {timeframe.toUpperCase()}
        </span>
        <span className="text-emerald-400 font-medium">TradingView Official Engine • 100% Authentic Live Stream</span>
      </div>
    </div>
  );
};
