/**
 * Message Template Engine
 * 
 * Processes message templates with variable substitution and platform-specific formatting.
 */

import type { MessageTemplate, SocialPlatform } from '../types';
import { SocialMediaError, ErrorFactory } from '../services/errors';

/**
 * Template processing context
 */
export interface TemplateContext {
  document: Record<string, any>;
  collection: {
    name: string;
    slug: string;
    label?: string;
  };
  baseUrl?: string;
  customVariables?: Record<string, any>;
}

/**
 * Template processing result
 */
export interface TemplateResult {
  message: string;
  truncated: boolean;
  originalLength: number;
  finalLength: number;
  platform: SocialPlatform;
  warnings?: string[];
  errors?: string[];
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  isValid: boolean;
  errors: Array<{type: 'error' | 'warning'; field?: string; message: string; code?: string}>;
  warnings: Array<{type: 'error' | 'warning'; field?: string; message: string; code?: string}>;
  usedVariables: string[];
  unusedVariables: string[];
}

/**
 * Template processing options
 */
export interface TemplateProcessingOptions {
  strict?: boolean;
  allowUnknownVariables?: boolean;
  platformLimits?: Partial<Record<SocialPlatform, number>>;
  truncationStrategy?: 'smart' | 'hard' | 'error';
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  description: string;
  resolver: (context: TemplateContext) => string | undefined;
}

/**
 * Message template engine for processing templates with variable substitution
 */
export class MessageTemplateEngine {
  private customVariables: Map<string, TemplateVariable> = new Map();
  private platformLimits: Record<SocialPlatform, number> = {
    twitter: 280,
    linkedin: 3000
  };

  constructor() {
    this.initializeDefaultVariables();
  }

  /**
   * Initialize default template variables
   */
  private initializeDefaultVariables(): void {
    const defaultVariables: TemplateVariable[] = [
      {
        name: 'title',
        description: 'Document title',
        resolver: (context) => this.getNestedValue(context.document, 'title')
      },
      {
        name: 'excerpt',
        description: 'Document excerpt or summary',
        resolver: (context) => this.getNestedValue(context.document, 'excerpt') || 
                               this.getNestedValue(context.document, 'summary') ||
                               this.getNestedValue(context.document, 'description')
      },
      {
        name: 'url',
        description: 'Document URL',
        resolver: (context) => {
          const slug = this.getNestedValue(context.document, 'slug');
          if (slug && context.baseUrl) {
            return `${context.baseUrl}/${context.collection.slug}/${slug}`;
          }
          return context.customVariables?.url;
        }
      },
      {
        name: 'author',
        description: 'Document author name',
        resolver: (context) => {
          const author = this.getNestedValue(context.document, 'author');
          if (typeof author === 'object' && author?.name) {
            return author.name;
          }
          if (typeof author === 'string') {
            return author;
          }
          return this.getNestedValue(context.document, 'createdBy.name');
        }
      },
      {
        name: 'category',
        description: 'Document category',
        resolver: (context) => {
          const category = this.getNestedValue(context.document, 'category');
          if (typeof category === 'object' && category?.name) {
            return category.name;
          }
          if (typeof category === 'string') {
            return category;
          }
          return this.getNestedValue(context.document, 'categories.0.name');
        }
      },
      {
        name: 'tags',
        description: 'Document tags (comma-separated)',
        resolver: (context) => {
          const tags = this.getNestedValue(context.document, 'tags');
          if (Array.isArray(tags)) {
            return tags.map(tag => 
              typeof tag === 'object' ? tag.name || tag.title : tag
            ).filter(Boolean).join(', ');
          }
          return undefined;
        }
      },
      {
        name: 'createdAt',
        description: 'Document creation date',
        resolver: (context) => {
          const date = this.getNestedValue(context.document, 'createdAt');
          return date ? new Date(date).toLocaleDateString() : undefined;
        }
      },
      {
        name: 'updatedAt',
        description: 'Document update date',
        resolver: (context) => {
          const date = this.getNestedValue(context.document, 'updatedAt');
          return date ? new Date(date).toLocaleDateString() : undefined;
        }
      },
      {
        name: 'collection.name',
        description: 'Collection display name',
        resolver: (context) => context.collection.label || context.collection.name
      },
      {
        name: 'collection.slug',
        description: 'Collection slug',
        resolver: (context) => context.collection.slug
      }
    ];

    defaultVariables.forEach(variable => {
      this.customVariables.set(variable.name, variable);
    });
  }

  /**
   * Add a custom template variable
   */
  public addCustomVariable(name: string, resolver: (context: TemplateContext) => string | undefined, description?: string): void {
    this.customVariables.set(name, {
      name,
      description: description || `Custom variable: ${name}`,
      resolver
    });
  }

