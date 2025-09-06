/**
 * Centralized Error Logging System
 * 
 * Provides structured logging for errors, warnings, and debugging information
 * with configurable output destinations and formatting.
 */

import { SocialMediaError, ErrorCodes } from '../services/errors';
import type { SocialPlatform } from '../types';

/**
 * Log levels for different types of messages
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  platform?: SocialPlatform;
  errorCode?: string;
  details?: Record<string, any>;
  stack?: string;
  correlationId?: string;
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  level?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  enableStructuredLogging?: boolean;
  includeStackTrace?: boolean;
  customFormatter?: (entry: LogEntry) => string;
  filters?: Array<(entry: LogEntry) => boolean>;
}

/**
 * Log destination interface
 */
export interface LogDestination {
  write(entry: LogEntry): Promise<void>;
  close?(): Promise<void>;
}

/**
 * Console log destination
 */
export class ConsoleDestination implements LogDestination {
  constructor(private formatter?: (entry: LogEntry) => string) {}

  async write(entry: LogEntry): Promise<void> {
    const message = this.formatter ? this.formatter(entry) : this.defaultFormat(entry);
    
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }

  private defaultFormat(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.context ? `[${entry.context}]` : '',
      entry.platform ? `[${entry.platform}]` : '',
      entry.errorCode ? `[${entry.errorCode}]` : '',
      entry.message
    ].filter(Boolean);

    let message = parts.join(' ');

    if (entry.details && Object.keys(entry.details).length > 0) {
      message += '\nDetails: ' + JSON.stringify(entry.details, null, 2);
    }

    if (entry.stack && entry.level === LogLevel.ERROR) {
      message += '\nStack: ' + entry.stack;
    }

    return message;
  }
}

/**
 * File log destination (browser compatible using localStorage as fallback)
 */
export class FileDestination implements LogDestination {
  private logs: LogEntry[] = [];
  private readonly maxLogs = 1000; // Maximum logs to keep in memory

  constructor(
    private filePath: string
  ) {}

  async write(entry: LogEntry): Promise<void> {
    // In browser environment, use localStorage as fallback
    if (typeof window !== 'undefined') {
      this.writeToLocalStorage(entry);
    } else {
      // In Node.js environment, write to file
      await this.writeToFile(entry);
    }
  }

