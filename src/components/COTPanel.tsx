import React from 'react';
import { Calendar, HelpCircle, Shield, TrendingDown, TrendingUp } from 'lucide-react';
import { COTReport } from '../types/market';

interface COTPanelProps {
  cot: COTReport | null;
}

export const COTPanel: React.FC<COTPanelProps> = ({ cot }) => {
  if (!cot) {
    return (
      <div className="terminal-card p-4 text-center text-zinc-500 font-mono text-xs">
        Loading CFTC Positioning Report...
      </div>
    );
  }

  const isNetLong = cot.netPosition > 0;
  const isChangePositive = cot.changeNet >= 0;

  return (
    <div className="terminal-card overflow-hidden">
      <div className="terminal-header">
        <div className="flex items-center gap-1.5 text-zinc-200">
          <Shield className="w-4 h-4 text-amber-400" />
          <span>CFTC COMMITMENTS OF TRADERS (COT)</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">
          Last Updated: {cot.reportDate}
        </span>
      </div>

      <div className="p-3 sm:p-4 space-y-4">
        {/* Prominent Disclaimer Banner */}
        <div className="bg-amber-950/40 border border-amber-800/60 p-2 rounded text-[11px] font-mono text-amber-300 flex items-center justify-between">
          <span className="font-bold">WEEKLY DATA — NOT INTRADAY</span>
          <span className="text-zinc-400 text-[10px]">Macro positioning context only • Not an entry trigger</span>
        </div>

        {/* Institutional Positioning Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="bg-[#121620] p-2.5 rounded border border-[#1e2433]">
            <div className="text-[10px] text-zinc-500 uppercase">Managed Money Long</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5 tabular-nums">
              {cot.managedMoneyLong.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
              <span>Weekly Change:</span>
              <span className={cot.changeLong >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {cot.changeLong >= 0 ? `+${cot.changeLong.toLocaleString()}` : cot.changeLong.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-[#121620] p-2.5 rounded border border-[#1e2433]">
            <div className="text-[10px] text-zinc-500 uppercase">Managed Money Short</div>
            <div className="text-base font-bold text-rose-400 mt-0.5 tabular-nums">
              {cot.managedMoneyShort.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
              <span>Weekly Change:</span>
              <span className={cot.changeShort >= 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {cot.changeShort >= 0 ? `+${cot.changeShort.toLocaleString()}` : cot.changeShort.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-[#121620] p-2.5 rounded border border-[#1e2433]">
            <div className="text-[10px] text-zinc-500 uppercase">Net Position</div>
            <div className={`text-base font-bold mt-0.5 tabular-nums ${isNetLong ? 'text-emerald-400' : 'text-rose-400'}`}>
              {cot.netPosition >= 0 ? `+${cot.netPosition.toLocaleString()}` : cot.netPosition.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
              <span>Weekly Shift:</span>
              <span className={isChangePositive ? 'text-emerald-400' : 'text-rose-400'}>
                {cot.changeNet >= 0 ? `+${cot.changeNet.toLocaleString()}` : cot.changeNet.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-[#121620] p-2.5 rounded border border-[#1e2433]">
            <div className="text-[10px] text-zinc-500 uppercase">Open Interest (All)</div>
            <div className="text-base font-bold text-zinc-100 mt-0.5 tabular-nums">
              {cot.openInterest.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
              <span>Change:</span>
              <span className={cot.openInterestChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {cot.openInterestChange >= 0 ? `+${cot.openInterestChange.toLocaleString()}` : cot.openInterestChange.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 52-Week Percentile Gauge */}
        <div className="bg-[#111622] p-3 rounded border border-[#1f2638] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">Historical 52-Week Percentile:</span>
            <span className="font-bold text-amber-400">{cot.percentile52w}th Percentile ({cot.sentiment})</span>
          </div>

          <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden flex items-center">
            <div
              className="bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${Math.max(5, Math.min(100, cot.percentile52w))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
            <span>0% (Extreme Short)</span>
            <span>50% (Neutral)</span>
            <span>100% (Extreme Long)</span>
          </div>
        </div>

        <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between border-t border-[#1a212e] pt-2">
          <span>Source: U.S. Commodity Futures Trading Commission (CFTC Socrata)</span>
          <span>Updated every Friday 15:30 EST</span>
        </div>
      </div>
    </div>
  );
};
