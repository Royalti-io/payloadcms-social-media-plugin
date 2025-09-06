/**
 * Post Processor Utility
 * 
 * This utility provides content formatting and processing for different social media platforms.
 * It handles platform-specific character limits, content formatting, and media processing.
 */

/**
 * Social media platform configuration
 */
export interface PlatformConfig {
  name: string;
  characterLimit: number;
  supportsMedia: boolean;
  supportsRichContent: boolean;
  mediaTypes: string[];
  maxMediaCount: number;
}

/**
 * Content processing options
 */
export interface ProcessingOptions {
  platform: 'twitter' | 'linkedin';
  content: string;
  media?: Array<{
    data: Buffer | Uint8Array;
    mediaType: string;
    altText?: string;
    title?: string;
  }>;
  metadata?: {
    title?: string;
    excerpt?: string;
    url?: string;
    author?: string;
    date?: string;
    tags?: string[];
    category?: string;
  };
  template?: string;
  organizationPosting?: boolean;
}

/**
 * Processed content result
 */
export interface ProcessedContent {
  text: string;
  truncated: boolean;
  originalLength: number;
  finalLength: number;
  media?: Array<{
    data: Buffer | Uint8Array;
    mediaType: string;
    altText?: string;
    title?: string;
  }> | undefined;
  warnings: string[];
  platform: string;
}

/**
 * Template variable replacement
 */
export interface TemplateVariables {
  title?: string;
  excerpt?: string;
  url?: string;
  author?: string;
  date?: string;
  tags?: string;
  category?: string;
  [key: string]: any;
}

/**
 * Platform configurations
 */
export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  twitter: {
    name: 'Twitter/X',
    characterLimit: 280,
    supportsMedia: true,
    supportsRichContent: false,
    mediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'],
    maxMediaCount: 4
  },
  linkedin: {
    name: 'LinkedIn',
    characterLimit: 3000,
    supportsMedia: true,
    supportsRichContent: true,
    mediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'],
    maxMediaCount: 9
  }
};

/**
 * Post Processor Class
 */
export class PostProcessor {
  /**
   * Process a social media job from the queue
   */
  async processJob(job: any): Promise<void> {
    // Note: Import social media services when actually implementing API calls
    // const { TwitterService } = await import('../services/twitter');
    // const { LinkedInService } = await import('../services/linkedin');

    try {
      switch (job.platform) {
        case 'twitter':
          await this.processTwitterJob(job);
          break;
        case 'linkedin':
          await this.processLinkedInJob(job);
          break;
        default:
          throw new Error(`Unsupported platform: ${job.platform}`);
      }
    } catch (error) {
      console.error(`[PostProcessor] Error processing ${job.platform} job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Process a Twitter job
   */
  private async processTwitterJob(job: any): Promise<void> {
    // For now, just simulate the posting
    // In a real implementation, this would call Twitter API
    console.log(`[PostProcessor] Processing Twitter job: ${job.message}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // You would implement actual Twitter API call here
    // const twitterService = new TwitterService();
    // await twitterService.post(job.message, job.mediaUrls);
  }

  /**
   * Process a LinkedIn job
   */
  private async processLinkedInJob(job: any): Promise<void> {
    // For now, just simulate the posting
    // In a real implementation, this would call LinkedIn API
    console.log(`[PostProcessor] Processing LinkedIn job: ${job.message}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // You would implement actual LinkedIn API call here
    // const linkedinService = new LinkedInService();
    // await linkedinService.post(job.message, job.mediaUrls);
  }
  /**
   * Process content for a specific social media platform
   */
  static processContent(options: ProcessingOptions): ProcessedContent {
    const platformConfig = PLATFORM_CONFIGS[options.platform];
    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${options.platform}`);
    }

    let content = options.content;
    const warnings: string[] = [];
    const originalLength = content.length;

    // Apply template if provided
    if (options.template) {
      content = this.applyTemplate(options.template, this.extractTemplateVariables(options));
    }

    // Platform-specific formatting
    content = this.applyPlatformFormatting(content, options.platform, options);

    // Handle character limits
    let truncated = false;
    if (content.length > platformConfig.characterLimit) {
      content = this.truncateContent(content, platformConfig.characterLimit, options.platform);
      truncated = true;
      warnings.push(`Content truncated from ${originalLength} to ${content.length} characters`);
    }

    // Process media
    let processedMedia = options.media;
    if (processedMedia && processedMedia.length > platformConfig.maxMediaCount) {
      processedMedia = processedMedia.slice(0, platformConfig.maxMediaCount);
      warnings.push(`Media count reduced from ${options.media!.length} to ${platformConfig.maxMediaCount} files`);
    }

    // Validate media types
    if (processedMedia) {
      processedMedia = processedMedia.filter(media => {
        if (!platformConfig.mediaTypes.includes(media.mediaType)) {
          warnings.push(`Unsupported media type ${media.mediaType} removed`);
          return false;
        }
        return true;
      });
    }

    return {
      text: content,
      truncated,
      originalLength,
      finalLength: content.length,
      media: processedMedia || undefined,
      warnings,
      platform: platformConfig.name
    };
  }

  /**
   * Apply template to content with variable replacement
   */
  static applyTemplate(template: string, variables: TemplateVariables): string {
    let result = template;

    // Replace template variables
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
        result = result.replace(regex, String(value));
      }
    }

