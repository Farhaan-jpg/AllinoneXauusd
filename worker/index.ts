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

      // 2. /api/quote/xauusd
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

      // 3. /api/calendar
      if (path === '/api/calendar') {
        const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
        if (!res.ok) throw new Error(`Calendar error: ${res.status}`);
        const data = await res.json();
        return jsonResponse(data, corsHeaders, 180); // 3m edge cache
      }

      // 4. /api/cot
      if (path === '/api/cot') {
        const res = await fetch('https://publicreporting.cftc.gov/resource/jun7-fc8e.json?market_and_exchange_names=GOLD%20-%20COMMODITY%20EXCHANGE%20INC.');
        if (!res.ok) throw new Error(`CFTC error: ${res.status}`);
        const data = await res.json();
        return jsonResponse(data, corsHeaders, 3600); // 1h edge cache
      }

      // Default 404
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
