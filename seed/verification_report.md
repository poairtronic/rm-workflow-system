# Delivery Challan Re-creation Verification Report

**Execution Timestamp:** 2026-11-13T06:23:06.063Z
**Target Branch:** `feature/seed-dc-from-pdf`

## 1. Executive Summary & Success Criteria

| Verification Metric | Target Requirement | Actual Database State | Status |
| :--- | :--- | :--- | :--- |
| **Total DCs Created** | 43 (42 distinct + 0001-B) | **43** | PASSED |
| **DC Returns: ALL** | 43 | **43** | PASSED |
| **DC Returns: OPEN** | 43 (100%) | **43** | PASSED |
| **DC Returns: PARTIAL** | 0 | **0** | PASSED |
| **DC Returns: CLOSED** | 0 | **0** | PASSED |
| **Total Dispatched Lines** | 245 | **245** | PASSED |
| **Total Dispatched Qty** | 562 NOS | **562 NOS** | PASSED |
| **Total Inward Received Qty** | 0 NOS | **0 NOS** | PASSED |
| **Suffixed Part Numbers (`\d+-\d+`)** | 0 in line items | **0** | PASSED |
| **Seed JSON Match Rate** | 100% (43 / 43) | **100.0%** | PASSED |

## 2. Per-DC Comparison (Seed JSON vs PostgreSQL Database)