  private writeToLocalStorage(entry: LogEntry): void {
    try {
      const storageKey = `social_media_plugin_logs_${this.filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const existingLogs = localStorage.getItem(storageKey);
      const logs: LogEntry[] = existingLogs ? JSON.parse(existingLogs) : [];
      
      logs.push(entry);
      
      // Keep only the most recent logs
      if (logs.length > this.maxLogs) {
        logs.splice(0, logs.length - this.maxLogs);
      }
      
      localStorage.setItem(storageKey, JSON.stringify(logs));
    } catch (error) {
      // Fallback to console if localStorage fails
      console.error('[ErrorLogger] Failed to write to localStorage:', error);
      console.log('[ErrorLogger] Log entry:', entry);
    }
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    // This would be implemented in Node.js environment
    // For now, we'll just store in memory
    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }
  }

  async close(): Promise<void> {
    // Cleanup if needed
  }
}

/**
 * Centralized error logger
 */
export class ErrorLogger {
  private static instance: ErrorLogger | null = null;
  private destinations: LogDestination[] = [];
  private options: Required<Omit<LoggerOptions, 'customFormatter' | 'filters'>> & {
    customFormatter?: (entry: LogEntry) => string;
    filters: Array<(entry: LogEntry) => boolean>;
  };
  private correlationCounter = 0;

  private constructor(options: LoggerOptions = {}) {
    this.options = {
      level: options.level || LogLevel.INFO,
      enableConsole: options.enableConsole !== false, // Default to true
      enableFile: options.enableFile || false,
      filePath: options.filePath || 'social_media_plugin.log',
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles || 5,
      enableStructuredLogging: options.enableStructuredLogging || false,
      includeStackTrace: options.includeStackTrace !== false, // Default to true
      customFormatter: options.customFormatter !== undefined ? options.customFormatter : undefined,
      filters: options.filters || []
    };

    this.initializeDestinations();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: LoggerOptions): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger(options);
    }
    return ErrorLogger.instance;
  }

  /**
   * Initialize log destinations based on configuration
   */
  private initializeDestinations(): void {
    if (this.options.enableConsole) {
      this.destinations.push(new ConsoleDestination(this.options.customFormatter));
    }

    if (this.options.enableFile) {
      this.destinations.push(
        new FileDestination(
          this.options.filePath
        )
      );
    }
  }

  /**
   * Generate correlation ID for tracking related log entries
   */
  public generateCorrelationId(): string {
    this.correlationCounter++;
    return `${Date.now()}-${this.correlationCounter}`;
  }

  /**
   * Check if log level should be processed
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE];
    const currentIndex = levels.indexOf(this.options.level);
    const messageIndex = levels.indexOf(level);
    return messageIndex <= currentIndex;
  }

  /**
   * Apply filters to log entry
   */
  private applyFilters(entry: LogEntry): boolean {
    return this.options.filters.every(filter => filter(entry));
  }

  /**
   * Log an entry with the specified level
   */
  private async log(
    level: LogLevel,
    message: string,
    context?: string,
    details?: Record<string, any>,
    platform?: SocialPlatform,
    errorCode?: string,
    correlationId?: string
  ): Promise<void> {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context !== undefined ? context : '',
      platform,
      errorCode,
      details,
      correlationId
    };

    // Add stack trace for errors if enabled
    if (level === LogLevel.ERROR && this.options.includeStackTrace) {
      const error = new Error();
      entry.stack = error.stack !== undefined ? error.stack : undefined;
    }

    // Apply filters
    if (!this.applyFilters(entry)) {
      return;
    }

    // Write to all destinations
    await Promise.all(
      this.destinations.map(async destination => {
        try {
          await destination.write(entry);
        } catch (error) {
          // Fallback to console if destination fails
          console.error('[ErrorLogger] Destination write failed:', error);
          console.log('[ErrorLogger] Failed log entry:', entry);
        }
      })
    );
  }

  /**
   * Log error messages
   */
  public async error(
    message: string,
    context?: string,
    details?: Record<string, any>,
    platform?: SocialPlatform,
    errorCode?: string,
    correlationId?: string
  ): Promise<void> {
    await this.log(LogLevel.ERROR, message, context, details, platform, errorCode, correlationId);
  }

  /**
   * Log warning messages
   */
  public async warn(
    message: string,
    context?: string,
    details?: Record<string, any>,
    platform?: SocialPlatform,
    correlationId?: string
  ): Promise<void> {
    await this.log(LogLevel.WARN, message, context, details, platform, undefined, correlationId);
  }

  /**
   * Log info messages
   */
  public async info(
    message: string,
    context?: string,
    details?: Record<string, any>,
    platform?: SocialPlatform,
    correlationId?: string
  ): Promise<void> {
    await this.log(LogLevel.INFO, message, context, details, platform, undefined, correlationId);
  }

  /**
   * Log debug messages
   */
  public async debug(
    message: string,
    context?: string,
    details?: Record<string, any>,
    platform?: SocialPlatform,
    correlationId?: string
  ): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context, details, platform, undefined, correlationId);
  }

  /**
   * Log trace messages
   */
  public async trace(
    message: string,
    context?: string,
    details?: Record<string, any>,
    platform?: SocialPlatform,
    correlationId?: string
  ): Promise<void> {
    await this.log(LogLevel.TRACE, message, context, details, platform, undefined, correlationId);
  }

  /**
   * Log SocialMediaError with full context
   */
  public async logError(
    error: SocialMediaError | Error | unknown,
    context?: string,
    platform?: SocialPlatform,
    correlationId?: string
  ): Promise<void> {
    if (error instanceof SocialMediaError) {
      await this.error(
        error.message,
        context || error.service,
        {
          code: error.code,
          statusCode: error.statusCode,
          details: error.details,
          retryable: error.retryable,
          timestamp: error.timestamp
        },
        platform,
        error.code,
        correlationId
      );
    } else if (error instanceof Error) {
      await this.error(
        error.message,
        context,
        {
          name: error.name,
          stack: error.stack
        },
        platform,
        ErrorCodes.UNKNOWN_ERROR,
        correlationId
      );
    } else {
      await this.error(
        typeof error === 'string' ? error : 'Unknown error occurred',
        context,
        { originalError: error },
        platform,
        ErrorCodes.UNKNOWN_ERROR,
        correlationId
      );
    }
  }

  /**
   * Set log level
   */
  public setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  /**
   * Add a filter function
   */
  public addFilter(filter: (entry: LogEntry) => boolean): void {
    this.options.filters.push(filter);
  }

  /**
   * Remove all filters
   */
  public clearFilters(): void {
    this.options.filters = [];
  }

  /**
   * Close all destinations
   */
  public async close(): Promise<void> {
    await Promise.all(
      this.destinations.map(async destination => {
        if (destination.close) {
          try {
            await destination.close();
          } catch (error) {
            console.error('[ErrorLogger] Error closing destination:', error);
          }
        }
      })
    );
  }

  /**
   * Get recent log entries (from localStorage in browser)
   */
  public getRecentLogs(limit: number = 100): LogEntry[] {
    if (typeof window !== 'undefined') {
      try {
        const storageKey = `social_media_plugin_logs_${this.options.filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const existingLogs = localStorage.getItem(storageKey);
        const logs: LogEntry[] = existingLogs ? JSON.parse(existingLogs) : [];
        return logs.slice(-limit);
      } catch (error) {
        console.error('[ErrorLogger] Failed to read logs from localStorage:', error);
        return [];
      }
    }
    
    // In Node.js, return from memory (in a real implementation, this would read from file)
    const fileDestination = this.destinations.find(d => d instanceof FileDestination) as FileDestination;
    return fileDestination ? (fileDestination as any).logs.slice(-limit) : [];
  }
}

