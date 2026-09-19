import React from 'react';
import { ChevronRight, Layers, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { MTFMatrixState, MTFTrend } from '../services/engines/mtfEngine';
import { Timeframe } from '../types/market';

interface MTFMatrixPanelProps {
  matrixState: MTFMatrixState;
  currentTimeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
}

export const MTFMatrixPanel: React.FC<MTFMatrixPanelProps> = ({
  matrixState,
  currentTimeframe,
  onSelectTimeframe,
}) => {
  const { timeframes, confluenceScore, overallBias, bullishCount, bearishCount, summary } = matrixState;

  const getTrendBadge = (trend: MTFTrend) => {
    switch (trend) {
      case 'BULLISH':
        return {
          icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
          bgColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          label: 'BULLISH',
        };
      case 'BEARISH':
        return {
          icon: <TrendingDown className="w-3.5 h-3.5 text-rose-400" />,
          bgColor: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          label: 'BEARISH',
        };
      case 'NEUTRAL':
      default:
        return {
          icon: <Minus className="w-3.5 h-3.5 text-amber-400" />,
          bgColor: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          label: 'NEUTRAL',
        };
    }
  };

  const getBiasColor = () => {
    if (overallBias.includes('BULLISH')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (overallBias.includes('BEARISH')) return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  };

  return (
    <div className="bg-[#0f131a] border border-[#202738] rounded-lg p-3 sm:p-3.5 shadow-lg font-mono">
      {/* Header / Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[#1e2433]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-zinc-100 tracking-wider">
            MULTI-TIMEFRAME TREND MATRIX (MTF)
          </span>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">
            QUANTITATIVE CONFLUENCE
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Confluence Percentage Bar */}
          <div className="flex items-center gap-2 bg-[#0b0e14] px-2.5 py-1 rounded border border-[#1e2433]">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">Confluence:</span>
            <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-500 ${
                  overallBias.includes('BULLISH')
                    ? 'bg-emerald-500'
                    : overallBias.includes('BEARISH')
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${confluenceScore}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-zinc-200">{confluenceScore}%</span>
          </div>

          {/* Overall Bias Badge */}
          <div className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getBiasColor()}`}>
            {overallBias.replace('_', ' ')} ({bullishCount}B / {bearishCount}S)
          </div>
        </div>
      </div>

      {/* Grid of Timeframe Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {timeframes.map(item => {
          const isSelected = item.timeframe === currentTimeframe;
          const badge = getTrendBadge(item.trend);

          return (
            <button
              key={item.timeframe}
              type="button"
              onClick={() => onSelectTimeframe(item.timeframe)}
              className={`p-2 rounded border text-left transition-all duration-200 cursor-pointer relative group ${
                isSelected
                  ? 'bg-[#182030] border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/50'
                  : 'bg-[#121620] border-[#1e2433] hover:border-zinc-700 hover:bg-[#151a26]'
              }`}
              title={`Click to switch terminal chart to ${item.timeframe}`}
            >
              {/* Active Indicator Pin */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}

              {/* Timeframe & Trend Badge */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-zinc-200'}`}>
                  {item.timeframe.toUpperCase()}
                </span>
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.bgColor}`}>
                  {badge.icon}
                  <span>{badge.label}</span>
                </div>
              </div>

              {/* Metrics (EMA & RSI) */}
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>EMA Align:</span>
                  <span
                    className={`font-semibold ${
                      item.emaAlignment === 'BULLISH'
                        ? 'text-emerald-400'
                        : item.emaAlignment === 'BEARISH'
                        ? 'text-rose-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    {item.emaAlignment === 'BULLISH' ? '20 > 50 ↑' : item.emaAlignment === 'BEARISH' ? '20 < 50 ↓' : 'Flat'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-400">
                  <span>RSI(14):</span>
                  <span
                    className={`font-semibold ${
                      item.rsi >= 70
                        ? 'text-amber-400'
                        : item.rsi <= 30
                        ? 'text-purple-400'
                        : item.rsi >= 50
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {item.rsi.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Switch Prompt Hint on Hover */}
              <div className="mt-1.5 pt-1 border-t border-zinc-800/60 flex items-center justify-between text-[9px] text-zinc-500 group-hover:text-amber-400 transition-colors">
                <span>{isSelected ? 'ACTIVE TF' : 'SWITCH'}</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Institutional Context Summary Note */}
      <div className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1.5 px-1">
        <span className="text-amber-400/80 font-bold">INSIGHT:</span>
        <span className="truncate">{summary}</span>
      </div>
    </div>
  );
};
