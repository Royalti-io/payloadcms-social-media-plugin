/**
 * Jest test setup file for PayloadCMS Social Media Plugin
 * 
 * This file configures the testing environment, provides mock implementations,
 * and sets up common test utilities for consistent testing across the plugin.
 */

import { TextEncoder, TextDecoder } from 'util';

// Configure Node.js globals for testing environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock PayloadCMS secret for encryption tests
process.env.PAYLOAD_SECRET = 'test-secret-key-for-encryption-testing-12345';

// Mock console methods to reduce noise in tests
const originalConsole = global.console;

// Store original methods for restoration
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Mock fetch globally for all tests
global.fetch = jest.fn();

// Setup global mocks
beforeAll(() => {
  // Mock console.log to reduce test output noise
  jest.spyOn(console, 'log').mockImplementation((...args) => {
    // Only show logs in debug mode
    if (process.env.DEBUG_TESTS) {
      originalLog.apply(console, args);
    }
  });

  // Keep warnings visible but controlled
  jest.spyOn(console, 'warn').mockImplementation((...args) => {
    if (process.env.DEBUG_TESTS || args[0]?.includes?.('IMPORTANT')) {
      originalWarn.apply(console, args);
    }
  });

  // Always show errors
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    originalError.apply(console, args);
  });
});

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset fetch mock
  (global.fetch as jest.Mock).mockReset();
});

// Cleanup after all tests
afterAll(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

/**
 * Mock PayloadCMS Request object for testing
 */
export const createMockPayloadRequest = (overrides: any = {}) => ({
  payload: {
    secret: process.env.PAYLOAD_SECRET,
    config: {
      custom: {
        socialMediaPlugin: {
          platforms: {
            twitter: { enabled: true },
            linkedin: { enabled: true }
          },
          debug: false
        }
      }
    },
    find: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findGlobal: jest.fn(),
    updateGlobal: jest.fn()
  },
  user: {
    id: 'test-user-id',
    role: 'admin',
    email: 'test@example.com'
  },
  collection: {
    config: {
      slug: 'test-collection'
    }
  },
  ...overrides
});

/**
 * Mock PayloadCMS Context object for testing
 */
export const createMockPayloadContext = (overrides: any = {}) => ({
  req: createMockPayloadRequest(),
  ...overrides
});

/**
 * Helper to create mock fetch responses
 */
export const createMockFetchResponse = (data: any, options: {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
} = {}) => {
  const {
    status = 200,
    statusText = 'OK',
    headers = {}
  } = options;

  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
      has: (name: string) => name.toLowerCase() in headers,
      entries: () => Object.entries(headers),
      forEach: (callback: (value: string, key: string) => void) => {
        Object.entries(headers).forEach(([key, value]) => callback(value, key));
      },
      ...headers
    },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    clone: () => createMockFetchResponse(data, { status, statusText, headers }),
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'basic' as ResponseType,
    url: ''
  } as Response);
};

/**
 * Helper to create mock fetch error
 */
export const createMockFetchError = (message: string = 'Network Error') => {
  const error = new Error(message);
  error.name = 'NetworkError';
  return Promise.reject(error);
};

/**
 * Helper to setup fetch mock with different responses
 */
export const setupFetchMock = (responses: Array<{
  url?: string | RegExp;
  method?: string;
  response: any;
  status?: number;
  headers?: Record<string, string>;
  delay?: number;
}>) => {
  const fetchMock = global.fetch as jest.Mock;
  
  fetchMock.mockImplementation(async (url: string, options: any = {}) => {
    // Add optional delay for testing async behavior
    const matchingResponse = responses.find(response => {
      if (response.url) {
        if (response.url instanceof RegExp) {
          return response.url.test(url);
        }
        return url.includes(response.url as string);
      }
      return true;
    });

    if (matchingResponse) {
      if (matchingResponse.delay) {
        await new Promise(resolve => setTimeout(resolve, matchingResponse.delay));
      }
      
      return createMockFetchResponse(
        matchingResponse.response,
        {
          status: matchingResponse.status,
          headers: matchingResponse.headers
        }
      );
    }

    // Default error response for unmatched URLs
    return Promise.reject(new Error(`No mock response configured for: ${url}`));
  });

  return fetchMock;
};

/**
 * Test utilities for common operations
 */
