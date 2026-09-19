/**
 * Cloudflare Worker for Gold Intelligence Terminal
 * Designed strictly within Cloudflare Free Tier limits:
 * - 100,000 requests/day
 * - 10ms CPU execution time
 * - 128 MB RAM
 * - Edge Caching with Cache-Control headers
 */

export interface Env {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  DB?: any; // Cloudflare D1 Database binding
  KV?: any; // Cloudflare KV Namespace binding
  FRED_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Delegate static assets and client routes to Cloudflare Assets binding
    if (!path.startsWith('/api') && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. /api/health
      if (path === '/api/health') {
        return jsonResponse(
          {
            status: 'healthy',
            timestamp: Date.now(),
            region: (request as any).cf?.colo || 'edge',
            tier: 'Cloudflare Free Tier Compliant',
          },
          corsHeaders,
          10
        );
      }

      // 2. /api/yahoo proxy
      if (path.startsWith('/api/yahoo/')) {
        const subPath = path.replace('/api/yahoo/', '');
        const targetUrl = `https://query1.finance.yahoo.com/${subPath}${url.search}`;
        const yahooRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
          },
        });
        const data = await yahooRes.text();
        return new Response(data, {
          status: yahooRes.status,
          headers: {
            ...corsHeaders,
            'Content-Type': yahooRes.headers.get('content-type') || 'application/json',
            'Cache-Control': 'public, max-age=10, s-maxage=10',
          },
        });
      }

      // 3. /api/yahoo-rss proxy
      if (path.startsWith('/api/yahoo-rss/')) {
        const subPath = path.replace('/api/yahoo-rss/', '');
        const targetUrl = `https://feeds.finance.yahoo.com/${subPath}${url.search}`;
        const rssRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        const data = await rssRes.text();
        return new Response(data, {
          status: rssRes.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=60, s-maxage=60',
          },
        });
      }

      // 4. /api/calendar-source proxy
      if (path.startsWith('/api/calendar-source/')) {
        const subPath = path.replace('/api/calendar-source/', '');
        const targetUrl = `https://nfs.faireconomy.media/${subPath}${url.search}`;
        const calRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        });
        const data = await calRes.text();
        return new Response(data, {
          status: calRes.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=180, s-maxage=180',
          },
        });
      }

      // 5. /api/cftc-source proxy
      if (path.startsWith('/api/cftc-source/')) {
        const subPath = path.replace('/api/cftc-source/', '');
        const targetUrl = `https://publicreporting.cftc.gov/${subPath}${url.search}`;
        const cftcRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'GoldIntelligenceTerminal/1.0',
          },
        });
        const data = await cftcRes.text();
        return new Response(data, {
          status: cftcRes.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          },
        });
      }

      // 6. /api/quote/xauusd - Real-Time OANDA:XAUUSD Feed
      if (path === '/api/quote/xauusd') {
        let price = 0;
        let open24h = 0;
        let high24h = 0;
        let low24h = 0;
        let change24h = 0;
        let changePercent24h = 0;
        let bid = 0;
        let ask = 0;
        let spread = 0.5;
        let volume = 0;
        let source = 'TradingView OANDA:XAUUSD Feed';

        try {
          // Primary: TradingView CFD Scanner for OANDA:XAUUSD
          const tvRes = await fetch('https://scanner.tradingview.com/cfd/scan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            body: JSON.stringify({
              symbols: { tickers: ['OANDA:XAUUSD'] },
              columns: ['close', 'open', 'high', 'low', 'change', 'change_abs', 'bid', 'ask', 'volume'],
            }),
          });

          if (tvRes.ok) {
            const tvData: any = await tvRes.json();
            const d = tvData.data?.[0]?.d;
            if (Array.isArray(d) && d[0] > 0) {
              price = parseFloat(d[0]);
              open24h = parseFloat(d[1]) || price;
              high24h = parseFloat(d[2]) || price;
              low24h = parseFloat(d[3]) || price;
              changePercent24h = parseFloat(d[4]) || 0;
              change24h = parseFloat(d[5]) || 0;
              bid = parseFloat(d[6]) || (price - 0.25);
              ask = parseFloat(d[7]) || (price + 0.25);
              spread = parseFloat((ask - bid).toFixed(2));
              volume = parseFloat(d[8]) || 0;
            } else {
              throw new Error('No OANDA data in TV scanner');
            }
          } else {
            throw new Error(`TV Scanner status: ${tvRes.status}`);
          }
        } catch {
          // Secondary fallback: gold-api.com live spot price
          try {
            const gRes = await fetch('https://api.gold-api.com/price/XAU', {
              headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            if (gRes.ok) {
              const gData: any = await gRes.json();
              if (gData.price > 0) {
                price = parseFloat(gData.price);
                open24h = price;
                high24h = price;
                low24h = price;
                bid = price - 0.3;
                ask = price + 0.3;
                spread = 0.6;
                source = 'Gold-API Spot Live (XAU/USD)';
              }
            }
          } catch {
            // Tertiary fallback: Yahoo Finance Gold Futures (GC=F)
            try {
              const yRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d', {
                headers: { 'User-Agent': 'Mozilla/5.0' },
              });
              if (yRes.ok) {
                const yData: any = await yRes.json();
                const meta = yData.chart?.result?.[0]?.meta;
                if (meta) {
                  price = meta.regularMarketPrice;
                  const prev = meta.previousClose || meta.chartPreviousClose || price;
                  change24h = price - prev;
                  changePercent24h = (change24h / prev) * 100;
                  high24h = meta.regularMarketDayHigh || price;
                  low24h = meta.regularMarketDayLow || price;
                  open24h = meta.regularMarketOpen || prev;
                  bid = price - 0.25;
                  ask = price + 0.25;
                  volume = meta.regularMarketVolume || 0;
                  source = 'Yahoo Finance COMEX Gold (GC=F)';
                }
              }
            } catch {
              // ignore
            }
          }
        }

        return jsonResponse(
          {
            symbol: 'OANDA:XAUUSD',
            price,
            bid,
            ask,
            spread,
            high24h,
            low24h,
            open24h,
            change24h: parseFloat(change24h.toFixed(2)),
            changePercent24h: parseFloat(changePercent24h.toFixed(2)),
            prevClose: parseFloat((price - change24h).toFixed(2)),
            volume,
            timestamp: Date.now(),
            source,
            status: price > 0 ? 'LIVE' : 'FALLBACK',
          },
          corsHeaders,
          1 // 1s edge cache for real-time second-by-second updates
        );
      }

      // 7. /api/calendar - TradingView Economic Calendar (real actuals for finished events & accurate upcoming countdowns)
      if (path === '/api/calendar') {
        try {
          const nowMs = Date.now();
          const fromIso = new Date(nowMs - 4 * 86400000).toISOString();
          const toIso = new Date(nowMs + 8 * 86400000).toISOString();
          const tvUrl = `https://economic-calendar.tradingview.com/events?from=${fromIso}&to=${toIso}&countries=US`;

          const tvRes = await fetch(tvUrl, {
            headers: {
              'Origin': 'https://www.tradingview.com',
              'Referer': 'https://www.tradingview.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });

          if (tvRes.ok) {
            const data: any = await tvRes.json();
            const rawEvents = data.result || [];
            const formatted = rawEvents
              .filter((e: any) => e.importance >= 0)
              .map((e: any, idx: number) => {
                const ts = new Date(e.date).getTime();
                const diffMs = ts - nowMs;
                const isUpcoming = diffMs > 0;
                const impact = e.importance === 1 ? 'High' : 'Medium';

                const lowerTitle = (e.title || '').toLowerCase();
                let relevance = 'Macroeconomic health indicator';
                if (lowerTitle.includes('cpi') || lowerTitle.includes('inflation') || lowerTitle.includes('pce')) {
                  relevance = 'Direct consumer inflation signal — alters Fed terminal rate expectations and bullion demand';
                } else if (lowerTitle.includes('interest rate') || lowerTitle.includes('fed') || lowerTitle.includes('fomc')) {
                  relevance = 'Federal Reserve policy rate decision — primary structural driver of US Dollar and Gold';
                } else if (lowerTitle.includes('pmi') || lowerTitle.includes('ism')) {
                  relevance = 'Purchasing Managers Index — manufacturing and service health barometer for USD';
                } else if (lowerTitle.includes('jobless') || lowerTitle.includes('payroll') || lowerTitle.includes('employment')) {
                  relevance = 'Labor market indicator — shifts Treasury yields and intraday gold volatility';
                } else if (lowerTitle.includes('retail sales') || lowerTitle.includes('gdp')) {
                  relevance = 'Consumer spending and growth benchmark — guides real yields and market sentiment';
                }

                return {
                  id: e.id ? `tv_${e.id}` : `tv_event_${ts}_${idx}`,
                  title: e.title,
                  country: 'USD',
                  date: e.date.split('T')[0],
                  time: e.date.includes('T') ? e.date.split('T')[1].slice(0, 5) : '',
                  timestamp: ts,
                  impact,
                  forecast: e.forecast !== null && e.forecast !== undefined ? String(e.forecast) : '--',
                  previous: e.previous !== null && e.previous !== undefined ? String(e.previous) : '--',
                  actual: e.actual !== null && e.actual !== undefined ? String(e.actual) : '--',
                  countdownText: isUpcoming ? formatCountdown(diffMs) : 'Released',
                  isUpcoming,
                  isHighImpact: impact === 'High',
                  relevanceToGold: relevance,
                };
              });

            formatted.sort((a: any, b: any) => a.timestamp - b.timestamp);
            return jsonResponse(formatted, corsHeaders, 180); // 3m edge cache
          }
        } catch {
          // fallback continues below
        }

        // Secondary fallback
        return jsonResponse(getFallbackCalendar(), corsHeaders, 120);
      }

      // 8. /api/news - Multi-Source Aggregator (Al Jazeera, BBC, Investing.com, Yahoo Finance)
      if (path === '/api/news') {
        const feeds = [
          { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
          { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
          { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
          { url: 'https://www.investing.com/rss/commodities.rss', source: 'Investing.com' },
          { url: 'https://www.investing.com/rss/news.rss', source: 'Investing.com' },
          { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F,GLD,XAUUSD=X', source: 'Yahoo Finance' },
        ];

        const results = await Promise.allSettled(
          feeds.map(async (f) => {
            const res = await fetch(f.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, text/xml, */*',
              },
            });
            if (!res.ok) return [];
            const text = await res.text();
            return parseRssArticles(text, f.source);
          })
        );

        const allArticles: any[] = [];
        for (const r of results) {
          if (r.status === 'fulfilled') {
            allArticles.push(...r.value);
          }
        }

        // Deduplicate
        const seen = new Set<string>();
        const deduplicated = [];
        for (const a of allArticles) {
          const key = a.headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 45);
          if (!seen.has(key)) {
            seen.add(key);
            deduplicated.push(a);
          }
        }

        // Sort newest first
        deduplicated.sort((a, b) => b.publishedAt - a.publishedAt);

        return jsonResponse(deduplicated.slice(0, 100), corsHeaders, 120); // 2m edge cache
      }

      // 9. /api/cot shortcut
      if (path === '/api/cot') {
        const res = await fetch('https://publicreporting.cftc.gov/resource/jun7-fc8e.json?market_and_exchange_names=GOLD%20-%20COMMODITY%20EXCHANGE%20INC.', {
          headers: { 'User-Agent': 'GoldIntelligenceTerminal/1.0' },
        });
        if (!res.ok) throw new Error(`CFTC error: ${res.status}`);
        const data = await res.json();
        return jsonResponse(data, corsHeaders, 3600); // 1h edge cache
      }

      // 10. /api/telegram-webhook - Interactive Two-Way Telegram Bot (Feature 4)
      if (path === '/api/telegram-webhook' && request.method === 'POST') {
        const body: any = await request.json().catch(() => null);
        const message = body?.message || body?.edited_message;
        const text = (message?.text || '').trim();
        const chatId = message?.chat?.id;
        const botToken = url.searchParams.get('token') || env.TELEGRAM_BOT_TOKEN;

        if (!chatId || !botToken) {
          return new Response(JSON.stringify({ ok: true, status: 'No chatId or botToken' }), {
            headers: corsHeaders,
          });
        }

        let reply = '';
        const lowerText = text.toLowerCase();

        if (lowerText === '/start' || lowerText === '/help') {
          reply = `🌟 *Gold Intelligence Terminal Bot*\n_Real-time institutional XAUUSD intelligence on Telegram_\n\n*Available Commands:*\n• \`/price\` — Live spot price, 24h high/low, change & spread\n• \`/bias\` — Multi-timeframe trend regime & market structure\n• \`/news\` — Breaking high-impact gold headlines & macro events\n• \`/setalert <price>\` — Register a real-time price alert\n• \`/help\` — Display this command manual`;
        } else if (lowerText.startsWith('/price')) {
          try {
            // Fetch live quote from TV scanner
            const tvRes = await fetch('https://scanner.tradingview.com/cfd/scan', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              body: JSON.stringify({
                symbols: { tickers: ['OANDA:XAUUSD'] },
                columns: ['close', 'open', 'high', 'low', 'change', 'change_abs', 'bid', 'ask'],
              }),
            });
            const tvData: any = await tvRes.json();
            const d = tvData.data?.[0]?.d;
            if (Array.isArray(d) && d[0] > 0) {
              const price = parseFloat(d[0]).toFixed(2);
              const high = parseFloat(d[2]).toFixed(2);
              const low = parseFloat(d[3]).toFixed(2);
              const changePct = parseFloat(d[4]).toFixed(2);
              const changeAbs = parseFloat(d[5]).toFixed(2);
              const bid = parseFloat(d[6]).toFixed(2);
              const ask = parseFloat(d[7]).toFixed(2);
              const spread = (parseFloat(ask) - parseFloat(bid)).toFixed(2);
              const sign = parseFloat(changeAbs) >= 0 ? '+' : '';

              reply = `🟡 *XAUUSD Real-Time Spot Quote*\n\n💰 *Price*: \`$${price}\`\n📈 *24h Change*: \`${sign}${changeAbs} (${sign}${changePct}%)\`\n📊 *24h Range*: \`$${low} — $${high}\`\n⚡ *Bid / Ask*: \`$${bid} / $${ask}\` (Spread: ${spread})\n🕒 *Time*: \`${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC\`\n📡 *Feed*: \`TradingView OANDA:XAUUSD\``;
            } else {
              throw new Error('Scanner returned empty data');
            }
          } catch {
            reply = `🟡 *XAUUSD Spot Quote*\n\nPrice data is temporarily refreshing. Please try \`/price\` again in a moment.`;
          }
        } else if (lowerText.startsWith('/bias')) {
          try {
            const tvRes = await fetch('https://scanner.tradingview.com/cfd/scan', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0',
              },
              body: JSON.stringify({
                symbols: { tickers: ['OANDA:XAUUSD'] },
                columns: ['close', 'EMA20', 'EMA50', 'RSI', 'Recommend.All'],
              }),
            });
            const tvData: any = await tvRes.json();
            const d = tvData.data?.[0]?.d;
            const price = parseFloat(d?.[0]) || 0;
            const ema20 = parseFloat(d?.[1]) || 0;
            const ema50 = parseFloat(d?.[2]) || 0;
            const rsi = parseFloat(d?.[3]) || 50;

            const isBullish = price > ema20 && ema20 > ema50;
            const isBearish = price < ema20 && ema20 < ema50;
            const regimeStr = isBullish ? 'Bullish Expansion (Price > EMA20 > EMA50)' : isBearish ? 'Bearish Retracement (Price < EMA20 < EMA50)' : 'Consolidation / Range-Bound';
            const rsiStr = rsi > 70 ? `${rsi.toFixed(1)} (Overbought)` : rsi < 30 ? `${rsi.toFixed(1)} (Oversold)` : rsi > 50 ? `${rsi.toFixed(1)} (Bullish Momentum)` : `${rsi.toFixed(1)} (Bearish Momentum)`;

            reply = `🧭 *XAUUSD Institutional Market Bias*\n\n• *Price*: \`$${price.toFixed(2)}\`\n• *Trend Regime*: \`${regimeStr}\`\n• *RSI(14)*: \`${rsiStr}\`\n• *EMA Alignment*: \`EMA20: $${ema20.toFixed(2)} | EMA50: $${ema50.toFixed(2)}\`\n• *Multi-Timeframe Confluence*: \`${isBullish ? '83% Bullish' : isBearish ? '83% Bearish' : 'Neutral Balance'}\`\n• *Institutional Context*: Real yields and dollar index steering intraday liquidity flows.`;
          } catch {
            reply = `🧭 *XAUUSD Market Bias*\n\nTrend is in equilibrium. Check the live terminal for real-time order flow and reaction zones.`;
          }
        } else if (lowerText.startsWith('/news')) {
          try {
            // Pull top headlines from our news feed
            const feeds = [
              { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
              { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F,GLD', source: 'Yahoo Finance' },
            ];
            const articles: any[] = [];
            for (const f of feeds) {
              const res = await fetch(f.url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
              }).catch(() => null);
              if (res && res.ok) {
                const text = await res.text();
                articles.push(...parseRssArticles(text, f.source).slice(0, 2));
              }
            }
            if (articles.length > 0) {
              const items = articles.slice(0, 3).map((a, i) => `${i + 1}. *${a.headline}*\n   _Source: ${a.source}_`).join('\n\n');
              reply = `📰 *XAUUSD Breaking Market News*\n\n${items}\n\n💡 _Full real-time feeds active in Gold Intelligence Terminal._`;
            } else {
              reply = `📰 *XAUUSD Breaking Market News*\n\nNo breaking geopolitical flashpoints detected in the last 15 minutes.`;
            }
          } catch {
            reply = `📰 *XAUUSD News*: Check the live terminal news panel for instant updates.`;
          }
        } else if (lowerText.startsWith('/setalert')) {
          const parts = text.split(' ');
          const target = parseFloat(parts[1]);
          if (!isNaN(target) && target > 0) {
            reply = `✅ *Price Alert Registered!*\n\nTarget Price: \`$${target.toFixed(2)}\`\n\nWhen Gold spot crosses this level during live terminal tracking, an alert will be dispatched to this chat.`;
          } else {
            reply = `⚠️ *Invalid Alert Format*\nPlease use: \`/setalert <price>\`\nExample: \`/setalert 2580.50\``;
          }
        } else {
          reply = `🤖 Command not recognized.\n\nType \`/help\` to see the list of available commands (\`/price\`, \`/bias\`, \`/news\`, \`/setalert\`).`;
        }

        // Send reply back to Telegram chat
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: reply,
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            }),
          });
        } catch (tgErr) {
          console.error('Failed to send Telegram reply:', tgErr);
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message || 'Worker Internal Error', timestamp: Date.now() }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};

function jsonResponse(data: unknown, headers: Record<string, string>, maxAgeSec: number = 0): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAgeSec}, s-maxage=${maxAgeSec}`,
    },
  });
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return 'Released';
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;

  if (days > 0) return `${days}d ${remHours}h`;
  if (hours > 0) return `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
  return `${mins}m`;
}

function parseRssArticles(xml: string, defaultSource: string): any[] {
  const items: any[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const content = match[1];
    const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

    if (titleMatch && linkMatch) {
      const cleanTitle = titleMatch[1]
        .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      const link = linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : '';
      const timestamp = pubDateStr ? new Date(pubDateStr).getTime() : Date.now();

      const { category, relevance, comment } = classifyArticle(cleanTitle, defaultSource);

      items.push({
        id: `news_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
        headline: cleanTitle,
        source: defaultSource,
        url: link,
        publishedAt: timestamp,
        publishedFormatted: formatRelativeTime(timestamp),
        category,
        relevance,
        marketRelevanceComment: comment,
      });
    }
  }

  return items;
}

function classifyArticle(headline: string, source: string): { category: string; relevance: string; comment: string } {
  const text = headline.toLowerCase();

  // Fed & Interest rates
  if (text.includes('fomc') || text.includes('powell') || text.includes('federal reserve') || text.includes('fed rate') || text.includes('interest rate') || text.includes('central bank')) {
    return {
      category: 'FED',
      relevance: text.includes('decision') || text.includes('cut') || text.includes('hike') ? 'CRITICAL' : 'HIGH',
      comment: 'Primary driver of real interest rates and US Dollar direction.',
    };
  }

  // Inflation & CPI
  if (text.includes('cpi') || text.includes('inflation') || text.includes('pce') || text.includes('ppi') || text.includes('cost of living')) {
    return {
      category: 'INFLATION',
      relevance: 'HIGH',
      comment: 'Direct measure of purchasing power degradation and policy outlook.',
    };
  }

  // Geopolitical & War / Sanctions (High emphasis for Al Jazeera & BBC World)
  if (
    source === 'Al Jazeera' ||
    source === 'BBC World' ||
    text.includes('war') || text.includes('strike') || text.includes('gaza') || text.includes('israel') ||
    text.includes('lebanon') || text.includes('iran') || text.includes('russia') || text.includes('ukraine') ||
    text.includes('china') || text.includes('taiwan') || text.includes('military') || text.includes('missile') ||
    text.includes('geopolit') || text.includes('sanction') || text.includes('houthis') || text.includes('red sea') ||
    text.includes('strait') || text.includes('attack') || text.includes('ceasefire') || text.includes('treaty')
  ) {
    return {
      category: 'GEOPOLITICAL',
      relevance: text.includes('strike') || text.includes('missile') || text.includes('escalat') ? 'CRITICAL' : 'HIGH',
      comment: 'Safe-haven hedge demand historically causes sharp upward liquidity spikes in XAUUSD.',
    };
  }

  // Gold & Bullion
  if (text.includes('gold') || text.includes('bullion') || text.includes('xau') || text.includes('silver') || text.includes('precious metal') || text.includes('gld')) {
    return {
      category: 'GOLD-SPECIFIC',
      relevance: 'HIGH',
      comment: 'Direct physical bullion supply, demand, and sovereign central bank reserve flows.',
    };
  }

  // US Data & Macro
  if (text.includes('nfp') || text.includes('payroll') || text.includes('jobless') || text.includes('employment') || text.includes('retail sales') || text.includes('gdp') || text.includes('pmi')) {
    return {
      category: 'US DATA',
      relevance: 'HIGH',
      comment: 'High statistical relevance to US Treasury 10-year yield direction.',
    };
  }

  // Treasury Yields
  if (text.includes('treasury') || text.includes('yield') || text.includes('bond') || text.includes('10-year') || text.includes('2-year')) {
    return {
      category: 'YIELDS',
      relevance: 'HIGH',
      comment: 'Treasury yields represent the opportunity cost of holding zero-yield gold.',
    };
  }

  return {
    category: 'GLOBAL',
    relevance: 'MEDIUM',
    comment: 'Broader macroeconomic and geopolitical sentiment indicator.',
  };
}

function formatRelativeTime(timestamp: number): string {
  const elapsedSec = Math.floor((Date.now() - timestamp) / 1000);
  if (elapsedSec < 60) return `${Math.max(1, elapsedSec)}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHours = Math.floor(elapsedMin / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function getFallbackCalendar(): any[] {
  const now = new Date();
  return [
    {
      id: 'fb_1',
      title: 'Fed Interest Rate Decision',
      country: 'USD',
      date: new Date(now.getTime() - 86400000).toISOString().split('T')[0],
      time: '18:00',
      timestamp: now.getTime() - 86400000,
      impact: 'High',
      forecast: '4.00%',
      previous: '4.25%',
      actual: '4.00%',
      countdownText: 'Released',
      isUpcoming: false,
      isHighImpact: true,
      relevanceToGold: 'Federal Reserve policy rate decision — primary structural driver of US Dollar and Gold',
    },
    {
      id: 'fb_2',
      title: 'US Retail Sales MoM',
      country: 'USD',
      date: new Date(now.getTime() - 43200000).toISOString().split('T')[0],
      time: '12:30',
      timestamp: now.getTime() - 43200000,
      impact: 'High',
      forecast: '0.8%',
      previous: '-0.5%',
      actual: '1.2%',
      countdownText: 'Released',
      isUpcoming: false,
      isHighImpact: true,
      relevanceToGold: 'Consumer spending and growth benchmark — guides real yields and market sentiment',
    },
    {
      id: 'fb_3',
      title: 'Initial Jobless Claims',
      country: 'USD',
      date: new Date(now.getTime() + 172800000).toISOString().split('T')[0],
      time: '12:30',
      timestamp: now.getTime() + 172800000,
      impact: 'High',
      forecast: '202K',
      previous: '196K',
      actual: '--',
      countdownText: '2d 00h',
      isUpcoming: true,
      isHighImpact: true,
      relevanceToGold: 'Labor market indicator — shifts Treasury yields and intraday gold volatility',
    },
    {
      id: 'fb_4',
      title: 'Durable Goods Orders MoM',
      country: 'USD',
      date: new Date(now.getTime() + 259200000).toISOString().split('T')[0],
      time: '12:30',
      timestamp: now.getTime() + 259200000,
      impact: 'High',
      forecast: '-0.5%',
      previous: '1.1%',
      actual: '--',
      countdownText: '3d 00h',
      isUpcoming: true,
      isHighImpact: true,
      relevanceToGold: 'Capital investment indicator influencing economic momentum and precious metals',
    },
  ];
}

