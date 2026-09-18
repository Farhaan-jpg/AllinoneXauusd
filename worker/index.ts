/**
 * Cloudflare Worker for Gold Intelligence Terminal
 * Designed strictly within Cloudflare Free Tier limits:
 * - 100,000 requests/day
 * - 10ms CPU execution time
 * - 128 MB RAM
 * - Edge Caching with Cache-Control headers
 */

export interface Env {
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

      // 6. /api/quote/xauusd
      if (path === '/api/quote/xauusd') {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT');
        if (!res.ok) throw new Error(`Binance error: ${res.status}`);
        const data: any = await res.json();
        return jsonResponse(
          {
            symbol: 'OANDA:XAUUSD (Proxy: PAXG)',
            price: parseFloat(data.lastPrice),
            high24h: parseFloat(data.highPrice),
            low24h: parseFloat(data.lowPrice),
            change24h: parseFloat(data.priceChange),
            changePercent24h: parseFloat(data.priceChangePercent),
            volume: parseFloat(data.volume),
            timestamp: Date.now(),
            source: 'Binance PAXG/USDT 1oz Physical Gold Proxy',
            status: 'live',
          },
          corsHeaders,
          3 // 3s edge cache
        );
      }

      // 7. /api/calendar shortcut
      if (path === '/api/calendar') {
        const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) throw new Error(`Calendar error: ${res.status}`);
        const data = await res.json();
        return jsonResponse(data, corsHeaders, 180); // 3m edge cache
      }

      // 8. /api/cot shortcut
      if (path === '/api/cot') {
        const res = await fetch('https://publicreporting.cftc.gov/resource/jun7-fc8e.json?market_and_exchange_names=GOLD%20-%20COMMODITY%20EXCHANGE%20INC.', {
          headers: { 'User-Agent': 'GoldIntelligenceTerminal/1.0' },
        });
        if (!res.ok) throw new Error(`CFTC error: ${res.status}`);
        const data = await res.json();
        return jsonResponse(data, corsHeaders, 3600); // 1h edge cache
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
