  # GIS Scraper

  Scrape GIS data from sapnhan.bando.com.vn. Automation script created with [Playwright](https://playwright.dev).

  It simulates clicks on every province and ward row data, and captures HTTP requests to dump to JSON files.

  ## Features

  - **Automatic GIS Data Capture**: Captures GIS server responses for all provinces and wards
  - **Flexible Province Selection**: Scrape all provinces or a single province to prevent crashes from long-running sessions
  - **Exhaustive Retry Mechanism**: Automatically retries up to 20 times per item if GIS response is not captured
  - **Failed Item Tracking**: Tracks and reports all items that failed to capture GIS data after retries
  - **Progress Logging**: Real-time logging of retry attempts and success/failure status
  - **Tabulator Virtual Scrolling**: Handles virtual scrolling tables efficiently

  ## How to run

  Install Node.js and Playwright on your system.

  Install dependencies:
  ```bash
  yarn install
  ```

  ### Running with Browser UI (Default)

  By default, the scraper runs with browser UI visible (non-headless mode):

  ```bash
  yarn dev
  # or
  yarn dev:non-headless
  ```

  ### Running in Headless Mode (for VPS/CI)

  For running on a VPS or in environments without a display, use headless mode:

  ```bash
  yarn dev:headless
  ```

  This will run the scraper without displaying the browser window, which is ideal for:
  - VPS environments
  - CI/CD pipelines
  - Scheduled tasks
  - Resource-constrained environments

  ### Configuration

  #### Headless Mode

  The headless mode can be configured via environment variables:

  1. **Using `.env` file** (recommended):
     ```bash
     cp .env.example .env
     # Edit .env and set HEADLESS=true
     ```

  2. **Setting directly via command line**:
     ```bash
     HEADLESS=true yarn dev
     ```

  #### Target Province Index (Optional)

  By default, the scraper scrapes **all provinces**. You can specify a single province to scrape using the `TARGET_PROVINCE_INDEX` environment variable to prevent crashes from long-running sessions.

  **Province Indexing**:
  - Uses one-based indexing (1 = first province, 2 = second province, etc.)
  - The valid range is dynamic and depends on the actual number of provinces on the website
  - Typical range: 1 to 34 (as shown on the website)
  - Default behavior: Scrape all provinces (if not set)

  **Configuration Examples**:

  1. **Using `.env` file** (recommended):
     ```bash
     cp .env.example .env
     # To scrape all provinces (default):
     # Leave TARGET_PROVINCE_INDEX commented out
     # 
     # To scrape a specific province:
     TARGET_PROVINCE_INDEX=1  # Scrapes the first province
     TARGET_PROVINCE_INDEX=5  # Scrapes the fifth province
     ```

  2. **Setting directly via command line**:
     ```bash
     # Scrape all provinces (default)
     yarn dev
     
     # Scrape specific province
     TARGET_PROVINCE_INDEX=1 yarn dev
     TARGET_PROVINCE_INDEX=5 yarn dev
     ```

  **Validation**:
  - If you set an invalid index (e.g., 0, negative, or beyond the total number of provinces), scraper will display an error with the valid range
  - If you set an out-of-range index (e.g., 100), error message will show the actual number of provinces available
  - This helps you discover the correct range without guessing

  **Output Files**:
  Files are written **incrementally** as each province is scraped, allowing you to preserve data and set resume points.

  When targeting a single province (e.g., `TARGET_PROVINCE_INDEX=5`):
  - `province_5_provinces.json` - Province data (written immediately after scraping)
  - `province_5_wards.json` - Ward data (written immediately after scraping)
  - `province_5_complete_result.json` - Complete result for this province

  When scraping all provinces (no `TARGET_PROVINCE_INDEX` set):
  - `province_1_provinces.json` - Province 1 data (written immediately)
  - `province_1_wards.json` - Province 1 wards (written immediately)
  - `province_2_provinces.json` - Province 2 data (written immediately)
  - `province_2_wards.json` - Province 2 wards (written immediately)
  - ... (one pair of files per province, written as each province completes)
  - `complete_result.json` - Complete result with all provinces and wards combined (written at the end)

  **Benefits of Incremental Writing:**
  - Data is preserved even if scraping crashes
  - You can resume from any province by setting `TARGET_PROVINCE_INDEX`
  - Progress is visible in real-time as files appear in the output directory
  - No risk of losing all data if process fails near the end

Available yarn scripts:
- `yarn dev` - Run with default settings (reads from .env)
- `yarn dev:headless` - Run in headless mode
- `yarn dev:non-headless` - Run with browser UI

For production/compiled versions:
- `yarn build` - Compile TypeScript to JavaScript
- `yarn start` - Run compiled version with default settings
- `yarn start:headless` - Run compiled version in headless mode
- `yarn start:non-headless` - Run compiled version with browser UI

## Output

JSON output files are generated in `./output/` directory:
- `province_N_provinces.json` - Individual province data (N = province index)
- `province_N_wards.json` - Individual province wards (N = province index)
- `complete_result.json` - Complete scraping result including all provinces, wards, and failed items

Files are written incrementally as each province completes, ensuring data preservation.

## Retry Mechanism

The scraper implements a robust retry mechanism to ensure maximum data capture:

### How It Works

1. **Validation-Based Retry**: Each item (province/ward) is validated after attempting to capture GIS data
2. **Automatic Retries**: If validation fails, the scraper automatically retries up to 20 times
3. **Progress Logging**: Each retry attempt is logged with detailed information
4. **Failed Item Tracking**: Items that fail after all retries are tracked and reported

### Retry Configuration

Retry settings can be configured in `src/config/scraper.config.ts`:

```typescript
RETRY: {
  MAX_ATTEMPTS: 3,           // General retry attempts
  DELAY: 1000,               // Delay between retries (ms)
  GIS_MAX_ATTEMPTS: 20,       // GIS-specific retry attempts
  GIS_DELAY: 1000             // Delay between GIS retries (ms)
}
```

### Output Summary

After scraping completes, you'll see a detailed summary:

```
📊 Scraping completed!
📍 Provinces scraped: 63
🏘️  Wards scraped: 10589
🔬 Total requests: 10652
⏱️  Duration: 4523s
💾 Results saved to ./output/ directory

❌ Failed GIS Items: 5
   - Provinces: 0
   - Wards: 5

📋 Failed Items Details:
   1. Ward "Phường 1" - Attempt 20 - No GIS response captured for ward
   2. Ward "Phường 2" - Attempt 20 - No GIS response captured for ward
   ...

✅ All GIS responses captured successfully!
```

### Handling Failed Items

If any items fail after the maximum retry attempts:
1. They are logged in the console output
2. They are included in `complete_result.json` under the `failedGISItems` array
3. Each failed item includes:
   - Item type (province/ward)
   - Item data (name, code, etc.)
   - Number of attempts
   - Last error message
   - Timestamp

You can manually retry failed items by running the scraper again, as the failure may be transient.

## Troubleshooting

### High Failure Rate

If you're seeing many failed items:
1. Check your internet connection
2. Verify the target website is accessible
3. Consider increasing `GIS_DELAY` in the configuration to allow more time between requests
4. Check if the website structure has changed

### Slow Performance

The retry mechanism with 20 attempts per item may slow down the scraping process:
1. Reduce `GIS_MAX_ATTEMPTS` if you're comfortable with missing some data
2. Reduce `GIS_DELAY` for faster retries (but may increase failure rate)
3. Consider running during off-peak hours when the server is less busy