import type { Config, Plugin } from 'payload';
import type { 
  SocialMediaPluginOptions, 
  ExtendedSocialMediaPluginOptions,
  PluginValidationError,
  ValidationResult,
  ValidationOptions,
  SocialPlatform,
  TwitterConfig,
  LinkedInConfig
} from './types';
import { SocialMediaSettingsGlobal } from './collections/SocialMediaSettings';
import { testConnectionEndpoint } from './endpoints';

/**
 * Validates the plugin configuration options with comprehensive error checking
 * @param options - Plugin configuration options
 * @param validationOptions - Validation behavior options
 * @returns Comprehensive validation result
 */
function validatePluginOptions(
  options: SocialMediaPluginOptions, 
  validationOptions: ValidationOptions = {}
): ValidationResult {
  const errors: PluginValidationError[] = [];
  const warnings: PluginValidationError[] = [];

  // Validate options object structure
  if (!options || typeof options !== 'object') {
    errors.push({
      field: 'root',
      message: 'Plugin options must be a valid object',
      code: 'INVALID_OPTIONS_TYPE',
      severity: 'error'
    });
    return { isValid: false, errors, warnings };
  }

  // Validate that at least one platform is configured
  if (!options.platforms || typeof options.platforms !== 'object') {
    errors.push({
      field: 'platforms',
      message: 'Platforms configuration is required and must be an object',
      code: 'MISSING_PLATFORMS_CONFIG',
      severity: 'error'
    });
    return { isValid: false, errors, warnings };
  }

  if (Object.keys(options.platforms).length === 0) {
    errors.push({
      field: 'platforms',
      message: 'At least one social media platform must be configured',
      code: 'MISSING_PLATFORMS',
      severity: 'error'
    });
    return { isValid: false, errors, warnings };
  }

  // Check for enabled platforms
  const enabledPlatforms = Object.keys(options.platforms).filter(
    platform => options.platforms[platform as SocialPlatform]?.enabled
  );
  
  if (enabledPlatforms.length === 0) {
    warnings.push({
      field: 'platforms',
      message: 'No platforms are currently enabled. The plugin will have limited functionality.',
      code: 'NO_ENABLED_PLATFORMS',
      severity: 'warning'
    });
  }

  // Validate Twitter configuration
  if (options.platforms.twitter) {
    const twitterConfig = options.platforms.twitter;
    
    // Validate Twitter configuration structure
    if (typeof twitterConfig !== 'object') {
      errors.push({
        field: 'platforms.twitter',
        message: 'Twitter configuration must be an object',
        code: 'INVALID_TWITTER_CONFIG_TYPE',
        severity: 'error'
      });
    } else {
      // Validate enabled flag
      if (typeof twitterConfig.enabled !== 'boolean') {
        errors.push({
          field: 'platforms.twitter.enabled',
          message: 'Twitter enabled flag must be a boolean value',
          code: 'INVALID_TWITTER_ENABLED_TYPE',
          severity: 'error'
        });
      }
      
      if (twitterConfig.enabled) {
        // Validate credentials when platform is enabled
        if (!validationOptions.skipCredentialValidation) {
          const credentialErrors = validateTwitterCredentials(twitterConfig);
          errors.push(...credentialErrors);
        }
        
        // Validate character limit
        if (twitterConfig.characterLimit !== undefined) {
          if (typeof twitterConfig.characterLimit !== 'number') {
            errors.push({
              field: 'platforms.twitter.characterLimit',
              message: 'Twitter character limit must be a number',
              code: 'INVALID_TWITTER_LIMIT_TYPE',
              severity: 'error'
            });
          } else if (twitterConfig.characterLimit < 1 || twitterConfig.characterLimit > 280) {
            errors.push({
              field: 'platforms.twitter.characterLimit',
              message: 'Twitter character limit must be between 1 and 280',
              code: 'INVALID_TWITTER_LIMIT_RANGE',
              severity: 'error'
            });
          }
        }
        
        // Validate API URL if provided
        if (twitterConfig.apiUrl && !isValidUrl(twitterConfig.apiUrl)) {
          errors.push({
            field: 'platforms.twitter.apiUrl',
            message: 'Twitter API URL must be a valid URL',
            code: 'INVALID_TWITTER_API_URL',
            severity: 'error'
          });
        }
      }
    }
  }

  // Validate LinkedIn configuration
  if (options.platforms.linkedin) {
    const linkedinConfig = options.platforms.linkedin;
    
    // Validate LinkedIn configuration structure
    if (typeof linkedinConfig !== 'object') {
      errors.push({
        field: 'platforms.linkedin',
        message: 'LinkedIn configuration must be an object',
        code: 'INVALID_LINKEDIN_CONFIG_TYPE',
        severity: 'error'
      });
    } else {
      // Validate enabled flag
      if (typeof linkedinConfig.enabled !== 'boolean') {
        errors.push({
          field: 'platforms.linkedin.enabled',
          message: 'LinkedIn enabled flag must be a boolean value',
          code: 'INVALID_LINKEDIN_ENABLED_TYPE',
          severity: 'error'
        });
      }
      
      if (linkedinConfig.enabled) {
        // Validate credentials when platform is enabled
        if (!validationOptions.skipCredentialValidation) {
          const credentialErrors = validateLinkedInCredentials(linkedinConfig);
          errors.push(...credentialErrors);
        }
        
        // Validate organization settings
        if (linkedinConfig.postAsOrganization !== undefined) {
          if (typeof linkedinConfig.postAsOrganization !== 'boolean') {
            errors.push({
              field: 'platforms.linkedin.postAsOrganization',
              message: 'LinkedIn postAsOrganization must be a boolean value',
              code: 'INVALID_LINKEDIN_POST_AS_ORG_TYPE',
              severity: 'error'
            });
          } else if (linkedinConfig.postAsOrganization && !linkedinConfig.organizationId?.trim()) {
            errors.push({
              field: 'platforms.linkedin.organizationId',
              message: 'LinkedIn organization ID is required when posting as organization',
              code: 'MISSING_LINKEDIN_ORG_ID',
              severity: 'error'
            });
          }
        }
        
        // Validate API URL if provided
        if (linkedinConfig.apiUrl && !isValidUrl(linkedinConfig.apiUrl)) {
          errors.push({
            field: 'platforms.linkedin.apiUrl',
            message: 'LinkedIn API URL must be a valid URL',
            code: 'INVALID_LINKEDIN_API_URL',
            severity: 'error'
          });
        }
      }
    }
  }

  // Validate collections configuration if provided
  if (options.collections) {
    const collectionErrors = validateCollectionsConfig(options.collections);
    errors.push(...collectionErrors.errors);
    warnings.push(...collectionErrors.warnings);
  }

  // Validate rate limiting configuration if provided
  if (options.rateLimit) {
    const rateLimitErrors = validateRateLimitConfig(options.rateLimit);
    errors.push(...rateLimitErrors);
  }

  // Validate analytics configuration if provided
  if (options.analytics) {
    const analyticsErrors = validateAnalyticsConfig(options.analytics);
    errors.push(...analyticsErrors);
  }

  // Validate endpoints configuration if provided
  if (options.endpoints) {
    const endpointErrors = validateEndpointsConfig(options.endpoints);
    errors.push(...endpointErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate Twitter credentials
 */
function validateTwitterCredentials(config: TwitterConfig): PluginValidationError[] {
  const errors: PluginValidationError[] = [];
  
  // Check for OAuth 1.0a credentials (preferred) or Bearer token
  const hasOAuth = config.apiKey && config.apiSecret && config.accessToken && config.accessTokenSecret;
  const hasBearerToken = config.bearerToken && config.bearerToken.trim();
  
  if (!hasOAuth && !hasBearerToken) {
    errors.push({
      field: 'platforms.twitter',
      message: 'Twitter requires either OAuth 1.0a credentials (apiKey, apiSecret, accessToken, accessTokenSecret) or a Bearer token',
      code: 'MISSING_TWITTER_CREDENTIALS',
      severity: 'error'
    });
  }
  
  // Validate individual credential fields if provided
  if (config.apiKey && (typeof config.apiKey !== 'string' || config.apiKey.trim().length < 10)) {
    errors.push({
      field: 'platforms.twitter.apiKey',
      message: 'Twitter API key must be a valid string with at least 10 characters',
      code: 'INVALID_TWITTER_API_KEY',
      severity: 'error'
    });
  }
  
  if (config.apiSecret && (typeof config.apiSecret !== 'string' || config.apiSecret.trim().length < 20)) {
    errors.push({
      field: 'platforms.twitter.apiSecret',
      message: 'Twitter API secret must be a valid string with at least 20 characters',
      code: 'INVALID_TWITTER_API_SECRET',
      severity: 'error'
    });
  }
  
  if (config.accessToken && (typeof config.accessToken !== 'string' || config.accessToken.trim().length < 20)) {
    errors.push({
      field: 'platforms.twitter.accessToken',
      message: 'Twitter access token must be a valid string with at least 20 characters',
      code: 'INVALID_TWITTER_ACCESS_TOKEN',
      severity: 'error'
    });
  }
  
  if (config.accessTokenSecret && (typeof config.accessTokenSecret !== 'string' || config.accessTokenSecret.trim().length < 20)) {
    errors.push({
      field: 'platforms.twitter.accessTokenSecret',
      message: 'Twitter access token secret must be a valid string with at least 20 characters',
      code: 'INVALID_TWITTER_ACCESS_TOKEN_SECRET',
      severity: 'error'
    });
  }
  
  if (config.bearerToken && (typeof config.bearerToken !== 'string' || config.bearerToken.trim().length < 30)) {
    errors.push({
      field: 'platforms.twitter.bearerToken',
      message: 'Twitter bearer token must be a valid string with at least 30 characters',
      code: 'INVALID_TWITTER_BEARER_TOKEN',
      severity: 'error'
    });
  }
  
  return errors;
}

/**
 * Validate LinkedIn credentials
 */
function validateLinkedInCredentials(config: LinkedInConfig): PluginValidationError[] {
  const errors: PluginValidationError[] = [];
  
  if (!config.accessToken || typeof config.accessToken !== 'string' || config.accessToken.trim().length < 30) {
    errors.push({
      field: 'platforms.linkedin.accessToken',
      message: 'LinkedIn access token must be a valid string with at least 30 characters',
      code: 'INVALID_LINKEDIN_ACCESS_TOKEN',
      severity: 'error'
    });
  }
  
  if (config.organizationId && (typeof config.organizationId !== 'string' || config.organizationId.trim().length === 0)) {
    errors.push({
      field: 'platforms.linkedin.organizationId',
      message: 'LinkedIn organization ID must be a non-empty string when provided',
      code: 'INVALID_LINKEDIN_ORG_ID',
      severity: 'error'
    });
  }
  
  return errors;
}

/**
 * Validate collections configuration
 */
function validateCollectionsConfig(collections: Record<string, any>): { errors: PluginValidationError[]; warnings: PluginValidationError[] } {
  const errors: PluginValidationError[] = [];
  const warnings: PluginValidationError[] = [];
  
  if (typeof collections !== 'object') {
    errors.push({
      field: 'collections',
      message: 'Collections configuration must be an object',
      code: 'INVALID_COLLECTIONS_TYPE',
      severity: 'error'
    });
    return { errors, warnings };
  }
  
  Object.entries(collections).forEach(([key, config]) => {
    if (typeof config !== 'object') {
      errors.push({
        field: `collections.${key}`,
        message: 'Collection configuration must be an object',
        code: 'INVALID_COLLECTION_CONFIG_TYPE',
        severity: 'error'
      });
      return;
    }
    
    // Validate required fields
    if (!config.name || typeof config.name !== 'string') {
      errors.push({
        field: `collections.${key}.name`,
        message: 'Collection name is required and must be a string',
        code: 'INVALID_COLLECTION_NAME',
        severity: 'error'
      });
    }
    
    if (!config.platforms || !Array.isArray(config.platforms) || config.platforms.length === 0) {
      errors.push({
        field: `collections.${key}.platforms`,
        message: 'Collection platforms must be a non-empty array',
        code: 'INVALID_COLLECTION_PLATFORMS',
        severity: 'error'
      });
    } else {
      // Validate platform values
      const invalidPlatforms = config.platforms.filter((p: any) => !['twitter', 'linkedin'].includes(p));
      if (invalidPlatforms.length > 0) {
        errors.push({
          field: `collections.${key}.platforms`,
          message: `Invalid platforms: ${invalidPlatforms.join(', ')}. Supported platforms: twitter, linkedin`,
          code: 'INVALID_PLATFORM_VALUES',
          severity: 'error'
        });
      }
    }
  });
  
  return { errors, warnings };
}

/**
 * Validate rate limit configuration
 */
function validateRateLimitConfig(rateLimit: any): PluginValidationError[] {
  const errors: PluginValidationError[] = [];
  
  if (typeof rateLimit !== 'object') {
    errors.push({
      field: 'rateLimit',
      message: 'Rate limit configuration must be an object',
      code: 'INVALID_RATE_LIMIT_TYPE',
      severity: 'error'
    });
    return errors;
  }
  
  if (rateLimit.maxRequests !== undefined && (typeof rateLimit.maxRequests !== 'number' || rateLimit.maxRequests < 1)) {
    errors.push({
      field: 'rateLimit.maxRequests',
      message: 'Rate limit maxRequests must be a positive number',
      code: 'INVALID_RATE_LIMIT_MAX_REQUESTS',
      severity: 'error'
    });
  }
  
  if (rateLimit.windowMs !== undefined && (typeof rateLimit.windowMs !== 'number' || rateLimit.windowMs < 1000)) {
    errors.push({
      field: 'rateLimit.windowMs',
      message: 'Rate limit windowMs must be at least 1000 milliseconds',
      code: 'INVALID_RATE_LIMIT_WINDOW',
      severity: 'error'
    });
  }
  
  if (rateLimit.strategy !== undefined && !['queue', 'reject', 'delay'].includes(rateLimit.strategy)) {
    errors.push({
      field: 'rateLimit.strategy',
      message: 'Rate limit strategy must be one of: queue, reject, delay',
      code: 'INVALID_RATE_LIMIT_STRATEGY',
      severity: 'error'
    });
  }
  
  return errors;
}

/**
 * Validate analytics configuration
 */
function validateAnalyticsConfig(analytics: any): PluginValidationError[] {
  const errors: PluginValidationError[] = [];
  
  if (typeof analytics !== 'object') {
    errors.push({
      field: 'analytics',
      message: 'Analytics configuration must be an object',
      code: 'INVALID_ANALYTICS_TYPE',
      severity: 'error'
    });
    return errors;
  }
  
  if (analytics.enabled !== undefined && typeof analytics.enabled !== 'boolean') {
    errors.push({
      field: 'analytics.enabled',
      message: 'Analytics enabled flag must be a boolean',
      code: 'INVALID_ANALYTICS_ENABLED',
      severity: 'error'
    });
  }
  
  if (analytics.provider !== undefined && !['internal', 'google', 'custom'].includes(analytics.provider)) {
    errors.push({
      field: 'analytics.provider',
      message: 'Analytics provider must be one of: internal, google, custom',
      code: 'INVALID_ANALYTICS_PROVIDER',
      severity: 'error'
    });
  }
  
  return errors;
}

/**
 * Validate endpoints configuration
 */
function validateEndpointsConfig(endpoints: any): PluginValidationError[] {
  const errors: PluginValidationError[] = [];
  
  if (typeof endpoints !== 'object') {
    errors.push({
      field: 'endpoints',
      message: 'Endpoints configuration must be an object',
      code: 'INVALID_ENDPOINTS_TYPE',
      severity: 'error'
    });
    return errors;
  }
  
  if (endpoints.basePath !== undefined && (typeof endpoints.basePath !== 'string' || !endpoints.basePath.startsWith('/'))) {
    errors.push({
      field: 'endpoints.basePath',
      message: 'Endpoints basePath must be a string starting with "/"',
      code: 'INVALID_ENDPOINTS_BASE_PATH',
      severity: 'error'
    });
  }
  
  if (endpoints.authentication !== undefined && !['none', 'api-key', 'jwt'].includes(endpoints.authentication)) {
    errors.push({
      field: 'endpoints.authentication',
      message: 'Endpoints authentication must be one of: none, api-key, jwt',
      code: 'INVALID_ENDPOINTS_AUTH',
      severity: 'error'
    });
  }
  
  return errors;
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates default plugin configuration values
 * @param options - User-provided plugin options
 * @returns Complete plugin options with defaults applied
 */
function applyDefaults(options: SocialMediaPluginOptions): ExtendedSocialMediaPluginOptions {
  const enabledPlatforms = Object.keys(options.platforms).filter(
    platform => options.platforms[platform as SocialPlatform]?.enabled
  ) as SocialPlatform[];

  const defaultOptions: ExtendedSocialMediaPluginOptions = {
    ...options,
    shareButtons: {
      platforms: enabledPlatforms,
      position: options.shareButtons?.position ?? 'bottom',
      styling: {
        size: options.shareButtons?.styling?.size ?? 'medium',
        variant: options.shareButtons?.styling?.variant ?? 'filled',
        ...options.shareButtons?.styling
      },
      showAnalytics: options.shareButtons?.showAnalytics ?? false,
      ...options.shareButtons
    },
    analytics: {
      enabled: options.analytics?.enabled ?? false,
      provider: options.analytics?.provider ?? 'internal',
      ...(options.analytics?.trackClicks !== undefined ? { trackClicks: options.analytics.trackClicks } : {}),
      ...(options.analytics?.trackViews !== undefined ? { trackViews: options.analytics.trackViews } : {}),
      ...(options.analytics?.customEvents !== undefined ? { customEvents: options.analytics.customEvents } : {}),
      ...options.analytics
    },
    rateLimit: {
      maxRequests: options.rateLimit?.maxRequests ?? 100,
      windowMs: options.rateLimit?.windowMs ?? 60 * 1000, // 1 minute
      strategy: options.rateLimit?.strategy ?? 'queue',
      ...options.rateLimit
    },
    endpoints: {
      basePath: options.endpoints?.basePath ?? '/api/social-media',
      webhooks: options.endpoints?.webhooks ?? false,
      ...(options.endpoints?.authentication !== undefined ? { authentication: options.endpoints.authentication } : {}),
      ...options.endpoints
    },
    debug: options.debug ?? false
  };

  // Apply platform-specific defaults
  if (defaultOptions.platforms?.twitter && defaultOptions.platforms.twitter.enabled) {
    defaultOptions.platforms.twitter = {
      displayName: 'Twitter',
      icon: '🐦',
      apiUrl: 'https://api.twitter.com/2',
      characterLimit: 280,
      allowMedia: true,
      ...defaultOptions.platforms.twitter
    } as TwitterConfig;
  }

  if (defaultOptions.platforms?.linkedin && defaultOptions.platforms.linkedin.enabled) {
    defaultOptions.platforms.linkedin = {
      displayName: 'LinkedIn',
      icon: '💼',
      apiUrl: 'https://api.linkedin.com/v2',
      postAsOrganization: false,
      ...defaultOptions.platforms.linkedin
    } as LinkedInConfig;
  }

  return defaultOptions;
}

/**
 * PayloadCMS Social Media Plugin
 * 
 * Adds social media integration capabilities to PayloadCMS, supporting
 * Twitter and LinkedIn platforms with admin-managed credentials.
 */
export function socialMediaPlugin(
  pluginOptions: SocialMediaPluginOptions
): Plugin {
  return (config: Config): Config => {
    // Validate plugin options with comprehensive error handling
    const validationResult = validatePluginOptions(pluginOptions);
    
    if (!validationResult.isValid) {
      const errorMessages = validationResult.errors
        .map(error => `${error.field}: ${error.message} [${error.code}]`)
        .join('\n');
      
      const errorDetails = {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        totalErrors: validationResult.errors.length,
        totalWarnings: validationResult.warnings.length
      };
      
      const error = new Error(
        `[SocialMediaPlugin] Configuration validation failed:\n${errorMessages}`
      );
      
      // Attach validation details to the error for debugging
      (error as any).validationDetails = errorDetails;
      
      throw error;
    }
    
    // Log warnings if any exist
    if (validationResult.warnings.length > 0) {
      const warningMessages = validationResult.warnings
        .map(warning => `${warning.field}: ${warning.message} [${warning.code}]`)
        .join('\n');
      
      console.warn(
        `[SocialMediaPlugin] Configuration warnings:\n${warningMessages}`
      );
    }

    // Apply defaults to plugin options
    const options = applyDefaults(pluginOptions);

    if (options.debug) {
      console.log('[SocialMediaPlugin] Initializing with options:', {
        platforms: Object.keys(options.platforms).filter(
          platform => options.platforms[platform as SocialPlatform]?.enabled
        ),
        collections: Object.keys(options.collections || {}),
        analytics: options.analytics?.enabled,
        debug: options.debug
      });
    }

    // Start with the existing config
    let modifiedConfig = { ...config };

    // Add Social Media Settings global collection
    modifiedConfig.globals = [
      ...(modifiedConfig.globals || []),
      SocialMediaSettingsGlobal
    ];

    // Add API endpoints
    modifiedConfig.endpoints = [
      ...(modifiedConfig.endpoints || []),
      {
        path: '/social-media/test-connection',
        method: 'post',
        handler: testConnectionEndpoint
      }
    ];

    // Store plugin options in config for runtime access
    modifiedConfig.custom = {
      ...modifiedConfig.custom,
      socialMediaPlugin: options
    };

    return modifiedConfig;
  };
}

/**
 * Default export for easier imports
 */
export default socialMediaPlugin;

/**
 * Re-export all types for consumer convenience
 */
export * from './types';

/**
 * Export collections and globals
 */
export { SocialMediaSettingsGlobal, SocialMediaSettings } from './collections';

/**
 * Export admin components
 */
export * from './components';

/**
 * Export hooks
 */
export * from './hooks';

/**
 * Export utilities
 */
export * from './utils';

/**
 * Export endpoints
 */
export * from './endpoints';

/**
 * Plugin metadata for PayloadCMS plugin registry
 */
export const pluginName = 'payloadcms-social-media-plugin';
export const pluginVersion = '1.0.0';

/**
 * Helper function to get plugin options from PayloadCMS config at runtime
 * @param config - PayloadCMS configuration
 * @returns Plugin options or null if plugin not configured
 */
export function getSocialMediaPluginOptions(
  config: Config
): ExtendedSocialMediaPluginOptions | null {
  return (config.custom as any)?.socialMediaPlugin || null;
}