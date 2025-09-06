/**
 * Comprehensive error types for social media API services
 */

export interface ServiceError {
  code: string;
  message: string;
  statusCode: number | undefined;
  details: Record<string, any> | undefined;
  retryable: boolean | undefined;
  timestamp: string | undefined;
  service: string | undefined;
}

export class SocialMediaError extends Error implements ServiceError {
  public readonly code: string;
  public readonly statusCode: number | undefined;
  public readonly details: Record<string, any> | undefined;
  public readonly retryable: boolean;
  public readonly timestamp: string;
  public readonly service: string | undefined;

  constructor(
    code: string,
    message: string,
    options: {
      statusCode?: number;
      details?: Record<string, any>;
      retryable?: boolean;
      service?: string;
      cause?: Error;
    } = {}
  ) {
    super(message);
    
    this.name = 'SocialMediaError';
    this.code = code;
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
    this.timestamp = new Date().toISOString();
    this.service = options.service;

    if (options.cause) {
      this.cause = options.cause;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SocialMediaError);
    }
  }

  /**
   * Convert to JSON for logging/serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      retryable: this.retryable,
      timestamp: this.timestamp,
      service: this.service,
      stack: this.stack
    };
  }

  /**
   * Check if this error matches a specific code
   */
  is(code: string): boolean {
    return this.code === code;
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return this.retryable;
  }
}

/**
 * Pre-defined error codes for common scenarios
 */
export const ErrorCodes = {
  // Authentication errors
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Request errors
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  MISSING_PARAMETERS: 'MISSING_PARAMETERS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Content errors
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  INVALID_CONTENT: 'INVALID_CONTENT',
  DUPLICATE_CONTENT: 'DUPLICATE_CONTENT',
  CONTENT_NOT_ALLOWED: 'CONTENT_NOT_ALLOWED',

  // Media errors
  MEDIA_UPLOAD_FAILED: 'MEDIA_UPLOAD_FAILED',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',
  MEDIA_FORMAT_UNSUPPORTED: 'MEDIA_FORMAT_UNSUPPORTED',
  MEDIA_PROCESSING_FAILED: 'MEDIA_PROCESSING_FAILED',
  MEDIA_PROCESSING_TIMEOUT: 'MEDIA_PROCESSING_TIMEOUT',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  DNS_ERROR: 'DNS_ERROR',

  // Server errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  BAD_GATEWAY: 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',

  // API specific
  API_VERSION_UNSUPPORTED: 'API_VERSION_UNSUPPORTED',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',

  // Template errors
  TEMPLATE_PROCESSING_ERROR: 'TEMPLATE_PROCESSING_ERROR',
  TEMPLATE_SYNTAX_ERROR: 'TEMPLATE_SYNTAX_ERROR',
  TEMPLATE_VARIABLE_ERROR: 'TEMPLATE_VARIABLE_ERROR',
  TEMPLATE_TRUNCATION_ERROR: 'TEMPLATE_TRUNCATION_ERROR',

  // Queue errors
  QUEUE_FULL: 'QUEUE_FULL',
  JOB_VALIDATION_ERROR: 'JOB_VALIDATION_ERROR',
  JOB_PROCESSING_ERROR: 'JOB_PROCESSING_ERROR',
  JOB_TIMEOUT: 'JOB_TIMEOUT',
  QUEUE_SHUTDOWN: 'QUEUE_SHUTDOWN',

  // Credential errors
  CREDENTIAL_VALIDATION_ERROR: 'CREDENTIAL_VALIDATION_ERROR',
  CREDENTIAL_ENCRYPTION_ERROR: 'CREDENTIAL_ENCRYPTION_ERROR',
  CREDENTIAL_DECRYPTION_ERROR: 'CREDENTIAL_DECRYPTION_ERROR',
  EXPIRED_CREDENTIALS: 'EXPIRED_CREDENTIALS',

  // Plugin configuration errors
  PLUGIN_CONFIGURATION_ERROR: 'PLUGIN_CONFIGURATION_ERROR',
  PLUGIN_INITIALIZATION_ERROR: 'PLUGIN_INITIALIZATION_ERROR',
  PLUGIN_DEPENDENCY_ERROR: 'PLUGIN_DEPENDENCY_ERROR',
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM',

  // PayloadCMS integration errors
  PAYLOADCMS_HOOK_ERROR: 'PAYLOADCMS_HOOK_ERROR',
  PAYLOADCMS_FIELD_ERROR: 'PAYLOADCMS_FIELD_ERROR',
  PAYLOADCMS_COLLECTION_ERROR: 'PAYLOADCMS_COLLECTION_ERROR',
  PAYLOADCMS_ADMIN_ERROR: 'PAYLOADCMS_ADMIN_ERROR',

  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  SERVICE_INTEGRATION_ERROR: 'SERVICE_INTEGRATION_ERROR',
  WEBHOOK_ERROR: 'WEBHOOK_ERROR',
  WEBHOOK_VALIDATION_ERROR: 'WEBHOOK_VALIDATION_ERROR',

  // Security errors
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  MALICIOUS_INPUT: 'MALICIOUS_INPUT',
  CSRF_ERROR: 'CSRF_ERROR',

  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  OPERATION_FAILED: 'OPERATION_FAILED'
} as const;

