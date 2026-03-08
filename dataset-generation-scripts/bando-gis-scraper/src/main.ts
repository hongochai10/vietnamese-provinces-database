import path from "path";
import * as fs from 'fs/promises';
import dotenv from 'dotenv';

import { BandoGISScraper } from "./scrapers/bando-gis.scrapers";
import { ProvinceData, WardData, ScrapingResult } from "./interfaces";
import { SimpleParallelScraperManager } from "./managers/parallel-scraper.manager";

// Load environment variables FIRST before reading them
dotenv.config();

// Read environment variables after dotenv is loaded
const PARALLEL_CONFIG = {
  enabled: process.env.PARALLEL === 'true',
  workerCount: parseInt(process.env.WORKER_COUNT || '4', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '2', 10)
};

async function main() {
  console.log("Starting web scraping activity...")

  // Check if parallel mode is enabled
  if (PARALLEL_CONFIG.enabled) {
    console.log("🚀 Parallel mode enabled!");
    console.log(`📊 Worker count: ${PARALLEL_CONFIG.workerCount}`);
    return runParallelScraping();
  }

  // Sequential mode (default behavior)
  console.log("📋 Sequential mode enabled");
  return runSequentialScraping();
}

/**
 * Run parallel scraping using SimpleParallelScraperManager
 */
async function runParallelScraping() {
  const outputDir = 'output';
  await fs.mkdir(outputDir, { recursive: true });

  const parallelManager = new SimpleParallelScraperManager({
    enabled: PARALLEL_CONFIG.enabled,
    workerCount: PARALLEL_CONFIG.workerCount,
    maxRetries: PARALLEL_CONFIG.maxRetries
  });

  try {
    // Track all provinces and wards for summary
    let allProvinces: ProvinceData[] = [];
    let allWards: WardData[] = [];
    let allErrors: string[] = [];
    let scrapedProvincesCount = 0;

    // Define callback for incremental file writing
    const onProvinceScraped = async (province: ProvinceData, wards: WardData[]) => {
      const provIndex = scrapedProvincesCount + 1;
      const provincesFilename = `province_${provIndex}_provinces.json`;
      const wardsFilename = `province_${provIndex}_wards.json`;
      
      // Save province data immediately
      await fs.writeFile(
        path.join(outputDir, provincesFilename),
        JSON.stringify([province], null, 2)
      );
      
      // Save wards data immediately
      await fs.writeFile(
        path.join(outputDir, wardsFilename),
        JSON.stringify(wards, null, 2)
      );
      
      console.log(`✅ Saved: ${provincesFilename} (${wards.length} wards)`);
      console.log(`✅ Saved: ${wardsFilename}`);
      
      // Track data for final summary
      allProvinces.push(province);
      allWards.push(...wards);
      scrapedProvincesCount++;
    };

    // Scrape with parallel execution
    const result = await parallelManager.startScraping(onProvinceScraped);

    // Collect any remaining errors from final result
    allErrors = result.errors;

    // Save complete result with all data
    const completeResultFilename = 'complete_result.json';
    await fs.writeFile(
      path.join(outputDir, completeResultFilename),
      JSON.stringify({
        ...result,
        provinces: allProvinces,
        wards: allWards,
        errors: allErrors
      }, null, 2)
    );
    console.log(`✅ Saved: ${completeResultFilename}`);

    // Print summary
    console.log('\n📊 Parallel scraping completed!');
    console.log(`📍 Provinces scraped: ${allProvinces.length}`);
    console.log(`🏘️  Wards scraped: ${allWards.length}`);
    console.log(`🔬 Total requests: ${result.totalRequests}`);
    console.log(`⏱️  Duration: ${Math.round(result.duration! / 1000)}s`);
    console.log(`💾 All files saved to ./output/ directory`);

    if (allErrors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      allErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

  } catch (error) {
    console.error('💥 Fatal error in parallel mode:', error);
    process.exit(1);
  }
}

/**
 * Run sequential scraping using BandoGISScraper (original behavior)
 */
async function runSequentialScraping() {
  const gisScraper = new BandoGISScraper();

  try {
    await gisScraper.initialize();

    // Check if TARGET_PROVINCE_INDEX is set
    const targetProvinceIndexEnv = process.env.TARGET_PROVINCE_INDEX;
    const provinceIndex = targetProvinceIndexEnv ? parseInt(targetProvinceIndexEnv, 10) : undefined;
    
    if (provinceIndex !== undefined) {
      console.log(`🎯 Targeting province index: ${provinceIndex}`);
    } else {
      console.log(`📋 Scraping all provinces`);
    }

    // Create output directory
    const outputDir = 'output';
    await fs.mkdir(outputDir, { recursive: true });

    // Track all provinces and wards for summary
    let allProvinces: ProvinceData[] = [];
    let allWards: WardData[] = [];
    let allErrors: string[] = [];
    let scrapedProvincesCount = 0;

    // Define callback for incremental file writing
    const onProvinceScraped = async (province: ProvinceData, wards: WardData[]) => {
      const provIndex = scrapedProvincesCount + 1;
      const provincesFilename = `province_${provIndex}_provinces.json`;
      const wardsFilename = `province_${provIndex}_wards.json`;
      
      // Save province data immediately
      await fs.writeFile(
        path.join(outputDir, provincesFilename),
        JSON.stringify([province], null, 2)
      );
      
      // Save wards data immediately
      await fs.writeFile(
        path.join(outputDir, wardsFilename),
        JSON.stringify(wards, null, 2)
      );
      
      console.log(`✅ Saved: ${provincesFilename} (${wards.length} wards)`);
      console.log(`✅ Saved: ${wardsFilename}`);
      
      // Track data for final summary
      allProvinces.push(province);
      allWards.push(...wards);
      scrapedProvincesCount++;
    };

    // Scrape with incremental file writing
    const result = await gisScraper.scrapeAll(provinceIndex, onProvinceScraped);

    // Collect any remaining errors from final result
    allErrors = result.errors;

    // Save complete result with all data
    const completeResultFilename = 'complete_result.json';
    await fs.writeFile(
      path.join(outputDir, completeResultFilename),
      JSON.stringify({
        ...result,
        provinces: allProvinces,
        wards: allWards,
        errors: allErrors
      }, null, 2)
    );
    console.log(`✅ Saved: ${completeResultFilename}`);

    // Print summary
    console.log('\n📊 Scraping completed!');
    console.log(`📍 Provinces scraped: ${allProvinces.length}`);
    console.log(`🏘️  Wards scraped: ${allWards.length}`);
    console.log(`🔬 Total requests: ${result.totalRequests}`);
    console.log(`⏱️  Duration: ${Math.round(result.duration! / 1000)}s`);
    console.log(`💾 All files saved to ./output/ directory`);

    if (allErrors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      allErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await gisScraper.cleanup();
  }
}

if (require.main === module) {
  main().catch(console.error);
}