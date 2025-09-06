/**
 * PayloadCMS-specific mocks for testing
 */

import type { Config } from 'payload';
import type { SocialMediaSettings } from '../../src/types';

/**
 * Mock PayloadCMS Config
 */
export const mockPayloadConfig: Partial<Config> = {
  secret: 'test-secret-key-for-encryption-testing-12345',
  collections: [
    {
      slug: 'posts',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true
        },
        {
          name: 'content',
          type: 'richText',
          required: true
        },
        {
          name: 'slug',
          type: 'text',
          required: true
        },
        {
          name: 'excerpt',
          type: 'textarea'
        },
        {
          name: 'publishedAt',
          type: 'date'
        }
      ]
    },
    {
      slug: 'pages',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true
        },
        {
          name: 'content',
          type: 'richText',
          required: true
        },
        {
          name: 'slug',
          type: 'text',
          required: true
        }
      ]
    }
  ],
  globals: [
    {
      slug: 'social-media-settings',
      fields: []
    }
  ],
  custom: {
    socialMediaPlugin: {
      platforms: {
        twitter: {
          enabled: true,
          displayName: 'Twitter',
          icon: '🐦',
          characterLimit: 280,
          allowMedia: true
        },
        linkedin: {
          enabled: true,
          displayName: 'LinkedIn',
          icon: '💼',
          postAsOrganization: false
        }
      },
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
        enabled: false,
        trackClicks: true,
        trackViews: false
      },
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000,
        strategy: 'queue'
      },
      endpoints: {
        basePath: '/api/social-media',
        webhooks: false,
        authentication: 'none'
      },
      debug: false
    }
  }
};

/**
 * Mock PayloadCMS Request object
 */
export const createMockPayloadRequest = (overrides: any = {}) => {
  const baseRequest = {
    payload: {
      secret: mockPayloadConfig.secret,
      config: mockPayloadConfig,
      logger: console,
      
      // Database operations
      find: jest.fn(),
      findByID: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateByID: jest.fn(),
      delete: jest.fn(),
      deleteByID: jest.fn(),
      
      // Global operations
      findGlobal: jest.fn(),
      updateGlobal: jest.fn(),
      
      // Auth operations
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      unlock: jest.fn(),
      verify: jest.fn(),
      login: jest.fn(),
      logout: jest.fn()
    },
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'admin',
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z'
    },
    collection: {
      config: {
        slug: 'posts',
        labels: {
          singular: 'Post',
          plural: 'Posts'
        }
      }
    },
    data: {},
    files: {},
    headers: {},
    method: 'GET',
    query: {},
    params: {},
    url: '/admin',
    ...overrides
  };

  return baseRequest;
};

/**
 * Mock PayloadCMS Document
 */
export const createMockPayloadDocument = (collection: string = 'posts', overrides: any = {}) => {
  const baseDoc = {
    id: `${collection}-123`,
    collection,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    ...overrides
  };

  // Add collection-specific fields
  if (collection === 'posts') {
    return {
      ...baseDoc,
      title: 'Test Blog Post',
      slug: 'test-blog-post',
      content: [
        {
          type: 'paragraph',
          children: [
            { text: 'This is a test blog post content for social media integration testing.' }
          ]
        }
      ],
      excerpt: 'This is a test excerpt for the blog post.',
      author: {
        name: 'Test Author',
        email: 'author@example.com'
      },
      publishedAt: '2024-01-15T10:00:00.000Z',
      status: 'published',
      ...overrides
    };
  }

  if (collection === 'pages') {
    return {
      ...baseDoc,
      title: 'Test Page',
      slug: 'test-page',
      content: [
        {
          type: 'paragraph',
          children: [
            { text: 'This is a test page content.' }
          ]
        }
      ],
      status: 'published',
      ...overrides
    };
  }

  return baseDoc;
};

/**
 * Mock Social Media Settings Global
 */
export const createMockSocialMediaSettings = (overrides: Partial<SocialMediaSettings> = {}): SocialMediaSettings => ({
  id: 'social-media-settings',
  platforms: {
    twitter: {
      enabled: true,
      apiKey: 'encrypted-api-key',
      apiSecret: 'encrypted-api-secret',
      accessToken: 'encrypted-access-token',
      accessTokenSecret: 'encrypted-access-token-secret',
      bearerToken: 'encrypted-bearer-token',
      characterLimit: 280,
      allowMedia: true,
      defaultTemplate: 'Check out: {{title}} {{url}}'
    },
    linkedin: {
      enabled: true,
      accessToken: 'encrypted-linkedin-access-token',
      organizationId: 'test-org-123',
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
    },
    {
      name: 'Product Launch',
      template: '🚀 Exciting news! We\'re launching {{title}}!\n\n{{excerpt}}\n\nLearn more: {{url}} #product #launch',
      enabled: true,
      description: 'Template for product launches',
      variables: ['title', 'excerpt', 'url']
    }
  ],
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
    enabled: false,
    trackClicks: true,
    trackViews: false
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 900000
  },
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
  ...overrides
});

