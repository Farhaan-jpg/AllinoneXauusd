import { AlertEvent, AlertRule, EconomicEvent, LiquidityLevel, MarketQuote, MarketStructureState, OrderFlowState, TradingZone } from '../../types/market';

type AlertCallback = (event: AlertEvent) => void;

export class AlertEngine {
  private rules: AlertRule[] = [];
  private eventHistory: AlertEvent[] = [];
  private listeners: Set<AlertCallback> = new Set();
  private cooldownMap: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 300000; // 5 minute cooldown per alert trigger
  private soundEnabled = true;

  // Session baseline & transition tracking to prevent alerts on page load
  private isInitialized = false;
  private lastPrice: number | null = null;
  private lastBosSignature: string | null = null;
  private lastChochSignature: string | null = null;
  private insideZoneIds: Set<string> = new Set();
  private sweptLevelIds: Set<string> = new Set();
  private triggeredNewsIds: Set<string> = new Set();

  constructor() {
    this.loadPersistedRules();
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public getRules(): AlertRule[] {
    return [...this.rules];
  }

  public getHistory(): AlertEvent[] {
    return [...this.eventHistory];
  }

  public resetSession() {
    this.isInitialized = false;
    this.lastPrice = null;
    this.lastBosSignature = null;
    this.lastChochSignature = null;
    this.insideZoneIds.clear();
    this.sweptLevelIds.clear();
    this.triggeredNewsIds.clear();
    this.cooldownMap.clear();
  }

  public addRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
    };
    this.rules.push(newRule);
    this.persistRules();
    return newRule;
  }

  public removeRule(id: string) {
    this.rules = this.rules.filter(r => r.id !== id);
    this.persistRules();
  }

  public toggleRule(id: string, enabled: boolean) {
    const r = this.rules.find(rule => rule.id === id);
    if (r) {
      r.enabled = enabled;
      this.persistRules();
    }
  }

  public subscribe(cb: AlertCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public clearHistory() {
    this.eventHistory = [];
  }

  /**
   * Evaluates all active alert rules against current market state.
   * On first run, it establishes baseline states so existing historical
   * conditions do NOT trigger Telegram alerts or audio chimes on page load.
   */
  public evaluate(
    quote: MarketQuote,
    structure: MarketStructureState,
    zones: TradingZone[],
    liquidity: LiquidityLevel[],
    orderFlow: OrderFlowState,
    upcomingEvents: EconomicEvent[],
    telegramConfig?: { botToken?: string; chatId?: string }
  ) {
    const now = Date.now();

    // --- BASELINE WARMUP ON INITIAL LOAD ---
    // When the user opens the terminal, record the current baseline and suppress firing
    // so the user is never spammed with historical events on page load.
    if (!this.isInitialized) {
      this.isInitialized = true;
      this.lastPrice = quote.price;
      this.lastBosSignature = structure.bos ? `${structure.bos.type}_${structure.bos.price}` : null;
      this.lastChochSignature = structure.choch ? `${structure.choch.type}_${structure.choch.price}` : null;
      this.insideZoneIds = new Set(
        zones.filter(z => quote.price >= z.priceMin && quote.price <= z.priceMax).map(z => z.id)
      );
      this.sweptLevelIds = new Set(
        liquidity.filter(l => l.status === 'SWEPT').map(l => l.id)
      );
      // Suppress imminent news alerts if they already exist on initial load
      upcomingEvents
        .filter(e => e.isHighImpact && e.country === 'USD' && e.timestamp > now && (e.timestamp - now) <= 15 * 60 * 1000)
        .forEach(e => this.triggeredNewsIds.add(e.id));
      return;
    }

    const prevPrice = this.lastPrice ?? quote.price;

    // 1. Evaluate User Configured Rules
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      const lastTrigger = this.cooldownMap.get(rule.id) || 0;
      if (now - lastTrigger < this.COOLDOWN_MS) continue;

      let triggered = false;
      let message = '';

      if (rule.type === 'PRICE_LEVEL') {
        const target = parseFloat(String(rule.targetValue));
        if (!isNaN(target)) {
          // Only trigger on an actual price crossover during live tracking
          if (rule.condition === 'ABOVE' && prevPrice < target && quote.price >= target) {
            triggered = true;
            message = `Gold price crossed above $${target.toFixed(2)} (Current: $${quote.price.toFixed(2)})`;
          } else if (rule.condition === 'BELOW' && prevPrice > target && quote.price <= target) {
            triggered = true;
            message = `Gold price dropped below $${target.toFixed(2)} (Current: $${quote.price.toFixed(2)})`;
          }
        }
      } else if (rule.type === 'STRUCTURE_BREAK') {
        const currentBosSig = structure.bos ? `${structure.bos.type}_${structure.bos.price}` : null;
        const currentChochSig = structure.choch ? `${structure.choch.type}_${structure.choch.price}` : null;

        if (structure.bos && currentBosSig !== this.lastBosSignature) {
          triggered = true;
          this.lastBosSignature = currentBosSig;
          message = `Break of Structure detected: ${structure.bos.type} at $${structure.bos.price.toFixed(2)}`;
        } else if (structure.choch && currentChochSig !== this.lastChochSignature) {
          triggered = true;
          this.lastChochSignature = currentChochSig;
          message = `Change of Character detected: ${structure.choch.type} at $${structure.choch.price.toFixed(2)}`;
        }
      } else if (rule.type === 'ZONE_ENTER') {
        // Only trigger if price was NOT already inside the zone
        const enteredZone = zones.find(
          z => z.status === 'ACTIVE' &&
               quote.price >= z.priceMin &&
               quote.price <= z.priceMax &&
               !this.insideZoneIds.has(z.id)
        );
        if (enteredZone) {
          triggered = true;
          message = `Price entered ${enteredZone.type} ($${enteredZone.priceMin.toFixed(2)} - $${enteredZone.priceMax.toFixed(2)}) — Reason: ${enteredZone.reason}`;
        }
      } else if (rule.type === 'VOLUME_SPIKE') {
        if (orderFlow.volumeSpike || orderFlow.deltaSpike) {
          triggered = true;
          message = `Abnormal Order Flow activity: ${orderFlow.volumeSpike ? 'Volume Spike' : ''} ${orderFlow.deltaSpike ? 'Delta Spike' : ''} (Delta: ${orderFlow.delta})`;
        }
      }

      if (triggered) {
        this.cooldownMap.set(rule.id, now);
        this.dispatchAlert({
          id: `evt_${now}_${Math.random().toString(36).substring(2, 6)}`,
          ruleId: rule.id,
          type: rule.type,
          title: rule.title,
          message,
          timestamp: now,
          level: 'warning',
          read: false,
        }, telegramConfig);
      }
    }

    // 2. High-Impact Macro News Countdown Alert (Built-in safeguard)
    const imminentNews = upcomingEvents.find(
      e => e.isHighImpact && e.country === 'USD' && e.timestamp > now && (e.timestamp - now) <= 15 * 60 * 1000
    );

    if (imminentNews && !this.triggeredNewsIds.has(imminentNews.id)) {
      this.triggeredNewsIds.add(imminentNews.id);
      this.dispatchAlert({
        id: `evt_news_${now}`,
        type: 'NEWS_HIGH_IMPACT',
        title: `Upcoming Event Risk: ${imminentNews.title}`,
        message: `${imminentNews.title} releases in ${imminentNews.countdownText}. XAUUSD spread and volatility may surge.`,
        timestamp: now,
        level: 'critical',
        read: false,
      }, telegramConfig);
    }

    // 3. Liquidity Sweep Alert (Built-in)
    const newSweep = liquidity.find(
      l => l.status === 'SWEPT' && l.distancePips < 1.0 && !this.sweptLevelIds.has(l.id)
    );
    if (newSweep) {
      this.sweptLevelIds.add(newSweep.id);
      this.dispatchAlert({
        id: `evt_sweep_${now}`,
        type: 'STRUCTURE_BREAK',
        title: `Liquidity Sweep: ${newSweep.label}`,
        message: `Price swept ${newSweep.label} at $${newSweep.price.toFixed(2)}. Monitor for displacement or rejection.`,
        timestamp: now,
        level: 'info',
        read: false,
      }, telegramConfig);
    }

    // Update tracking state for next evaluation tick
    this.lastPrice = quote.price;
    this.insideZoneIds = new Set(
      zones.filter(z => quote.price >= z.priceMin && quote.price <= z.priceMax).map(z => z.id)
    );
  }

  private dispatchAlert(event: AlertEvent, telegramConfig?: { botToken?: string; chatId?: string }) {
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > 50) this.eventHistory.pop();

    if (this.soundEnabled) {
      this.playChime(event.level);
    }

    this.showBrowserNotification(event.title, event.message);

    if (telegramConfig?.botToken && telegramConfig?.chatId) {
      this.sendTelegram(telegramConfig.botToken, telegramConfig.chatId, `🔔 *XAUUSD Terminal Alert*\n\n*${event.title}*\n${event.message}\n_Level: ${event.level.toUpperCase()}_`);
    }

    this.listeners.forEach(fn => fn(event));
  }

  /**
   * Synthesizes audio chime using Web Audio API oscillator (0 external audio assets required)
   */
  private playChime(level: AlertEvent['level']) {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const freq = level === 'critical' ? 880 : level === 'warning' ? 660 : 523.25;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio playback suppressed or blocked by user gesture policy
    }
  }

  private showBrowserNotification(title: string, body: string) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch {
        // Suppress notification errors
      }
    }
  }

  private async sendTelegram(token: string, chatId: string, text: string) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
    } catch (err) {
      console.warn('Telegram notification delivery error:', err);
    }
  }

  private loadPersistedRules() {
    try {
      const saved = localStorage.getItem('xauusd_terminal_alert_rules');
      if (saved) {
        this.rules = JSON.parse(saved);
      } else {
        // Sensible initial defaults
        this.rules = [
          {
            id: 'rule_default_bos',
            title: 'Break of Structure (BOS)',
            type: 'STRUCTURE_BREAK',
            targetValue: 'BOS',
            condition: 'BREAK',
            enabled: true,
            createdAt: Date.now(),
          },
          {
            id: 'rule_default_zone',
            title: 'Reaction Zone Entry',
            type: 'ZONE_ENTER',
            targetValue: 'ANY',
            condition: 'TOUCH',
            enabled: true,
            createdAt: Date.now(),
          },
        ];
      }
    } catch {
      this.rules = [];
    }
  }

  private persistRules() {
    try {
      localStorage.setItem('xauusd_terminal_alert_rules', JSON.stringify(this.rules));
    } catch {
      // Ignore localStorage error
    }
  }
}

export const alertEngine = new AlertEngine();
