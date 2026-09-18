import React, { useState } from 'react';
import { Activity, BarChart3, Database, Info, Layers, Waves } from 'lucide-react';
import { LiquidityLevel, OrderFlowState, VolumeProfile } from '../types/market';

interface LiquidityOrderFlowPanelProps {
  liquidityLevels: LiquidityLevel[];
  profile: VolumeProfile | null;
  orderFlow: OrderFlowState;
  currentPrice: number;
  profileRange: 'SESSION' | 'DAY' | 'CUSTOM';
  onChangeProfileRange: (range: 'SESSION' | 'DAY' | 'CUSTOM') => void;
}

export const LiquidityOrderFlowPanel: React.FC<LiquidityOrderFlowPanelProps> = ({
  liquidityLevels,
  profile,
  orderFlow,
  currentPrice,
  profileRange,
  onChangeProfileRange,
}) => {
  const [tab, setTab] = useState<'LIQUIDITY' | 'VOLUME_PROFILE' | 'ORDER_FLOW'>('LIQUIDITY');

  return (
    <div className="terminal-card overflow-hidden">
      {/* Header with 3 Tabs */}
      <div className="terminal-header">
        <div className="flex items-center gap-1.5 text-zinc-200">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>LIQUIDITY & ORDER FLOW</span>
        </div>

        <div className="flex items-center gap-1">
          <div className="bg-[#151a24] p-0.5 rounded border border-[#232b3c] flex items-center text-xs">
            <button
              onClick={() => setTab('LIQUIDITY')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                tab === 'LIQUIDITY' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Liquidity Pools
            </button>
            <button
              onClick={() => setTab('VOLUME_PROFILE')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                tab === 'VOLUME_PROFILE' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Profile (POC)
            </button>
            <button
              onClick={() => setTab('ORDER_FLOW')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                tab === 'ORDER_FLOW' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Delta & CVD
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {/* TAB 1: DERIVED LIQUIDITY */}
        {tab === 'LIQUIDITY' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Derived Pool Levels</span>
              <span className="text-zinc-500">Current: ${currentPrice.toFixed(2)}</span>
            </div>

            <div className="border border-[#1e2433] rounded overflow-hidden">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-[#121622] text-zinc-400 text-[10px] uppercase border-b border-[#1e2433]">
                  <tr>
                    <th className="px-3 py-2">Pool Level</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">Distance</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202e]">
                  {liquidityLevels.slice(0, 7).map(level => {
                    const isAbove = level.price > currentPrice;
                    return (
                      <tr key={level.id} className="hover:bg-[#151a25]/60 transition-colors">
                        <td className="px-3 py-2 text-zinc-200 font-medium flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${level.type === 'HIGH' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <span>{level.label}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-zinc-100 tabular-nums">
                          ${level.price.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400 tabular-nums">
                          {isAbove ? `+${level.distancePips.toFixed(1)}` : `-${level.distancePips.toFixed(1)}`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            level.status === 'SWEPT'
                              ? 'bg-rose-950/70 text-rose-300 border border-rose-800'
                              : level.status === 'TESTED'
                              ? 'bg-amber-950/70 text-amber-300 border border-amber-800'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}>
                            {level.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1 pt-1">
              <Info className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>Label: Derived Liquidity (Price Action Extremes) — Not institutional order book.</span>
            </div>
          </div>
        )}

        {/* TAB 2: VOLUME PROFILE */}
        {tab === 'VOLUME_PROFILE' && (
          <div className="space-y-3">
            {/* Range Selector & Summary */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs font-mono">
                <div>
                  <span className="text-zinc-500 mr-1">POC:</span>
                  <span className="text-amber-400 font-bold">${profile?.poc.toFixed(2) || '--'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 mr-1">VAH (70%):</span>
                  <span className="text-zinc-200 font-bold">${profile?.vah.toFixed(2) || '--'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 mr-1">VAL (70%):</span>
                  <span className="text-zinc-200 font-bold">${profile?.val.toFixed(2) || '--'}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 font-mono text-[11px]">
                {(['SESSION', 'DAY', 'CUSTOM'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => onChangeProfileRange(r)}
                    className={`px-2 py-0.5 rounded font-bold transition-colors ${
                      profileRange === r
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Histogram Bars */}
            <div className="bg-[#0b0e14] p-2 rounded border border-[#1b2230] space-y-1 max-h-[220px] overflow-y-auto">
              {profile?.bins.slice().reverse().map((bin, i) => {
                const isPoc = Math.abs(bin.price - (profile.poc || 0)) < 0.25;
                const maxBinVol = Math.max(...profile.bins.map(b => b.volume), 1);
                const widthPct = Math.round((bin.volume / maxBinVol) * 100);
                const isInsideValueArea = bin.price <= (profile.vah || 0) && bin.price >= (profile.val || 0);

                return (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className={`w-14 text-right tabular-nums ${isPoc ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}>
                      ${bin.price.toFixed(1)}
                    </span>
                    <div className="flex-1 bg-zinc-900/80 h-3 rounded-sm overflow-hidden flex items-center">
                      <div
                        className={`h-full transition-all ${
                          isPoc
                            ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
                            : isInsideValueArea
                            ? 'bg-blue-600/70'
                            : 'bg-zinc-700/60'
                        }`}
                        style={{ width: `${Math.max(3, widthPct)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-zinc-500 tabular-nums">
                      {Math.round(bin.volume)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between">
              <span>Value Area: 70% Volume Concentration</span>
              <span>Calculated from 5M Candle Distribution</span>
            </div>
          </div>
        )}

        {/* TAB 3: ORDER FLOW DELTA & CVD */}
        {tab === 'ORDER_FLOW' && (
          <div className="space-y-3">
            {/* Stat Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-[#121620] p-2 rounded border border-[#1e2433]">
                <div className="text-[10px] text-zinc-500 uppercase">Current Delta</div>
                <div className={`text-base font-bold mt-0.5 tabular-nums ${
                  orderFlow.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {orderFlow.delta >= 0 ? `+${orderFlow.delta}` : orderFlow.delta}
                </div>
              </div>

              <div className="bg-[#121620] p-2 rounded border border-[#1e2433]">
                <div className="text-[10px] text-zinc-500 uppercase">CVD (Session)</div>
                <div className={`text-base font-bold mt-0.5 tabular-nums ${
                  orderFlow.cvd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {orderFlow.cvd >= 0 ? `+${orderFlow.cvd}` : orderFlow.cvd}
                </div>
              </div>

              <div className="bg-[#121620] p-2 rounded border border-[#1e2433]">
                <div className="text-[10px] text-zinc-500 uppercase">Aggression</div>
                <div className="text-zinc-200 font-bold mt-0.5">
                  {orderFlow.aggressiveState}
                </div>
              </div>

              <div className="bg-[#121620] p-2 rounded border border-[#1e2433]">
                <div className="text-[10px] text-zinc-500 uppercase">Absorption</div>
                <div className={`font-bold mt-0.5 ${
                  orderFlow.absorptionState !== 'None' ? 'text-amber-400' : 'text-zinc-400'
                }`}>
                  {orderFlow.absorptionState}
                </div>
              </div>
            </div>

            {/* Volume Spikes & Anomalies */}
            <div className="bg-[#111622] p-2.5 rounded border border-[#202737] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-4">
                <span className="text-zinc-400">Anomalies:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  orderFlow.volumeSpike ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'text-zinc-500'
                }`}>
                  {orderFlow.volumeSpike ? '⚡ Volume Spike Active' : 'Volume: Normal'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  orderFlow.deltaSpike ? 'bg-purple-950 text-purple-300 border border-purple-700' : 'text-zinc-500'
                }`}>
                  {orderFlow.deltaSpike ? '🎯 Delta Spike Active' : 'Delta: Normal'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1 pt-1">
              <Database className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>Attribution: {orderFlow.source}. Never represented as decentralized OTC order book.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
