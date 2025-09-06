/**
 * Unit tests for LinkedInService class
 */

import { LinkedInService, LinkedInCredentials, LinkedInPostOptions } from '../../../src/services/linkedin';
import { setupFetchMock, TestUtils } from '../../setup';
import { 
  LinkedInMockScenarios,
  mockLinkedInProfile,
  mockLinkedInOrganization,
  mockLinkedInPost,
  mockLinkedInProfileResponse,
  mockLinkedInOrganizationResponse,
  mockLinkedInPostResponse,
  mockLinkedInUnauthorizedError,
  mockLinkedInForbiddenError,
  mockLinkedInRateLimitError,
  mockLinkedInValidationError,
  mockLinkedInMediaUploadResponse,
  createMockLinkedInRateLimitHeaders
} from '../../mocks/linkedin';
import { sampleLinkedInCredentials } from '../../mocks/fixtures';

describe('LinkedInService', () => {
  let linkedInService: LinkedInService;
  let mockFetch: jest.Mock;

  const validCredentials: LinkedInCredentials = {
    accessToken: sampleLinkedInCredentials.accessToken
  };

  const validCredentialsWithOrg: LinkedInCredentials = {
    accessToken: sampleLinkedInCredentials.accessToken,
    organizationId: sampleLinkedInCredentials.organizationId
  };

  beforeEach(() => {
    linkedInService = new LinkedInService(validCredentials);
    mockFetch = setupFetchMock([]);
  });

  describe('Constructor', () => {
    it('should initialize with valid credentials', () => {
      expect(linkedInService).toBeInstanceOf(LinkedInService);
    });

    it('should throw error for missing access token', () => {
      expect(() => {
        new LinkedInService({} as LinkedInCredentials);
      }).toThrow('Missing required credentials');
    });

    it('should accept organization ID in credentials', () => {
      const serviceWithOrg = new LinkedInService(validCredentialsWithOrg);
      expect(serviceWithOrg).toBeInstanceOf(LinkedInService);
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully for personal profile', async () => {
      setupFetchMock([LinkedInMockScenarios.getProfileSuccess]);

      const result = await linkedInService.testConnection();

      expect(result.success).toBe(true);
      expect(result.details?.profile).toEqual({
        id: mockLinkedInProfile.id,
        displayName: `${mockLinkedInProfile.localizedFirstName} ${mockLinkedInProfile.localizedLastName}`,
        vanityName: mockLinkedInProfile.vanityName
      });
    });

    it('should test connection with organization access', async () => {
      const serviceWithOrg = new LinkedInService(validCredentialsWithOrg);
      
      setupFetchMock([
        LinkedInMockScenarios.getProfileSuccess,
        LinkedInMockScenarios.getOrganizationSuccess
      ]);

      const result = await serviceWithOrg.testConnection();

      expect(result.success).toBe(true);
      expect(result.details?.profile).toBeDefined();
      expect(result.details?.organization).toEqual({
        id: mockLinkedInOrganization.id,
        name: mockLinkedInOrganization.localizedName,
        vanityName: mockLinkedInOrganization.vanityName
      });
    });

    it('should handle authentication failure', async () => {
      setupFetchMock([LinkedInMockScenarios.authenticateFailure]);

      const result = await linkedInService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe(mockLinkedInUnauthorizedError.error.message);
    });

    it('should handle organization access failure gracefully', async () => {
      const serviceWithOrg = new LinkedInService(validCredentialsWithOrg);
      
      setupFetchMock([
        LinkedInMockScenarios.getProfileSuccess,
        LinkedInMockScenarios.forbiddenAccess
      ]);

      const result = await serviceWithOrg.testConnection();

      expect(result.success).toBe(true); // Profile access succeeds
      expect(result.details?.profile).toBeDefined();
      expect(result.details?.organization).toBeUndefined();
    });

    it('should handle network errors during connection test', async () => {
      setupFetchMock([LinkedInMockScenarios.networkError]);

      const result = await linkedInService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network connection failed');
    });

    it('should use correct timeout and retries for connection test', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      await linkedInService.testConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.linkedin.com/v2/people/~',
        expect.objectContaining({
          method: 'GET',
          timeout: 10000,
          retries: 1
        })
      );
    });
  });

  describe('Post Creation', () => {
    it('should create a simple post successfully', async () => {
      setupFetchMock([
        LinkedInMockScenarios.getProfileSuccess, // For getting user ID
        LinkedInMockScenarios.createPostSuccess
      ]);

      const postOptions: LinkedInPostOptions = {
        text: 'This is a test LinkedIn post',
        visibility: 'PUBLIC'
      };

      const result = await linkedInService.createPost(postOptions);

      expect(result).toEqual(mockLinkedInPost);
    });

    it('should create a post as organization', async () => {
      const serviceWithOrg = new LinkedInService(validCredentialsWithOrg);
      setupFetchMock([LinkedInMockScenarios.createPostSuccess]);

      const postOptions: LinkedInPostOptions = {
        text: 'This is an organization post',
        asOrganization: true
      };

      await serviceWithOrg.createPost(postOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.linkedin.com/v2/ugcPosts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(`"author":"urn:li:organization:${validCredentialsWithOrg.organizationId}"`)
        })
      );
    });

    it('should create a post with media', async () => {
      setupFetchMock([
        LinkedInMockScenarios.getProfileSuccess,
        LinkedInMockScenarios.mediaUploadRegister,
        LinkedInMockScenarios.mediaUploadComplete,
        LinkedInMockScenarios.createPostWithMediaSuccess
      ]);

      const postOptions: LinkedInPostOptions = {
        text: 'Post with media',
        media: [
          {
            data: Buffer.from('fake-image-data'),
            mediaType: 'image/jpeg',
            altText: 'Test image'
          }
        ]
      };

      const result = await linkedInService.createPost(postOptions);

      expect(result).toEqual(mockLinkedInPost);
      expect(mockFetch).toHaveBeenCalledTimes(4); // Profile, register, upload, post
    });

    it('should create a post with article content', async () => {
      setupFetchMock([
        LinkedInMockScenarios.getProfileSuccess,
        LinkedInMockScenarios.createPostSuccess
      ]);

      const postOptions: LinkedInPostOptions = {
        text: 'Check out this article',
        articleUrl: 'https://example.com/article',
        articleTitle: 'Test Article',
        articleSummary: 'This is a test article summary'
      };

      await linkedInService.createPost(postOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.linkedin.com/v2/ugcPosts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"shareMediaCategory":"ARTICLE"')
        })
      );
    });

    it('should handle post validation errors', async () => {
      const invalidPostOptions: LinkedInPostOptions = {
        text: ''
      };

      await expect(linkedInService.createPost(invalidPostOptions))
        .rejects.toMatchObject({
          code: 'INVALID_POST',
          message: 'Post text cannot be empty',
          retryable: false
        });
    });

    it('should handle post length validation', async () => {
      const longPostOptions: LinkedInPostOptions = {
        text: 'a'.repeat(3001) // Exceeds 3000 character limit
      };

      await expect(linkedInService.createPost(longPostOptions))
        .rejects.toMatchObject({
          code: 'INVALID_POST',
          message: 'Post text exceeds 3000 character limit',
          retryable: false
        });
    });

    it('should handle API errors during post creation', async () => {
      setupFetchMock([
        LinkedInMockScenarios.getProfileSuccess,
        LinkedInMockScenarios.validationError
      ]);

      const postOptions: LinkedInPostOptions = {
        text: 'This post will fail validation'
      };

      await expect(linkedInService.createPost(postOptions))
        .rejects.toMatchObject({
          code: 'POST_FAILED',
          message: mockLinkedInValidationError.error.message,
          retryable: false
        });
    });

    it('should handle rate limiting during post creation', async () => {
      setupFetchMock([
        LinkedInMockScenarios.getProfileSuccess,
        LinkedInMockScenarios.rateLimitExceeded
      ]);

      const postOptions: LinkedInPostOptions = {
        text: 'This post will be rate limited'
      };

      await expect(linkedInService.createPost(postOptions))
        .rejects.toMatchObject({
          code: 'RATE_LIMIT_EXCEEDED'
        });
    });

    it('should use correct headers for post creation', async () => {
      setupFetchMock([
        LinkedInMockScenarios.getProfileSuccess,
        LinkedInMockScenarios.createPostSuccess
      ]);

      const postOptions: LinkedInPostOptions = {
        text: 'Test post for headers'
      };

      await linkedInService.createPost(postOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.linkedin.com/v2/ugcPosts',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
            'Authorization': expect.stringContaining('Bearer')
          })
        })
      );
    });
  });

  describe('Organization Management', () => {
    it('should fetch user organizations successfully', async () => {
      const organizationsResponse = {
        elements: [
          {
            'organization~': mockLinkedInOrganization
          }
        ]
      };

      setupFetchMock([{
        url: /organizationAcls/,
        method: 'GET',
        response: organizationsResponse,
        status: 200
      }]);

      const organizations = await linkedInService.getUserOrganizations();

      expect(organizations).toHaveLength(1);
      expect(organizations[0]).toEqual({
        id: mockLinkedInOrganization.id,
        name: mockLinkedInOrganization.name,
        logoV2: mockLinkedInOrganization.logoV2,
        vanityName: mockLinkedInOrganization.vanityName
      });
    });

    it('should handle empty organizations list', async () => {
      setupFetchMock([{
        url: /organizationAcls/,
        method: 'GET',
        response: { elements: [] },
        status: 200
      }]);

      const organizations = await linkedInService.getUserOrganizations();

      expect(organizations).toHaveLength(0);
    });

    it('should handle organizations fetch failure', async () => {
      setupFetchMock([{
        url: /organizationAcls/,
        response: mockLinkedInForbiddenError,
        status: 403
      }]);

      const organizations = await linkedInService.getUserOrganizations();

      expect(organizations).toHaveLength(0);
    });
  });

  describe('Media Upload', () => {
    it('should upload media successfully', async () => {
      setupFetchMock([
        LinkedInMockScenarios.mediaUploadRegister,
        LinkedInMockScenarios.mediaUploadComplete
      ]);

      const mediaOptions = {
        data: Buffer.from('fake-image-data'),
        mediaType: 'image/jpeg' as const,
        altText: 'Test image',
        title: 'Test Image Title'
      };

      const author = 'urn:li:person:abcd1234';
      const result = await linkedInService['uploadMedia']([mediaOptions], author);

      expect(result).toEqual([mockLinkedInMediaUploadResponse.value.asset]);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Register and upload
    });

    it('should handle media registration failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
        json: () => Promise.resolve({
          serviceErrorCode: 400,
          message: 'Invalid media registration'
        })
      });

      const mediaOptions = {
        data: Buffer.from('fake-image-data'),
        mediaType: 'image/jpeg' as const
      };

      const author = 'urn:li:person:abcd1234';

      await expect(linkedInService['uploadMedia']([mediaOptions], author))
        .rejects.toMatchObject({
          code: 'MEDIA_REGISTER_FAILED',
          message: 'Invalid media registration'
        });
    });

    it('should handle media upload failure', async () => {
      setupFetchMock([
        LinkedInMockScenarios.mediaUploadRegister,
        {
          url: /www\.linkedin\.com\/dms-uploads/,
          method: 'PUT',
          response: 'Upload failed',
          status: 400
        }
      ]);

      const mediaOptions = {
        data: Buffer.from('fake-image-data'),
        mediaType: 'image/jpeg' as const
      };

      const author = 'urn:li:person:abcd1234';

      await expect(linkedInService['uploadMedia']([mediaOptions], author))
        .rejects.toMatchObject({
          code: 'MEDIA_UPLOAD_FAILED',
          message: expect.stringContaining('Failed to upload media')
        });
    });

    it('should handle multiple media uploads', async () => {
      setupFetchMock([
        LinkedInMockScenarios.mediaUploadRegister,
        LinkedInMockScenarios.mediaUploadComplete,
        LinkedInMockScenarios.mediaUploadRegister,
        LinkedInMockScenarios.mediaUploadComplete
      ]);

      const mediaOptions = [
        {
          data: Buffer.from('fake-image-1'),
          mediaType: 'image/jpeg' as const
        },
        {
          data: Buffer.from('fake-image-2'),
          mediaType: 'image/png' as const
        }
      ];

      const author = 'urn:li:person:abcd1234';
      const result = await linkedInService['uploadMedia'](mediaOptions, author);

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(4); // 2 registers + 2 uploads
    });
  });

  describe('Rate Limiting', () => {
    it('should update rate limit info from response headers', async () => {
      const headers = createMockLinkedInRateLimitHeaders(50, 100);
      setupFetchMock([{
        ...LinkedInMockScenarios.getProfileSuccess,
        headers
      }]);

      await linkedInService.testConnection();

      const rateLimitInfo = linkedInService.getRateLimitInfo();
      expect(rateLimitInfo?.remaining).toBe(50);
      expect(rateLimitInfo?.limit).toBe(100);
    });

    it('should warn when rate limit is low', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const headers = createMockLinkedInRateLimitHeaders(5, 100); // Low remaining

      setupFetchMock([{
        ...LinkedInMockScenarios.getProfileSuccess,
        headers
      }]);

      await linkedInService.testConnection();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit running low: 5/100 remaining')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Authentication Headers', () => {
    it('should generate Bearer token headers', async () => {
      setupFetchMock([LinkedInMockScenarios.getProfileSuccess]);

      await linkedInService.testConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${validCredentials.accessToken}`,
            'User-Agent': 'PayloadCMS-SocialMedia-Plugin/1.0.0',
            'LinkedIn-Version': '202408'
          })
        })
      );
    });
  });

  describe('LinkedIn-Specific Error Handling', () => {
    it('should handle LinkedIn authentication errors', async () => {
      const errorResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map(),
        json: () => Promise.resolve({
          serviceErrorCode: 401,
          message: 'Invalid access token'
        })
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(linkedInService['makeRequest']('https://api.linkedin.com/v2/test'))
        .rejects.toMatchObject({
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid or expired access token',
          retryable: false
        });
    });

    it('should handle LinkedIn permission errors', async () => {
      const errorResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Map(),
        json: () => Promise.resolve({
          serviceErrorCode: 403,
          message: 'Insufficient permissions'
        })
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(linkedInService['makeRequest']('https://api.linkedin.com/v2/test'))
        .rejects.toMatchObject({
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this operation',
          retryable: false
        });
    });

    it('should handle LinkedIn rate limit errors', async () => {
      const errorResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map(),
        json: () => Promise.resolve({
          serviceErrorCode: 429,
          message: 'Rate limit exceeded'
        })
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(linkedInService['makeRequest']('https://api.linkedin.com/v2/test'))
        .rejects.toMatchObject({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          retryable: true
        });
    });

    it('should handle LinkedIn validation errors', async () => {
      const errorResponse = {
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: new Map(),
        json: () => Promise.resolve({
          serviceErrorCode: 422,
          message: 'Invalid request data'
        })
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(linkedInService['makeRequest']('https://api.linkedin.com/v2/test'))
        .rejects.toMatchObject({
          code: 'INVALID_REQUEST',
          message: 'Invalid request data',
          retryable: false
        });
    });

    it('should handle unknown LinkedIn errors', async () => {
      const errorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
        json: () => Promise.resolve({
          serviceErrorCode: 999,
          message: 'Unknown LinkedIn error'
        })
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(linkedInService['makeRequest']('https://api.linkedin.com/v2/test'))
        .rejects.toMatchObject({
          message: 'Unknown LinkedIn error'
        });
    });
  });

  describe('Profile Name Handling', () => {
    it('should handle missing name fields gracefully', async () => {
      const incompleteProfile = {
        id: 'test-id',
        firstName: { localized: {} },
        lastName: { localized: {} }
      };

      setupFetchMock([{
        url: 'https://api.linkedin.com/v2/people/~',
        method: 'GET',
        response: incompleteProfile,
        status: 200
      }]);

      const result = await linkedInService.testConnection();

      expect(result.success).toBe(true);
      expect(result.details?.profile?.displayName).toBe(''); // Should handle empty names
    });

    it('should construct display name from localized fields', async () => {
      const profileWithNames = {
        id: 'test-id',
        firstName: {
          localized: { 'en_US': 'John' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'Doe' },
          preferredLocale: { country: 'US', language: 'en' }
        }
      };

      setupFetchMock([{
        url: 'https://api.linkedin.com/v2/people/~',
        method: 'GET',
        response: profileWithNames,
        status: 200
      }]);

      const result = await linkedInService.testConnection();

      expect(result.success).toBe(true);
      expect(result.details?.profile?.displayName).toBe('John Doe');
    });
  });
});