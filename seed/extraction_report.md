# DC Extraction Report from Scanned PDF (DC_sorted_v3.pdf)

**Date Generated:** 2026-11-13T05:32:16.314Z
**Input File:** `seed/DC_sorted_v3.pdf` (60 scanned pages)
**Total Distinct DC Numbers:** 42
**Total Delivery Challans Extracted:** 43 (including `SDC/2627/0001-B`)

## 1. Number Sequence & Gaps
- **Min DC Number:** `SDC/2627/0001`
- **Max DC Number:** `SDC/2627/0059`
- **Expected Range:** 0001 to 0059 (59 sequential slots)
- **Missing / Gaps in Sequence:**
  - `0003` (absent from PDF)
  - `0018` (explicitly removed from PDF per user instructions)
  - `0023, 0024, 0025` (absent from PDF)
  - `0031` (absent from PDF)
  - `0033` (absent from PDF)
  - `0035, 0036, 0037, 0038, 0039` (absent from PDF)
  - `0041, 0042, 0043, 0044` (absent from PDF)
  - `0051` (absent from PDF)
  - *Total gaps:* 17 missing numbers.

## 2. Summary by Delivery Challan

| DC Number | Date | Vendor Name | Purchase Order | Line Count | Total Qty | Source Pages | Flags |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **SDC/2627/0001** | 2026-11-07 | SKY LINE ENGINEERING | AGIPLPO1210-BHARAT FORGE-PROJECT 2 | 1 | 2 NOS | 1 | None |
| **SDC/2627/0001-B** | 2026-11-07 | SKY LINE ENGINEERING | AGIPLPO1248-HL MANDO | 2 | 4 NOS | 2 | Duplicate DC number 0001 with different PO (AGIPLPO1248-HL MANDO). Designated as SDC/2627/0001-B for review.; Line 2 (part 2181, 2 NOS) visibly struck through; excluded from import. |
| **SDC/2627/0002** | 2026-11-07 | STANDARD ENGINEERING ENTERPRISES | AGIPLPO950-UCAL LIMITED | 1 | 2 NOS | 3 | None |
| **SDC/2627/0004** | 2026-11-07 | RK ENGINEERING WORKS | AGIPLPO1162 - LGB | 6 | 20 NOS | 5 | DC 0004 appeared twice (Page 4 RK ENGG vs Page 5 RK ENGINEERING WORKS). RK ENGINEERING WORKS version selected per rule. |
| **SDC/2627/0005** | 2026-11-07 | MICROMAC CNC | AGIPLPO1322 - ABHINAVA RIZEL | 1 | 2 NOS | 6 | Line 2 (part 2242, 1 NOS) visibly struck through; excluded from import. |
| **SDC/2627/0006** | 2026-11-07 | GANESH SAI INDUSTRES | AGIPLPO939-PRICOL | 17 | 86 NOS | 7, 8, 9, 10, 11 | None |
| **SDC/2627/0007** | 2026-11-07 | NVCNC | AGIPLPO1097 - SFC SOLUTIONS | 1 | 1 NOS | 12 | None |
| **SDC/2627/0008** | 2026-11-07 | FLAME TECH / HTV | AGIPLPO721-ABI SHOWATECH | 11 | 15 NOS | 13, 14 | Page 14 has handwritten addition '2517 APG 1 NO'; not imported per rule. |
| **SDC/2627/0009** | 2026-11-07 | RKV METAL | AGIPLPO722-GREENTECH | 2 | 4 NOS | 15 | None |
| **SDC/2627/0010** | 2026-11-07 | FINISHWEL HONING WORKS | AGIPLPO941-SCL ORG | 1 | 2 NOS | 16 | None |
| **SDC/2627/0011** | 2026-11-07 | EXPORT BLAKENING | AGIPLPO 667 - HYUNDAI WIA | 8 | 8 NOS | 17 | None |
| **SDC/2627/0012** | 2026-11-07 | SKY LINE ENGINEERING | AGIPLPO1047-KARTHIKA PRECISION | 2 | 4 NOS | 18 | None |
| **SDC/2627/0013** | 2026-11-10 | MICROMAC CNC | AGIPLPO751-SRINIVASA | 5 | 5 NOS | 19 | None |
| **SDC/2627/0014** | 2026-11-10 | RK ENGINEERING WORKS | BHARAT FORGE - PROJECT 1 | 1 | 1 NOS | 20 | None |
| **SDC/2627/0015** | 2026-11-10 | GSM ENGINEERS | AGIPLPO1226- SEG AUTOMOTIVE | 33 | 74 NOS | 21, 22, 23, 24 | None |
| **SDC/2627/0016** | 2026-11-10 | V.S. ENGINEERING | AGIPLPO977-TUBE INVESTMENTS | 6 | 6 NOS | 25 | None |
| **SDC/2627/0017** | 2026-11-10 | GANESH SAI INDUSTRES | AGIPLPO1319 - MAGNA | 6 | 20 NOS | 26 | None |
| **SDC/2627/0019** | 2026-11-10 | SKY LINE ENGINEERING | AGIPLPO1203 - AUTOTECH | 16 | 52 NOS | 27, 28 | None |
| **SDC/2627/0020** | 2026-11-10 | NV CNC TEHNOLGIES | AGIPLPO926-INDOMIM | 1 | 1 NOS | 29 | None |
| **SDC/2627/0021** | 2026-11-10 | R.K.V METAL FINISHERS | AGIPLPO1274/SCL- 20 DAYS DEL | 2 | 4 NOS | 30 | None |
| **SDC/2627/0022** | 2026-11-10 | FLAMETECH (MADRAS) PVT.LTD | AGIPLPO1231 | 16 | 26 NOS | 31, 32 | Part 2498 appears twice: SI 2 as SRG (qty 2) and SI 15 as APG (qty 1). Merged into base 2498 with qty 3.; Multiple descriptions for base part 2498: "SRG DIA 50.830 / 50.860" vs "APG DIA 50.830 / 50.860". Summing qty. |
| **SDC/2627/0026** | 2026-11-10 | SKY LINE ENGINEERING | AGIPLPO1178NIROTECH | 1 | 2 NOS | 33 | Page 33 has handwritten notation '2192 - 108 +/-0.001 -> 1 NO' and overwritten qty. Printed qty (2 NOS) and printed description retained per rule. |
| **SDC/2627/0027** | 2026-11-10 | NV CNC TEHNOLGIES | AGIPLPO949- MM FORGINGS | 1 | 2 NOS | 34 | None |
| **SDC/2627/0028** | 2026-11-10 | RK ENGINEERING WORKS | AGIPLPO1031-RAMIND COLD | 5 | 13 NOS | 35 | None |
| **SDC/2627/0029** | 2026-11-10 | ABI ENGINEERINGS | AGIPLPO956-LGB | 1 | 1 NOS | 36 | In line 1, 'SPG DIA 100.0-0.06' portion is visibly struck through; ARG description kept per rule. |
| **SDC/2627/0030** | 2026-11-11 | SABARI SPARK | AGIPLPO998-LGB | 1 | 1 NOS | 37 | None |
| **SDC/2627/0032** | 2026-11-11 | FINISHWEL HONING WORKS | AGIPLPO1221 - GNUTTI | 3 | 12 NOS | 38, 39 | DC 0032 appears identically on Pages 38 and 39; imported once per rule. |
| **SDC/2627/0034** | 2026-11-11 | R.K.V METAL FINISHERS | BHARAT FORGE - PROJECT 1 | 2 | 4 NOS | 40 | None |
| **SDC/2627/0040** | 2026-11-11 | SKY LINE ENGINEERING | BHARAT FORGE- PROJECT 3 | 11 | 42 NOS | 41, 42 | None |
| **SDC/2627/0045** | 2026-11-11 | PS CORPORATION | AGIPLPO956-LGB | 1 | 1 NOS | 43 | None |
| **SDC/2627/0046** | 2026-11-11 | EXPORT BLAKENING | AGIPLPO1326 - SUPER AUTO | 10 | 13 NOS | 44 | None |
| **SDC/2627/0047** | 2026-11-12 | J V TOOLS | AGIPLPO926-INDOMIM | 1 | 1 NOS | 45 | None |
| **SDC/2627/0048** | 2026-11-12 | MICROMAC CNC | AGIPLPO1042-MAGELLAN | 1 | 2 NOS | 46 | None |
| **SDC/2627/0049** | 2026-11-12 | S.M.K INDUSTRIES | BHARAT FORGE- PROJECT 3 | 1 | 1 NOS | 47 | None |
| **SDC/2627/0050** | 2026-11-12 | FLAMETECH (MADRAS) PVT.LTD | AGIPLPO647 - RAMIND | 7 | 9 NOS | 48, 49 | DC 0050 appears identically on Pages 48 and 49; imported once per rule. |
| **SDC/2627/0052** | 2026-11-12 | DURGA METAL FINISHERS | AGIPLPO1249- MARKS ENGG | 24 | 67 NOS | 50, 51, 52 | Page 52 SI 24 (part 2440, 6 NOS) visibly struck through; excluded from import (Page 51 SI 13 part 2440 6 NOS is kept). |
| **SDC/2627/0053** | 2026-11-12 | SRI SIVAM INDUSTRIES | AGIPLPO937-WIPRO | 3 | 4 NOS | 53 | None |
| **SDC/2627/0054** | 2026-11-12 | GSM ENGINEERS | AGIPLPO1158- REAL TALENT | 10 | 15 NOS | 54 | None |
| **SDC/2627/0055** | 2026-11-12 | EXPORT BLAKENING | AGIPLPO1200 - AUTOTECH | 16 | 24 NOS | 55, 56 | Part 2498 appears twice: SI 15 as SRG (qty 1) and SI 17 as APG (qty 1). Merged into base 2498 with qty 2.; Multiple descriptions for base part 2498: "SRG DIA 50.830 / 50.860" vs "APG DIA 50.830 / 50.860". Summing qty. |
| **SDC/2627/0056** | 2026-11-12 | FLAMETECH (MADRAS) PVT.LTD | AGIPLPO956-LGB | 2 | 2 NOS | 57 | None |
| **SDC/2627/0057** | 2026-11-12 | ABI ENGINEERINGS | AGIPLPO1356 - SYSMAC | 1 | 1 NOS | 58 | None |
| **SDC/2627/0058** | 2026-11-12 | SIVASAKTHI INDUSTRIES | AGIPLPO1382-LGB | 3 | 5 NOS | 59 | None |
| **SDC/2627/0059** | 2026-11-12 | EXPORT BLAKENING | AGIPLPO1009- SAF | 1 | 1 NOS | 60 | None |

