import { BaseService, ServiceCredentials, ServiceError } from './base';
import type { ConnectionTestResult } from '../types';
import { SocialMediaError, ErrorFactory, ErrorHandler, ErrorCodes } from './errors';
import { createHmac, randomBytes } from 'crypto';

/**
 * Twitter API v2 credentials interface
 */
export interface TwitterCredentials extends ServiceCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken?: string;
}

/**
 * Twitter media upload options
 */
export interface TwitterMediaOptions {
  data: Buffer | Uint8Array;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'video/mp4';
  altText?: string;
}

/**
 * Tweet posting options
 */
export interface TweetOptions {
  text: string;
  media?: TwitterMediaOptions[];
  replyTo?: string;
  quoteTweet?: string;
}

/**
 * Twitter API response types
 */
export interface TwitterUser {
  id: string;
  username: string;
  name: string;
  verified?: boolean;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
}

export interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
  attachments?: {
    media_keys: string[];
  };
}

export interface TwitterMedia {
  media_key: string;
  type: 'photo' | 'video' | 'animated_gif';
  url?: string;
  preview_image_url?: string;
  width?: number;
  height?: number;
  alt_text?: string;
}

export interface TweetResponse {
  data: TwitterTweet;
  includes?: {
    users?: TwitterUser[];
    media?: TwitterMedia[];
  } | undefined;
}

export interface TwitterApiResponse<T> {
  data: T;
  includes?: {
    users?: TwitterUser[];
    media?: TwitterMedia[];
  };
  meta?: Record<string, any>;
  errors?: Array<{
    code: number;
    message: string;
    resource_type?: string;
    field?: string;
    parameter?: string;
  }>;
}

/**
 * Twitter API v2 service implementation
 */
export class TwitterService extends BaseService {
  private static readonly API_BASE_URL = 'https://api.twitter.com/2';
  private static readonly UPLOAD_BASE_URL = 'https://upload.twitter.com/1.1';

  constructor(credentials: TwitterCredentials, logger: Console = console) {
    super(credentials, logger);
    
    try {
      this.validateTwitterCredentials(credentials);
    } catch (error) {
      const socialError = ErrorHandler.handle(error, logger, 'TwitterService Constructor');
      throw socialError;
    }
  }

