import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as path from 'path';
import { ProvinceData, WardData, ScrapingResult } from '../interfaces';
import { 
  ParallelConfig, 
  ProvinceResultMessage, 
  WorkerReadyMessage,
  WorkerErrorMessage 
} from '../interfaces/worker.interfaces';

/**
 * ParallelScraperManager - Orchestrates parallel scraping using worker threads
 */
export class ParallelScraperManager {
  private config: ParallelConfig;
  private workers: Map<number, Worker>;
  private workerReady: Set<number>;
  private results: ScrapingResult;
  private provinceQueue: number[];
  private completedProvinces: number;
  private totalProvinces: number;
  private startTime: Date;

  constructor(config: ParallelConfig) {
    this.config = config;
    this.workers = new Map();
    this.workerReady = new Set();
    this.results = {
      provinces: [],
      wards: [],
      totalRequests: 0,
      startTime: new Date(),
      errors: []
    };
    this.provinceQueue = [];
    this.completedProvinces = 0;
    this.totalProvinces = 63; // Total number of provinces in Vietnam
    this.startTime = new Date();
  }

  /**
   * Initialize the parallel scraper manager with worker pool
   */
  async initialize(): Promise<void> {
    console.log(`🚀 Initializing parallel scraper with ${this.config.workerCount} workers...`);

    // Initialize province queue (1-based indexing)
    this.provinceQueue = Array.from({ length: this.totalProvinces }, (_, i) => i + 1);

    // Create worker pool
    const workerPromises = Array.from({ length: this.config.workerCount }, async (_, i) => {
      return this.createWorker(i);
    });

    await Promise.all(workerPromises);

    console.log(`✅ ${this.workers.size} workers initialized and ready`);
  }

