/**
 * Test data fixtures for consistent testing
 */

import type { 
  TwitterCredentials, 
  TweetOptions, 
  TwitterMediaOptions 
} from '../../src/services/twitter';
import type { 
  SocialMediaPluginOptions,
  MessageTemplate,
  SocialMediaSettings 
} from '../../src/types';

/**
 * Sample post data for testing
 */
export const samplePostData = {
  basic: {
    id: 'post-123',
    title: 'Introduction to PayloadCMS Social Media Plugin',
    slug: 'intro-payloadcms-social-media-plugin',
    excerpt: 'Learn how to integrate social media posting with your PayloadCMS applications using our new plugin.',
    content: [
      {
        type: 'paragraph',
        children: [
          { 
            text: 'The PayloadCMS Social Media Plugin makes it easy to automatically share your content across social platforms. This comprehensive guide will walk you through the setup and configuration process.' 
          }
        ]
      }
    ],
    author: {
      name: 'Sarah Johnson',
      email: 'sarah@example.com'
    },
    publishedAt: '2024-01-15T10:00:00.000Z',
    status: 'published',
    url: 'https://example.com/blog/intro-payloadcms-social-media-plugin'
  },

  withMedia: {
    id: 'post-124',
    title: 'Advanced Social Media Integration Tips',
    slug: 'advanced-social-media-integration-tips',
    excerpt: 'Discover advanced techniques for maximizing your social media reach with PayloadCMS.',
    content: [
      {
        type: 'paragraph',
        children: [
          { text: 'Advanced social media integration requires careful planning and strategy.' }
        ]
      }
    ],
    author: {
      name: 'Mike Chen',
      email: 'mike@example.com'
    },
    publishedAt: '2024-01-16T14:30:00.000Z',
    status: 'published',
    url: 'https://example.com/blog/advanced-social-media-integration-tips',
    featuredImage: {
      url: 'https://example.com/images/social-media-tips.jpg',
      alt: 'Social media integration tips infographic',
      width: 1200,
      height: 630
    }
  },

  longTitle: {
    id: 'post-125',
    title: 'This is an extremely long title that exceeds the typical character limits for most social media platforms and should be truncated appropriately when posting',
    slug: 'extremely-long-title-post',
    excerpt: 'Testing how the plugin handles very long titles that need to be shortened for social media posts.',
    content: [
      {
        type: 'paragraph',
        children: [
          { text: 'This post tests title truncation functionality.' }
        ]
      }
    ],
    author: {
      name: 'Test Author',
      email: 'test@example.com'
    },
    publishedAt: '2024-01-17T09:15:00.000Z',
    status: 'published',
    url: 'https://example.com/blog/extremely-long-title-post'
  },

  draft: {
    id: 'post-126',
    title: 'Draft Post for Testing',
    slug: 'draft-post-testing',
    excerpt: 'This is a draft post that should not be automatically shared.',
    content: [
      {
        type: 'paragraph',
        children: [
          { text: 'Draft content that is still being worked on.' }
        ]
      }
    ],
    author: {
      name: 'Editor User',
      email: 'editor@example.com'
    },
    status: 'draft',
    updatedAt: '2024-01-18T11:45:00.000Z'
  }
};

/**
 * Sample Twitter credentials for testing
 */
export const sampleTwitterCredentials: TwitterCredentials = {
  apiKey: 'test_api_key_1234567890',
  apiSecret: 'test_api_secret_abcdefghijklmnopqrstuvwxyz',
  accessToken: 'test_access_token_9876543210',
  accessTokenSecret: 'test_access_token_secret_zyxwvutsrqponm',
  bearerToken: 'test_bearer_token_AAAAAAAAAAAAAAAAAAAAAA'
};

/**
 * Sample LinkedIn credentials for testing
 */
export const sampleLinkedInCredentials = {
  accessToken: 'test_linkedin_access_token_abc123def456',
  organizationId: 'test_org_789012345'
};

/**
 * Sample tweet options for testing
 */
export const sampleTweetOptions: TweetOptions = {
  text: 'Check out our latest blog post: Introduction to PayloadCMS Social Media Plugin https://example.com/blog/intro-payloadcms-social-media-plugin',
};

export const sampleTweetWithMedia: TweetOptions = {
  text: 'Advanced Social Media Integration Tips - discover techniques for maximizing your reach! https://example.com/blog/advanced-social-media-integration-tips',
  media: [
    {
      data: Buffer.from('fake-image-data'),
      mediaType: 'image/jpeg',
      altText: 'Social media integration tips infographic'
    }
  ]
};