**Grand Totals across 43 DCs:**
- **Total Merged Line Items:** 245
- **Total Dispatched Quantity:** 562 NOS

## 3. Top 5 Largest Delivery Challans

### #1: SDC/2627/0006 (GANESH SAI INDUSTRES)
- **PO:** `AGIPLPO939-PRICOL`
- **Pages:** 7, 8, 9, 10, 11
- **Lines:** 17 merged lines | **Total Qty:** 86 NOS
| Part No | Description | Qty | Raw Line Parts & Qty |
| :--- | :--- | :---: | :--- |
| 2018 | SRG DIA 8.0+0.03 | 2 | SI 1: 2018 (2) |
| 2062 | SRG DIA 9 H7+0.015 | 2 | SI 2: 2062 (2) |
| 2066 | SRG DIA 9 H7+0.015 | 4 | SI 3: 2066-1 (2), SI 4: 2066-2 (2) |
| 2244 | SRG DIA 10.50+0.02/-0.05 | 4 | SI 5: 2244-1 (2), SI 6: 2244-2 (2) |
| 2246 | SRG DIA 10.0+0.050 | 2 | SI 7: 2246 (2) |
| 2386 | SRG DIA 9.68 +/-0.010 | 6 | SI 8: 2386-1 (2), SI 9: 2386-2 (2), SI 10: 2386-3 (2) |
| 2387 | SRG DIA 6.337 +0.013 | 4 | SI 11: 2387-1 (2), SI 12: 2387-2 (2) |
| 2394 | SRG DIA 11.200 / 11.220 | 8 | SI 13: 2394-1 (2), SI 14: 2394-2 (2), SI 15: 2394-3 (2), SI 16: 2394-4 (2) |
| 2395 | SRG DIA 10.580 / 10.560 | 8 | SI 17: 2395-1 (2), SI 18: 2395-2 (2), SI 19: 2395-3 (2), SI 20: 2395-4 (2) |
| 2396 | SRG DIA 10.520 / 10.560 | 8 | SI 21: 2396-1 (2), SI 22: 2396-2 (2), SI 23: 2396-3 (2), SI 24: 2396-4 (2) |
| 2398 | SRG DIA 9.683 / 9.713 | 6 | SI 25: 2398-1 (2), SI 26: 2398-2 (2), SI 27: 2398-3 (2) |
| 2411 | SRG DIA 7.912 +/-0.019 | 6 | SI 28: 2411-1 (2), SI 29: 2411-2 (2), SI 30: 2411-3 (2) |
| 2428 | SRG DIA 9.650 / 9.665 | 6 | SI 31: 2428-1 (2), SI 32: 2428-2 (2), SI 33: 2428-3 (2) |
| 2447 | SRG DIA 12.740 / 12.755 | 6 | SI 34: 2447-1 (2), SI 35: 2447-2 (2), SI 36: 2447-3 (2) |
| 2449 | SRG DIA 9.000 / 9.022 | 6 | SI 37: 2449-1 (2), SI 38: 2449-2 (2), SI 39: 2449-3 (2) |
| 2453 | SRG DIA 9.988 / 10.012 | 6 | SI 40: 2453-1 (2), SI 41: 2453-2 (2), SI 42: 2453-3 (2) |
| 2464 | SRG DIA 12.680 +/-0.02 | 2 | SI 43: 2464 (2) |

