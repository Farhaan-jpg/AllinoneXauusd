import { SessionInfo } from '../../types/market';

export class SessionEngine {
  /**
   * Tracks financial sessions and London/NY overlap relative to UTC and user timezone
   */
  public static getSessionInfo(timezone: string = 'Asia/Kolkata'): SessionInfo {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const currentMinutesOfDay = utcHours * 60 + utcMinutes;

    // Session times in UTC (minutes of day)
    // Asian: 00:00 - 09:00 UTC (0 - 540)
    const isAsian = currentMinutesOfDay >= 0 && currentMinutesOfDay < 540;

    // London: 07:00 - 16:00 UTC (420 - 960)
    const isLondon = currentMinutesOfDay >= 420 && currentMinutesOfDay < 960;

    // New York: 12:00 - 21:00 UTC (720 - 1260)
    const isNewYork = currentMinutesOfDay >= 720 && currentMinutesOfDay < 1260;

    // London / NY Overlap: 12:00 - 16:00 UTC (720 - 960)
    const isLondonNYOverlap = isLondon && isNewYork;

    let currentSession = 'Inter-session / Low Volume';
    let minutesLeft = 0;

    if (isLondonNYOverlap) {
      currentSession = 'London / New York Overlap (Peak Liquidity)';
      minutesLeft = 960 - currentMinutesOfDay;
    } else if (isNewYork) {
      currentSession = 'New York Session';
      minutesLeft = 1260 - currentMinutesOfDay;
    } else if (isLondon) {
      currentSession = 'London Session';
      minutesLeft = 960 - currentMinutesOfDay;
    } else if (isAsian) {
      currentSession = 'Asian (Tokyo / Sydney) Session';
      minutesLeft = 540 - currentMinutesOfDay;
    } else {
      // Asian opens at 00:00 UTC
      minutesLeft = 1440 - currentMinutesOfDay;
    }

    const hours = Math.floor(minutesLeft / 60);
    const mins = minutesLeft % 60;
    const sessionTimeLeftFormatted = `${hours}h ${mins.toString().padStart(2, '0')}m remaining`;

    return {
      currentSession,
      isAsian,
      isLondon,
      isNewYork,
      isLondonNYOverlap,
      sessionTimeLeftFormatted,
      timezone,
    };
  }

  public static formatTimeInTz(date: Date | number, timezone: string = 'Asia/Kolkata'): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(d);
    } catch {
      return d.toTimeString().slice(0, 8);
    }
  }

  public static formatDateInTz(date: Date | number, timezone: string = 'Asia/Kolkata'): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return d.toISOString().split('T')[0];
    }
  }
}
