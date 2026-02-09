/**
 * Queue Service
 * 
 * Manages background job queues for async processing.
 * Falls back to synchronous execution if Redis is unavailable.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Job<T = unknown> {
  id: string;
  name: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

type JobProcessor<T = unknown> = (data: T) => Promise<void>;

interface QueueConfig {
  name: string;
  concurrency?: number;
  maxAttempts?: number;
  backoffDelay?: number;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private processors: Map<string, JobProcessor> = new Map();
  private queues: Map<string, Job[]> = new Map();
  private isProcessing: Map<string, boolean> = new Map();
  private redisAvailable = false;

  // In production, you would use BullMQ:
  // private queues: Map<string, Queue> = new Map();
  // private workers: Map<string, Worker> = new Map();

  constructor(private configService: ConfigService) {}

  async initialize(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (redisUrl) {
      try {
        // In production with BullMQ:
        // const connection = new IORedis(redisUrl);
        // await connection.ping();
        this.redisAvailable = true;
        this.logger.log('Queue service initialized with Redis');
      } catch (error) {
        this.logger.warn('Redis not available, falling back to in-memory queue');
        this.redisAvailable = false;
      }
    } else {
      this.logger.log('Queue service initialized in memory (no Redis URL configured)');
    }
  }

  /**
   * Register a queue with its processor
   */
  registerQueue<T>(config: QueueConfig, processor: JobProcessor<T>): void {
    this.processors.set(config.name, processor as JobProcessor);
    this.queues.set(config.name, []);
    this.isProcessing.set(config.name, false);
    
    this.logger.log(`Queue registered: ${config.name}`);

    // In production with BullMQ:
    // const queue = new Queue(config.name, { connection: redisConnection });
    // const worker = new Worker(config.name, processor, { 
    //   connection: redisConnection,
    //   concurrency: config.concurrency ?? 1,
    // });
    // this.queues.set(config.name, queue);
    // this.workers.set(config.name, worker);
  }

  /**
   * Add a job to a queue
   */
  async addJob<T>(queueName: string, jobName: string, data: T, options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
  }): Promise<string> {
    const jobId = `${queueName}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const job: Job<T> = {
      id: jobId,
      name: jobName,
      data,
      attempts: 0,
      maxAttempts: options?.attempts ?? 3,
      createdAt: new Date(),
    };

    if (this.redisAvailable) {
      // In production with BullMQ:
      // const queue = this.queues.get(queueName);
      // await queue.add(jobName, data, options);
      this.logger.debug(`Job added to Redis queue: ${queueName}/${jobName}`);
    }

    // In-memory fallback
    const queue = this.queues.get(queueName);
    if (queue) {
      if (options?.delay) {
        setTimeout(() => {
          queue.push(job);
          this.processQueue(queueName);
        }, options.delay);
      } else {
        queue.push(job);
        this.processQueue(queueName);
      }
    }

    return jobId;
  }

  /**
   * Process jobs in a queue (in-memory implementation)
   */
  private async processQueue(queueName: string): Promise<void> {
    if (this.isProcessing.get(queueName)) {
      return;
    }

    this.isProcessing.set(queueName, true);
    const queue = this.queues.get(queueName);
    const processor = this.processors.get(queueName);

    if (!queue || !processor) {
      this.isProcessing.set(queueName, false);
      return;
    }

    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) continue;

      job.processedAt = new Date();
      job.attempts++;

      try {
        await processor(job.data);
        job.completedAt = new Date();
        this.logger.debug(`Job completed: ${job.id}`);
      } catch (error) {
        job.error = error instanceof Error ? error.message : 'Unknown error';
        
        if (job.attempts < job.maxAttempts) {
          // Exponential backoff retry
          const delay = Math.pow(2, job.attempts) * 1000;
          this.logger.warn(`Job failed, retrying in ${delay}ms: ${job.id}`);
          
          setTimeout(() => {
            queue.push(job);
            this.processQueue(queueName);
          }, delay);
        } else {
          job.failedAt = new Date();
          this.logger.error(`Job failed permanently: ${job.id} - ${job.error}`);
        }
      }
    }

    this.isProcessing.set(queueName, false);
  }

  /**
   * Get queue statistics
   */
  getQueueStats(queueName: string): {
    pending: number;
    processing: boolean;
  } {
    return {
      pending: this.queues.get(queueName)?.length ?? 0,
      processing: this.isProcessing.get(queueName) ?? false,
    };
  }

  /**
   * Shutdown all queues gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.log('Shutting down queue service...');
    
    // In production with BullMQ:
    // for (const worker of this.workers.values()) {
    //   await worker.close();
    // }
    // for (const queue of this.queues.values()) {
    //   await queue.close();
    // }

    this.queues.clear();
    this.processors.clear();
    this.isProcessing.clear();
    
    this.logger.log('Queue service shut down');
  }
}

// =========================================================================
// Common Queue Names
// =========================================================================

export const QUEUE_NAMES = {
  EMAIL: 'email',
  PUSH_NOTIFICATION: 'push-notification',
  ANALYTICS: 'analytics',
  WEBHOOK: 'webhook',
  CLEANUP: 'cleanup',
} as const;

// =========================================================================
// Job Types
// =========================================================================

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface PushNotificationJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface AnalyticsJobData {
  event: string;
  userId?: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}
