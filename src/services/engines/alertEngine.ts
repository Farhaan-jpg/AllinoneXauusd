import { AlertEvent, AlertRule, EconomicEvent, LiquidityLevel, MarketQuote, MarketStructureState, NewsArticle, OrderFlowState, TradingZone } from '../../types/market';

type AlertCallback = (event: AlertEvent) => void;

export class AlertEngine {
  private rules: AlertRule[] = [];
  private eventHistory: AlertEvent[] = [];
  private listeners: Set<AlertCallback> = new Set();
  private cooldownMap: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 300000; // 5 minute cooldown per alert trigger
  private soundEnabled = true;
  private voiceEnabled = true;

  // Session baseline & transition tracking to prevent alerts on page load
  private isInitialized = false;
  private newsInitialized = false;
  private calendarInitialized = false;
  private sessionStartTime = Date.now();
  private lastPrice: number | null = null;
  private lastBosSignature: string | null = null;
  private lastChochSignature: string | null = null;
  private insideZoneIds: Set<string> = new Set();
  private sweptLevelIds: Set<string> = new Set();
  private triggeredNewsIds: Set<string> = new Set();
  private seenNewsArticleIds: Set<string> = new Set();
  private seenHeadlineSignatures: Set<string> = new Set();
  private seenReleasedEventIds: Set<string> = new Set();

  constructor() {
    this.loadPersistedRules();
    this.loadPersistedDeduplicationState();
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  /**
   * Natural voice speech synthesis using browser's native window.speechSynthesis
   */
  public speakAlert(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      // Cancel previous utterance to avoid queue buildup
      window.speechSynthesis.cancel();

      // Clean and translate trader abbreviations for smooth, natural speech
      const cleanText = text
        .replace(/BOS/g, 'Break of Structure')
        .replace(/CHOCH/g, 'Change of Character')
        .replace(/PDH/g, 'Previous Day High')
        .replace(/PDL/g, 'Previous Day Low')
        .replace(/EQH/g, 'Equal Highs')
        .replace(/EQL/g, 'Equal Lows')
        .replace(/pts/g, 'points')
        .replace(/bps/g, 'basis points')
        .replace(/m\/m/g, 'month over month')
        .replace(/y\/y/g, 'year over year')
        .replace(/\$([0-9.]+)/g, '$1 dollars')
        .replace(/[⚡🔄🚨⚠️📊📰🔔🎯📍📈]/g, '')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05; // slightly faster for urgent trading context
      utterance.pitch = 1.0;
      utterance.volume = 0.95;

      // Select an English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel')));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Voice synthesis blocked by browser permission or unsupported
    }
  }

  public testVoiceAnnouncement() {
    this.speakAlert('Gold Intelligence Terminal: Voice alert dispatcher connected. All systems operational.');
  }

  public getRules(): AlertRule[] {
    return [...this.rules];
  }

  public getHistory(): AlertEvent[] {
    return [...this.eventHistory];
  }