/**
 * Mock PayloadCMS Field Types
 */
export const mockTextField = {
  name: 'title',
  type: 'text' as const,
  required: true,
  label: 'Title',
  admin: {
    description: 'Enter the title for this content'
  }
};

export const mockTextareaField = {
  name: 'excerpt',
  type: 'textarea' as const,
  label: 'Excerpt',
  admin: {
    description: 'Brief description or excerpt'
  }
};

export const mockRichTextField = {
  name: 'content',
  type: 'richText' as const,
  required: true,
  label: 'Content',
  admin: {
    description: 'Main content for this item'
  }
};

export const mockSelectField = {
  name: 'status',
  type: 'select' as const,
  options: [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ],
  defaultValue: 'draft',
  label: 'Status'
};

/**
 * Mock PayloadCMS Collection Configuration
 */
export const createMockCollection = (slug: string, overrides: any = {}) => ({
  slug,
  labels: {
    singular: slug.charAt(0).toUpperCase() + slug.slice(1, -1),
    plural: slug.charAt(0).toUpperCase() + slug.slice(1)
  },
  admin: {
    useAsTitle: 'title',
    group: 'Content'
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true
  },
  fields: [
    mockTextField,
    mockTextareaField,
    mockRichTextField,
    mockSelectField
  ],
  ...overrides
});

/**
 * Mock PayloadCMS Hook Contexts
 */
export const createMockBeforeChangeContext = (data: any = {}, overrides: any = {}) => ({
  data: {
    title: 'Test Document',
    slug: 'test-document',
    content: 'Test content',
    ...data
  },
  req: createMockPayloadRequest(),
  operation: 'create' as const,
  originalDoc: {},
  ...overrides
});

export const createMockAfterChangeContext = (doc: any = {}, overrides: any = {}) => ({
  doc: {
    id: 'test-doc-123',
    title: 'Test Document',
    slug: 'test-document',
    content: 'Test content',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    ...doc
  },
  req: createMockPayloadRequest(),
  operation: 'create' as const,
  previousDoc: {},
  ...overrides
});

export const createMockAfterReadContext = (doc: any = {}, overrides: any = {}) => ({
  doc: {
    id: 'test-doc-123',
    title: 'Test Document',
    slug: 'test-document',
    content: 'Test content',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    ...doc
  },
  req: createMockPayloadRequest(),
  ...overrides
});

/**
 * PayloadCMS Mock Response Helpers
 */
export const createMockFindResponse = <T>(docs: T[], totalDocs: number = docs.length) => ({
  docs,
  totalDocs,
  limit: 10,
  totalPages: Math.ceil(totalDocs / 10),
  page: 1,
  pagingCounter: 1,
  hasPrevPage: false,
  hasNextPage: totalDocs > 10,
  prevPage: null,
  nextPage: totalDocs > 10 ? 2 : null
});

export const createMockCreateResponse = <T>(doc: T) => doc;

export const createMockUpdateResponse = <T>(doc: T) => doc;

export const createMockDeleteResponse = (id: string) => ({ id });

/**
 * Common PayloadCMS error mocks
 */
export const mockPayloadValidationError = {
  name: 'ValidationError',
  message: 'The following field is required: title',
  data: [
    {
      field: 'title',
      message: 'This field is required',
      value: undefined
    }
  ]
};

export const mockPayloadNotFoundError = {
  name: 'NotFound',
  message: 'Document not found',
  status: 404
};

export const mockPayloadUnauthorizedError = {
  name: 'Forbidden',
  message: 'You are not allowed to perform this action',
  status: 403
};

/**
 * Mock database operations for testing
 */
export const setupPayloadMocks = () => {
  const mockPayload = {
    find: jest.fn(),
    findByID: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateByID: jest.fn(),
    delete: jest.fn(),
    deleteByID: jest.fn(),
    findGlobal: jest.fn(),
    updateGlobal: jest.fn(),
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }
  };

  // Setup default successful responses
  mockPayload.findGlobal.mockResolvedValue(createMockSocialMediaSettings());
  mockPayload.find.mockResolvedValue(createMockFindResponse([createMockPayloadDocument()]));
  mockPayload.findByID.mockResolvedValue(createMockPayloadDocument());
  mockPayload.create.mockResolvedValue(createMockPayloadDocument());
  mockPayload.update.mockResolvedValue(createMockPayloadDocument());
  mockPayload.updateByID.mockResolvedValue(createMockPayloadDocument());
  mockPayload.updateGlobal.mockResolvedValue(createMockSocialMediaSettings());
  mockPayload.delete.mockResolvedValue(createMockDeleteResponse('test-doc-123'));
  mockPayload.deleteByID.mockResolvedValue(createMockDeleteResponse('test-doc-123'));

  return mockPayload;
};

export default {
  createMockPayloadRequest,
  createMockPayloadDocument,
  createMockSocialMediaSettings,
  createMockCollection,
  createMockBeforeChangeContext,
  createMockAfterChangeContext,
  createMockAfterReadContext,
  createMockFindResponse,
  setupPayloadMocks
};