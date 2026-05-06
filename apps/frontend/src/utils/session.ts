import { djb2Hash } from './crypto';

const SESSION_KEY = 'slotgpt_session_id';
const TIME_BUCKET_MINUTES = 10;

export class SessionManager {
  static getSessionId(): string {
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = this.generateSessionId();
      localStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  }

  static generateSessionId(): string {
    return `session_${Date.now()}_${this.getTimeBucket()}`;
  }

  static getTimeBucket(): number {
    return Math.floor(Date.now() / (TIME_BUCKET_MINUTES * 60 * 1000));
  }

  static generateSessionSeed(input: string): string {
    const sessionId = this.getSessionId();
    const timeBucket = this.getTimeBucket();
    return djb2Hash(`${input}_${sessionId}_${timeBucket}`);
  }

  static clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
  }
}
