/**
 * After Change Hook
 * 
 * Detects when content is published and triggers auto-posting to social media platforms.
 */

import type { CollectionAfterChangeHook } from 'payload';
import type { ExtendedSocialMediaPluginOptions } from '../types';
import { PostingQueue } from '../utils/postingQueue';
import { MessageTemplateEngine } from '../utils/messageTemplateEngine';
import { getSocialSharingData } from '../utils/collectionEnhancer';
import { ErrorFactory } from '../services/errors';
import { logger, logUtils } from '../utils/errorLogger';

/**
 * Creates an afterChange hook for a collection with social media integration
 */
export function createSocialMediaAfterChangeHook(
  pluginOptions: ExtendedSocialMediaPluginOptions,
  _collectionSlug: string
): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, req, collection }) => {
    const correlationId = logger.generateCorrelationId();
    
    try {
      await logUtils.logServiceStart(
        'SocialMediaHook',
        'processAfterChange',
        undefined,
        correlationId
      );
      
      // Skip if debug mode
      if (pluginOptions.debug) {
        await logger.debug(
          `Processing document: ${collection.slug}:${doc.id}`,
          'SocialMediaHook',
          { documentId: doc.id, collectionSlug: collection.slug },
          undefined,
          correlationId
        );
      }

      // Check if this is a publish event with validation
      let isPublishEvent: boolean;
      try {
        isPublishEvent = detectPublishEvent(doc, previousDoc);
      } catch (error) {
        await logger.logError(
          ErrorFactory.payloadError(
            'Failed to detect publish event',
            'afterChangeHook',
            'detectPublishEvent'
          ),
          'SocialMediaHook',
          undefined,
          correlationId
        );
        return doc;
      }
      
      if (!isPublishEvent) {
        await logger.debug(
          'Not a publish event, skipping',
          'SocialMediaHook',
          { documentId: doc.id },
          undefined,
          correlationId
        );
        return doc;
      }

      // Get collection social configuration with validation
      const collectionConfig = pluginOptions.collections?.[collection.slug];
      if (!collectionConfig) {
        await logger.debug(
          `No social media configuration found for collection`,
          'SocialMediaHook',
          { collectionSlug: collection.slug },
          undefined,
          correlationId
        );
        return doc;
      }
      
      // Validate collection configuration
      if (!collectionConfig.platforms || collectionConfig.platforms.length === 0) {
        await logger.warn(
          'Collection has social media config but no platforms enabled',
          'SocialMediaHook',
          { collectionSlug: collection.slug },
          undefined,
          correlationId
        );
        return doc;
      }

      // Get social sharing data from document with error handling
      let socialData: any;
      try {
        socialData = getSocialSharingData(doc, collectionConfig.name);
      } catch (error) {
        await logger.logError(
          ErrorFactory.payloadError(
            'Failed to extract social sharing data from document',
            'afterChangeHook',
            'getSocialSharingData'
          ),
          'SocialMediaHook',
          undefined,
          correlationId
        );
        return doc;
      }
      
      if (!socialData?.autoPost) {
        await logger.debug(
          'Auto-post not enabled for document',
          'SocialMediaHook',
          { documentId: doc.id },
          undefined,
          correlationId
        );
        return doc;
      }

      // Process each enabled platform
      await processSocialMediaPosts({
        document: doc,
        socialData,
        collectionConfig,
        pluginOptions,
        req,
        collection
      });

      if (pluginOptions.debug) {
        console.log(`[SocialMediaHook] Processing complete for ${doc.id}`);
      }

      await logUtils.logServiceSuccess(
        'SocialMediaHook',
        'processAfterChange',
        undefined,
        undefined,
        correlationId
      );
      
    } catch (error) {
      await logger.logError(
        error,
        'SocialMediaHook',
        undefined,
        correlationId
      );
      
      // Don't throw error to avoid breaking document save
      // The error has been logged for debugging
    }

    return doc;
  };
}

/**
 * Detect if this is a publish event (draft -> published or create as published)
 */
