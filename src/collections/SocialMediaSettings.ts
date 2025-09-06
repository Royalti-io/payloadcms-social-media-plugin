import type { GlobalConfig } from 'payload';
import { encryptionHook } from '../utils/encryption';

/**
 * Social Media Settings Global Collection
 * 
 * This global collection stores encrypted API credentials and configuration
 * for social media integrations. It uses field-level encryption for sensitive
 * data and provides admin-only access with connection testing functionality.
 */
export const SocialMediaSettingsGlobal: GlobalConfig = {
  slug: 'social-media-settings',
  label: 'Social Media Settings',
  
  // Admin-only access control
  access: {
    read: ({ req: { user } }) => {
      // Only admins can read social media settings
      return user?.role === 'admin';
    },
    update: ({ req: { user } }) => {
      // Only admins can update social media settings  
      return user?.role === 'admin';
    }
  },

  // Apply encryption hooks for sensitive fields
  hooks: {
    beforeChange: encryptionHook.beforeChange,
    afterRead: encryptionHook.afterRead
  },

  admin: {
    group: 'Settings',
    description: 'Configure social media platform integrations and API credentials.'
  },

  fields: [
    // Platform Configuration Section
    {
      type: 'collapsible',
      label: 'Platform Settings',
      admin: {
        initCollapsed: false,
        description: 'Configure and test connections to social media platforms.'
      },
      fields: [
        // Twitter Configuration
        {
          type: 'group',
          name: 'platforms',
          fields: [
            {
              type: 'group',
              name: 'twitter',
              label: 'Twitter/X Configuration',
              admin: {
                description: 'Configure Twitter API credentials and settings.'
              },
              fields: [
                {
                  type: 'checkbox',
                  name: 'enabled',
                  label: 'Enable Twitter Integration',
                  defaultValue: false,
                  admin: {
                    description: 'Enable or disable Twitter posting functionality.'
                  }
                },
                {
                  type: 'text',
                  name: 'apiKey',
                  label: 'API Key (Consumer Key)',
                  admin: {
                    condition: (data) => data?.platforms?.twitter?.enabled,
                    description: 'Your Twitter API Key (Consumer Key) from the Twitter Developer Portal.',
                    placeholder: 'Enter your Twitter API Key...'
                  },
                  required: true,
                  validate: (value: string | string[] | null | undefined, { operation, data }: { operation?: string; data?: any }) => {
                    // Skip validation if Twitter is disabled or during read operations
                    if (operation === 'read' || !data?.platforms?.twitter?.enabled) {
                      return true;
                    }
                    
                    if (value === null || value === undefined || (typeof value !== 'string' && !Array.isArray(value))) {
                      return 'Twitter API Key is required when Twitter integration is enabled';
                    }
                    
                    const stringValue = Array.isArray(value) ? value[0] : value;
                    const trimmed = stringValue?.trim() || '';
                    if (trimmed.length < 10) {
                      return 'Twitter API Key must be at least 10 characters long';
                    }
                    
                    if (trimmed.length > 100) {
                      return 'Twitter API Key is too long (maximum 100 characters)';
                    }
                    
                    // Basic format validation - API keys are typically alphanumeric
                    if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
                      return 'Twitter API Key contains invalid characters (only alphanumeric characters allowed)';
                    }
                    
                    return true;
                  }
                },
                {
                  type: 'text',
                  name: 'apiSecret',
                  label: 'API Secret (Consumer Secret)',
                  admin: {
                    condition: (data) => data?.platforms?.twitter?.enabled,
                    description: 'Your Twitter API Secret (Consumer Secret) from the Twitter Developer Portal.',
                    placeholder: 'Enter your Twitter API Secret...'
                  },
                  required: true,
                  validate: (value: string | string[] | null | undefined, { operation, data }: { operation?: string; data?: any }) => {
                    if (operation === 'read' || !data?.platforms?.twitter?.enabled) {
                      return true;
                    }
                    
                    if (value === null || value === undefined || (typeof value !== 'string' && !Array.isArray(value))) {
                      return 'Twitter API Secret is required when Twitter integration is enabled';
                    }
                    
                    const stringValue = Array.isArray(value) ? value[0] : value;
                    const trimmed = stringValue?.trim() || '';
                    if (trimmed.length < 20) {
                      return 'Twitter API Secret must be at least 20 characters long';
                    }
                    
                    if (trimmed.length > 200) {
                      return 'Twitter API Secret is too long (maximum 200 characters)';
                    }
                    
                    // Check for whitespace characters
                    if (/\s/.test(trimmed)) {
                      return 'Twitter API Secret should not contain whitespace characters';
                    }
                    
                    return true;
                  }
                },
                {
                  type: 'text',
                  name: 'accessToken',
                  label: 'Access Token',
                  admin: {
                    condition: (data) => data?.platforms?.twitter?.enabled,
                    description: 'Your Twitter Access Token for posting on behalf of your account.',
                    placeholder: 'Enter your Twitter Access Token...'
                  },
                  validate: (value: string | string[] | null | undefined, { operation, data }: { operation?: string; data?: any }) => {
                    if (operation === 'read' || !data?.platforms?.twitter?.enabled) {
                      return true;
                    }
                    
                    if (value === null || value === undefined || (typeof value !== 'string' && !Array.isArray(value))) {
                      return 'Twitter Access Token is required when Twitter integration is enabled';
                    }
                    
                    const stringValue = Array.isArray(value) ? value[0] : value;
                    const trimmed = stringValue?.trim() || '';
                    if (trimmed.length < 20) {
                      return 'Twitter Access Token must be at least 20 characters long';
                    }
                    
                    // Twitter access tokens typically have a specific format
                    if (!trimmed.includes('-')) {
                      return 'Twitter Access Token format appears invalid (should contain hyphens)';
                    }
                    
                    if (/\s/.test(trimmed)) {
                      return 'Twitter Access Token should not contain whitespace characters';
                    }
                    
                    return true;
                  },
                  required: true
                },
                {
                  type: 'text',
                  name: 'accessTokenSecret',
                  label: 'Access Token Secret',
                  admin: {
                    condition: (data) => data?.platforms?.twitter?.enabled,
                    description: 'Your Twitter Access Token Secret.',
                    placeholder: 'Enter your Twitter Access Token Secret...'
                  },
                  required: true,
                  validate: (value: string | string[] | null | undefined, { operation, data }: { operation?: string; data?: any }) => {
                    if (operation === 'read' || !data?.platforms?.twitter?.enabled) {
                      return true;
                    }
                    
                    if (value === null || value === undefined || (typeof value !== 'string' && !Array.isArray(value))) {
                      return 'Twitter Access Token Secret is required when Twitter integration is enabled';
                    }
                    
                    const stringValue = Array.isArray(value) ? value[0] : value;
                    const trimmed = stringValue?.trim() || '';
                    if (trimmed.length < 20) {
                      return 'Twitter Access Token Secret must be at least 20 characters long';
                    }
                    
                    if (trimmed.length > 200) {
                      return 'Twitter Access Token Secret is too long (maximum 200 characters)';
                    }
                    
                    if (/\s/.test(trimmed)) {
                      return 'Twitter Access Token Secret should not contain whitespace characters';
                    }
                    
                    return true;
                  }
                },
                {
                  type: 'text',
                  name: 'bearerToken',
                  label: 'Bearer Token (Optional)',
                  admin: {
                    condition: (data) => data?.platforms?.twitter?.enabled,
                    description: 'Optional Bearer Token for read-only API access and enhanced features.',
                    placeholder: 'Enter your Twitter Bearer Token...'
                  },
                  validate: (value: string | string[] | null | undefined, { operation, data }: { operation?: string; data?: any }) => {
                    if (operation === 'read' || !data?.platforms?.twitter?.enabled || !value) {
                      return true;
                    }
                    
                    if (typeof value !== 'string') {
                      return 'Twitter Bearer Token must be a string';
                    }
                    
                    const stringValue = Array.isArray(value) ? value[0] : value;
                    const trimmed = stringValue.trim();
                    if (trimmed.length < 30) {
                      return 'Twitter Bearer Token must be at least 30 characters long';
                    }
                    
                    if (trimmed.length > 500) {
                      return 'Twitter Bearer Token is too long (maximum 500 characters)';
                    }
                    
                    // Bearer tokens are typically base64-encoded
                    if (!/^[A-Za-z0-9+/]+(={0,2})?$/.test(trimmed)) {
                      return 'Twitter Bearer Token format appears invalid';
                    }
                    
                    return true;
                  }
                },
                {
                  type: 'number',
                  name: 'characterLimit',
                  label: 'Character Limit',
                  defaultValue: 280,
                  min: 1,
                  max: 280,
                  admin: {
                    condition: (data) => data?.platforms?.twitter?.enabled,
                    description: 'Maximum character limit for tweets (default: 280).',
                    step: 1
                  }
                },
                {
                  type: 'checkbox',
                  name: 'allowMedia',
                  label: 'Allow Media Uploads',
                  defaultValue: true,
                  admin: {
                    condition: (data) => data?.platforms?.twitter?.enabled,
                    description: 'Allow uploading images and videos with tweets.'
                  }
                },
                {
                  type: 'textarea',
                  name: 'defaultTemplate',
                  label: 'Default Tweet Template',
                  admin: {
                    condition: (data) => data?.platforms?.twitter?.enabled,
                    description: 'Default template for tweets. Use {{title}}, {{url}}, etc. for dynamic content.',
                    placeholder: 'Check out our latest post: {{title}} {{url}} #content',
                    rows: 3
                  },
                  validate: (value: string | string[] | null | undefined, { operation, data }: { operation?: string; data?: any }) => {
                    if (operation === 'read' || !data?.platforms?.twitter?.enabled || !value) {
                      return true;
                    }
                    
                    if (typeof value !== 'string') {
                      return 'Template must be a string';
                    }
                    
                    const stringValue = Array.isArray(value) ? value[0] : value;
                    const trimmed = stringValue.trim();
                    
                    // Basic length check (considering template variables will expand)
                    if (trimmed.length > 250) {
                      return 'Template is too long and may exceed Twitter character limit after variable substitution';
                    }
                    
                    // Check for malformed template variables
                    const malformedVars = trimmed.match(/\{[^{}]*\}(?!\})|\{\{[^}]*$|^[^{]*\}\}/g);
                    if (malformedVars) {
                      return `Malformed template variables found: ${malformedVars.join(', ')}`;
                    }
                    
                    // Check for unmatched braces
                    const openBraces = (trimmed.match(/\{/g) || []).length;
                    const closeBraces = (trimmed.match(/\}/g) || []).length;
                    if (openBraces !== closeBraces) {
                      return 'Template has unmatched braces - check your variable syntax';
                    }
                    
                    return true;
                  }
                },
                // Note: Connection test UI component would be implemented here
                // {
                //   type: 'ui',
                //   name: 'twitterConnectionTest',
                //   admin: {
                //     condition: (data) => data?.platforms?.twitter?.enabled,
                //     components: {
                //       Field: 'TwitterConnectionTestField' // Reference to admin component
                //     }
                //   }
                // }
              ]
            },

            // LinkedIn Configuration
            {
              type: 'group',
              name: 'linkedin',
              label: 'LinkedIn Configuration',
              admin: {
                description: 'Configure LinkedIn API credentials and settings.'
              },
              fields: [
                {
                  type: 'checkbox',
                  name: 'enabled',
                  label: 'Enable LinkedIn Integration',
                  defaultValue: false,
                  admin: {
                    description: 'Enable or disable LinkedIn posting functionality.'
                  }
                },
                {
                  type: 'text',
                  name: 'accessToken',
                  label: 'Access Token',
                  admin: {
                    condition: (data) => data?.platforms?.linkedin?.enabled,
                    description: 'Your LinkedIn Access Token for API access.',
                    placeholder: 'Enter your LinkedIn Access Token...'
                  },
                  required: true,
                  validate: (value: string | string[] | null | undefined, { operation, data }: { operation?: string; data?: any }) => {
                    if (operation === 'read' || !data?.platforms?.linkedin?.enabled) {
                      return true;
                    }
                    
                    if (value === null || value === undefined || (typeof value !== 'string' && !Array.isArray(value))) {
                      return 'LinkedIn Access Token is required when LinkedIn integration is enabled';
                    }
                    
                    const stringValue = Array.isArray(value) ? value[0] : value;
                    const trimmed = stringValue?.trim() || '';
                    if (trimmed.length < 30) {
                      return 'LinkedIn Access Token must be at least 30 characters long';
                    }
                    
                    if (trimmed.length > 500) {
                      return 'LinkedIn Access Token is too long (maximum 500 characters)';
                    }
                    
                    if (/\s/.test(trimmed)) {
                      return 'LinkedIn Access Token should not contain whitespace characters';
                    }
                    
                    return true;
                  }
                },
                {
                  type: 'text',
                  name: 'organizationId',
                  label: 'Organization ID (Optional)',
                  admin: {
                    condition: (data) => data?.platforms?.linkedin?.enabled && data?.platforms?.linkedin?.postAsOrganization,
                    description: 'LinkedIn Organization ID if posting as organization. Leave empty to show all available organizations.',
                    placeholder: 'Enter LinkedIn Organization ID...'
                  },
                  validate: (value: string | string[] | null | undefined, { operation, data }: { operation?: string; data?: any }) => {
                    if (operation === 'read' || !data?.platforms?.linkedin?.enabled || !data?.platforms?.linkedin?.postAsOrganization || !value) {
                      return true;
                    }
                    
                    if (typeof value !== 'string') {
                      return 'LinkedIn Organization ID must be a string';
                    }
                    
                    const stringValue = Array.isArray(value) ? value[0] : value;
                    const trimmed = stringValue.trim();
                    if (trimmed.length === 0) {
                      return true; // Optional field
                    }
                    
                    if (trimmed.length < 5) {
                      return 'LinkedIn Organization ID must be at least 5 characters long';
                    }
                    
                    if (trimmed.length > 50) {
                      return 'LinkedIn Organization ID is too long (maximum 50 characters)';
                    }
                    
                    // LinkedIn organization IDs are typically numeric
                    if (!/^[0-9]+$/.test(trimmed)) {
                      return 'LinkedIn Organization ID should contain only numeric characters';
                    }
                    
                    return true;
                  }
                },
                {
                  type: 'checkbox',
                  name: 'postAsOrganization',
                  label: 'Post as Organization',
                  defaultValue: false,
                  admin: {
                    condition: (data) => data?.platforms?.linkedin?.enabled,
                    description: 'Post as organization instead of personal profile.'
                  }
                },
                {
                  type: 'number',
                  name: 'characterLimit',
                  label: 'Character Limit',
                  defaultValue: 3000,
                  min: 1,
                  max: 3000,
                  admin: {
                    condition: (data) => data?.platforms?.linkedin?.enabled,
                    description: 'Maximum character limit for LinkedIn posts (default: 3000).',
                    step: 1
                  }
                },
                {
                  type: 'checkbox',
                  name: 'allowMedia',
                  label: 'Allow Media Uploads',
                  defaultValue: true,
                  admin: {
                    condition: (data) => data?.platforms?.linkedin?.enabled,
                    description: 'Allow uploading images and videos with LinkedIn posts.'
                  }
                },
                {
                  type: 'checkbox',
                  name: 'enableRichContent',
                  label: 'Enable Rich Content Features',
                  defaultValue: true,
                  admin: {
                    condition: (data) => data?.platforms?.linkedin?.enabled,
                    description: 'Enable LinkedIn-specific rich content features like article previews and professional formatting.'
                  }
                },
                {
                  type: 'textarea',
                  name: 'defaultTemplate',
                  label: 'Default LinkedIn Post Template',
                  admin: {
                    condition: (data) => data?.platforms?.linkedin?.enabled,
                    description: 'Default template for LinkedIn posts. Use {{title}}, {{url}}, etc. for dynamic content.',
                    placeholder: 'Excited to share our latest article: {{title}}\n\n{{excerpt}}\n\nRead more: {{url}}\n\n#linkedin #content',
                    rows: 4
                  }
                },
                // Note: UI component would be implemented here in actual PayloadCMS integration
                // {
                //   type: 'ui',
                //   name: 'linkedinConnectionTest',
                //   admin: {
                //     condition: (data) => data?.platforms?.linkedin?.enabled,
                //     components: {
                //       Field: LinkedInConnectionTestField
                //     }
                //   }
                // }
              ]
            }
          ]
        }
      ]
    },

    // Message Templates Section
    {
      type: 'collapsible',
      label: 'Message Templates',
      admin: {
        initCollapsed: true,
        description: 'Create reusable message templates for social media posts.'
      },
      fields: [
        {
          type: 'array',
          name: 'messageTemplates',
          label: 'Templates',
          admin: {
            description: 'Create templates with dynamic variables like {{title}}, {{url}}, {{excerpt}}.'
          },
          fields: [
            {
              type: 'text',
              name: 'name',
              label: 'Template Name',
              required: true,
              admin: {
                placeholder: 'e.g., Blog Post, Product Launch, News Update'
              }
            },
            {
              type: 'textarea',
              name: 'template',
              label: 'Template Content',
              required: true,
              admin: {
                description: 'Use {{variable}} syntax for dynamic content. Available: {{title}}, {{url}}, {{excerpt}}, {{author}}, {{date}}',
                placeholder: 'Check out our latest {{type}}: {{title}}\n\n{{excerpt}}\n\nRead more: {{url}}',
                rows: 4
              }
            },
            {
              type: 'text',
              name: 'description',
              label: 'Description',
              admin: {
                placeholder: 'Brief description of when to use this template'
              }
            },
            {
              type: 'checkbox',
              name: 'enabled',
              label: 'Enabled',
              defaultValue: true
            },
            {
              type: 'array',
              name: 'variables',
              label: 'Custom Variables',
              admin: {
                description: 'Define additional variables for this template.'
              },
              fields: [
                {
                  type: 'text',
                  name: 'name',
                  label: 'Variable Name',
                  required: true,
                  admin: {
                    placeholder: 'e.g., category, tags, price'
                  }
                },
                {
                  type: 'text',
                  name: 'description',
                  label: 'Description',
                  admin: {
                    placeholder: 'Describe what this variable represents'
                  }
                }
              ]
            }
          ]
        }
      ]
    },

    // Share Buttons Configuration
    {
      type: 'collapsible',
      label: 'Share Buttons',
      admin: {
        initCollapsed: true,
        description: 'Configure social media share buttons for your content.'
      },
      fields: [
        {
          type: 'group',
          name: 'shareButtons',
          fields: [
            {
              type: 'checkbox',
              name: 'enabled',
              label: 'Enable Share Buttons',
              defaultValue: false,
              admin: {
                description: 'Display social media share buttons on your content.'
              }
            },
            {
              type: 'select',
              name: 'platforms',
              label: 'Enabled Platforms',
              hasMany: true,
              options: [
                { label: 'Twitter/X', value: 'twitter' },
                { label: 'LinkedIn', value: 'linkedin' }
              ],
              admin: {
                condition: (data) => data?.shareButtons?.enabled,
                description: 'Select which platforms to show share buttons for.'
              }
            },
            {
              type: 'select',
              name: 'position',
              label: 'Position',
              options: [
                { label: 'Top of Content', value: 'top' },
                { label: 'Bottom of Content', value: 'bottom' },
                { label: 'Both Top and Bottom', value: 'both' }
              ],
              defaultValue: 'bottom',
              admin: {
                condition: (data) => data?.shareButtons?.enabled,
                description: 'Where to display the share buttons.'
              }
            },
            {
              type: 'group',
              name: 'styling',
              label: 'Button Styling',
              admin: {
                condition: (data) => data?.shareButtons?.enabled,
                description: 'Customize the appearance of share buttons.'
              },
              fields: [
                {
                  type: 'select',
                  name: 'size',
                  label: 'Button Size',
                  options: [
                    { label: 'Small', value: 'small' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'Large', value: 'large' }
                  ],
                  defaultValue: 'medium'
                },
                {
                  type: 'select',
                  name: 'variant',
                  label: 'Button Style',
                  options: [
                    { label: 'Filled', value: 'filled' },
                    { label: 'Outlined', value: 'outlined' },
                    { label: 'Text Only', value: 'text' }
                  ],
                  defaultValue: 'filled'
                },
                {
                  type: 'number',
                  name: 'borderRadius',
                  label: 'Border Radius (px)',
                  defaultValue: 4,
                  min: 0,
                  max: 50,
                  admin: {
                    description: 'Roundness of button corners in pixels.'
                  }
                }
              ]
            }
          ]
        }
      ]
    },

    // Analytics Configuration
    {
      type: 'collapsible',
      label: 'Analytics & Tracking',
      admin: {
        initCollapsed: true,
        description: 'Configure analytics and tracking for social media interactions.'
      },
      fields: [
        {
          type: 'group',
          name: 'analytics',
          fields: [
            {
              type: 'checkbox',
              name: 'enabled',
              label: 'Enable Analytics',
              defaultValue: false,
              admin: {
                description: 'Track social media interactions and engagement.'
              }
            },
            {
              type: 'checkbox',
              name: 'trackClicks',
              label: 'Track Share Button Clicks',
              defaultValue: true,
              admin: {
                condition: (data) => data?.analytics?.enabled,
                description: 'Track when users click social media share buttons.'
              }
            },
            {
              type: 'checkbox',
              name: 'trackViews',
              label: 'Track Content Views',
              defaultValue: false,
              admin: {
                condition: (data) => data?.analytics?.enabled,
                description: 'Track when content with social features is viewed.'
              }
            }
          ]
        }
      ]
    },

    // Rate Limiting Configuration
    {
      type: 'collapsible',
      label: 'Rate Limiting',
      admin: {
        initCollapsed: true,
        description: 'Configure API rate limiting to prevent hitting platform limits.'
      },
      fields: [
        {
          type: 'group',
          name: 'rateLimit',
          fields: [
            {
              type: 'checkbox',
              name: 'enabled',
              label: 'Enable Rate Limiting',
              defaultValue: true,
              admin: {
                description: 'Enable rate limiting to prevent API quota issues.'
              }
            },
            {
              type: 'number',
              name: 'maxRequests',
              label: 'Max Requests per Window',
              defaultValue: 100,
              min: 1,
              max: 1000,
              admin: {
                condition: (data) => data?.rateLimit?.enabled,
                description: 'Maximum number of API requests allowed per time window.'
              }
            },
            {
              type: 'number',
              name: 'windowMs',
              label: 'Time Window (minutes)',
              defaultValue: 15,
              min: 1,
              max: 1440,
              admin: {
                condition: (data) => data?.rateLimit?.enabled,
                description: 'Time window for rate limiting in minutes.'
              }
            }
          ]
        }
      ]
    },

    // Setup Instructions (simplified)
    {
      type: 'text',
      name: 'setupInstructions',
      label: 'Setup Instructions',
      admin: {
        readOnly: true,
        hidden: true
      },
      defaultValue: 'See documentation for setup instructions'
    }
  ]
};

export default SocialMediaSettingsGlobal;