  public resetSession() {
    this.isInitialized = false;
    this.newsInitialized = false;
    this.calendarInitialized = false;
    this.sessionStartTime = Date.now();
    this.lastPrice = null;
    this.lastBosSignature = null;
    this.lastChochSignature = null;
    this.insideZoneIds.clear();
    this.sweptLevelIds.clear();
    this.triggeredNewsIds.clear();
    this.seenNewsArticleIds.clear();
    this.seenHeadlineSignatures.clear();
    this.seenReleasedEventIds.clear();
    this.cooldownMap.clear();
    try {
      localStorage.removeItem('xauusd_seen_news_ids');
      localStorage.removeItem('xauusd_seen_headline_sigs');
      localStorage.removeItem('xauusd_seen_calendar_events');
    } catch {
      // ignore
    }
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
    newsArticles?: NewsArticle[],
    telegramConfig?: { botToken?: string; chatId?: string; sendNewsAlerts?: boolean }
  ) {
    const now = Date.now();

    // --- BASELINE WARMUP ON INITIAL LOAD ---
    // When the user opens the terminal, record the current baseline and suppress firing
    // so the user is never spammed with historical events on page load.
    if (!this.isInitialized) {
      this.isInitialized = true;
      this.sessionStartTime = now;
      this.lastPrice = quote.price;
      this.lastBosSignature = structure.bos ? `${structure.bos.type}_${structure.bos.price}` : null;
      this.lastChochSignature = structure.choch ? `${structure.choch.type}_${structure.choch.price}` : null;
      this.insideZoneIds = new Set(
        zones.filter(z => quote.price >= z.priceMin && quote.price <= z.priceMax).map(z => z.id)
      );
      this.sweptLevelIds = new Set(
        liquidity.filter(l => l.status === 'SWEPT').map(l => l.id)
      );
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

    // 2. High-Impact Macro News Countdown & Release Alerts
    if (!this.calendarInitialized && upcomingEvents && upcomingEvents.length > 0) {
      // Warmup calendar events: record existing ones so they do not trigger upon arrival
      this.calendarInitialized = true;
      upcomingEvents
        .filter(e => e.isHighImpact && e.country === 'USD' && e.timestamp > now && (e.timestamp - now) <= 15 * 60 * 1000)
        .forEach(e => this.triggeredNewsIds.add(e.id));
      upcomingEvents
        .filter(e => e.actual)
        .forEach(e => this.seenReleasedEventIds.add(e.id));
      this.persistDeduplicationState();
    } else if (this.calendarInitialized && upcomingEvents && upcomingEvents.length > 0) {
      // 2a. Countdown Alert (Within 15 minutes of event)
      const imminentNews = upcomingEvents.find(
        e => e.isHighImpact && e.country === 'USD' && e.timestamp > now && (e.timestamp - now) <= 15 * 60 * 1000
      );

      if (imminentNews && !this.triggeredNewsIds.has(imminentNews.id)) {
        this.triggeredNewsIds.add(imminentNews.id);
        this.persistDeduplicationState();
        const shouldSendTg = telegramConfig?.sendNewsAlerts !== false;
        this.dispatchAlert({
          id: `evt_news_cd_${imminentNews.id}_${now}`,
          type: 'NEWS_HIGH_IMPACT',
          title: `⚠️ Event Risk: ${imminentNews.title}`,
          message: `${imminentNews.title} releases in ${imminentNews.countdownText}. XAUUSD spread and volatility may surge.`,
          timestamp: now,
          level: 'critical',
          read: false,
        }, shouldSendTg ? telegramConfig : undefined);
      }

      // 2b. Economic Data Release Alert (When actual number drops)
      const freshRelease = upcomingEvents.find(
        e => e.isHighImpact && e.country === 'USD' && e.actual && !this.seenReleasedEventIds.has(e.id) && Math.abs(now - e.timestamp) < 45 * 60 * 1000
      );
      if (freshRelease) {
        this.seenReleasedEventIds.add(freshRelease.id);
        this.persistDeduplicationState();
        const shouldSendTg = telegramConfig?.sendNewsAlerts !== false;
        this.dispatchAlert({
          id: `evt_news_rel_${freshRelease.id}_${now}`,
          type: 'NEWS_HIGH_IMPACT',
          title: `📊 Economic Release: ${freshRelease.title}`,
          message: `${freshRelease.title} reported: Actual ${freshRelease.actual} (Forecast: ${freshRelease.forecast || 'N/A'}, Previous: ${freshRelease.previous || 'N/A'}).`,
          timestamp: now,
          level: 'critical',
          read: false,
        }, shouldSendTg ? telegramConfig : undefined);
      }
    }

    // 4. Real-Time Breaking High-Impact News Articles (Strict Dual-Key Deduplication)
    if (newsArticles && newsArticles.length > 0) {
      if (!this.newsInitialized) {
        // Initial warmup: mark all historical articles published before this session as seen
        this.newsInitialized = true;
        for (const article of newsArticles) {
          if (article.publishedAt < this.sessionStartTime - 30000) {
            this.seenNewsArticleIds.add(article.id);
            const sig = article.headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 45);
            this.seenHeadlineSignatures.add(sig);
          }
        }
        this.persistDeduplicationState();
      }

      for (const article of newsArticles) {
        const sig = article.headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 45);

        // STRICT DEDUPLICATION: Check both article.id AND normalized headline signature
        if (this.seenNewsArticleIds.has(article.id) || this.seenHeadlineSignatures.has(sig)) {
          continue;
        }

        // Mark as seen immediately so it can NEVER trigger again across any fetch or reload
        this.seenNewsArticleIds.add(article.id);
        this.seenHeadlineSignatures.add(sig);
        this.persistDeduplicationState();

        const isHighImpact = article.relevance === 'CRITICAL' || article.relevance === 'HIGH';
        const isRecent = now - article.publishedAt < 45 * 60 * 1000;
        const isAfterSessionStart = article.publishedAt >= this.sessionStartTime - 60000;

        if (isHighImpact && isRecent && isAfterSessionStart) {
          const shouldSendTg = telegramConfig?.sendNewsAlerts !== false;
          const impactLabel = article.relevance === 'CRITICAL' ? '🚨 CRITICAL' : '⚡ HIGH IMPACT';
          this.dispatchAlert({
            id: `evt_news_art_${article.id}`,
            type: 'NEWS_HIGH_IMPACT',
            title: `${impactLabel} NEWS: ${article.headline}`,
            message: `Source: ${article.source} • Category: ${article.category} • Impact: ${article.relevance}${article.marketRelevanceComment ? `\n\nAnalysis: ${article.marketRelevanceComment}` : ''}${article.url ? `\n\nLink: ${article.url}` : ''}`,
            timestamp: now,
            level: article.relevance === 'CRITICAL' ? 'critical' : 'warning',
            read: false,
          }, shouldSendTg ? telegramConfig : undefined);
        }
      }
    }

