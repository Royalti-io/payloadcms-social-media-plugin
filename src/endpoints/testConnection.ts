import type { PayloadRequest } from 'payload';
import { TwitterService } from '../services/twitter';
import { LinkedInService } from '../services/linkedin';
import type { ConnectionTestResult, SocialPlatform } from '../types';
import { 
  storeConnectionTestResult, 
  getLastConnectionTestResult, 
  isRecentTest 
} from '../utils/connectionTestStorage';

/**
 * API endpoint for testing social media platform connections
 * 
 * POST /api/social-media/test-connection
 * 
 * Request body:
 * {
 *   platform: 'twitter' | 'linkedin',
 *   credentials: Record<string, string>
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   error?: string,
 *   details?: {
 *     user?: { id, username, name, verified? },
 *     organization?: { id, name }
 *   }
 * }
 */

export interface TestConnectionRequest {
  platform: SocialPlatform;
  credentials: Record<string, string>;
}

export default async function testConnectionEndpoint(
  req: PayloadRequest
): Promise<Response> {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Method not allowed. Use POST.'
        }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if user has admin access
    if (!req.user || req.user.role !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized. Admin access required.'
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate request body
    const body = req.body as unknown as TestConnectionRequest;
    if (!body) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Request body is required'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const { platform, credentials } = body;

    if (!platform) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Platform parameter is required'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!credentials || typeof credentials !== 'object') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credentials object is required'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if we have a recent test result to avoid unnecessary API calls
    const userId = String(req.user.id || req.user.email || 'unknown');
    const lastResult = getLastConnectionTestResult(platform, credentials, userId);
    
    if (lastResult && isRecentTest(lastResult)) {
      console.log(`[ConnectionTest] Using cached ${platform} test result for user ${req.user.email || userId}`);
      
      // Return cached result but remove storage-specific fields
      const { timestamp, credentialsHash, platform: storedPlatform, ...cachedResult } = lastResult;
      return new Response(
        JSON.stringify({
          ...cachedResult,
          cached: true,
          testedAt: timestamp
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Log the connection test attempt (without sensitive data)
    console.log(`[ConnectionTest] Testing ${platform} connection for user ${req.user.email || userId}`);

    let result: ConnectionTestResult;

    try {
      switch (platform) {
        case 'twitter':
          result = await testTwitterConnection(credentials);
          break;
        case 'linkedin':
          result = await testLinkedInConnection(credentials);
          break;
        default:
          result = {
            success: false,
            error: `Platform '${platform}' is not supported for connection testing`,
            errorCode: 'UNSUPPORTED_PLATFORM',
            retryable: false,
            details: undefined
          };
      }
    } catch (error) {
      console.error(`[ConnectionTest] Error testing ${platform} connection:`, error);
      result = {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed unexpectedly',
        errorCode: 'UNEXPECTED_ERROR',
        retryable: true,
        details: undefined
      };
    }

    // Store the test result for future reference
    try {
      storeConnectionTestResult(platform, result, credentials, userId);
    } catch (storageError) {
      console.warn(`[ConnectionTest] Failed to store test result:`, storageError);
      // Don't fail the request if storage fails
    }

    // Log the result (without sensitive details)
    console.log(`[ConnectionTest] ${platform} test ${result.success ? 'succeeded' : 'failed'}${result.success && result.details?.user ? ` for @${result.details.user.username}` : ''}`);

    // Return the result with timestamp
    return new Response(
      JSON.stringify({
        ...result,
        testedAt: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[ConnectionTest] Endpoint error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error during connection test'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Test Twitter connection using the Twitter service
 */
async function testTwitterConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
  // Validate required Twitter credentials
  const requiredFields = ['apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret'];
  const missingFields = requiredFields.filter(field => !credentials[field] || credentials[field].trim() === '');
  
  if (missingFields.length > 0) {
    return {
      success: false,
      error: `Missing required Twitter credentials: ${missingFields.join(', ')}. Please ensure all OAuth 1.0a credentials are provided.`,
      errorCode: 'MISSING_CREDENTIALS',
      retryable: false,
      details: undefined
    };
  }

  try {
    console.log('[ConnectionTest] Creating Twitter service instance...');
    
    const twitterService = new TwitterService({
      apiKey: credentials.apiKey!,
      apiSecret: credentials.apiSecret!,
      accessToken: credentials.accessToken!,
      accessTokenSecret: credentials.accessTokenSecret!,
      bearerToken: credentials.bearerToken || ''
    });

    console.log('[ConnectionTest] Calling Twitter testConnection...');
    const result = await twitterService.testConnection();
    
    console.log(`[ConnectionTest] Twitter testConnection result: ${result.success ? 'success' : 'failed'}`);
    return result;

  } catch (error) {
    console.error('[ConnectionTest] Twitter service error:', error);
    
    // Provide user-friendly error messages
    let errorMessage = error instanceof Error ? error.message : 'Connection test failed';
    
    // Handle common Twitter API errors
    if (errorMessage.includes('AUTHENTICATION_FAILED') || errorMessage.includes('UNAUTHORIZED')) {
      errorMessage = 'Twitter API authentication failed. Please verify your OAuth 1.0a credentials (API Key, API Secret, Access Token, Access Token Secret) are correct and have the necessary permissions.';
    } else if (errorMessage.includes('NETWORK_ERROR')) {
      errorMessage = 'Network connection to Twitter API failed. Please check your internet connection and try again.';
    } else if (errorMessage.includes('OAUTH_SIGNATURE_FAILED')) {
      errorMessage = 'OAuth 1.0a signature generation failed. This may indicate an issue with credential format or the signing process.';
    } else if (errorMessage.includes('TIMESTAMP_OUT_OF_BOUNDS')) {
      errorMessage = 'Request timestamp out of bounds. Please check that your system clock is synchronized.';
    }

    return {
      success: false,
      error: errorMessage,
      errorCode: 'TWITTER_API_ERROR',
      retryable: true,
      details: undefined
    };
  }
}

/**
 * Test LinkedIn connection using the LinkedIn service
 */
async function testLinkedInConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
  // Validate required LinkedIn credentials
  if (!credentials.accessToken || credentials.accessToken.trim() === '') {
    return {
      success: false,
      error: 'LinkedIn access token is required',
      errorCode: 'MISSING_CREDENTIALS',
      retryable: false,
      details: undefined
    };
  }

  try {
    console.log('[ConnectionTest] Creating LinkedIn service instance...');
    
    const serviceCredentials: { accessToken: string; organizationId?: string } = {
      accessToken: credentials.accessToken
    };
    
    // Add organization ID if provided
    if (credentials.organizationId && credentials.organizationId.trim() !== '') {
      serviceCredentials.organizationId = credentials.organizationId;
    }

    const linkedInService = new LinkedInService(serviceCredentials);

    console.log('[ConnectionTest] Calling LinkedIn testConnection...');
    const result = await linkedInService.testConnection();
    
    console.log(`[ConnectionTest] LinkedIn testConnection result: ${result.success ? 'success' : 'failed'}`);
    
    // If successful, transform the response to match our expected format
    if (result.success && result.details?.profile) {
      return {
        success: true,
        error: undefined,
        errorCode: undefined,
        retryable: undefined,
        details: {
          user: {
            id: result.details.profile.id,
            username: result.details.profile.vanityName || result.details.profile.displayName || '',
            name: result.details.profile.displayName || '',
            verified: false // LinkedIn doesn't have a direct verified flag like Twitter
          },
          ...(result.details.organization && {
            organization: {
              id: result.details.organization.id,
              name: result.details.organization.name
            }
          })
        }
      };
    }
    
    return result;

  } catch (error) {
    console.error('[ConnectionTest] LinkedIn service error:', error);
    
    // Provide user-friendly error messages
    let errorMessage = error instanceof Error ? error.message : 'Connection test failed';
    
    // Handle common LinkedIn API errors
    if (errorMessage.includes('AUTHENTICATION_FAILED') || errorMessage.includes('UNAUTHORIZED')) {
      errorMessage = 'LinkedIn API authentication failed. Please verify your access token is valid and has the necessary permissions.';
    } else if (errorMessage.includes('TOKEN_EXPIRED')) {
      errorMessage = 'LinkedIn access token has expired. Please generate a new access token from the LinkedIn Developer Console.';
    } else if (errorMessage.includes('NETWORK_ERROR')) {
      errorMessage = 'Network connection to LinkedIn API failed. Please check your internet connection and try again.';
    } else if (errorMessage.includes('INSUFFICIENT_PERMISSIONS')) {
      errorMessage = 'Insufficient LinkedIn API permissions. Please ensure your application has the required permissions enabled.';
    }

    return {
      success: false,
      error: errorMessage,
      errorCode: 'LINKEDIN_API_ERROR',
      retryable: true,
      details: undefined
    };
  }
}