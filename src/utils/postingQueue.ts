/**
 * Posting Queue Utility
 * 
 * Manages background processing of social media posts with retry logic and concurrency control.
 */

import type { SocialPlatform } from '../types';
import { SocialMediaError, ErrorHandler, ErrorCodes } from '../services/errors';

/**
 * Job status enumeration
 */
export enum JobStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Social media post job definition
 */
export interface PostJob {
  id: string;
  documentId: string;
  collectionSlug: string;
  platform: SocialPlatform;
  message: string;
  mediaUrls?: string[];
  scheduledAt?: Date;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  errorDetails?: Record<string, any>;
  errorCode?: string;
  isRetryable?: boolean;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  nextRetryAt?: Date;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  totalJobs: number;
  queuedJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
}

/**
 * Queue processing options
 */
export interface QueueOptions {
  concurrency?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
  backoffMultiplier?: number;
  cleanupIntervalMs?: number;
  maxJobAgeMs?: number;
  debug?: boolean;
  logger?: Console;
  onJobSuccess?: (job: PostJob) => void;
  onJobFailure?: (job: PostJob, error: any) => void;
  onJobRetry?: (job: PostJob, attempt: number, error: any) => void;
}

/**
 * Job validation error
 */
export interface JobValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Enhanced queue statistics with error breakdown
 */
export interface EnhancedQueueStats extends QueueStats {
  averageProcessingTime: number;
  errorBreakdown: Record<string, number>;
  retryableErrors: number;
  permanentErrors: number;
  oldestQueuedJob?: Date;
  newestQueuedJob?: Date;
}

/**
 * In-memory posting queue with background processing
 */
export class PostingQueue {
  private static instance: PostingQueue | null = null;
  
  private jobs: Map<string, PostJob> = new Map();
  private processing: Set<string> = new Set();
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private readonly options: Required<Omit<QueueOptions, 'onJobSuccess' | 'onJobFailure' | 'onJobRetry' | 'logger'>> & {
    logger: Console;
    onJobSuccess?: (job: PostJob) => void;
    onJobFailure?: (job: PostJob, error: any) => void;
    onJobRetry?: (job: PostJob, attempt: number, error: any) => void;
  };
  private processingStats: Map<string, { startTime: number; endTime?: number }> = new Map();
  
  private constructor(options: QueueOptions = {}) {
    this.options = {
      concurrency: options.concurrency || 3,
      maxRetries: options.maxRetries || 3,
      retryDelayMs: options.retryDelayMs || 5000,
      maxRetryDelayMs: options.maxRetryDelayMs || 300000, // 5 minutes
      backoffMultiplier: options.backoffMultiplier || 2,
      cleanupIntervalMs: options.cleanupIntervalMs || 60000, // 1 minute
      maxJobAgeMs: options.maxJobAgeMs || 86400000, // 24 hours
      debug: options.debug || false,
      logger: options.logger || console,
      onJobSuccess: options.onJobSuccess !== undefined ? options.onJobSuccess : undefined,
      onJobFailure: options.onJobFailure !== undefined ? options.onJobFailure : undefined,
      onJobRetry: options.onJobRetry !== undefined ? options.onJobRetry : undefined
    };
    
    this.startProcessing();
    this.startCleanup();
  }

  /**
   * Get singleton instance of the posting queue
   */
  public static getInstance(options?: QueueOptions): PostingQueue {
    if (!PostingQueue.instance) {
      PostingQueue.instance = new PostingQueue(options);
    }
    return PostingQueue.instance;
  }

  /**
   * Add a job to the queue with comprehensive validation
   */
  public async addJob(job: Omit<PostJob, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Validate job before adding to queue
      this.validateJobInput(job);
      
      const jobId = this.generateJobId();
      
      const newJob: PostJob = {
        ...job,
        id: jobId,
        status: job.scheduledAt && job.scheduledAt > new Date() ? JobStatus.QUEUED : JobStatus.QUEUED,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.jobs.set(jobId, newJob);
      
      if (this.options.debug) {
        this.options.logger.log(`[PostingQueue] Job ${jobId} added to queue for ${job.platform}`);
      }
      
      return jobId;
    } catch (error) {
      const socialError = ErrorHandler.handle(error, this.options.logger, 'PostingQueue.addJob');
      throw socialError;
    }
  }

