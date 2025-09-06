/**
 * Collection Enhancer Utility
 * 
 * Adds social sharing fields to PayloadCMS collections based on plugin configuration.
 */

import type { Field, CollectionConfig } from 'payload';
import type { 
  CollectionSocialConfig, 
  ExtendedSocialMediaPluginOptions,
  SocialPlatform
} from '../types';

/**
 * Creates the social sharing field group for a collection
 */
function createSocialSharingFields(
  config: CollectionSocialConfig,
  _pluginOptions: ExtendedSocialMediaPluginOptions
): Field {
  const availablePlatforms = config.platforms || [];
  const templates = config.templates || [];

  const socialFields: Field[] = [
    // Auto-posting enable/disable toggle
    {
      name: 'autoPost',
      type: 'checkbox',
      label: 'Auto-post to social media',
      defaultValue: false,
      admin: {
        description: 'Automatically post to configured platforms when this content is published'
      }
    }
  ];

  // Add platform-specific fields
  if (availablePlatforms.includes('twitter')) {
    socialFields.push({
      name: 'twitter',
      type: 'group',
      label: 'Twitter Settings',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Post to Twitter',
          defaultValue: false
        },
        {
          name: 'message',
          type: 'textarea',
          label: 'Twitter Message',
          admin: {
            description: 'Custom message for Twitter (max 280 chars). Leave empty to use template.',
            condition: (data) => data.twitter?.enabled
          },
          validate: (value: string | null | undefined) => {
            if (value && value.length > 280) {
              return 'Twitter message must be 280 characters or less';
            }
            return true;
          }
        },
        {
          name: 'template',
          type: 'select',
          label: 'Message Template',
          options: templates.map(t => ({ label: t.name, value: t.name })),
          admin: {
            description: 'Choose a pre-configured message template',
            condition: (data) => data.twitter?.enabled && !data.twitter?.message
          }
        }
      ],
      admin: {
        condition: (data) => data.autoPost
      }
    });
  }

  if (availablePlatforms.includes('linkedin')) {
    socialFields.push({
      name: 'linkedin',
      type: 'group',
      label: 'LinkedIn Settings',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Post to LinkedIn',
          defaultValue: false
        },
        {
          name: 'message',
          type: 'textarea',
          label: 'LinkedIn Message',
          admin: {
            description: 'Custom message for LinkedIn (max 3000 chars). Leave empty to use template.',
            condition: (data) => data.linkedin?.enabled
          },
          validate: (value: string | null | undefined) => {
            if (value && value.length > 3000) {
              return 'LinkedIn message must be 3000 characters or less';
            }
            return true;
          }
        },
        {
          name: 'template',
          type: 'select',
          label: 'Message Template',
          options: templates.map(t => ({ label: t.name, value: t.name })),
          admin: {
            description: 'Choose a pre-configured message template',
            condition: (data) => data.linkedin?.enabled && !data.linkedin?.message
          }
        }
      ],
      admin: {
        condition: (data) => data.autoPost
      }
    });
  }

  // Add scheduling field (future enhancement)
  socialFields.push({
    name: 'scheduledAt',
    type: 'date',
    label: 'Scheduled Post Time',
    admin: {
      description: 'Optional: Schedule post for a specific time (leave empty to post immediately)',
      condition: (data) => data.autoPost,
      date: {
        pickerAppearance: 'dayAndTime'
      }
    }
  });

  // Add posting status tracking
  socialFields.push({
    name: 'postingStatus',
    type: 'json',
    label: 'Posting Status',
    admin: {
      readOnly: true,
      description: 'Track the status of social media posts',
      condition: (data) => data.autoPost
    },
    defaultValue: {}
  });

  return {
    name: config.name,
    type: 'group',
    label: config.label || 'Social Media',
    fields: socialFields,
    admin: {
      description: config.admin?.description || 'Configure social media posting for this content'
    }
  };
}

/**
 * Enhances a PayloadCMS collection with social sharing capabilities
 * 
 * @param collection - The collection configuration to enhance
 * @param pluginOptions - Plugin configuration options
 * @returns Enhanced collection configuration
 */
