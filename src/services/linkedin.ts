import { BaseService, ServiceCredentials, ServiceError } from './base';
import type { ConnectionTestResult } from '../types';
import { ErrorHandler, ErrorFactory, ErrorCodes, SocialMediaError } from './errors';

/**
 * LinkedIn API v2 credentials interface
 */
export interface LinkedInCredentials extends ServiceCredentials {
  accessToken: string;
  organizationId?: string;
}

/**
 * LinkedIn media upload options
 */
export interface LinkedInMediaOptions {
  data: Buffer | Uint8Array;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'video/mp4';
  altText?: string;
  title?: string;
}

/**
 * LinkedIn posting options
 */
export interface LinkedInPostOptions {
  text: string;
  media?: LinkedInMediaOptions[];
  visibility?: 'PUBLIC' | 'CONNECTIONS';
  asOrganization?: boolean;
  organizationId?: string;
  articleUrl?: string;
  articleTitle?: string;
  articleSummary?: string;
}

/**
 * LinkedIn API response types
 */
export interface LinkedInProfile {
  id: string;
  firstName: {
    localized: Record<string, string>;
    preferredLocale: { country: string; language: string };
  };
  lastName: {
    localized: Record<string, string>;
    preferredLocale: { country: string; language: string };
  };
  profilePicture?: {
    displayImage: string;
  };
  vanityName?: string;
}

export interface LinkedInOrganization {
  id: string;
  name: {
    localized: Record<string, string>;
    preferredLocale: { country: string; language: string };
  };
  logoV2?: {
    original: string;
  };
  vanityName?: string;
}

export interface LinkedInPost {
  id: string;
  author: string;
  created: {
    time: number;
  };
  lastModified: {
    time: number;
  };
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: {
        text: string;
      };
      shareMediaCategory: string;
      media?: Array<{
        status: string;
        description?: {
          text: string;
        };
        media: string;
      }>;
    };
  };
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': string;
  };
}

export interface LinkedInApiResponse<T> {
  elements?: T[];
  paging?: {
    count: number;
    start: number;
    links?: Array<{
      type: string;
      rel: string;
      href: string;
    }>;
  };
  message?: string;
  serviceErrorCode?: number;
  status?: number;
}

/**
 * LinkedIn API v2 service implementation
 */
export class LinkedInService extends BaseService {
  private static readonly API_BASE_URL = 'https://api.linkedin.com/v2';
  private static readonly UPLOAD_BASE_URL = 'https://api.linkedin.com/v2/assets';

  constructor(credentials: LinkedInCredentials, logger: Console = console) {
    super(credentials, logger);
    
    try {
      this.validateLinkedInCredentials(credentials);
    } catch (error) {
      const socialError = ErrorHandler.handle(error, logger, 'LinkedInService Constructor');
      throw socialError;
    }
  }