  /**
   * Test connection to Twitter API with comprehensive error handling
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      this.logger.log('[TwitterService] Testing connection to Twitter API...');

      // Validate credentials before making request
      const credentialValidation = this.validateCredentialsDetailed();
      if (!credentialValidation.isValid) {
        return {
          success: false,
          error: credentialValidation.errors.join('; '),
          errorCode: ErrorCodes.AUTHENTICATION_FAILED,
          retryable: false,
          details: { validationErrors: credentialValidation.errors }
        };
      }

      const endpoint = `${TwitterService.API_BASE_URL}/users/me`;
      const response = await this.makeRequest(
        endpoint,
        {
          method: 'GET',
          headers: await this.getAuthHeaders('GET', endpoint),
          timeout: 10000,
          retries: 1
        }
      );

      const data: TwitterApiResponse<TwitterUser> = await this.validateApiResponse(response);

      if (data.errors && data.errors.length > 0) {
        const twitterError = data.errors[0]!;
        return {
          success: false,
          error: `Twitter API Error: ${twitterError.message}`,
          errorCode: this.getTwitterErrorCode(twitterError.code),
          retryable: this.isTwitterErrorRetryable(twitterError.code),
          details: { 
            errors: data.errors,
            twitterErrorCode: twitterError.code
          }
        };
      }

      // Validate response data structure
      if (!data.data || !data.data.id || !data.data.username) {
        throw ErrorFactory.validation('Invalid Twitter API response: missing required user data');
      }

      this.logger.log(`[TwitterService] Connection successful. Authenticated as: @${data.data.username}`);

      return {
        success: true,
        error: undefined,
        errorCode: undefined,
        retryable: undefined,
        details: {
          user: {
            id: data.data.id,
            username: data.data.username,
            name: data.data.name,
            verified: data.data.verified || false
          },
          metrics: data.data.public_metrics
        }
      };
    } catch (error) {
      const socialError = ErrorHandler.handle(error, this.logger, 'TwitterService.testConnection');
      
      return {
        success: false,
        error: ErrorHandler.getUserMessage(socialError),
        errorCode: socialError.code,
        retryable: socialError.isRetryable(),
        details: socialError.details !== undefined ? socialError.details : undefined
      };
    }
  }

  /**
   * Post a tweet with optional media and comprehensive validation
   */
  async postTweet(options: TweetOptions): Promise<TweetResponse> {
    try {
      this.logger.log(`[TwitterService] Posting tweet: "${options.text.substring(0, 50)}${options.text.length > 50 ? '...' : ''}"`);

      // Comprehensive input validation
      this.validateTweetOptions(options);
      
      // Validate credentials before making request
      const credentialValidation = this.validateCredentialsDetailed();
      if (!credentialValidation.isValid) {
        throw ErrorFactory.authentication(
          `Twitter credentials validation failed: ${credentialValidation.errors.join('; ')}`,
          { validationErrors: credentialValidation.errors }
        );
      }

      // Upload media if provided
      let mediaIds: string[] = [];
      if (options.media && options.media.length > 0) {
        this.logger.log(`[TwitterService] Uploading ${options.media.length} media file(s)...`);
        mediaIds = await this.uploadMedia(options.media);
      }

      // Prepare tweet payload
      const payload: any = {
        text: options.text
      };

      if (mediaIds.length > 0) {
        payload.media = { media_ids: mediaIds };
      }

      if (options.replyTo) {
        payload.reply = { in_reply_to_tweet_id: options.replyTo };
      }

      if (options.quoteTweet) {
        payload.quote_tweet_id = options.quoteTweet;
      }

      // Post the tweet
      const endpoint = `${TwitterService.API_BASE_URL}/tweets`;
      const body = JSON.stringify(payload);
      const response = await this.makeRequest(
        endpoint,
        {
          method: 'POST',
          headers: {
            ...await this.getAuthHeaders('POST', endpoint, body),
            'Content-Type': 'application/json'
          },
          body,
          timeout: 30000,
          retries: 2
        }
      );

      const data: TwitterApiResponse<TwitterTweet> = await this.validateApiResponse(response);

      if (data.errors && data.errors.length > 0) {
        const twitterError = data.errors[0]!;
        throw new SocialMediaError(
          this.getTwitterErrorCode(twitterError.code) || ErrorCodes.OPERATION_FAILED,
          `Twitter API Error: ${twitterError.message}`,
          {
            details: { 
              errors: data.errors,
              twitterErrorCode: twitterError.code,
              tweetText: options.text.substring(0, 100)
            },
            retryable: this.isTwitterErrorRetryable(twitterError.code),
            service: 'TwitterService'
          }
        );
      }

      // Validate response data structure
      if (!data.data || !data.data.id) {
        throw ErrorFactory.validation('Invalid Twitter API response: missing tweet ID');
      }

      this.logger.log(`[TwitterService] Tweet posted successfully. ID: ${data.data.id}`);

      return { 
        data: data.data, 
        includes: data.includes 
      };
    } catch (error) {
      const socialError = ErrorHandler.handle(error, this.logger, 'TwitterService.postTweet');
      throw socialError;
    }
  }

