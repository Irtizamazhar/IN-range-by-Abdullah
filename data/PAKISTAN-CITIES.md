# Pakistan city and town suggestions

Source: [GeoNames cities1000](https://download.geonames.org/export/dump/), downloaded 16 October 2026. GeoNames distributes its data under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution: GeoNames, https://www.geonames.org/.

The importer keeps populated places with country code PK, uses their ASCII names for straightforward English search, removes spelling-equivalent duplicates, preserves the application's previous city names, and adds regional towns in Gilgit-Baltistan and Azad Jammu and Kashmir. The source covers places with more than 1,000 inhabitants or administrative seats; it is a broad suggestion list rather than a complete address registry. No coordinates or personal data are shipped.

Refresh by extracting cities1000.txt from the official download and running `node scripts/import-pakistan-cities.mjs path/to/cities1000.txt`. Review the resulting JSON before release. Custom and previously saved city names remain valid in the selector and existing APIs, including places absent from this dataset. No runtime external service is required.
