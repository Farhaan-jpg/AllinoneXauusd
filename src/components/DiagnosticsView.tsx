import React from 'react';
import { Activity, CheckCircle2, Clock, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { ProviderHealth } from '../types/market';

interface DiagnosticsViewProps {
  providers: ProviderHealth[];
  isOpen: boolean;
  onClose: () => void;
  onRefreshAll: () => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  providers,
  isOpen,
  onClose,
  onRefreshAll,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 z-50">
      <div className="bg-[#0f131a] border border-[#252f42] rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Modal Header */}
        <div className="p-3 sm:p-4 bg-[#131822] border-b border-[#202738] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-sm font-bold text-zinc-100">SYSTEM DIAGNOSTICS & HEALTH</div>
              <div className="text-[10px] text-zinc-500">Live data provider feeds & latency telemetry</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshAll}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ping Providers</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diagnostics Table */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3">
          <div className="border border-[#1e2433] rounded overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#121622] text-zinc-400 text-[10px] uppercase border-b border-[#1e2433]">
                <tr>
                  <th className="px-3 py-2.5">Feed / Provider</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Latency</th>
                  <th className="px-3 py-2.5 text-right">Last Sync</th>
                  <th className="px-3 py-2.5">Endpoint & Attribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18202e]">
                {providers.map(p => {
                  const elapsedSec = Math.floor((Date.now() - p.lastUpdated) / 1000);
                  return (
                    <tr key={p.id} className="hover:bg-[#151a25]/60 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-zinc-200">
                        {p.name}
                        <div className="text-[10px] text-zinc-500 font-normal">{p.category}</div>
                      </td>

                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.status === 'healthy'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : p.status === 'degraded'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            p.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`} />
                          {p.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-right font-bold text-zinc-300 tabular-nums">
                        {p.latencyMs} ms
                      </td>

                      <td className="px-3 py-2.5 text-right text-zinc-400 tabular-nums text-[11px]">
                        {elapsedSec < 5 ? 'Just now' : `${elapsedSec}s ago`}
                      </td>

                      <td className="px-3 py-2.5 text-[11px] text-zinc-400 max-w-xs truncate">
                        <div className="text-zinc-300 font-semibold">{p.attribution}</div>
                        <div className="text-zinc-600 text-[10px] truncate">{p.endpoint}</div>
                        {p.details && (
                          <div className="text-amber-400 text-[10px] mt-0.5">{p.details}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-[#111622] rounded border border-[#202738] text-[11px] text-zinc-400 space-y-1">
            <div className="text-zinc-300 font-bold">Cloudflare Free Tier Architecture Compliance:</div>
            <div>• Caching Layer TTL: XAUUSD (2.5s), Macro (15s), News (60s), Calendar (3m), COT (1h).</div>
            <div>• Subrequest cap: Under 5 requests per client sync cycle. Zero paid APIs required.</div>
            <div>• Data integrity rule: Unverified OTC liquidity is never synthesized; derived metrics are strictly marked.</div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#131822] border-t border-[#202738] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded transition-colors"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