### #2: SDC/2627/0015 (GSM ENGINEERS)
- **PO:** `AGIPLPO1226- SEG AUTOMOTIVE`
- **Pages:** 21, 22, 23, 24
- **Lines:** 33 merged lines | **Total Qty:** 74 NOS
| Part No | Description | Qty | Raw Line Parts & Qty |
| :--- | :--- | :---: | :--- |
| 2460 | APG DIA 57.250 +/-0.025 | 1 | SI 1: 2460 (1) |
| 2480 | APG DIA 40.025 +/-0.01 | 1 | SI 2: 2480 (1) |
| 2482 | APG DIA 26.02 +/-0.01 | 1 | SI 3: 2482 (1) |
| 2419 | APG DIA 34.450 / 34.500 | 5 | SI 4: 2419-1 (1), SI 10: 2419-1 (4) |
| 2417 | APG DIA 35.00 / 35.088 | 1 | SI 5: 2417-1 (1) |
| 2479 | APG DIA 47.025 +/-0.01 | 1 | SI 6: 2479 (1) |
| 2481 | APG DIA 52.02 +/-0.01 | 1 | SI 7: 2481 (1) |
| 2418 | APG DIA 35.00 / 35.062 | 3 | SI 8: 2418-1 (3) |
| 2446 | APG DIA 34.00 / 34.025 | 2 | SI 9: 2446-1 (2) |
| 2425 | APG DIA 53.950 / 54.000 | 3 | SI 11: 2425-1 (3) |
| 2431 | APG DIA 54.440 / 54.480 | 3 | SI 12: 2431-1 (3) |
| 2396 | APG DIA 10.520 / 10.560 | 4 | SI 13: 2396-1 (1), SI 30: 2396-1 (3) |
| 2472 | APG DIA 18.963 / 18.976 | 1 | SI 14: 2472 (1) |
| 2513 | APG DIA 20.01 +/-0.02 | 1 | SI 15: 2513 (1) |
| 2495 | APG DIA 15.811 +/0.012 | 1 | SI 16: 2495 (1) |
| 2436 | APG DIA 15.875 / 15.885 | 1 | SI 17: 2436-1 (1) |
| 2519 | APG DIA 15.05±0.03 | 1 | SI 18: 2519 (1) |
| 2441 | APG DIA 15.954 / 15.973 | 1 | SI 19: 2441-1 (1) |
| 2426 | ARG DIA 21.807 / 21.840 | 1 | SI 20: 2426-1 (1) |
| 2400 | APG DIA 15.880 / 15.890 | 3 | SI 21: 2400-1 (3) |
| 2429 | APG DIA 13.500 / 13.540 | 3 | SI 22: 2429-1 (3) |
| 2452 | APG DIA 12.130 / 12.170 | 3 | SI 23: 2452-1 (3) |
| 2416 | APG DIA 13.05 / 13.100 | 3 | SI 24: 2416-1 (3) |
| 2464 | APG DIA 12.680 +/-0.02 | 1 | SI 25: 2464 (1) |
| 2409 | APG DIA 20.000 / 20.052 | 5 | SI 26: 2409-1 (5) |
| 2430 | APG DIA 22.0 +/-0.035 | 3 | SI 27: 2430-1 (3) |
| 2398 | APG DIA 9.683 / 9.713 | 3 | SI 28: 2398-1 (3) |
| 2411 | APG DIA 7.912 +/-0.019 | 3 | SI 29: 2411-1 (3) |
| 2447 | APG DIA 12.740 / 12.755 | 3 | SI 31: 2447-1 (3) |
| 2395 | APG DIA 10.580 / 10.560 | 4 | SI 32: 2395-1 (4) |
| 2394 | APG DIA 11.200 / 11.220 | 5 | SI 33: 2394-1 (5) |
| 2497 | APG DIA 47.008 +/-0.006 | 1 | SI 34: 2497 (1) |
| 2466 | APG DIA 47.00 -0.028 / -0.012 | 1 | SI 35: 2466 (1) |