/**
 * Error factory functions for common error scenarios
 */
export class ErrorFactory {
  /**
   * Create an authentication error
   */
  static authentication(message: string, details?: Record<string, any>): SocialMediaError {
    return new SocialMediaError(ErrorCodes.AUTHENTICATION_FAILED, message, 
      details !== undefined ? { details, retryable: false } : { retryable: false }
    );
  }

  /**
   * Create a rate limit error
   */
  static rateLimit(message: string, resetTime?: number, service?: string): SocialMediaError {
    const options: {
      details: { resetTime?: number };
      retryable: boolean;
      statusCode: number;
      service?: string;
    } = {
      details: resetTime !== undefined ? { resetTime } : {},
      retryable: true,
      statusCode: 429
    };
    if (service !== undefined) {
      options.service = service;
    }
    return new SocialMediaError(ErrorCodes.RATE_LIMIT_EXCEEDED, message, options);
  }

  /**
   * Create a network error
   */
  static network(message: string, cause?: Error): SocialMediaError {
    const options: { retryable: boolean; cause?: Error } = { retryable: true };
    if (cause !== undefined) {
      options.cause = cause;
    }
    return new SocialMediaError(ErrorCodes.NETWORK_ERROR, message, options);
  }

  /**
   * Create a validation error
   */
  static validation(message: string, field?: string): SocialMediaError {
    return new SocialMediaError(ErrorCodes.VALIDATION_ERROR, message, {
      details: { field },
      retryable: false,
      statusCode: 400
    });
  }

  /**
   * Create a media upload error
   */
  static mediaUpload(message: string, mediaType?: string): SocialMediaError {
    return new SocialMediaError(ErrorCodes.MEDIA_UPLOAD_FAILED, message, {
      details: { mediaType },
      retryable: true
    });
  }

  /**
   * Create a server error
   */
  static server(message: string, statusCode: number = 500): SocialMediaError {
    return new SocialMediaError(ErrorCodes.SERVER_ERROR, message, {
      statusCode,
      retryable: statusCode >= 500
    });
  }

  /**
   * Create an error from HTTP response
   */
  static fromResponse(
    statusCode: number,
    message: string,
    details?: Record<string, any>,
    service?: string
  ): SocialMediaError {
    let code: string;
    let retryable = false;

    switch (statusCode) {
      case 400:
        code = ErrorCodes.BAD_REQUEST;
        break;
      case 401:
        code = ErrorCodes.UNAUTHORIZED;
        break;
      case 403:
        code = ErrorCodes.FORBIDDEN;
        break;
      case 404:
        code = ErrorCodes.ENDPOINT_NOT_FOUND;
        break;
      case 408:
        code = ErrorCodes.REQUEST_TIMEOUT;
        retryable = true;
        break;
      case 429:
        code = ErrorCodes.RATE_LIMIT_EXCEEDED;
        retryable = true;
        break;
      case 500:
        code = ErrorCodes.INTERNAL_SERVER_ERROR;
        retryable = true;
        break;
      case 502:
        code = ErrorCodes.BAD_GATEWAY;
        retryable = true;
        break;
      case 503:
        code = ErrorCodes.SERVICE_UNAVAILABLE;
        retryable = true;
        break;
      case 504:
        code = ErrorCodes.GATEWAY_TIMEOUT;
        retryable = true;
        break;
      default:
        code = statusCode >= 500 ? ErrorCodes.SERVER_ERROR : ErrorCodes.UNKNOWN_ERROR;
        retryable = statusCode >= 500;
    }

    const options: {
      statusCode: number;
      retryable: boolean;
      details?: Record<string, any>;
      service?: string;
    } = {
      statusCode,
      retryable
    };
    if (details !== undefined) {
      options.details = details;
    }
    if (service !== undefined) {
      options.service = service;
    }

    return new SocialMediaError(code, message, options);
  }

  /**
   * Create a template processing error
   */
  static templateError(
    message: string,
    templateName?: string,
    variableName?: string
  ): SocialMediaError {
    return new SocialMediaError(ErrorCodes.TEMPLATE_PROCESSING_ERROR, message, {
      details: { templateName, variableName },
      retryable: false
    });
  }