/**
 * Default logger instance
 */
export const logger = ErrorLogger.getInstance();

/**
 * Helper functions for common logging patterns
 */
export const logUtils = {
  /**
   * Log service operation start
   */
  async logServiceStart(
    service: string,
    operation: string,
    platform?: SocialPlatform,
    correlationId?: string
  ): Promise<void> {
    await logger.info(
      `Starting ${operation}`,
      service,
      { operation },
      platform,
      correlationId
    );
  },

  /**
   * Log service operation success
   */
  async logServiceSuccess(
    service: string,
    operation: string,
    duration?: number,
    platform?: SocialPlatform,
    correlationId?: string
  ): Promise<void> {
    await logger.info(
      `${operation} completed successfully`,
      service,
      { operation, duration },
      platform,
      correlationId
    );
  },

  /**
   * Log service operation failure
   */
  async logServiceError(
    service: string,
    operation: string,
    error: unknown,
    duration?: number,
    platform?: SocialPlatform,
    correlationId?: string
  ): Promise<void> {
    await logger.logError(
      error,
      service,
      platform,
      correlationId
    );
    
    await logger.error(
      `${operation} failed`,
      service,
      { operation, duration },
      platform,
      undefined,
      correlationId
    );
  },

  /**
   * Log validation error
   */
  async logValidationError(
    context: string,
    field: string,
    value: any,
    message: string,
    correlationId?: string
  ): Promise<void> {
    await logger.error(
      `Validation failed: ${message}`,
      context,
      { field, value, validationMessage: message },
      undefined,
      ErrorCodes.VALIDATION_ERROR,
      correlationId
    );
  },

  /**
   * Log rate limit exceeded
   */
  async logRateLimit(
    service: string,
    platform: SocialPlatform,
    resetTime?: number,
    correlationId?: string
  ): Promise<void> {
    await logger.warn(
      'Rate limit exceeded',
      service,
      { resetTime, resetDate: resetTime ? new Date(resetTime * 1000).toISOString() : undefined },
      platform,
      correlationId
    );
  }
};