### #3: SDC/2627/0052 (DURGA METAL FINISHERS)
- **PO:** `AGIPLPO1249- MARKS ENGG`
- **Pages:** 50, 51, 52
- **Lines:** 24 merged lines | **Total Qty:** 67 NOS
| Part No | Description | Qty | Raw Line Parts & Qty |
| :--- | :--- | :---: | :--- |
| 2495 | SRG DIA 15.811 +/0.012 | 1 | SI 1: 2495 (1) |
| 2526 | SRG DIA 19.05 -0.030 | 2 | SI 2: 2526 (2) |
| 2490 | SRG DIA 17.551 / 17.513 | 2 | SI 3: 2490 (2) |
| 2468 | SRG DIA 14.970 | 2 | SI 4: 2468 (2) |
| 2461 | SRG DIA 18.00 +0.027 | 2 | SI 5: 2461 (2) |
| 2470 | SRG DIA 15.010 | 2 | SI 6: 2470 (2) |
| 2524 | SRG DIA 15.875 | 2 | SI 7: 2524 (2) |
| 2473 | SRG DIA 18.963 / 18.976 | 2 | SI 8: 2473 (2) |
| 2527 | SRG DIA 16.0 -0.016 / -0.034 | 2 | SI 9: 2527 (2) |
| 2491 | SRG DIA 16.0 -0.016 / -0.034 | 2 | SI 10: 2491 (2) |
| 2472 | SRG DIA 18.963 / 18.976 | 2 | SI 11: 2472 (2) |
| 2467 | SRG DIA 18.50 +0.021 | 2 | SI 12: 2467 (2) |
| 2440 | SRG DIA 15.000 / 15.018 | 6 | SI 13: 2440 (6) |
| 2441 | SRG DIA 15.954 / 15.973 | 6 | SI 14: 2441 (6) |
| 2436 | SRG DIA 15.875 / 15.885 | 6 | SI 15: 2436 (6) |
| 2404 | SRG DIA 17.014 / 17.057 | 6 | SI 16: 2404 (6) |
| 2400 | SRG DIA 15.880 / 15.890 | 6 | SI 17: 2400 (6) |
| 2519 | SRG DIA 15.05±0.03 | 2 | SI 18: 2519 (2) |
| 2471 | SRG DIA 15.030 | 2 | SI 19: 2471 (2) |
| 2429 | SRG DIA 13.500 / 13.540 | 2 | SI 20: 2429 (2) |
| 2485 | SRG DIA 13.500 +0.018 | 2 | SI 21: 2485 (2) |
| 2137 | SRG DIA 10.0 -0.008 | 2 | SI 22: 2137 (2) |
| 2510 | URGENT - 4 WEEKS SRG DIA 13.500 / 13.530 | 2 | SI 23: 2510 (2) |
| 1891 | SRG DIA 13.6+0.011- DULL CHROME & STICKER SLOT | 2 | SI 25: 1891 (2) |