  /**
   * Process a template with the given context and comprehensive validation
   */
  public processTemplate(
    template: MessageTemplate,
    context: TemplateContext,
    platform: SocialPlatform,
    options: TemplateProcessingOptions = {}
  ): TemplateResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    try {
      // Validate inputs
      this.validateTemplateInputs(template, context, platform, options);
      
      let message = template.template;
      const originalLength = message.length;

      // Replace all variables with error handling
      const variableRegex = /\{\{([^}]+)\}\}/g;
      message = message.replace(variableRegex, (match, variableName) => {
        const trimmedName = variableName.trim();
        
        try {
          const variable = this.customVariables.get(trimmedName);
          
          if (variable) {
            const value = variable.resolver(context);
            if (value !== undefined && value !== null) {
              return String(value);
            }
          }
          
          // Handle custom variables from context
          if (context.customVariables && context.customVariables[trimmedName] !== undefined) {
            const value = context.customVariables[trimmedName];
            if (value !== undefined && value !== null) {
              return String(value);
            }
          }
          
          // Variable not found or resolved to null/undefined
          if (!options.allowUnknownVariables) {
            warnings.push(`Unknown or empty variable: {{${trimmedName}}}`);
          }
          
          return match; // Keep original placeholder
        } catch (error) {
          warnings.push(`Error resolving variable {{${trimmedName}}}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return match;
        }
      });

      // Check for malformed variables after processing
      const malformedVars = this.findMalformedVariables(message);
      if (malformedVars.length > 0) {
        warnings.push(`Malformed variable syntax found: ${malformedVars.join(', ')}`);
      }

      // Apply platform-specific formatting
      try {
        message = this.applyPlatformFormatting(message, platform);
      } catch (error) {
        warnings.push(`Platform formatting error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Handle character limits
      const characterLimit = options.platformLimits?.[platform] || this.platformLimits[platform];
      let truncated = false;
      
      if (message.length > characterLimit) {
        const truncationStrategy = options.truncationStrategy || 'smart';
        
        if (truncationStrategy === 'error') {
          throw ErrorFactory.validation(
            `Message exceeds ${platform} character limit (${message.length}/${characterLimit})`
          );
        }
        
        try {
          message = this.performTruncation(message, characterLimit, platform, truncationStrategy);
          truncated = true;
        } catch (error) {
          errors.push(`Truncation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Fallback to hard truncation
          message = message.substring(0, characterLimit - 3) + '...';
          truncated = true;
        }
      }

      return {
        message,
        truncated,
        originalLength,
        finalLength: message.length,
        platform,
        warnings: warnings.length > 0 ? warnings : [],
        errors: errors.length > 0 ? errors : []
      };
    } catch (error) {
      const socialError = error instanceof SocialMediaError 
        ? error 
        : ErrorFactory.validation(`Template processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw socialError;
    }
  }

  /**
   * Apply platform-specific formatting
   */
  private applyPlatformFormatting(message: string, platform: SocialPlatform): string {
    switch (platform) {
      case 'twitter':
        // Convert hashtags to Twitter format
        message = message.replace(/#(\w+)/g, '#$1');
        // Ensure URLs are properly spaced
        message = message.replace(/(\S)(https?:\/\/)/g, '$1 $2');
        break;
        
      case 'linkedin':
        // LinkedIn supports rich text formatting
        // Convert **bold** to LinkedIn format if needed
        // For now, keep as plain text
        break;
    }
    
    return message;
  }

  /**
   * Smart truncation that preserves words and URLs
   */
  private smartTruncate(message: string, limit: number, _platform: SocialPlatform): string {
    if (message.length <= limit) {
      return message;
    }

    // Reserve space for ellipsis and potential URL shortening
    const ellipsis = '...';
    const workingLimit = limit - ellipsis.length;

    // Try to truncate at word boundaries
    const words = message.split(' ');
    let truncated = '';
    
    for (let i = 0; i < words.length; i++) {
      const testString = truncated + (i > 0 ? ' ' : '') + words[i];
      
      if (testString.length <= workingLimit) {
        truncated = testString;
      } else {
        break;
      }
    }

    // If we couldn't fit any words, do hard truncation
    if (!truncated) {
      truncated = message.substring(0, workingLimit);
    }

    return truncated + ellipsis;
  }

  /**
   * Validate a template for syntax errors and missing variables
   */
  public validateTemplate(template: MessageTemplate, availableVariables?: string[]): Array<{type: 'error' | 'warning'; message: string}> {
    const issues: Array<{type: 'error' | 'warning'; message: string}> = [];
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const foundVariables: Set<string> = new Set();
    
    let match;
    while ((match = variableRegex.exec(template.template)) !== null) {
      const variableName = match[1]?.trim();
      if (!variableName) continue;
      foundVariables.add(variableName);
      
      // Check if variable exists
      const hasVariable = this.customVariables.has(variableName) ||
                         (availableVariables?.includes(variableName) ?? false);
      
      if (!hasVariable) {
        issues.push({
          type: 'warning',
          message: `Unknown variable: {{${variableName}}}`
        });
      }
    }

    // Check for malformed variable syntax
    const malformedRegex = /\{[^{}]*\}(?!\})/g;
    const malformedMatches = template.template.match(malformedRegex);
    if (malformedMatches) {
      issues.push({
        type: 'error',
        message: `Malformed variable syntax found: ${malformedMatches.join(', ')}`
      });
    }

    // Check template length with placeholder values
    const testContext: TemplateContext = {
      document: {
        title: 'Sample Title',
        excerpt: 'Sample excerpt text that represents typical content length',
        slug: 'sample-slug'
      },
      collection: { name: 'Sample Collection', slug: 'sample' },
      baseUrl: 'https://example.com'
    };

    const twitterResult = this.processTemplate(template, testContext, 'twitter');
    if (twitterResult.truncated) {
      issues.push({
        type: 'warning',
        message: `Template may be too long for Twitter (estimated ${twitterResult.originalLength} chars, limit 280)`
      });
    }

    return issues;
  }

  /**
   * Get available template variables
   */
  public getAvailableVariables(): TemplateVariable[] {
    return Array.from(this.customVariables.values());
  }

  /**
   * Extract variables from a template string
   */
  public extractVariables(template: string): string[] {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = variableRegex.exec(template)) !== null) {
      const variableName = match[1]?.trim();
      if (variableName && !variables.includes(variableName)) {
        variables.push(variableName);
      }
    }
    
    return variables;
  }

  /**
   * Get nested object value using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Set platform character limit
   */
  public setPlatformLimit(platform: SocialPlatform, limit: number): void {
    this.platformLimits[platform] = limit;
  }

  /**
   * Get platform character limit
   */
  public getPlatformLimit(platform: SocialPlatform): number {
    return this.platformLimits[platform];
  }

  /**
   * Validate template processing inputs
   */
  private validateTemplateInputs(
    template: MessageTemplate,
    context: TemplateContext,
    platform: SocialPlatform,
    options: TemplateProcessingOptions
  ): void {
    if (!template || typeof template !== 'object') {
      throw ErrorFactory.validation('Template must be a valid object');
    }
    
    if (!template.template || typeof template.template !== 'string') {
      throw ErrorFactory.validation('Template content is required and must be a string');
    }
    
    if (!context || typeof context !== 'object') {
      throw ErrorFactory.validation('Template context must be a valid object');
    }
    
    if (!platform || !['twitter', 'linkedin'].includes(platform)) {
      throw ErrorFactory.validation('Platform must be either "twitter" or "linkedin"');
    }
    
    // Validate options if provided
    if (options.platformLimits) {
      Object.entries(options.platformLimits).forEach(([plat, limit]) => {
        if (!['twitter', 'linkedin'].includes(plat)) {
          throw ErrorFactory.validation(`Invalid platform in platformLimits: ${plat}`);
        }
        if (typeof limit !== 'number' || limit < 1) {
          throw ErrorFactory.validation(`Platform limit for ${plat} must be a positive number`);
        }
      });
    }
    
    if (options.truncationStrategy && !['smart', 'hard', 'error'].includes(options.truncationStrategy)) {
      throw ErrorFactory.validation('Truncation strategy must be one of: smart, hard, error');
    }
  }

  /**
   * Find malformed variable syntax in a string
   */
  private findMalformedVariables(text: string): string[] {
    const malformedVars: string[] = [];
    
    // Find single braces that might be malformed variables
    const singleBraceRegex = /\{[^{}]*\}(?!\})/g;
    const matches = text.match(singleBraceRegex);
    
    if (matches) {
      matches.forEach(match => {
        // Skip if it's actually part of a valid double brace
        if (!text.includes(`{${match}`) && !text.includes(`${match}}`)) {
          malformedVars.push(match);
        }
      });
    }
    
    // Find unmatched opening braces
    const unmatchedOpenRegex = /\{\{[^}]*$/g;
    const unmatchedOpen = text.match(unmatchedOpenRegex);
    if (unmatchedOpen) {
      malformedVars.push(...unmatchedOpen);
    }
    
    // Find unmatched closing braces
    const unmatchedCloseRegex = /^[^{]*\}\}/g;
    const unmatchedClose = text.match(unmatchedCloseRegex);
    if (unmatchedClose) {
      malformedVars.push(...unmatchedClose);
    }
    
    return malformedVars;
  }

  /**
   * Perform truncation based on strategy
   */
  private performTruncation(
    message: string,
    limit: number,
    platform: SocialPlatform,
    strategy: 'smart' | 'hard'
  ): string {
    if (strategy === 'hard') {
      return message.substring(0, limit - 3) + '...';
    }
    
    // Smart truncation (existing smartTruncate method)
    return this.smartTruncate(message, limit, platform);
  }
}