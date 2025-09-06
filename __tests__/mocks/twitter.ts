/**
 * Twitter API response mocks for testing
 */

import type { TwitterApiResponse, TwitterUser, TwitterTweet, TwitterMedia } from '../../src/services/twitter';

export const mockTwitterUser: TwitterUser = {
  id: '123456789',
  username: 'testuser',
  name: 'Test User',
  verified: false,
  profile_image_url: 'https://pbs.twimg.com/profile_images/123/test.jpg',
  public_metrics: {
    followers_count: 1000,
    following_count: 500,
    tweet_count: 2500,
    listed_count: 10
  }
};

export const mockTwitterTweet: TwitterTweet = {
  id: '1234567890123456789',
  text: 'This is a test tweet from PayloadCMS Social Media Plugin',
  created_at: '2024-01-15T10:30:00.000Z',
  author_id: '123456789',
  public_metrics: {
    retweet_count: 5,
    like_count: 25,
    reply_count: 3,
    quote_count: 1
  }
};

export const mockTwitterTweetWithMedia: TwitterTweet = {
  ...mockTwitterTweet,
  id: '1234567890123456790',
  text: 'This is a test tweet with media',
  attachments: {
    media_keys: ['3_1234567890123456789']
  }
};

export const mockTwitterMedia: TwitterMedia = {
  media_key: '3_1234567890123456789',
  type: 'photo',
  url: 'https://pbs.twimg.com/media/test-image.jpg',
  width: 1200,
  height: 800,
  alt_text: 'Test image description'
};

export const mockTwitterUserResponse: TwitterApiResponse<TwitterUser> = {
  data: mockTwitterUser
};

export const mockTwitterTweetResponse: TwitterApiResponse<TwitterTweet> = {
  data: mockTwitterTweet,
  includes: {
    users: [mockTwitterUser]
  }
};

export const mockTwitterTweetWithMediaResponse: TwitterApiResponse<TwitterTweet> = {
  data: mockTwitterTweetWithMedia,
  includes: {
    users: [mockTwitterUser],
    media: [mockTwitterMedia]
  }
};

export const mockTwitterErrorResponse = {
  errors: [
    {
      code: 32,
      message: 'Could not authenticate you.',
      resource_type: 'user',
      parameter: 'oauth_consumer_key'
    }
  ]
};

export const mockTwitterRateLimitErrorResponse = {
  errors: [
    {
      code: 88,
      message: 'Rate limit exceeded',
      resource_type: 'application'
    }
  ]
};

export const mockTwitterDuplicateErrorResponse = {
  errors: [
    {
      code: 187,
      message: 'Status is a duplicate',
      resource_type: 'tweet'
    }
  ]
};

export const mockTwitterTooLongErrorResponse = {
  errors: [
    {
      code: 186,
      message: 'Tweet needs to be a bit shorter.',
      parameter: 'text'
    }
  ]
};

export const mockMediaUploadInitResponse = {
  media_id: 1234567890123456789,
  media_id_string: '1234567890123456789',
  expires_after_secs: 86400
};

export const mockMediaUploadFinalizeResponse = {
  media_id: 1234567890123456789,
  media_id_string: '1234567890123456789',
  media_key: '3_1234567890123456789',
  size: 1024000,
  expires_after_secs: 86400,
  image: {
    image_type: 'image/jpeg',
    w: 1200,
    h: 800
  }
};

export const mockMediaUploadProcessingResponse = {
  media_id: 1234567890123456789,
  media_id_string: '1234567890123456789',
  processing_info: {
    state: 'in_progress',
    check_after_secs: 5,
    progress_percent: 50
  }
};

export const mockMediaUploadCompleteResponse = {
  media_id: 1234567890123456789,
  media_id_string: '1234567890123456789',
  processing_info: {
    state: 'succeeded'
  }
};

export const mockMediaUploadFailedResponse = {
  media_id: 1234567890123456789,
  media_id_string: '1234567890123456789',
  processing_info: {
    state: 'failed',
    error: {
      code: 1,
      message: 'Media processing failed'
    }
  }
};