  /**
   * Test connection to LinkedIn API with comprehensive error handling
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      this.logger.log('[LinkedInService] Testing connection to LinkedIn API...');

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

      // Test basic profile access
      const response = await this.makeRequest(
        `${LinkedInService.API_BASE_URL}/people/~`,
        {
          method: 'GET',
          headers: await this.getAuthHeaders(),
          timeout: 10000,
          retries: 1
        }
      );

      const profileData = await this.validateApiResponse(response);

      // This point is only reached if validateApiResponse didn't throw an error

      // Get profile display name
      const firstNameLocalized = profileData.firstName?.localized || {};
      const lastNameLocalized = profileData.lastName?.localized || {};
      const firstNameKeys = Object.keys(firstNameLocalized);
      const lastNameKeys = Object.keys(lastNameLocalized);
      const firstName = firstNameKeys.length > 0 ? firstNameLocalized[firstNameKeys[0]!] : '';
      const lastName = lastNameKeys.length > 0 ? lastNameLocalized[lastNameKeys[0]!] : '';
      const displayName = `${firstName || ''} ${lastName || ''}`.trim();

      this.logger.log(`[LinkedInService] Connection successful. Authenticated as: ${displayName}`);

      // Test organization access if organizationId is provided
      const credentials = this.credentials as LinkedInCredentials;
      let organizationDetails = undefined;

      if (credentials.organizationId) {
        try {
          const orgResponse = await this.makeRequest(
            `${LinkedInService.API_BASE_URL}/organizations/${credentials.organizationId}`,
            {
              method: 'GET',
              headers: await this.getAuthHeaders(),
              timeout: 10000,
              retries: 1
            }
          );

          const orgData = await orgResponse.json();
          if (!orgData.serviceErrorCode) {
            const orgNameLocalized = orgData.name?.localized || {};
            const orgNameKeys = Object.keys(orgNameLocalized);
            const orgName = orgNameKeys.length > 0 ? orgNameLocalized[orgNameKeys[0]!] : '';
            organizationDetails = {
              id: orgData.id,
              name: orgName || ''
            };
          }
        } catch (error) {
          this.logger.warn('[LinkedInService] Could not verify organization access:', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      return {
        success: true,
        error: undefined,
        errorCode: undefined,
        retryable: undefined,
        details: {
          profile: {
            id: profileData.id,
            displayName,
            vanityName: profileData.vanityName
          },
          organization: organizationDetails !== undefined ? organizationDetails : undefined
        }
      };
    } catch (error) {
      const socialError = ErrorHandler.handle(error, this.logger, 'LinkedInService.testConnection');
      
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
   * Post content to LinkedIn
   */
  async createPost(options: LinkedInPostOptions): Promise<LinkedInPost> {
    try {
      this.logger.log(`[LinkedInService] Creating LinkedIn post: "${options.text.substring(0, 50)}${options.text.length > 50 ? '...' : ''}"`);

      // Validate post text length (LinkedIn allows up to 3000 characters)
      if (!options.text || options.text.trim().length === 0) {
        throw {
          code: 'INVALID_POST',
          message: 'Post text cannot be empty',
          retryable: false
        } as ServiceError;
      }

      if (options.text.length > 3000) {
        throw {
          code: 'INVALID_POST',
          message: 'Post text exceeds 3000 character limit',
          retryable: false
        } as ServiceError;
      }

      // Determine author (personal or organization)
      const credentials = this.credentials as LinkedInCredentials;
      let author: string;

      if (options.asOrganization && (options.organizationId || credentials.organizationId)) {
        author = `urn:li:organization:${options.organizationId || credentials.organizationId}`;
      } else {
        // Get user profile for personal posts
        const profileResponse = await this.makeRequest(
          `${LinkedInService.API_BASE_URL}/people/~`,
          {
            method: 'GET',
            headers: await this.getAuthHeaders(),
            timeout: 10000,
            retries: 1
          }
        );
        const profileData = await profileResponse.json();
        author = `urn:li:person:${profileData.id}`;
      }

      // Upload media if provided
      let mediaAssets: string[] = [];
      if (options.media && options.media.length > 0) {
        this.logger.log(`[LinkedInService] Uploading ${options.media.length} media file(s)...`);
        mediaAssets = await this.uploadMedia(options.media, author);
      }

      // Prepare post payload
      let specificContent: any = {
        shareCommentary: {
          text: options.text
        },
        shareMediaCategory: mediaAssets.length > 0 ? 'IMAGE' : 'NONE'
      };

      // Add media to content if uploaded
      if (mediaAssets.length > 0) {
        specificContent.media = mediaAssets.map(assetId => ({
          status: 'READY',
          description: {
            text: options.text
          },
          media: assetId
        }));
      }

      // Add article content if provided
      if (options.articleUrl) {
        specificContent.shareMediaCategory = 'ARTICLE';
        specificContent.media = [{
          status: 'READY',
          description: {
            text: options.articleSummary || options.text
          },
          originalUrl: options.articleUrl,
          title: {
            text: options.articleTitle || 'Article'
          }
        }];
      }

      const payload = {
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': specificContent
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': options.visibility || 'PUBLIC'
        }
      };

      // Create the post
      const response = await this.makeRequest(
        `${LinkedInService.API_BASE_URL}/ugcPosts`,
        {
          method: 'POST',
          headers: {
            ...await this.getAuthHeaders(),
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          },
          body: JSON.stringify(payload),
          timeout: 30000,
          retries: 2
        }
      );

      const data = await response.json();

      if (data.serviceErrorCode) {
        throw {
          code: 'POST_FAILED',
          message: data.message || 'Failed to create LinkedIn post',
          details: { error: data },
          retryable: false
        } as ServiceError;
      }

      this.logger.log(`[LinkedInService] Post created successfully. ID: ${data.id}`);

      return data;
    } catch (error) {
      this.logger.error('[LinkedInService] Failed to create post:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get user organizations for posting options
   */
  async getUserOrganizations(): Promise<LinkedInOrganization[]> {
    try {
      this.logger.log('[LinkedInService] Fetching user organizations...');

      const response = await this.makeRequest(
        `${LinkedInService.API_BASE_URL}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(*,organization~(id,name,logoV2)))`,
        {
          method: 'GET',
          headers: await this.getAuthHeaders(),
          timeout: 10000,
          retries: 1
        }
      );

      const data: LinkedInApiResponse<any> = await response.json();

      if (data.serviceErrorCode) {
        throw {
          code: 'ORGANIZATIONS_FETCH_FAILED',
          message: data.message || 'Failed to fetch organizations',
          retryable: true
        } as ServiceError;
      }

      const organizations: LinkedInOrganization[] = [];

      if (data.elements) {
        for (const element of data.elements) {
          if (element['organization~']) {
            const org = element['organization~'];
            if (org && org.id && org.name) {
              organizations.push({
                id: org.id,
                name: org.name,
                logoV2: org.logoV2,
                vanityName: org.vanityName
              });
            }
          }
        }
      }

      this.logger.log(`[LinkedInService] Found ${organizations.length} organizations`);
      return organizations;
    } catch (error) {
      this.logger.error('[LinkedInService] Failed to fetch organizations:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Upload media files to LinkedIn
   */
  private async uploadMedia(mediaList: LinkedInMediaOptions[], author: string): Promise<string[]> {
    const mediaAssets: string[] = [];

    for (let i = 0; i < mediaList.length; i++) {
      const media = mediaList[i]!;
      this.logger.log(`[LinkedInService] Uploading media ${i + 1}/${mediaList.length} (${media.mediaType})`);

      try {
        const assetId = await this.uploadSingleMedia(media, author);
        mediaAssets.push(assetId);
      } catch (error) {
        this.logger.error(`[LinkedInService] Failed to upload media ${i + 1}:`, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    }

    return mediaAssets;
  }

  /**
   * Upload a single media file
   */
  private async uploadSingleMedia(media: LinkedInMediaOptions, author: string): Promise<string> {
    // Step 1: Register upload
    const registerPayload = {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: author,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }
        ]
      }
    };

    const registerResponse = await this.makeRequest(
      `${LinkedInService.UPLOAD_BASE_URL}?action=registerUpload`,
      {
        method: 'POST',
        headers: {
          ...await this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registerPayload)
      }
    );

    const registerData = await registerResponse.json();

    if (registerData.serviceErrorCode) {
      throw {
        code: 'MEDIA_REGISTER_FAILED',
        message: registerData.message || 'Failed to register media upload',
        retryable: true
      } as ServiceError;
    }

    const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const asset = registerData.value.asset;

    // Step 2: Upload binary data
    const authHeaders = await this.getAuthHeaders();
    
    // Convert Buffer/Uint8Array to ArrayBuffer for upload
    const arrayBuffer = media.data instanceof Buffer ? 
      media.data.buffer.slice(media.data.byteOffset, media.data.byteOffset + media.data.byteLength) : 
      media.data.buffer;
    
    const uploadResponse = await this.makeRequest(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeaders.Authorization || '',
        'Content-Type': 'application/octet-stream'
      },
      body: arrayBuffer
    });

    if (!uploadResponse.ok) {
      throw {
        code: 'MEDIA_UPLOAD_FAILED',
        message: `Failed to upload media: ${uploadResponse.statusText}`,
        retryable: true
      } as ServiceError;
    }

    this.logger.log(`[LinkedInService] Media uploaded successfully: ${asset}`);
    return asset;
  }

  /**
   * Generate OAuth 2.0 Bearer token authorization header
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const credentials = this.credentials as LinkedInCredentials;

    return {
      'Authorization': `Bearer ${credentials.accessToken}`,
      'User-Agent': 'PayloadCMS-SocialMedia-Plugin/1.0.0',
      'LinkedIn-Version': '202408'
    };
  }

  /**
   * Customize LinkedIn-specific errors
   */
  protected override customizeError(error: ServiceError, _response: Response, errorBody: any): ServiceError {
    // Handle LinkedIn-specific error codes
    if (errorBody.serviceErrorCode) {
      switch (errorBody.serviceErrorCode) {
        case 401:
          error.code = 'AUTHENTICATION_FAILED';
          error.message = 'Invalid or expired access token';
          error.retryable = false;
          break;
        case 403:
          error.code = 'INSUFFICIENT_PERMISSIONS';
          error.message = 'Insufficient permissions for this operation';
          error.retryable = false;
          break;
        case 429:
          error.code = 'RATE_LIMIT_EXCEEDED';
          error.message = 'Rate limit exceeded';
          error.retryable = true;
          break;
        case 422:
          error.code = 'INVALID_REQUEST';
          error.message = errorBody.message || 'Invalid request data';
          error.retryable = false;
          break;
        default:
          error.message = errorBody.message || 'LinkedIn API error';
      }
    }

    return error;
  }

  /**
   * Update rate limit info from LinkedIn-specific headers
   */
  protected override updateRateLimitInfo(response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    const limit = response.headers.get('X-RateLimit-Limit');

    if (remaining !== null && reset !== null && limit !== null) {
      this.rateLimitInfo = {
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
        limit: parseInt(limit, 10)
      };

      this.logger.log(`[LinkedInService] Rate limit: ${remaining}/${limit} remaining, resets at ${new Date(parseInt(reset, 10) * 1000).toISOString()}`);

      // Warn if rate limit is getting low
      if (parseInt(remaining, 10) < 10) {
        this.logger.warn(`[LinkedInService] Rate limit running low: ${remaining}/${limit} remaining`);
      }
    }
  }

  /**
   * Validate LinkedIn API response structure
   */
  private async validateApiResponse(response: Response): Promise<any> {
    let data: any;
    
    try {
      data = await response.json();
    } catch (error) {
      throw ErrorFactory.server(
        'Failed to parse LinkedIn API response as JSON',
        response.status
      );
    }
    
    // Check for basic response structure
    if (!data || typeof data !== 'object') {
      throw ErrorFactory.validation('Invalid LinkedIn API response format');
    }
    
    // Check for LinkedIn-specific error structure
    if (data.serviceErrorCode) {
      throw new SocialMediaError(
        this.getLinkedInErrorCode(data.serviceErrorCode),
        `LinkedIn API Error: ${data.message || 'Unknown error'}`,
        {
          details: {
            serviceErrorCode: data.serviceErrorCode,
            message: data.message,
            requestId: data.requestId
          },
          retryable: this.isLinkedInErrorRetryable(data.serviceErrorCode),
          service: 'LinkedInService'
        }
      );
    }
    
    return data;
  }



  /**
   * Validate credentials in detail and return validation result
   */
  private validateCredentialsDetailed(): { isValid: boolean; errors: string[] } {
    const credentials = this.credentials as LinkedInCredentials;
    const errors: string[] = [];
    
    if (!credentials.accessToken || typeof credentials.accessToken !== 'string' || credentials.accessToken.trim().length < 30) {
      errors.push('LinkedIn access token must be a valid string with at least 30 characters');
    }
    
    if (credentials.organizationId && (typeof credentials.organizationId !== 'string' || credentials.organizationId.trim().length === 0)) {
      errors.push('LinkedIn organization ID must be a non-empty string when provided');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Map LinkedIn API error codes to internal error codes
   */
  private getLinkedInErrorCode(linkedInCode: number): string {
    switch (linkedInCode) {
      case 401:
        return ErrorCodes.AUTHENTICATION_FAILED;
      case 403:
        return ErrorCodes.FORBIDDEN;
      case 429:
        return ErrorCodes.RATE_LIMIT_EXCEEDED;
      case 400:
        return ErrorCodes.BAD_REQUEST;
      case 404:
        return ErrorCodes.ENDPOINT_NOT_FOUND;
      case 500:
        return ErrorCodes.INTERNAL_SERVER_ERROR;
      case 503:
        return ErrorCodes.SERVICE_UNAVAILABLE;
      default:
        return ErrorCodes.UNKNOWN_ERROR;
    }
  }

  /**
   * Determine if LinkedIn error is retryable
   */
  private isLinkedInErrorRetryable(linkedInCode: number): boolean {
    const retryableCodes = [429, 500, 502, 503, 504];
    return retryableCodes.includes(linkedInCode);
  }


  /**
   * Validate LinkedIn credentials with comprehensive checks
   */
  private validateLinkedInCredentials(credentials: LinkedInCredentials): void {
    if (!credentials.accessToken || typeof credentials.accessToken !== 'string' || credentials.accessToken.trim().length < 30) {
      throw new Error('LinkedIn access token must be a valid string with at least 30 characters');
    }
    
    if (credentials.organizationId && (typeof credentials.organizationId !== 'string' || credentials.organizationId.trim().length === 0)) {
      throw new Error('LinkedIn organization ID must be a non-empty string when provided');
    }
    
    this.logger.log('[LinkedInService] LinkedIn credentials validated successfully');
  }
}