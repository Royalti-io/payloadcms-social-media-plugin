# Social Media Services

This directory contains the social media API service implementations for the PayloadCMS social media plugin.

## Architecture

The service architecture is built around a base service class that provides common functionality, with specific implementations for each social media platform.

### Base Service (`base.ts`)

The `BaseService` abstract class provides:

- **HTTP client configuration** with automatic retry logic
- **Rate limiting utilities** with automatic header parsing
- **Error handling patterns** with exponential backoff
- **Connection testing interface** for credential validation
- **Comprehensive logging** for debugging and monitoring

Key features:
- Exponential backoff retry with jitter
- Automatic rate limit detection and handling
- Request timeout management
- Sanitized logging (redacts sensitive data)

### Twitter Service (`twitter.ts`)

The `TwitterService` implements Twitter API v2 integration with:

- **OAuth 1.0a authentication** for API access
- **Tweet posting** with text and media support
- **Media upload** with chunked upload for large files
- **Connection testing** to validate credentials
- **Twitter-specific error handling** for API error codes

#### Supported Features:
- Text tweets (up to 280 characters)
- Image uploads (JPEG, PNG, GIF, WebP)
- Video uploads (MP4)
- Alt text for media accessibility
- Reply and quote tweet functionality
- Media processing status monitoring

### Error Handling (`errors.ts`)

Comprehensive error handling system with:

- **Structured error types** with consistent formatting
- **Error factory functions** for common scenarios
- **User-friendly error messages** for end users
- **Retry logic recommendations** based on error types
- **Detailed error context** for debugging

#### Error Categories:
- Authentication errors (invalid credentials, expired tokens)
- Content validation errors (too long, duplicate, invalid format)
- Media upload errors (file too large, processing failed)
- Rate limiting errors (quota exceeded, temporary limits)
- Network errors (timeouts, connection failures)
- Server errors (API downtime, internal errors)

## Usage Examples

### Basic Twitter Service Usage

```typescript
import { TwitterService, ServiceFactory, ErrorHandler } from './services';

// Create service instance
const twitterService = ServiceFactory.createTwitterService({
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
  accessToken: 'your-access-token',
  accessTokenSecret: 'your-access-token-secret'
});

// Test connection
try {
  const result = await twitterService.testConnection();
  if (result.success) {
    console.log('Connected to Twitter API');
    console.log('Authenticated as:', result.details?.user?.username);
  } else {
    console.error('Connection failed:', result.error);
  }
} catch (error) {
  const handledError = ErrorHandler.handle(error, console, 'TwitterConnection');
  console.error('User message:', ErrorHandler.getUserMessage(handledError));
}

// Post a tweet
try {
  const tweet = await twitterService.postTweet({
    text: 'Hello from PayloadCMS! 🚀',
    media: [{
      data: imageBuffer,
      mediaType: 'image/jpeg',
      altText: 'PayloadCMS logo'
    }]
  });
  
  console.log('Tweet posted:', tweet.data.id);
} catch (error) {
  const handledError = ErrorHandler.handle(error, console, 'TweetPost');
  
  if (handledError.isRetryable()) {
    console.log('This error can be retried');
  } else {
    console.log('This is a permanent failure');
  }
}
```

### Service Health Monitoring

```typescript
import { ServiceUtils, TwitterService } from './services';

// Monitor multiple services
const services = [
  { name: 'twitter', service: twitterService }
];

const healthCheck = await ServiceUtils.testConnections(services);
const status = ServiceUtils.getHealthStatus(healthCheck);

console.log('Service Status:', status.overall);
console.log('Healthy services:', status.healthy);
console.log('Failed services:', status.unhealthy);

// Check rate limits
const rateLimitInfo = twitterService.getRateLimitInfo();
if (rateLimitInfo) {
  console.log('Rate limit status:', ServiceUtils.formatRateLimit(rateLimitInfo));
}
```

### Error Handling Patterns

```typescript
import { SocialMediaError, ErrorCodes, ErrorFactory } from './services';

// Catch and handle specific errors
try {
  await twitterService.postTweet({ text: 'Very long tweet...' });
} catch (error) {
  if (error instanceof SocialMediaError) {
    switch (error.code) {
      case ErrorCodes.CONTENT_TOO_LONG:
        console.log('Tweet is too long, please shorten it');
        break;
      case ErrorCodes.RATE_LIMIT_EXCEEDED:
        const delay = ServiceUtils.calculateOptimalDelay(
          twitterService.getRateLimitInfo()
        );
        console.log(`Rate limited, retry in ${delay}ms`);
        break;
      case ErrorCodes.DUPLICATE_CONTENT:
        console.log('This tweet has already been posted');
        break;
      default:
        console.log('Unexpected error:', error.message);
    }
  }
}
```

## Rate Limiting Strategy

The services implement intelligent rate limiting:

1. **Automatic detection** from API response headers
2. **Proactive waiting** when limits are approached
3. **Exponential backoff** for retry attempts
4. **Jitter addition** to prevent thundering herd problems
5. **Reset time awareness** for accurate wait calculations

## Security Considerations

- All sensitive data is redacted in logs
- Credentials are validated on service creation
- OAuth signatures are generated per request
- No credential persistence in memory beyond service lifetime
- Rate limit information is exposed for external monitoring

## Testing Connection Reliability

Each service provides a `testConnection()` method that:

- Validates API credentials
- Checks API accessibility
- Returns detailed success/failure information
- Provides user account details on success
- Includes rate limit information where available

## Development Guidelines

When extending or modifying services:

1. Always extend `BaseService` for consistency
2. Implement comprehensive error handling with specific error codes
3. Add detailed logging for debugging
4. Include rate limit information in responses
5. Validate all input parameters
6. Use TypeScript interfaces for all API responses
7. Handle media uploads with progress tracking
8. Implement exponential backoff for retries
9. Sanitize sensitive data in logs
10. Provide user-friendly error messages

## Dependencies

The services use only Node.js built-in modules:
- `fetch` API for HTTP requests (Node.js 18+)
- `FormData` for media uploads
- `URLSearchParams` for form encoding
- Built-in crypto for OAuth signatures

No external HTTP libraries or dependencies are required.