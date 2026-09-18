import React, { useState } from 'react';
import { ExternalLink, Filter, Newspaper, ShieldAlert } from 'lucide-react';
import { NewsArticle } from '../types/market';

interface NewsPanelProps {
  articles: NewsArticle[];
}

export const NewsPanel: React.FC<NewsPanelProps> = ({ articles }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [highImpactOnly, setHighImpactOnly] = useState(false);

  const categories = ['ALL', 'GEOPOLITICAL', 'FED', 'INFLATION', 'GOLD-SPECIFIC', 'US DATA', 'YIELDS'];
  const sources = ['ALL', 'Al Jazeera', 'BBC', 'Investing.com', 'Yahoo Finance'];

  const filtered = articles.filter(a => {
    if (selectedCategory !== 'ALL' && a.category !== selectedCategory) return false;
    if (selectedSource !== 'ALL') {
      if (!a.source.toLowerCase().includes(selectedSource.toLowerCase())) return false;
    }
    if (highImpactOnly && (a.relevance !== 'CRITICAL' && a.relevance !== 'HIGH')) return false;
    return true;
  });

  const getSourceBadgeStyle = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes('al jazeera')) return 'text-amber-400 bg-amber-950/50 border-amber-800/50';
    if (s.includes('bbc')) return 'text-rose-400 bg-rose-950/50 border-rose-800/50';
    if (s.includes('investing')) return 'text-cyan-400 bg-cyan-950/50 border-cyan-800/50';
    if (s.includes('yahoo')) return 'text-violet-400 bg-violet-950/50 border-violet-800/50';
    return 'text-zinc-400 bg-zinc-900 border-zinc-800';
  };

  return (
    <div className="terminal-card overflow-hidden">
      <div className="terminal-header">
        <div className="flex items-center gap-1.5 text-zinc-200">
          <Newspaper className="w-4 h-4 text-amber-400" />
          <span>REAL-TIME MACRO & GEOPOLITICAL NEWS INTELLIGENCE</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={highImpactOnly}
              onChange={e => setHighImpactOnly(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span className="hidden sm:inline">High Impact Only</span>
            <span className="sm:hidden">High Only</span>
          </label>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-3">
        {/* Category & Source Controls */}
        <div className="space-y-2">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
            <span className="text-[10px] text-zinc-500 uppercase font-bold mr-1 shrink-0">Topic:</span>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sources */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
            <span className="text-[10px] text-zinc-500 uppercase font-bold mr-1 shrink-0">Desk:</span>
            {sources.map(src => (
              <button
                key={src}
                onClick={() => setSelectedSource(src)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors ${
                  selectedSource === src
                    ? 'bg-zinc-200 text-zinc-950'
                    : 'bg-[#10141f] text-zinc-500 hover:text-zinc-300 border border-zinc-800/80'
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        </div>

        {/* Articles List */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 font-mono text-xs">
              No headlines match selected filter criteria.
            </div>
          ) : (
            filtered.map(item => {
              const badgeClass = getSourceBadgeStyle(item.source);

              return (
                <div
                  key={item.id}
                  className="bg-[#121620] p-2.5 rounded border border-[#1e2433] hover:border-[#2d3748] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                        item.relevance === 'CRITICAL'
                          ? 'bg-rose-950 text-rose-300 border border-rose-700'
                          : item.relevance === 'HIGH'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {item.relevance}
                      </span>
                      <span className="text-zinc-400 font-semibold">{item.category}</span>
                      <span className="text-zinc-600">•</span>
                      <span className={`px-1.5 py-0.2 rounded border text-[10px] font-medium ${badgeClass}`}>
                        {item.source}
                      </span>
                    </div>

                    <span className="text-zinc-500 shrink-0">{item.publishedFormatted}</span>
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-zinc-100 hover:text-amber-400 transition-colors flex items-start justify-between gap-2"
                  >
                    <span>{item.headline}</span>
                    <ExternalLink className="w-3 h-3 text-zinc-500 mt-0.5 shrink-0" />
                  </a>

                  {item.marketRelevanceComment && (
                    <div className="mt-1.5 text-[11px] font-mono text-zinc-400 bg-[#0c0e14] p-1.5 rounded border border-[#181d28]">
                      <span className="text-zinc-500 font-bold uppercase text-[9px] mr-1">Context:</span>
                      {item.marketRelevanceComment}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between border-t border-[#1a212e] pt-2 flex-wrap gap-1">
          <span>Sources: Al Jazeera, BBC World & Business, Investing.com, Yahoo Finance</span>
          <span>Deduplicated & classified</span>
        </div>
      </div>
    </div>
  );
};