function detectPublishEvent(doc: any, previousDoc?: any): boolean {
  if (!doc || typeof doc !== 'object') {
    throw ErrorFactory.validation('Document must be a valid object for publish event detection');
  }
  
  try {
    // Check if document has _status field (common in Payload)
    if ('_status' in doc) {
      // New document created as published
      if (!previousDoc && doc._status === 'published') {
        return true;
      }
      
      // Document status changed from draft to published
      if (previousDoc && typeof previousDoc === 'object' && previousDoc._status === 'draft' && doc._status === 'published') {
        return true;
      }
    }
    
    // If no _status field, check if document is new or was updated
    if (!previousDoc) {
      return true; // New document
    }
    
    // Check for explicit publishedAt field change
    if (doc.publishedAt) {
      try {
        const docDate = new Date(doc.publishedAt);
        if (!previousDoc.publishedAt) {
          return !isNaN(docDate.getTime()); // Valid new publish date
        }
        
        const prevDate = new Date(previousDoc.publishedAt);
        return !isNaN(docDate.getTime()) && !isNaN(prevDate.getTime()) && docDate > prevDate;
      } catch (dateError) {
        // Continue with other checks if date parsing fails
      }
    }
    
    return false;
  } catch (error) {
    throw ErrorFactory.payloadError(
      `Failed to detect publish event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'detectPublishEvent'
    );
  }
}

/**
 * Process social media posts for all enabled platforms
 */
async function processSocialMediaPosts({
  document,
  socialData,
  collectionConfig,
  pluginOptions,
  req,
  collection
}: {
  document: any;
  socialData: any;
  collectionConfig: any;
  pluginOptions: ExtendedSocialMediaPluginOptions;
  req: any;
  collection: any;
}): Promise<void> {
  const queue = PostingQueue.getInstance({
    debug: pluginOptions.debug,
    maxRetries: 3,
    concurrency: 3
  });

  const templateEngine = new MessageTemplateEngine();
  
  // Prepare template context
  const templateContext = {
    document,
    collection: {
      name: collection.labels?.plural || collection.slug,
      slug: collection.slug,
      label: collection.labels?.singular || collection.slug
    },
    baseUrl: getBaseUrl(req),
    customVariables: {}
  };

  // Process Twitter if enabled
  if (socialData.twitter?.enabled && pluginOptions.platforms.twitter?.enabled) {
    try {
      await processTwitterPost({
        document,
        socialData: socialData.twitter,
        collectionConfig,
        pluginOptions,
        templateContext,
        templateEngine,
        queue
      });
      
      await logger.info(
        'Twitter post processing completed',
        'SocialMediaHook',
        { documentId: document.id },
        'twitter'
      );
    } catch (error) {
      await logger.logError(
        ErrorFactory.payloadError(
          `Twitter post processing failed for document ${document.id}`,
          'processTwitterPost',
          'queuePost'
        ),
        'SocialMediaHook',
        'twitter'
      );
    }
  }

  // Process LinkedIn if enabled
  if (socialData.linkedin?.enabled && pluginOptions.platforms.linkedin?.enabled) {
    try {
      await processLinkedInPost({
        document,
        socialData: socialData.linkedin,
        collectionConfig,
        pluginOptions,
        templateContext,
        templateEngine,
        queue
      });
      
      await logger.info(
        'LinkedIn post processing completed',
        'SocialMediaHook',
        { documentId: document.id },
        'linkedin'
      );
    } catch (error) {
      await logger.logError(
        ErrorFactory.payloadError(
          `LinkedIn post processing failed for document ${document.id}`,
          'processLinkedInPost',
          'queuePost'
        ),
        'SocialMediaHook',
        'linkedin'
      );
    }
  }
}

/**
 * Process Twitter post
 */
async function processTwitterPost({
  document,
  socialData,
  collectionConfig,
  pluginOptions: _pluginOptions,
  templateContext,
  templateEngine,
  queue
}: any): Promise<void> {
  const correlationId = logger.generateCorrelationId();
  
  try {
    let message = '';
    
    // Validate inputs
    if (!document?.id) {
      throw ErrorFactory.validation('Document ID is required for Twitter post processing');
    }
    
    if (!socialData) {
      throw ErrorFactory.validation('Social data is required for Twitter post processing');
    }

  // Use custom message if provided
  if (socialData.message) {
    message = socialData.message;
  } else if (socialData.template) {
    // Find and process template
    const template = collectionConfig.templates?.find((t: any) => t.name === socialData.template);
    if (template) {
      const result = templateEngine.processTemplate(template, templateContext, 'twitter');
      message = result.message;
      
      if (result.truncated) {
        await logger.warn(
          'Twitter message was truncated due to character limit',
          'processTwitterPost',
          {
            documentId: document.id,
            originalLength: result.originalLength,
            finalLength: result.finalLength,
            templateName: template.name
          },
          'twitter',
          correlationId
        );
      }
      
      if (result.warnings?.length) {
        await logger.warn(
          `Template processing warnings: ${result.warnings.join(', ')}`,
          'processTwitterPost',
          { documentId: document.id, templateName: template.name },
          'twitter',
          correlationId
        );
      }
      
      if (result.errors?.length) {
        throw ErrorFactory.templateError(
          `Template processing errors: ${result.errors.join(', ')}`,
          template.name
        );
      }
    } else {
      throw ErrorFactory.templateError(
        `Template '${socialData.template}' not found`,
        socialData.template
      );
    }
  } else {
    // Use default template if available
    const defaultTemplate = collectionConfig.templates?.[0];
    if (defaultTemplate) {
      const result = templateEngine.processTemplate(defaultTemplate, templateContext, 'twitter');
      message = result.message;
    } else {
      console.warn(`[SocialMediaHook] No message or template configured for Twitter post`);
      return;
    }
  }

    if (!message.trim()) {
      throw ErrorFactory.validation('Generated Twitter message is empty');
    }

    // Extract media URLs if available with error handling
    let mediaUrls: string[] | undefined;
    try {
      mediaUrls = extractMediaUrls(document);
    } catch (error) {
      await logger.warn(
        'Failed to extract media URLs from document',
        'processTwitterPost',
        { documentId: document.id, error: error instanceof Error ? error.message : 'Unknown error' },
        'twitter',
        correlationId
      );
      mediaUrls = undefined;
    }

    // Add job to queue with comprehensive error handling
    let jobId: string;
    try {
      jobId = await queue.addJob({
        documentId: document.id,
        collectionSlug: templateContext.collection.slug,
        platform: 'twitter',
        message: message.trim(),
        mediaUrls,
        scheduledAt: socialData.scheduledAt ? new Date(socialData.scheduledAt) : undefined,
        maxAttempts: 3
      });
    } catch (error) {
      throw ErrorFactory.queueError(
        'Failed to add Twitter post to queue',
        undefined,
        undefined
      );
    }

    await logger.info(
      'Twitter job queued successfully',
      'processTwitterPost',
      {
        documentId: document.id,
        jobId,
        messageLength: message.trim().length,
        hasMedia: mediaUrls && mediaUrls.length > 0
      },
      'twitter',
      correlationId
    );
    
  } catch (error) {
    await logger.logError(
      error,
      'processTwitterPost',
      'twitter',
      correlationId
    );
    throw error;
  }
}

/**
 * Process LinkedIn post
 */
async function processLinkedInPost({
  document,
  socialData,
  collectionConfig,
  pluginOptions: _pluginOptions,
  templateContext,
  templateEngine,
  queue
}: any): Promise<void> {
  const correlationId = logger.generateCorrelationId();
  
  try {
    // Validate inputs
    if (!document?.id) {
      throw ErrorFactory.validation('Document ID is required for LinkedIn post processing');
    }
    
    if (!socialData) {
      throw ErrorFactory.validation('Social data is required for LinkedIn post processing');
    }
    
    let message = '';

  // Use custom message if provided
  if (socialData.message) {
    message = socialData.message;
  } else if (socialData.template) {
    // Find and process template
    const template = collectionConfig.templates?.find((t: any) => t.name === socialData.template);
    if (template) {
      const result = templateEngine.processTemplate(template, templateContext, 'linkedin');
      message = result.message;
      
      if (result.truncated) {
        await logger.warn(
          'LinkedIn message was truncated due to character limit',
          'processLinkedInPost',
          {
            documentId: document.id,
            originalLength: result.originalLength,
            finalLength: result.finalLength,
            templateName: template.name
          },
          'linkedin',
          correlationId
        );
      }
      
      if (result.warnings?.length) {
        await logger.warn(
          `Template processing warnings: ${result.warnings.join(', ')}`,
          'processLinkedInPost',
          { documentId: document.id, templateName: template.name },
          'linkedin',
          correlationId
        );
      }
      
      if (result.errors?.length) {
        throw ErrorFactory.templateError(
          `Template processing errors: ${result.errors.join(', ')}`,
          template.name
        );
      }
    } else {
      throw ErrorFactory.templateError(
        `Template '${socialData.template}' not found`,
        socialData.template
      );
    }
  } else {
    // Use default template if available
    const defaultTemplate = collectionConfig.templates?.[0];
    if (defaultTemplate) {
      const result = templateEngine.processTemplate(defaultTemplate, templateContext, 'linkedin');
      message = result.message;
    } else {
      console.warn(`[SocialMediaHook] No message or template configured for LinkedIn post`);
      return;
    }
  }

    if (!message.trim()) {
      throw ErrorFactory.validation('Generated LinkedIn message is empty');
    }

    // Extract media URLs if available with error handling
    let mediaUrls: string[] | undefined;
    try {
      mediaUrls = extractMediaUrls(document);
    } catch (error) {
      await logger.warn(
        'Failed to extract media URLs from document',
        'processLinkedInPost',
        { documentId: document.id, error: error instanceof Error ? error.message : 'Unknown error' },
        'linkedin',
        correlationId
      );
      mediaUrls = undefined;
    }

    // Add job to queue with comprehensive error handling
    let jobId: string;
    try {
      jobId = await queue.addJob({
        documentId: document.id,
        collectionSlug: templateContext.collection.slug,
        platform: 'linkedin',
        message: message.trim(),
        mediaUrls,
        scheduledAt: socialData.scheduledAt ? new Date(socialData.scheduledAt) : undefined,
        maxAttempts: 3
      });
    } catch (error) {
      throw ErrorFactory.queueError(
        'Failed to add LinkedIn post to queue',
        undefined,
        undefined
      );
    }

    await logger.info(
      'LinkedIn job queued successfully',
      'processLinkedInPost',
      {
        documentId: document.id,
        jobId,
        messageLength: message.trim().length,
        hasMedia: mediaUrls && mediaUrls.length > 0
      },
      'linkedin',
      correlationId
    );
    
  } catch (error) {
    await logger.logError(
      error,
      'processLinkedInPost',
      'linkedin',
      correlationId
    );
    throw error;
  }
}

/**
 * Extract media URLs from document content with comprehensive error handling
 */
function extractMediaUrls(document: any): string[] | undefined {
  if (!document || typeof document !== 'object') {
    throw ErrorFactory.validation('Document must be a valid object for media URL extraction');
  }
  
  const mediaUrls: string[] = [];

  try {
    // Check common image field names
    const imageFields = ['image', 'images', 'featuredImage', 'cover', 'thumbnail'];
    
    for (const fieldName of imageFields) {
      try {
        const field = document[fieldName];
        
        if (!field) continue;
        
        // Handle single image
        if (typeof field === 'object' && field !== null && field.url) {
          if (typeof field.url === 'string' && field.url.trim()) {
            // Validate URL format
            if (isValidUrl(field.url)) {
              mediaUrls.push(field.url);
            }
          }
        }
        
        // Handle image array
        if (Array.isArray(field)) {
          for (const item of field) {
            if (typeof item === 'object' && item !== null && item.url) {
              if (typeof item.url === 'string' && item.url.trim()) {
                // Validate URL format
                if (isValidUrl(item.url)) {
                  mediaUrls.push(item.url);
                }
              }
            }
          }
        }
      } catch (fieldError) {
        // Continue processing other fields if one fails
        continue;
      }
    }

    // Extract images from rich text content with error handling
    if (document.content) {
      try {
        const richTextImages = extractImagesFromRichText(document.content);
        mediaUrls.push(...richTextImages);
      } catch (richTextError) {
        // Continue without rich text images if extraction fails
      }
    }

    return mediaUrls.length > 0 ? mediaUrls : undefined;
  } catch (error) {
    // Log error but don't throw to avoid breaking the entire process
    logger.warn(
      'Error during media URL extraction',
      'extractMediaUrls',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    ).catch(() => {}); // Ignore logging errors
    
    return undefined;
  }
}

/**
 * Extract image URLs from rich text content with error handling
 */
function extractImagesFromRichText(content: any): string[] {
  const images: string[] = [];
  
  if (!content) return images;
  
  try {
  
    // Handle different rich text formats
    if (Array.isArray(content)) {
      for (const block of content) {
        try {
          if (block && typeof block === 'object') {
            if (block.type === 'image' && block.value?.url) {
              if (typeof block.value.url === 'string' && isValidUrl(block.value.url)) {
                images.push(block.value.url);
              }
            }
            
            // Handle nested blocks
            if (block.children) {
              images.push(...extractImagesFromRichText(block.children));
            }
          }
        } catch (blockError) {
          // Continue processing other blocks
          continue;
        }
      }
    } else if (typeof content === 'object' && content !== null && content.children) {
      images.push(...extractImagesFromRichText(content.children));
    }
  } catch (error) {
    // Return whatever images we found so far
  }
  
  return images;
}

/**
 * Get base URL from request with validation
 */
function getBaseUrl(req: any): string | undefined {
  if (!req) return undefined;
  
  try {
    // Try to get from headers
    if (req.headers && typeof req.headers === 'object') {
      const protocol = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      
      if (host && typeof host === 'string' && host.trim()) {
        const baseUrl = `${protocol}://${host.trim()}`;
        // Validate the constructed URL
        if (isValidUrl(baseUrl)) {
          return baseUrl;
        }
      }
    }
    
    // Fallback to environment variable
    const envUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL;
    if (envUrl && typeof envUrl === 'string' && isValidUrl(envUrl.trim())) {
      return envUrl.trim();
    }
    
    return undefined;
  } catch (error) {
    // Return undefined if anything fails
    return undefined;
  }
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