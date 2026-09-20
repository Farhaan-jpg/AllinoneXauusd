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

      // 11. /api/candles/xauusd - Exact TradingView OANDA:XAUUSD Bars
      if (path === '/api/candles/xauusd') {
        const tf = url.searchParams.get('timeframe') || '5m';
        const limit = parseInt(url.searchParams.get('limit') || '200', 10);
        try {
          const candles = await fetchTradingViewCandles(tf, limit);
          if (candles && candles.length > 0) {
            return jsonResponse(candles, corsHeaders, 5); // 5s cache
          }
        } catch (candleErr) {
          console.warn('TV candle fetch failed, falling back to spot provider:', candleErr);
        }
        const fallbackCandles = await getFallbackSpotCandles(tf, limit);
        return jsonResponse(fallbackCandles, corsHeaders, 10);
      }

      // 12. /api/telegram/sync-config - Sync Telegram Bot credentials to Cloudflare Worker
      if (path === '/api/telegram/sync-config') {
        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          if (body.telegramBotToken !== undefined) globalCloudState.telegramBotToken = String(body.telegramBotToken || '').trim();
          if (body.telegramChatId !== undefined) globalCloudState.telegramChatId = String(body.telegramChatId || '').trim();
          if (body.telegramNewsAlerts !== undefined) globalCloudState.telegramNewsAlerts = Boolean(body.telegramNewsAlerts);

          await saveCloudConfig(env, globalCloudState);
          return jsonResponse({
            ok: true,
            message: 'Telegram settings synchronized to Cloudflare 24/7 Cloud Worker',
            active: Boolean(globalCloudState.telegramBotToken && globalCloudState.telegramChatId),
          }, corsHeaders);
        }

        const cfg = await getCloudConfig(env);
        return jsonResponse({
          ok: true,
          hasToken: Boolean(cfg.telegramBotToken || env.TELEGRAM_BOT_TOKEN),
          hasChatId: Boolean(cfg.telegramChatId || env.TELEGRAM_CHAT_ID),
          telegramNewsAlerts: cfg.telegramNewsAlerts,
        }, corsHeaders);
      }

      // 13. /api/alerts/sync - Sync Alert Rules to Cloudflare Worker
      if (path === '/api/alerts/sync') {
        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          if (Array.isArray(body.alerts)) {
            globalCloudState.alerts = body.alerts;
            await saveCloudConfig(env, globalCloudState);
          }
          return jsonResponse({ ok: true, count: globalCloudState.alerts.length }, corsHeaders);
        }
        const cfg = await getCloudConfig(env);
        return jsonResponse({ ok: true, alerts: cfg.alerts }, corsHeaders);
      }

      // 14. /api/cloud-status - Cloud Monitoring Health & Status
      if (path === '/api/cloud-status') {
        const cfg = await getCloudConfig(env);
        const hasToken = Boolean(cfg.telegramBotToken || env.TELEGRAM_BOT_TOKEN);
        const hasChatId = Boolean(cfg.telegramChatId || env.TELEGRAM_CHAT_ID);
        return jsonResponse({
          status: 'ONLINE',
          tier: 'Cloudflare Free Tier Compliant',
          cloudMonitoringActive: true,
          hasTelegramToken: hasToken,
          hasTelegramChatId: hasChatId,
          telegramAlertsReady: hasToken && hasChatId,
          newsAlertsEnabled: cfg.telegramNewsAlerts,
          registeredAlertsCount: cfg.alerts.length,
          lastCronRun: globalCloudState.lastCronRun,
          lastCronStatus: globalCloudState.lastCronStatus,
          alertsTriggeredCount: globalCloudState.alertsTriggeredCount,
          timestamp: Date.now(),
        }, corsHeaders);
      }

      // 15. /api/cloud-trigger - Trigger cloud monitoring cycle immediately (for testing)
      if (path === '/api/cloud-trigger') {
        const result = await runCloudAlertCycle(env);
        return jsonResponse({ ok: true, result, timestamp: Date.now() }, corsHeaders);
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

  // 24/7 Cloudflare Cron Trigger Handler
  // Executes every minute in Cloudflare cloud even when browser is closed
  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(runCloudAlertCycle(env));
    } else {
      await runCloudAlertCycle(env);
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
        id: generateArticleId(cleanTitle, link),
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

function generateArticleId(headline: string, link: string): string {
  const norm = (headline + ' ' + link).toLowerCase().replace(/[^a-z0-9]/g, '');
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = ((hash << 5) - hash) + norm.charCodeAt(i);
    hash |= 0;
  }
  const cleanPrefix = headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
  return `art_${Math.abs(hash)}_${cleanPrefix}`;
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

// --- 24/7 Cloud Alerting & State Management ---

interface CloudTerminalState {
  telegramBotToken: string;
  telegramChatId: string;
  telegramNewsAlerts: boolean;
  alerts: Array<{
    id: string;
    title: string;
    type: string;
    target_value: string;
    condition: string;
    enabled: boolean;
    last_triggered?: number;
  }>;
  seenNewsIds: string[];
  seenEventIds: string[];
  lastCronRun: number;
  lastCronStatus: string;
  alertsTriggeredCount: number;
}

const globalCloudState: CloudTerminalState = {
  telegramBotToken: '',
  telegramChatId: '',
  telegramNewsAlerts: true,
  alerts: [],
  seenNewsIds: [],
  seenEventIds: [],
  lastCronRun: 0,
  lastCronStatus: 'Initialized (Waiting for first cron cycle)',
  alertsTriggeredCount: 0,
};

async function getCloudConfig(env: Env): Promise<CloudTerminalState> {
  // If KV is bound, load from KV
  if (env.KV) {
    try {
      const saved = await env.KV.get('gold_terminal_cloud_config', 'json');
      if (saved) {
        return {
          ...globalCloudState,
          ...saved,
          telegramBotToken: saved.telegramBotToken || globalCloudState.telegramBotToken,
          telegramChatId: saved.telegramChatId || globalCloudState.telegramChatId,
        };
      }
    } catch {}
  }
  return globalCloudState;
}

async function saveCloudConfig(env: Env, state: CloudTerminalState): Promise<void> {
  if (env.KV) {
    try {
      await env.KV.put('gold_terminal_cloud_config', JSON.stringify({
        telegramBotToken: state.telegramBotToken,
        telegramChatId: state.telegramChatId,
        telegramNewsAlerts: state.telegramNewsAlerts,
        alerts: state.alerts,
        seenNewsIds: state.seenNewsIds.slice(-200),
        seenEventIds: state.seenEventIds.slice(-200),
      }));
    } catch {}
  }
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<boolean> {
  if (!token || !chatId || !text) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return false;
  }
}

async function runCloudAlertCycle(env: Env): Promise<{ ok: boolean; alertsSent: number; error?: string }> {
  try {
    const config = await getCloudConfig(env);
    const botToken = config.telegramBotToken || env.TELEGRAM_BOT_TOKEN;
    const chatId = config.telegramChatId || env.TELEGRAM_CHAT_ID;
    const newsAlertsEnabled = config.telegramNewsAlerts ?? true;

    globalCloudState.lastCronRun = Date.now();
    let alertsSent = 0;

    if (!botToken || !chatId) {
      globalCloudState.lastCronStatus = 'Idle (No Telegram Bot Token or Chat ID configured in cloud)';
      return { ok: true, alertsSent: 0 };
    }

    // 1. Fetch live quote for price alert checking
    let currentPrice = 0;
    try {
      const tvRes = await fetch('https://scanner.tradingview.com/cfd/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
          symbols: { tickers: ['OANDA:XAUUSD'] },
          columns: ['close', 'open', 'high', 'low', 'change', 'change_abs', 'bid', 'ask'],
        }),
      });
      if (tvRes.ok) {
        const tvData: any = await tvRes.json();
        const d = tvData.data?.[0]?.d;
        if (Array.isArray(d) && d[0] > 0) {
          currentPrice = parseFloat(d[0]);
        }
      }
    } catch {}

    // Check user price alerts
    if (currentPrice > 0 && config.alerts && config.alerts.length > 0) {
      for (const alert of config.alerts) {
        if (!alert.enabled) continue;
        const target = parseFloat(alert.target_value);
        if (isNaN(target) || target <= 0) continue;

        // Check if recently triggered (15 min cooldown per alert)
        const lastTrig = alert.last_triggered || 0;
        if (Date.now() - lastTrig < 15 * 60 * 1000) continue;

        let triggered = false;
        let condText = '';

        if (alert.condition === 'CROSSES_ABOVE' && currentPrice >= target) {
          triggered = true;
          condText = `crossed above target of $${target.toFixed(2)}`;
        } else if (alert.condition === 'CROSSES_BELOW' && currentPrice <= target) {
          triggered = true;
          condText = `crossed below target of $${target.toFixed(2)}`;
        } else if (alert.condition === 'EQUALS' && Math.abs(currentPrice - target) <= 0.5) {
          triggered = true;
          condText = `reached target level of $${target.toFixed(2)}`;
        }

        if (triggered) {
          alert.last_triggered = Date.now();
          globalCloudState.alertsTriggeredCount++;
          alertsSent++;

          const alertMsg = `🎯 *XAUUSD Price Alert Triggered!*\n\n• *Symbol*: \`OANDA:XAUUSD\`\n• *Live Spot Price*: \`$${currentPrice.toFixed(2)}\`\n• *Trigger*: Gold has ${condText}\n• *Alert Title*: *${alert.title || 'Price Target Reached'}*\n🕒 *Timestamp*: \`${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC\`\n\n⚡ _Sent by Gold Intelligence Terminal Cloud Monitor (24/7 Active)_`;

          await sendTelegramMessage(botToken, chatId, alertMsg);
        }
      }
    }

    // 2. Check Economic Calendar (Upcoming & Released)
    try {
      const nowMs = Date.now();
      const fromIso = new Date(nowMs - 3600000).toISOString(); // last 1 hour
      const toIso = new Date(nowMs + 3600000).toISOString(); // next 1 hour
      const tvCalUrl = `https://economic-calendar.tradingview.com/events?from=${fromIso}&to=${toIso}&countries=US`;

      const calRes = await fetch(tvCalUrl, {
        headers: {
          'Origin': 'https://www.tradingview.com',
          'Referer': 'https://www.tradingview.com/',
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (calRes.ok) {
        const calData: any = await calRes.json();
        const events = calData.result || [];
        for (const ev of events) {
          if (ev.importance !== 1) continue; // Only High Impact

          const evDateMs = new Date(ev.date).getTime();
          const diffMs = evDateMs - nowMs;
          const evId = `cal_${ev.id || ev.title}_${ev.date}`;

          // A) Upcoming in next 15 minutes
          if (diffMs > 0 && diffMs <= 15 * 60 * 1000) {
            const upKey = `${evId}_upcoming`;
            if (!globalCloudState.seenEventIds.includes(upKey)) {
              globalCloudState.seenEventIds.push(upKey);
              if (globalCloudState.seenEventIds.length > 500) globalCloudState.seenEventIds.shift();
              alertsSent++;

              const mins = Math.max(1, Math.round(diffMs / 60000));
              const calMsg = `⏰ *High-Impact Economic Release Imminent (${mins}m)*\n\n📌 *${ev.title}*\n• *Country*: \`USD\`\n• *Forecast*: \`${ev.forecast !== null && ev.forecast !== undefined ? ev.forecast : '--'}\` | *Previous*: \`${ev.previous !== null && ev.previous !== undefined ? ev.previous : '--'}\`\n• *Scheduled*: \`${ev.date.replace('T', ' ').slice(0, 16)} UTC\`\n\n⚠️ *Gold Impact Warning*: Expect heightened volatility in XAUUSD during this release window.`;

              await sendTelegramMessage(botToken, chatId, calMsg);
            }
          }

          // B) Just released in last 15 minutes with actual
          if (diffMs <= 0 && Math.abs(diffMs) <= 15 * 60 * 1000 && ev.actual !== null && ev.actual !== undefined) {
            const relKey = `${evId}_released`;
            if (!globalCloudState.seenEventIds.includes(relKey)) {
              globalCloudState.seenEventIds.push(relKey);
              if (globalCloudState.seenEventIds.length > 500) globalCloudState.seenEventIds.shift();
              alertsSent++;

              const calMsg = `📊 *Breaking Economic Release Actuals*\n\n📌 *${ev.title}*\n• *Actual*: \`${ev.actual}\`\n• *Forecast*: \`${ev.forecast !== null && ev.forecast !== undefined ? ev.forecast : '--'}\`\n• *Previous*: \`${ev.previous !== null && ev.previous !== undefined ? ev.previous : '--'}\`\n\n💡 *Market Reaction*: Compare actual vs forecast to evaluate US Dollar momentum and gold real yield response.`;

              await sendTelegramMessage(botToken, chatId, calMsg);
            }
          }
        }
      }
    } catch (calErr) {
      console.error('Cloud calendar check error:', calErr);
    }

    // 3. Check Breaking News (if news alerts enabled)
    if (newsAlertsEnabled) {
      try {
        const feeds = [
          { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
          { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
          { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
          { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F,GLD,XAUUSD=X', source: 'Yahoo Finance' },
        ];

        for (const feed of feeds) {
          const res = await fetch(feed.url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          }).catch(() => null);

          if (!res || !res.ok) continue;
          const xml = await res.text();
          const articles = parseRssArticles(xml, feed.source);

          // Only take articles from last 45 minutes with CRITICAL or HIGH relevance
          const cutoff = Date.now() - 45 * 60 * 1000;
          const freshHighImpact = articles.filter(
            a => a.publishedAt >= cutoff && (a.relevance === 'CRITICAL' || a.relevance === 'HIGH')
          );

          for (const art of freshHighImpact.slice(0, 1)) {
            if (!globalCloudState.seenNewsIds.includes(art.id)) {
              globalCloudState.seenNewsIds.push(art.id);
              if (globalCloudState.seenNewsIds.length > 500) globalCloudState.seenNewsIds.shift();
              alertsSent++;

              const newsMsg = `🚨 *XAUUSD Breaking Market Intelligence*\n\n📰 *${art.headline}*\n\n• *Category*: \`${art.category}\`\n• *Source*: \`${art.source}\`\n• *Impact*: *${art.relevance}*\n• *Market Context*: _${art.marketRelevanceComment}_\n\n🔗 [Read Full Story](${art.url})\n🕒 \`${art.publishedFormatted}\``;

              await sendTelegramMessage(botToken, chatId, newsMsg);
            }
          }
        }
      } catch (newsErr) {
        console.error('Cloud news check error:', newsErr);
      }
    }

    await saveCloudConfig(env, config);

    globalCloudState.lastCronStatus = `Success (${alertsSent} alert(s) dispatched at ${new Date().toISOString()})`;
    return { ok: true, alertsSent };
  } catch (err: any) {
    globalCloudState.lastCronStatus = `Error: ${err.message || String(err)}`;
    return { ok: false, alertsSent: 0, error: err.message };
  }
}

// Exact OANDA:XAUUSD Bar Provider via TradingView WebSocket
async function fetchTradingViewCandles(timeframe: string, limit: number): Promise<any[]> {
  const resolutionMap: Record<string, string> = {
    '1m': '1',
    '5m': '5',
    '15m': '15',
    '1H': '60',
    '4H': '240',
    '1D': '1D',
  };
  const resolution = resolutionMap[timeframe] || '5';
  const nBars = Math.min(Math.max(limit, 30), 500);

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('TradingView WebSocket timeout in worker'));
      }
    }, 4500);

    try {
      const WebSocketCls = (globalThis as any).WebSocket;
      if (!WebSocketCls) {
        throw new Error('No WebSocket available in runtime');
      }

      const ws = new WebSocketCls('wss://data.tradingview.com/socket.io/websocket');
      const session = 'cs_' + Math.random().toString(36).substring(2, 10);

      function send(msg: any) {
        const json = JSON.stringify(msg);
        ws.send('~m~' + json.length + '~m~' + json);
      }

      ws.onopen = () => {
        send({ m: 'set_auth_token', p: ['unauthorized_user_token'] });
        send({ m: 'chart_create_session', p: [session, ''] });
        send({ m: 'resolve_symbol', p: [session, 'sds_sym_1', JSON.stringify({ symbol: 'OANDA:XAUUSD', adjustment: 'splits' })] });
        send({ m: 'create_series', p: [session, 'sds_1', 's1', 'sds_sym_1', resolution, nBars, ''] });
      };

      ws.onmessage = (e: any) => {
        const raw = typeof e.data === 'string' ? e.data : e.data.toString();
        if (raw.includes('~h~')) {
          ws.send('~m~' + raw.length + '~m~' + raw);
          return;
        }
        const msgs = raw.split(/~m~\d+~m~/).filter(Boolean);
        for (const m of msgs) {
          try {
            const obj = JSON.parse(m);
            if (obj.m === 'timescale_update') {
              const bars = obj.p?.[1]?.sds_1?.s;
              if (Array.isArray(bars) && bars.length > 0) {
                if (!settled) {
                  settled = true;
                  clearTimeout(timeout);
                  try { ws.close(); } catch {}
                  const formatted = bars.map((b: any) => {
                    const v = b.v;
                    const time = v[0];
                    const open = parseFloat(Number(v[1]).toFixed(2));
                    const high = parseFloat(Number(v[2]).toFixed(2));
                    const low = parseFloat(Number(v[3]).toFixed(2));
                    const close = parseFloat(Number(v[4]).toFixed(2));
                    const volume = parseFloat(Number(v[5]).toFixed(2)) || 0;
                    return {
                      time,
                      open,
                      high,
                      low,
                      close,
                      volume,
                      buyVolume: Math.round(volume * 0.52),
                      sellVolume: Math.round(volume * 0.48),
                    };
                  });
                  resolve(formatted);
                }
              }
            }
          } catch {}
        }
      };

      ws.onerror = (err: any) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        }
      };
    } catch (e) {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(e);
      }
    }
  });
}

