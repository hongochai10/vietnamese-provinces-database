# GeoJSON Data for Vietnamese Provinces and Wards

This directory contains GeoJSON data for all 34 provinces and 3,321 wards of Vietnam.

## Structure

```
geojson/
├── 1_thu_do_ha_noi/
│   ├── province.geojson
│   └── wards/
│       ├── 1_ba_dinh_phuong.geojson
│       ├── 2_cau_giay_phuong.geojson
│       └── ...
├── 10_tinh_quang_ninh/
│   ├── province.geojson
│   └── wards/
│       └── ...
└── ...
```

## Folder Naming Convention

- **Province folders**: `{stt}_{sanitized_name}`
  - Example: `1_thu_do_ha_noi`, `10_tinh_quang_ninh`
  - Vietnamese diacritical marks are removed (e.g., "đ" → "d", "ấ" → "a")
  - Common words like "tỉnh", "thành phố" are removed
  - All lowercase with underscores

## File Naming Convention

- **Province files**: `province.geojson`
- **Ward files**: `{stt}_{sanitized_name}_{type}.geojson`
  - Example: `1_ba_dinh_phuong.geojson`, `100_thuong_cat_phuong.geojson`
  - Type indicates: `phuong` (ward), `xa` (commune), `thi tran` (township)
  - Vietnamese diacritical marks are removed
  - All lowercase with underscores

## Data Source

GeoJSON data is fetched from the Bando.com.vn API:
- **API Endpoint**: `https://sapnhap.bando.com.vn/pread_json`
- **Method**: POST
- **Parameter**: `id` (GIS server ID)

## Statistics

- **Total Provinces**: 34
- **Total Wards**: 3,321
- **Total Files**: 3,355
- **Date Fetched**: March 13, 2026

## Usage

### Fetching Data

To fetch all GeoJSON data, run:
```bash
cd dataset-generation-scripts
python3 resources/gis/fetch_geojson.py
```

### Python Dependencies

The fetcher script requires:
```bash
pip3 install requests
```

## File Format

All GeoJSON files are formatted with 2-space indentation and UTF-8 encoding. Vietnamese characters are preserved in the file content while filenames are sanitized for cross-platform compatibility.

## Notes

- The GeoJSON data contains polygon/feature collections for administrative boundaries
- Each file includes geographic coordinates that can be used with mapping libraries like Leaflet, Mapbox, or D3.js
- The data follows the standard GeoJSON format (RFC 7946)

## License

This data is sourced from Bando.com.vn. Please refer to their terms of service for usage restrictions.