/**
 * Helper functions to create Twitter mock responses
 */
export const createMockTwitterResponse = <T>(data: T, includes?: any): TwitterApiResponse<T> => ({
  data,
  ...(includes && { includes })
});

export const createMockTwitterError = (code: number, message: string) => ({
  errors: [{ code, message }]
});

export const createMockRateLimitHeaders = (remaining: number = 15, limit: number = 15, reset?: number) => ({
  'x-rate-limit-remaining': remaining.toString(),
  'x-rate-limit-limit': limit.toString(),
  'x-rate-limit-reset': (reset || Math.floor(Date.now() / 1000) + 900).toString()
});

/**
 * Complete Twitter API mock scenarios
 */
export const TwitterMockScenarios = {
  // Successful authentication
  authenticateSuccess: {
    url: 'https://api.twitter.com/2/users/me',
    method: 'GET',
    response: mockTwitterUserResponse,
    status: 200,
    headers: createMockRateLimitHeaders(14, 15)
  },

  // Authentication failure
  authenticateFailure: {
    url: 'https://api.twitter.com/2/users/me',
    method: 'GET',
    response: mockTwitterErrorResponse,
    status: 401,
    headers: createMockRateLimitHeaders(14, 15)
  },

  // Successful tweet posting
  postTweetSuccess: {
    url: 'https://api.twitter.com/2/tweets',
    method: 'POST',
    response: mockTwitterTweetResponse,
    status: 201,
    headers: createMockRateLimitHeaders(299, 300)
  },

  // Tweet with media success
  postTweetWithMediaSuccess: {
    url: 'https://api.twitter.com/2/tweets',
    method: 'POST',
    response: mockTwitterTweetWithMediaResponse,
    status: 201,
    headers: createMockRateLimitHeaders(299, 300)
  },

  // Rate limit exceeded
  rateLimitExceeded: {
    url: /api\.twitter\.com/,
    response: mockTwitterRateLimitErrorResponse,
    status: 429,
    headers: createMockRateLimitHeaders(0, 300, Math.floor(Date.now() / 1000) + 900)
  },

  // Duplicate tweet
  duplicateTweet: {
    url: 'https://api.twitter.com/2/tweets',
    method: 'POST',
    response: mockTwitterDuplicateErrorResponse,
    status: 403
  },

  // Tweet too long
  tweetTooLong: {
    url: 'https://api.twitter.com/2/tweets',
    method: 'POST',
    response: mockTwitterTooLongErrorResponse,
    status: 400
  },

  // Media upload scenarios
  mediaUploadInit: {
    url: 'https://upload.twitter.com/1.1/media/upload.json',
    method: 'POST',
    response: mockMediaUploadInitResponse,
    status: 200
  },

  mediaUploadAppend: {
    url: 'https://upload.twitter.com/1.1/media/upload.json',
    method: 'POST',
    response: '', // Empty response for APPEND
    status: 204
  },

  mediaUploadFinalize: {
    url: 'https://upload.twitter.com/1.1/media/upload.json',
    method: 'POST',
    response: mockMediaUploadFinalizeResponse,
    status: 200
  },

  mediaProcessingInProgress: {
    url: /upload\.twitter\.com.*command=STATUS/,
    method: 'GET',
    response: mockMediaUploadProcessingResponse,
    status: 200,
    delay: 100 // Simulate processing time
  },

  mediaProcessingComplete: {
    url: /upload\.twitter\.com.*command=STATUS/,
    method: 'GET',
    response: mockMediaUploadCompleteResponse,
    status: 200
  },

  mediaProcessingFailed: {
    url: /upload\.twitter\.com.*command=STATUS/,
    method: 'GET',
    response: mockMediaUploadFailedResponse,
    status: 200
  },

  // Network errors
  networkError: {
    url: /api\.twitter\.com/,
    response: new Error('Network connection failed'),
    status: 0
  },

  // Server errors
  serverError: {
    url: /api\.twitter\.com/,
    response: { error: 'Internal server error' },
    status: 500,
    headers: createMockRateLimitHeaders(299, 300)
  }
};