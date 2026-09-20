import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Compass,
  ShieldAlert,
  Sliders,
  ChevronDown,
  ChevronUp,
  Target,
  AlertTriangle,
  Layers,
  Globe,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { MarketBiasVerdict } from '../types/market';

interface MarketBiasVerdictCardProps {
  verdict: MarketBiasVerdict | null;
}

export const MarketBiasVerdictCard: React.FC<MarketBiasVerdictCardProps> = ({ verdict }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!verdict) {
    return (
      <div className="terminal-card p-4 text-center text-zinc-500 font-mono text-xs animate-pulse">
        Evaluating Multi-Pillar Market Bias & Institutional Confluence...
      </div>
    );
  }

  const isBullish = verdict.bias.includes('BULLISH');
  const isBearish = verdict.bias.includes('BEARISH');
  const isStrong = verdict.bias.includes('STRONG');

  // Badge & theme colors
  const themeColor = isBullish
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : isBearish
    ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
    : 'text-amber-400 border-amber-500/30 bg-amber-500/10';

  const glowColor = isBullish
    ? 'shadow-[0_0_20px_rgba(16,185,129,0.12)]'
    : isBearish
    ? 'shadow-[0_0_20px_rgba(244,63,94,0.12)]'
    : 'shadow-[0_0_20px_rgba(245,158,11,0.12)]';

  const pillarColor = (rating: string) => {
    if (rating === 'BULLISH' || rating === 'LOW_RISK') return 'text-emerald-400';
    if (rating === 'BEARISH' || rating === 'HIGH_RISK') return 'text-rose-400';
    return 'text-amber-400';
  };

  const scoreBarWidth = (score: number) => {
    const abs = Math.min(100, Math.abs(score));
    return `${abs}%`;
  };

  return (
    <div className={`terminal-card overflow-hidden transition-all duration-300 ${glowColor}`}>
      {/* Header Banner */}
      <div className="terminal-header bg-[#0e131d] border-b border-[#1b2333] px-3 sm:px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-xs tracking-wider text-zinc-100 font-mono">
              OVERALL MARKET BIAS VERDICT
            </span>
            <span className="ml-2 text-[10px] font-mono text-zinc-500 hidden sm:inline">
              Quantitative 4-Pillar Synthesis
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700">
            {verdict.confidenceScore}% CONVICTION
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-zinc-400 hover:text-white transition-colors p-1"
            title={isExpanded ? 'Collapse Pillar Details' : 'Expand Pillar Details'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Verdict Spotlight */}
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-[#111622] p-3 sm:p-4 rounded-lg border border-[#1f2738]">
          {/* Left: Direction Badge & Title */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded text-xs sm:text-sm font-black tracking-wider border font-mono flex items-center gap-1.5 ${themeColor}`}>
                {isBullish ? <TrendingUp className="w-4 h-4" /> : isBearish ? <TrendingDown className="w-4 h-4" /> : <Sliders className="w-4 h-4" />}
                {verdict.bias.replace('_', ' ')}
              </span>
              {isStrong && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  HIGH CONFLUENCE
                </span>
              )}
            </div>
            <div className="text-sm sm:text-base font-bold text-white font-mono tracking-tight">
              {verdict.verdictTitle}
            </div>
          </div>

          {/* Right: Conviction Gauge & Playbook Action */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="bg-[#171f2f] px-3 py-2 rounded border border-[#232f46] text-right">
              <div className="text-[10px] text-zinc-400 uppercase font-mono">Conviction Score</div>
              <div className="text-lg font-black font-mono text-white flex items-center gap-1.5">
                <span className={isBullish ? 'text-emerald-400' : isBearish ? 'text-rose-400' : 'text-amber-400'}>
                  {verdict.confidenceScore}%
                </span>
                <span className="text-xs text-zinc-500 font-normal">/ 100</span>
              </div>
            </div>

            <div className="bg-[#171f2f] px-3 py-2 rounded border border-[#232f46] max-w-sm">
              <div className="text-[10px] text-zinc-400 uppercase font-mono flex items-center gap-1">
                <Target className="w-3 h-3 text-amber-400" />
                Actionable Playbook
              </div>
              <div className="text-xs text-zinc-200 mt-0.5 font-sans leading-snug">
                {verdict.playbook.biasAction}
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary Narrative */}
        <div className="bg-[#0f141e] p-3 rounded border border-[#1d2536] text-xs font-mono text-zinc-300 leading-relaxed">
          <span className="text-amber-400 font-bold mr-1.5">EXECUTIVE VERDICT:</span>
          {verdict.executiveSummary}
        </div>

        {/* 4 Pillars Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
          {/* Pillar 1: Technicals */}
          <div className="bg-[#121824] p-2.5 rounded border border-[#1e2738] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" /> Technicals
              </span>
              <span className="text-[10px] text-zinc-500">35% wt</span>
            </div>
            <div className="flex items-center justify-between font-bold">
              <span className={pillarColor(verdict.pillars.technicals.rating)}>
                {verdict.pillars.technicals.rating}
              </span>
              <span className="text-zinc-400 text-[10px] tabular-nums">
                {verdict.pillars.technicals.score > 0 ? '+' : ''}{verdict.pillars.technicals.score}
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-1 rounded overflow-hidden">
              <div
                className={`h-full ${verdict.pillars.technicals.score >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{ width: scoreBarWidth(verdict.pillars.technicals.score) }}
              />
            </div>
            <div className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">
              {verdict.pillars.technicals.summary}
            </div>
          </div>

          {/* Pillar 2: Macro */}
          <div className="bg-[#121824] p-2.5 rounded border border-[#1e2738] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 flex items-center gap-1">
                <Globe className="w-3 h-3 text-blue-400" /> Macro Drivers
              </span>
              <span className="text-[10px] text-zinc-500">25% wt</span>
            </div>
            <div className="flex items-center justify-between font-bold">
              <span className={pillarColor(verdict.pillars.macro.rating)}>
                {verdict.pillars.macro.rating}
              </span>
              <span className="text-zinc-400 text-[10px] tabular-nums">
                {verdict.pillars.macro.score > 0 ? '+' : ''}{verdict.pillars.macro.score}
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-1 rounded overflow-hidden">
              <div
                className={`h-full ${verdict.pillars.macro.score >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{ width: scoreBarWidth(verdict.pillars.macro.score) }}
              />
            </div>
            <div className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">
              {verdict.pillars.macro.summary}
            </div>
          </div>

          {/* Pillar 3: Order Flow */}
          <div className="bg-[#121824] p-2.5 rounded border border-[#1e2738] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Order Flow
              </span>
              <span className="text-[10px] text-zinc-500">20% wt</span>
            </div>
            <div className="flex items-center justify-between font-bold">
              <span className={pillarColor(verdict.pillars.orderflow.rating)}>
                {verdict.pillars.orderflow.rating}
              </span>
              <span className="text-zinc-400 text-[10px] tabular-nums">
                {verdict.pillars.orderflow.score > 0 ? '+' : ''}{verdict.pillars.orderflow.score}
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-1 rounded overflow-hidden">
              <div
                className={`h-full ${verdict.pillars.orderflow.score >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{ width: scoreBarWidth(verdict.pillars.orderflow.score) }}
              />
            </div>
            <div className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">
              {verdict.pillars.orderflow.summary}
            </div>
          </div>

          {/* Pillar 4: Event Risk */}
          <div className="bg-[#121824] p-2.5 rounded border border-[#1e2738] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-rose-400" /> Event & News
              </span>
              <span className="text-[10px] text-zinc-500">20% wt</span>
            </div>
            <div className="flex items-center justify-between font-bold">
              <span className={pillarColor(verdict.pillars.eventRisk.rating)}>
                {verdict.pillars.eventRisk.rating.replace('_', ' ')}
              </span>
              <span className="text-zinc-400 text-[10px] tabular-nums">
                Risk
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-1 rounded overflow-hidden">
              <div
                className={`h-full ${verdict.pillars.eventRisk.rating === 'HIGH_RISK' ? 'bg-rose-400' : verdict.pillars.eventRisk.rating === 'MODERATE_RISK' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: verdict.pillars.eventRisk.rating === 'HIGH_RISK' ? '85%' : verdict.pillars.eventRisk.rating === 'MODERATE_RISK' ? '50%' : '20%' }}
              />
            </div>
            <div className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">
              {verdict.pillars.eventRisk.summary}
            </div>
          </div>
        </div>

        {/* Actionable Key Levels Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono bg-[#111722] p-2.5 rounded border border-[#1f2838]">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">{verdict.playbook.primaryZone.label}</span>
            <span className="font-bold text-emerald-400">
              ${verdict.playbook.primaryZone.min.toFixed(1)} — ${verdict.playbook.primaryZone.max.toFixed(1)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Structural Invalidation</span>
            <span className="font-bold text-rose-400">
              ${verdict.playbook.invalidationPrice.toFixed(2)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Target Expansion</span>
            <span className="font-bold text-amber-300">
              ${verdict.playbook.targetResistance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Detailed Expandable Section */}
        {isExpanded && (
          <div className="border-t border-[#1e2637] pt-3 space-y-3">
            <div className="text-xs font-mono font-bold text-zinc-200">
              Detailed Factor-by-Factor Breakdown:
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              {/* Technicals detail */}
              <div className="bg-[#0e131c] p-2.5 rounded border border-zinc-800/80 space-y-1">
                <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Technical Factors
                </div>
                <ul className="space-y-1 text-[11px] text-zinc-400 pl-1">
                  {verdict.pillars.technicals.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-cyan-500 mt-0.5 shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Macro detail */}
              <div className="bg-[#0e131c] p-2.5 rounded border border-zinc-800/80 space-y-1">
                <div className="text-blue-400 font-bold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Macroeconomic Factors
                </div>
                <ul className="space-y-1 text-[11px] text-zinc-400 pl-1">
                  {verdict.pillars.macro.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Order Flow detail */}
              <div className="bg-[#0e131c] p-2.5 rounded border border-zinc-800/80 space-y-1">
                <div className="text-amber-400 font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Order Flow & Liquidity
                </div>
                <ul className="space-y-1 text-[11px] text-zinc-400 pl-1">
                  {verdict.pillars.orderflow.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Event detail */}
              <div className="bg-[#0e131c] p-2.5 rounded border border-zinc-800/80 space-y-1">
                <div className="text-rose-400 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Event & News Catalysts
                </div>
                <ul className="space-y-1 text-[11px] text-zinc-400 pl-1">
                  {verdict.pillars.eventRisk.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-rose-500 mt-0.5 shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
