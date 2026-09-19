import React, { useEffect, useState } from 'react';
import { Bell, Key, Save, Send, Settings, ShieldCheck, X } from 'lucide-react';
import { TerminalSettings, Timeframe } from '../types/market';

interface SettingsModalProps {
  isOpen: boolean;
  settings: TerminalSettings;
  onSave: (newSettings: TerminalSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<TerminalSettings>(() => ({
    ...settings,
    userApiKeys: { ...(settings.userApiKeys || {}) },
  }));
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);

  // Sync formData whenever modal opens or settings update
  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...settings,
        userApiKeys: { ...(settings.userApiKeys || {}) },
      });
      setTelegramStatus(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const timezones = [
    { label: 'Asia/Kolkata (IST, UTC+5:30) — Default', value: 'Asia/Kolkata' },
    { label: 'UTC (Coordinated Universal Time)', value: 'UTC' },
    { label: 'America/New_York (EST / EDT)', value: 'America/New_York' },
    { label: 'Europe/London (GMT / BST)', value: 'Europe/London' },
    { label: 'Asia/Tokyo (JST, UTC+9)', value: 'Asia/Tokyo' },
    { label: 'Australia/Sydney (AEST, UTC+10)', value: 'Australia/Sydney' },
  ];

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D'];

  const handleRequestNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const updated = { ...formData, browserNotifications: true };
        setFormData(updated);
        onSave(updated);
        new Notification('Gold Intelligence Terminal', {
          body: 'Browser notifications successfully enabled.',
        });
      }
    }
  };

  const handleTestTelegram = async () => {
    if (!formData.telegramBotToken || !formData.telegramChatId) {
      setTelegramStatus('Please enter both Telegram Bot Token and Chat ID.');
      return;
    }

    setTelegramStatus('Sending test message...');
    try {
      const res = await fetch(`https://api.telegram.org/bot${formData.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: formData.telegramChatId,
          text: '🔔 *Gold Intelligence Terminal Test Message*\n\nTelegram alert dispatcher is connected, verified, and operational.',
          parse_mode: 'Markdown',
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setTelegramStatus('✅ Verified & saved! Test message delivered successfully.');
        // Auto-save verified Telegram settings so changes are immediately persisted
        onSave(formData);
      } else {
        setTelegramStatus(`❌ Delivery failed: ${data.description || 'Unknown error'}`);
      }
    } catch (err) {
      setTelegramStatus(`❌ Network error: ${String(err)}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 z-50">
      <div className="bg-[#0f131a] border border-[#252f42] rounded-lg max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="p-3 sm:p-4 bg-[#131822] border-b border-[#202738] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold text-zinc-100">TERMINAL PREFERENCES</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* General Preferences */}
          <div className="space-y-3">
            <div className="text-amber-400 font-bold uppercase tracking-wider text-[11px]">
              Market & Display Preferences
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 block mb-1">Default Timezone</label>
                <select
                  value={formData.timezone}
                  onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full bg-[#0b0e14] border border-[#222a3a] rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-amber-500"
                >
                  {timezones.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Default Timeframe</label>
                <select
                  value={formData.defaultTimeframe}
                  onChange={e => setFormData({ ...formData, defaultTimeframe: e.target.value as Timeframe })}
                  className="w-full bg-[#0b0e14] border border-[#222a3a] rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-amber-500"
                >
                  {timeframes.map(tf => (
                    <option key={tf} value={tf}>
                      {tf.toUpperCase()} {tf === '5m' ? '(Recommended Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Primary TradingView Symbol</label>
              <input
                type="text"
                value={formData.defaultSymbol}
                disabled
                className="w-full bg-zinc-900/60 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-400 cursor-not-allowed"
              />
              <span className="text-[10px] text-zinc-500 mt-0.5 block">
                Locked to OANDA:XAUUSD in accordance with primary discretionary trading requirements.
              </span>
            </div>
          </div>

          {/* Notifications & Audio */}
          <div className="space-y-2.5 border-t border-zinc-800 pt-3">
            <div className="text-amber-400 font-bold uppercase tracking-wider text-[11px]">
              Alerts & Notifications
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#121620] border border-[#1e2433]">
              <div>
                <div className="font-bold text-zinc-200">Web Audio Chimes</div>
                <div className="text-[10px] text-zinc-500">Play synthetic tone when price or structure triggers</div>
              </div>
              <input
                type="checkbox"
                checked={formData.soundAlerts}
                onChange={e => setFormData({ ...formData, soundAlerts: e.target.checked })}
                className="accent-amber-500 h-4 w-4 rounded"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#121620] border border-[#1e2433]">
              <div>
                <div className="font-bold text-zinc-200">Browser Push Notifications</div>
                <div className="text-[10px] text-zinc-500">Desktop notifications for critical news & alerts</div>
              </div>
              <button
                type="button"
                onClick={handleRequestNotificationPermission}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold"
              >
                Enable
              </button>
            </div>
          </div>

          {/* Telegram Dispatcher */}
          <div className="space-y-2.5 border-t border-zinc-800 pt-3">
            <div className="text-amber-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              <span>Optional Telegram Bot Integration</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-zinc-400 block mb-1">Bot Token</label>
                <input
                  type="password"
                  placeholder="123456789:ABCdefGHIjkl..."
                  value={formData.telegramBotToken || ''}
                  onChange={e => setFormData({ ...formData, telegramBotToken: e.target.value })}
                  className="w-full bg-[#0b0e14] border border-[#222a3a] rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Chat ID</label>
                <input
                  type="text"
                  placeholder="@channel or -10012345678"
                  value={formData.telegramChatId || ''}
                  onChange={e => setFormData({ ...formData, telegramChatId: e.target.value })}
                  className="w-full bg-[#0b0e14] border border-[#222a3a] rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Real-Time High-Impact News Alerts via Telegram */}
            <div className="flex items-center justify-between p-2 rounded bg-[#121620] border border-[#1e2433]">
              <div>
                <div className="font-bold text-zinc-200">Real-Time High-Impact News Alerts</div>
                <div className="text-[10px] text-zinc-500">Send breaking geopolitical, Fed, inflation & calendar releases to Telegram</div>
              </div>
              <input
                type="checkbox"
                checked={formData.telegramNewsAlerts ?? true}
                onChange={e => setFormData({ ...formData, telegramNewsAlerts: e.target.checked })}
                className="accent-amber-500 h-4 w-4 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestTelegram}
                className="px-2.5 py-1 rounded bg-blue-950 hover:bg-blue-900 border border-blue-800 text-blue-300 font-bold text-[11px]"
              >
                Send Test Alert
              </button>
              {telegramStatus && (
                <span className="text-[11px] text-zinc-400">{telegramStatus}</span>
              )}
            </div>
          </div>

          {/* Optional API Keys (Zero Cost Compliance) */}
          <div className="space-y-2.5 border-t border-zinc-800 pt-3">
            <div className="text-amber-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              <span>Optional Custom Provider API Keys (Not Required)</span>
            </div>
            <div className="text-[10px] text-zinc-500">
              The application is 100% functional with $0 infrastructure cost using free public datasets.
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">St. Louis Fed FRED API Key (Optional)</label>
              <input
                type="password"
                placeholder="Optional FRED API Key"
                value={formData.userApiKeys?.fredApiKey || ''}
                onChange={e =>
                  setFormData({
                    ...formData,
                    userApiKeys: { ...(formData.userApiKeys || {}), fredApiKey: e.target.value },
                  })
                }
                className="w-full bg-[#0b0e14] border border-[#222a3a] rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Footer Save Button */}
          <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Preferences</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