  /**
   * Create a queue operation error
   */
  static queueError(
    message: string,
    jobId?: string,
    queueSize?: number
  ): SocialMediaError {
    return new SocialMediaError(ErrorCodes.JOB_PROCESSING_ERROR, message, {
      details: { jobId, queueSize },
      retryable: true
    });
  }

  /**
   * Create a credential error
   */
  static credentialError(
    message: string,
    platform?: string,
    field?: string
  ): SocialMediaError {
    return new SocialMediaError(ErrorCodes.CREDENTIAL_VALIDATION_ERROR, message, {
      details: { platform, field },
      retryable: false
    });
  }

  /**
   * Create a plugin configuration error
   */
  static configurationError(
    message: string,
    configField?: string,
    configValue?: any
  ): SocialMediaError {
    return new SocialMediaError(ErrorCodes.PLUGIN_CONFIGURATION_ERROR, message, {
      details: { configField, configValue },
      retryable: false
    });
  }

  /**
   * Create a PayloadCMS integration error
   */
  static payloadError(
    message: string,
    component?: string,
    operation?: string
  ): SocialMediaError {
    return new SocialMediaError(ErrorCodes.PAYLOADCMS_HOOK_ERROR, message, {
      details: { component, operation },
      retryable: false
    });
  }

  /**
   * Create a security violation error
   */
  static securityError(
    message: string,
    violationType?: string,
    userInfo?: Record<string, any>
  ): SocialMediaError {
    return new SocialMediaError(ErrorCodes.SECURITY_VIOLATION, message, {
      details: { violationType, userInfo },
      retryable: false
    });
  }

  /**
   * Create a timeout error
   */
  static timeoutError(
    message: string,
    timeoutMs?: number,
    operation?: string
  ): SocialMediaError {
    return new SocialMediaError(ErrorCodes.JOB_TIMEOUT, message, {
      details: { timeoutMs, operation },
      retryable: true
    });
  }
}

/**
 * Error handler utility for consistent error processing
 */
export class ErrorHandler {
  /**
   * Handle and log errors consistently
   */
  static handle(error: unknown, logger: Console, context: string = ''): SocialMediaError {
    let socialMediaError: SocialMediaError;

    if (error instanceof SocialMediaError) {
      socialMediaError = error;
    } else if (error instanceof Error) {
      socialMediaError = new SocialMediaError(ErrorCodes.UNKNOWN_ERROR, error.message, {
        cause: error,
        retryable: false
      });
    } else {
      socialMediaError = new SocialMediaError(
        ErrorCodes.UNKNOWN_ERROR,
        typeof error === 'string' ? error : 'An unknown error occurred',
        {
          details: { originalError: error },
          retryable: false
        }
      );
    }

    // Log the error
    const logContext = context ? `[${context}] ` : '';
    if (socialMediaError.isRetryable()) {
      logger.warn(`${logContext}Retryable error: ${socialMediaError.message}`, {
        error: socialMediaError.toJSON()
      });
    } else {
      logger.error(`${logContext}Fatal error: ${socialMediaError.message}`, {
        error: socialMediaError.toJSON()
      });
    }

    return socialMediaError;
  }

  /**
   * Check if an error should be retried
   */
  static shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) {
      return false;
    }

    if (error instanceof SocialMediaError) {
      return error.isRetryable();
    }

    // For unknown errors, only retry network-related issues
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') || 
             message.includes('timeout') || 
             message.includes('connection') ||
             message.includes('fetch');
    }

    return false;
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: SocialMediaError): string {
    switch (error.code) {
      case ErrorCodes.AUTHENTICATION_FAILED:
      case ErrorCodes.INVALID_TOKEN:
      case ErrorCodes.UNAUTHORIZED:
        return 'Authentication failed. Please check your API credentials.';
      
      case ErrorCodes.RATE_LIMIT_EXCEEDED:
        return 'Rate limit exceeded. Please wait before trying again.';
      
      case ErrorCodes.CONTENT_TOO_LONG:
        return 'Content exceeds the maximum allowed length.';
      
      case ErrorCodes.DUPLICATE_CONTENT:
        return 'This content has already been posted.';
      
      case ErrorCodes.MEDIA_UPLOAD_FAILED:
        return 'Failed to upload media. Please try again.';
      
      case ErrorCodes.MEDIA_TOO_LARGE:
        return 'Media file is too large. Please use a smaller file.';
      
      case ErrorCodes.NETWORK_ERROR:
      case ErrorCodes.CONNECTION_FAILED:
        return 'Network connection failed. Please check your internet connection.';
      
      case ErrorCodes.SERVICE_UNAVAILABLE:
        return 'The service is temporarily unavailable. Please try again later.';
      
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }
}