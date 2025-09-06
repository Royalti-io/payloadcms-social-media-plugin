/**
 * Unit tests for BaseService class
 */

import { BaseService, ServiceCredentials, ConnectionTestResult } from '../../../src/services/base';
import { setupFetchMock, TestUtils } from '../../setup';
import { sampleErrors, sampleRateLimits } from '../../mocks/fixtures';

// Create a concrete implementation of BaseService for testing
class TestService extends BaseService {
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await this.makeRequest('https://api.example.com/test', {
        method: 'GET',
        timeout: 5000,
        retries: 1
      });

      const data = await response.json();
      
      return {
        success: true,
        details: { user: data }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

describe('BaseService', () => {
  let service: TestService;
  let mockFetch: jest.Mock;

  const testCredentials: ServiceCredentials = {
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret'
  };

  beforeEach(() => {
    service = new TestService(testCredentials);
    mockFetch = setupFetchMock([]);
  });

  describe('Constructor', () => {
    it('should initialize with credentials and logger', () => {
      expect(service).toBeInstanceOf(BaseService);
      expect(service['credentials']).toEqual(testCredentials);
      expect(service['logger']).toBe(console);
    });

    it('should accept custom logger', () => {
      const customLogger = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      } as any;

      const serviceWithLogger = new TestService(testCredentials, customLogger);
      expect(serviceWithLogger['logger']).toBe(customLogger);
    });
  });

  describe('makeRequest', () => {
    it('should make successful HTTP request', async () => {
      const mockResponse = { success: true, data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: () => Promise.resolve(mockResponse)
      });

      const response = await service['makeRequest']('https://api.example.com/test');
      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': 'PayloadCMS-SocialMedia-Plugin/1.0.0'
          })
        })
      );
      expect(data).toEqual(mockResponse);
    });

    it('should handle POST requests with body', async () => {
      const requestBody = JSON.stringify({ message: 'test' });
      const mockResponse = { success: true };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Map(),
        json: () => Promise.resolve(mockResponse)
      });

      await service['makeRequest']('https://api.example.com/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/post',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'PayloadCMS-SocialMedia-Plugin/1.0.0'
          }),
          body: requestBody
        })
      );
    });

    it('should handle timeout', async () => {
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      await expect(service['makeRequest']('https://api.example.com/slow', {
        timeout: 100
      })).rejects.toThrow('REQUEST_TIMEOUT');
    });

    it('should retry on retryable errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map(),
          json: () => Promise.resolve({ success: true })
        });

      const response = await service['makeRequest']('https://api.example.com/retry', {
        retries: 2
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(response.ok).toBe(true);
    });

    it('should not retry on non-retryable errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
        json: () => Promise.resolve({ error: 'Invalid request' })
      });

      await expect(service['makeRequest']('https://api.example.com/bad-request', {
        retries: 2
      })).rejects.toThrow('BAD_REQUEST');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle rate limiting with retry', async () => {
      const rateLimitHeaders = new Map([
        ['x-rate-limit-remaining', '0'],
        ['x-rate-limit-reset', String(Math.floor(Date.now() / 1000) + 1)],
        ['x-rate-limit-limit', '100']
      ]);

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: rateLimitHeaders,
          json: () => Promise.resolve({ error: 'Rate limit exceeded' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map(),
          json: () => Promise.resolve({ success: true })
        });

      const response = await service['makeRequest']('https://api.example.com/rate-limit', {
        retries: 1
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.ok).toBe(true);
    });

    it('should update rate limit info from headers', async () => {
      const rateLimitHeaders = new Map([
        ['x-rate-limit-remaining', '50'],
        ['x-rate-limit-reset', String(Math.floor(Date.now() / 1000) + 900)],
        ['x-rate-limit-limit', '100']
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: rateLimitHeaders,
        json: () => Promise.resolve({ success: true })
      });

      await service['makeRequest']('https://api.example.com/with-rate-limit');

      const rateLimitInfo = service.getRateLimitInfo();
      expect(rateLimitInfo).toEqual({
        remaining: 50,
        reset: expect.any(Number),
        limit: 100
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP error responses', async () => {
      const errorResponse = { error: 'Unauthorized', message: 'Invalid credentials' };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map(),
        json: () => Promise.resolve(errorResponse)
      });

      await expect(service['makeRequest']('https://api.example.com/unauthorized'))
        .rejects.toMatchObject({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
          statusCode: 401,
          retryable: false
        });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(service['makeRequest']('https://api.example.com/network-error'))
        .rejects.toMatchObject({
          code: 'UNKNOWN_ERROR',
          message: 'Network connection failed',
          retryable: false
        });
    });

    it('should identify retryable errors correctly', async () => {
      const retryableStatuses = [408, 429, 500, 502, 503, 504];
      
      for (const status of retryableStatuses) {
        expect(service['isRetryableError'](status)).toBe(true);
      }

      const nonRetryableStatuses = [400, 401, 403, 404];
      
      for (const status of nonRetryableStatuses) {
        expect(service['isRetryableError'](status)).toBe(false);
      }
    });

    it('should get correct error codes for status', () => {
      const statusCodeMap = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        408: 'REQUEST_TIMEOUT',
        429: 'RATE_LIMIT_EXCEEDED',
        500: 'INTERNAL_SERVER_ERROR',
        502: 'BAD_GATEWAY',
        503: 'SERVICE_UNAVAILABLE',
        504: 'GATEWAY_TIMEOUT'
      };

      Object.entries(statusCodeMap).forEach(([status, expectedCode]) => {
        expect(service['getErrorCode'](parseInt(status))).toBe(expectedCode);
      });

      expect(service['getErrorCode'](418)).toBe('CLIENT_ERROR');
      expect(service['getErrorCode'](599)).toBe('SERVER_ERROR');
    });
  });

  describe('Rate Limiting', () => {
    it('should calculate retry delay with exponential backoff', () => {
      const delay1 = service['calculateRetryDelay'](0);
      const delay2 = service['calculateRetryDelay'](1);
      const delay3 = service['calculateRetryDelay'](2);

      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
      expect(delay3).toBeLessThanOrEqual(30000); // Should cap at 30 seconds
    });

    it('should use rate limit reset time for delay calculation', () => {
      const resetTime = Math.floor(Date.now() / 1000) + 10;
      service['rateLimitInfo'] = {
        remaining: 0,
        reset: resetTime,
        limit: 100
      };

      const error = { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limited' };
      const delay = service['calculateRetryDelay'](0, error);

      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(30000);
    });
  });

  describe('Credential Validation', () => {
    it('should validate required credentials', () => {
      expect(() => {
        service['validateCredentials'](['apiKey', 'apiSecret']);
      }).not.toThrow();
    });

    it('should throw error for missing required credentials', () => {
      expect(() => {
        service['validateCredentials'](['apiKey', 'apiSecret', 'missingField']);
      }).toThrow('Missing required credentials: missingField');
    });

    it('should throw error for multiple missing credentials', () => {
      expect(() => {
        service['validateCredentials'](['apiKey', 'apiSecret', 'field1', 'field2']);
      }).toThrow('Missing required credentials: field1, field2');
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive data for logging', () => {
      const sensitiveData = {
        username: 'testuser',
        password: 'secret123',
        token: 'abc123',
        apiKey: 'key456',
        normalField: 'normalValue'
      };

      const sanitized = service['sanitizeForLogging'](sensitiveData);

      expect(sanitized).toEqual({
        username: 'testuser',
        password: '[REDACTED]',
        token: '[REDACTED]',
        apiKey: '[REDACTED]',
        normalField: 'normalValue'
      });
    });

    it('should handle non-object data', () => {
      expect(service['sanitizeForLogging']('string')).toBe('string');
      expect(service['sanitizeForLogging'](123)).toBe(123);
      expect(service['sanitizeForLogging'](null)).toBe(null);
    });
  });

  describe('Utility Methods', () => {
    it('should delay execution', async () => {
      const startTime = Date.now();
      await service['delay'](100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });

    it('should get rate limit info', () => {
      expect(service.getRateLimitInfo()).toBeNull();

      service['rateLimitInfo'] = sampleRateLimits.twitter.normal;
      expect(service.getRateLimitInfo()).toEqual(sampleRateLimits.twitter.normal);
    });
  });

  describe('Connection Test Implementation', () => {
    it('should test connection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: () => Promise.resolve({ id: 'test-user', name: 'Test User' })
      });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.details).toEqual({
        user: { id: 'test-user', name: 'Test User' }
      });
    });

    it('should handle connection test failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('Custom Error Handling', () => {
    it('should allow custom error customization', () => {
      class CustomService extends BaseService {
        async testConnection(): Promise<ConnectionTestResult> {
          return { success: true };
        }

        protected customizeError(error: any, response: Response, errorBody: any) {
          if (errorBody.code === 'CUSTOM_ERROR') {
            error.code = 'CUSTOM_HANDLED';
            error.message = 'Custom error handling';
          }
          return error;
        }
      }

      const customService = new CustomService(testCredentials);
      const baseError = {
        code: 'CLIENT_ERROR',
        message: 'Original message',
        statusCode: 400,
        retryable: false
      };

      const customizedError = customService['customizeError'](
        baseError,
        {} as Response,
        { code: 'CUSTOM_ERROR' }
      );

      expect(customizedError.code).toBe('CUSTOM_HANDLED');
      expect(customizedError.message).toBe('Custom error handling');
    });
  });
});