  /**
   * Upload media files to Twitter
   */
  private async uploadMedia(mediaList: TwitterMediaOptions[]): Promise<string[]> {
    const mediaIds: string[] = [];

    for (let i = 0; i < mediaList.length; i++) {
      const media = mediaList[i]!;
      this.logger.log(`[TwitterService] Uploading media ${i + 1}/${mediaList.length} (${media.mediaType})`);

      try {
        const mediaId = await this.uploadSingleMedia(media);
        mediaIds.push(mediaId);
        
        // Add alt text if provided
        if (media.altText) {
          await this.addAltText(mediaId, media.altText);
        }
      } catch (error) {
        this.logger.error(`[TwitterService] Failed to upload media ${i + 1}:`, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    }

    return mediaIds;
  }

  /**
   * Upload a single media file
   */
  private async uploadSingleMedia(media: TwitterMediaOptions): Promise<string> {
    // Step 1: Initialize upload
    const initEndpoint = `${TwitterService.UPLOAD_BASE_URL}/media/upload.json`;
    const initBody = new URLSearchParams({
      command: 'INIT',
      media_type: media.mediaType,
      total_bytes: media.data.length.toString()
    }).toString();
    const initResponse = await this.makeRequest(
      initEndpoint,
      {
        method: 'POST',
        headers: {
          ...await this.getAuthHeaders('POST', initEndpoint, initBody),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: initBody
      }
    );

    const initData = await initResponse.json();
    const mediaId = initData.media_id_string;

    // Step 2: Upload media in chunks (for simplicity, we'll upload in one chunk)
    const appendEndpoint = `${TwitterService.UPLOAD_BASE_URL}/media/upload.json`;
    const appendBody = this.createMultipartFormData({
      command: 'APPEND',
      media_id: mediaId,
      segment_index: '0',
      media: media.data
    });
    const appendResponse = await this.makeRequest(
      appendEndpoint,
      {
        method: 'POST',
        headers: await this.getAuthHeaders('POST', appendEndpoint, appendBody),
        body: appendBody
      }
    );

    if (!appendResponse.ok) {
      const errorData = await appendResponse.json();
      throw {
        code: 'MEDIA_UPLOAD_FAILED',
        message: errorData.errors?.[0]?.message || 'Failed to upload media',
        retryable: true
      } as ServiceError;
    }

    // Step 3: Finalize upload
    const finalizeEndpoint = `${TwitterService.UPLOAD_BASE_URL}/media/upload.json`;
    const finalizeBody = new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaId
    }).toString();
    const finalizeResponse = await this.makeRequest(
      finalizeEndpoint,
      {
        method: 'POST',
        headers: {
          ...await this.getAuthHeaders('POST', finalizeEndpoint, finalizeBody),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: finalizeBody
      }
    );

    const finalizeData = await finalizeResponse.json();

    // Check if processing is required
    if (finalizeData.processing_info) {
      await this.waitForProcessing(mediaId);
    }

    return mediaId;
  }

  /**
   * Wait for media processing to complete
   */
  private async waitForProcessing(mediaId: string): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30; // Max 5 minutes (30 * 10 seconds)

    while (attempts < maxAttempts) {
      this.logger.log(`[TwitterService] Checking media processing status... (attempt ${attempts + 1})`);

      const statusEndpoint = `${TwitterService.UPLOAD_BASE_URL}/media/upload.json?command=STATUS&media_id=${mediaId}`;
      const statusResponse = await this.makeRequest(
        statusEndpoint,
        {
          method: 'GET',
          headers: await this.getAuthHeaders('GET', statusEndpoint)
        }
      );

      const statusData = await statusResponse.json();
      const processingInfo = statusData.processing_info;

      if (!processingInfo) {
        return; // Processing complete
      }

      if (processingInfo.state === 'succeeded') {
        this.logger.log('[TwitterService] Media processing completed successfully');
        return;
      }

      if (processingInfo.state === 'failed') {
        throw {
          code: 'MEDIA_PROCESSING_FAILED',
          message: processingInfo.error?.message || 'Media processing failed',
          retryable: false
        } as ServiceError;
      }

      // Wait for the recommended check interval
      const waitTime = (processingInfo.check_after_secs || 10) * 1000;
      await this.delay(waitTime);
      attempts++;
    }

    throw {
      code: 'MEDIA_PROCESSING_TIMEOUT',
      message: 'Media processing timed out',
      retryable: false
    } as ServiceError;
  }

  /**
   * Add alt text to uploaded media
   */
  private async addAltText(mediaId: string, altText: string): Promise<void> {
    this.logger.log(`[TwitterService] Adding alt text to media ${mediaId}`);

    const endpoint = `${TwitterService.UPLOAD_BASE_URL}/media/metadata/create.json`;
    const body = JSON.stringify({
      media_id: mediaId,
      alt_text: { text: altText }
    });
    const response = await this.makeRequest(
      endpoint,
      {
        method: 'POST',
        headers: {
          ...await this.getAuthHeaders('POST', endpoint, body),
          'Content-Type': 'application/json'
        },
        body
      }
    );

    if (!response.ok) {
      // Don't fail the entire upload for alt text issues
      this.logger.warn(`[TwitterService] Failed to add alt text: ${response.statusText}`);
    }
  }

  /**
   * Create multipart form data for media upload
   */
  private createMultipartFormData(fields: Record<string, string | Buffer | Uint8Array>): FormData {
    const formData = new FormData();

    for (const [key, value] of Object.entries(fields)) {
      if (key === 'media' && (value instanceof Buffer || value instanceof Uint8Array)) {
        formData.append(key, new Blob([value as BlobPart]), 'media');
      } else {
        formData.append(key, value.toString());
      }
    }

    return formData;
  }

  /**
   * Generate OAuth 1.0a authorization header with proper signature
   */
  private async getAuthHeaders(method: string = 'GET', url: string = '', body?: string | FormData): Promise<Record<string, string>> {
    const credentials = this.credentials as TwitterCredentials;
    
    // If Bearer token is available and this is a read-only operation, use it for fallback
    if (credentials.bearerToken && method === 'GET') {
      try {
        this.logger.log('[TwitterService] Using Bearer token for read-only operation');
        return this.getBearerTokenHeaders(credentials.bearerToken);
      } catch (error) {
        this.logger.warn('[TwitterService] Bearer token authentication failed, falling back to OAuth 1.0a:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = this.generateNonce();
    
    // Collect OAuth parameters
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: credentials.apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: credentials.accessToken,
      oauth_version: '1.0'
    };

    // Extract query parameters and body parameters
    const allParams: Record<string, string> = { ...oauthParams };
    
    // Add query parameters from URL
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.forEach((value, key) => {
        allParams[key] = value;
      });
    } catch (error) {
      // URL might be relative, skip query param extraction
    }
    
    // Add body parameters for form-encoded requests
    if (body && typeof body === 'string' && body.includes('=')) {
      try {
        const bodyParams = new URLSearchParams(body);
        bodyParams.forEach((value, key) => {
          allParams[key] = value;
        });
      } catch (error) {
        // Body is not form-encoded, skip
      }
    }

    // Generate signature
    let signature: string;
    try {
      signature = this.generateOAuthSignature(method, url, allParams, credentials);
    } catch (error) {
      this.logger.error('[TwitterService] OAuth signature generation failed:', error instanceof Error ? error.message : 'Unknown error');
      throw {
        code: 'OAUTH_SIGNATURE_FAILED',
        message: 'Failed to generate OAuth 1.0a signature',
        details: { error: error instanceof Error ? error.message : error },
        retryable: false
      } as ServiceError;
    }
    
    // Build authorization header
    const authParams = {
      ...oauthParams,
      oauth_signature: signature
    };
    
    const authString = Object.entries(authParams)
      .map(([key, value]) => `${this.percentEncode(key)}="${this.percentEncode(value)}"`)
      .join(', ');

    return {
      'Authorization': `OAuth ${authString}`,
      'User-Agent': 'PayloadCMS-SocialMedia-Plugin/1.0.0'
    };
  }

  /**
   * Generate OAuth 1.0a signature using HMAC-SHA1
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    credentials: TwitterCredentials
  ): string {
    try {
      // Create signature base string
      const baseString = this.createSignatureBaseString(method, url, params);
      
      // Create signing key
      const signingKey = this.createSigningKey(credentials.apiSecret, credentials.accessTokenSecret);
      
      // Log signature components for debugging (without sensitive data)
      this.logger.log(`[TwitterService] OAuth signature components - Method: ${method}, URL base: ${url.split('?')[0]}`);
      
      // Generate HMAC-SHA1 signature
      const signature = createHmac('sha1', signingKey)
        .update(baseString)
        .digest('base64');
      
      this.logger.log(`[TwitterService] Successfully generated OAuth signature for ${method} request`);
      
      return signature;
    } catch (error) {
      this.logger.error('[TwitterService] HMAC-SHA1 signature generation error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Create OAuth 1.0a signature base string
   */
  private createSignatureBaseString(method: string, url: string, params: Record<string, string>): string {
    // Normalize URL (remove query parameters and fragment)
    let baseUrl = url;
    try {
      const parsedUrl = new URL(url);
      baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
    } catch (error) {
      // If URL parsing fails, assume it's already a base URL
    }
    
    // Sort parameters by key, then by value
    const sortedParams = Object.entries(params)
      .sort(([a], [b]) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      })
      .map(([key, value]) => `${this.percentEncode(key)}=${this.percentEncode(value)}`)
      .join('&');
    
    // Construct signature base string
    const baseString = [
      method.toUpperCase(),
      this.percentEncode(baseUrl),
      this.percentEncode(sortedParams)
    ].join('&');
    
    return baseString;
  }

  /**
   * Create OAuth 1.0a signing key
   */
  private createSigningKey(consumerSecret: string, tokenSecret: string): string {
    return `${this.percentEncode(consumerSecret)}&${this.percentEncode(tokenSecret)}`;
  }

  /**
   * Percent encode string according to RFC 3986
   */
  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
      .replace(/%20/g, '%20'); // Keep spaces as %20, not +
  }

