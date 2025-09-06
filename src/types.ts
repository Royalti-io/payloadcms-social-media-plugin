/**
 * Core types for the PayloadCMS Social Media Plugin
 */

/**
 * Supported social media platforms
 */
export type SocialPlatform = 'twitter' | 'linkedin';

/**
 * Plugin validation error structure
 */
export interface PluginValidationError {
  field: string;
  message: string;
  code: string;
  severity?: 'error' | 'warning' | 'info';
  details?: Record<string, any>;
}

/**
 * Enhanced validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: PluginValidationError[];
  warnings: PluginValidationError[];
}

/**
 * Plugin configuration validation options
 */
export interface ValidationOptions {
  strict?: boolean;
  skipCredentialValidation?: boolean;
  skipNetworkValidation?: boolean;
}

/**
 * Base configuration for social media platforms
 */
export interface BasePlatformConfig {
  enabled: boolean;
  displayName?: string;
  icon?: string;
  apiUrl?: string;
}

/**
 * Twitter platform configuration
 */
export interface TwitterConfig extends BasePlatformConfig {
  bearerToken?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  characterLimit?: number;
  allowMedia?: boolean;
}

/**
 * LinkedIn platform configuration
 */
export interface LinkedInConfig extends BasePlatformConfig {
  accessToken?: string;
  organizationId?: string;
  postAsOrganization?: boolean;
}

/**
 * Platform configurations map
 */
export interface PlatformConfigs {
  twitter?: TwitterConfig;
  linkedin?: LinkedInConfig;
}

/**
 * Message template configuration
 */
export interface MessageTemplate {
  name: string;
  template: string;
  enabled?: boolean;
  description?: string;
  variables?: string[];
}

/**
 * Collection-specific social media configuration
 */
export interface CollectionSocialConfig {
  name: string;
  label?: string;
  platforms: SocialPlatform[];
  required?: boolean;
  templates?: MessageTemplate[];
  admin?: {
    position?: 'sidebar' | 'main';
    description?: string;
  };
}

/**
 * Share button styling configuration
 */
export interface ShareButtonStyling {
  size?: 'small' | 'medium' | 'large';
  variant?: 'filled' | 'outlined' | 'text';
  borderRadius?: number;
  customStyles?: Record<string, string>;
}

/**
 * Share button configuration
 */
export interface ShareButtonConfig {
  platforms?: SocialPlatform[];
  position?: 'top' | 'bottom' | 'both' | 'custom';
  styling?: ShareButtonStyling;
  showAnalytics?: boolean;
  customTemplate?: string;
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  enabled?: boolean;
  provider?: 'internal' | 'google' | 'custom';
  trackClicks?: boolean;
  trackViews?: boolean;
  customEvents?: string[];
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  maxRequests?: number;
  windowMs?: number;
  strategy?: 'queue' | 'reject' | 'delay';
}

/**
 * API endpoints configuration
 */
export interface EndpointsConfig {
  basePath?: string;
  webhooks?: boolean;
  authentication?: 'none' | 'api-key' | 'jwt';
}

/**
 * Base plugin options (user-provided)
 */
export interface SocialMediaPluginOptions {
  platforms: PlatformConfigs;
  collections?: Record<string, CollectionSocialConfig>;
  messageTemplates?: MessageTemplate[];
  shareButtons?: ShareButtonConfig;
  analytics?: AnalyticsConfig;
  rateLimit?: RateLimitConfig;
  endpoints?: EndpointsConfig;
  debug?: boolean;
}

/**
 * Extended plugin options (with defaults applied)
 */
export interface ExtendedSocialMediaPluginOptions extends SocialMediaPluginOptions {
  shareButtons: ShareButtonConfig;
  analytics: AnalyticsConfig;
  rateLimit: RateLimitConfig;
  endpoints: EndpointsConfig;
  debug: boolean;
}

/**
 * Type guards for platform configurations
 */
export function isTwitterConfig(config: any): config is TwitterConfig {
  return config && typeof config === 'object' && config.enabled === true;
}

export function isLinkedInConfig(config: any): config is LinkedInConfig {
  return config && typeof config === 'object' && config.enabled === true;
}

/**
 * Encryption utility types
 */
export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
  salt?: string;
}

export interface DecryptionInput {
  encrypted: string;
  iv: string;
  tag: string;
  salt?: string;
}

/**
 * Social media settings document type (for the global collection)
 */
export interface SocialMediaSettings {
  id: string;
  platforms: {
    twitter: {
      enabled: boolean;
      apiKey?: string;
      apiSecret?: string;
      accessToken?: string;
      accessTokenSecret?: string;
      bearerToken?: string;
      characterLimit: number;
      allowMedia: boolean;
      defaultTemplate?: string;
    };
    linkedin: {
      enabled: boolean;
      accessToken?: string;
      organizationId?: string;
      postAsOrganization: boolean;
      defaultTemplate?: string;
    };
  };
  messageTemplates: MessageTemplate[];
  shareButtons: {
    enabled: boolean;
    platforms: SocialPlatform[];
    position: 'top' | 'bottom' | 'both';
    styling: ShareButtonStyling;
  };
  analytics: {
    enabled: boolean;
    trackClicks: boolean;
    trackViews: boolean;
  };
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  updatedAt: string;
  createdAt: string;
}

/**
 * Connection test result type
 */
export interface ConnectionTestResult {
  success: boolean;
  error: string | undefined;
  errorCode: string | undefined;
  retryable: boolean | undefined;
  details: {
    user?: {
      id: string;
      username: string;
      name: string;
      verified?: boolean;
    };
    organization?: {
      id: string;
      name: string;
    };
    [key: string]: any;
  } | undefined;
}

/**
 * Admin component props
 */
export interface ConnectionTestButtonProps {
  platform: SocialPlatform;
  credentials: Record<string, string>;
  onTestComplete?: (result: ConnectionTestResult) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}