  /**
   * Get job by ID
   */
  public getJob(jobId: string): PostJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Cancel a job
   */
  public cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === JobStatus.PROCESSING) {
      return false;
    }
    
    job.status = JobStatus.CANCELLED;
    job.updatedAt = new Date();
    
    if (this.options.debug) {
      console.log(`[PostingQueue] Job ${jobId} cancelled`);
    }
    
    return true;
  }

  /**
   * Retry a failed job
   */
  public retryJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== JobStatus.FAILED) {
      return false;
    }
    
    job.status = JobStatus.QUEUED;
    job.attempts = 0;
    delete job.lastError;
    delete job.nextRetryAt;
    job.updatedAt = new Date();
    
    if (this.options.debug) {
      console.log(`[PostingQueue] Job ${jobId} queued for retry`);
    }
    
    return true;
  }

  /**
   * Get queue statistics
   */
  public getStats(): QueueStats {
    const jobs = Array.from(this.jobs.values());
    
    return {
      totalJobs: jobs.length,
      queuedJobs: jobs.filter(j => j.status === JobStatus.QUEUED).length,
      processingJobs: jobs.filter(j => j.status === JobStatus.PROCESSING).length,
      completedJobs: jobs.filter(j => j.status === JobStatus.PUBLISHED).length,
      failedJobs: jobs.filter(j => j.status === JobStatus.FAILED).length,
      cancelledJobs: jobs.filter(j => j.status === JobStatus.CANCELLED).length
    };
  }

  /**
   * Get enhanced queue statistics with error analysis
   */
  public getEnhancedStats(): EnhancedQueueStats {
    const jobs = Array.from(this.jobs.values());
    const basicStats = this.getStats();
    
    // Calculate average processing time
    const completedStats = Array.from(this.processingStats.values())
      .filter(stat => stat.endTime)
      .map(stat => stat.endTime! - stat.startTime);
    const averageProcessingTime = completedStats.length > 0 
      ? completedStats.reduce((sum, time) => sum + time, 0) / completedStats.length 
      : 0;
    
    // Analyze error breakdown
    const errorBreakdown: Record<string, number> = {};
    let retryableErrors = 0;
    let permanentErrors = 0;
    
    jobs.filter(j => j.status === JobStatus.FAILED).forEach(job => {
      if (job.errorCode) {
        errorBreakdown[job.errorCode] = (errorBreakdown[job.errorCode] || 0) + 1;
      }
      
      if (job.isRetryable) {
        retryableErrors++;
      } else {
        permanentErrors++;
      }
    });
    
    // Find oldest and newest queued jobs
    const queuedJobs = jobs.filter(j => j.status === JobStatus.QUEUED);
    const oldestQueuedJob = queuedJobs.length > 0 
      ? queuedJobs.reduce((oldest, job) => job.createdAt < oldest.createdAt ? job : oldest).createdAt
      : undefined;
    const newestQueuedJob = queuedJobs.length > 0
      ? queuedJobs.reduce((newest, job) => job.createdAt > newest.createdAt ? job : newest).createdAt
      : undefined;
    
    return {
      ...basicStats,
      averageProcessingTime,
      errorBreakdown,
      retryableErrors,
      permanentErrors,
      oldestQueuedJob: oldestQueuedJob !== undefined ? oldestQueuedJob : new Date(),
      newestQueuedJob: newestQueuedJob !== undefined ? newestQueuedJob : new Date()
    };
  }

  /**
   * Get jobs by status
   */
  public getJobsByStatus(status: JobStatus): PostJob[] {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  /**
   * Start processing jobs in the background with error handling
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      return;
    }
    
    this.processingInterval = setInterval(() => {
      this.processJobs().catch(error => {
        const socialError = ErrorHandler.handle(error, this.options.logger, 'PostingQueue.processJobs');
        this.options.logger.error('[PostingQueue] Critical error in job processing:', socialError.message);
      });
    }, 1000); // Check every second
  }

  /**
   * Process queued jobs up to concurrency limit
   */
  private async processJobs(): Promise<void> {
    if (this.processing.size >= this.options.concurrency) {
      return;
    }
    
    const availableSlots = this.options.concurrency - this.processing.size;
    const queuedJobs = Array.from(this.jobs.values())
      .filter(job => this.isJobReady(job))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, availableSlots);
    
    for (const job of queuedJobs) {
      this.processJob(job).catch(error => {
        console.error(`[PostingQueue] Error processing job ${job.id}:`, error);
      });
    }
  }

  /**
   * Check if a job is ready to be processed
   */
  private isJobReady(job: PostJob): boolean {
    if (job.status !== JobStatus.QUEUED) {
      return false;
    }
    
    // Check if scheduled time has passed
    if (job.scheduledAt && job.scheduledAt > new Date()) {
      return false;
    }
    
    // Check retry delay
    if (job.nextRetryAt && job.nextRetryAt > new Date()) {
      return false;
    }
    
    return true;
  }

  /**
   * Process a single job
   */
  private async processJob(job: PostJob): Promise<void> {
    this.processing.add(job.id);
    
    job.status = JobStatus.PROCESSING;
    job.updatedAt = new Date();
    job.attempts++;
    
    if (this.options.debug) {
      console.log(`[PostingQueue] Processing job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
    }
    
    // Track processing start time
    this.processingStats.set(job.id, { startTime: Date.now() });
    
    try {
      // Import PostProcessor here to avoid circular dependencies
      const { PostProcessor } = await import('./postProcessor');
      const processor = new PostProcessor();
      
      // Process the job
      await processor.processJob(job);
      
      // Mark as completed
      job.status = JobStatus.PUBLISHED;
      job.processedAt = new Date();
      delete job.lastError;
      delete job.errorDetails;
      delete job.errorCode;
      delete job.isRetryable;
      
      // Track processing end time
      const stats = this.processingStats.get(job.id);
      if (stats) {
        stats.endTime = Date.now();
      }
      
      if (this.options.debug) {
        this.options.logger.log(`[PostingQueue] Job ${job.id} completed successfully`);
      }
      
      // Call success callback if provided
      if (this.options.onJobSuccess) {
        try {
          this.options.onJobSuccess(job);
        } catch (callbackError) {
          this.options.logger.warn('[PostingQueue] Error in success callback:', callbackError);
        }
      }
      
    } catch (error) {
      const socialError = error instanceof SocialMediaError 
        ? error 
        : ErrorHandler.handle(error, this.options.logger, `PostingQueue.processJob[${job.id}]`);
      
      // Store detailed error information
      job.lastError = socialError.message;
      job.errorDetails = socialError.details !== undefined ? socialError.details : undefined;
      job.errorCode = socialError.code;
      job.isRetryable = socialError.isRetryable();
      
      // Determine if job should be retried based on error type and attempt count
      const shouldRetry = this.shouldRetryJob(job, socialError);
      
      if (!shouldRetry || job.attempts >= job.maxAttempts) {
        job.status = JobStatus.FAILED;
        
        if (this.options.debug) {
          this.options.logger.log(
            `[PostingQueue] Job ${job.id} failed permanently (${socialError.code}): ${socialError.message}`
          );
        }
        
        // Call failure callback if provided
        if (this.options.onJobFailure) {
          try {
            this.options.onJobFailure(job, socialError);
          } catch (callbackError) {
            this.options.logger.warn('[PostingQueue] Error in failure callback:', callbackError);
          }
        }
      } else {
        // Schedule retry with exponential backoff
        const delay = this.calculateRetryDelay(job.attempts, socialError);
        
        job.status = JobStatus.QUEUED;
        job.nextRetryAt = new Date(Date.now() + delay);
        
        if (this.options.debug) {
          this.options.logger.log(
            `[PostingQueue] Job ${job.id} failed, retrying in ${Math.round(delay/1000)}s (${socialError.code}): ${socialError.message}`
          );
        }
        
        // Call retry callback if provided
        if (this.options.onJobRetry) {
          try {
            this.options.onJobRetry(job, job.attempts, socialError);
          } catch (callbackError) {
            this.options.logger.warn('[PostingQueue] Error in retry callback:', callbackError);
          }
        }
      }
    } finally {
      job.updatedAt = new Date();
      this.processing.delete(job.id);
    }
  }

  /**
   * Start cleanup process for old jobs
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, this.options.cleanupIntervalMs);
  }

  /**
   * Clean up old completed and failed jobs
   */
  private cleanupOldJobs(): void {
    const cutoffTime = Date.now() - this.options.maxJobAgeMs;
    let cleanedCount = 0;
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        job.updatedAt.getTime() < cutoffTime &&
        (job.status === JobStatus.PUBLISHED || job.status === JobStatus.FAILED || job.status === JobStatus.CANCELLED)
      ) {
        this.jobs.delete(jobId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0 && this.options.debug) {
      console.log(`[PostingQueue] Cleaned up ${cleanedCount} old jobs`);
    }
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stop processing and cleanup
   */
  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.options.debug) {
      console.log('[PostingQueue] Stopped processing');
    }
  }

  /**
   * Get all jobs (for debugging/monitoring)
   */
  public getAllJobs(): PostJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Validate job input before adding to queue
   */
  private validateJobInput(job: Omit<PostJob, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'>): void {
    const errors: JobValidationError[] = [];

    // Validate required fields
    if (!job.documentId || typeof job.documentId !== 'string' || job.documentId.trim().length === 0) {
      errors.push({
        field: 'documentId',
        message: 'Document ID is required and must be a non-empty string',
        code: 'INVALID_DOCUMENT_ID'
      });
    }

    if (!job.collectionSlug || typeof job.collectionSlug !== 'string' || job.collectionSlug.trim().length === 0) {
      errors.push({
        field: 'collectionSlug',
        message: 'Collection slug is required and must be a non-empty string',
        code: 'INVALID_COLLECTION_SLUG'
      });
    }

    if (!job.platform || !['twitter', 'linkedin'].includes(job.platform)) {
      errors.push({
        field: 'platform',
        message: 'Platform must be either "twitter" or "linkedin"',
        code: 'INVALID_PLATFORM'
      });
    }

    if (!job.message || typeof job.message !== 'string') {
      errors.push({
        field: 'message',
        message: 'Message is required and must be a string',
        code: 'INVALID_MESSAGE'
      });
    } else if (job.message.trim().length === 0) {
      errors.push({
        field: 'message',
        message: 'Message cannot be empty',
        code: 'EMPTY_MESSAGE'
      });
    } else {
      // Validate message length based on platform
      const maxLength = job.platform === 'twitter' ? 280 : 3000;
      if (job.message.length > maxLength) {
        errors.push({
          field: 'message',
          message: `Message exceeds ${maxLength} character limit for ${job.platform} (current: ${job.message.length})`,
          code: 'MESSAGE_TOO_LONG'
        });
      }
    }

    // Validate maxAttempts
    if (typeof job.maxAttempts !== 'number' || job.maxAttempts < 1 || job.maxAttempts > 10) {
      errors.push({
        field: 'maxAttempts',
        message: 'Max attempts must be a number between 1 and 10',
        code: 'INVALID_MAX_ATTEMPTS'
      });
    }

    // Validate scheduledAt if provided
    if (job.scheduledAt) {
      if (!(job.scheduledAt instanceof Date) || isNaN(job.scheduledAt.getTime())) {
        errors.push({
          field: 'scheduledAt',
          message: 'Scheduled date must be a valid Date object',
          code: 'INVALID_SCHEDULED_DATE'
        });
      } else if (job.scheduledAt < new Date()) {
        errors.push({
          field: 'scheduledAt',
          message: 'Scheduled date cannot be in the past',
          code: 'SCHEDULED_DATE_IN_PAST'
        });
      }
    }

    // Validate mediaUrls if provided
    if (job.mediaUrls) {
      if (!Array.isArray(job.mediaUrls)) {
        errors.push({
          field: 'mediaUrls',
          message: 'Media URLs must be an array',
          code: 'INVALID_MEDIA_URLS_TYPE'
        });
      } else {
        job.mediaUrls.forEach((url, index) => {
          if (typeof url !== 'string' || url.trim().length === 0) {
            errors.push({
              field: `mediaUrls[${index}]`,
              message: `Media URL at index ${index} must be a non-empty string`,
              code: 'INVALID_MEDIA_URL'
            });
          } else {
            try {
              new URL(url);
            } catch {
              errors.push({
                field: `mediaUrls[${index}]`,
                message: `Media URL at index ${index} is not a valid URL`,
                code: 'INVALID_MEDIA_URL_FORMAT'
              });
            }
          }
        });

        // Platform-specific media limits
        const maxMedia = job.platform === 'twitter' ? 4 : 9;
        if (job.mediaUrls.length > maxMedia) {
          errors.push({
            field: 'mediaUrls',
            message: `${job.platform} supports maximum ${maxMedia} media attachments`,
            code: 'TOO_MANY_MEDIA_URLS'
          });
        }
      }
    }

    if (errors.length > 0) {
      const errorMessage = errors.map(e => `${e.field}: ${e.message}`).join('; ');
      throw new SocialMediaError(
        ErrorCodes.VALIDATION_ERROR,
        `Job validation failed: ${errorMessage}`,
        {
          details: { validationErrors: errors },
          retryable: false
        }
      );
    }
  }

  /**
   * Determine if a job should be retried based on error type and configuration
   */
  private shouldRetryJob(job: PostJob, error: SocialMediaError): boolean {
    // Don't retry if already at max attempts
    if (job.attempts >= job.maxAttempts) {
      return false;
    }

    // Don't retry validation errors or other non-retryable errors
    if (!error.isRetryable()) {
      return false;
    }

    // Special handling for specific error types
    switch (error.code) {
      case ErrorCodes.AUTHENTICATION_FAILED:
      case ErrorCodes.INVALID_TOKEN:
      case ErrorCodes.UNAUTHORIZED:
      case ErrorCodes.FORBIDDEN:
      case ErrorCodes.CONTENT_TOO_LONG:
      case ErrorCodes.DUPLICATE_CONTENT:
      case ErrorCodes.VALIDATION_ERROR:
        return false; // Don't retry these errors

      case ErrorCodes.RATE_LIMIT_EXCEEDED:
      case ErrorCodes.NETWORK_ERROR:
      case ErrorCodes.CONNECTION_FAILED:
      case ErrorCodes.REQUEST_TIMEOUT:
      case ErrorCodes.INTERNAL_SERVER_ERROR:
      case ErrorCodes.BAD_GATEWAY:
      case ErrorCodes.SERVICE_UNAVAILABLE:
      case ErrorCodes.GATEWAY_TIMEOUT:
        return true; // Retry these errors

      default:
        return error.isRetryable();
    }
  }

  /**
   * Calculate retry delay with exponential backoff and error-specific adjustments
   */
  private calculateRetryDelay(attempt: number, error: SocialMediaError): number {
    let baseDelay = this.options.retryDelayMs * Math.pow(this.options.backoffMultiplier, attempt - 1);

    // Adjust delay based on error type
    switch (error.code) {
      case ErrorCodes.RATE_LIMIT_EXCEEDED:
        // For rate limits, use longer delays
        baseDelay = Math.max(baseDelay, 60000); // At least 1 minute
        break;

      case ErrorCodes.NETWORK_ERROR:
      case ErrorCodes.CONNECTION_FAILED:
        // For network issues, use standard backoff
        break;

      case ErrorCodes.SERVICE_UNAVAILABLE:
        // For service unavailable, use longer delays
        baseDelay = Math.max(baseDelay, 30000); // At least 30 seconds
        break;

      default:
        // Standard backoff for other retryable errors
        break;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, this.options.maxRetryDelayMs);

    return delay;
  }

  /**
   * Get jobs by error type for debugging and monitoring
   */
  public getJobsByErrorType(errorCode: string): PostJob[] {
    return Array.from(this.jobs.values()).filter(job => job.errorCode === errorCode);
  }

  /**
   * Get failed jobs with detailed error information
   */
  public getFailedJobsWithErrors(): Array<PostJob & { errorSummary: string }> {
    return this.getJobsByStatus(JobStatus.FAILED).map(job => ({
      ...job,
      errorSummary: `${job.errorCode || 'UNKNOWN'}: ${job.lastError || 'No error message'}`
    }));
  }

  /**
   * Retry all failed jobs that are retryable
   */
  public retryAllRetryableJobs(): { retriedCount: number; skippedCount: number } {
    const failedJobs = this.getJobsByStatus(JobStatus.FAILED);
    let retriedCount = 0;
    let skippedCount = 0;

    for (const job of failedJobs) {
      if (job.isRetryable && job.attempts < job.maxAttempts) {
        if (this.retryJob(job.id)) {
          retriedCount++;
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    return { retriedCount, skippedCount };
  }

  // Note: cleanupProcessingStats method removed as it was unused
}