  /**
   * Generate cryptographically secure OAuth nonce
   */
  private generateNonce(): string {
    return randomBytes(16).toString('base64')
      .replace(/[+/=]/g, (c) => {
        switch (c) {
          case '+': return '-';
          case '/': return '_';
          case '=': return '';
          default: return c;
        }
      });
  }

  /**
   * Get Bearer token authorization headers (fallback for read-only operations)
   */
  private getBearerTokenHeaders(bearerToken: string): Record<string, string> {
    if (!bearerToken || bearerToken.trim() === '') {
      throw new Error('Bearer token is empty or invalid');
    }
    
    return {
      'Authorization': `Bearer ${bearerToken}`,
      'User-Agent': 'PayloadCMS-SocialMedia-Plugin/1.0.0'
    };
  }

  /**
   * Debug method to test OAuth signature generation (for development/testing)
   */
  public debugOAuthSignature(method: string, url: string, params: Record<string, string> = {}): {
    baseString: string;
    signingKey: string;
    signature: string;
  } {
    const credentials = this.credentials as TwitterCredentials;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = this.generateNonce();
    
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: credentials.apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: credentials.accessToken,
      oauth_version: '1.0',
      ...params
    };
    
    const baseString = this.createSignatureBaseString(method, url, oauthParams);
    const signingKey = this.createSigningKey(credentials.apiSecret, credentials.accessTokenSecret);
    const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');
    