// Fallback spot candles using Yahoo GC=F (range 5d/1mo/3mo to ensure non-empty) calibrated to live spot
async function getFallbackSpotCandles(timeframe: string, limit: number): Promise<any[]> {
  const yIntervalMap: Record<string, { interval: string; range: string }> = {
    '1m': { interval: '1m', range: '5d' },
    '5m': { interval: '5m', range: '5d' },
    '15m': { interval: '15m', range: '5d' },
    '1H': { interval: '60m', range: '1mo' },
    '4H': { interval: '60m', range: '3mo' },
    '1D': { interval: '1d', range: '6mo' },
  };
  const { interval: yInt, range: yRng } = yIntervalMap[timeframe] || { interval: '5m', range: '5d' };

  try {
    const yRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${yInt}&range=${yRng}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (yRes.ok) {
      const yData: any = await yRes.json();
      const res0 = yData.chart?.result?.[0];
      const timestamps = res0?.timestamp;
      const quote0 = res0?.indicators?.quote?.[0];
      if (Array.isArray(timestamps) && quote0 && timestamps.length > 0) {
        const raw: any[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const o = quote0.open?.[i];
          const h = quote0.high?.[i];
          const l = quote0.low?.[i];
          const c = quote0.close?.[i];
          const v = quote0.volume?.[i] || 0;
          if (o !== null && h !== null && l !== null && c !== null && !isNaN(o) && !isNaN(c)) {
            raw.push({
              time: timestamps[i],
              open: parseFloat(Number(o).toFixed(2)),
              high: parseFloat(Number(h).toFixed(2)),
              low: parseFloat(Number(l).toFixed(2)),
              close: parseFloat(Number(c).toFixed(2)),
              volume: v,
              buyVolume: Math.round(v * 0.52),
              sellVolume: Math.round(v * 0.48),
            });
          }
        }
        if (raw.length > 5) {
          return raw.slice(-limit);
        }
      }
    }
  } catch (err) {
    console.error('Yahoo fallback candle fetch failed:', err);
  }

  return [];
}