### #4: SDC/2627/0019 (SKY LINE ENGINEERING)
- **PO:** `AGIPLPO1203 - AUTOTECH`
- **Pages:** 27, 28
- **Lines:** 16 merged lines | **Total Qty:** 52 NOS
| Part No | Description | Qty | Raw Line Parts & Qty |
| :--- | :--- | :---: | :--- |
| 2448 | SRG DIA 34.600 / 34.650 | 4 | SI 1: 2448-1 (4) |
| 2390 | SRG DIA 39.000 / 39.025 | 2 | SI 2: 2390 (2) |
| 2520 | SRG DIA 35.42±0.02 | 2 | SI 3: 2520 (2) |
| 2162 | SRG DIA 34.14-0.03 | 2 | SI 4: 2162 (2) |
| 2161 | SRG DIA 32.08+0.03 | 2 | SI 5: 2161 (2) |
| 2419 | SRG DIA 34.450 / 34.500 | 6 | SI 6: 2419-1 (6) |
| 2417 | SRG DIA 35.000 / 35.088 | 6 | SI 7: 2417-1 (6) |
| 2446 | SRG DIA 34.00 / 34.025 | 6 | SI 8: 2446-1 (6) |
| 2418 | SRG DIA 35.00 / 35.062 | 6 | SI 9: 2418-1 (6) |
| 1992 | SRG DIA 48.0+0.01-0.03 | 2 | SI 10: 1992 (2) |
| 2239 | SRG DIA 41.0-0.043 | 2 | SI 11: 2239-1 (2) |
| 2431 | SRG DIA 54.440 / 54.480 | 2 | SI 12: 2431-1 (2) |
| 2432 | SRG DIA 54.500 / 54.525 | 4 | SI 13: 2432-1 (4) |
| 2132 | SRG DIA 48.00+0.025+0.064 | 2 | SI 14: 2132-1 (2) |
| 2238 | SRG DIA 40.0-0.043 | 2 | SI 15: 2238-1 (2) |
| 2288 | SRG DIA 47 P7-0.017/-0.042 | 2 | SI 16: 2288 (2) |