    return {
      baseString,
      signingKey: signingKey.replace(credentials.apiSecret, '[API_SECRET]').replace(credentials.accessTokenSecret, '[TOKEN_SECRET]'),
      signature
    };
  }

  /**
   * Customize Twitter-specific errors
   */
  protected override customizeError(error: ServiceError, _response: Response, errorBody: any): ServiceError {
    // Handle Twitter-specific error codes
    if (errorBody.errors && errorBody.errors.length > 0) {
      const twitterError = errorBody.errors[0];
      
      switch (twitterError.code) {
        case 32:
          error.code = 'AUTHENTICATION_FAILED';
          error.message = 'Authentication failed. Please check your Twitter API credentials (API Key, API Secret, Access Token, and Access Token Secret).';
          error.retryable = false;
          break;
        case 88:
          error.code = 'RATE_LIMIT_EXCEEDED';
          error.message = 'Twitter API rate limit exceeded. Please wait before making more requests.';
          error.retryable = true;
          break;
        case 89:
          error.code = 'INVALID_TOKEN';
          error.message = 'Invalid or expired Twitter access token. Please regenerate your access tokens.';
          error.retryable = false;
          break;
        case 135:
          error.code = 'TIMESTAMP_OUT_OF_BOUNDS';
          error.message = 'Request timestamp is out of bounds. Check system clock synchronization.';
          error.retryable = true;
          break;
        case 186:
          error.code = 'TWEET_TOO_LONG';
          error.message = 'Tweet exceeds 280 character limit';
          error.retryable = false;
          break;
        case 187:
          error.code = 'DUPLICATE_TWEET';
          error.message = 'Duplicate tweet detected. Cannot post the same content twice.';
          error.retryable = false;
          break;
        case 215:
          error.code = 'BAD_AUTHENTICATION_DATA';
          error.message = 'Bad authentication data. OAuth signature generation may be incorrect.';
          error.retryable = false;
          break;
        case 401:
          error.code = 'UNAUTHORIZED';
          error.message = 'Twitter API authorization failed. Check OAuth 1.0a signature generation and credentials.';
          error.retryable = false;
          break;
        default:
          error.message = twitterError.message;
      }
    }

    return error;
  }

  /**
   * Validate Twitter API response structure
   */
  private async validateApiResponse(response: Response): Promise<TwitterApiResponse<any>> {
    let data: any;
    
    try {
      data = await response.json();
    } catch (error) {
      throw ErrorFactory.server(
        'Failed to parse Twitter API response as JSON',
        response.status
      );
    }
    
    // Check for basic response structure
    if (!data || typeof data !== 'object') {
      throw ErrorFactory.validation('Invalid Twitter API response format');
    }
    
    return data;
  }

  /**
   * Validate tweet options before posting
   */
  private validateTweetOptions(options: TweetOptions): void {
    if (!options) {
      throw ErrorFactory.validation('Tweet options are required');
    }
    
    // Validate tweet text
    if (!options.text || typeof options.text !== 'string') {
      throw ErrorFactory.validation('Tweet text is required and must be a string');
    }
    
    const trimmedText = options.text.trim();
    if (trimmedText.length === 0) {
      throw ErrorFactory.validation('Tweet text cannot be empty');
    }
    
    if (trimmedText.length > 280) {
      throw new SocialMediaError(
        ErrorCodes.CONTENT_TOO_LONG,
        `Tweet exceeds 280 character limit (current: ${trimmedText.length})`,
        {
          details: { 
            currentLength: trimmedText.length, 
            maxLength: 280,
            text: trimmedText.substring(0, 50) + '...'
          },
          retryable: false
        }
      );
    }
    
    // Validate media if provided
    if (options.media) {
      if (!Array.isArray(options.media)) {
        throw ErrorFactory.validation('Tweet media must be an array');
      }
      
      if (options.media.length > 4) {
        throw ErrorFactory.validation('Twitter supports maximum 4 media attachments per tweet');
      }
      
      options.media.forEach((media, index) => {
        this.validateMediaOptions(media, index);
      });
    }
    
    // Validate reply/quote tweet IDs if provided
    if (options.replyTo && (typeof options.replyTo !== 'string' || options.replyTo.trim().length === 0)) {
      throw ErrorFactory.validation('Reply-to tweet ID must be a non-empty string');
    }
    
    if (options.quoteTweet && (typeof options.quoteTweet !== 'string' || options.quoteTweet.trim().length === 0)) {
      throw ErrorFactory.validation('Quote tweet ID must be a non-empty string');
    }
  }

  /**
   * Validate media options
   */
  private validateMediaOptions(media: TwitterMediaOptions, index: number): void {
    if (!media || typeof media !== 'object') {
      throw ErrorFactory.validation(`Media at index ${index} must be an object`);
    }
    
    if (!media.data || (!(media.data instanceof Buffer) && !(media.data instanceof Uint8Array))) {
      throw ErrorFactory.validation(`Media at index ${index} must have valid data (Buffer or Uint8Array)`);
    }
    
    if (!media.mediaType || typeof media.mediaType !== 'string') {
      throw ErrorFactory.validation(`Media at index ${index} must have a valid media type`);
    }
    
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'];
    if (!supportedTypes.includes(media.mediaType)) {
      throw ErrorFactory.validation(
        `Media at index ${index} has unsupported type: ${media.mediaType}. Supported types: ${supportedTypes.join(', ')}`
      );
    }
    
    // Validate file size limits
    const maxSizes = {
      'image/jpeg': 5 * 1024 * 1024, // 5MB
      'image/png': 5 * 1024 * 1024,  // 5MB  
      'image/gif': 15 * 1024 * 1024, // 15MB
      'image/webp': 5 * 1024 * 1024, // 5MB
      'video/mp4': 512 * 1024 * 1024 // 512MB
    };
    
    const maxSize = maxSizes[media.mediaType];
    if (media.data.length > maxSize) {
      throw new SocialMediaError(
        ErrorCodes.MEDIA_TOO_LARGE,
        `Media at index ${index} exceeds size limit for ${media.mediaType} (${Math.round(media.data.length / 1024 / 1024)}MB > ${Math.round(maxSize / 1024 / 1024)}MB)`,
        {
          details: {
            mediaIndex: index,
            mediaType: media.mediaType,
            actualSize: media.data.length,
            maxSize
          },
          retryable: false
        }
      );
    }
    
    // Validate alt text if provided
    if (media.altText && (typeof media.altText !== 'string' || media.altText.length > 1000)) {
      throw ErrorFactory.validation(`Media alt text at index ${index} must be a string with maximum 1000 characters`);
    }
  }

  /**
   * Validate credentials in detail and return validation result
   */
  private validateCredentialsDetailed(): { isValid: boolean; errors: string[] } {
    const credentials = this.credentials as TwitterCredentials;
    const errors: string[] = [];
    
    // Check for OAuth 1.0a credentials (preferred) or Bearer token
    const hasOAuth = credentials.apiKey && credentials.apiSecret && credentials.accessToken && credentials.accessTokenSecret;
    const hasBearerToken = credentials.bearerToken && credentials.bearerToken.trim();
    
    if (!hasOAuth && !hasBearerToken) {
      errors.push('Twitter requires either OAuth 1.0a credentials (apiKey, apiSecret, accessToken, accessTokenSecret) or a Bearer token');
      return { isValid: false, errors };
    }
    
    // Validate OAuth 1.0a credentials if provided
    if (hasOAuth) {
      if (typeof credentials.apiKey !== 'string' || credentials.apiKey.trim().length < 10) {
        errors.push('API Key must be a valid string with at least 10 characters');
      }
      
      if (typeof credentials.apiSecret !== 'string' || credentials.apiSecret.trim().length < 20) {
        errors.push('API Secret must be a valid string with at least 20 characters');
      }
      
      if (typeof credentials.accessToken !== 'string' || credentials.accessToken.trim().length < 20) {
        errors.push('Access Token must be a valid string with at least 20 characters');
      }
      
      if (typeof credentials.accessTokenSecret !== 'string' || credentials.accessTokenSecret.trim().length < 20) {
        errors.push('Access Token Secret must be a valid string with at least 20 characters');
      }
    }
    
    // Validate Bearer token if provided
    if (hasBearerToken && (typeof credentials.bearerToken !== 'string' || credentials.bearerToken.trim().length < 30)) {
      errors.push('Bearer Token must be a valid string with at least 30 characters');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Map Twitter API error codes to internal error codes
   */
  private getTwitterErrorCode(twitterCode: number): string {
    switch (twitterCode) {
      case 32:
      case 89:
      case 215:
        return ErrorCodes.AUTHENTICATION_FAILED;
      case 88:
        return ErrorCodes.RATE_LIMIT_EXCEEDED;
      case 135:
        return ErrorCodes.VALIDATION_ERROR;
      case 186:
        return ErrorCodes.CONTENT_TOO_LONG;
      case 187:
        return ErrorCodes.DUPLICATE_CONTENT;
      case 401:
        return ErrorCodes.UNAUTHORIZED;
      case 403:
        return ErrorCodes.FORBIDDEN;
      case 404:
        return ErrorCodes.ENDPOINT_NOT_FOUND;
      case 429:
        return ErrorCodes.RATE_LIMIT_EXCEEDED;
      default:
        return ErrorCodes.UNKNOWN_ERROR;
    }
  }

  /**
   * Determine if Twitter error is retryable
   */
  private isTwitterErrorRetryable(twitterCode: number): boolean {
    const retryableCodes = [88, 135, 429, 500, 502, 503, 504];
    return retryableCodes.includes(twitterCode);
  }

  /**
   * Validate Twitter credentials with comprehensive checks
   */
  private validateTwitterCredentials(credentials: TwitterCredentials): void {
    const requiredFields = ['apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret'];
    const missing = requiredFields.filter(field => !credentials[field] || credentials[field].trim() === '');
    
    if (missing.length > 0) {
      throw new Error(`Missing required Twitter credentials: ${missing.join(', ')}. Please ensure all OAuth 1.0a credentials are properly configured.`);
    }

    // Validate credential format
    if (credentials.apiKey.length < 10) {
      throw new Error('Twitter API Key appears to be invalid (too short)');
    }

    if (credentials.apiSecret.length < 20) {
      throw new Error('Twitter API Secret appears to be invalid (too short)');
    }

    if (credentials.accessToken.length < 20) {
      throw new Error('Twitter Access Token appears to be invalid (too short)');
    }

    if (credentials.accessTokenSecret.length < 20) {
      throw new Error('Twitter Access Token Secret appears to be invalid (too short)');
    }

    // Check for common mistakes
    const secrets = [credentials.apiSecret, credentials.accessTokenSecret];
    secrets.forEach((secret, index) => {
      if (secret.includes(' ') || secret.includes('\n') || secret.includes('\t')) {
        const fieldName = index === 0 ? 'API Secret' : 'Access Token Secret';
        throw new Error(`Twitter ${fieldName} contains invalid characters (whitespace). Please check your credentials.`);
      }
    });

    this.logger.log('[TwitterService] Twitter credentials validated successfully');
  }

  /**
   * Update rate limit info from Twitter-specific headers
   */
  protected override updateRateLimitInfo(response: Response): void {
    const remaining = response.headers.get('x-rate-limit-remaining');
    const reset = response.headers.get('x-rate-limit-reset');
    const limit = response.headers.get('x-rate-limit-limit');

    if (remaining !== null && reset !== null && limit !== null) {
      this.rateLimitInfo = {
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
        limit: parseInt(limit, 10)
      };

      this.logger.log(`[TwitterService] Rate limit: ${remaining}/${limit} remaining, resets at ${new Date(parseInt(reset, 10) * 1000).toISOString()}`);

      // Warn if rate limit is getting low
      if (parseInt(remaining, 10) < 10) {
        this.logger.warn(`[TwitterService] Rate limit running low: ${remaining}/${limit} remaining`);
      }
    }
  }
}