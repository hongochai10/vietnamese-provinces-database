import { ProvinceData, WardData } from './scraper.interfaces';

// Worker message types for province assignments
export interface ProvinceAssignmentMessage {
  type: 'SCRAPE_PROVINCE';
  provinceIndex: number;
}

export interface ProvinceResultMessage {
  type: 'PROVINCE_COMPLETE';
  provinceIndex: number;
  province: ProvinceData;
  wards: WardData[];
  error?: string;
  workerId: number;
}

export interface WorkerReadyMessage {
  type: 'WORKER_READY';
  workerId: number;
}

export interface WorkerErrorMessage {
  type: 'WORKER_ERROR';
  workerId: number;
  error: string;
  provinceIndex?: number;
}

// Union type for all worker messages
export type WorkerMessage = 
  | ProvinceAssignmentMessage 
  | ProvinceResultMessage 
  | WorkerReadyMessage 
  | WorkerErrorMessage;

// Parallel configuration
export interface ParallelConfig {
  enabled: boolean;
  workerCount: number;
  maxRetries: number;
}

// Worker initialization data
export interface WorkerInitData {
  workerId: number;
  provinceIndex: number;
}