import React from 'react';
import { BarChart2, Globe, LayoutDashboard, Newspaper, Settings } from 'lucide-react';

export type MobileTab = 'OVERVIEW' | 'CHART' | 'NEWS' | 'MACRO' | 'SETTINGS';

interface MobileNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'OVERVIEW', label: 'Overview', icon: LayoutDashboard },
    { id: 'CHART', label: 'Chart', icon: BarChart2 },
    { id: 'MACRO', label: 'Macro', icon: Globe },
    { id: 'NEWS', label: 'News', icon: Newspaper },
    { id: 'SETTINGS', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090b10] border-t border-[#1e2430] lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded text-[10px] font-mono font-semibold transition-colors ${
                isActive ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-zinc-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
