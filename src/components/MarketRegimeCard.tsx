import React from 'react';
import { Compass, Info, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { MarketRegime } from '../types/market';

interface MarketRegimeCardProps {
  regime: MarketRegime | null;
}

export const MarketRegimeCard: React.FC<MarketRegimeCardProps> = ({ regime }) => {
  if (!regime) {
    return (
      <div className="terminal-card p-4 text-center text-zinc-500 font-mono text-xs">
        Calculating Gold Market Regime...
      </div>
    );
  }

  return (
    <div className="terminal-card overflow-hidden">
      <div className="terminal-header">
        <div className="flex items-center gap-1.5 text-zinc-200">
          <Compass className="w-4 h-4 text-amber-400" />
          <span>GOLD MARKET REGIME & CONTEXT</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">Macro & Technical Synthesis</span>
      </div>

      <div className="p-3 sm:p-4 space-y-4">
        {/* Core Drivers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
          <div className="bg-[#141923] p-2.5 rounded border border-[#202737]">
            <div className="text-[10px] text-zinc-500 uppercase">USD (DXY)</div>
            <div className={`font-bold mt-0.5 ${
              regime.usdPressure === 'Bearish pressure' ? 'text-emerald-400' :
              regime.usdPressure === 'Bullish pressure' ? 'text-rose-400' : 'text-zinc-300'
            }`}>
              {regime.usdPressure}
            </div>
          </div>

          <div className="bg-[#141923] p-2.5 rounded border border-[#202737]">
            <div className="text-[10px] text-zinc-500 uppercase">US 10Y Yields</div>
            <div className={`font-bold mt-0.5 ${
              regime.yieldsState === 'Falling' ? 'text-emerald-400' :
              regime.yieldsState === 'Rising' ? 'text-rose-400' : 'text-zinc-300'
            }`}>
              {regime.yieldsState}
            </div>
          </div>

          <div className="bg-[#141923] p-2.5 rounded border border-[#202737]">
            <div className="text-[10px] text-zinc-500 uppercase">Risk Sentiment</div>
            <div className="font-bold text-zinc-200 mt-0.5">
              {regime.riskSentiment}
            </div>
          </div>

          <div className="bg-[#141923] p-2.5 rounded border border-[#202737]">
            <div className="text-[10px] text-zinc-500 uppercase">Momentum</div>
            <div className={`font-bold mt-0.5 ${
              regime.momentum === 'Positive' ? 'text-emerald-400' :
              regime.momentum === 'Negative' ? 'text-rose-400' : 'text-zinc-300'
            }`}>
              {regime.momentum}
            </div>
          </div>

          <div className="bg-[#141923] p-2.5 rounded border border-[#202737]">
            <div className="text-[10px] text-zinc-500 uppercase">Volatility</div>
            <div className="font-bold text-amber-400 mt-0.5">
              {regime.volatilityRegime}
            </div>
          </div>

          <div className="bg-[#141923] p-2.5 rounded border border-[#202737]">
            <div className="text-[10px] text-zinc-500 uppercase">News Risk</div>
            <div className={`font-bold mt-0.5 ${
              regime.newsRisk === 'CRITICAL EVENT AHEAD' ? 'text-rose-400' :
              regime.newsRisk === 'High' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {regime.newsRisk}
            </div>
          </div>
        </div>

        {/* Alignment Matrix & Overall Context */}
        <div className="bg-[#111622] p-3 rounded border border-[#222a3c] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-zinc-500 mr-1.5">Trend alignment:</span>
                <span className={`font-bold ${
                  regime.trendAlignment === 'HIGH' ? 'text-emerald-400' :
                  regime.trendAlignment === 'MEDIUM' ? 'text-amber-400' : 'text-zinc-400'
                }`}>
                  {regime.trendAlignment}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 mr-1.5">Macro alignment:</span>
                <span className={`font-bold ${
                  regime.macroAlignment === 'HIGH' ? 'text-emerald-400' :
                  regime.macroAlignment === 'MEDIUM' ? 'text-amber-400' : 'text-zinc-400'
                }`}>
                  {regime.macroAlignment}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#1c2436] pt-2">
            <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Overall Context</div>
            <div className="text-sm font-bold font-mono text-amber-300 mt-0.5 tracking-wide">
              {regime.overallContext}
            </div>
          </div>
        </div>

        {/* Factual Context Bullets */}
        <div className="space-y-1.5 text-xs font-mono text-zinc-300">
          {regime.summaryBullets.map((bullet, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span>{bullet}</span>
            </div>
          ))}
        </div>

        {/* Disclaimer Footer */}
        <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 border-t border-[#18202d] pt-2">
          <Info className="w-3 h-3 text-zinc-400 shrink-0" />
          <span>Factual analytical context. Does not constitute directional or investment advice.</span>
        </div>
      </div>
    </div>
  );
};