export const sampleLongTweet: TweetOptions = {
  text: 'This is a very long tweet that exceeds the 280 character limit set by Twitter and should trigger validation errors in our service implementation. It contains way too much text for a single tweet and needs to be handled appropriately by our error handling system.'
};

/**
 * Sample media options for testing
 */
export const sampleTwitterMedia: TwitterMediaOptions = {
  data: Buffer.from('fake-jpeg-data'),
  mediaType: 'image/jpeg',
  altText: 'Test image for social media posting'
};

export const sampleTwitterVideo: TwitterMediaOptions = {
  data: Buffer.from('fake-video-data'),
  mediaType: 'video/mp4',
  altText: 'Test video for social media posting'
};

/**
 * Sample message templates for testing
 */
export const sampleMessageTemplates: MessageTemplate[] = [
  {
    name: 'Blog Post',
    template: 'New blog post: {{title}}\n\n{{excerpt}}\n\nRead more: {{url}}',
    enabled: true,
    description: 'Standard template for blog posts',
    variables: ['title', 'excerpt', 'url']
  },
  {
    name: 'Product Launch',
    template: '🚀 Exciting news! We\'re launching {{title}}!\n\n{{excerpt}}\n\nLearn more: {{url}} #product #launch',
    enabled: true,
    description: 'Template for product launches with emojis and hashtags',
    variables: ['title', 'excerpt', 'url']
  },
  {
    name: 'Event Announcement',
    template: '📅 Join us for {{title}} on {{date}}!\n\n{{excerpt}}\n\nRegister: {{url}} #event',
    enabled: true,
    description: 'Template for event announcements',
    variables: ['title', 'excerpt', 'url', 'date']
  },
  {
    name: 'Simple Share',
    template: '{{title}} {{url}}',
    enabled: true,
    description: 'Minimal template with just title and URL',
    variables: ['title', 'url']
  },
  {
    name: 'Disabled Template',
    template: 'This template is disabled: {{title}}',
    enabled: false,
    description: 'Template that should not be used',
    variables: ['title']
  }
];

/**
 * Sample plugin configuration for testing
 */
export const samplePluginOptions: SocialMediaPluginOptions = {
  platforms: {
    twitter: {
      enabled: true,
      displayName: 'Twitter',
      icon: '🐦',
      apiUrl: 'https://api.twitter.com/2',
      bearerToken: 'test_bearer_token',
      characterLimit: 280,
      allowMedia: true
    },
    linkedin: {
      enabled: true,
      displayName: 'LinkedIn',
      icon: '💼',
      apiUrl: 'https://api.linkedin.com/v2',
      accessToken: 'test_linkedin_token',
      postAsOrganization: false
    }
  },
  collections: {
    posts: {
      name: 'posts',
      label: 'Blog Posts',
      platforms: ['twitter', 'linkedin'],
      required: false,
      templates: sampleMessageTemplates,
      admin: {
        position: 'sidebar',
        description: 'Share this post on social media'
      }
    },
    products: {
      name: 'products',
      label: 'Products',
      platforms: ['twitter', 'linkedin'],
      required: false,
      admin: {
        position: 'main'
      }
    }
  },
  messageTemplates: sampleMessageTemplates,
  shareButtons: {
    platforms: ['twitter', 'linkedin'],
    position: 'bottom',
    styling: {
      size: 'medium',
      variant: 'filled',
      borderRadius: 4
    },
    showAnalytics: true
  },
  analytics: {
    enabled: true,
    provider: 'internal',
    trackClicks: true,
    trackViews: true,
    customEvents: ['share_completed', 'share_failed']
  },
  rateLimit: {
    maxRequests: 50,
    windowMs: 900000,
    strategy: 'queue'
  },
  endpoints: {
    basePath: '/api/social-media',
    webhooks: true,
    authentication: 'api-key'
  },
  debug: false
};

/**
 * Sample social media settings for testing
 */
