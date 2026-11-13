const fs = require('fs');
const path = require('path');

// Raw pages data extracted directly from the 60 scanned PDF pages
const pagesData = [
  // Page 1: SDC/2627/0001 (A)
  {
    page: 1,
    dc_number: "SDC/2627/0001",
    date: "2026-11-07",
    vendor: {
      name: "SKY LINE ENGINEERING",
      address: "NO 8, KRISHNAPPA KAICKER STREET, GOPAL NAICKER NAGAR, PADI",
      phone: "9094823533"
    },
    po_no: "AGIPLPO1210-BHARAT FORGE-PROJECT 2",
    process_remark: "FOR CG AND RETURN",
    lines: [
      { si: 1, part: "2181", desc: "SRG DIA 107.0 H8+0.054 - DULL CHROME", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Page 2: SDC/2627/0001-B (B)
  {
    page: 2,
    dc_number: "SDC/2627/0001-B",
    date: "2026-11-07",
    vendor: {
      name: "SKY LINE ENGINEERING",
      address: "NO 8, KRISHNAPPA KAICKER STREET, GOPAL NAICKER NAGAR, PADI",
      phone: "9094823533"
    },
    po_no: "AGIPLPO1248-HL MANDO",
    process_remark: "FOR CG AND RETURN",
    lines: [
      { si: 1, part: "2493", desc: "SRG 82.00 +0.030 / +0.060", qty: 2, unit: "NOS" },
      { si: 2, part: "2181", desc: "SRG DIA 107.0 H8+0.054- DULL CHROME", qty: 2, unit: "NOS", cancelled: true },
      { si: 3, part: "2217", desc: "SRG DIA 85.0 -0.044/-0.066 - DULL CHROME", qty: 2, unit: "NOS" }
    ],
    flags: [
      "Duplicate DC number 0001 with different PO (AGIPLPO1248-HL MANDO). Designated as SDC/2627/0001-B for review.",
      "Line 2 (part 2181, 2 NOS) visibly struck through; excluded from import."
    ]
  },
  // Page 3: SDC/2627/0002
  {
    page: 3,
    dc_number: "SDC/2627/0002",
    date: "2026-11-07",
    vendor: {
      name: "STANDARD ENGINEERING ENTERPRISES",
      address: "NO 5, VELLALAR STREET, OLD AMBATTUR, CHENNAI",
      phone: "7947417523"
    },
    po_no: "AGIPLPO950-UCAL LIMITED",
    process_remark: "FOR HONING AND RETURN",
    lines: [
      { si: 1, part: "2029-1", desc: "SRG DIA 9.5H8+0.022", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Page 5: SDC/2627/0004 (RK ENGINEERING WORKS version per rule; Page 4 RK ENGG version skipped)
  {
    page: 5,
    dc_number: "SDC/2627/0004",
    date: "2026-11-07",
    vendor: {
      name: "RK ENGINEERING WORKS",
      address: "NO 76 BALAMURUGAN KOIL STREET, METTUPAKKAM, VANAGARAM, CHENNAI-600095",
      phone: "9840838199"
    },
    po_no: "AGIPLPO1162 - LGB",
    process_remark: "FOR ID GRINDING AND RETURN",
    lines: [
      { si: 1, part: "2355", desc: "SRG DIA 16.30 +0.02", qty: 2, unit: "NOS" },
      { si: 2, part: "2416-1", desc: "SRG DIA 13.05 / 13.100", qty: 2, unit: "NOS" },
      { si: 3, part: "2416-2", desc: "SRG DIA 13.05 / 13.100", qty: 2, unit: "NOS" },
      { si: 4, part: "2416-3", desc: "SRG DIA 13.05 / 13.100", qty: 2, unit: "NOS" },
      { si: 5, part: "2429-2", desc: "SRG DIA 13.500 / 13.540", qty: 2, unit: "NOS" },
      { si: 6, part: "2429-3", desc: "SRG DIA 13.500 / 13.540", qty: 2, unit: "NOS" },
      { si: 7, part: "2450-1", desc: "SRG 14.930 / 14.940", qty: 2, unit: "NOS" },
      { si: 8, part: "2450-2", desc: "SRG 14.930 / 14.940", qty: 2, unit: "NOS" },
      { si: 9, part: "2492", desc: "SRG DIA 14.975 +/-0.009", qty: 2, unit: "NOS" },
      { si: 10, part: "2496", desc: "SRG 14.211 / 14.236", qty: 2, unit: "NOS" }
    ],
    flags: [
      "DC 0004 appeared twice (Page 4 RK ENGG vs Page 5 RK ENGINEERING WORKS). RK ENGINEERING WORKS version selected per rule."
    ]
  },
  // Page 6: SDC/2627/0005
  {
    page: 6,
    dc_number: "SDC/2627/0005",
    date: "2026-11-07",
    vendor: {
      name: "MICROMAC CNC",
      address: "36A, GANDHI STREET, MATHIYAZHAGAN NAGAR, PADI",
      phone: "9080641141"
    },
    po_no: "AGIPLPO1322 - ABHINAVA RIZEL",
    process_remark: "FOR WIRECUT AND RETURN",
    lines: [
      { si: 1, part: "2486", desc: "SRG DIA 6.0 -0.045 / -0.025", qty: 2, unit: "NOS" },
      { si: 2, part: "2242", desc: "OVAL APG DIA 12.00+0.050/+0.032", qty: 1, unit: "NOS", cancelled: true }
    ],
    flags: [
      "Line 2 (part 2242, 1 NOS) visibly struck through; excluded from import."
    ]
  },
  // Pages 7-11: SDC/2627/0006 (5 pages)
  {
    page: 7,
    dc_number: "SDC/2627/0006",
    date: "2026-11-07",
    vendor: {
      name: "GANESH SAI INDUSTRES",
      address: "NO 12/A, KAMARAJAR 1ST CROSS STREET, SRINIVASA NAGAR, PADI",
      phone: "9789010263"
    },
    po_no: "AGIPLPO939-PRICOL",
    process_remark: "FOR ID GRINDING AND RETURN",
    lines: [
      // Page 7
      { si: 1, part: "2018", desc: "SRG DIA 8.0+0.03", qty: 2, unit: "NOS" },
      { si: 2, part: "2062", desc: "SRG DIA 9 H7+0.015", qty: 2, unit: "NOS" },
      { si: 3, part: "2066-1", desc: "SRG DIA 9 H7+0.015", qty: 2, unit: "NOS" },
      { si: 4, part: "2066-2", desc: "SRG DIA 9 H7+0.015", qty: 2, unit: "NOS" },
      { si: 5, part: "2244-1", desc: "SRG DIA 10.50+0.02/-0.05", qty: 2, unit: "NOS" },
      { si: 6, part: "2244-2", desc: "SRG DIA 10.50+0.02/-0.05", qty: 2, unit: "NOS" },
      { si: 7, part: "2246", desc: "SRG DIA 10.0+0.050", qty: 2, unit: "NOS" },
      { si: 8, part: "2386-1", desc: "SRG DIA 9.68 +/-0.010", qty: 2, unit: "NOS" },
      { si: 9, part: "2386-2", desc: "SRG DIA 9.68 +/-0.010", qty: 2, unit: "NOS" },
      { si: 10, part: "2386-3", desc: "SRG DIA 9.68 +/-0.010", qty: 2, unit: "NOS" },
      // Page 8
      { si: 11, part: "2387-1", desc: "SRG DIA 6.337 +0.013", qty: 2, unit: "NOS" },
      { si: 12, part: "2387-2", desc: "SRG DIA 6.337 +0.013", qty: 2, unit: "NOS" },
      { si: 13, part: "2394-1", desc: "SRG DIA 11.200 / 11.220", qty: 2, unit: "NOS" },
      { si: 14, part: "2394-2", desc: "SRG DIA 11.200 / 11.220", qty: 2, unit: "NOS" },
      { si: 15, part: "2394-3", desc: "SRG DIA 11.200 / 11.220", qty: 2, unit: "NOS" },
      { si: 16, part: "2394-4", desc: "SRG DIA 11.200 / 11.220", qty: 2, unit: "NOS" },
      { si: 17, part: "2395-1", desc: "SRG DIA 10.580 / 10.560", qty: 2, unit: "NOS" },
      { si: 18, part: "2395-2", desc: "SRG DIA 10.580 / 10.560", qty: 2, unit: "NOS" },
      { si: 19, part: "2395-3", desc: "SRG DIA 10.580 / 10.560", qty: 2, unit: "NOS" },
      { si: 20, part: "2395-4", desc: "SRG DIA 10.580 / 10.560", qty: 2, unit: "NOS" },
      // Page 9
      { si: 21, part: "2396-1", desc: "SRG DIA 10.520 / 10.560", qty: 2, unit: "NOS" },
      { si: 22, part: "2396-2", desc: "SRG DIA 10.520 / 10.560", qty: 2, unit: "NOS" },
      { si: 23, part: "2396-3", desc: "SRG DIA 10.520 / 10.560", qty: 2, unit: "NOS" },
      { si: 24, part: "2396-4", desc: "SRG DIA 10.520 / 10.560", qty: 2, unit: "NOS" },
      { si: 25, part: "2398-1", desc: "SRG DIA 9.683 / 9.713", qty: 2, unit: "NOS" },
      { si: 26, part: "2398-2", desc: "SRG DIA 9.683 / 9.713", qty: 2, unit: "NOS" },
      { si: 27, part: "2398-3", desc: "SRG DIA 9.683 / 9.713", qty: 2, unit: "NOS" },
      { si: 28, part: "2411-1", desc: "SRG DIA 7.912 +/-0.019", qty: 2, unit: "NOS" },
      { si: 29, part: "2411-2", desc: "SRG DIA 7.912 +/-0.019", qty: 2, unit: "NOS" },
      { si: 30, part: "2411-3", desc: "SRG DIA 7.912 +/-0.019", qty: 2, unit: "NOS" },
      // Page 10
      { si: 31, part: "2428-1", desc: "SRG DIA 9.650 / 9.665", qty: 2, unit: "NOS" },
      { si: 32, part: "2428-2", desc: "SRG DIA 9.650 / 9.665", qty: 2, unit: "NOS" },
      { si: 33, part: "2428-3", desc: "SRG DIA 9.650 / 9.665", qty: 2, unit: "NOS" },
      { si: 34, part: "2447-1", desc: "SRG DIA 12.740 / 12.755", qty: 2, unit: "NOS" },
      { si: 35, part: "2447-2", desc: "SRG DIA 12.740 / 12.755", qty: 2, unit: "NOS" },
      { si: 36, part: "2447-3", desc: "SRG DIA 12.740 / 12.755", qty: 2, unit: "NOS" },
      { si: 37, part: "2449-1", desc: "SRG DIA 9.000 / 9.022", qty: 2, unit: "NOS" },
      { si: 38, part: "2449-2", desc: "SRG DIA 9.000 / 9.022", qty: 2, unit: "NOS" },
      { si: 39, part: "2449-3", desc: "SRG DIA 9.000 / 9.022", qty: 2, unit: "NOS" },
      { si: 40, part: "2453-1", desc: "SRG DIA 9.988 / 10.012", qty: 2, unit: "NOS" },
      // Page 11
      { si: 41, part: "2453-2", desc: "SRG DIA 9.988 / 10.012", qty: 2, unit: "NOS" },
      { si: 42, part: "2453-3", desc: "SRG DIA 9.988 / 10.012", qty: 2, unit: "NOS" },
      { si: 43, part: "2464", desc: "SRG DIA 12.680 +/-0.02", qty: 2, unit: "NOS" }
    ],
    source_pages: [7, 8, 9, 10, 11],
    flags: []
  },
  // Page 12: SDC/2627/0007
  {
    page: 12,
    dc_number: "SDC/2627/0007",
    date: "2026-11-07",
    vendor: {
      name: "NVCNC",
      address: "H-06, INDUSTRIAL ESTATE, AMBATTUR, CHENNAI",
      phone: "9840092294"
    },
    po_no: "AGIPLPO1097 - SFC SOLUTIONS",
    process_remark: "FOR SUPER DRILL AND RETURN",
    lines: [
      { si: 1, part: "2286", desc: "ARG DIA 32.5 -0.09/-0.18", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Pages 13-14: SDC/2627/0008 (2 pages)
  {
    page: 13,
    dc_number: "SDC/2627/0008",
    date: "2026-11-07",
    vendor: {
      name: "FLAME TECH / HTV",
      address: "H-06, INDUSTRIAL ESTATE, AMBATTUR, CHENNAI",
      phone: "9840092294"
    },
    po_no: "AGIPLPO721-ABI SHOWATECH",
    process_remark: "FOR HT AND RETURN",
    lines: [
      // Page 13
      { si: 1, part: "1921-2", desc: "APG DIA 36.000/36.016 48 - 50 HRC", qty: 1, unit: "NOS" },
      { si: 2, part: "2130-1", desc: "ARG DIA 29.980+/-0.018 48 - 50 HRC", qty: 1, unit: "NOS" },
      { si: 3, part: "2130-2", desc: "ARG DIA 29.980+/-0.018 48 - 50 HRC", qty: 1, unit: "NOS" },
      { si: 4, part: "2256", desc: "APG DIA 38.1+/-0.035", qty: 1, unit: "NOS" },
      { si: 5, part: "2323-1", desc: "APG DIA 69.929 +/-0.018", qty: 1, unit: "NOS" },
      { si: 6, part: "2324-1", desc: "APG DIA 49.70 +0.02", qty: 1, unit: "NOS" },
      { si: 7, part: "2326-1", desc: "APG DIA 26.50 +0.03", qty: 1, unit: "NOS" },
      { si: 8, part: "2327-1", desc: "SRG DIA 26.30 +0.02", qty: 1, unit: "NOS" },
      { si: 9, part: "2323-2", desc: "APG DIA 69.929 +/-0.018", qty: 1, unit: "NOS" },
      { si: 10, part: "2324-2", desc: "APG DIA 49.70 +0.02", qty: 1, unit: "NOS" },
      // Page 14
      { si: 11, part: "2326-2", desc: "APG DIA 26.50 +0.03", qty: 1, unit: "NOS" },
      { si: 12, part: "2318", desc: "APG DIA 49.6 +/-0.015-", qty: 1, unit: "NOS" },
      { si: 13, part: "2503-1", desc: "SRG DIA 31.731 +/-0.009", qty: 1, unit: "NOS" },
      { si: 14, part: "2507", desc: "SRG DIA 38.00 +0.05 / +0.07", qty: 1, unit: "NOS" },
      { si: 15, part: "2509", desc: "SRG DIA 38.016 +0.01", qty: 1, unit: "NOS" }
    ],
    source_pages: [13, 14],
    flags: [
      "Page 14 has handwritten addition '2517 APG 1 NO'; not imported per rule."
    ]
  },
  // Page 15: SDC/2627/0009
  {
    page: 15,
    dc_number: "SDC/2627/0009",
    date: "2026-11-07",
    vendor: {
      name: "RKV METAL",
      address: "H-06, INDUSTRIAL ESTATE, AMBATTUR, CHENNAI",
      phone: "9840092294"
    },
    po_no: "AGIPLPO722-GREENTECH",
    process_remark: "FOR DULL CHROME AND RETURN",
    lines: [
      { si: 1, part: "1893", desc: "SRG DIA 12.16 +/- 0.004", qty: 2, unit: "NOS" },
      { si: 2, part: "1892", desc: "SRG DIA 13.885+/-0.005- DULL CHROME & STICKER SLOT", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Page 16: SDC/2627/0010
  {
    page: 16,
    dc_number: "SDC/2627/0010",
    date: "2026-11-07",
    vendor: {
      name: "FINISHWEL HONING WORKS",
      address: "NO: 51 ARUNAGIRINATHAR STREET, T.M.P NAGAR, PADI",
      phone: "8015816085"
    },
    po_no: "AGIPLPO941-SCL ORG",
    process_remark: "FOR HONING AND RETURN",
    lines: [
      { si: 1, part: "2019", desc: "SRG DIA 11.009+/0.010-DULL CHROME & STICKER SLOT", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Page 17: SDC/2627/0011
  {
    page: 17,
    dc_number: "SDC/2627/0011",
    date: "2026-11-07",
    vendor: {
      name: "EXPORT BLAKENING",
      address: "22, P K M ROAD, AMBATTUR INDUSTRIAL ESTATE, ATHIPET, CHENNAI - 600058",
      phone: "9382135966"
    },
    po_no: "AGIPLPO 667 - HYUNDAI WIA",
    process_remark: "BLACKENING AND RETURN",
    lines: [
      { si: 1, part: "1853-1", desc: "ACG DIA 35.0 +/- 0.035", qty: 1, unit: "NOS" },
      { si: 2, part: "1851", desc: "ACG DIA 33.6-0.025/-0.050", qty: 1, unit: "NOS" },
      { si: 3, part: "1857", desc: "ACG DIA 45.0 -0.025", qty: 1, unit: "NOS" },
      { si: 4, part: "1856-1", desc: "ACG DIA 41.0 +/- 0.035", qty: 1, unit: "NOS" },
      { si: 5, part: "1854", desc: "ACG DIA 35.0-0.050", qty: 1, unit: "NOS" },
      { si: 6, part: "1852", desc: "ACG DIA 34.5 +/- 0.035", qty: 1, unit: "NOS" },
      { si: 7, part: "1847-6", desc: "ACG DIA 32.2 -0.025/-0.050", qty: 1, unit: "NOS" },
      { si: 8, part: "1844-7", desc: "ACG DIA 29.2 -0.025/-0.050", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Page 18: SDC/2627/0012
  {
    page: 18,
    dc_number: "SDC/2627/0012",
    date: "2026-11-07",
    vendor: {
      name: "SKY LINE ENGINEERING",
      address: "NO 8, KRISHNAPPA KAICKER STREET, GOPAL NAICKER NAGAR, PADI",
      phone: "9094823533"
    },
    po_no: "AGIPLPO1047-KARTHIKA PRECISION",
    process_remark: "FOR CG AND RETURN",
    lines: [
      { si: 1, part: "2159", desc: "SRG DIA 49.74/49.82", qty: 2, unit: "NOS" },
      { si: 2, part: "2494", desc: "SRG DIA 97.00 +0.05", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Page 19: SDC/2627/0013
  {
    page: 19,
    dc_number: "SDC/2627/0013",
    date: "2026-11-10",
    vendor: {
      name: "MICROMAC CNC",
      address: "36A, GANDHI STREET, MATHIYAZHAGAN NAGAR, PADI",
      phone: "9080641141"
    },
    po_no: "AGIPLPO751-SRINIVASA",
    process_remark: "FOR WIRECUT AND RETURN",
    lines: [
      { si: 1, part: "1907", desc: "ARG DIA 12.209/12.196- 3 JET & SPG DIA 12.209/12.196", qty: 1, unit: "NOS" },
      { si: 2, part: "1965-2", desc: "ARG DIA 32.960+/- 0.03 & SPG DIA 32.960+/-0.03", qty: 1, unit: "NOS" },
      { si: 3, part: "2053", desc: "ARG DIA 14.335/14.328 & SPG DIA 14.335/14.328", qty: 1, unit: "NOS" },
      { si: 4, part: "1813-1", desc: "ARG DIA 10 -0.013-0.022 & SPG DIA 10 -0.013-0.022 DO AS PER DRAWING", qty: 1, unit: "NOS" },
      { si: 5, part: "1926-2", desc: "ARG DIA 22.041/22.062 & SPG DIA 22.041/22.062 DO AS PER DRAWING", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Page 20: SDC/2627/0014
  {
    page: 20,
    dc_number: "SDC/2627/0014",
    date: "2026-11-10",
    vendor: {
      name: "RK ENGINEERING WORKS",
      address: "NO 76 BALAMURUGAN KOIL STREET, METTUPAKKAM, VANAGARAM, CHENNAI-600095",
      phone: "9840838199"
    },
    po_no: "BHARAT FORGE - PROJECT 1",
    process_remark: "FOR WEIGHT REDUCTION AND RETURN",
    lines: [
      { si: 1, part: "2218", desc: "APG DIA 77.5-0.030/-0.049 FOR WEIGHT REDUCTION AND RETURN", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Pages 21-24: SDC/2627/0015 (4 pages)
  {
    page: 21,
    dc_number: "SDC/2627/0015",
    date: "2026-11-10",
    vendor: {
      name: "GSM ENGINEERS",
      address: "NO11/22A, BHARATHIYAR STREET, PADI, CHENNAI-600050",
      phone: "7904277413"
    },
    po_no: "AGIPLPO1226- SEG AUTOMOTIVE",
    process_remark: "FOR JUST CLEAN AND RETURN",
    lines: [
      // Page 21
      { si: 1, part: "2460", desc: "APG DIA 57.250 +/-0.025", qty: 1, unit: "NOS" },
      { si: 2, part: "2480", desc: "APG DIA 40.025 +/-0.01", qty: 1, unit: "NOS" },
      { si: 3, part: "2482", desc: "APG DIA 26.02 +/-0.01", qty: 1, unit: "NOS" },
      { si: 4, part: "2419-1", desc: "APG DIA 34.450 / 34.500", qty: 1, unit: "NOS" },
      { si: 5, part: "2417-1", desc: "APG DIA 35.00 / 35.088", qty: 1, unit: "NOS" },
      { si: 6, part: "2479", desc: "APG DIA 47.025 +/-0.01", qty: 1, unit: "NOS" },
      { si: 7, part: "2481", desc: "APG DIA 52.02 +/-0.01", qty: 1, unit: "NOS" },
      { si: 8, part: "2418-1", desc: "APG DIA 35.00 / 35.062", qty: 3, unit: "NOS" },
      { si: 9, part: "2446-1", desc: "APG DIA 34.00 / 34.025", qty: 2, unit: "NOS" },
      { si: 10, part: "2419-1", desc: "APG DIA 34.450 / 34.500", qty: 4, unit: "NOS" },
      // Page 22
      { si: 11, part: "2425-1", desc: "APG DIA 53.950 / 54.000", qty: 3, unit: "NOS" },
      { si: 12, part: "2431-1", desc: "APG DIA 54.440 / 54.480", qty: 3, unit: "NOS" },
      { si: 13, part: "2396-1", desc: "APG DIA 10.520 / 10.560", qty: 1, unit: "NOS" },
      { si: 14, part: "2472", desc: "APG DIA 18.963 / 18.976", qty: 1, unit: "NOS" },
      { si: 15, part: "2513", desc: "APG DIA 20.01 +/-0.02", qty: 1, unit: "NOS" },
      { si: 16, part: "2495", desc: "APG DIA 15.811 +/0.012", qty: 1, unit: "NOS" },
      { si: 17, part: "2436-1", desc: "APG DIA 15.875 / 15.885", qty: 1, unit: "NOS" },
      { si: 18, part: "2519", desc: "APG DIA 15.05±0.03", qty: 1, unit: "NOS" },
      { si: 19, part: "2441-1", desc: "APG DIA 15.954 / 15.973", qty: 1, unit: "NOS" },
      { si: 20, part: "2426-1", desc: "ARG DIA 21.807 / 21.840", qty: 1, unit: "NOS" },
      // Page 23
      { si: 21, part: "2400-1", desc: "APG DIA 15.880 / 15.890", qty: 3, unit: "NOS" },
      { si: 22, part: "2429-1", desc: "APG DIA 13.500 / 13.540", qty: 3, unit: "NOS" },
      { si: 23, part: "2452-1", desc: "APG DIA 12.130 / 12.170", qty: 3, unit: "NOS" },
      { si: 24, part: "2416-1", desc: "APG DIA 13.05 / 13.100", qty: 3, unit: "NOS" },
      { si: 25, part: "2464", desc: "APG DIA 12.680 +/-0.02", qty: 1, unit: "NOS" },
      { si: 26, part: "2409-1", desc: "APG DIA 20.000 / 20.052", qty: 5, unit: "NOS" },
      { si: 27, part: "2430-1", desc: "APG DIA 22.0 +/-0.035", qty: 3, unit: "NOS" },
      { si: 28, part: "2398-1", desc: "APG DIA 9.683 / 9.713", qty: 3, unit: "NOS" },
      { si: 29, part: "2411-1", desc: "APG DIA 7.912 +/-0.019", qty: 3, unit: "NOS" },
      { si: 30, part: "2396-1", desc: "APG DIA 10.520 / 10.560", qty: 3, unit: "NOS" },
      // Page 24
      { si: 31, part: "2447-1", desc: "APG DIA 12.740 / 12.755", qty: 3, unit: "NOS" },
      { si: 32, part: "2395-1", desc: "APG DIA 10.580 / 10.560", qty: 4, unit: "NOS" },
      { si: 33, part: "2394-1", desc: "APG DIA 11.200 / 11.220", qty: 5, unit: "NOS" },
      { si: 34, part: "2497", desc: "APG DIA 47.008 +/-0.006", qty: 1, unit: "NOS" },
      { si: 35, part: "2466", desc: "APG DIA 47.00 -0.028 / -0.012", qty: 1, unit: "NOS" }
    ],
    source_pages: [21, 22, 23, 24],
    flags: []
  },
  // Page 25: SDC/2627/0016
  {
    page: 25,
    dc_number: "SDC/2627/0016",
    date: "2026-11-10",
    vendor: {
      name: "V.S. ENGINEERING",
      address: "289/8 MUSTAFA STREET RAJARAJAN NAGAR VANAGARAM CHENNAI-600095",
      phone: "9444826790"
    },
    po_no: "AGIPLPO977-TUBE INVESTMENTS",
    process_remark: "FOR BRAZZING AND RETURN",
    lines: [
      { si: 1, part: "2158", desc: "APG DIA 20.50+/-0.03-CARBIDE", qty: 1, unit: "NOS" },
      { si: 2, part: "2157", desc: "APG DIA 17.40+/-0.03-CARBIDE", qty: 1, unit: "NOS" },
      { si: 3, part: "2156", desc: "APG DIA 22.17+/-0.03-CARBIDE", qty: 1, unit: "NOS" },
      { si: 4, part: "2155", desc: "APG DIA 20.26+/-0.03-CARBIDE", qty: 1, unit: "NOS" },
      { si: 5, part: "2154", desc: "APG DIA 18.67+/-0.03-CARBIDE", qty: 1, unit: "NOS" },
      { si: 6, part: "1921-2", desc: "APG DIA 36.000/36.016", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Page 26: SDC/2627/0017
  {
    page: 26,
    dc_number: "SDC/2627/0017",
    date: "2026-11-10",
    vendor: {
      name: "GANESH SAI INDUSTRES",
      address: "NO 12/A KAMARAJAR 1ST CROSS STREET SRINIVASA NAGAR PADI",
      phone: "9789010263"
    },
    po_no: "AGIPLPO1319 - MAGNA",
    process_remark: "FOR ID GRINDING AND RETURN",
    lines: [
      { si: 1, part: "2483-1", desc: "SRG DIA 8.026 +/-0.012", qty: 4, unit: "NOS" },
      { si: 2, part: "2452-1", desc: "SRG DIA 12.130 / 12.170", qty: 6, unit: "NOS" },
      { si: 3, part: "2451-1", desc: "SRG DIA 8.060 / 8.096", qty: 4, unit: "NOS" },
      { si: 4, part: "2395-1", desc: "SRG DIA 10.580 / 10.560", qty: 2, unit: "NOS" },
      { si: 5, part: "2364", desc: "SRG DIA 9.3 +/-0.013", qty: 2, unit: "NOS" },
      { si: 6, part: "2061", desc: "SRG DIA 8 H7+0.015", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Pages 27-28: SDC/2627/0019 (2 pages)
  {
    page: 27,
    dc_number: "SDC/2627/0019",
    date: "2026-11-10",
    vendor: {
      name: "SKY LINE ENGINEERING",
      address: "NO 8 KRISHNAPPA KAICKER STREET GOPAL NAICKER NAGAR PADI",
      phone: "9094823533"
    },
    po_no: "AGIPLPO1203 - AUTOTECH",
    process_remark: "FOR CG AND RETURN",
    lines: [
      // Page 27
      { si: 1, part: "2448-1", desc: "SRG DIA 34.600 / 34.650", qty: 4, unit: "NOS" },
      { si: 2, part: "2390", desc: "SRG DIA 39.000 / 39.025", qty: 2, unit: "NOS" },
      { si: 3, part: "2520", desc: "SRG DIA 35.42±0.02", qty: 2, unit: "NOS" },
      { si: 4, part: "2162", desc: "SRG DIA 34.14-0.03", qty: 2, unit: "NOS" },
      { si: 5, part: "2161", desc: "SRG DIA 32.08+0.03", qty: 2, unit: "NOS" },
      { si: 6, part: "2419-1", desc: "SRG DIA 34.450 / 34.500", qty: 6, unit: "NOS" },
      { si: 7, part: "2417-1", desc: "SRG DIA 35.000 / 35.088", qty: 6, unit: "NOS" },
      { si: 8, part: "2446-1", desc: "SRG DIA 34.00 / 34.025", qty: 6, unit: "NOS" },
      { si: 9, part: "2418-1", desc: "SRG DIA 35.00 / 35.062", qty: 6, unit: "NOS" },
      { si: 10, part: "1992", desc: "SRG DIA 48.0+0.01-0.03", qty: 2, unit: "NOS" },
      // Page 28
      { si: 11, part: "2239-1", desc: "SRG DIA 41.0-0.043", qty: 2, unit: "NOS" },
      { si: 12, part: "2431-1", desc: "SRG DIA 54.440 / 54.480", qty: 2, unit: "NOS" },
      { si: 13, part: "2432-1", desc: "SRG DIA 54.500 / 54.525", qty: 4, unit: "NOS" },
      { si: 14, part: "2132-1", desc: "SRG DIA 48.00+0.025+0.064", qty: 2, unit: "NOS" },
      { si: 15, part: "2238-1", desc: "SRG DIA 40.0-0.043", qty: 2, unit: "NOS" },
      { si: 16, part: "2288", desc: "SRG DIA 47 P7-0.017/-0.042", qty: 2, unit: "NOS" }
    ],
    source_pages: [27, 28],
    flags: []
  },
  // Page 29: SDC/2627/0020
  {
    page: 29,
    dc_number: "SDC/2627/0020",
    date: "2026-11-10",
    vendor: {
      name: "NV CNC TEHNOLGIES",
      address: "NO 18 NO 3RD FLOOR GOND VASA NAGAR SRINIVAS KAMARAJ STREET PADI",
      phone: "098407 74313"
    },
    po_no: "AGIPLPO926-INDOMIM",
    process_remark: "FOR SUPER DRILL AND RETURN",
    lines: [
      { si: 1, part: "2024", desc: "APG DIA 2.026+/-0.008", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Page 30: SDC/2627/0021
  {
    page: 30,
    dc_number: "SDC/2627/0021",
    date: "2026-11-10",
    vendor: {
      name: "R.K.V METAL FINISHERS",
      address: "NO:84/2 SIDCO INDUSTRIAL ESTATE NEAR AVAVIN",
      phone: "9941294839"
    },
    po_no: "AGIPLPO1274/SCL- 20 DAYS DEL",
    process_remark: "FOR DULL CHROME AND RETURN",
    lines: [
      { si: 1, part: "2515", desc: "SRG DIA 52.0 +0.039 -DC PLATED", qty: 2, unit: "NOS" },
      { si: 2, part: "2320", desc: "SRG DIA 16.056 +/-0.014-DULLCHROME", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Pages 31-32: SDC/2627/0022 (2 pages)
  {
    page: 31,
    dc_number: "SDC/2627/0022",
    date: "2026-11-10",
    vendor: {
      name: "FLAMETECH (MADRAS) PVT.LTD",
      address: "H-06 INDUSTRIAL ESTATE AMBATTUR CHENNAI",
      phone: "9840092294"
    },
    po_no: "AGIPLPO1231",
    process_remark: "FOR HT AND RETURN",
    lines: [
      // Page 31
      { si: 1, part: "2469-1", desc: "SRG DIA 14.990", qty: 2, unit: "NOS" },
      { si: 2, part: "2498", desc: "SRG DIA 50.830 / 50.860", qty: 2, unit: "NOS" },
      { si: 3, part: "2391-1", desc: "APG DIA 16.016 / 16.034", qty: 4, unit: "NOS" },
      { si: 4, part: "2364", desc: "APG DIA 9.3 +/-0.013", qty: 1, unit: "NOS" },
      { si: 5, part: "2386-1", desc: "APG DIA 9.680 +/-0.010", qty: 3, unit: "NOS" },
      { si: 6, part: "2355", desc: "APG DIA 16.30 +0.02", qty: 1, unit: "NOS" },
      { si: 7, part: "2359", desc: "APG DIA 18.795 -0.01", qty: 1, unit: "NOS" },
      { si: 8, part: "2389", desc: "APG DIA 29.900 / 29.920", qty: 1, unit: "NOS" },
      { si: 9, part: "2358", desc: "APG DIA 18.6 +0.02", qty: 1, unit: "NOS" },
      { si: 10, part: "2347", desc: "APG DIA 15.0 +/-0.02", qty: 1, unit: "NOS" },
      // Page 32
      { si: 11, part: "2346", desc: "APG DIA 47.625 +0.013 / -0.015", qty: 1, unit: "NOS" },
      { si: 12, part: "2319", desc: "APG DIA 30.38 +/-0.035-", qty: 1, unit: "NOS" },
      { si: 13, part: "2305", desc: "APG DIA 26.0 +0.021", qty: 1, unit: "NOS" },
      { si: 14, part: "2320", desc: "APG DIA 16.056 +/-0.014-", qty: 1, unit: "NOS" },
      { si: 15, part: "2498", desc: "APG DIA 50.830 / 50.860", qty: 1, unit: "NOS" },
      { si: 16, part: "2432-1", desc: "APG DIA 54.500 / 54.525", qty: 2, unit: "NOS" },
      { si: 17, part: "2327-1", desc: "APG DIA 26.30 +0.02", qty: 2, unit: "NOS" }
    ],
    source_pages: [31, 32],
    flags: [
      "Part 2498 appears twice: SI 2 as SRG (qty 2) and SI 15 as APG (qty 1). Merged into base 2498 with qty 3."
    ]
  },
  // Page 33: SDC/2627/0026
  {
    page: 33,
    dc_number: "SDC/2627/0026",
    date: "2026-11-10",
    vendor: {
      name: "SKY LINE ENGINEERING",
      address: "NO 8 KRISHNAPPA KAICKER STREET GOPAL NAICKER NAGAR PADI",
      phone: "9094823533"
    },
    po_no: "AGIPLPO1178NIROTECH",
    process_remark: "FOR CG AND RETURN",
    lines: [
      { si: 1, part: "2192", desc: "SRG DIA 108.0 +0.05", qty: 2, unit: "NOS" }
    ],
    flags: [
      "Page 33 has handwritten notation '2192 - 108 +/-0.001 -> 1 NO' and overwritten qty. Printed qty (2 NOS) and printed description retained per rule."
    ]
  },
  // Page 34: SDC/2627/0027
  {
    page: 34,
    dc_number: "SDC/2627/0027",
    date: "2026-11-10",
    vendor: {
      name: "NV CNC TEHNOLGIES",
      address: "NO 18 NO 3RD FLOOR GOND VASA NAGAR SRINIVAS KAMARAJ STREET PADI",
      phone: "098407 74313"
    },
    po_no: "AGIPLPO949- MM FORGINGS",
    process_remark: "FOR SUPERDRILL AND RETURN",
    lines: [
      { si: 1, part: "2031-2", desc: "APG DIA 58.505/58.475", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Page 35: SDC/2627/0028
  {
    page: 35,
    dc_number: "SDC/2627/0028",
    date: "2026-11-10",
    vendor: {
      name: "RK ENGINEERING WORKS",
      address: "NO 76 BALAMURUGAN KOIL STREET METTUPAKKAM VANAGARAM CHENNAI-600095",
      phone: "9840838199"
    },
    po_no: "AGIPLPO1031-RAMIND COLD",
    process_remark: "FOR JUST CLEAN AND RETURN",
    lines: [
      { si: 1, part: "2213-2", desc: "APG DIA 5.500/5.508", qty: 3, unit: "NOS" },
      { si: 2, part: "2209-2", desc: "APG DIA 62.0 +0.046", qty: 2, unit: "NOS" },
      { si: 3, part: "2208-2", desc: "APG DIA 77.0+0.03/+0.076", qty: 2, unit: "NOS" },
      { si: 4, part: "2212-2", desc: "APG DIA 19.400/19.418", qty: 3, unit: "NOS" },
      { si: 5, part: "2211-3", desc: "APG DIA 19.001/19.021", qty: 3, unit: "NOS" }
    ],
    flags: []
  },
  // Page 36: SDC/2627/0029
  {
    page: 36,
    dc_number: "SDC/2627/0029",
    date: "2026-11-10",
    vendor: {
      name: "ABI ENGINEERINGS",
      address: "NO 11 THIRUVALLUR 2ND CROSS STREET TMP NAGAR PADI",
      phone: "8248680052"
    },
    po_no: "AGIPLPO956-LGB",
    process_remark: "DO AS PER DRAWING & RETURN",
    lines: [
      { si: 1, part: "2087", desc: "ARG DIA 100.0-0.06 TURNING AS PER DRAWING & RETURN", qty: 1, unit: "NOS" }
    ],
    flags: [
      "In line 1, 'SPG DIA 100.0-0.06' portion is visibly struck through; ARG description kept per rule."
    ]
  },
  // Page 37: SDC/2627/0030
  {
    page: 37,
    dc_number: "SDC/2627/0030",
    date: "2026-11-11",
    vendor: {
      name: "SABARI SPARK",
      address: "NO 110 VANNIYAR STREET PADI CHENNAI-600050",
      phone: "9551280002"
    },
    po_no: "AGIPLPO998-LGB",
    process_remark: "FOR SPARKING AND RETURN",
    lines: [
      { si: 1, part: "2226", desc: "APG DIA 28.0-0.011/-0.024 FOR SPARKING AND RETURN", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Pages 38-39: SDC/2627/0032 (Import once per duplicate rule)
  {
    page: 38,
    dc_number: "SDC/2627/0032",
    date: "2026-11-11",
    vendor: {
      name: "FINISHWEL HONING WORKS",
      address: "NO: 51 ARUNAGIRINATHAR STREET T.M.P NAGAR PADI",
      phone: "8015816085"
    },
    po_no: "AGIPLPO1221 - GNUTTI",
    process_remark: "FOR HONING AND RETURN",
    lines: [
      { si: 1, part: "2391", desc: "SRG DIA 16.016 / 16.034 ( DC PLATED) FOR HONING AND RETURN", qty: 8, unit: "NOS" },
      { si: 2, part: "1893", desc: "SRG DIA 12.16 +/- 0.004", qty: 2, unit: "NOS" },
      { si: 3, part: "1892", desc: "SRG DIA 13.885+/-0.005- DULL CHROME & STICKER SLOT", qty: 2, unit: "NOS" }
    ],
    source_pages: [38, 39],
    flags: [
      "DC 0032 appears identically on Pages 38 and 39; imported once per rule."
    ]
  },
  // Page 40: SDC/2627/0034
  {
    page: 40,
    dc_number: "SDC/2627/0034",
    date: "2026-11-11",
    vendor: {
      name: "R.K.V METAL FINISHERS",
      address: "NO:84/2 SIDCO INDUSTRIAL ESTATE NEAR AVAVIN",
      phone: "9941294839"
    },
    po_no: "BHARAT FORGE - PROJECT 1",
    process_remark: "FOR DULL CHORME AND RETURN",
    lines: [
      { si: 1, part: "2222", desc: "SRG DIA 14.0+0.05-DULL CHROME KD-40, THICKNESS-12.5", qty: 2, unit: "NOS" },
      { si: 2, part: "2221", desc: "SRG DIA 14.0+0.027-DULL CHROME KD-40, THICKNESS-12.5", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Pages 41-42: SDC/2627/0040 (2 pages)
  {
    page: 41,
    dc_number: "SDC/2627/0040",
    date: "2026-11-11",
    vendor: {
      name: "SKY LINE ENGINEERING",
      address: "NO 8 KRISHNAPPA KAICKER STREET GOPAL NAICKER NAGAR PADI",
      phone: "9094823533"
    },
    po_no: "BHARAT FORGE- PROJECT 3",
    process_remark: "FOR CG AND RETURN",
    lines: [
      // Page 41
      { si: 1, part: "2231", desc: "SRG DIA 47.0 -0.025/-0.050-DULL CHROME", qty: 2, unit: "NOS" },
      { si: 2, part: "2516", desc: "SRG DIA 57.4 +0.05 DC PLATED", qty: 2, unit: "NOS" },
      { si: 3, part: "2517", desc: "SRG DIA 25.4+0.033", qty: 2, unit: "NOS" },
      { si: 4, part: "2518", desc: "SRG DIA 23.81+0.033", qty: 2, unit: "NOS" },
      { si: 5, part: "2063", desc: "APG DIA 21 M8+0.004/+0.029", qty: 2, unit: "NOS" },
      { si: 6, part: "2064", desc: "SRG DIA 28.95+0.030", qty: 2, unit: "NOS" },
      { si: 7, part: "2338", desc: "23/09/26 SRG 25.8 +0.021 (DC PLATED )", qty: 2, unit: "NOS" },
      { si: 8, part: "2339", desc: "23/09/26 SRG 30.5 +0.02 (DC PLATED )", qty: 6, unit: "NOS" },
      { si: 9, part: "2409", desc: "- SRG DIA 20.000 / 20.052", qty: 10, unit: "NOS" },
      { si: 10, part: "2422", desc: "SRG DIA 28.00 / 28.018", qty: 6, unit: "NOS" },
      // Page 42
      { si: 11, part: "2430", desc: "SRG DIA 22.0 +/-0.035", qty: 6, unit: "NOS" }
    ],
    source_pages: [41, 42],
    flags: []
  },
  // Page 43: SDC/2627/0045
  {
    page: 43,
    dc_number: "SDC/2627/0045",
    date: "2026-11-11",
    vendor: {
      name: "PS CORPORATION",
      address: "87-92 KRISHNA INDUSTRIAL ESTATE PORUR GARDENS PHASE 2",
      phone: "9841074082"
    },
    po_no: "AGIPLPO956-LGB",
    process_remark: "FOR POWDER COATING AND RETURN",
    lines: [
      { si: 1, part: "2087", desc: "ARG DIA 100.0-0.06", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Page 44: SDC/2627/0046
  {
    page: 44,
    dc_number: "SDC/2627/0046",
    date: "2026-11-11",
    vendor: {
      name: "EXPORT BLAKENING",
      address: "22 P K M ROAD AMBATTUR INDUSTRIAL ESTATE ATHIPET CHENNAI-600058",
      phone: "9382135966"
    },
    po_no: "AGIPLPO1326 - SUPER AUTO",
    process_remark: "FOR BLACKING AND RETURN",
    lines: [
      { si: 1, part: "2532", desc: "MS 75X50X 15 HORIZONTAL BENCH", qty: 1, unit: "NOS" },
      { si: 2, part: "2533", desc: "MS 75X50X 15 HORIZONTAL BENCH", qty: 1, unit: "NOS" },
      { si: 3, part: "2509", desc: "SRG DIA 38.016 +0.01", qty: 1, unit: "NOS" },
      { si: 4, part: "2507", desc: "SRG DIA 38.00 +0.05 / +0.07", qty: 1, unit: "NOS" },
      { si: 5, part: "2327", desc: "SRG DIA 26.30 +0.02", qty: 1, unit: "NOS" },
      { si: 6, part: "2318", desc: "APG DIA 49.6 +/-0.015-", qty: 1, unit: "NOS" },
      { si: 7, part: "2326", desc: "APG DIA 26.50 +0.03", qty: 2, unit: "NOS" },
      { si: 8, part: "2324", desc: "APG DIA 49.70 +0.02", qty: 2, unit: "NOS" },
      { si: 9, part: "2323", desc: "APG DIA 69.929 +/-0.018", qty: 2, unit: "NOS" },
      { si: 10, part: "2256", desc: "APG DIA 38.1+/-0.035", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Page 45: SDC/2627/0047
  {
    page: 45,
    dc_number: "SDC/2627/0047",
    date: "2026-11-12",
    vendor: {
      name: "J V TOOLS",
      address: "NO 55/56 MARIAMMAN KOIL STREET TMP NAGAR PADI",
      phone: "8056204075"
    },
    po_no: "AGIPLPO926-INDOMIM",
    process_remark: "FOR CG AND RETURN",
    lines: [
      { si: 1, part: "2024", desc: "APG DIA 2.026+/-0.008", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Page 46: SDC/2627/0048
  {
    page: 46,
    dc_number: "SDC/2627/0048",
    date: "2026-11-12",
    vendor: {
      name: "MICROMAC CNC",
      address: "36A GANDHI STREET MATHIYAZHAGAN NAGAR PADI",
      phone: "9080641141"
    },
    po_no: "AGIPLPO1042-MAGELLAN",
    process_remark: "FOR WIRECUT AND RETURN",
    lines: [
      { si: 1, part: "2140", desc: "ARG DIA 99.243/99.268", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Page 47: SDC/2627/0049
  {
    page: 47,
    dc_number: "SDC/2627/0049",
    date: "2026-11-12",
    vendor: {
      name: "S.M.K INDUSTRIES",
      address: "NO:11/18 VANNIER STREET PADI",
      phone: "9543464177"
    },
    po_no: "BHARAT FORGE- PROJECT 3",
    process_remark: "DO AS PER DRAWING AND RETURN",
    lines: [
      { si: 1, part: "2242", desc: "OVAL APG DIA 12.00+0.050/+0.032", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Pages 48-49: SDC/2627/0050 (Import once per duplicate rule)
  {
    page: 48,
    dc_number: "SDC/2627/0050",
    date: "2026-11-12",
    vendor: {
      name: "FLAMETECH (MADRAS) PVT.LTD",
      address: "H-06 INDUSTRIAL ESTATE AMBATTUR CHENNAI",
      phone: "9840092294"
    },
    po_no: "AGIPLPO647 - RAMIND",
    process_remark: "FOR HT AND RETURN",
    lines: [
      { si: 1, part: "1758", desc: "CUP TYPE ARG 14.229 +/- 0.02", qty: 2, unit: "NOS" },
      { si: 2, part: "2327", desc: "APG DIA 26.30 +0.02", qty: 2, unit: "NOS" },
      { si: 3, part: "2225", desc: "APG DIA 70.0+0.03", qty: 1, unit: "NOS" },
      { si: 4, part: "2218", desc: "APG DIA 77.5-0.030/-0.049", qty: 1, unit: "NOS" },
      { si: 5, part: "2217", desc: "APG DIA 85.0-0.044/-0.066", qty: 1, unit: "NOS" },
      { si: 6, part: "2390", desc: "APG DIA 39.000 / 39.025", qty: 1, unit: "NOS" },
      { si: 7, part: "2220", desc: "APG DIA 7.0+0.015", qty: 1, unit: "NOS" }
    ],
    source_pages: [48, 49],
    flags: [
      "DC 0050 appears identically on Pages 48 and 49; imported once per rule."
    ]
  },
  // Pages 50-52: SDC/2627/0052 (3 pages)
  {
    page: 50,
    dc_number: "SDC/2627/0052",
    date: "2026-11-12",
    vendor: {
      name: "DURGA METAL FINISHERS",
      address: "NO 10/10B THIRD CROSS STREET THIRD MAIN ROAD SIDCO INDUSTRIAL ESTATE AMBATTUR",
      phone: "044-48644001"
    },
    po_no: "AGIPLPO1249- MARKS ENGG",
    process_remark: "FOR ID GRINDING AND RETURN",
    lines: [
      // Page 50
      { si: 1, part: "2495", desc: "SRG DIA 15.811 +/0.012", qty: 1, unit: "NOS" },
      { si: 2, part: "2526", desc: "SRG DIA 19.05 -0.030", qty: 2, unit: "NOS" },
      { si: 3, part: "2490", desc: "SRG DIA 17.551 / 17.513", qty: 2, unit: "NOS" },
      { si: 4, part: "2468", desc: "SRG DIA 14.970", qty: 2, unit: "NOS" },
      { si: 5, part: "2461", desc: "SRG DIA 18.00 +0.027", qty: 2, unit: "NOS" },
      { si: 6, part: "2470", desc: "SRG DIA 15.010", qty: 2, unit: "NOS" },
      { si: 7, part: "2524", desc: "SRG DIA 15.875", qty: 2, unit: "NOS" },
      { si: 8, part: "2473", desc: "SRG DIA 18.963 / 18.976", qty: 2, unit: "NOS" },
      { si: 9, part: "2527", desc: "SRG DIA 16.0 -0.016 / -0.034", qty: 2, unit: "NOS" },
      { si: 10, part: "2491", desc: "SRG DIA 16.0 -0.016 / -0.034", qty: 2, unit: "NOS" },
      // Page 51
      { si: 11, part: "2472", desc: "SRG DIA 18.963 / 18.976", qty: 2, unit: "NOS" },
      { si: 12, part: "2467", desc: "SRG DIA 18.50 +0.021", qty: 2, unit: "NOS" },
      { si: 13, part: "2440", desc: "SRG DIA 15.000 / 15.018", qty: 6, unit: "NOS" },
      { si: 14, part: "2441", desc: "SRG DIA 15.954 / 15.973", qty: 6, unit: "NOS" },
      { si: 15, part: "2436", desc: "SRG DIA 15.875 / 15.885", qty: 6, unit: "NOS" },
      { si: 16, part: "2404", desc: "SRG DIA 17.014 / 17.057", qty: 6, unit: "NOS" },
      { si: 17, part: "2400", desc: "SRG DIA 15.880 / 15.890", qty: 6, unit: "NOS" },
      { si: 18, part: "2519", desc: "SRG DIA 15.05±0.03", qty: 2, unit: "NOS" },
      { si: 19, part: "2471", desc: "SRG DIA 15.030", qty: 2, unit: "NOS" },
      { si: 20, part: "2429", desc: "SRG DIA 13.500 / 13.540", qty: 2, unit: "NOS" },
      // Page 52
      { si: 21, part: "2485", desc: "SRG DIA 13.500 +0.018", qty: 2, unit: "NOS" },
      { si: 22, part: "2137", desc: "SRG DIA 10.0 -0.008", qty: 2, unit: "NOS" },
      { si: 23, part: "2510", desc: "URGENT - 4 WEEKS SRG DIA 13.500 / 13.530", qty: 2, unit: "NOS" },
      { si: 24, part: "2440", desc: "SRG DIA 15.000 / 15.018", qty: 6, unit: "NOS", cancelled: true },
      { si: 25, part: "1891", desc: "SRG DIA 13.6+0.011- DULL CHROME & STICKER SLOT", qty: 2, unit: "NOS" }
    ],
    source_pages: [50, 51, 52],
    flags: [
      "Page 52 SI 24 (part 2440, 6 NOS) visibly struck through; excluded from import (Page 51 SI 13 part 2440 6 NOS is kept)."
    ]
  },
  // Page 53: SDC/2627/0053
  {
    page: 53,
    dc_number: "SDC/2627/0053",
    date: "2026-11-12",
    vendor: {
      name: "SRI SIVAM INDUSTRIES",
      address: "10/30 PERIYAR ST BHARATHI NAGAR EXTN PADI CHENNAI-600050",
      phone: ""
    },
    po_no: "AGIPLPO937-WIPRO",
    process_remark: "FOR TAPPING AND RETURN",
    lines: [
      { si: 1, part: "2040", desc: "BUTTING STOPPER", qty: 1, unit: "NOS" },
      { si: 2, part: "2039", desc: "BUTTING STOPPER", qty: 1, unit: "NOS" },
      { si: 3, part: "1758", desc: "CUP TYPE ARG 14.229 +/- 0.02", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Page 54: SDC/2627/0054
  {
    page: 54,
    dc_number: "SDC/2627/0054",
    date: "2026-11-12",
    vendor: {
      name: "GSM ENGINEERS",
      address: "NO11/22A BHARATHIYAR STREET PADI CHENNAI-600050",
      phone: "7904277413"
    },
    po_no: "AGIPLPO1158- REAL TALENT",
    process_remark: "FOR JUST CLEAN AND RETURN",
    lines: [
      { si: 1, part: "2349", desc: "T TYPE APG DIA 86.00 / 86.050", qty: 1, unit: "NOS" },
      { si: 2, part: "2080", desc: "APG DIA 78 H8+0.046", qty: 1, unit: "NOS" },
      { si: 3, part: "2234", desc: "APG DIA 30 H8+0.033", qty: 1, unit: "NOS" },
      { si: 4, part: "2223", desc: "APG DIA 27.0+/-0.035", qty: 1, unit: "NOS" },
      { si: 5, part: "2345", desc: "APG DIA 52.0 -0.021 / -0.051", qty: 1, unit: "NOS" },
      { si: 6, part: "2368", desc: "APG DIA 82.6 +0.05", qty: 2, unit: "NOS" },
      { si: 7, part: "2315", desc: "APG 16.00 +0.043", qty: 2, unit: "NOS" },
      { si: 8, part: "2404", desc: "APG DIA 17.014 / 17.057", qty: 2, unit: "NOS" },
      { si: 9, part: "2322", desc: "APG DIA 69.60 +0.02", qty: 2, unit: "NOS" },
      { si: 10, part: "2244", desc: "APG DIA 10.50+0.02/-0.05", qty: 2, unit: "NOS" }
    ],
    flags: []
  },
  // Pages 55-56: SDC/2627/0055 (2 pages)
  {
    page: 55,
    dc_number: "SDC/2627/0055",
    date: "2026-11-12",
    vendor: {
      name: "EXPORT BLAKENING",
      address: "22 P K M ROAD AMBATTUR INDUSTRIAL ESTATE ATHIPET CHENNAI-600058",
      phone: "9382135966"
    },
    po_no: "AGIPLPO1200 - AUTOTECH",
    process_remark: "FOR BLACKING AND RETURN",
    lines: [
      // Page 55
      { si: 1, part: "2432", desc: "APG DIA 54.500 / 54.525", qty: 2, unit: "NOS" },
      { si: 2, part: "2391", desc: "APG DIA 16.016 / 16.034", qty: 4, unit: "NOS" },
      { si: 3, part: "2389", desc: "APG DIA 29.900 / 29.920", qty: 1, unit: "NOS" },
      { si: 4, part: "2386", desc: "APG DIA 9.680 +/-0.010", qty: 3, unit: "NOS" },
      { si: 5, part: "2364", desc: "APG DIA 9.3 +/-0.013", qty: 1, unit: "NOS" },
      { si: 6, part: "2359", desc: "APG DIA 18.795 -0.01", qty: 1, unit: "NOS" },
      { si: 7, part: "2358", desc: "APG DIA 18.6 +0.02", qty: 1, unit: "NOS" },
      { si: 8, part: "2355", desc: "APG DIA 16.30 +0.02", qty: 1, unit: "NOS" },
      { si: 9, part: "2347", desc: "APG DIA 15.0 +/-0.02", qty: 1, unit: "NOS" },
      { si: 10, part: "2346", desc: "APG DIA 47.625 +0.013 / -0.015", qty: 1, unit: "NOS" },
      // Page 56
      { si: 11, part: "2320", desc: "APG DIA 16.056 +/-0.014-", qty: 1, unit: "NOS" },
      { si: 12, part: "2319", desc: "APG DIA 30.38 +/-0.035-", qty: 1, unit: "NOS" },
      { si: 13, part: "2305", desc: "APG DIA 26.0 +0.021", qty: 1, unit: "NOS" },
      { si: 14, part: "2011", desc: "VERTICAL BENCH MOUNT PLATE", qty: 1, unit: "NOS" },
      { si: 15, part: "2498", desc: "SRG DIA 50.830 / 50.860", qty: 1, unit: "NOS" },
      { si: 16, part: "2469", desc: "SRG DIA 14.990", qty: 2, unit: "NOS" },
      { si: 17, part: "2498", desc: "APG DIA 50.830 / 50.860", qty: 1, unit: "NOS" }
    ],
    source_pages: [55, 56],
    flags: [
      "Part 2498 appears twice: SI 15 as SRG (qty 1) and SI 17 as APG (qty 1). Merged into base 2498 with qty 2."
    ]
  },
  // Page 57: SDC/2627/0056
  {
    page: 57,
    dc_number: "SDC/2627/0056",
    date: "2026-11-12",
    vendor: {
      name: "FLAMETECH (MADRAS) PVT.LTD",
      address: "H-06 INDUSTRIAL ESTATE AMBATTUR CHENNAI",
      phone: "9840092294"
    },
    po_no: "AGIPLPO956-LGB",
    process_remark: "HT AND RETURN",
    lines: [
      { si: 1, part: "2087", desc: "SPG DIA 100.0-0.06", qty: 1, unit: "NOS" },
      { si: 2, part: "2367", desc: "SRG DIA 3.38 +/-0.02 (DC PLATED )", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Page 58: SDC/2627/0057
  {
    page: 58,
    dc_number: "SDC/2627/0057",
    date: "2026-11-12",
    vendor: {
      name: "ABI ENGINEERINGS",
      address: "NO 11 THIRUVALLUR 2ND CROSS STREET TMP NAGAR PADI",
      phone: "8248680052"
    },
    po_no: "AGIPLPO1356 - SYSMAC",
    process_remark: "DO AS PER DRAWING AND RETURN",
    lines: [
      { si: 1, part: "2564", desc: "ARG DIA 14.980 +/-0.02", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Page 59: SDC/2627/0058
  {
    page: 59,
    dc_number: "SDC/2627/0058",
    date: "2026-11-12",
    vendor: {
      name: "SIVASAKTHI INDUSTRIES",
      address: "NO 4A RAJARAJAN NAGAR EXTN VANAGARAM CHENNAI-600095",
      phone: "9840609283"
    },
    po_no: "AGIPLPO1382-LGB",
    process_remark: "DO AS PER DRAWING AND RETURN",
    lines: [
      { si: 1, part: "2569", desc: "EXTENSION 25 MM", qty: 2, unit: "NOS" },
      { si: 2, part: "2570", desc: "APG DIA 19.409 +/-0.005", qty: 2, unit: "NOS" },
      { si: 3, part: "2517", desc: "APG DIA 25.4+0.033", qty: 1, unit: "NOS" }
    ],
    flags: []
  },
  // Page 60: SDC/2627/0059
  {
    page: 60,
    dc_number: "SDC/2627/0059",
    date: "2026-11-12",
    vendor: {
      name: "EXPORT BLAKENING",
      address: "22 P K M ROAD AMBATTUR INDUSTRIAL ESTATE ATHIPET CHENNAI-600058",
      phone: "9382135966"
    },
    po_no: "AGIPLPO1009- SAF",
    process_remark: "FOR BLACKING AND RETURN",
    lines: [
      { si: 1, part: "2123", desc: "VERTICAL BENCH MOUNT PLATE", qty: 1, unit: "NOS" }
    ],
    flags: []
  }
];

// Helper to club suffixed parts and multiple lines of same part
function processDcs(rawDcs) {
  const seedDcs = [];

  for (const raw of rawDcs) {
    const linesByBasePart = new Map();
    const dcFlags = [...(raw.flags || [])];

    for (const line of raw.lines) {
      if (line.cancelled) {
        // Excluded from active lines
        continue;
      }

      // Check suffix pattern: ^\d+-\d+$
      const match = line.part.match(/^(\d+)-(\d+)$/);
      const basePart = match ? match[1] : line.part;

      if (!linesByBasePart.has(basePart)) {
        linesByBasePart.set(basePart, {
          part_no: basePart,
          description: line.desc,
          qty: line.qty,
          unit: line.unit || "NOS",
          raw_lines: [
            {
              si: line.si,
              part: line.part,
              desc: line.desc,
              qty: line.qty
            }
          ],
          flags: []
        });
      } else {
        const existing = linesByBasePart.get(basePart);
        // Check if descriptions differ
        if (existing.description.trim() !== line.desc.trim()) {
          const flagMsg = `Multiple descriptions for base part ${basePart}: "${existing.description}" vs "${line.desc}". Summing qty.`;
          existing.flags.push(flagMsg);
          dcFlags.push(flagMsg);
        }
        existing.qty += line.qty;
        existing.raw_lines.push({
          si: line.si,
          part: line.part,
          desc: line.desc,
          qty: line.qty
        });
      }
    }

    const processedLines = Array.from(linesByBasePart.values());

    seedDcs.push({
      dc_number: raw.dc_number,
      date: raw.date,
      vendor: raw.vendor,
      po_no: raw.po_no,
      process_remark: raw.process_remark,
      source_pages: raw.source_pages || [raw.page],
      lines: processedLines,
      flags: dcFlags
    });
  }

  return seedDcs;
}

const processedSeed = processDcs(pagesData);

// Save to seed/dc_seed.json
const seedDir = path.resolve(__dirname, '..', 'seed');
if (!fs.existsSync(seedDir)) {
  fs.mkdirSync(seedDir, { recursive: true });
}

fs.writeFileSync(
  path.join(seedDir, 'dc_seed.json'),
  JSON.stringify(processedSeed, null, 2),
  'utf8'
);
console.log(`Saved seed/dc_seed.json with ${processedSeed.length} DCs.`);

// Generate seed/extraction_report.md
let totalLinesAll = 0;
let totalQtyAll = 0;

let md = `# DC Extraction Report from Scanned PDF (DC_sorted_v3.pdf)\n\n`;
md += `**Date Generated:** ${new Date().toISOString()}\n`;
md += `**Input File:** \`seed/DC_sorted_v3.pdf\` (60 scanned pages)\n`;
md += `**Total Distinct DC Numbers:** 42\n`;
md += `**Total Delivery Challans Extracted:** ${processedSeed.length} (including \`SDC/2627/0001-B\`)\n\n`;

md += `## 1. Number Sequence & Gaps\n`;
md += `- **Min DC Number:** \`SDC/2627/0001\`\n`;
md += `- **Max DC Number:** \`SDC/2627/0059\`\n`;
md += `- **Expected Range:** 0001 to 0059 (59 sequential slots)\n`;
md += `- **Missing / Gaps in Sequence:**\n`;
md += `  - \`0003\` (absent from PDF)\n`;
md += `  - \`0018\` (explicitly removed from PDF per user instructions)\n`;
md += `  - \`0023, 0024, 0025\` (absent from PDF)\n`;
md += `  - \`0031\` (absent from PDF)\n`;
md += `  - \`0033\` (absent from PDF)\n`;
md += `  - \`0035, 0036, 0037, 0038, 0039\` (absent from PDF)\n`;
md += `  - \`0041, 0042, 0043, 0044\` (absent from PDF)\n`;
md += `  - \`0051\` (absent from PDF)\n`;
md += `  - *Total gaps:* 17 missing numbers.\n\n`;

md += `## 2. Summary by Delivery Challan\n\n`;
md += `| DC Number | Date | Vendor Name | Purchase Order | Line Count | Total Qty | Source Pages | Flags |\n`;
md += `| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |\n`;

for (const dc of processedSeed) {
  const lineCount = dc.lines.length;
  const dcQty = dc.lines.reduce((sum, l) => sum + l.qty, 0);
  totalLinesAll += lineCount;
  totalQtyAll += dcQty;
  const flagStr = dc.flags.length > 0 ? dc.flags.join("; ") : "None";
  md += `| **${dc.dc_number}** | ${dc.date} | ${dc.vendor.name} | ${dc.po_no} | ${lineCount} | ${dcQty} ${dc.lines[0]?.unit || 'NOS'} | ${dc.source_pages.join(', ')} | ${flagStr} |\n`;
}

md += `\n**Grand Totals across 43 DCs:**\n`;
md += `- **Total Merged Line Items:** ${totalLinesAll}\n`;
md += `- **Total Dispatched Quantity:** ${totalQtyAll} NOS\n\n`;

md += `## 3. Top 5 Largest Delivery Challans\n\n`;
const sortedDcs = [...processedSeed].sort((a, b) => {
  const qtyA = a.lines.reduce((s, l) => s + l.qty, 0);
  const qtyB = b.lines.reduce((s, l) => s + l.qty, 0);
  return qtyB - qtyA;
});

for (let i = 0; i < 5; i++) {
  const dc = sortedDcs[i];
  const dcQty = dc.lines.reduce((sum, l) => sum + l.qty, 0);
  md += `### #${i + 1}: ${dc.dc_number} (${dc.vendor.name})\n`;
  md += `- **PO:** \`${dc.po_no}\`\n`;
  md += `- **Pages:** ${dc.source_pages.join(', ')}\n`;
  md += `- **Lines:** ${dc.lines.length} merged lines | **Total Qty:** ${dcQty} NOS\n`;
  md += `| Part No | Description | Qty | Raw Line Parts & Qty |\n`;
  md += `| :--- | :--- | :---: | :--- |\n`;
  for (const l of dc.lines) {
    const rawBreakdown = l.raw_lines.map(r => `SI ${r.si}: ${r.part} (${r.qty})`).join(', ');
    md += `| ${l.part_no} | ${l.description} | ${l.qty} | ${rawBreakdown} |\n`;
  }
  md += `\n`;
}

md += `## 4. Special Cases, Struck Lines & Handwritten Marks\n`;
md += `1. **SDC/2627/0001 vs SDC/2627/0001-B:** Page 1 has PO \`AGIPLPO1210-BHARAT FORGE-PROJECT 2\` (Part 2181, 2 NOS). Page 2 has PO \`AGIPLPO1248-HL MANDO\` with Part 2181 struck through. Both imported: Page 1 as \`SDC/2627/0001\`, Page 2 as \`SDC/2627/0001-B\`.\n`;
md += `2. **SDC/2627/0004 Duplicate Headers:** Page 4 had RK ENGG (Ambattur) and Page 5 had RK ENGINEERING WORKS (Vanagaram). Imported RK ENGINEERING WORKS per rule.\n`;
md += `3. **SDC/2627/0005 Struck Line:** SI 2 (\`2242\`, 1 NOS) visibly struck through. Excluded from import.\n`;
md += `4. **SDC/2627/0008 Handwritten Addition:** Handwritten "+ 2517 APG 1 NO" on Page 14 ignored from import.\n`;
md += `5. **SDC/2627/0022 Multi-type Part 2498:** Part 2498 appears as SRG (2 NOS) and APG (1 NOS). Merged to base 2498 with qty 3 NOS.\n`;
md += `6. **SDC/2627/0026 Handwritten Correction:** Handwritten text and overwritten qty on Page 33 ignored; printed qty (2 NOS) retained.\n`;
md += `7. **SDC/2627/0029 Partial Line Strikethrough:** "SPG DIA 100.0-0.06" portion struck through; ARG description retained.\n`;
md += `8. **SDC/2627/0032 & SDC/2627/0050 Duplicate Sheets:** Each appeared twice with identical content; imported exactly once.\n`;
md += `9. **SDC/2627/0052 Struck Line:** Page 52 SI 24 (\`2440\`, 6 NOS) visibly struck through. Excluded (Page 51 SI 13 \`2440\`, 6 NOS retained).\n`;
md += `10. **SDC/2627/0055 Multi-type Part 2498:** Part 2498 appears as SRG (1 NOS) and APG (1 NOS). Merged to base 2498 with qty 2 NOS.\n`;

fs.writeFileSync(
  path.join(seedDir, 'extraction_report.md'),
  md,
  'utf8'
);
console.log(`Saved seed/extraction_report.md.`);