export function enhanceCollection(
  collection: CollectionConfig,
  pluginOptions: ExtendedSocialMediaPluginOptions
): CollectionConfig {
  const collectionSocialConfig = pluginOptions.collections?.[collection.slug];
  
  if (!collectionSocialConfig) {
    return collection;
  }

  // Clone the collection to avoid mutations
  const enhancedCollection: CollectionConfig = {
    ...collection,
    fields: [...collection.fields]
  };

  // Add the social sharing field group
  const socialField = createSocialSharingFields(
    collectionSocialConfig,
    pluginOptions
  );

  // Insert the social field based on admin position preference
  if (collectionSocialConfig.admin?.position === 'main') {
    enhancedCollection.fields.push(socialField);
  } else {
    // Default to sidebar - add at the beginning for better visibility
    enhancedCollection.fields.unshift(socialField);
  }

  // Add hooks if they don't exist
  if (!enhancedCollection.hooks) {
    enhancedCollection.hooks = {};
  }

  if (!enhancedCollection.hooks.afterChange) {
    enhancedCollection.hooks.afterChange = [];
  }

  // Ensure hooks is an array
  if (!Array.isArray(enhancedCollection.hooks.afterChange)) {
    enhancedCollection.hooks.afterChange = [enhancedCollection.hooks.afterChange];
  }

  return enhancedCollection;
}

/**
 * Validates collection social configuration
 * 
 * @param config - Collection social configuration to validate
 * @param availablePlatforms - Available social platforms
 * @returns Validation errors array
 */
export function validateCollectionSocialConfig(
  config: CollectionSocialConfig,
  availablePlatforms: SocialPlatform[]
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];

  // Check if configured platforms are available
  const unavailablePlatforms = config.platforms.filter(
    platform => !availablePlatforms.includes(platform)
  );

  if (unavailablePlatforms.length > 0) {
    errors.push({
      field: 'platforms',
      message: `Configured platforms [${unavailablePlatforms.join(', ')}] are not available. Available platforms: [${availablePlatforms.join(', ')}]`
    });
  }

  // Validate templates
  if (config.templates) {
    config.templates.forEach((template, index) => {
      if (!template.name || !template.template) {
        errors.push({
          field: `templates[${index}]`,
          message: 'Template must have both name and template properties'
        });
      }

      // Basic template validation - check for valid variables
      const validVariables = [
        'title', 'excerpt', 'url', 'author', 'category', 'tags', 
        'createdAt', 'updatedAt', 'collection.name'
      ];
      
      const templateVariables = template.template.match(/\{\{([^}]+)\}\}/g) || [];
      const invalidVariables = templateVariables
        .map(v => v.replace(/\{\{|\}\}/g, '').trim())
        .filter(v => !validVariables.includes(v) && !v.startsWith('collection.'));

      if (invalidVariables.length > 0) {
        errors.push({
          field: `templates[${index}].template`,
          message: `Template contains invalid variables: ${invalidVariables.join(', ')}. Valid variables: ${validVariables.join(', ')}`
        });
      }
    });
  }

  return errors;
}

/**
 * Gets the social sharing data for a document
 * 
 * @param document - The document to extract social data from
 * @param fieldName - The name of the social sharing field group
 * @returns Social sharing configuration for the document
 */
export function getSocialSharingData(
  document: Record<string, any>,
  fieldName: string = 'socialSharing'
): {
  autoPost: boolean;
  twitter?: { enabled: boolean; message?: string; template?: string };
  linkedin?: { enabled: boolean; message?: string; template?: string };
  scheduledAt?: string;
  postingStatus?: Record<string, any>;
} | null {
  const socialData = document[fieldName];
  
  if (!socialData || !socialData.autoPost) {
    return null;
  }

  return {
    autoPost: socialData.autoPost,
    twitter: socialData.twitter,
    linkedin: socialData.linkedin,
    scheduledAt: socialData.scheduledAt,
    postingStatus: socialData.postingStatus || {}
  };
}