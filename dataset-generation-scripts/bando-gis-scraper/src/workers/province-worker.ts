import { Worker } from 'worker_threads';
import { BandoGISScraper } from '../scrapers/bando-gis.scrapers';
import { ProvinceData, WardData } from '../interfaces/scraper.interfaces';
import { ProvinceResultMessage, WorkerMessage, ProvinceAssignmentMessage } from '../interfaces/worker.interfaces';

/**
 * ProvinceWorker - Handles scraping of a single province in a worker thread
 */
export class ProvinceWorker {
  private workerId: number;
  private scraper: BandoGISScraper | null = null;
  private isInitialized: boolean = false;

  constructor(workerId: number) {
    this.workerId = workerId;
  }

  /**
   * Initialize the scraper for this worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.scraper = new BandoGISScraper();
    await this.scraper.initialize();
    this.isInitialized = true;
  }

  /**
   * Run the scraping task for a single province
   * @param provinceIndex - The index of the province to scrape (1-based)
   * @returns Result message with province and ward data
   */
  async run(provinceIndex: number): Promise<ProvinceResultMessage> {
    try {
      // Initialize scraper if not already initialized
      if (!this.isInitialized || !this.scraper) {
        await this.initialize();
      }

      console.log(`[Worker ${this.workerId}] Starting scrape for province index: ${provinceIndex}`);

      // Scrape the specific province using TARGET_PROVINCE_INDEX
      const result = await this.scraper!.scrapeAll(provinceIndex);

      if (result.provinces.length === 0) {
        throw new Error(`No province data found for index ${provinceIndex}`);
      }

      const province = result.provinces[0];
      const wards = result.wards;

      console.log(`[Worker ${this.workerId}] Completed province ${provinceIndex}: ${province.ten} (${wards.length} wards)`);

      // Return success result
      const resultMessage: ProvinceResultMessage = {
        type: 'PROVINCE_COMPLETE',
        provinceIndex,
        province,
        wards,
        workerId: this.workerId
      };

      return resultMessage;

    } catch (error) {
      console.error(`[Worker ${this.workerId}] Error scraping province ${provinceIndex}:`, error);
      
      // Return error result
      const resultMessage: ProvinceResultMessage = {
        type: 'PROVINCE_COMPLETE',
        provinceIndex,
        province: {} as ProvinceData,
        wards: [],
        error: error instanceof Error ? error.message : String(error),
        workerId: this.workerId
      };

      return resultMessage;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.scraper) {
      await this.scraper.cleanup();
      this.scraper = null;
    }
    this.isInitialized = false;
  }
}

/**
 * Main worker thread entry point
 * This function is called when a worker thread is spawned
 */
export async function workerMain(workerId: number, provinceIndex: number): Promise<ProvinceResultMessage> {
  const worker = new ProvinceWorker(workerId);
  
  try {
    await worker.initialize();
    const result = await worker.run(provinceIndex);
    return result;
  } finally {
    await worker.cleanup();
  }
}