export const TestUtils = {
  /**
   * Wait for a specific amount of time
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random test data
   */
  randomString: (length: number = 10) => {
    return Math.random().toString(36).substring(2, length + 2);
  },

  /**
   * Generate random numbers within range
   */
  randomNumber: (min: number = 0, max: number = 100) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Create a test Twitter credentials object
   */
  createTestTwitterCredentials: () => ({
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    accessToken: 'test-access-token',
    accessTokenSecret: 'test-access-token-secret',
    bearerToken: 'test-bearer-token'
  }),

  /**
   * Create a test LinkedIn credentials object
   */
  createTestLinkedInCredentials: () => ({
    accessToken: 'test-linkedin-access-token',
    organizationId: 'test-org-id'
  }),

  /**
   * Create test encryption data
   */
  createTestEncryptionData: () => ({
    encrypted: 'encrypted-data-string',
    iv: Buffer.from('test-iv').toString('base64'),
    tag: Buffer.from('test-tag').toString('base64'),
    salt: Buffer.from('test-salt').toString('base64')
  }),

  /**
   * Create test social media settings document
   */
  createTestSocialMediaSettings: () => ({
    id: 'social-media-settings',
    platforms: {
      twitter: {
        enabled: true,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        accessToken: 'test-access-token',
        accessTokenSecret: 'test-access-token-secret',
        bearerToken: 'test-bearer-token',
        characterLimit: 280,
        allowMedia: true,
        defaultTemplate: 'Check out: {{title}} {{url}}'
      },
      linkedin: {
        enabled: true,
        accessToken: 'test-linkedin-access-token',
        organizationId: 'test-org-id',
        postAsOrganization: false,
        defaultTemplate: 'New post: {{title}}\n\n{{excerpt}}\n\n{{url}}'
      }
    },
    messageTemplates: [
      {
        name: 'Blog Post',
        template: 'New blog post: {{title}}\n\n{{excerpt}}\n\nRead more: {{url}}',
        enabled: true,
        description: 'Template for blog posts',
        variables: ['title', 'excerpt', 'url']
      }
    ],
    shareButtons: {
      enabled: true,
      platforms: ['twitter', 'linkedin'] as const,
      position: 'bottom' as const,
      styling: {
        size: 'medium' as const,
        variant: 'filled' as const,
        borderRadius: 4
      }
    },
    analytics: {
      enabled: false,
      trackClicks: true,
      trackViews: false
    },
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 900000
    },
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }),

  /**
   * Create test collection document
   */
  createTestDocument: (overrides: any = {}) => ({
    id: TestUtils.randomString(),
    title: 'Test Document Title',
    slug: 'test-document-slug',
    content: 'This is test content for the document.',
    excerpt: 'This is a test excerpt.',
    author: {
      name: 'Test Author',
      email: 'author@test.com'
    },
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides
  })
};

/**
 * Custom Jest matchers for better assertions
 */
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidEncryptionResult(): R;
      toMatchTwitterApiResponse(): R;
      toMatchLinkedInApiResponse(): R;
    }
  }
}

expect.extend({
  toBeValidEncryptionResult(received) {
    const pass = received &&
      typeof received.encrypted === 'string' &&
      typeof received.iv === 'string' &&
      typeof received.tag === 'string' &&
      received.encrypted.length > 0 &&
      received.iv.length > 0;

    return {
      message: () => 
        pass
          ? `Expected ${JSON.stringify(received)} not to be a valid encryption result`
          : `Expected ${JSON.stringify(received)} to be a valid encryption result with encrypted, iv, and tag properties`,
      pass,
    };
  },

  toMatchTwitterApiResponse(received) {
    const pass = received &&
      received.data &&
      typeof received.data.id === 'string' &&
      typeof received.data.text === 'string';

    return {
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to match Twitter API response format`
          : `Expected ${JSON.stringify(received)} to match Twitter API response format`,
      pass,
    };
  },

  toMatchLinkedInApiResponse(received) {
    const pass = received &&
      received.data &&
      (received.data.id || received.data.urn);

    return {
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to match LinkedIn API response format`
          : `Expected ${JSON.stringify(received)} to match LinkedIn API response format`,
      pass,
    };
  },
});

// Environment configuration for tests
process.env.NODE_ENV = 'test';
process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || 'test-secret-key-for-encryption-testing-12345';

console.log('🧪 Test environment initialized for PayloadCMS Social Media Plugin');