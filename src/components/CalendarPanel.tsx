import React, { useState } from 'react';
import { AlertTriangle, Calendar, Clock, Filter, ShieldAlert } from 'lucide-react';
import { EconomicEvent } from '../types/market';

interface CalendarPanelProps {
  events: EconomicEvent[];
}

export const CalendarPanel: React.FC<CalendarPanelProps> = ({ events }) => {
  const [usdOnly, setUsdOnly] = useState(true);
  const [highImpactOnly, setHighImpactOnly] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'UPCOMING' | 'ALL' | 'RELEASED'>('UPCOMING');

  const filtered = events.filter(e => {
    if (usdOnly && e.country !== 'USD') return false;
    if (highImpactOnly && !e.isHighImpact) return false;
    if (statusFilter === 'UPCOMING' && !e.isUpcoming) return false;
    if (statusFilter === 'RELEASED' && e.isUpcoming) return false;
    return true;
  });

  return (
    <div className="terminal-card overflow-hidden">
      <div className="terminal-header">
        <div className="flex items-center gap-1.5 text-zinc-200">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span>ECONOMIC CALENDAR & EVENT RISK</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center bg-[#10141f] p-0.5 rounded border border-[#1e2433] text-[10px]">
            <button
              onClick={() => setStatusFilter('UPCOMING')}
              className={`px-2 py-0.5 rounded font-bold transition-colors ${
                statusFilter === 'UPCOMING'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Upcoming Only
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2 py-0.5 rounded font-bold transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setStatusFilter('RELEASED')}
              className={`px-2 py-0.5 rounded font-bold transition-colors ${
                statusFilter === 'RELEASED'
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Finished / Released
            </button>
          </div>

          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={usdOnly}
              onChange={e => setUsdOnly(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>USD Only</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={highImpactOnly}
              onChange={e => setHighImpactOnly(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>High Impact</span>
          </label>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-3">
        {/* Events Table */}
        <div className="border border-[#1e2433] rounded overflow-hidden">
          <div className="max-h-[340px] overflow-y-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-[#121622] text-zinc-400 text-[10px] uppercase sticky top-0 z-10 border-b border-[#1e2433]">
                <tr>
                  <th className="px-3 py-2">Status / Countdown</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2 text-right">Actual</th>
                  <th className="px-3 py-2 text-right">Forecast</th>
                  <th className="px-3 py-2 text-right">Previous</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18202e]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-zinc-500">
                      No events matching current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.slice(0, 20).map(event => {
                    const isUrgent = event.isUpcoming && event.countdownText.includes('m') && !event.countdownText.includes('d');
                    const isReleased = !event.isUpcoming || event.countdownText === 'Released';

                    return (
                      <tr
                        key={event.id}
                        className={`hover:bg-[#151a25]/60 transition-colors ${
                          isUrgent ? 'bg-amber-950/20' : isReleased ? 'opacity-85' : ''
                        }`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {isReleased ? (
                            <span className="font-bold px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 inline-block">
                              RELEASED
                            </span>
                          ) : (
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              isUrgent
                                ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                                : 'bg-zinc-800 text-zinc-200'
                            }`}>
                              {event.countdownText}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-bold text-zinc-300">
                          {event.country}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              event.impact === 'High' ? 'bg-rose-500' :
                              event.impact === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'
                            }`} />
                            <span className="font-semibold text-zinc-100">{event.title}</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            {event.relevanceToGold}
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-right font-bold tabular-nums ${
                          isReleased && event.actual !== '--' ? 'text-emerald-400' : 'text-zinc-200'
                        }`}>
                          {event.actual || '--'}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400 tabular-nums">
                          {event.forecast || '--'}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-500 tabular-nums">
                          {event.previous || '--'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between border-t border-[#1a212e] pt-2">
          <span>Source: Official TradingView Economic Calendar (Live Consensus & Releases)</span>
          <span>Automatic 3m live refresh</span>
        </div>
      </div>
    </div>
  );
};

