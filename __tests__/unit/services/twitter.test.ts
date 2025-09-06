/**
 * Unit tests for TwitterService class
 */

import { TwitterService, TwitterCredentials, TweetOptions } from '../../../src/services/twitter';
import { setupFetchMock, TestUtils } from '../../setup';
import { 
  TwitterMockScenarios,
  mockTwitterUserResponse,
  mockTwitterTweetResponse,
  mockTwitterTweetWithMediaResponse,
  mockTwitterErrorResponse,
  mockTwitterRateLimitErrorResponse,
  mockTwitterDuplicateErrorResponse,
  mockTwitterTooLongErrorResponse,
  mockMediaUploadInitResponse,
  mockMediaUploadFinalizeResponse,
  createMockRateLimitHeaders
} from '../../mocks/twitter';
import { sampleTwitterCredentials } from '../../mocks/fixtures';

describe('TwitterService', () => {
  let twitterService: TwitterService;
  let mockFetch: jest.Mock;

  const validCredentials: TwitterCredentials = sampleTwitterCredentials;

  beforeEach(() => {
    twitterService = new TwitterService(validCredentials);
    mockFetch = setupFetchMock([]);
  });

  describe('Constructor', () => {
    it('should initialize with valid credentials', () => {
      expect(twitterService).toBeInstanceOf(TwitterService);
    });

    it('should throw error for missing credentials', () => {
      expect(() => {
        new TwitterService({} as TwitterCredentials);
      }).toThrow('Missing required credentials');
    });

    it('should throw error for incomplete credentials', () => {
      expect(() => {
        new TwitterService({
          apiKey: 'test',
          apiSecret: 'test'
          // Missing accessToken and accessTokenSecret
        } as TwitterCredentials);
      }).toThrow('Missing required credentials');
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      setupFetchMock([TwitterMockScenarios.authenticateSuccess]);

      const result = await twitterService.testConnection();

      expect(result.success).toBe(true);
      expect(result.details?.user).toEqual({
        id: mockTwitterUserResponse.data.id,
        username: mockTwitterUserResponse.data.username,
        name: mockTwitterUserResponse.data.name,
        verified: mockTwitterUserResponse.data.verified
      });
    });

    it('should handle authentication failure', async () => {
      setupFetchMock([TwitterMockScenarios.authenticateFailure]);

      const result = await twitterService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe(mockTwitterErrorResponse.errors[0].message);
    });

    it('should handle network errors during connection test', async () => {
      setupFetchMock([TwitterMockScenarios.networkError]);

      const result = await twitterService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network connection failed');
    });

    it('should use correct timeout and retries for connection test', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      await twitterService.testConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twitter.com/2/users/me',
        expect.objectContaining({
          method: 'GET',
          timeout: 10000,
          retries: 1
        })
      );
    });
  });

  describe('Tweet Posting', () => {
    it('should post a simple tweet successfully', async () => {
      setupFetchMock([TwitterMockScenarios.postTweetSuccess]);

      const tweetOptions: TweetOptions = {
        text: 'This is a test tweet'
      };

      const result = await twitterService.postTweet(tweetOptions);

      expect(result.data).toEqual(mockTwitterTweetResponse.data);
      expect(result.includes).toEqual(mockTwitterTweetResponse.includes);
    });

    it('should post a tweet with media successfully', async () => {
      setupFetchMock([
        TwitterMockScenarios.mediaUploadInit,
        TwitterMockScenarios.mediaUploadAppend,
        TwitterMockScenarios.mediaUploadFinalize,
        TwitterMockScenarios.postTweetWithMediaSuccess
      ]);

      const tweetOptions: TweetOptions = {
        text: 'This is a tweet with media',
        media: [
          {
            data: Buffer.from('fake-image-data'),
            mediaType: 'image/jpeg',
            altText: 'Test image'
          }
        ]
      };

      const result = await twitterService.postTweet(tweetOptions);

      expect(result.data).toEqual(mockTwitterTweetWithMediaResponse.data);
      expect(mockFetch).toHaveBeenCalledTimes(4); // Init, append, finalize, post tweet
    });

    it('should handle tweet validation errors', async () => {
      const invalidTweetOptions: TweetOptions = {
        text: ''
      };

      await expect(twitterService.postTweet(invalidTweetOptions))
        .rejects.toMatchObject({
          code: 'INVALID_TWEET',
          message: 'Tweet text cannot be empty',
          retryable: false
        });
    });

    it('should handle tweet length validation', async () => {
      const longTweetOptions: TweetOptions = {
        text: 'a'.repeat(281) // Exceeds 280 character limit
      };

      await expect(twitterService.postTweet(longTweetOptions))
        .rejects.toMatchObject({
          code: 'INVALID_TWEET',
          message: 'Tweet text exceeds 280 character limit',
          retryable: false
        });
    });

    it('should handle API errors during tweet posting', async () => {
      setupFetchMock([TwitterMockScenarios.duplicateTweet]);

      const tweetOptions: TweetOptions = {
        text: 'This is a duplicate tweet'
      };

      await expect(twitterService.postTweet(tweetOptions))
        .rejects.toMatchObject({
          code: 'TWEET_FAILED',
          message: mockTwitterDuplicateErrorResponse.errors[0].message,
          retryable: false
        });
    });

    it('should handle rate limiting during tweet posting', async () => {
      setupFetchMock([TwitterMockScenarios.rateLimitExceeded]);

      const tweetOptions: TweetOptions = {
        text: 'This tweet will be rate limited'
      };

      await expect(twitterService.postTweet(tweetOptions))
        .rejects.toMatchObject({
          code: 'RATE_LIMIT_EXCEEDED'
        });
    });

    it('should handle reply tweets', async () => {
      setupFetchMock([TwitterMockScenarios.postTweetSuccess]);

      const replyOptions: TweetOptions = {
        text: 'This is a reply',
        replyTo: '1234567890123456789'
      };

      await twitterService.postTweet(replyOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twitter.com/2/tweets',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"in_reply_to_tweet_id":"1234567890123456789"')
        })
      );
    });

    it('should handle quote tweets', async () => {
      setupFetchMock([TwitterMockScenarios.postTweetSuccess]);

      const quoteOptions: TweetOptions = {
        text: 'Quoting this tweet',
        quoteTweet: '1234567890123456789'
      };

      await twitterService.postTweet(quoteOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twitter.com/2/tweets',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"quote_tweet_id":"1234567890123456789"')
        })
      );
    });
  });

  describe('Media Upload', () => {
    it('should upload media successfully', async () => {
      setupFetchMock([
        TwitterMockScenarios.mediaUploadInit,
        TwitterMockScenarios.mediaUploadAppend,
        TwitterMockScenarios.mediaUploadFinalize
      ]);

      const mediaOptions = {
        data: Buffer.from('fake-image-data'),
        mediaType: 'image/jpeg' as const,
        altText: 'Test image'
      };

      const result = await twitterService['uploadMedia']([mediaOptions]);

      expect(result).toEqual([mockMediaUploadInitResponse.media_id_string]);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Init, append, finalize
    });

    it('should handle media processing', async () => {
      setupFetchMock([
        TwitterMockScenarios.mediaUploadInit,
        TwitterMockScenarios.mediaUploadAppend,
        {
          ...TwitterMockScenarios.mediaUploadFinalize,
          response: {
            ...mockMediaUploadFinalizeResponse,
            processing_info: {
              state: 'in_progress',
              check_after_secs: 1
            }
          }
        },
        TwitterMockScenarios.mediaProcessingInProgress,
        TwitterMockScenarios.mediaProcessingComplete
      ]);

      const mediaOptions = {
        data: Buffer.from('fake-video-data'),
        mediaType: 'video/mp4' as const
      };

      const result = await twitterService['uploadMedia']([mediaOptions]);

      expect(result).toEqual([mockMediaUploadInitResponse.media_id_string]);
      expect(mockFetch).toHaveBeenCalledTimes(5); // Init, append, finalize, status check, final status
    });

    it('should handle media processing failure', async () => {
      setupFetchMock([
        TwitterMockScenarios.mediaUploadInit,
        TwitterMockScenarios.mediaUploadAppend,
        {
          ...TwitterMockScenarios.mediaUploadFinalize,
          response: {
            ...mockMediaUploadFinalizeResponse,
            processing_info: {
              state: 'in_progress',
              check_after_secs: 1
            }
          }
        },
        TwitterMockScenarios.mediaProcessingFailed
      ]);

      const mediaOptions = {
        data: Buffer.from('fake-video-data'),
        mediaType: 'video/mp4' as const
      };

      await expect(twitterService['uploadMedia']([mediaOptions]))
        .rejects.toMatchObject({
          code: 'MEDIA_PROCESSING_FAILED',
          message: 'Media processing failed'
        });
    });

    it('should handle media upload errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
        json: () => Promise.resolve({
          errors: [{ message: 'Invalid media type' }]
        })
      });

      const mediaOptions = {
        data: Buffer.from('invalid-data'),
        mediaType: 'image/jpeg' as const
      };

      await expect(twitterService['uploadMedia']([mediaOptions]))
        .rejects.toThrow();
    });

    it('should add alt text to uploaded media', async () => {
      setupFetchMock([
        TwitterMockScenarios.mediaUploadInit,
        TwitterMockScenarios.mediaUploadAppend,
        TwitterMockScenarios.mediaUploadFinalize,
        {
          url: 'https://upload.twitter.com/1.1/media/metadata/create.json',
          method: 'POST',
          response: '', // Success response
          status: 200
        }
      ]);

      const mediaOptions = {
        data: Buffer.from('fake-image-data'),
        mediaType: 'image/jpeg' as const,
        altText: 'Detailed alt text for accessibility'
      };

      await twitterService['uploadMedia']([mediaOptions]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://upload.twitter.com/1.1/media/metadata/create.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('"alt_text":{"text":"Detailed alt text for accessibility"}')
        })
      );
    });

    it('should handle alt text upload failure gracefully', async () => {
      setupFetchMock([
        TwitterMockScenarios.mediaUploadInit,
        TwitterMockScenarios.mediaUploadAppend,
        TwitterMockScenarios.mediaUploadFinalize,
        {
          url: 'https://upload.twitter.com/1.1/media/metadata/create.json',
          method: 'POST',
          response: { error: 'Alt text failed' },
          status: 400
        }
      ]);

      const mediaOptions = {
        data: Buffer.from('fake-image-data'),
        mediaType: 'image/jpeg' as const,
        altText: 'Alt text that will fail'
      };

      // Should not throw error, just log warning
      const result = await twitterService['uploadMedia']([mediaOptions]);
      expect(result).toEqual([mockMediaUploadInitResponse.media_id_string]);
    });
  });

  describe('Rate Limiting', () => {
    it('should update rate limit info from response headers', async () => {
      const headers = createMockRateLimitHeaders(25, 50);
      setupFetchMock([{
        ...TwitterMockScenarios.authenticateSuccess,
        headers
      }]);

      await twitterService.testConnection();

      const rateLimitInfo = twitterService.getRateLimitInfo();
      expect(rateLimitInfo?.remaining).toBe(25);
      expect(rateLimitInfo?.limit).toBe(50);
    });

    it('should warn when rate limit is low', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const headers = createMockRateLimitHeaders(5, 50); // Low remaining

      setupFetchMock([{
        ...TwitterMockScenarios.authenticateSuccess,
        headers
      }]);

      await twitterService.testConnection();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit running low: 5/50 remaining')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('OAuth Headers', () => {
    it('should generate OAuth headers', async () => {
      setupFetchMock([TwitterMockScenarios.authenticateSuccess]);

      await twitterService.testConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('OAuth')
          })
        })
      );
    });

    it('should include required OAuth parameters', async () => {
      setupFetchMock([TwitterMockScenarios.authenticateSuccess]);

      await twitterService.testConnection();

      const authHeader = mockFetch.mock.calls[0][1].headers.Authorization;
      expect(authHeader).toContain('oauth_consumer_key=');
      expect(authHeader).toContain('oauth_nonce=');
      expect(authHeader).toContain('oauth_signature_method="HMAC-SHA1"');
      expect(authHeader).toContain('oauth_timestamp=');
      expect(authHeader).toContain('oauth_token=');
      expect(authHeader).toContain('oauth_version="1.0"');
    });

    it('should generate unique nonce for each request', () => {
      const nonce1 = twitterService['generateNonce']();
      const nonce2 = twitterService['generateNonce']();

      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toHaveLength(32);
      expect(nonce2).toHaveLength(32);
    });
  });

  describe('Twitter-Specific Error Handling', () => {
    it('should handle Twitter authentication errors', async () => {
      const errorResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map(),
        json: () => Promise.resolve({
          errors: [{ code: 32, message: 'Could not authenticate you' }]
        })
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(twitterService['makeRequest']('https://api.twitter.com/2/test'))
        .rejects.toMatchObject({
          code: 'AUTHENTICATION_FAILED',
          message: 'Could not authenticate you',
          retryable: false
        });
    });

    it('should handle Twitter rate limit errors', async () => {
      const errorResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map(),
        json: () => Promise.resolve({
          errors: [{ code: 88, message: 'Rate limit exceeded' }]
        })
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(twitterService['makeRequest']('https://api.twitter.com/2/test'))
        .rejects.toMatchObject({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          retryable: true
        });
    });

    it('should handle Twitter token errors', async () => {
      const errorResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map(),
        json: () => Promise.resolve({
          errors: [{ code: 89, message: 'Invalid or expired token' }]
        })
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(twitterService['makeRequest']('https://api.twitter.com/2/test'))
        .rejects.toMatchObject({
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
          retryable: false
        });
    });

    it('should handle Twitter tweet length errors', async () => {
      const errorResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
        json: () => Promise.resolve({
          errors: [{ code: 186, message: 'Tweet needs to be a bit shorter.' }]
        })
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(twitterService['makeRequest']('https://api.twitter.com/2/test'))
        .rejects.toMatchObject({
          code: 'TWEET_TOO_LONG',
          message: 'Tweet exceeds character limit',
          retryable: false
        });
    });

    it('should handle Twitter duplicate status errors', async () => {
      const errorResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Map(),
        json: () => Promise.resolve({
          errors: [{ code: 187, message: 'Status is a duplicate' }]
        })
      };

      mockFetch.mockResolvedValueOnce(errorResponse);

      await expect(twitterService['makeRequest']('https://api.twitter.com/2/test'))
        .rejects.toMatchObject({
          code: 'DUPLICATE_TWEET',
          message: 'Status is a duplicate',
          retryable: false
        });
    });
  });

  describe('Multipart Form Data', () => {
    it('should create multipart form data correctly', () => {
      const fields = {
        command: 'APPEND',
        media_id: '123456789',
        segment_index: '0',
        media: Buffer.from('test-data')
      };

      const formData = twitterService['createMultipartFormData'](fields);

      expect(formData).toBeInstanceOf(FormData);
      // Note: FormData doesn't have easy inspection methods in Node.js test environment
      // In a real browser environment, you could inspect the FormData contents
    });

    it('should handle different field types in form data', () => {
      const fields = {
        stringField: 'test-string',
        numberField: 123,
        booleanField: true,
        bufferField: Buffer.from('test-buffer'),
        uint8ArrayField: new Uint8Array([1, 2, 3, 4])
      };

      const formData = twitterService['createMultipartFormData'](fields);
      expect(formData).toBeInstanceOf(FormData);
    });
  });
});