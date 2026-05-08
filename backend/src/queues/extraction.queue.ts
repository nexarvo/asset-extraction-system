import { Queue, QueueOptions } from 'bullmq';
import { ExtractionJobData } from '../utils/extraction.types';

export const EXTRACTION_QUEUE_NAME = 'asset-extraction-queue';

export const extractionQueueOptions: QueueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
};