| DC Number | Date (Seed/DB) | Lines (Seed/DB) | Total Qty (Seed/DB) | Vendor | PO Number | Status | Match |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SDC/2627/0001` | 2026-11-07 / 2026-11-07 | 1 / 1 | 2 / 2 | SKY LINE ENGINEERING | `AGIPLPO1210-BHARAT FORGE-PROJECT 2` | `OPEN` | MATCH |
| `SDC/2627/0001-B` | 2026-11-07 / 2026-11-07 | 2 / 2 | 4 / 4 | SKY LINE ENGINEERING | `AGIPLPO1248-HL MANDO` | `OPEN` | MATCH |
| `SDC/2627/0002` | 2026-11-07 / 2026-11-07 | 1 / 1 | 2 / 2 | STANDARD ENGINEERING ENTERPRISES | `AGIPLPO950-UCAL LIMITED` | `OPEN` | MATCH |
| `SDC/2627/0004` | 2026-11-07 / 2026-11-07 | 6 / 6 | 20 / 20 | RK ENGINEERING WORKS | `AGIPLPO1162- LGB` | `OPEN` | MATCH |
| `SDC/2627/0005` | 2026-11-07 / 2026-11-07 | 1 / 1 | 2 / 2 | MICROMAC CNC | `AGIPLPO1322- ABHINAVA RIZEL` | `OPEN` | MATCH |
| `SDC/2627/0006` | 2026-11-07 / 2026-11-07 | 17 / 17 | 86 / 86 | GANESH SAI INDUSTRES | `AGIPLPO939-PRICOL` | `OPEN` | MATCH |
| `SDC/2627/0007` | 2026-11-07 / 2026-11-07 | 1 / 1 | 1 / 1 | NV CNC TEHNOLGIES | `AGIPLPO1097 - SFC SOLUTIONS` | `OPEN` | MATCH |
| `SDC/2627/0008` | 2026-11-07 / 2026-11-07 | 11 / 11 | 15 / 15 | FLAMETECH (MADRAS) PVT.LTD | `AGIPLPO721-ABI SHOWATECH` | `OPEN` | MATCH |
| `SDC/2627/0009` | 2026-11-07 / 2026-11-07 | 2 / 2 | 4 / 4 | R.K.V METAL FINISHERS | `AGIPLPO722-GREENTECH` | `OPEN` | MATCH |
| `SDC/2627/0010` | 2026-11-07 / 2026-11-07 | 1 / 1 | 2 / 2 | FINISHWEL HONING WORKS | `AGIPLPO941-SCL ORG` | `OPEN` | MATCH |
| `SDC/2627/0011` | 2026-11-07 / 2026-11-07 | 8 / 8 | 8 / 8 | EXPORT BLAKENING | `AGIPLPO 667 - HYUNDAI WIA` | `OPEN` | MATCH |
| `SDC/2627/0012` | 2026-11-07 / 2026-11-07 | 2 / 2 | 4 / 4 | SKY LINE ENGINEERING | `AGIPLPO1047-KARTHIKA PRECISION` | `OPEN` | MATCH |
| `SDC/2627/0013` | 2026-11-10 / 2026-11-10 | 5 / 5 | 5 / 5 | MICROMAC CNC | `AGIPLPO751-SRINIVASA` | `OPEN` | MATCH |
| `SDC/2627/0014` | 2026-11-10 / 2026-11-10 | 1 / 1 | 1 / 1 | RK ENGINEERING WORKS | `BHARAT FORGE- PROJECT 1` | `OPEN` | MATCH |
| `SDC/2627/0015` | 2026-11-10 / 2026-11-10 | 33 / 33 | 74 / 74 | GSM ENGINEERS | `AGIPLPO1226- SEG AUTOMOTIVE` | `OPEN` | MATCH |
| `SDC/2627/0016` | 2026-11-10 / 2026-11-10 | 6 / 6 | 6 / 6 | V.S. ENGINEERING | `AGIPLPO977-TUBE INVESTMENTS` | `OPEN` | MATCH |
| `SDC/2627/0017` | 2026-11-10 / 2026-11-10 | 6 / 6 | 20 / 20 | GANESH SAI INDUSTRES | `AGIPLPO1319 - MAGNA` | `OPEN` | MATCH |
| `SDC/2627/0019` | 2026-11-10 / 2026-11-10 | 16 / 16 | 52 / 52 | SKY LINE ENGINEERING | `AGIPLPO1203 - AUTOTECH` | `OPEN` | MATCH |
| `SDC/2627/0020` | 2026-11-10 / 2026-11-10 | 1 / 1 | 1 / 1 | NV CNC TEHNOLGIES | `AGIPLPO926-INDOMIM` | `OPEN` | MATCH |
| `SDC/2627/0021` | 2026-11-10 / 2026-11-10 | 2 / 2 | 4 / 4 | R.K.V METAL FINISHERS | `AGIPLPO1274/SCL- 20 DAYS DEL` | `OPEN` | MATCH |
| `SDC/2627/0022` | 2026-11-10 / 2026-11-10 | 16 / 16 | 26 / 26 | FLAMETECH (MADRAS) PVT.LTD | `AGIPLPO1231` | `OPEN` | MATCH |
| `SDC/2627/0026` | 2026-11-10 / 2026-11-10 | 1 / 1 | 2 / 2 | SKY LINE ENGINEERING | `AGIPLPO1178NIROTECH` | `OPEN` | MATCH |
| `SDC/2627/0027` | 2026-11-10 / 2026-11-10 | 1 / 1 | 2 / 2 | NV CNC TEHNOLGIES | `AGIPLPO949-MM FORGINGS` | `OPEN` | MATCH |
| `SDC/2627/0028` | 2026-11-10 / 2026-11-10 | 5 / 5 | 13 / 13 | RK ENGINEERING WORKS | `AGIPLPO1031-RAMIND COLD` | `OPEN` | MATCH |
| `SDC/2627/0029` | 2026-11-10 / 2026-11-10 | 1 / 1 | 1 / 1 | ABI ENGINEERINGS | `AGIPLPO956-LGB` | `OPEN` | MATCH |
| `SDC/2627/0030` | 2026-11-11 / 2026-11-11 | 1 / 1 | 1 / 1 | SABARI SPARK | `AGIPLPO998-LGB` | `OPEN` | MATCH |
| `SDC/2627/0032` | 2026-11-11 / 2026-11-11 | 3 / 3 | 12 / 12 | FINISHWEL HONING WORKS | `AGIPLPO1221 - GNUTTI` | `OPEN` | MATCH |
| `SDC/2627/0034` | 2026-11-11 / 2026-11-11 | 2 / 2 | 4 / 4 | R.K.V METAL FINISHERS | `BHARAT FORGE- PROJECT 1` | `OPEN` | MATCH |
| `SDC/2627/0040` | 2026-11-11 / 2026-11-11 | 11 / 11 | 42 / 42 | SKY LINE ENGINEERING | `BHARAT FORGE- PROJECT 3` | `OPEN` | MATCH |
| `SDC/2627/0045` | 2026-11-11 / 2026-11-11 | 1 / 1 | 1 / 1 | PS CORPORATION | `AGIPLPO956-LGB` | `OPEN` | MATCH |
| `SDC/2627/0046` | 2026-11-11 / 2026-11-11 | 10 / 10 | 13 / 13 | EXPORT BLAKENING | `AGIPLPO1326 - SUPER AUTO` | `OPEN` | MATCH |
| `SDC/2627/0047` | 2026-11-12 / 2026-11-12 | 1 / 1 | 1 / 1 | J V TOOLS | `AGIPLPO926-INDOMIM` | `OPEN` | MATCH |
| `SDC/2627/0048` | 2026-11-12 / 2026-11-12 | 1 / 1 | 2 / 2 | MICROMAC CNC | `AGIPLPO1042-MAGELLAN` | `OPEN` | MATCH |
| `SDC/2627/0049` | 2026-11-12 / 2026-11-12 | 1 / 1 | 1 / 1 | S.M.K INDUSTRIES | `BHARAT FORGE- PROJECT 3` | `OPEN` | MATCH |
| `SDC/2627/0050` | 2026-11-12 / 2026-11-12 | 7 / 7 | 9 / 9 | FLAMETECH (MADRAS) PVT.LTD | `AGIPLPO647- RAMIND` | `OPEN` | MATCH |
| `SDC/2627/0052` | 2026-11-12 / 2026-11-12 | 24 / 24 | 67 / 67 | DURGA METAL FINISHERS | `AGIPLPO1249- MARKS ENGG` | `OPEN` | MATCH |
| `SDC/2627/0053` | 2026-11-12 / 2026-11-12 | 3 / 3 | 4 / 4 | SRI SIVAM INDUSTRIES | `AGIPLPO937-WIPRO` | `OPEN` | MATCH |
| `SDC/2627/0054` | 2026-11-12 / 2026-11-12 | 10 / 10 | 15 / 15 | GSM ENGINEERS | `AGIPLPO1158- REAL TALENT` | `OPEN` | MATCH |
| `SDC/2627/0055` | 2026-11-12 / 2026-11-12 | 16 / 16 | 24 / 24 | EXPORT BLAKENING | `AGIPLPO1200 - AUTOTECH` | `OPEN` | MATCH |
| `SDC/2627/0056` | 2026-11-12 / 2026-11-12 | 2 / 2 | 2 / 2 | FLAMETECH (MADRAS) PVT.LTD | `AGIPLPO956-LGB` | `OPEN` | MATCH |
| `SDC/2627/0057` | 2026-11-12 / 2026-11-12 | 1 / 1 | 1 / 1 | ABI ENGINEERINGS | `AGIPLPO1356 - SYSMAC` | `OPEN` | MATCH |
| `SDC/2627/0058` | 2026-11-12 / 2026-11-12 | 3 / 3 | 5 / 5 | SIVASAKTHI INDUSTRIES | `AGIPLPO1382-LGB` | `OPEN` | MATCH |
| `SDC/2627/0059` | 2026-11-12 / 2026-11-12 | 1 / 1 | 1 / 1 | EXPORT BLAKENING | `AGIPLPO1009- SAF` | `OPEN` | MATCH |

## 3. Deep-Dive Line Audit: Top 5 Largest Delivery Challans

### SDC/2627/0006 (17 Merged Lines)

| Part Number | Description / Specification | Qty (NOS) | Raw PDF Suffix Clubbing Breakdown |
| :--- | :--- | :--- | :--- |
| `2018` | SRG DIA 8.0+0.03 | **2** | 2018 (2) |
| `2062` | SRG DIA 9 H7+0.015 | **2** | 2062 (2) |
| `2066` | SRG DIA 9 H7+0.015 | **4** | 2066-1 (2), 2066-2 (2) |
| `2244` | SRG DIA 10.50+0.02/-0.05 | **4** | 2244-1 (2), 2244-2 (2) |
| `2246` | SRG DIA 10.0+0.050 | **2** | 2246 (2) |
| `2386` | SRG DIA 9.68 +/-0.010 | **6** | 2386-1 (2), 2386-2 (2), 2386-3 (2) |
| `2387` | SRG DIA 6.337 +0.013 | **4** | 2387-1 (2), 2387-2 (2) |
| `2394` | SRG DIA 11.200 / 11.220 | **8** | 2394-1 (2), 2394-2 (2), 2394-3 (2), 2394-4 (2) |
| `2395` | SRG DIA 10.580 / 10.560 | **8** | 2395-1 (2), 2395-2 (2), 2395-3 (2), 2395-4 (2) |
| `2396` | SRG DIA 10.520 / 10.560 | **8** | 2396-1 (2), 2396-2 (2), 2396-3 (2), 2396-4 (2) |
| `2398` | SRG DIA 9.683 / 9.713 | **6** | 2398-1 (2), 2398-2 (2), 2398-3 (2) |
| `2411` | SRG DIA 7.912 +/-0.019 | **6** | 2411-1 (2), 2411-2 (2), 2411-3 (2) |
| `2428` | SRG DIA 9.650 / 9.665 | **6** | 2428-1 (2), 2428-2 (2), 2428-3 (2) |
| `2447` | SRG DIA 12.740 / 12.755 | **6** | 2447-1 (2), 2447-2 (2), 2447-3 (2) |
| `2449` | SRG DIA 9.000 / 9.022 | **6** | 2449-1 (2), 2449-2 (2), 2449-3 (2) |
| `2453` | SRG DIA 9.988 / 10.012 | **6** | 2453-1 (2), 2453-2 (2), 2453-3 (2) |
| `2464` | SRG DIA 12.680 +/-0.02 | **2** | 2464 (2) |

### SDC/2627/0015 (33 Merged Lines)

| Part Number | Description / Specification | Qty (NOS) | Raw PDF Suffix Clubbing Breakdown |
| :--- | :--- | :--- | :--- |
| `2460` | APG DIA 57.250 +/-0.025 | **1** | 2460 (1) |
| `2480` | APG DIA 40.025 +/-0.01 | **1** | 2480 (1) |
| `2482` | APG DIA 26.02 +/-0.01 | **1** | 2482 (1) |
| `2419` | APG DIA 34.450 / 34.500 | **5** | 2419-1 (1), 2419-1 (4) |
| `2417` | APG DIA 35.00 / 35.088 | **1** | 2417-1 (1) |
| `2479` | APG DIA 47.025 +/-0.01 | **1** | 2479 (1) |
| `2481` | APG DIA 52.02 +/-0.01 | **1** | 2481 (1) |
| `2418` | APG DIA 35.00 / 35.062 | **3** | 2418-1 (3) |
| `2446` | APG DIA 34.00 / 34.025 | **2** | 2446-1 (2) |
| `2425` | APG DIA 53.950 / 54.000 | **3** | 2425-1 (3) |
| `2431` | APG DIA 54.440 / 54.480 | **3** | 2431-1 (3) |
| `2396` | APG DIA 10.520 / 10.560 | **4** | 2396-1 (1), 2396-1 (3) |
| `2472` | APG DIA 18.963 / 18.976 | **1** | 2472 (1) |
| `2513` | APG DIA 20.01 +/-0.02 | **1** | 2513 (1) |
| `2495` | APG DIA 15.811 +/0.012 | **1** | 2495 (1) |
| `2436` | APG DIA 15.875 / 15.885 | **1** | 2436-1 (1) |
| `2519` | APG DIA 15.05±0.03 | **1** | 2519 (1) |
| `2441` | APG DIA 15.954 / 15.973 | **1** | 2441-1 (1) |
| `2426` | ARG DIA 21.807 / 21.840 | **1** | 2426-1 (1) |
| `2400` | APG DIA 15.880 / 15.890 | **3** | 2400-1 (3) |
| `2429` | APG DIA 13.500 / 13.540 | **3** | 2429-1 (3) |
| `2452` | APG DIA 12.130 / 12.170 | **3** | 2452-1 (3) |
| `2416` | APG DIA 13.05 / 13.100 | **3** | 2416-1 (3) |
| `2464` | APG DIA 12.680 +/-0.02 | **1** | 2464 (1) |
| `2409` | APG DIA 20.000 / 20.052 | **5** | 2409-1 (5) |
| `2430` | APG DIA 22.0 +/-0.035 | **3** | 2430-1 (3) |
| `2398` | APG DIA 9.683 / 9.713 | **3** | 2398-1 (3) |
| `2411` | APG DIA 7.912 +/-0.019 | **3** | 2411-1 (3) |
| `2447` | APG DIA 12.740 / 12.755 | **3** | 2447-1 (3) |
| `2395` | APG DIA 10.580 / 10.560 | **4** | 2395-1 (4) |
| `2394` | APG DIA 11.200 / 11.220 | **5** | 2394-1 (5) |
| `2497` | APG DIA 47.008 +/-0.006 | **1** | 2497 (1) |
| `2466` | APG DIA 47.00 -0.028 / -0.012 | **1** | 2466 (1) |

### SDC/2627/0052 (24 Merged Lines)

| Part Number | Description / Specification | Qty (NOS) | Raw PDF Suffix Clubbing Breakdown |
| :--- | :--- | :--- | :--- |
| `2495` | SRG DIA 15.811 +/0.012 | **1** | 2495 (1) |
| `2526` | SRG DIA 19.05 -0.030 | **2** | 2526 (2) |
| `2490` | SRG DIA 17.551 / 17.513 | **2** | 2490 (2) |
| `2468` | SRG DIA 14.970 | **2** | 2468 (2) |
| `2461` | SRG DIA 18.00 +0.027 | **2** | 2461 (2) |
| `2470` | SRG DIA 15.010 | **2** | 2470 (2) |
| `2524` | SRG DIA 15.875 | **2** | 2524 (2) |
| `2473` | SRG DIA 18.963 / 18.976 | **2** | 2473 (2) |
| `2527` | SRG DIA 16.0 -0.016 / -0.034 | **2** | 2527 (2) |
| `2491` | SRG DIA 16.0 -0.016 / -0.034 | **2** | 2491 (2) |
| `2472` | SRG DIA 18.963 / 18.976 | **2** | 2472 (2) |
| `2467` | SRG DIA 18.50 +0.021 | **2** | 2467 (2) |
| `2440` | SRG DIA 15.000 / 15.018 | **6** | 2440 (6) |
| `2441` | SRG DIA 15.954 / 15.973 | **6** | 2441 (6) |
| `2436` | SRG DIA 15.875 / 15.885 | **6** | 2436 (6) |
| `2404` | SRG DIA 17.014 / 17.057 | **6** | 2404 (6) |
| `2400` | SRG DIA 15.880 / 15.890 | **6** | 2400 (6) |
| `2519` | SRG DIA 15.05±0.03 | **2** | 2519 (2) |
| `2471` | SRG DIA 15.030 | **2** | 2471 (2) |
| `2429` | SRG DIA 13.500 / 13.540 | **2** | 2429 (2) |
| `2485` | SRG DIA 13.500 +0.018 | **2** | 2485 (2) |
| `2137` | SRG DIA 10.0 -0.008 | **2** | 2137 (2) |
| `2510` | URGENT - 4 WEEKS SRG DIA 13.500 / 13.530 | **2** | 2510 (2) |
| `1891` | SRG DIA 13.6+0.011- DULL CHROME & STICKER SLOT | **2** | 1891 (2) |

### SDC/2627/0055 (16 Merged Lines)

| Part Number | Description / Specification | Qty (NOS) | Raw PDF Suffix Clubbing Breakdown |
| :--- | :--- | :--- | :--- |
| `2432` | APG DIA 54.500 / 54.525 | **2** | 2432 (2) |
| `2391` | APG DIA 16.016 / 16.034 | **4** | 2391 (4) |
| `2389` | APG DIA 29.900 / 29.920 | **1** | 2389 (1) |
| `2386` | APG DIA 9.680 +/-0.010 | **3** | 2386 (3) |
| `2364` | APG DIA 9.3 +/-0.013 | **1** | 2364 (1) |
| `2359` | APG DIA 18.795 -0.01 | **1** | 2359 (1) |
| `2358` | APG DIA 18.6 +0.02 | **1** | 2358 (1) |
| `2355` | APG DIA 16.30 +0.02 | **1** | 2355 (1) |
| `2347` | APG DIA 15.0 +/-0.02 | **1** | 2347 (1) |
| `2346` | APG DIA 47.625 +0.013 / -0.015 | **1** | 2346 (1) |
| `2320` | APG DIA 16.056 +/-0.014- | **1** | 2320 (1) |
| `2319` | APG DIA 30.38 +/-0.035- | **1** | 2319 (1) |
| `2305` | APG DIA 26.0 +0.021 | **1** | 2305 (1) |
| `2011` | VERTICAL BENCH MOUNT PLATE | **1** | 2011 (1) |
| `2498` | SRG DIA 50.830 / 50.860 | **2** | 2498 (1), 2498 (1) |
| `2469` | SRG DIA 14.990 | **2** | 2469 (2) |

### SDC/2627/0008 (11 Merged Lines)

| Part Number | Description / Specification | Qty (NOS) | Raw PDF Suffix Clubbing Breakdown |
| :--- | :--- | :--- | :--- |
| `1921` | APG DIA 36.000/36.016 48 - 50 HRC | **1** | 1921-2 (1) |
| `2130` | ARG DIA 29.980+/-0.018 48 - 50 HRC | **2** | 2130-1 (1), 2130-2 (1) |
| `2256` | APG DIA 38.1+/-0.035 | **1** | 2256 (1) |
| `2323` | APG DIA 69.929 +/-0.018 | **2** | 2323-1 (1), 2323-2 (1) |
| `2324` | APG DIA 49.70 +0.02 | **2** | 2324-1 (1), 2324-2 (1) |
| `2326` | APG DIA 26.50 +0.03 | **2** | 2326-1 (1), 2326-2 (1) |
| `2327` | SRG DIA 26.30 +0.02 | **1** | 2327-1 (1) |
| `2318` | APG DIA 49.6 +/-0.015- | **1** | 2318 (1) |
| `2503` | SRG DIA 31.731 +/-0.009 | **1** | 2503-1 (1) |
| `2507` | SRG DIA 38.00 +0.05 / +0.07 | **1** | 2507 (1) |
| `2509` | SRG DIA 38.016 +0.01 | **1** | 2509 (1) |

## 4. Product-Lock Conflicts Analysis (DCL.1-3)

Because all 43 DCs are imported simultaneously in `OPEN` status, parts shared across multiple open production dispatches represent active concurrent shopfloor movements.

Total parts with multi-DC open dispatches: **58**

| Part Number | Open DC Count | Delivery Challans Involved |
| :--- | :--- | :--- |
| `2327` | 4 | SDC/2627/0008, SDC/2627/0022, SDC/2627/0046, SDC/2627/0050 |
| `2087` | 3 | SDC/2627/0029, SDC/2627/0045, SDC/2627/0056 |
| `2320` | 3 | SDC/2627/0021, SDC/2627/0022, SDC/2627/0055 |
| `2355` | 3 | SDC/2627/0004, SDC/2627/0022, SDC/2627/0055 |
| `2364` | 3 | SDC/2627/0017, SDC/2627/0022, SDC/2627/0055 |
| `2386` | 3 | SDC/2627/0006, SDC/2627/0022, SDC/2627/0055 |
| `2391` | 3 | SDC/2627/0022, SDC/2627/0032, SDC/2627/0055 |
| `2395` | 3 | SDC/2627/0006, SDC/2627/0015, SDC/2627/0017 |
| `2429` | 3 | SDC/2627/0004, SDC/2627/0015, SDC/2627/0052 |
| `2432` | 3 | SDC/2627/0019, SDC/2627/0022, SDC/2627/0055 |
| `1758` | 2 | SDC/2627/0050, SDC/2627/0053 |
| `1892` | 2 | SDC/2627/0009, SDC/2627/0032 |
| `1893` | 2 | SDC/2627/0009, SDC/2627/0032 |
| `1921` | 2 | SDC/2627/0008, SDC/2627/0016 |
| `2024` | 2 | SDC/2627/0020, SDC/2627/0047 |
| `2217` | 2 | SDC/2627/0001-B, SDC/2627/0050 |
| `2218` | 2 | SDC/2627/0014, SDC/2627/0050 |
| `2244` | 2 | SDC/2627/0006, SDC/2627/0054 |
| `2256` | 2 | SDC/2627/0008, SDC/2627/0046 |
| `2305` | 2 | SDC/2627/0022, SDC/2627/0055 |
| `2318` | 2 | SDC/2627/0008, SDC/2627/0046 |
| `2319` | 2 | SDC/2627/0022, SDC/2627/0055 |
| `2323` | 2 | SDC/2627/0008, SDC/2627/0046 |
| `2324` | 2 | SDC/2627/0008, SDC/2627/0046 |
| `2326` | 2 | SDC/2627/0008, SDC/2627/0046 |
| `2346` | 2 | SDC/2627/0022, SDC/2627/0055 |
| `2347` | 2 | SDC/2627/0022, SDC/2627/0055 |
| `2358` | 2 | SDC/2627/0022, SDC/2627/0055 |
| `2359` | 2 | SDC/2627/0022, SDC/2627/0055 |
| `2389` | 2 | SDC/2627/0022, SDC/2627/0055 |
| `2390` | 2 | SDC/2627/0019, SDC/2627/0050 |
| `2394` | 2 | SDC/2627/0006, SDC/2627/0015 |
| `2396` | 2 | SDC/2627/0006, SDC/2627/0015 |
| `2398` | 2 | SDC/2627/0006, SDC/2627/0015 |
| `2400` | 2 | SDC/2627/0015, SDC/2627/0052 |
| `2404` | 2 | SDC/2627/0052, SDC/2627/0054 |
| `2409` | 2 | SDC/2627/0015, SDC/2627/0040 |
| `2411` | 2 | SDC/2627/0006, SDC/2627/0015 |
| `2416` | 2 | SDC/2627/0004, SDC/2627/0015 |
| `2417` | 2 | SDC/2627/0015, SDC/2627/0019 |
| `2418` | 2 | SDC/2627/0015, SDC/2627/0019 |
| `2419` | 2 | SDC/2627/0015, SDC/2627/0019 |
| `2430` | 2 | SDC/2627/0015, SDC/2627/0040 |
| `2431` | 2 | SDC/2627/0015, SDC/2627/0019 |
| `2436` | 2 | SDC/2627/0015, SDC/2627/0052 |
| `2441` | 2 | SDC/2627/0015, SDC/2627/0052 |
| `2446` | 2 | SDC/2627/0015, SDC/2627/0019 |
| `2447` | 2 | SDC/2627/0006, SDC/2627/0015 |
| `2452` | 2 | SDC/2627/0015, SDC/2627/0017 |
| `2464` | 2 | SDC/2627/0006, SDC/2627/0015 |
| `2469` | 2 | SDC/2627/0022, SDC/2627/0055 |
| `2472` | 2 | SDC/2627/0015, SDC/2627/0052 |
| `2495` | 2 | SDC/2627/0015, SDC/2627/0052 |
| `2498` | 2 | SDC/2627/0022, SDC/2627/0055 |
| `2507` | 2 | SDC/2627/0008, SDC/2627/0046 |
| `2509` | 2 | SDC/2627/0008, SDC/2627/0046 |
| `2517` | 2 | SDC/2627/0040, SDC/2627/0058 |
| `2519` | 2 | SDC/2627/0015, SDC/2627/0052 |

## 5. Sequence Counter Verification

- Highest Seeded DC Number: `SDC/2627/0059`
- Next Automatic DC Number: `SDC/2627/0060` (guaranteed non-colliding).