    // 5. Liquidity Sweep Alert (Built-in)
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

    if (this.voiceEnabled) {
      this.speakAlert(`${event.title}. ${event.message}`);
    }

    this.showBrowserNotification(event.title, event.message);

    if (telegramConfig?.botToken && telegramConfig?.chatId) {
      const header = event.type === 'NEWS_HIGH_IMPACT' ? '📰 *XAUUSD High-Impact News Alert*' : '🔔 *XAUUSD Terminal Alert*';
      this.sendTelegram(telegramConfig.botToken, telegramConfig.chatId, `${header}\n\n*${event.title}*\n${event.message}\n_Priority: ${event.level.toUpperCase()}_`);
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
      // Synchronize with Cloudflare 24/7 background worker for continuous cloud monitoring
      if (typeof fetch !== 'undefined') {
        fetch('/api/alerts/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alerts: this.rules }),
        }).catch(() => {});
      }
    } catch {
      // Ignore localStorage error
    }
  }

  private loadPersistedDeduplicationState() {
    try {
      const savedNewsIds = localStorage.getItem('xauusd_seen_news_ids');
      if (savedNewsIds) {
        const arr: string[] = JSON.parse(savedNewsIds);
        arr.forEach(id => this.seenNewsArticleIds.add(id));
      }
      const savedSigs = localStorage.getItem('xauusd_seen_headline_sigs');
      if (savedSigs) {
        const arr: string[] = JSON.parse(savedSigs);
        arr.forEach(sig => this.seenHeadlineSignatures.add(sig));
      }
      const savedEvents = localStorage.getItem('xauusd_seen_calendar_events');
      if (savedEvents) {
        const arr: string[] = JSON.parse(savedEvents);
        arr.forEach(id => {
          this.triggeredNewsIds.add(id);
          this.seenReleasedEventIds.add(id);
        });
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  private persistDeduplicationState() {
    try {
      localStorage.setItem('xauusd_seen_news_ids', JSON.stringify([...this.seenNewsArticleIds].slice(-300)));
      localStorage.setItem('xauusd_seen_headline_sigs', JSON.stringify([...this.seenHeadlineSignatures].slice(-300)));
      localStorage.setItem('xauusd_seen_calendar_events', JSON.stringify([...this.seenReleasedEventIds, ...this.triggeredNewsIds].slice(-300)));
    } catch {
      // Ignore localStorage errors
    }
  }
}

export const alertEngine = new AlertEngine();
