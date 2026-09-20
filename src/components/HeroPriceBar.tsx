import React from 'react';
import { TrendingDown, TrendingUp, AlertTriangle, ShieldAlert, Zap } from 'lucide-react';
import { MarketQuote, MarketRegime, MarketStructureState, Timeframe, VolatilityState } from '../types/market';

interface HeroPriceBarProps {
  quote: MarketQuote | null;
  structure: MarketStructureState;
  regime: MarketRegime | null;
  volatility: VolatilityState;
  currentTimeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
}

export const HeroPriceBar: React.FC<HeroPriceBarProps> = ({
  quote,
  structure,
  regime,
  volatility,
  currentTimeframe,
  onSelectTimeframe,
}) => {
  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D'];

  const isPositive = (quote?.changePercent24h ?? 0) >= 0;
  const priceFormatted = quote ? quote.price.toFixed(2) : '----.--';
  const changeFormatted = quote
    ? `${isPositive ? '+' : ''}${quote.change24h.toFixed(2)} (${isPositive ? '+' : ''}${quote.changePercent24h.toFixed(2)}%)`
    : '--';

  return (
    <div className="bg-[#0f131a] border-b border-[#1e2430] px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Primary Price Display */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-zinc-400">
                XAU / USD
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                SPOT
              </span>
            </div>
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className="font-mono text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
                ${priceFormatted}
              </span>
              <div className={`flex items-center gap-1 font-mono text-xs sm:text-sm font-bold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{changeFormatted}</span>
              </div>
            </div>
          </div>

          {/* Stat Pills: Bid/Ask, High/Low, Spread */}
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 sm:gap-4 text-xs font-mono border-l sm:border-l-zinc-800 sm:pl-4 pl-0 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto border-zinc-800">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase">Spread / Bid-Ask</div>
              <div className="text-zinc-200 tabular-nums">
                {quote?.bid?.toFixed(2) ?? '--'} / {quote?.ask?.toFixed(2) ?? '--'}
                <span className="ml-1 text-zinc-400 text-[10px]">(${quote?.spread ?? 0.01})</span>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-zinc-500 uppercase">24H High / Low</div>
              <div className="text-zinc-200 tabular-nums">
                <span className="text-emerald-400 font-medium">H: {quote?.high24h.toFixed(2) ?? '--'}</span>{' '}
                <span className="text-rose-400 font-medium">L: {quote?.low24h.toFixed(2) ?? '--'}</span>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-zinc-500 uppercase">Prev Close / Open</div>
              <div className="text-zinc-300 tabular-nums">
                {quote?.prevClose.toFixed(2) ?? '--'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Market State Badges & Timeframe Switcher */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 sm:gap-4">
          {/* Regime Badges */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Structure Badge */}
            <div className="bg-[#151a24] border border-[#232b3c] px-2.5 py-1 rounded">
              <span className="text-[10px] text-zinc-500 mr-1.5 uppercase font-mono">Structure ({currentTimeframe})</span>
              <span className={`font-semibold font-mono ${
                structure.trend.includes('Bullish') ? 'text-emerald-400' :
                structure.trend.includes('Bearish') ? 'text-rose-400' : 'text-amber-300'
              }`}>
                {structure.trend}
              </span>
            </div>

            {/* Volatility Badge */}
            <div className="bg-[#151a24] border border-[#232b3c] px-2.5 py-1 rounded flex items-center gap-1.5">
              <Zap className={`w-3 h-3 ${volatility.regime5m === 'HIGH' || volatility.regime5m === 'EXTREME' ? 'text-amber-400' : 'text-zinc-400'}`} />
              <span className="text-[10px] text-zinc-500 uppercase font-mono">Vol</span>
              <span className="font-semibold text-zinc-200 font-mono">
                {volatility.regime5m} (ATR: ${volatility.atr5m})
              </span>
            </div>

            {/* News Risk Badge */}
            {regime && (
              <div className={`px-2.5 py-1 rounded flex items-center gap-1.5 border ${
                regime.newsRisk === 'CRITICAL EVENT AHEAD'
                  ? 'bg-rose-950/60 border-rose-700 text-rose-300'
                  : regime.newsRisk === 'High'
                  ? 'bg-amber-950/50 border-amber-700 text-amber-300'
                  : 'bg-[#151a24] border-[#232b3c] text-zinc-300'
              }`}>
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] uppercase font-mono font-bold">
                  {regime.newsRisk === 'CRITICAL EVENT AHEAD'
                    ? 'CRITICAL EVENT AHEAD'
                    : `EVENT RISK: ${regime.newsRisk}`}
                </span>
              </div>
            )}
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-[#121620] p-0.5 rounded border border-[#222938]">
            {timeframes.map(tf => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-2 sm:px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors ${
                  currentTimeframe === tf
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Event Warning Banner (When applicable) */}
      {regime?.activeEventWarning && (
        <div className="max-w-7xl mx-auto mt-2.5 bg-rose-950/70 border border-rose-700/80 px-3 py-1.5 rounded flex items-center gap-2 text-rose-200 text-xs font-mono animate-pulse">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{regime.activeEventWarning}</span>
        </div>
      )}
    </div>
  );
};
