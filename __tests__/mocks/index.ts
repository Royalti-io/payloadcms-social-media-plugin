/**
 * Central export point for all test mocks and fixtures
 */

// Twitter API mocks
export * from './twitter';
export { TwitterMockScenarios } from './twitter';

// LinkedIn API mocks  
export * from './linkedin';
export { LinkedInMockScenarios } from './linkedin';

// PayloadCMS mocks
export * from './payloadcms';
export { default as PayloadCMSMocks } from './payloadcms';

// Test fixtures and sample data
export * from './fixtures';
export { default as Fixtures } from './fixtures';

// Common mock utilities
import { 
  createMockFetchResponse, 
  createMockFetchError, 
  setupFetchMock 
} from '../setup';

export const MockUtils = {
  createMockFetchResponse,
  createMockFetchError,
  setupFetchMock
};

/**
 * Quick setup functions for common testing scenarios
 */
export const setupMocks = {
  /**
   * Setup basic Twitter API mocks for successful operations
   */
  twitterSuccess: () => {
    const { TwitterMockScenarios } = require('./twitter');
    return setupFetchMock([
      TwitterMockScenarios.authenticateSuccess,
      TwitterMockScenarios.postTweetSuccess,
      TwitterMockScenarios.mediaUploadInit,
      TwitterMockScenarios.mediaUploadAppend,
      TwitterMockScenarios.mediaUploadFinalize,
      TwitterMockScenarios.mediaProcessingComplete
    ]);
  },

  /**
   * Setup Twitter API mocks for authentication failure
   */
  twitterAuthFailure: () => {
    const { TwitterMockScenarios } = require('./twitter');
    return setupFetchMock([
      TwitterMockScenarios.authenticateFailure
    ]);
  },

  /**
   * Setup Twitter API mocks for rate limiting
   */
  twitterRateLimit: () => {
    const { TwitterMockScenarios } = require('./twitter');
    return setupFetchMock([
      TwitterMockScenarios.rateLimitExceeded
    ]);
  },

  /**
   * Setup basic LinkedIn API mocks for successful operations
   */
  linkedinSuccess: () => {
    const { LinkedInMockScenarios } = require('./linkedin');
    return setupFetchMock([
      LinkedInMockScenarios.getProfileSuccess,
      LinkedInMockScenarios.createPostSuccess,
      LinkedInMockScenarios.mediaUploadRegister,
      LinkedInMockScenarios.mediaUploadComplete
    ]);
  },

  /**
   * Setup LinkedIn API mocks for authentication failure
   */
  linkedinAuthFailure: () => {
    const { LinkedInMockScenarios } = require('./linkedin');
    return setupFetchMock([
      LinkedInMockScenarios.authenticateFailure
    ]);
  },

  /**
   * Setup LinkedIn API mocks for rate limiting
   */
  linkedinRateLimit: () => {
    const { LinkedInMockScenarios } = require('./linkedin');
    return setupFetchMock([
      LinkedInMockScenarios.rateLimitExceeded
    ]);
  },

  /**
   * Setup network error scenarios
   */
  networkError: () => {
    return setupFetchMock([
      {
        url: /.*/,
        response: new Error('Network connection failed'),
        status: 0
      }
    ]);
  },

  /**
   * Setup server error scenarios
   */
  serverError: () => {
    return setupFetchMock([
      {
        url: /.*/,
        response: { error: 'Internal server error' },
        status: 500
      }
    ]);
  },

  /**
   * Setup comprehensive mock scenario for integration tests
   */
  fullIntegration: () => {
    const { TwitterMockScenarios } = require('./twitter');
    const { LinkedInMockScenarios } = require('./linkedin');
    
    return setupFetchMock([
      // Twitter scenarios
      TwitterMockScenarios.authenticateSuccess,
      TwitterMockScenarios.postTweetSuccess,
      TwitterMockScenarios.postTweetWithMediaSuccess,
      TwitterMockScenarios.mediaUploadInit,
      TwitterMockScenarios.mediaUploadAppend,
      TwitterMockScenarios.mediaUploadFinalize,
      TwitterMockScenarios.mediaProcessingComplete,
      
      // LinkedIn scenarios
      LinkedInMockScenarios.getProfileSuccess,
      LinkedInMockScenarios.getOrganizationSuccess,
      LinkedInMockScenarios.createPostSuccess,
      LinkedInMockScenarios.createPostWithMediaSuccess,
      LinkedInMockScenarios.mediaUploadRegister,
      LinkedInMockScenarios.mediaUploadComplete
    ]);
  }
};

export default {
  setupMocks,
  MockUtils
};