### #5: SDC/2627/0040 (SKY LINE ENGINEERING)
- **PO:** `BHARAT FORGE- PROJECT 3`
- **Pages:** 41, 42
- **Lines:** 11 merged lines | **Total Qty:** 42 NOS
| Part No | Description | Qty | Raw Line Parts & Qty |
| :--- | :--- | :---: | :--- |
| 2231 | SRG DIA 47.0 -0.025/-0.050-DULL CHROME | 2 | SI 1: 2231 (2) |
| 2516 | SRG DIA 57.4 +0.05 DC PLATED | 2 | SI 2: 2516 (2) |
| 2517 | SRG DIA 25.4+0.033 | 2 | SI 3: 2517 (2) |
| 2518 | SRG DIA 23.81+0.033 | 2 | SI 4: 2518 (2) |
| 2063 | APG DIA 21 M8+0.004/+0.029 | 2 | SI 5: 2063 (2) |
| 2064 | SRG DIA 28.95+0.030 | 2 | SI 6: 2064 (2) |
| 2338 | 23/09/26 SRG 25.8 +0.021 (DC PLATED ) | 2 | SI 7: 2338 (2) |
| 2339 | 23/09/26 SRG 30.5 +0.02 (DC PLATED ) | 6 | SI 8: 2339 (6) |
| 2409 | - SRG DIA 20.000 / 20.052 | 10 | SI 9: 2409 (10) |
| 2422 | SRG DIA 28.00 / 28.018 | 6 | SI 10: 2422 (6) |
| 2430 | SRG DIA 22.0 +/-0.035 | 6 | SI 11: 2430 (6) |

## 4. Special Cases, Struck Lines & Handwritten Marks
1. **SDC/2627/0001 vs SDC/2627/0001-B:** Page 1 has PO `AGIPLPO1210-BHARAT FORGE-PROJECT 2` (Part 2181, 2 NOS). Page 2 has PO `AGIPLPO1248-HL MANDO` with Part 2181 struck through. Both imported: Page 1 as `SDC/2627/0001`, Page 2 as `SDC/2627/0001-B`.
2. **SDC/2627/0004 Duplicate Headers:** Page 4 had RK ENGG (Ambattur) and Page 5 had RK ENGINEERING WORKS (Vanagaram). Imported RK ENGINEERING WORKS per rule.
3. **SDC/2627/0005 Struck Line:** SI 2 (`2242`, 1 NOS) visibly struck through. Excluded from import.
4. **SDC/2627/0008 Handwritten Addition:** Handwritten "+ 2517 APG 1 NO" on Page 14 ignored from import.
5. **SDC/2627/0022 Multi-type Part 2498:** Part 2498 appears as SRG (2 NOS) and APG (1 NOS). Merged to base 2498 with qty 3 NOS.
6. **SDC/2627/0026 Handwritten Correction:** Handwritten text and overwritten qty on Page 33 ignored; printed qty (2 NOS) retained.
7. **SDC/2627/0029 Partial Line Strikethrough:** "SPG DIA 100.0-0.06" portion struck through; ARG description retained.
8. **SDC/2627/0032 & SDC/2627/0050 Duplicate Sheets:** Each appeared twice with identical content; imported exactly once.
9. **SDC/2627/0052 Struck Line:** Page 52 SI 24 (`2440`, 6 NOS) visibly struck through. Excluded (Page 51 SI 13 `2440`, 6 NOS retained).
10. **SDC/2627/0055 Multi-type Part 2498:** Part 2498 appears as SRG (1 NOS) and APG (1 NOS). Merged to base 2498 with qty 2 NOS.
