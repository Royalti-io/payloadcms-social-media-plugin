/**
 * Base service class providing common functionality for social media API services
 */

import type { ConnectionTestResult } from '../types';

export interface ServiceCredentials {
  [key: string]: string | undefined;
}

// ConnectionTestResult is now imported from ../types for consistency

export interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | FormData;
  timeout?: number;
  retries?: number;
}

export interface ServiceError {
  code: string;
  message: string;
  statusCode?: number;
  details?: Record<string, any>;
  retryable?: boolean;
}

export abstract class BaseService {
  protected credentials: ServiceCredentials;
  protected rateLimitInfo: RateLimitInfo | null = null;
  protected logger: Console;

  constructor(credentials: ServiceCredentials, logger: Console = console) {
    this.credentials = credentials;
    this.logger = logger;
  }

  /**
   * Test connection to the service API
   */
  abstract testConnection(): Promise<ConnectionTestResult>;

  /**
   * Make HTTP request with retry logic and error handling
   */
  protected async makeRequest(
    url: string,
    options: RequestOptions = {}
  ): Promise<Response> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 30000,
      retries = 3
    } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let lastError: ServiceError | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.logger.log(`[${this.constructor.name}] Making ${method} request to ${url} (attempt ${attempt + 1}/${retries + 1})`);

        const requestInit: RequestInit = {
          method,
          headers: {
            'User-Agent': 'PayloadCMS-SocialMedia-Plugin/1.0.0',
            ...headers
          },
          signal: controller.signal
        };
        
        if (body !== undefined) {
          requestInit.body = body;
        }
        
        const response = await fetch(url, requestInit);

        clearTimeout(timeoutId);

        // Update rate limit info if present in headers
        this.updateRateLimitInfo(response);

        // Log response details
        this.logger.log(`[${this.constructor.name}] Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const error = await this.handleErrorResponse(response);
          
          // If it's a rate limit error, wait and retry
          if (error.code === 'RATE_LIMIT_EXCEEDED' && attempt < retries) {
            const waitTime = this.calculateRetryDelay(attempt, error);
            this.logger.warn(`[${this.constructor.name}] Rate limited, waiting ${waitTime}ms before retry`);
            await this.delay(waitTime);
            continue;
          }

          // If it's a retryable error and we have attempts left
          if (error.retryable && attempt < retries) {
            const waitTime = this.calculateRetryDelay(attempt, error);
            this.logger.warn(`[${this.constructor.name}] Retryable error, waiting ${waitTime}ms before retry: ${error.message}`);
            await this.delay(waitTime);
            continue;
          }

          throw error;
        }

        return response;
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = {
            code: 'REQUEST_TIMEOUT',
            message: `Request timed out after ${timeout}ms`,
            retryable: true
          };
        } else if (error instanceof TypeError && error.message.includes('network')) {
          lastError = {
            code: 'NETWORK_ERROR',
            message: 'Network connection failed',
            retryable: true
          };
        } else if (error && typeof error === 'object' && 'code' in error) {
          // Already a ServiceError
          lastError = error as ServiceError;
        } else {
          lastError = {
            code: 'UNKNOWN_ERROR',
            message: (error instanceof Error ? error.message : 'Unknown error occurred'),
            retryable: false
          };
        }

        this.logger.error(`[${this.constructor.name}] Request error on attempt ${attempt + 1}: ${lastError.message}`);

        // If not retryable or last attempt, throw immediately
        if (!lastError.retryable || attempt >= retries) {
          break;
        }

        // Wait before retry with exponential backoff
        const waitTime = this.calculateRetryDelay(attempt, lastError);
        await this.delay(waitTime);
      }
    }

    throw lastError!;
  }

  /**
   * Handle error responses and create appropriate ServiceError
   */
  protected async handleErrorResponse(response: Response): Promise<ServiceError> {
    let errorBody: any;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { message: response.statusText || 'Unknown error' };
    }

    const baseError: ServiceError = {
      code: this.getErrorCode(response.status),
      message: errorBody.message || errorBody.error || response.statusText || 'API request failed',
      statusCode: response.status,
      details: errorBody,
      retryable: this.isRetryableError(response.status)
    };

    return this.customizeError(baseError, response, errorBody);
  }

  /**
   * Customize error based on service-specific logic
   * Override in subclasses for service-specific error handling
   */
  protected customizeError(error: ServiceError, _response: Response, _errorBody: any): ServiceError {
    return error;
  }

  /**
   * Get error code based on HTTP status
   */
  protected getErrorCode(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 408: return 'REQUEST_TIMEOUT';
      case 429: return 'RATE_LIMIT_EXCEEDED';
      case 500: return 'INTERNAL_SERVER_ERROR';
      case 502: return 'BAD_GATEWAY';
      case 503: return 'SERVICE_UNAVAILABLE';
      case 504: return 'GATEWAY_TIMEOUT';
      default: return status >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR';
    }
  }

  /**
   * Check if error is retryable based on status code
   */
  protected isRetryableError(status: number): boolean {
    return [408, 429, 500, 502, 503, 504].includes(status);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  protected calculateRetryDelay(attempt: number, error?: ServiceError): number {
    // Base delay of 1 second, doubled for each attempt
    let delay = Math.pow(2, attempt) * 1000;

    // Add jitter to prevent thundering herd
    delay += Math.random() * 1000;

    // For rate limits, use the reset time if available
    if (error?.code === 'RATE_LIMIT_EXCEEDED' && this.rateLimitInfo?.reset) {
      const resetTime = this.rateLimitInfo.reset * 1000; // Convert to milliseconds
      const now = Date.now();
      const waitUntilReset = Math.max(0, resetTime - now);
      
      // Use the longer of the two delays
      delay = Math.max(delay, waitUntilReset);
    }

    // Cap at 30 seconds
    return Math.min(delay, 30000);
  }

  /**
   * Update rate limit information from response headers
   */
  protected updateRateLimitInfo(response: Response): void {
    const remaining = response.headers.get('x-rate-limit-remaining');
    const reset = response.headers.get('x-rate-limit-reset');
    const limit = response.headers.get('x-rate-limit-limit');

    if (remaining !== null && reset !== null && limit !== null) {
      this.rateLimitInfo = {
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
        limit: parseInt(limit, 10)
      };

      this.logger.log(`[${this.constructor.name}] Rate limit: ${remaining}/${limit} remaining, resets at ${new Date(parseInt(reset, 10) * 1000).toISOString()}`);
    }
  }

  /**
   * Get current rate limit information
   */
  public getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  /**
   * Delay execution for specified milliseconds
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate required credentials
   */
  protected validateCredentials(requiredFields: string[]): void {
    const missing = requiredFields.filter(field => !this.credentials[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required credentials: ${missing.join(', ')}`);
    }
  }

  /**
   * Sanitize sensitive data for logging
   */
  protected sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'bearer', 'api_key'];
    const sanitized = { ...data };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}