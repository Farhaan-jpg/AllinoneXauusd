import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart2, Globe, HelpCircle, Minus } from 'lucide-react';
import { CorrelationItem, MacroQuotes } from '../types/market';

interface MacroPanelProps {
  macro: MacroQuotes | null;
  correlations: CorrelationItem[];
  selectedWindow: number;
  onSelectWindow: (window: number) => void;
}

export const MacroPanel: React.FC<MacroPanelProps> = ({
  macro,
  correlations,
  selectedWindow,
  onSelectWindow,
}) => {
  const [activeTab, setActiveTab] = useState<'QUOTES' | 'CORRELATION'>('QUOTES');

  if (!macro) {
    return (
      <div className="terminal-card p-4 text-center text-zinc-500 font-mono text-xs">
        Loading Macro Data...
      </div>
    );
  }

  const items = [
    { label: 'DXY (US Dollar)', data: macro.dxy, desc: 'Primary inverse gold anchor' },
    { label: 'US 10Y Yield', data: macro.us10y, desc: 'Benchmark risk-free rate' },
    { label: 'US 2Y Yield Proxy', data: macro.us02y, desc: 'Short-term policy rate proxy' },
    { label: 'VIX Volatility', data: macro.vix, desc: 'Equity market fear index' },
    { label: 'Silver (XAG)', data: macro.silver, desc: 'Precious metals sister asset' },
    { label: 'WTI Crude Oil', data: macro.oil, desc: 'Headline inflation pressure' },
    { label: 'USD / JPY', data: macro.usdjpy, desc: 'FX carry and liquidity flow' },
  ].filter((i): i is { label: string; data: NonNullable<typeof i.data>; desc: string } => Boolean(i.data));

  return (
    <div className="terminal-card overflow-hidden">
      {/* Header with Tabs */}
      <div className="terminal-header">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-zinc-200">MACRO & CORRELATIONS</span>
        </div>

        <div className="flex items-center gap-1">
          <div className="bg-[#151a24] p-0.5 rounded border border-[#232b3c] flex items-center text-xs">
            <button
              onClick={() => setActiveTab('QUOTES')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                activeTab === 'QUOTES' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Quotes
            </button>
            <button
              onClick={() => setActiveTab('CORRELATION')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                activeTab === 'CORRELATION' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Rolling Matrix
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {activeTab === 'QUOTES' ? (
          <div className="space-y-3">
            {/* Macro Assets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {items.map((item, idx) => {
                const isPos = item.data.change >= 0;
                return (
                  <div
                    key={idx}
                    className="bg-[#121620] p-2.5 rounded border border-[#1e2433] hover:border-[#2d3748] transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                      <span className="font-semibold text-zinc-300">{item.label}</span>
                      <span className="text-zinc-500">{item.data.unit}</span>
                    </div>

                    <div className="flex items-baseline justify-between mt-1">
                      <span className="font-mono text-base font-bold text-white tabular-nums">
                        {item.data.price > 0 ? item.data.price.toFixed(item.data.unit === '%' ? 3 : 2) : '--'}
                      </span>
                      <div className={`flex items-center text-xs font-mono font-bold tabular-nums ${
                        item.data.direction === 'UP' ? 'text-emerald-400' :
                        item.data.direction === 'DOWN' ? 'text-rose-400' : 'text-zinc-400'
                      }`}>
                        {item.data.direction === 'UP' ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                         item.data.direction === 'DOWN' ? <ArrowDownRight className="w-3.5 h-3.5" /> :
                         <Minus className="w-3.5 h-3.5" />}
                        <span>{isPos ? '+' : ''}{item.data.changePercent.toFixed(2)}%</span>
                      </div>
                    </div>

                    {/* 5M & 1H Change details */}
                    <div className="mt-1.5 pt-1.5 border-t border-[#1a212e] flex items-center justify-between text-[10px] font-mono text-zinc-500">
                      <span>5M: <span className={(item.data.change5m || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {(item.data.change5m || 0) >= 0 ? '+' : ''}{(item.data.change5m || 0).toFixed(2)}%
                      </span></span>
                      <span>1H: <span className={(item.data.change1h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {(item.data.change1h || 0) >= 0 ? '+' : ''}{(item.data.change1h || 0).toFixed(2)}%
                      </span></span>
                    </div>
                  </div>
                );
              })}

              {/* Gold/Silver Ratio Card */}
              {macro.goldSilverRatio && (
                <div className="bg-[#121620] p-2.5 rounded border border-[#1e2433]">
                  <div className="text-[10px] text-zinc-400 font-mono font-semibold">
                    Gold / Silver Ratio
                  </div>
                  <div className="font-mono text-base font-bold text-amber-400 mt-1 tabular-nums">
                    {macro.goldSilverRatio.toFixed(2)}
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-[#1a212e] text-[10px] font-mono text-zinc-500">
                    Ounces of Ag per oz of Au
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between border-t border-[#1a212e] pt-2">
              <span>Source: Yahoo Finance Market Feeds</span>
              <span>Refreshes every 15s</span>
            </div>
          </div>
        ) : (
          /* Correlation Engine View */
          <div className="space-y-3">
            {/* Window selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-400">Rolling Window:</span>
              <div className="flex items-center gap-1 font-mono text-xs">
                {[20, 50, 100].map(w => (
                  <button
                    key={w}
                    onClick={() => onSelectWindow(w)}
                    className={`px-2 py-0.5 rounded font-bold transition-colors ${
                      selectedWindow === w
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {w}p
                  </button>
                ))}
              </div>
            </div>

            {/* Correlation Table */}
            <div className="border border-[#1e2433] rounded overflow-hidden">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-[#121622] text-zinc-400 text-[10px] uppercase border-b border-[#1e2433]">
                  <tr>
                    <th className="px-3 py-2">Asset Pair</th>
                    <th className="px-3 py-2 text-right">Pearson r</th>
                    <th className="px-3 py-2 text-right">Relationship</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202e]">
                  {correlations.map((c, i) => {
                    const isNeg = c.correlation < 0;
                    return (
                      <tr key={i} className="hover:bg-[#151a25]/60 transition-colors">
                        <td className="px-3 py-2 text-zinc-200 font-medium">{c.pair}</td>
                        <td className={`px-3 py-2 text-right font-bold tabular-nums ${
                          c.correlation <= -0.5 ? 'text-emerald-400' :
                          c.correlation >= 0.5 ? 'text-blue-400' : 'text-zinc-400'
                        }`}>
                          {c.correlation >= 0 ? `+${c.correlation.toFixed(2)}` : c.correlation.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400 text-[11px]">
                          {c.interpretation}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1 pt-1">
              <HelpCircle className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>Statistical correlation measures co-movement, NOT causal relationship.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
