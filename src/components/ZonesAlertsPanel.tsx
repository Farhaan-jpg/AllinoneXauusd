import React, { useState } from 'react';
import { AlertCircle, Bell, Plus, Shield, Target, Trash2, Zap } from 'lucide-react';
import { AlertEvent, AlertRule, TradingZone } from '../types/market';

interface ZonesAlertsPanelProps {
  zones: TradingZone[];
  rules: AlertRule[];
  events: AlertEvent[];
  currentPrice: number;
  onAddRule: (rule: Omit<AlertRule, 'id' | 'createdAt'>) => void;
  onRemoveRule: (id: string) => void;
  onToggleRule: (id: string, enabled: boolean) => void;
  onClearHistory: () => void;
}

export const ZonesAlertsPanel: React.FC<ZonesAlertsPanelProps> = ({
  zones,
  rules,
  events,
  currentPrice,
  onAddRule,
  onRemoveRule,
  onToggleRule,
  onClearHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'ZONES' | 'RULES' | 'HISTORY'>('ZONES');
  const [showAddModal, setShowAddModal] = useState(false);

  // New alert form state
  const [newTitle, setNewTitle] = useState('Price Level Target');
  const [newType, setNewType] = useState<AlertRule['type']>('PRICE_LEVEL');
  const [newTarget, setNewTarget] = useState(currentPrice > 0 ? (currentPrice + 5).toFixed(2) : '2650.00');
  const [newCondition, setNewCondition] = useState<AlertRule['condition']>('ABOVE');

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    onAddRule({
      title: newTitle,
      type: newType,
      targetValue: newTarget,
      condition: newCondition,
      enabled: true,
    });
    setShowAddModal(false);
  };

  return (
    <div className="terminal-card overflow-hidden">
      <div className="terminal-header">
        <div className="flex items-center gap-1.5 text-zinc-200">
          <Target className="w-4 h-4 text-purple-400" />
          <span>REACTION ZONES & ALERTS</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-[#151a24] p-0.5 rounded border border-[#232b3c] flex items-center text-xs">
            <button
              onClick={() => setActiveTab('ZONES')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                activeTab === 'ZONES' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Reaction Zones ({zones.length})
            </button>
            <button
              onClick={() => setActiveTab('RULES')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                activeTab === 'RULES' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Alert Rules ({rules.length})
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                activeTab === 'HISTORY' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              History ({events.length})
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-2 py-0.5 rounded text-xs font-mono transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Alert</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {/* TAB 1: POTENTIAL REACTION ZONES */}
        {activeTab === 'ZONES' && (
          <div className="space-y-2.5">
            {zones.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 font-mono text-xs">
                Scanning for pullback and reversal reaction zones...
              </div>
            ) : (
              zones.map(zone => (
                <div
                  key={zone.id}
                  className="bg-[#121620] p-2.5 rounded border border-[#1e2433] hover:border-[#2a3446] transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-mono"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                        zone.type === 'Pullback Zone'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {zone.type}
                      </span>
                      <span className="text-zinc-100 font-bold">
                        ${zone.priceMin.toFixed(2)} — ${zone.priceMax.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        ({zone.distancePips.toFixed(1)} pts away)
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      {zone.reason}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      zone.strength === 'HIGH' ? 'bg-amber-950 text-amber-300' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {zone.strength} Strength
                    </span>
                    <span className={`text-[10px] font-bold uppercase ${
                      zone.status === 'ACTIVE' ? 'text-emerald-400' : 'text-zinc-500'
                    }`}>
                      {zone.status}
                    </span>
                  </div>
                </div>
              ))
            )}

            <div className="text-[10px] text-zinc-500 font-mono pt-1">
              Label: Potential Reaction Zones. Derived from displacement origins, breakout retests, and profile POC nodes.
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE ALERT RULES */}
        {activeTab === 'RULES' && (
          <div className="space-y-2">
            {rules.map(rule => (
              <div
                key={rule.id}
                className="bg-[#121620] p-2.5 rounded border border-[#1e2433] flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={e => onToggleRule(rule.id, e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <div>
                    <div className="font-bold text-zinc-200">{rule.title}</div>
                    <div className="text-[11px] text-zinc-400">
                      Condition: {rule.condition} {rule.targetValue} ({rule.type})
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onRemoveRule(rule.id)}
                  className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                  title="Delete Alert Rule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: ALERT HISTORY */}
        {activeTab === 'HISTORY' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">Triggered Event Log:</span>
              {events.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  Clear History
                </button>
              )}
            </div>

            {events.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 font-mono text-xs">
                No alert triggers recorded in this session.
              </div>
            ) : (
              events.map(evt => (
                <div
                  key={evt.id}
                  className={`p-2.5 rounded border text-xs font-mono ${
                    evt.level === 'critical'
                      ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                      : evt.level === 'warning'
                      ? 'bg-amber-950/30 border-amber-800 text-amber-200'
                      : 'bg-[#121620] border-[#1e2433] text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[11px]">
                    <span>{evt.title}</span>
                    <span className="text-zinc-500 text-[10px]">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-0.5 text-zinc-300">{evt.message}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Alert Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#121622] border border-[#263145] rounded-lg max-w-md w-full p-4 space-y-3 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-bold text-sm text-amber-400">Create New Alert Rule</span>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3">
              <div>
                <label className="text-zinc-400 text-[11px] block mb-1">Alert Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-[#222a3a] rounded px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-zinc-400 text-[11px] block mb-1">Alert Type</label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as AlertRule['type'])}
                  className="w-full bg-[#0b0e14] border border-[#222a3a] rounded px-2 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="PRICE_LEVEL">Price Level Reach</option>
                  <option value="STRUCTURE_BREAK">Break of Structure (BOS / CHOCH)</option>
                  <option value="ZONE_ENTER">Reaction Zone Entry</option>
                  <option value="VOLUME_SPIKE">Abnormal Volume / Delta Spike</option>
                </select>
              </div>

              {newType === 'PRICE_LEVEL' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 text-[11px] block mb-1">Condition</label>
                    <select
                      value={newCondition}
                      onChange={e => setNewCondition(e.target.value as AlertRule['condition'])}
                      className="w-full bg-[#0b0e14] border border-[#222a3a] rounded px-2 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-500"
                    >
                      <option value="ABOVE">Price Above (&gt;=)</option>
                      <option value="BELOW">Price Below (&lt;=)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-400 text-[11px] block mb-1">Target Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newTarget}
                      onChange={e => setNewTarget(e.target.value)}
                      className="w-full bg-[#0b0e14] border border-[#222a3a] rounded px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400"
                >
                  Save Alert Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