  /**
   * Create a single worker thread
   */
  private async createWorker(workerId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const workerPath = path.join(__dirname, '../workers/province-worker.ts');
        
        const worker = new Worker(workerPath, {
          workerData: { workerId }
        });

        worker.on('message', (message) => this.handleWorkerMessage(workerId, message));
        worker.on('error', (error) => this.handleWorkerError(workerId, error));
        worker.on('exit', (code) => {
          if (code !== 0) {
            console.error(`[Worker ${workerId}] Worker stopped with exit code ${code}`);
          }
        });

        this.workers.set(workerId, worker);
        this.workerReady.add(workerId);

        // Send initialization signal
        const readyMessage: WorkerReadyMessage = {
          type: 'WORKER_READY',
          workerId
        };
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle messages from worker threads
   */
  private handleWorkerMessage(workerId: number, message: any): void {
    switch (message.type) {
      case 'PROVINCE_COMPLETE':
        this.handleProvinceComplete(message as ProvinceResultMessage);
        break;
      case 'WORKER_READY':
        this.workerReady.add(workerId);
        this.assignNextProvince(workerId);
        break;
      default:
        console.warn(`[Worker ${workerId}] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle errors from worker threads
   */
  private handleWorkerError(workerId: number, error: Error): void {
    console.error(`[Worker ${workerId}] Worker error:`, error);
    this.results.errors.push(`Worker ${workerId} error: ${error.message}`);
  }

  /**
   * Handle province completion from worker
   */
  private handleProvinceComplete(message: ProvinceResultMessage): void {
    const { provinceIndex, province, wards, error, workerId } = message;

    if (error) {
      console.error(`❌ Province ${provinceIndex} failed: ${error}`);
      this.results.errors.push(`Province ${provinceIndex}: ${error}`);
    } else {
      console.log(`✅ [Worker ${workerId}] Province ${provinceIndex} completed: ${province.ten} (${wards.length} wards)`);
      this.results.provinces.push(province);
      this.results.wards.push(...wards);
    }

    this.completedProvinces++;
    this.workerReady.add(workerId);

    // Assign next province to this worker
    this.assignNextProvince(workerId);

    // Check if all provinces are completed
    if (this.completedProvinces >= this.totalProvinces) {
      this.finalizeResults();
    }
  }

  /**
   * Assign next province from queue to worker
   */
  private assignNextProvince(workerId: number): void {
    if (this.provinceQueue.length === 0) {
      return;
    }

    const provinceIndex = this.provinceQueue.shift()!;
    console.log(`📋 [Worker ${workerId}] Assigned province ${provinceIndex}`);

    // Send assignment to worker
    const assignmentMessage = {
      type: 'SCRAPE_PROVINCE',
      provinceIndex
    };

    const worker = this.workers.get(workerId);
    if (worker) {
      worker.postMessage(assignmentMessage);
      this.workerReady.delete(workerId);
    }
  }

  /**
   * Start parallel scraping with optional callback
   */
  async startScraping(onProvinceScraped?: (province: ProvinceData, wards: WardData[]) => Promise<void>): Promise<ScrapingResult> {
    console.log(`🎯 Starting parallel scraping of ${this.totalProvinces} provinces...`);

    // Assign initial provinces to all workers
    const workerIds = Array.from(this.workers.keys());
    workerIds.forEach(workerId => {
      this.assignNextProvince(workerId);
    });

    // Return promise that resolves when all scraping is complete
    return new Promise((resolve) => {
      const checkComplete = () => {
        if (this.completedProvinces >= this.totalProvinces) {
          this.finalizeResults();
          resolve(this.results);
        } else {
          // Check again after a short delay
          setTimeout(checkComplete, 1000);
        }
      };
      checkComplete();
    });
  }

  /**
   * Finalize results and calculate statistics
   */
  private finalizeResults(): void {
    this.results.endTime = new Date();
    this.results.duration = this.results.endTime.getTime() - this.results.startTime.getTime();
  }

  /**
   * Cleanup all worker threads
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up workers...');
    
    const cleanupPromises = Array.from(this.workers.values()).map(worker => {
      return new Promise<void>((resolve) => {
        worker.terminate();
        resolve();
      });
    });

    await Promise.all(cleanupPromises);
    this.workers.clear();
    this.workerReady.clear();
    
    console.log('✅ All workers cleaned up');
  }
}

/**
 * Alternative implementation using Promise.all for simpler parallel execution
 * This version runs workers without using worker_threads module
 */
export class SimpleParallelScraperManager {
  private config: ParallelConfig;
  private results: ScrapingResult;
  private totalProvinces: number;
  private startTime: Date;

  constructor(config: ParallelConfig) {
    this.config = config;
    this.results = {
      provinces: [],
      wards: [],
      totalRequests: 0,
      startTime: new Date(),
      errors: []
    };
    this.totalProvinces = 63;
    this.startTime = new Date();
  }

  /**
   * Start parallel scraping using Promise.all
   * This is a simpler alternative that doesn't use worker_threads
   */
  async startScraping(onProvinceScraped?: (province: ProvinceData, wards: WardData[]) => Promise<void>): Promise<ScrapingResult> {
    console.log(`🚀 Starting parallel scraping with ${this.config.workerCount} concurrent workers...`);
    console.log(`📋 Total provinces to scrape: ${this.totalProvinces}`);

    // Create batches of provinces
    const provinceIndices = Array.from({ length: this.totalProvinces }, (_, i) => i + 1);
    const batches: number[][] = [];
    
    for (let i = 0; i < provinceIndices.length; i += this.config.workerCount) {
      batches.push(provinceIndices.slice(i, i + this.config.workerCount));
    }

    // Import BandoGISScraper dynamically
    const { BandoGISScraper } = await import('../scrapers/bando-gis.scrapers');

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} provinces)...`);

      // Create scrapers for this batch
      const scrapers = batch.map(() => new BandoGISScraper());
      
      // Initialize all scrapers
      await Promise.all(scrapers.map(scraper => scraper.initialize()));

      // Scrape provinces in parallel
      const scrapePromises = scrapers.map(async (scraper, index) => {
        const provinceIndex = batch[index];
        try {
          console.log(`  🎯 Starting province ${provinceIndex}...`);
          const result = await scraper.scrapeAll(provinceIndex);
          
          if (result.provinces.length === 0) {
            throw new Error(`No province data found for index ${provinceIndex}`);
          }

          const province = result.provinces[0];
          const wards = result.wards;
          
          console.log(`  ✅ Province ${provinceIndex} completed: ${province.ten} (${wards.length} wards)`);
          
          this.results.provinces.push(province);
          this.results.wards.push(...wards);
          this.results.totalRequests += result.totalRequests;

          // Call callback if provided
          if (onProvinceScraped) {
            await onProvinceScraped(province, wards);
          }

          return { provinceIndex, province, wards, error: undefined };
        } catch (error) {
          console.error(`  ❌ Province ${provinceIndex} failed:`, error);
          this.results.errors.push(`Province ${provinceIndex}: ${error instanceof Error ? error.message : String(error)}`);
          return { provinceIndex, error };
        } finally {
          await scraper.cleanup();
        }
      });

      await Promise.all(scrapePromises);
      console.log(`✅ Batch ${batchIndex + 1} completed`);
    }

    // Finalize results
    this.results.endTime = new Date();
    this.results.duration = this.results.endTime.getTime() - this.results.startTime.getTime();

    return this.results;
  }
}