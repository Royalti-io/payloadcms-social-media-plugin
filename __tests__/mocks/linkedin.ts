/**
 * LinkedIn API response mocks for testing
 */

export interface LinkedInProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  profilePicture?: {
    displayImage: string;
  };
}

export interface LinkedInOrganization {
  id: string;
  name: {
    localized: {
      [key: string]: string;
    };
  };
  localizedName: string;
}

export interface LinkedInPost {
  id: string;
  urn: string;
  created: {
    time: number;
    actor: string;
  };
  text: {
    text: string;
  };
  content?: {
    media?: {
      id: string;
      mediaType: string;
    }[];
  };
  lifecycleState: 'PUBLISHED' | 'DRAFT';
}

export interface LinkedInApiResponse<T> {
  data?: T;
  elements?: T[];
  paging?: {
    count: number;
    start: number;
    total: number;
  };
  error?: {
    status: number;
    code: string;
    message: string;
  };
}

export const mockLinkedInProfile: LinkedInProfile = {
  id: 'abcd1234',
  localizedFirstName: 'Test',
  localizedLastName: 'User',
  profilePicture: {
    displayImage: 'https://media.licdn.com/dms/image/test/profile.jpg'
  }
};

export const mockLinkedInOrganization: LinkedInOrganization = {
  id: 'organization123',
  name: {
    localized: {
      'en_US': 'Test Organization'
    }
  },
  localizedName: 'Test Organization'
};

export const mockLinkedInPost: LinkedInPost = {
  id: 'activity:6789012345678901234',
  urn: 'urn:li:share:6789012345678901234',
  created: {
    time: Date.now(),
    actor: 'urn:li:person:abcd1234'
  },
  text: {
    text: 'This is a test LinkedIn post from PayloadCMS Social Media Plugin'
  },
  lifecycleState: 'PUBLISHED'
};

export const mockLinkedInPostWithMedia: LinkedInPost = {
  ...mockLinkedInPost,
  id: 'activity:6789012345678901235',
  urn: 'urn:li:share:6789012345678901235',
  text: {
    text: 'This is a test LinkedIn post with media'
  },
  content: {
    media: [
      {
        id: 'urn:li:digitalmediaAsset:D4D22AQF_test_image',
        mediaType: 'image'
      }
    ]
  }
};

export const mockLinkedInProfileResponse: LinkedInApiResponse<LinkedInProfile> = {
  data: mockLinkedInProfile
};

export const mockLinkedInOrganizationResponse: LinkedInApiResponse<LinkedInOrganization> = {
  data: mockLinkedInOrganization
};

export const mockLinkedInPostResponse: LinkedInApiResponse<LinkedInPost> = {
  data: mockLinkedInPost
};

export const mockLinkedInPostWithMediaResponse: LinkedInApiResponse<LinkedInPost> = {
  data: mockLinkedInPostWithMedia
};

export const mockLinkedInUnauthorizedError = {
  error: {
    status: 401,
    code: 'UNAUTHORIZED',
    message: 'The token used in the request is not valid'
  }
};

export const mockLinkedInForbiddenError = {
  error: {
    status: 403,
    code: 'FORBIDDEN',
    message: 'Not enough permissions to access this resource'
  }
};

export const mockLinkedInRateLimitError = {
  error: {
    status: 429,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Throttle limit exceeded'
  }
};

export const mockLinkedInValidationError = {
  error: {
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Validation failed for one or more fields'
  }
};

export const mockLinkedInInternalError = {
  error: {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An internal server error occurred'
  }
};

export const mockLinkedInMediaUploadResponse = {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: 'https://www.linkedin.com/dms-uploads/test-upload-url',
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      }
    },
    asset: 'urn:li:digitalmediaAsset:D4D22AQF_test_image',
    mediaArtifact: 'urn:li:digitalmediaMediaArtifact:(urn:li:digitalmediaAsset:D4D22AQF_test_image,test)'
  }
};

/**
 * Helper functions to create LinkedIn mock responses
 */
export const createMockLinkedInResponse = <T>(data: T): LinkedInApiResponse<T> => ({
  data
});

export const createMockLinkedInError = (status: number, code: string, message: string) => ({
  error: { status, code, message }
});

export const createMockLinkedInRateLimitHeaders = (remaining: number = 100, limit: number = 100) => ({
  'x-ratelimit-remaining': remaining.toString(),
  'x-ratelimit-limit': limit.toString()
});

/**
 * Complete LinkedIn API mock scenarios
 */
export const LinkedInMockScenarios = {
  // Successful profile fetch
  getProfileSuccess: {
    url: 'https://api.linkedin.com/v2/people/~',
    method: 'GET',
    response: mockLinkedInProfileResponse,
    status: 200,
    headers: createMockLinkedInRateLimitHeaders(99, 100)
  },

  // Successful organization fetch
  getOrganizationSuccess: {
    url: /api\.linkedin\.com.*organizations/,
    method: 'GET',
    response: mockLinkedInOrganizationResponse,
    status: 200,
    headers: createMockLinkedInRateLimitHeaders(99, 100)
  },

  // Authentication failure
  authenticateFailure: {
    url: /api\.linkedin\.com/,
    response: mockLinkedInUnauthorizedError,
    status: 401,
    headers: createMockLinkedInRateLimitHeaders(99, 100)
  },

  // Forbidden access
  forbiddenAccess: {
    url: /api\.linkedin\.com/,
    response: mockLinkedInForbiddenError,
    status: 403,
    headers: createMockLinkedInRateLimitHeaders(99, 100)
  },

  // Successful post creation
  createPostSuccess: {
    url: 'https://api.linkedin.com/v2/shares',
    method: 'POST',
    response: mockLinkedInPostResponse,
    status: 201,
    headers: createMockLinkedInRateLimitHeaders(99, 100)
  },

  // Successful post with media creation
  createPostWithMediaSuccess: {
    url: 'https://api.linkedin.com/v2/shares',
    method: 'POST',
    response: mockLinkedInPostWithMediaResponse,
    status: 201,
    headers: createMockLinkedInRateLimitHeaders(99, 100)
  },

  // Rate limit exceeded
  rateLimitExceeded: {
    url: /api\.linkedin\.com/,
    response: mockLinkedInRateLimitError,
    status: 429,
    headers: createMockLinkedInRateLimitHeaders(0, 100)
  },

  // Validation error
  validationError: {
    url: /api\.linkedin\.com/,
    response: mockLinkedInValidationError,
    status: 400
  },

  // Media upload scenarios
  mediaUploadRegister: {
    url: 'https://api.linkedin.com/v2/assets',
    method: 'POST',
    response: mockLinkedInMediaUploadResponse,
    status: 200
  },

  mediaUploadComplete: {
    url: /www\.linkedin\.com\/dms-uploads/,
    method: 'PUT',
    response: '',
    status: 201
  },

  // Network errors
  networkError: {
    url: /api\.linkedin\.com/,
    response: new Error('Network connection failed'),
    status: 0
  },

  // Server errors
  serverError: {
    url: /api\.linkedin\.com/,
    response: mockLinkedInInternalError,
    status: 500,
    headers: createMockLinkedInRateLimitHeaders(99, 100)
  }
};