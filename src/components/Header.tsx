import React, { useEffect, useState } from 'react';
import { Activity, Bell, ExternalLink, Settings, Volume2, VolumeX } from 'lucide-react';
import { SessionInfo, TerminalSettings } from '../types/market';
import { SessionEngine } from '../services/engines/sessionEngine';

interface HeaderProps {
  sessionInfo: SessionInfo;
  isLive: boolean;
  isDelayed: boolean;
  settings: TerminalSettings;
  unreadAlertsCount: number;
  onOpenSettings: () => void;
  onOpenDiagnostics: () => void;
  onOpenAlerts: () => void;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessionInfo,
  isLive,
  isDelayed,
  settings,
  unreadAlertsCount,
  onOpenSettings,
  onOpenDiagnostics,
  onOpenAlerts,
  onToggleSound,
}) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(SessionEngine.formatTimeInTz(new Date(), settings.timezone));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [settings.timezone]);

  const tzLabel = settings.timezone === 'Asia/Kolkata' ? 'IST (UTC+5:30)' : settings.timezone;

  return (
    <header className="bg-[#090b10] border-b border-[#1e2430] px-3 py-2.5 sm:px-4 sm:py-3 sticky top-0 z-40">
      <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        {/* Left: Terminal Logo & Live Beacon */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 live-beacon shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-black tracking-wider text-amber-400 font-mono">
                  GOLD INTEL
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700">
                  TERMINAL
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono tracking-tight flex items-center gap-1.5">
                <span>OANDA:XAUUSD</span>
                <span>•</span>
                <span className={isLive ? 'text-emerald-400 font-semibold' : isDelayed ? 'text-amber-400 font-semibold' : 'text-zinc-400'}>
                  {isLive ? 'LIVE SPOT' : isDelayed ? 'DELAYED' : 'STALE'}
                </span>
              </div>
            </div>
          </div>

          {/* Session Banner (Desktop) */}
          <div className="hidden lg:flex items-center gap-2 bg-[#121620] px-2.5 py-1 rounded border border-[#202736] text-xs">
            <span className="text-zinc-400 text-[11px]">SESSION:</span>
            <span className="text-zinc-200 font-medium">{sessionInfo.currentSession}</span>
            {sessionInfo.isLondonNYOverlap && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-1.5 py-0.2 rounded">
                OVERLAP ACTIVE
              </span>
            )}
          </div>

          {/* Cloud 24/7 Alerting Indicator */}
          {settings.telegramBotToken && settings.telegramChatId && (
            <div
              className="hidden xl:flex items-center gap-1.5 bg-[#0b141d] px-2.5 py-1 rounded border border-emerald-900/60 text-xs font-mono"
              title="Cloudflare 24/7 background worker is actively monitoring events, news & price triggers even when website is closed"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-emerald-400 font-bold text-[11px]">CLOUD 24/7 ACTIVE</span>
            </div>
          )}
        </div>

        {/* Right: Time, TradingView direct link, audio, diagnostics, settings */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Clock */}
          <div className="hidden md:flex flex-col items-end mr-1 text-right">
            <span className="font-mono text-xs font-semibold text-zinc-200 tabular-nums">
              {timeStr}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">{tzLabel}</span>
          </div>

          {/* OPEN IN TRADINGVIEW Button */}
          <a
            href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-blue-950/70 hover:bg-blue-900 text-blue-300 border border-blue-800/80 hover:border-blue-600 px-2 sm:px-2.5 py-1.5 rounded text-xs font-semibold transition-colors"
            title="Open official OANDA:XAUUSD chart in TradingView"
          >
            <span className="hidden sm:inline">TRADINGVIEW</span>
            <span className="sm:hidden">TV</span>
            <ExternalLink className="w-3 h-3 text-blue-400" />
          </a>

          {/* Alerts Bell */}
          <button
            onClick={onOpenAlerts}
            className="relative p-1.5 sm:p-2 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
            title="View Alerts & Zones"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            className="p-1.5 sm:p-2 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
            title={settings.soundAlerts ? 'Audio Alerts Enabled' : 'Audio Alerts Muted'}
          >
            {settings.soundAlerts ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
          </button>

          {/* Diagnostics Button */}
          <button
            onClick={onOpenDiagnostics}
            className="p-1.5 sm:p-2 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
            title="System Diagnostics (/diagnostics)"
          >
            <Activity className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 sm:p-2 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
            title="Terminal Settings"
          >
            <Settings className="w-4 h-4 text-zinc-300" />
          </button>
        </div>
      </div>
    </header>
  );
};
