/**
 * Trace Logger
 * 
 * Structured logging with trace context for debugging system behavior,
 * tracking execution flow, and reconstructing system state.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: TraceContext;
  data?: unknown;
  stack?: string;
}

export interface SpanOptions {
  operation: string;
  metadata?: Record<string, unknown>;
  parentContext?: TraceContext;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '#888888',
  info: '#3498db',
  warn: '#f39c12',
  error: '#e74c3c',
  critical: '#8e44ad',
};

class TraceLogger {
  private minLevel: LogLevel = 'debug';
  private entries: LogEntry[] = [];
  private maxEntries = 1000;
  private activeSpans: Map<string, TraceContext> = new Map();
  private outputToConsole = true;
  private prefix = '[AGROS]';

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Enable/disable console output
   */
  setConsoleOutput(enabled: boolean): void {
    this.outputToConsole = enabled;
  }

  /**
   * Generate a unique trace ID
   */
  private generateId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Start a new trace span
   */
  startSpan(options: SpanOptions): TraceContext {
    const traceId = options.parentContext?.traceId || this.generateId();
    const spanId = this.generateId();

    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId: options.parentContext?.spanId,
      operation: options.operation,
      startTime: performance.now(),
      metadata: options.metadata,
    };

    this.activeSpans.set(spanId, context);
    this.log('debug', `Span started: ${options.operation}`, context);

    return context;
  }

  /**
   * End a trace span
   */
  endSpan(context: TraceContext, status: 'ok' | 'error' = 'ok'): number {
    const duration = performance.now() - context.startTime;
    this.activeSpans.delete(context.spanId);
    
    this.log('debug', `Span ended: ${context.operation} (${duration.toFixed(2)}ms, ${status})`, context, {
      duration,
      status,
    });

    return duration;
  }

  /**
   * Execute a function within a span
   */
  withSpan<T>(options: SpanOptions, fn: (ctx: TraceContext) => T): T {
    const ctx = this.startSpan(options);
    try {
      const result = fn(ctx);
      this.endSpan(ctx, 'ok');
      return result;
    } catch (e) {
      this.endSpan(ctx, 'error');
      throw e;
    }
  }

  /**
   * Execute an async function within a span
   */
  async withSpanAsync<T>(options: SpanOptions, fn: (ctx: TraceContext) => Promise<T>): Promise<T> {
    const ctx = this.startSpan(options);
    try {
      const result = await fn(ctx);
      this.endSpan(ctx, 'ok');
      return result;
    } catch (e) {
      this.endSpan(ctx, 'error');
      throw e;
    }
  }

  /**
   * Log a message
   */
  private log(
    level: LogLevel,
    message: string,
    context?: TraceContext,
    data?: unknown
  ): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      data,
    };

    if (level === 'error' || level === 'critical') {
      entry.stack = new Error().stack;
    }

    this.entries.push(entry);

    // Prune old entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Console output
    if (this.outputToConsole) {
      this.writeToConsole(entry);
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString().slice(11, 23);
    const span = entry.context ? `[${entry.context.operation}]` : '';
    const prefix = `${this.prefix} ${timestamp} ${span}`;
    const color = LOG_COLORS[entry.level];

    const consoleMethod = entry.level === 'error' || entry.level === 'critical'
      ? console.error
      : entry.level === 'warn'
        ? console.warn
        : console.log;

    if (entry.data) {
      consoleMethod(
        `%c${prefix} ${entry.message}`,
        `color: ${color}`,
        entry.data
      );
    } else {
      consoleMethod(
        `%c${prefix} ${entry.message}`,
        `color: ${color}`
      );
    }
  }

  // Convenience methods
  debug(message: string, data?: unknown, context?: TraceContext): void {
    this.log('debug', message, context, data);
  }

  info(message: string, data?: unknown, context?: TraceContext): void {
    this.log('info', message, context, data);
  }

  warn(message: string, data?: unknown, context?: TraceContext): void {
    this.log('warn', message, context, data);
  }

  error(message: string, error?: Error | unknown, context?: TraceContext): void {
    const data = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    this.log('error', message, context, data);
  }

  critical(message: string, error?: Error | unknown, context?: TraceContext): void {
    const data = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    this.log('critical', message, context, data);
  }

  /**
   * Get all log entries
   */
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries by level
   */
  getByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter(e => e.level === level);
  }

  /**
   * Get entries by trace ID
   */
  getByTraceId(traceId: string): LogEntry[] {
    return this.entries.filter(e => e.context?.traceId === traceId);
  }

  /**
   * Get entries since timestamp
   */
  getSince(timestamp: number): LogEntry[] {
    return this.entries.filter(e => e.timestamp >= timestamp);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Export entries as JSON
   */
  export(): string {
    return JSON.stringify({
      exportedAt: Date.now(),
      entries: this.entries,
      activeSpans: Array.from(this.activeSpans.values()),
    }, null, 2);
  }

  /**
   * Get formatted log output
   */
  format(limit = 50): string {
    const recent = this.entries.slice(-limit);
    return recent.map(e => {
      const time = new Date(e.timestamp).toISOString().slice(11, 23);
      const span = e.context ? `[${e.context.operation}]` : '';
      const data = e.data ? ` ${JSON.stringify(e.data)}` : '';
      return `${time} [${e.level.toUpperCase()}] ${span} ${e.message}${data}`;
    }).join('\n');
  }
}

export const trace = new TraceLogger();

// Helper for creating scoped loggers
export function createScopedLogger(scope: string) {
  return {
    debug: (msg: string, data?: unknown) => trace.debug(`[${scope}] ${msg}`, data),
    info: (msg: string, data?: unknown) => trace.info(`[${scope}] ${msg}`, data),
    warn: (msg: string, data?: unknown) => trace.warn(`[${scope}] ${msg}`, data),
    error: (msg: string, err?: unknown) => trace.error(`[${scope}] ${msg}`, err),
    critical: (msg: string, err?: unknown) => trace.critical(`[${scope}] ${msg}`, err),
    withSpan: <T>(op: string, fn: (ctx: TraceContext) => T) => 
      trace.withSpan({ operation: `${scope}:${op}` }, fn),
    withSpanAsync: <T>(op: string, fn: (ctx: TraceContext) => Promise<T>) => 
      trace.withSpanAsync({ operation: `${scope}:${op}` }, fn),
  };
}