    // Remove any unreplaced template variables
    result = result.replace(/{{[^}]+}}/g, '');

    // Clean up extra whitespace
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * Extract template variables from processing options
   */
  static extractTemplateVariables(options: ProcessingOptions): TemplateVariables {
    const variables: TemplateVariables = {};

    if (options.metadata) {
      Object.assign(variables, options.metadata);
    }

    // Format date if provided
    if (variables.date) {
      const date = new Date(variables.date);
      variables.date = date.toLocaleDateString();
    }

    // Format tags if provided
    if (variables.tags && Array.isArray(variables.tags)) {
      const tags = variables.tags as string[];
      variables.tags = tags.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');
    }

    return variables;
  }

  /**
   * Apply platform-specific formatting
   */
  static applyPlatformFormatting(
    content: string, 
    platform: string, 
    options: ProcessingOptions
  ): string {
    switch (platform) {
      case 'twitter':
        return this.formatForTwitter(content, options);
      case 'linkedin':
        return this.formatForLinkedIn(content, options);
      default:
        return content;
    }
  }

  /**
   * Format content for Twitter
   */
  private static formatForTwitter(content: string, _options: ProcessingOptions): string {
    // Twitter-specific formatting
    let formatted = content;

    // Ensure URLs are properly spaced
    formatted = formatted.replace(/(\S)(https?:\/\/)/gi, '$1 $2');
    
    // Clean up multiple spaces
    formatted = formatted.replace(/\s+/g, ' ').trim();

    // Add thread indicator if content will be too long
    if (formatted.length > 270 && !formatted.includes('(1/')) {
      // This is a simple check - in production you might want to split into threads
    }

    return formatted;
  }

  /**
   * Format content for LinkedIn
   */
  private static formatForLinkedIn(content: string, options: ProcessingOptions): string {
    // LinkedIn-specific formatting
    let formatted = content;

    // LinkedIn supports richer formatting
    
    // Format professional-style paragraphs
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    // Ensure proper spacing around URLs
    formatted = formatted.replace(/(\S)(https?:\/\/)/gi, '$1 $2');
    
    // Add professional context if organization posting
    if (options.organizationPosting && options.metadata?.title) {
      // Add subtle professional framing
      const lines = formatted.split('\n');
      if (lines.length > 1 && lines[0] && !lines[0].includes(':')) {
        lines[0] = lines[0].endsWith('.') ? lines[0] : lines[0] + '.';
      }
      formatted = lines.join('\n');
    }

    // Clean up spacing
    formatted = formatted.replace(/\s+/g, ' ').replace(/\n\s+/g, '\n').trim();

    // Add call-to-action if URL is present but no explicit CTA
    const metadataUrl = options.metadata?.url;
    if (metadataUrl && !formatted.toLowerCase().includes('read more') && 
        !formatted.toLowerCase().includes('learn more') && 
        !formatted.toLowerCase().includes('check out')) {
      
      if (!formatted.endsWith(metadataUrl)) {
        formatted += `\n\nRead more: ${metadataUrl}`;
      }
    }

    return formatted;
  }

  /**
   * Truncate content intelligently for platform limits
   */
  static truncateContent(content: string, limit: number, platform: string): string {
    if (content.length <= limit) {
      return content;
    }

    // Reserve space for ellipsis or platform-specific indicators
    const reserveSpace = platform === 'twitter' ? 4 : 3; // "..." or "... 🧵"
    const targetLength = limit - reserveSpace;

    // Try to break at sentence boundaries
    const sentences = content.split(/[.!?]+/);
    let result = '';
    
    for (const sentence of sentences) {
      const potentialResult = result + sentence + '.';
      if (potentialResult.length <= targetLength) {
        result = potentialResult;
      } else {
        break;
      }
    }

    // If no good sentence break found, break at word boundaries
    if (result.length < targetLength * 0.8) {
      const words = content.split(/\s+/);
      result = '';
      
      for (const word of words) {
        const potentialResult = result + (result ? ' ' : '') + word;
        if (potentialResult.length <= targetLength) {
          result = potentialResult;
        } else {
          break;
        }
      }
    }

    // Add appropriate indicator
    if (platform === 'twitter' && content.length > limit * 1.5) {
      result += '... 🧵'; // Thread indicator
    } else {
      result += '...';
    }

    return result;
  }

  /**
   * Validate content for a platform
   */
  static validateContent(content: string, platform: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const platformConfig = PLATFORM_CONFIGS[platform];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!platformConfig) {
      errors.push(`Unsupported platform: ${platform}`);
      return { valid: false, errors, warnings };
    }

    // Check content length
    if (!content || content.trim().length === 0) {
      errors.push('Content cannot be empty');
    }

    if (content.length > platformConfig.characterLimit) {
      warnings.push(`Content exceeds ${platformConfig.characterLimit} character limit (${content.length} characters)`);
    }

    // Platform-specific validations
    if (platform === 'twitter') {
      // Check for common Twitter issues
      if (content.split('@').length - 1 > 10) {
        warnings.push('Too many mentions may reduce post visibility');
      }
      
      if (content.split('#').length - 1 > 2) {
        warnings.push('Too many hashtags may reduce post visibility');
      }
    }

    if (platform === 'linkedin') {
      // LinkedIn professional guidelines
      if (content.toLowerCase().includes('buy now') || content.toLowerCase().includes('click here')) {
        warnings.push('Direct sales language may reduce professional engagement');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate platform-optimized hashtags
   */
  static generateHashtags(
    tags: string[], 
    platform: string, 
    maxCount?: number
  ): string[] {
    if (!tags || tags.length === 0) {
      return [];
    }

    // Platform-specific hashtag limits
    const limits = {
      twitter: maxCount || 2,
      linkedin: maxCount || 5
    };

    const limit = limits[platform as keyof typeof limits] || 3;

    // Clean and format hashtags
    const cleanedTags = tags
      .map(tag => tag.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(tag => tag.length > 0 && tag.length <= 20)
      .slice(0, limit)
      .map(tag => `#${tag}`);

    return cleanedTags;
  }

  /**
   * Estimate post engagement potential
   */
  static estimateEngagement(content: string, platform: string): {
    score: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 50; // Base score

    const wordCount = content.split(/\s+/).length;
    
    if (platform === 'twitter') {
      // Twitter engagement factors
      if (wordCount >= 10 && wordCount <= 20) {
        score += 10;
        factors.push('Optimal word count for Twitter');
      }
      
      if (content.includes('?')) {
        score += 5;
        factors.push('Question increases engagement');
      }
      
      if (content.includes('#') && (content.split('#').length - 1) <= 2) {
        score += 5;
        factors.push('Appropriate hashtag usage');
      }
    }

    if (platform === 'linkedin') {
      // LinkedIn engagement factors
      if (wordCount >= 50 && wordCount <= 200) {
        score += 15;
        factors.push('Optimal length for LinkedIn');
      }
      
      if (content.includes('\n\n')) {
        score += 5;
        factors.push('Well-structured paragraphs');
      }
      
      if (/professional|industry|insight|experience/i.test(content)) {
        score += 10;
        factors.push('Professional language detected');
      }
    }

    // Universal factors
    if (content.includes('http')) {
      score += 5;
      factors.push('External link increases shareability');
    }

    // Cap score
    score = Math.min(100, Math.max(0, score));

    return { score, factors };
  }
}