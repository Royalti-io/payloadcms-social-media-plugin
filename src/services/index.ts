/**
 * Social Media Services Export Module
 * 
 * This module provides a unified interface for all social media API services
 * used in the PayloadCMS social media plugin.
 */

// Base service exports
import { BaseService } from './base';
import type { RateLimitInfo } from './base';
export { BaseService };
export type {
  ServiceCredentials,
  RateLimitInfo,
  RequestOptions,
  ServiceError
} from './base';
export type { ConnectionTestResult } from '../types';

// Twitter service exports
import { TwitterService } from './twitter';
export { TwitterService };
export type {
  TwitterCredentials,
  TwitterMediaOptions,
  TweetOptions,
  TwitterUser,
  TwitterTweet,
  TwitterMedia,
  TweetResponse,
  TwitterApiResponse
} from './twitter';

// LinkedIn service exports
import { LinkedInService } from './linkedin';
export { LinkedInService };
export type {
  LinkedInCredentials,
  LinkedInMediaOptions,
  LinkedInPostOptions,
  LinkedInProfile,
  LinkedInOrganization,
  LinkedInPost,
  LinkedInApiResponse
} from './linkedin';

// Error handling exports
export {
  SocialMediaError,
  ErrorFactory,
  ErrorHandler,
  ErrorCodes,
  type ServiceError as IServiceError
} from './errors';

/**
 * Service factory for creating social media service instances
 */
export class ServiceFactory {
  /**
   * Create a Twitter service instance
   */
  static createTwitterService(
    credentials: {
      apiKey: string;
      apiSecret: string;
      accessToken: string;
      accessTokenSecret: string;
      bearerToken?: string;
    },
    logger?: Console
  ): TwitterService {
    return new TwitterService(credentials, logger);
  }

  /**
   * Create a LinkedIn service instance
   */
  static createLinkedInService(
    credentials: {
      accessToken: string;
      organizationId?: string;
    },
    logger?: Console
  ): LinkedInService {
    return new LinkedInService(credentials, logger);
  }

  /**
   * Validate service credentials format
   */
  static validateCredentials(
    service: 'twitter' | 'linkedin',
    credentials: Record<string, any>
  ): { valid: boolean; missing?: string[]; errors?: string[] } {
    switch (service) {
      case 'twitter':
        return this.validateTwitterCredentials(credentials);
      case 'linkedin':
        return this.validateLinkedInCredentials(credentials);
      default:
        return { valid: false, errors: [`Unknown service: ${service}`] };
    }
  }

  private static validateTwitterCredentials(
    credentials: Record<string, any>
  ): { valid: boolean; missing?: string[]; errors?: string[] } {
    const required = ['apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret'];
    const missing = required.filter(field => !credentials[field] || typeof credentials[field] !== 'string');
    
    const errors: string[] = [];
    
    if (missing.length > 0) {
      return { valid: false, missing };
    }

    // Additional validation for Twitter credentials
    if (credentials.apiKey.length < 20) {
      errors.push('API Key appears to be invalid (too short)');
    }
    
    if (credentials.apiSecret.length < 40) {
      errors.push('API Secret appears to be invalid (too short)');
    }

    if (credentials.accessToken.length < 40) {
      errors.push('Access Token appears to be invalid (too short)');
    }

    if (credentials.accessTokenSecret.length < 40) {
      errors.push('Access Token Secret appears to be invalid (too short)');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }
    return { valid: true };
  }

  private static validateLinkedInCredentials(
    credentials: Record<string, any>
  ): { valid: boolean; missing?: string[]; errors?: string[] } {
    const required = ['accessToken'];
    const missing = required.filter(field => !credentials[field] || typeof credentials[field] !== 'string');
    
    const errors: string[] = [];
    
    if (missing.length > 0) {
      return { valid: false, missing };
    }

    // Additional validation for LinkedIn credentials
    if (credentials.accessToken.length < 50) {
      errors.push('Access Token appears to be invalid (too short)');
    }
    
    // Organization ID validation (if provided)
    if (credentials.organizationId && (typeof credentials.organizationId !== 'string' || credentials.organizationId.length < 7)) {
      errors.push('Organization ID appears to be invalid');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }
    return { valid: true };
  }
}

/**
 * Utility functions for service management
 */
export class ServiceUtils {
  /**
   * Test multiple service connections in parallel
   */
  static async testConnections(
    services: Array<{ name: string; service: BaseService }>
  ): Promise<Array<{ name: string; result: import('../types').ConnectionTestResult }>> {
    const promises = services.map(async ({ name, service }) => ({
      name,
      result: await service.testConnection()
    }));

    return Promise.all(promises);
  }

  /**
   * Get service health status
   */
  static getHealthStatus(results: Array<{ name: string; result: import('../types').ConnectionTestResult }>): {
    healthy: string[];
    unhealthy: Array<{ name: string; error: string }>;
    overall: 'healthy' | 'partial' | 'unhealthy';
  } {
    const healthy = results.filter(r => r.result.success).map(r => r.name);
    const unhealthy = results
      .filter(r => !r.result.success)
      .map(r => ({ name: r.name, error: r.result.error || 'Unknown error' }));

    let overall: 'healthy' | 'partial' | 'unhealthy';
    if (healthy.length === results.length) {
      overall = 'healthy';
    } else if (healthy.length > 0) {
      overall = 'partial';
    } else {
      overall = 'unhealthy';
    }

    return { healthy, unhealthy, overall };
  }

  /**
   * Format rate limit information for display
   */
  static formatRateLimit(rateLimitInfo: RateLimitInfo | null): string {
    if (!rateLimitInfo) {
      return 'Rate limit information not available';
    }

    const resetDate = new Date(rateLimitInfo.reset * 1000);
    const now = new Date();
    const minutesUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / 60000);

    return `${rateLimitInfo.remaining}/${rateLimitInfo.limit} requests remaining (resets in ${minutesUntilReset} minutes)`;
  }

  /**
   * Calculate optimal retry delay based on rate limit info
   */
  static calculateOptimalDelay(
    rateLimitInfo: RateLimitInfo | null,
    attempt: number = 0
  ): number {
    if (rateLimitInfo && rateLimitInfo.remaining === 0) {
      // If rate limited, wait until reset time
      const resetTime = rateLimitInfo.reset * 1000;
      const now = Date.now();
      return Math.max(0, resetTime - now);
    }

    // Otherwise use exponential backoff
    return Math.min(Math.pow(2, attempt) * 1000 + Math.random() * 1000, 30000);
  }
}