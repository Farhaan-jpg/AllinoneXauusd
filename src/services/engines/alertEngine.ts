import { AlertEvent, AlertRule, EconomicEvent, LiquidityLevel, MarketQuote, MarketStructureState, OrderFlowState, TradingZone } from '../../types/market';

type AlertCallback = (event: AlertEvent) => void;

export class AlertEngine {
  private rules: AlertRule[] = [];
  private eventHistory: AlertEvent[] = [];
  private listeners: Set<AlertCallback> = new Set();
  private cooldownMap: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 300000; // 5 minute cooldown per alert trigger
  private soundEnabled = true;

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
   * Evaluates all active alert rules against current market state
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
          if (rule.condition === 'ABOVE' && quote.price >= target) {
            triggered = true;
            message = `Gold price crossed above $${target.toFixed(2)} (Current: $${quote.price.toFixed(2)})`;
          } else if (rule.condition === 'BELOW' && quote.price <= target) {
            triggered = true;
            message = `Gold price dropped below $${target.toFixed(2)} (Current: $${quote.price.toFixed(2)})`;
          }
        }
      } else if (rule.type === 'STRUCTURE_BREAK') {
        if (structure.bos) {
          triggered = true;
          message = `Break of Structure detected: ${structure.bos.type} at $${structure.bos.price.toFixed(2)}`;
        } else if (structure.choch) {
          triggered = true;
          message = `Change of Character detected: ${structure.choch.type} at $${structure.choch.price.toFixed(2)}`;
        }
      } else if (rule.type === 'ZONE_ENTER') {
        const activeZone = zones.find(
          z => z.status === 'ACTIVE' && quote.price >= z.priceMin && quote.price <= z.priceMax
        );
        if (activeZone) {
          triggered = true;
          message = `Price entered ${activeZone.type} ($${activeZone.priceMin} - $${activeZone.priceMax}) — Reason: ${activeZone.reason}`;
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

    if (imminentNews) {
      const newsCooldownKey = `news_${imminentNews.id}`;
      const lastTrigger = this.cooldownMap.get(newsCooldownKey) || 0;
      if (now - lastTrigger > this.COOLDOWN_MS) {
        this.cooldownMap.set(newsCooldownKey, now);
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
    }

    // 3. Liquidity Sweep Alert (Built-in)
    const sweep = liquidity.find(l => l.status === 'SWEPT' && l.distancePips < 1.0);
    if (sweep) {
      const sweepKey = `sweep_${sweep.id}`;
      const lastTrigger = this.cooldownMap.get(sweepKey) || 0;
      if (now - lastTrigger > this.COOLDOWN_MS) {
        this.cooldownMap.set(sweepKey, now);
        this.dispatchAlert({
          id: `evt_sweep_${now}`,
          type: 'STRUCTURE_BREAK',
          title: `Liquidity Sweep: ${sweep.label}`,
          message: `Price swept ${sweep.label} at $${sweep.price.toFixed(2)}. Monitor for displacement or rejection.`,
          timestamp: now,
          level: 'info',
          read: false,
        }, telegramConfig);
      }
    }
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