export const sampleSocialMediaSettings: SocialMediaSettings = {
  id: 'social-media-settings',
  platforms: {
    twitter: {
      enabled: true,
      apiKey: 'encrypted_api_key',
      apiSecret: 'encrypted_api_secret',
      accessToken: 'encrypted_access_token',
      accessTokenSecret: 'encrypted_access_token_secret',
      bearerToken: 'encrypted_bearer_token',
      characterLimit: 280,
      allowMedia: true,
      defaultTemplate: 'Check out: {{title}} {{url}}'
    },
    linkedin: {
      enabled: true,
      accessToken: 'encrypted_linkedin_token',
      organizationId: 'test_org_123',
      postAsOrganization: false,
      defaultTemplate: 'New content: {{title}}\n\n{{excerpt}}\n\n{{url}}'
    }
  },
  messageTemplates: sampleMessageTemplates,
  shareButtons: {
    enabled: true,
    platforms: ['twitter', 'linkedin'],
    position: 'bottom',
    styling: {
      size: 'medium',
      variant: 'filled',
      borderRadius: 4
    }
  },
  analytics: {
    enabled: true,
    trackClicks: true,
    trackViews: false
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 900000
  },
  createdAt: '2024-01-15T08:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z'
};

/**
 * Sample encryption test data
 */
export const sampleEncryptionData = {
  plaintext: {
    short: 'test-api-key',
    medium: 'Bearer AAAAAAAAAAAAAAAAAAAAAPYXBAAAAAAArLW1T',
    long: 'very-long-api-key-with-lots-of-characters-that-tests-encryption-with-longer-strings-1234567890abcdefghijklmnopqrstuvwxyz',
    special: 'api-key-with-special-chars!@#$%^&*()_+-=[]{}|;:,.<>?',
    unicode: 'api-key-with-unicode-émojis-🔑-and-characters-αβγδε'
  },
  secrets: {
    valid: 'test-secret-key-for-encryption-testing-12345',
    short: 'short', // Too short, should fail
    empty: '', // Empty, should fail
    undefined: undefined as any // Undefined, should fail
  }
};

/**
 * Sample error scenarios for testing
 */
export const sampleErrors = {
  twitter: {
    authentication: {
      code: 32,
      message: 'Could not authenticate you.'
    },
    rateLimitExceeded: {
      code: 88,
      message: 'Rate limit exceeded'
    },
    duplicateStatus: {
      code: 187,
      message: 'Status is a duplicate'
    },
    tweetTooLong: {
      code: 186,
      message: 'Tweet needs to be a bit shorter.'
    },
    invalidToken: {
      code: 89,
      message: 'Invalid or expired token'
    }
  },
  linkedin: {
    unauthorized: {
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'The token used in the request is not valid'
    },
    forbidden: {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Not enough permissions to access this resource'
    },
    rateLimitExceeded: {
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Throttle limit exceeded'
    },
    validationError: {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed for one or more fields'
    }
  },
  network: {
    timeout: new Error('Request timed out'),
    connectionFailed: new Error('Network connection failed'),
    dnsError: new Error('DNS resolution failed')
  },
  payloadcms: {
    validation: {
      name: 'ValidationError',
      message: 'The following field is required: title',
      data: [
        {
          field: 'title',
          message: 'This field is required',
          value: undefined
        }
      ]
    },
    notFound: {
      name: 'NotFound',
      message: 'Document not found',
      status: 404
    },
    unauthorized: {
      name: 'Forbidden',
      message: 'You are not allowed to perform this action',
      status: 403
    }
  }
};

/**
 * Sample rate limit scenarios for testing
 */
export const sampleRateLimits = {
  twitter: {
    normal: {
      remaining: 299,
      limit: 300,
      reset: Math.floor(Date.now() / 1000) + 900
    },
    nearLimit: {
      remaining: 5,
      limit: 300,
      reset: Math.floor(Date.now() / 1000) + 900
    },
    exceeded: {
      remaining: 0,
      limit: 300,
      reset: Math.floor(Date.now() / 1000) + 900
    }
  },
  linkedin: {
    normal: {
      remaining: 99,
      limit: 100,
      reset: Math.floor(Date.now() / 1000) + 3600
    },
    nearLimit: {
      remaining: 2,
      limit: 100,
      reset: Math.floor(Date.now() / 1000) + 3600
    },
    exceeded: {
      remaining: 0,
      limit: 100,
      reset: Math.floor(Date.now() / 1000) + 3600
    }
  }
};

export default {
  samplePostData,
  sampleTwitterCredentials,
  sampleLinkedInCredentials,
  sampleTweetOptions,
  sampleMessageTemplates,
  samplePluginOptions,
  sampleSocialMediaSettings,
  sampleEncryptionData,
  sampleErrors,
  sampleRateLimits
};