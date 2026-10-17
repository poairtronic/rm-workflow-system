import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { PRODUCT_MSL_MAP } from './update-product-msl.js';

// 51 Product Families from PDF 3
const PRODUCT_FAMILIES = [
  'ACCESSORIES',
  'ALUMINIUM BAR',
  'ALUMINIUM FLAT',
  'ALUMINIUM HANDLE',
  'ALUMINIUM HEXAGON',
  'ALUMINIUM HOUSING PCS',
  'ANVIL',
  'ARG FINE BLANK',
  'BASE PLATE ROUND MS',
  'BASE PLATE SQUARE MS',
  'BRASS BITS',
  'CARBIDE BALLS',
  'CARBIDE BUSH',
  'CONNECTORS - 1A',
  'CONNECTORS - 2A',
  'CONNECTORS - CJET',
  'CONNECTORS - PIN TYPE',
  'D2 MATERIAL',
  'DOWEL PIN',
  'DRILL BIT',
  'EMERY SHEETS',
  'EN31 CUT PIECE',
  'EN31 FINE BLANK',
  'EN31 LONG BAR',
  'EXTENTION',
  'FEET PLATE SQUARE MS',
  'H.S.S BIT',
  'IS HANDLES',
  'OD GRINDING WHEEL',
  'OHNS CUT PIECE',
  'OHNS KD 100',
  'OHNS KD 112',
  'OHNS KD 125',
  'OHNS KD 22',
  'OHNS KD 32',
  'OHNS KD 38',
  'OHNS KD 45',
  'OHNS KD 53',
  'OHNS KD 63',
  'OHNS KD 71',
  'OHNS KD 85',
  'OHNS KNURLING LONG BAR',
  'OHNS LONG BAR',
  'OHNS SQUARE',
  'OTHERS',
  'SEMI FINISHED APG',
  'SEMI FINISHED ARG',
  'SEMI FINISHED SPG',
  'SETTING PLUG PLASTIC TUBE',
  'SS MATERIAL',
  'TAP'
];

// Helper to deduce family from item code/name
function deduceFamily(name) {
  const upper = name.toUpperCase().trim();
  if (upper.startsWith('CARBIDE BUSH')) return 'CARBIDE BUSH';
  if (upper.startsWith('CARBIDE BALL')) return 'CARBIDE BALLS';
  if (upper.startsWith('CUT PIECE EN31') || upper.startsWith('CUT_PIECE EN31')) return 'EN31 CUT PIECE';
  if (upper.startsWith('CUT PIECE OHNS') || upper.startsWith('CUT_PIECE OHNS')) return 'OHNS CUT PIECE';
  if (upper.startsWith('EN31 DIA') && upper.includes('FINE BLANK')) return 'EN31 FINE BLANK';
  if (upper.startsWith('EN31 DIA') && upper.includes('SEMI FINISHED')) return 'EN31 CUT PIECE';
  if (upper.startsWith('EN31 DIA') && upper.includes('CUT PIECE')) return 'EN31 CUT PIECE';
  if (upper.startsWith('LONG BAR EN31')) return 'EN31 LONG BAR';
  if (upper.startsWith('LONG BAR OHNS KNURLING')) return 'OHNS KNURLING LONG BAR';
  if (upper.startsWith('LONG BAR OHNS')) return 'OHNS LONG BAR';
  if (upper.startsWith('OHNS SQUARE')) return 'OHNS SQUARE';
  if (upper.startsWith('OHNS KD 100') || upper.startsWith('KD 100')) return 'OHNS KD 100';
  if (upper.startsWith('OHNS KD 112') || upper.startsWith('KD 112')) return 'OHNS KD 112';
  if (upper.startsWith('OHNS KD 125') || upper.startsWith('KD 125')) return 'OHNS KD 125';
  if (upper.startsWith('OHNS KD 22') || upper.startsWith('KD 22')) return 'OHNS KD 22';
  if (upper.startsWith('OHNS KD 32') || upper.startsWith('KD 32')) return 'OHNS KD 32';
  if (upper.startsWith('OHNS KD 38') || upper.startsWith('KD 38')) return 'OHNS KD 38';
  if (upper.startsWith('OHNS KD 45') || upper.startsWith('KD 45')) return 'OHNS KD 45';
  if (upper.startsWith('OHNS KD 53') || upper.startsWith('KD 53')) return 'OHNS KD 53';
  if (upper.startsWith('OHNS KD 63') || upper.startsWith('KD 63')) return 'OHNS KD 63';
  if (upper.startsWith('OHNS KD 71') || upper.startsWith('KD 71')) return 'OHNS KD 71';
  if (upper.startsWith('OHNS KD 85') || upper.startsWith('KD 85')) return 'OHNS KD 85';
  if (upper.startsWith('KD 50')) return 'OHNS KD 53';
  if (upper.startsWith('ALUMINIUM ROD') || upper.startsWith('AL ')) return 'ALUMINIUM BAR';
  if (upper.startsWith('BRASS ROD')) return 'BRASS BITS';
  if (upper.startsWith('COPPER ROD') || upper.startsWith('COPPER DIA')) return 'BRASS BITS';
  if (upper.startsWith('D2 DIA')) return 'D2 MATERIAL';
  if (upper.startsWith('HSS BIT') || (upper.startsWith('DIA ') && upper.includes('HSS BIT'))) return 'H.S.S BIT';
  if (upper.startsWith('ARG ID') || upper.startsWith('ARG OD') || upper.startsWith('ARG JET')) return 'ARG FINE BLANK';
  if (upper.startsWith('BALL ') && !upper.includes('CARBIDE')) return 'CARBIDE BALLS';
  if (upper.startsWith('CONNECTORS') || upper.startsWith('CONNECTOR') || upper.startsWith('END CONNECTOR') || upper.startsWith('L CONNECTOR')) {
    if (upper.includes('1A')) return 'CONNECTORS - 1A';
    if (upper.includes('2A')) return 'CONNECTORS - 2A';
    if (upper.includes('CJET') || upper.includes('-CJET')) return 'CONNECTORS - CJET';
    if (upper.includes('PIN')) return 'CONNECTORS - PIN TYPE';
    return 'CONNECTORS - CJET';
  }
  if (upper.startsWith('M12') || upper.startsWith('M14') || upper.startsWith('M20') || upper.startsWith('M6') || upper.startsWith('M8')) {
    if (upper.includes('1A')) return 'CONNECTORS - 1A';
    if (upper.includes('2A')) return 'CONNECTORS - 2A';
    if (upper.includes('CJET') || upper.includes('-CJET')) return 'CONNECTORS - CJET';
    if (upper.includes('PIN')) return 'CONNECTORS - PIN TYPE';
    if (upper.includes('TAP')) return 'TAP';
  }
  if (upper.startsWith('EXTENSTION') || upper.startsWith('EXTENTION')) return 'EXTENTION';
  if (upper.startsWith('I.S NO') || upper.startsWith('I.S NYLON') || upper.startsWith('IS ')) return 'IS HANDLES';
  if (upper.startsWith('JIG')) return 'FEET PLATE SQUARE MS';
  if (upper.startsWith('MS 70') || upper.startsWith('MS 40') || upper.startsWith('MS 75')) return 'BASE PLATE SQUARE MS';
  if (upper.startsWith('NYLON DIA') || upper.startsWith('NYLON ROD')) return 'SETTING PLUG PLASTIC TUBE';
  if (upper.startsWith('SS DIA') || upper.startsWith('SS ROD')) return 'SS MATERIAL';
  if (upper.startsWith('TEFFLON DIA')) return 'SETTING PLUG PLASTIC TUBE';
  if (upper.startsWith('M4 TAP')) return 'TAP';
  if (upper.startsWith('BUFFING') || upper.startsWith('CUTTING WHEELS') || upper.startsWith('M1TR') || upper.startsWith('DIAMOND') || upper.startsWith('OD GRINDING')) return 'OD GRINDING WHEEL';
  if (upper.startsWith('COTTON GLOVES') || upper.startsWith('LATHE GLOVES') || upper.startsWith('EAR PLUGS') || upper.startsWith('SAFETY EYE') || upper.startsWith('CLEANING BRUSH') || upper.startsWith('ALLEN KEY')) return 'ACCESSORIES';
  
  return 'OTHERS';
}

// 328 Inventory Items parsed 1-to-1 from Pages 1-8 (Items) and Pages 9-16 (Qty & Locations)
export const INVENTORY_RAW = [
  // Page 1 & Page 9
  { code: 'AL 115 X 25', name: 'AL 115 X 25', uom: 'NOS', qty: 2.00, loc: 'RACK 0039' },
  { code: 'AL 125 X 25', name: 'AL 125 X 25', uom: 'NOS', qty: 2.00, loc: 'RACK 0039' },
  { code: 'AL 150X 25', name: 'AL 150X 25', uom: 'NOS', qty: 3.00, loc: 'RACK 0039' },
  { code: 'AL 170 X 25', name: 'AL 170 X 25', uom: 'NOS', qty: 2.00, loc: 'RACK 0039' },
  { code: 'AL 30 x 20', name: 'AL 30 x 20', uom: 'NOS', qty: 1.00, loc: 'RACK 0039' },
  { code: 'AL 40X 25', name: 'AL 40X 25', uom: 'NOS', qty: 3.00, loc: 'RACK 0039' },
  { code: 'AL 50 X 25', name: 'AL 50 X 25', uom: 'NOS', qty: 2.00, loc: 'RACK 0039' },
  { code: 'AL 60 X 25', name: 'AL 60 X 25', uom: 'NOS', qty: 2.00, loc: 'RACK 0039' },
  { code: 'AL 60 X 30', name: 'AL 60 X 30', uom: 'NOS', qty: 1.00, loc: 'RACK 0039' },
  { code: 'AL 70 X 25', name: 'AL 70 X 25', uom: 'NOS', qty: 3.00, loc: 'RACK 0039' },
  { code: 'AL 70 X 35', name: 'AL 70 X 35', uom: 'NOS', qty: 1.00, loc: 'RACK 0039' },
  { code: 'AL 75 X 25', name: 'AL 75 X 25', uom: 'NOS', qty: 2.00, loc: 'RACK 0039' },
  { code: 'AL 80 X 25', name: 'AL 80 X 25', uom: 'NOS', qty: 3.00, loc: 'RACK 0039' },
  { code: 'AL 90X 25', name: 'AL 90X 25', uom: 'NOS', qty: 1.00, loc: 'RACK 0039' },
  { code: 'ALLEN KEY', name: 'ALLEN KEY', uom: 'NOS', qty: 1.00, loc: 'BEURO RACK 003' },
  { code: 'ALUMINIUM ROD DIA 25', name: 'ALUMINIUM ROD DIA 25', uom: 'MM', qty: 850.00, loc: 'ROD AREA' },
  { code: 'ARG ID 130 OD 130 THICKNESS 30', name: 'ARG ID 130 OD 130 THICKNESS 30', uom: 'NOS', qty: 2.00, loc: 'RACK 0045' },
  { code: 'ARG ID 25 TO 40 OD 74 SEMI FINISHED', name: 'ARG ID 25 TO 40 OD 74 SEMI FINISHED', uom: 'NOS', qty: 2.00, loc: 'RACK 0035' },
  { code: 'ARG ID 25 TO 40 OD 80 SEMI FINISHED', name: 'ARG ID 25 TO 40 OD 80 SEMI FINISHED', uom: 'NOS', qty: 5.00, loc: 'RACK 0035' },
  { code: 'ARG ID 6 TO 15 OD 55- FB', name: 'ARG ID 6 TO 15 OD 55- FB', uom: 'NOS', qty: 13.00, loc: 'RACK 0033' },
  { code: 'ARG ID 6 TO 15 OD 55- SF', name: 'ARG ID 6 TO 15 OD 55- SF', uom: 'NOS', qty: 5.00, loc: 'RACK 0033' },
  { code: 'ARG JET', name: 'ARG JET', uom: 'NOS', qty: 1.00, loc: 'BEURO RACK 003' },
  { code: 'ARG OD 120 -FB', name: 'ARG OD 120 -FB', uom: 'NOS', qty: 1.00, loc: 'RACK 0045' },
  { code: 'ARG OD 170 -FB', name: 'ARG OD 170 -FB', uom: 'NOS', qty: 2.00, loc: 'RACK 0045' },
  { code: 'BALL 3MM', name: 'BALL 3MM', uom: 'NOS', qty: 6.00, loc: 'NONE' },
  { code: 'BALL 4MM', name: 'BALL 4MM', uom: 'NOS', qty: 11.00, loc: 'NONE' },
  { code: 'BALL 5MM', name: 'BALL 5MM', uom: 'NOS', qty: 4.00, loc: 'NONE' },
  { code: 'BALL 6MM', name: 'BALL 6MM', uom: 'NOS', qty: 3.00, loc: 'NONE' },
  { code: 'BALL 8MM', name: 'BALL 8MM', uom: 'NOS', qty: 1.00, loc: 'NONE' },
  { code: 'BRASS ROD DIA 14', name: 'BRASS ROD DIA 14', uom: 'MM', qty: 400.00, loc: 'ROD AREA' },
  { code: 'BRASS ROD DIA 20', name: 'BRASS ROD DIA 20', uom: 'MM', qty: 3000.00, loc: 'ROD AREA' },
  { code: 'BRASS ROD DIA 4', name: 'BRASS ROD DIA 4', uom: 'MM', qty: 6000.00, loc: 'ROD AREA' },
  { code: 'BRASS ROD DIA 5', name: 'BRASS ROD DIA 5', uom: 'MM', qty: 3400.00, loc: 'ROD AREA' },
  { code: 'BRASS ROD DIA 6', name: 'BRASS ROD DIA 6', uom: 'MM', qty: 2000.00, loc: 'ROD AREA' },
  { code: 'BUFFING WHEELS', name: 'BUFFING WHEELS', uom: 'NOS', qty: 4.00, loc: 'RACK 0077' },
  { code: 'BUSH', name: 'BUSH', uom: 'NOS', qty: 60.00, loc: 'BEURO RACK 003' },
  { code: 'CARBIDE BALL 3MM', name: 'CARBIDE BALL 3MM', uom: 'NOS', qty: 6.00, loc: 'BEURO RACK 002' },
  { code: 'CARBIDE BALL 4MM', name: 'CARBIDE BALL 4MM', uom: 'NOS', qty: 21.00, loc: 'BEURO RACK 002' },
  { code: 'CARBIDE BALL 5 MM', name: 'CARBIDE BALL 5 MM', uom: 'NOS', qty: 10.00, loc: 'BEURO RACK 002' },
  { code: 'CARBIDE BALL 6 MM', name: 'CARBIDE BALL 6 MM', uom: 'NOS', qty: 15.00, loc: 'BEURO RACK 002' },
  { code: 'CARBIDE BALL 8MM', name: 'CARBIDE BALL 8MM', uom: 'NOS', qty: 1.00, loc: 'BEURO RACK 002' },
  { code: 'CARBIDE BUSH 60 X 42 X 20', name: 'CARBIDE BUSH 60 X 42 X 20', uom: 'NOS', qty: 2.00, loc: 'BOX 002' },

  // Page 2 & Page 10
  { code: 'CARBIDE BUSH 10 X 40', name: 'CARBIDE BUSH 10 X 40', uom: 'NOS', qty: 1.00, loc: 'BOX 001' },
  { code: 'CARBIDE BUSH 10 X 5 X20', name: 'CARBIDE BUSH 10 X 5 X20', uom: 'NOS', qty: 2.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 15 X 10 X16', name: 'CARBIDE BUSH 15 X 10 X16', uom: 'NOS', qty: 2.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 15 X 5 X 13', name: 'CARBIDE BUSH 15 X 5 X 13', uom: 'NOS', qty: 7.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 15 X 6 X14', name: 'CARBIDE BUSH 15 X 6 X14', uom: 'NOS', qty: 1.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 17 X 10 X26', name: 'CARBIDE BUSH 17 X 10 X26', uom: 'NOS', qty: 1.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 19 X 8 X20', name: 'CARBIDE BUSH 19 X 8 X20', uom: 'NOS', qty: 2.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 19 X8 X20', name: 'CARBIDE BUSH 19 X8 X20', uom: 'NOS', qty: 2.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 21 X10 X21', name: 'CARBIDE BUSH 21 X10 X21', uom: 'NOS', qty: 1.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 22 X 20 X 20', name: 'CARBIDE BUSH 22 X 20 X 20', uom: 'NOS', qty: 1.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 25 X 10 X 15', name: 'CARBIDE BUSH 25 X 10 X 15', uom: 'NOS', qty: 1.00, loc: 'BOX 001' },
  { code: 'CARBIDE BUSH 25X 18 X 26', name: 'CARBIDE BUSH 25X 18 X 26', uom: 'NOS', qty: 2.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 32 X 24 X 20', name: 'CARBIDE BUSH 32 X 24 X 20', uom: 'NOS', qty: 1.00, loc: 'BOX 001' },
  { code: 'CARBIDE BUSH 35 X 24 X20', name: 'CARBIDE BUSH 35 X 24 X20', uom: 'NOS', qty: 3.00, loc: 'BOX 001' },
  { code: 'CARBIDE BUSH 35 X 25 X 20', name: 'CARBIDE BUSH 35 X 25 X 20', uom: 'NOS', qty: 3.00, loc: 'BOX 001' },
  { code: 'CARBIDE BUSH 35.5 X 25X 20', name: 'CARBIDE BUSH 35.5 X 25X 20', uom: 'NOS', qty: 1.00, loc: 'BOX 001' },
  { code: 'CARBIDE BUSH 36 X 28 X 20', name: 'CARBIDE BUSH 36 X 28 X 20', uom: 'NOS', qty: 1.00, loc: 'BOX 001' },
  { code: 'CARBIDE BUSH 39 X35 X16', name: 'CARBIDE BUSH 39 X35 X16', uom: 'NOS', qty: 3.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 43 X34 X16', name: 'CARBIDE BUSH 43 X34 X16', uom: 'NOS', qty: 1.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 46 X 34 X 20', name: 'CARBIDE BUSH 46 X 34 X 20', uom: 'NOS', qty: 1.00, loc: 'BOX 001' },
  { code: 'CARBIDE BUSH 46X 35 X 20', name: 'CARBIDE BUSH 46X 35 X 20', uom: 'NOS', qty: 5.00, loc: 'BOX 001' },
  { code: 'CARBIDE BUSH 52 40 X 16', name: 'CARBIDE BUSH 52 40 X 16', uom: 'NOS', qty: 1.00, loc: 'BOX 003' },
  { code: 'CARBIDE BUSH 52 X 39 X 20', name: 'CARBIDE BUSH 52 X 39 X 20', uom: 'NOS', qty: 3.00, loc: 'BOX 003' },
  { code: 'CARBIDE BUSH 52 X 43 X16', name: 'CARBIDE BUSH 52 X 43 X16', uom: 'NOS', qty: 2.00, loc: 'BOX 003' },
  { code: 'CARBIDE BUSH 58 X 44X 20', name: 'CARBIDE BUSH 58 X 44X 20', uom: 'NOS', qty: 3.00, loc: 'BOX 002' },
  { code: 'CARBIDE BUSH 8 X 40', name: 'CARBIDE BUSH 8 X 40', uom: 'NOS', qty: 3.00, loc: 'BOX 001' },
  { code: 'CLEANING BRUSH', name: 'CLEANING BRUSH', uom: 'NOS', qty: 3.00, loc: 'RACK 0077' },
  { code: 'CONNECTOR', name: 'CONNECTOR', uom: 'NOS', qty: 2.00, loc: 'BEURO RACK 002' },
  { code: 'COPPER DIA 20 X 45', name: 'COPPER DIA 20 X 45', uom: 'NOS', qty: 10.00, loc: 'BEURO RACK 003' },
  { code: 'COPPER ROD DIA 25', name: 'COPPER ROD DIA 25', uom: 'MM', qty: 230.00, loc: 'BEURO RACK 002' },
  { code: 'COTTON GLOVES', name: 'COTTON GLOVES', uom: 'NOS', qty: 6.00, loc: 'RACK 0078' },
  { code: 'CUT PIECE EN31 100X17', name: 'CUT PIECE EN31 100X17', uom: 'NOS', qty: 2.00, loc: 'RACK 0047' },
  { code: 'CUT PIECE EN31 100X30', name: 'CUT PIECE EN31 100X30', uom: 'NOS', qty: 1.00, loc: 'RACK 0046' },
  { code: 'CUT PIECE EN31 100X35', name: 'CUT PIECE EN31 100X35', uom: 'NOS', qty: 1.00, loc: 'RACK 0049' },
  { code: 'CUT PIECE EN31 100X40', name: 'CUT PIECE EN31 100X40', uom: 'NOS', qty: 1.00, loc: 'RACK 0049' },
  { code: 'CUT PIECE EN31 100X45', name: 'CUT PIECE EN31 100X45', uom: 'NOS', qty: 5.00, loc: 'RACK 0046' },
  { code: 'CUT PIECE EN31 105 X 45', name: 'CUT PIECE EN31 105 X 45', uom: 'NOS', qty: 1.00, loc: 'RACK 0050' },
  { code: 'CUT PIECE EN31 105X25', name: 'CUT PIECE EN31 105X25', uom: 'NOS', qty: 1.00, loc: 'RACK 0049' },
  { code: 'CUT PIECE EN31 105X30', name: 'CUT PIECE EN31 105X30', uom: 'NOS', qty: 1.00, loc: 'RACK 0049' },
  { code: 'CUT PIECE EN31 105X35', name: 'CUT PIECE EN31 105X35', uom: 'NOS', qty: 1.00, loc: 'RACK 0049' },
  { code: 'CUT PIECE EN31 120X40', name: 'CUT PIECE EN31 120X40', uom: 'NOS', qty: 1.00, loc: 'RACK 0049' },
  { code: 'CUT PIECE EN31 130X30', name: 'CUT PIECE EN31 130X30', uom: 'NOS', qty: 1.00, loc: 'RACK 0048' },
  { code: 'CUT PIECE EN31 20X80', name: 'CUT PIECE EN31 20X80', uom: 'NOS', qty: 6.00, loc: 'RACK 0048' },
  { code: 'CUT PIECE EN31 30X255', name: 'CUT PIECE EN31 30X255', uom: 'NOS', qty: 1.00, loc: 'RACK 0048' },
  { code: 'CUT PIECE EN31 30X58', name: 'CUT PIECE EN31 30X58', uom: 'NOS', qty: 4.00, loc: 'RACK 0048' },
  { code: 'CUT PIECE EN31 35 X 75', name: 'CUT PIECE EN31 35 X 75', uom: 'NOS', qty: 1.00, loc: 'RACK 0050' },
  { code: 'CUT PIECE EN31 35X25', name: 'CUT PIECE EN31 35X25', uom: 'NOS', qty: 3.00, loc: 'RACK 0050' },

  // Page 3 & Page 11
  { code: 'CUT PIECE EN31 35X40', name: 'CUT PIECE EN31 35X40', uom: 'NOS', qty: 1.00, loc: 'RACK 0050' },
  { code: 'CUT PIECE EN31 36X15', name: 'CUT PIECE EN31 36X15', uom: 'NOS', qty: 1.00, loc: 'RACK 0050' },
  { code: 'CUT PIECE EN31 45X65', name: 'CUT PIECE EN31 45X65', uom: 'NOS', qty: 2.00, loc: 'RACK 0050' },
  { code: 'CUT PIECE EN31 50X60', name: 'CUT PIECE EN31 50X60', uom: 'NOS', qty: 1.00, loc: 'RACK 0047' },
  { code: 'CUT PIECE EN31 50X65', name: 'CUT PIECE EN31 50X65', uom: 'NOS', qty: 1.00, loc: 'RACK 0050' },
  { code: 'CUT PIECE EN31 50X83', name: 'CUT PIECE EN31 50X83', uom: 'NOS', qty: 2.00, loc: 'RACK 0048' },
  { code: 'CUT PIECE EN31 55 X 35', name: 'CUT PIECE EN31 55 X 35', uom: 'NOS', qty: 1.00, loc: 'RACK 0050' },
  { code: 'CUT PIECE EN31 55X30', name: 'CUT PIECE EN31 55X30', uom: 'NOS', qty: 1.00, loc: 'RACK 0050' },
  { code: 'CUT PIECE EN31 55X40', name: 'CUT PIECE EN31 55X40', uom: 'NOS', qty: 1.00, loc: 'RACK 0047' },
  { code: 'CUT PIECE EN31 55X50', name: 'CUT PIECE EN31 55X50', uom: 'NOS', qty: 2.00, loc: 'RACK 0047' },
  { code: 'CUT PIECE EN31 57X75', name: 'CUT PIECE EN31 57X75', uom: 'NOS', qty: 1.00, loc: 'RACK 0048' },
  { code: 'CUT PIECE EN31 60X75', name: 'CUT PIECE EN31 60X75', uom: 'NOS', qty: 1.00, loc: 'RACK 0048' },
  { code: 'CUT PIECE EN31 65X12', name: 'CUT PIECE EN31 65X12', uom: 'NOS', qty: 1.00, loc: 'RACK 0047' },
  { code: 'CUT PIECE EN31 70X17', name: 'CUT PIECE EN31 70X17', uom: 'NOS', qty: 4.00, loc: 'RACK 0047' },
  { code: 'CUT PIECE EN31 75X30', name: 'CUT PIECE EN31 75X30', uom: 'NOS', qty: 1.00, loc: 'RACK 0050' },
  { code: 'CUT PIECE EN31 75X40', name: 'CUT PIECE EN31 75X40', uom: 'NOS', qty: 1.00, loc: 'RACK 0048' },
  { code: 'CUT PIECE EN31 75X61', name: 'CUT PIECE EN31 75X61', uom: 'NOS', qty: 2.00, loc: 'RACK 0047' },
  { code: 'CUT PIECE EN31 75X70', name: 'CUT PIECE EN31 75X70', uom: 'NOS', qty: 1.00, loc: 'RACK 0047' },
  { code: 'CUT PIECE EN31 80X12', name: 'CUT PIECE EN31 80X12', uom: 'NOS', qty: 4.00, loc: 'RACK 0047' },
  { code: 'CUT PIECE EN31 80X50', name: 'CUT PIECE EN31 80X50', uom: 'NOS', qty: 1.00, loc: 'RACK 0049' },
  { code: 'CUT PIECE EN31 85X35', name: 'CUT PIECE EN31 85X35', uom: 'NOS', qty: 2.00, loc: 'RACK 0048' },
  { code: 'CUT PIECE EN31 90X15', name: 'CUT PIECE EN31 90X15', uom: 'NOS', qty: 1.00, loc: 'RACK 0049' },
  { code: 'CUT PIECE EN31 90X25', name: 'CUT PIECE EN31 90X25', uom: 'NOS', qty: 1.00, loc: 'RACK 0048' },
  { code: 'CUT PIECE EN31 90X50', name: 'CUT PIECE EN31 90X50', uom: 'NOS', qty: 8.00, loc: 'RACK 0046' },
  { code: 'CUT PIECE EN31 90X50', name: 'CUT PIECE EN31 90X50', uom: 'NOS', qty: 1.00, loc: 'RACK 0049' },
  { code: 'CUT PIECE EN31 90X60', name: 'CUT PIECE EN31 90X60', uom: 'NOS', qty: 1.00, loc: 'RACK 0049' },
  { code: 'CUT PIECE OHNS 130X30', name: 'CUT PIECE OHNS 130X30', uom: 'NOS', qty: 14.00, loc: 'RACK 0042' },
  { code: 'CUT PIECE OHNS 130X70', name: 'CUT PIECE OHNS 130X70', uom: 'NOS', qty: 3.00, loc: 'RACK 0042' },
  { code: 'CUT PIECE OHNS 160X30', name: 'CUT PIECE OHNS 160X30', uom: 'NOS', qty: 4.00, loc: 'RACK 0042' },
  { code: 'CUT PIECE OHNS 75X50', name: 'CUT PIECE OHNS 75X50', uom: 'NOS', qty: 1.00, loc: 'RACK 0047' },
  { code: 'CUT PIECE_53_SRG', name: 'CUT PIECE_53_SRG', uom: 'NOS', qty: 1.00, loc: 'RACK 009' },
  { code: 'CUT_PIECE OHNS DIA 150 X 36', name: 'CUT_PIECE OHNS DIA 150 X 36', uom: 'PC', qty: 3.00, loc: 'BAR AREA' },
  { code: 'CUT_PIECE OHNS DIA 170 X 36', name: 'CUT_PIECE OHNS DIA 170 X 36', uom: 'PC', qty: 27.00, loc: 'BAR AREA' },
  { code: 'CUT_PIECE OHNS DIA 175 X 30', name: 'CUT_PIECE OHNS DIA 175 X 30', uom: 'PC', qty: 9.00, loc: 'BAR AREA' },
  { code: 'CUT_PIECE OHNS DIA 190 X 36', name: 'CUT_PIECE OHNS DIA 190 X 36', uom: 'PC', qty: 16.00, loc: 'BAR AREA' },
  { code: 'CUTTING WHEELS', name: 'CUTTING WHEELS', uom: 'NOS', qty: 12.00, loc: 'RACK 0077' },
  { code: 'D2 DIA 28', name: 'D2 DIA 28', uom: 'MM', qty: 120.00, loc: 'RACK 0043' },
  { code: 'D2 DIA 36', name: 'D2 DIA 36', uom: 'MM', qty: 120.00, loc: 'RACK 0043' },
  { code: 'DAIKIN O RING', name: 'DAIKIN O RING', uom: 'NOS', qty: 6.00, loc: 'BEURO RACK 002' },
  { code: 'DIA 12 MM HSS BIT', name: 'DIA 12 MM HSS BIT', uom: 'NOS', qty: 1.00, loc: 'BEURO RACK 001' },
  { code: 'DIA 2 MM HSS BIT', name: 'DIA 2 MM HSS BIT', uom: 'NOS', qty: 6.00, loc: 'BEURO RACK 001' },
  { code: 'DIA 3 MM HSS BIT', name: 'DIA 3 MM HSS BIT', uom: 'NOS', qty: 12.00, loc: 'BEURO RACK 001' },
  { code: 'DIA 4 MM HSS BIT', name: 'DIA 4 MM HSS BIT', uom: 'NOS', qty: 10.00, loc: 'BEURO RACK 001' },
  { code: 'DIA 5 MM HSS BIT', name: 'DIA 5 MM HSS BIT', uom: 'NOS', qty: 25.00, loc: 'BEURO RACK 001' },
  { code: 'DIA 5.5 MM HSS BIT', name: 'DIA 5.5 MM HSS BIT', uom: 'NOS', qty: 4.00, loc: 'BEURO RACK 001' },
  { code: 'DIA 6 MM HSS BIT', name: 'DIA 6 MM HSS BIT', uom: 'NOS', qty: 10.00, loc: 'BEURO RACK 001' },
  { code: 'DIA 7.8 MM HSS BIT', name: 'DIA 7.8 MM HSS BIT', uom: 'NOS', qty: 6.00, loc: 'BEURO RACK 001' },

  // Page 4 & Page 12
  { code: 'DIAMOND DRESSING TOOL', name: 'DIAMOND DRESSING TOOL', uom: 'NOS', qty: 1.00, loc: 'BEURO RACK 002' },
  { code: 'EAR PLUGS', name: 'EAR PLUGS', uom: 'NOS', qty: 10.00, loc: 'RACK 0079' },
  { code: 'EN31 DIA 105 FINE BLANK', name: 'EN31 DIA 105 FINE BLANK', uom: 'PC', qty: 2.00, loc: 'RACK 0034' },
  { code: 'EN31 DIA 17 CUT PIECE', name: 'EN31 DIA 17 CUT PIECE', uom: 'NOS', qty: 1.00, loc: 'RACK 007' },
  { code: 'EN31 DIA 17 FINE BLANK', name: 'EN31 DIA 17 FINE BLANK', uom: 'NOS', qty: 23.00, loc: 'RACK 007' },
  { code: 'EN31 DIA 31 FINE BLANK', name: 'EN31 DIA 31 FINE BLANK', uom: 'NOS', qty: 7.00, loc: 'RACK 0012' },
  { code: 'EN31 DIA 34 SEMI FINISHED', name: 'EN31 DIA 34 SEMI FINISHED', uom: 'NOS', qty: 1.00, loc: 'RACK 0014' },
  { code: 'EN31 DIA 39 FINE BLANK', name: 'EN31 DIA 39 FINE BLANK', uom: 'NOS', qty: 19.00, loc: 'RACK 0014' },
  { code: 'EN31 DIA 43 FINE BLANK', name: 'EN31 DIA 43 FINE BLANK', uom: 'NOS', qty: 1.00, loc: 'RACK 0016' },
  { code: 'EN31 DIA 43 SEMI FINISHED', name: 'EN31 DIA 43 SEMI FINISHED', uom: 'NOS', qty: 2.00, loc: 'RACK 0016' },
  { code: 'EN31 DIA 48 FINE BLANK', name: 'EN31 DIA 48 FINE BLANK', uom: 'NOS', qty: 25.00, loc: 'RACK 0016' },
  { code: 'EN31 DIA 55 FINE BLANK', name: 'EN31 DIA 55 FINE BLANK', uom: 'PC', qty: 60.00, loc: 'RACK 0061' },
  { code: 'EN31 DIA 59 SEMI FINISHED', name: 'EN31 DIA 59 SEMI FINISHED', uom: 'NOS', qty: 1.00, loc: 'RACK 0018' },
  { code: 'EN31 DIA 60 FINE BLANK', name: 'EN31 DIA 60 FINE BLANK', uom: 'PC', qty: 79.00, loc: 'RACK 0018' },
  { code: 'EN31 DIA 60 FINE BLANK', name: 'EN31 DIA 60 FINE BLANK', uom: 'PC', qty: 20.00, loc: 'RACK 0028' },
  { code: 'EN31 DIA 64 FINE BLANK', name: 'EN31 DIA 64 FINE BLANK', uom: 'NOS', qty: 45.00, loc: 'RACK 0019' },
  { code: 'EN31 DIA 65 FINE BLANK', name: 'EN31 DIA 65 FINE BLANK', uom: 'PC', qty: 10.00, loc: 'RACK 0019' },
  { code: 'EN31 DIA 65 FINE BLANK', name: 'EN31 DIA 65 FINE BLANK', uom: 'PC', qty: 17.00, loc: 'RACK 0058' },
  { code: 'EN31 DIA 68 FINE BLANK', name: 'EN31 DIA 68 FINE BLANK', uom: 'NOS', qty: 57.00, loc: 'RACK 0022' },
  { code: 'EN31 DIA 70 FINE BLANK', name: 'EN31 DIA 70 FINE BLANK', uom: 'PC', qty: 27.00, loc: 'RACK 0065' },
  { code: 'EN31 DIA 70 FINE BLANK', name: 'EN31 DIA 70 FINE BLANK', uom: 'PC', qty: 45.00, loc: 'RACK 0029' },
  { code: 'EN31 DIA 74 FINE BLANK', name: 'EN31 DIA 74 FINE BLANK', uom: 'NOS', qty: 7.00, loc: 'RACK 0023' },
  { code: 'EN31 DIA 75 FINE BLANK', name: 'EN31 DIA 75 FINE BLANK', uom: 'PC', qty: 38.00, loc: 'RACK 0023' },
  { code: 'EN31 DIA 75 FINE BLANK', name: 'EN31 DIA 75 FINE BLANK', uom: 'PC', qty: 35.00, loc: 'RACK 0031' },
  { code: 'EN31 DIA 77 FINE BLANK', name: 'EN31 DIA 77 FINE BLANK', uom: 'NOS', qty: 41.00, loc: 'RACK 0026' },
  { code: 'EN31 DIA 8 FINE BLANK', name: 'EN31 DIA 8 FINE BLANK', uom: 'NOS', qty: 30.00, loc: 'RACK 003' },
  { code: 'EN31 DIA 80 FINE BLANK', name: 'EN31 DIA 80 FINE BLANK', uom: 'PC', qty: 27.00, loc: 'RACK 0030' },
  { code: 'EN31 DIA 89 FINE BLANK', name: 'EN31 DIA 89 FINE BLANK', uom: 'NOS', qty: 17.00, loc: 'RACK 0027' },
  { code: 'EN31 DIA 9 FINE BLANK', name: 'EN31 DIA 9 FINE BLANK', uom: 'NOS', qty: 23.00, loc: 'RACK 003' },
  { code: 'EN31 DIA 90 FINE BLANK', name: 'EN31 DIA 90 FINE BLANK', uom: 'PC', qty: 40.00, loc: 'RACK 0032' },
  { code: 'END CONNECTOR', name: 'END CONNECTOR', uom: 'NOS', qty: 147.00, loc: 'BIN 0020' },
  { code: 'ENGRAVING MACHINE', name: 'ENGRAVING MACHINE', uom: 'NOS', qty: 1.00, loc: 'BEURO RACK 001' },
  { code: 'EXTENSTION DIA 10 TO 15 (L=25)', name: 'EXTENSTION DIA 10 TO 15 (L=25)', uom: 'NOS', qty: 99.00, loc: 'RACK 0084' },
  { code: 'EXTENSTION DIA 10 TO 15 (L=50)', name: 'EXTENSTION DIA 10 TO 15 (L=50)', uom: 'NOS', qty: 85.00, loc: 'RACK 0088' },
  { code: 'EXTENSTION DIA 15 TO 20 (L=25)', name: 'EXTENSTION DIA 15 TO 20 (L=25)', uom: 'NOS', qty: 104.00, loc: 'RACK 0085' },
  { code: 'EXTENSTION DIA 15 TO 20 (L=50)', name: 'EXTENSTION DIA 15 TO 20 (L=50)', uom: 'NOS', qty: 62.00, loc: 'RACK 0089' },
  { code: 'EXTENSTION DIA 20 TO 35 (L=25)', name: 'EXTENSTION DIA 20 TO 35 (L=25)', uom: 'NOS', qty: 93.00, loc: 'RACK 0086' },
  { code: 'EXTENSTION DIA 20 TO 35 (L=50)', name: 'EXTENSTION DIA 20 TO 35 (L=50)', uom: 'NOS', qty: 59.00, loc: 'RACK 0090' },
  { code: 'EXTENSTION DIA 35 TO 60 (L=25)', name: 'EXTENSTION DIA 35 TO 60 (L=25)', uom: 'NOS', qty: 110.00, loc: 'RACK 0087' },
  { code: 'EXTENSTION DIA 35 TO 60 (L=50)', name: 'EXTENSTION DIA 35 TO 60 (L=50)', uom: 'NOS', qty: 95.00, loc: 'RACK 0091' },
  { code: 'HSS BIT 3X150', name: 'HSS BIT 3X150', uom: 'NOS', qty: 5.00, loc: 'BEURO RACK 001' },
  { code: 'HSS BIT 3X75', name: 'HSS BIT 3X75', uom: 'NOS', qty: 5.00, loc: 'BEURO RACK 001' },
  { code: 'HSS BIT 5X150', name: 'HSS BIT 5X150', uom: 'NOS', qty: 2.00, loc: 'BEURO RACK 001' },
  { code: 'HSS BIT 5X75', name: 'HSS BIT 5X75', uom: 'NOS', qty: 5.00, loc: 'BEURO RACK 001' },
  { code: 'HSS BIT 6X150', name: 'HSS BIT 6X150', uom: 'NOS', qty: 5.00, loc: 'BEURO RACK 001' },
  { code: 'HSS BIT 6X75', name: 'HSS BIT 6X75', uom: 'NOS', qty: 5.00, loc: 'BEURO RACK 001' },
  { code: 'I.S NO:2', name: 'I.S NO:2', uom: 'NOS', qty: 26.00, loc: 'RACK 0098' },

  // Page 5 & Page 13
  { code: 'I.S NO:3', name: 'I.S NO:3', uom: 'NOS', qty: 31.00, loc: 'RACK 0099' },
  { code: 'I.S NO:4 DOUBLE SIDE', name: 'I.S NO:4 DOUBLE SIDE', uom: 'NOS', qty: 6.00, loc: 'RACK 0096' },
  { code: 'I.S NO:5 DOUBLE SIDE', name: 'I.S NO:5 DOUBLE SIDE', uom: 'NOS', qty: 49.00, loc: 'RACK 0097' },
  { code: 'I.S NO:6 DOUBLE SIDE', name: 'I.S NO:6 DOUBLE SIDE', uom: 'NOS', qty: 29.00, loc: 'RACK 0095' },
  { code: 'I.S NO:8 DOUBLE SIDE', name: 'I.S NO:8 DOUBLE SIDE', uom: 'NOS', qty: 8.00, loc: 'RACK 0092' },
  { code: 'I.S NO:8 SINGLE SIDE', name: 'I.S NO:8 SINGLE SIDE', uom: 'NOS', qty: 1.00, loc: 'RACK 0092' },
  { code: 'I.S NO:9 SINGLE SIDE', name: 'I.S NO:9 SINGLE SIDE', uom: 'NOS', qty: 7.00, loc: 'RACK 0093' },
  { code: 'I.S NYLON HANDLE', name: 'I.S NYLON HANDLE', uom: 'NOS', qty: 45.00, loc: 'RACK 0100' },
  { code: 'JIG - FEET', name: 'JIG - FEET', uom: 'NOS', qty: 227.00, loc: 'RACK 0065' },
  { code: 'JIG - FEET', name: 'JIG - FEET', uom: 'NOS', qty: 81.00, loc: 'RACK 0064' },
  { code: 'KD 100 FINE BLANK', name: 'KD 100 FINE BLANK', uom: 'NOS', qty: 13.00, loc: 'RACK 0017' },
  { code: 'KD 100 SEMI FINISHED', name: 'KD 100 SEMI FINISHED', uom: 'NOS', qty: 10.00, loc: 'RACK 0017' },
  { code: 'KD 112 CUT PIECE', name: 'KD 112 CUT PIECE', uom: 'NOS', qty: 2.00, loc: 'RACK 0020' },
  { code: 'KD 112 FINE BLANK', name: 'KD 112 FINE BLANK', uom: 'NOS', qty: 30.00, loc: 'RACK 0020' },
  { code: 'KD 112 SEMI FINISHED', name: 'KD 112 SEMI FINISHED', uom: 'NOS', qty: 6.00, loc: 'RACK 0021' },
  { code: 'KD 125 FINE BLANK', name: 'KD 125 FINE BLANK', uom: 'NOS', qty: 26.00, loc: 'RACK 0024' },
  { code: 'KD 125 SEMIFINISHED', name: 'KD 125 SEMIFINISHED', uom: 'NOS', qty: 5.00, loc: 'RACK 0025' },
  { code: 'KD 22 CUT PIECE', name: 'KD 22 CUT PIECE', uom: 'NOS', qty: 11.00, loc: 'RACK 001' },
  { code: 'KD 22 SEMI FINISHED', name: 'KD 22 SEMI FINISHED', uom: 'NOS', qty: 8.00, loc: 'RACK 001' },
  { code: 'KD 22 WITH HOLE', name: 'KD 22 WITH HOLE', uom: 'NOS', qty: 60.00, loc: 'RACK 001' },
  { code: 'KD 22 WITHOUT HOLE', name: 'KD 22 WITHOUT HOLE', uom: 'NOS', qty: 3.00, loc: 'RACK 001' },
  { code: 'KD 22 WITHOUT HOLE', name: 'KD 22 WITHOUT HOLE', uom: 'NOS', qty: 1.00, loc: 'RACK 002' },
  { code: 'KD 32 CUT PIECE', name: 'KD 32 CUT PIECE', uom: 'NOS', qty: 1.00, loc: 'RACK 002' },
  { code: 'KD 32 FINE BLANK', name: 'KD 32 FINE BLANK', uom: 'NOS', qty: 8.00, loc: 'RACK 002' },
  { code: 'KD 32 SEMI FINISHED', name: 'KD 32 SEMI FINISHED', uom: 'NOS', qty: 16.00, loc: 'RACK 002' },
  { code: 'KD 38 FINE BLANK', name: 'KD 38 FINE BLANK', uom: 'NOS', qty: 2.00, loc: 'RACK 004' },
  { code: 'KD 38 SEMI FINISHED - SPL THICKNESS', name: 'KD 38 SEMI FINISHED - SPL THICKNESS', uom: 'NOS', qty: 16.00, loc: 'RACK 004' },
  { code: 'KD 38 SEMI FINISHED - STD THICKNESS', name: 'KD 38 SEMI FINISHED - STD THICKNESS', uom: 'NOS', qty: 47.00, loc: 'RACK 004' },
  { code: 'KD 45 FINE BLANK', name: 'KD 45 FINE BLANK', uom: 'NOS', qty: 1.00, loc: 'RACK 006' },
  { code: 'KD 45 SEMI FINISHED', name: 'KD 45 SEMI FINISHED', uom: 'NOS', qty: 29.00, loc: 'RACK 006' },
  { code: 'KD 45 SPL THICKNESS', name: 'KD 45 SPL THICKNESS', uom: 'NOS', qty: 3.00, loc: 'RACK 006' },
  { code: 'KD 50 SEMI FINISHED', name: 'KD 50 SEMI FINISHED', uom: 'NOS', qty: 2.00, loc: 'RACK 006' },
  { code: 'KD 53 CUT PIECE', name: 'KD 53 CUT PIECE', uom: 'NOS', qty: 1.00, loc: 'RACK 009' },
  { code: 'KD 53 FINE BLANK', name: 'KD 53 FINE BLANK', uom: 'NOS', qty: 49.00, loc: 'RACK 009' },
  { code: 'KD 53 SEMI FINISHED', name: 'KD 53 SEMI FINISHED', uom: 'NOS', qty: 23.00, loc: 'RACK 009' },
  { code: 'KD 63 FINE BLANK', name: 'KD 63 FINE BLANK', uom: 'NOS', qty: 60.00, loc: 'RACK 0059' },
  { code: 'KD 63 FINE BLANK', name: 'KD 63 FINE BLANK', uom: 'NOS', qty: 32.00, loc: 'RACK 0060' },
  { code: 'KD 63 SEMI FINISHED', name: 'KD 63 SEMI FINISHED', uom: 'NOS', qty: 21.00, loc: 'RACK 0011' },
  { code: 'KD 71 FINE BLANK', name: 'KD 71 FINE BLANK', uom: 'NOS', qty: 4.00, loc: 'RACK 0013' },
  { code: 'KD 71 SEMI FINISHED', name: 'KD 71 SEMI FINISHED', uom: 'NOS', qty: 13.00, loc: 'RACK 0013' },
  { code: 'KD 85 SEMI FINISHED', name: 'KD 85 SEMI FINISHED', uom: 'NOS', qty: 7.00, loc: 'RACK 0015' },
  { code: 'L CONNECTOR', name: 'L CONNECTOR', uom: 'NOS', qty: 2.00, loc: 'BEURO RACK 002' },
  { code: 'LATHE GLOVES', name: 'LATHE GLOVES', uom: 'NOS', qty: 5.00, loc: 'RACK 0078' },
  { code: 'LONG BAR EN31 DIA 10', name: 'LONG BAR EN31 DIA 10', uom: 'MM', qty: 2840.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 100', name: 'LONG BAR EN31 DIA 100', uom: 'MM', qty: 1710.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 105', name: 'LONG BAR EN31 DIA 105', uom: 'MM', qty: 2790.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 110', name: 'LONG BAR EN31 DIA 110', uom: 'MM', qty: 825.00, loc: 'BAR AREA' },

  // Page 6 & Page 14
  { code: 'LONG BAR EN31 DIA 120', name: 'LONG BAR EN31 DIA 120', uom: 'MM', qty: 600.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 130', name: 'LONG BAR EN31 DIA 130', uom: 'MM', qty: 1000.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 18', name: 'LONG BAR EN31 DIA 18', uom: 'MM', qty: 6520.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 20', name: 'LONG BAR EN31 DIA 20', uom: 'MM', qty: 580.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 22', name: 'LONG BAR EN31 DIA 22', uom: 'MM', qty: 3990.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 28', name: 'LONG BAR EN31 DIA 28', uom: 'MM', qty: 4480.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 30', name: 'LONG BAR EN31 DIA 30', uom: 'MM', qty: 150.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 32', name: 'LONG BAR EN31 DIA 32', uom: 'MM', qty: 60.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 45', name: 'LONG BAR EN31 DIA 45', uom: 'MM', qty: 2400.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 50', name: 'LONG BAR EN31 DIA 50', uom: 'MM', qty: 3065.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 55', name: 'LONG BAR EN31 DIA 55', uom: 'MM', qty: 1590.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 6', name: 'LONG BAR EN31 DIA 6', uom: 'MM', qty: 12280.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 60', name: 'LONG BAR EN31 DIA 60', uom: 'MM', qty: 7270.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 65', name: 'LONG BAR EN31 DIA 65', uom: 'MM', qty: 1925.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 70', name: 'LONG BAR EN31 DIA 70', uom: 'MM', qty: 4494.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 75', name: 'LONG BAR EN31 DIA 75', uom: 'MM', qty: 3910.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 8', name: 'LONG BAR EN31 DIA 8', uom: 'MM', qty: 10660.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 80', name: 'LONG BAR EN31 DIA 80', uom: 'MM', qty: 1825.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 85', name: 'LONG BAR EN31 DIA 85', uom: 'MM', qty: 4475.00, loc: 'BAR AREA' },
  { code: 'LONG BAR EN31 DIA 90', name: 'LONG BAR EN31 DIA 90', uom: 'MM', qty: 6755.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS DIA 120', name: 'LONG BAR OHNS DIA 120', uom: 'MM', qty: 600.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS DIA 125', name: 'LONG BAR OHNS DIA 125', uom: 'MM', qty: 110.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS DIA 130', name: 'LONG BAR OHNS DIA 130', uom: 'MM', qty: 760.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS DIA 40', name: 'LONG BAR OHNS DIA 40', uom: 'MM', qty: 240.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS DIA 50', name: 'LONG BAR OHNS DIA 50', uom: 'MM', qty: 1950.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS DIA 65', name: 'LONG BAR OHNS DIA 65', uom: 'MM', qty: 1890.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS DIA 75', name: 'LONG BAR OHNS DIA 75', uom: 'MM', qty: 1760.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS DIA 90', name: 'LONG BAR OHNS DIA 90', uom: 'MM', qty: 2000.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS KNURLING DIA 22', name: 'LONG BAR OHNS KNURLING DIA 22', uom: 'MM', qty: 1250.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS KNURLING DIA 35', name: 'LONG BAR OHNS KNURLING DIA 35', uom: 'MM', qty: 1320.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS KNURLING DIA 40', name: 'LONG BAR OHNS KNURLING DIA 40', uom: 'MM', qty: 868.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS KNURLING DIA 50', name: 'LONG BAR OHNS KNURLING DIA 50', uom: 'MM', qty: 2068.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS KNURLING DIA 55', name: 'LONG BAR OHNS KNURLING DIA 55', uom: 'MM', qty: 530.00, loc: 'BAR AREA' },
  { code: 'LONG BAR OHNS KNURLING DIA 90', name: 'LONG BAR OHNS KNURLING DIA 90', uom: 'MM', qty: 145.00, loc: 'BAR AREA' },
  { code: 'M12 MALE -CJET', name: 'M12 MALE -CJET', uom: 'NOS', qty: 74.00, loc: 'BIN 0015' },
  { code: 'M12 MALE 1A', name: 'M12 MALE 1A', uom: 'NOS', qty: 88.00, loc: 'BIN 003' },
  { code: 'M12 MALE 2A', name: 'M12 MALE 2A', uom: 'NOS', qty: 43.00, loc: 'BIN 009' },
  { code: 'M14 MALE -CJET', name: 'M14 MALE -CJET', uom: 'NOS', qty: 54.00, loc: 'BIN 0016' },
  { code: 'M14 MALE 1A', name: 'M14 MALE 1A', uom: 'NOS', qty: 48.00, loc: 'BIN 004' },
  { code: 'M14 MALE 2A', name: 'M14 MALE 2A', uom: 'NOS', qty: 45.00, loc: 'BIN 0010' },
  { code: 'M1TR CUTTING BLADE', name: 'M1TR CUTTING BLADE', uom: 'NOS', qty: 2.00, loc: 'BEURO RACK 002' },
  { code: 'M20 MALE -CJET', name: 'M20 MALE -CJET', uom: 'NOS', qty: 24.00, loc: 'BIN 0017' },
  { code: 'M20 MALE 1A', name: 'M20 MALE 1A', uom: 'NOS', qty: 138.00, loc: 'BIN 005' },
  { code: 'M20 MALE 2A', name: 'M20 MALE 2A', uom: 'NOS', qty: 20.00, loc: 'BIN 0011' },
  { code: 'M4 TAP', name: 'M4 TAP', uom: 'NOS', qty: 3.00, loc: 'BEURO RACK 002' },
  { code: 'M6 BRASS NIPPLE', name: 'M6 BRASS NIPPLE', uom: 'NOS', qty: 2.00, loc: 'BIN 0022' },
  { code: 'M6 FEMALE -CJET', name: 'M6 FEMALE -CJET', uom: 'NOS', qty: 131.00, loc: 'BIN 0019' },

  // Page 7 & Page 15
  { code: 'M6 FEMALE 2A', name: 'M6 FEMALE 2A', uom: 'NOS', qty: 28.00, loc: 'BIN 0012' },
  { code: 'M6 FEMALE-PIN TYPE', name: 'M6 FEMALE-PIN TYPE', uom: 'NOS', qty: 6.00, loc: 'BIN 0021' },
  { code: 'M6 MALE -CJET', name: 'M6 MALE -CJET', uom: 'NOS', qty: 103.00, loc: 'BIN 0013' },
  { code: 'M6 MALE 1A', name: 'M6 MALE 1A', uom: 'NOS', qty: 126.00, loc: 'BIN 001' },
  { code: 'M6 MALE 2A', name: 'M6 MALE 2A', uom: 'NOS', qty: 30.00, loc: 'BIN 007' },
  { code: 'M6 TAP', name: 'M6 TAP', uom: 'NOS', qty: 3.00, loc: 'BEURO RACK 002' },
  { code: 'M6 TAP AND DRILL -CJET', name: 'M6 TAP AND DRILL -CJET', uom: 'NOS', qty: 59.00, loc: 'BIN 0018' },
  { code: 'M6 TAP AND DRILL 1A', name: 'M6 TAP AND DRILL 1A', uom: 'NOS', qty: 5.00, loc: 'BIN 006' },
  { code: 'M8 MALE -CJET', name: 'M8 MALE -CJET', uom: 'NOS', qty: 103.00, loc: 'BIN 0014' },
  { code: 'M8 MALE 1A', name: 'M8 MALE 1A', uom: 'NOS', qty: 55.00, loc: 'BIN 002' },
  { code: 'M8 MALE 2A', name: 'M8 MALE 2A', uom: 'NOS', qty: 69.00, loc: 'BIN 008' },
  { code: 'MS 70X60 X15', name: 'MS 70X60 X15', uom: 'NOS', qty: 1.00, loc: 'RACK 0040' },
  { code: 'MS 40 X 25X 15', name: 'MS 40 X 25X 15', uom: 'NOS', qty: 4.00, loc: 'RACK 0040' },
  { code: 'MS 40 X 30 X 20', name: 'MS 40 X 30 X 20', uom: 'NOS', qty: 4.00, loc: 'RACK 0040' },
  { code: 'MS 75X 45X 30', name: 'MS 75X 45X 30', uom: 'NOS', qty: 6.00, loc: 'RACK 0040' },
  { code: 'NYLON DIA 110', name: 'NYLON DIA 110', uom: 'NOS', qty: 150.00, loc: 'RACK 0037' },
  { code: 'NYLON DIA 130', name: 'NYLON DIA 130', uom: 'NOS', qty: 500.00, loc: 'RACK 0037' },
  { code: 'NYLON DIA 30', name: 'NYLON DIA 30', uom: 'NOS', qty: 160.00, loc: 'RACK 0037' },
  { code: 'NYLON DIA 40', name: 'NYLON DIA 40', uom: 'NOS', qty: 270.00, loc: 'RACK 0037' },
  { code: 'NYLON ROD DIA 30', name: 'NYLON ROD DIA 30', uom: 'MM', qty: 4000.00, loc: 'ROD AREA' },
  { code: 'OHNS SQUARE 120X65X25', name: 'OHNS SQUARE 120X65X25', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 18X42X20', name: 'OHNS SQUARE 18X42X20', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 22X22X13', name: 'OHNS SQUARE 22X22X13', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 25X16X190', name: 'OHNS SQUARE 25X16X190', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 30X33X13', name: 'OHNS SQUARE 30X33X13', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 35X50X6', name: 'OHNS SQUARE 35X50X6', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 40X70X20', name: 'OHNS SQUARE 40X70X20', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 42X50X5', name: 'OHNS SQUARE 42X50X5', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 45X42X5', name: 'OHNS SQUARE 45X42X5', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 45X90X5', name: 'OHNS SQUARE 45X90X5', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 49X60X5', name: 'OHNS SQUARE 49X60X5', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 50X120X7', name: 'OHNS SQUARE 50X120X7', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 50X20X30', name: 'OHNS SQUARE 50X20X30', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 50X35X06', name: 'OHNS SQUARE 50X35X06', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 50X42X06', name: 'OHNS SQUARE 50X42X06', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 56X60X13', name: 'OHNS SQUARE 56X60X13', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 60X120X2', name: 'OHNS SQUARE 60X120X2', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 65X18X13', name: 'OHNS SQUARE 65X18X13', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 65X70X13', name: 'OHNS SQUARE 65X70X13', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 65X90X10', name: 'OHNS SQUARE 65X90X10', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 75X 120X5', name: 'OHNS SQUARE 75X 120X5', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 80X140X13', name: 'OHNS SQUARE 80X140X13', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'OHNS SQUARE 90X40X2', name: 'OHNS SQUARE 90X40X2', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'SAFETY EYE GLASS', name: 'SAFETY EYE GLASS', uom: 'NOS', qty: 1.00, loc: 'RACK 0052' },
  { code: 'SIZE NO 1', name: 'SIZE NO 1', uom: 'NOS', qty: 6.00, loc: 'RACK 0079' },
  { code: 'SIZE NO 2', name: 'SIZE NO 2', uom: 'NOS', qty: 102.00, loc: 'RACK 0072' },
  { code: 'SIZE NO 2', name: 'SIZE NO 2', uom: 'NOS', qty: 72.00, loc: 'RACK 0073' },

  // Page 8 & Page 16
  { code: 'SIZE NO 3', name: 'SIZE NO 3', uom: 'NOS', qty: 72.00, loc: 'RACK 0074' },
  { code: 'SS DIA 15', name: 'SS DIA 15', uom: 'NOS', qty: 52.00, loc: 'RACK 0075' },
  { code: 'SS DIA 28', name: 'SS DIA 28', uom: 'NOS', qty: 35.00, loc: 'RACK 0044' },
  { code: 'SS DIA 36', name: 'SS DIA 36', uom: 'NOS', qty: 180.00, loc: 'RACK 0044' },
  { code: 'SS DIA 40', name: 'SS DIA 40', uom: 'NOS', qty: 310.00, loc: 'RACK 0044' },
  { code: 'SS DIA 65', name: 'SS DIA 65', uom: 'NOS', qty: 320.00, loc: 'RACK 0044' },
  { code: 'SS ROD DIA 8', name: 'SS ROD DIA 8', uom: 'MM', qty: 36.00, loc: 'RACK 0044' },
  { code: 'STEEL STRIPS', name: 'STEEL STRIPS', uom: 'NOS', qty: 2000.00, loc: 'ROD AREA' },
  { code: 'TEFFLON DIA 20', name: 'TEFFLON DIA 20', uom: 'NOS', qty: 1.00, loc: 'BEURO RACK 002' },
  { code: 'TEFFLON DIA 40', name: 'TEFFLON DIA 40', uom: 'NOS', qty: 850.00, loc: 'RACK 0036' },
  { code: 'TEFFLON DIA 40', name: 'TEFFLON DIA 40', uom: 'NOS', qty: 270.00, loc: 'RACK 0036' }
];

async function run() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('🚀 Connected to database.');
  console.log(`Starting cleanup and setup for VELAN STORES with ${INVENTORY_RAW.length} inventory items and ${PRODUCT_FAMILIES.length} product families.`);

  await client.query('BEGIN');

  try {
    // 0. Fetch a valid user ID for created_by_id audit fields
    const userRes = await client.query('SELECT id FROM users LIMIT 1');
    const adminUserId = userRes.rows[0]?.id;
    if (!adminUserId) {
      throw new Error('No users found in database to assign created_by_id');
    }
    console.log(`👤 Using user ${adminUserId} for initial stock transactions`);

    // 1. Delete old test transactional & workflow data that references products/bins
    console.log('🧹 Clearing legacy test workflow and stock transactions...');
    const tablesToClear = [
      'dc_movements',
      'delivery_challan_items',
      'delivery_challans',
      'general_issue_items',
      'general_issues',
      'msl_alerts',
      'material_receipt_items',
      'material_receipts',
      'material_issue_items',
      'material_issues',
      'material_consumptions',
      'material_return_items',
      'material_returns',
      'additional_material_request_items',
      'additional_material_requests',
      'rm_item_snapshots',
      'rm_items',
      'rm_form_scs',
      'rm_requests',
      'sales_order_components',
      'purchase_orders',
      'stock_transactions',
      'stock_balances',
      'inventory_items',
      'products',
      'product_families',
      'product_categories',
      'bins',
      'racks',
      'warehouse_locations',
      'warehouses',
    ];

    for (const t of tablesToClear) {
      const exists = await client.query(
        `SELECT to_regclass('public.' || $1) as reg`,
        [t]
      );
      if (exists.rows[0]?.reg) {
        await client.query(`DELETE FROM "${t}"`);
        console.log(`  - Cleared ${t}`);
      }
    }

    // 2. Create Warehouse "VELAN STORES"
    console.log('🏢 Creating Warehouse "VELAN STORES"...');
    const whRes = await client.query(
      `INSERT INTO warehouses (id, code, name, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())
       RETURNING id`,
      [crypto.randomUUID(), 'VELAN STORES', 'Velan Stores']
    );
    const warehouseId = whRes.rows[0].id;

    // 3. Create Warehouse Location "VELAN-MAIN"
    console.log('📍 Creating Location "VELAN-MAIN"...');
    const locRes = await client.query(
      `INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [crypto.randomUUID(), warehouseId, 'VELAN-MAIN', 'Velan Stores Floor']
    );
    const locationId = locRes.rows[0].id;

    // 4. Create Storage Units: Racks and Bins
    const uniqueLocNames = Array.from(new Set(INVENTORY_RAW.map((i) => i.loc.trim().toUpperCase())));
    console.log(`📦 Creating ${uniqueLocNames.length} storage units (Racks & Bins)...`);

    const binMap = new Map(); // locName -> binId

    for (const locName of uniqueLocNames) {
      let rackCode = locName;
      let rackName = locName;
      let binCode = locName;
      let binName = locName;

      const rackId = crypto.randomUUID();
      await client.query(
        `INSERT INTO racks (id, location_id, code, name, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
        [rackId, locationId, rackCode, rackName]
      );

      const binId = crypto.randomUUID();
      await client.query(
        `INSERT INTO bins (id, rack_id, code, name, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
        [binId, rackId, binCode, binName]
      );

      binMap.set(locName, binId);
    }

    // 5. Create ProductCategory
    console.log('📂 Creating Product Category "Velan Master Category"...');
    const catId = crypto.randomUUID();
    await client.query(
      `INSERT INTO product_categories (id, name, is_active, created_at, updated_at)
       VALUES ($1, $2, true, NOW(), NOW())`,
      [catId, 'Velan Master Category']
    );

    // 6. Create Product Families
    console.log(`🏷️ Creating ${PRODUCT_FAMILIES.length} product families...`);
    const familyMap = new Map(); // familyName -> familyId
    for (const famName of PRODUCT_FAMILIES) {
      const famId = crypto.randomUUID();
      await client.query(
        `INSERT INTO product_families (id, category_id, name, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())`,
        [famId, catId, famName]
      );
      familyMap.set(famName, famId);
    }

    // 7. Create Products & Stock Balances
    console.log(`🔩 Inserting products, stock balances, and transactions...`);

    // Map to keep track of created products: code -> productId
    const productCodeMap = new Map();
    let distinctProductsCount = 0;

    for (let i = 0; i < INVENTORY_RAW.length; i++) {
      const item = INVENTORY_RAW[i];
      const famName = deduceFamily(item.name);
      const famId = familyMap.get(famName) || familyMap.get('OTHERS');

      let productId = productCodeMap.get(item.code);
      const targetMsl = PRODUCT_MSL_MAP[item.name.trim().toUpperCase()] || 0;
      const barcodeValue = item.code.toUpperCase().startsWith('PRD-')
        ? item.code.toUpperCase()
        : `PRD-${item.code.toUpperCase()}`;

      if (!productId) {
        productId = crypto.randomUUID();
        await client.query(
          `INSERT INTO products (
            id, family_id, code, barcode, name, uom, minimum_inventory, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())`,
          [
            productId,
            famId,
            item.code,
            barcodeValue,
            item.name,
            item.uom || 'NOS',
            targetMsl,
          ]
        );
        productCodeMap.set(item.code, productId);
        distinctProductsCount++;
      } else {
        await client.query(
          `UPDATE products
           SET minimum_inventory = $1, barcode = COALESCE(barcode, $2), updated_at = NOW()
           WHERE id = $3`,
          [targetMsl, barcodeValue, productId]
        );
      }

      // Check or create stock balance for (productId, binId)
      const targetBinId = binMap.get(item.loc.trim().toUpperCase());

      const existingBalance = await client.query(
        `SELECT id, current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
        [productId, targetBinId]
      );

      if (existingBalance.rows.length > 0) {
        await client.query(
          `UPDATE stock_balances
           SET current_quantity = current_quantity + $1,
               opening_balance = COALESCE(opening_balance, 0) + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [item.qty, existingBalance.rows[0].id]
        );
      } else {
        const stockBalanceId = crypto.randomUUID();
        await client.query(
          `INSERT INTO stock_balances (
            id, product_id, bin_id, current_quantity, opening_balance, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $4, NOW(), NOW())`,
          [stockBalanceId, productId, targetBinId, item.qty]
        );
      }

      // Log initial GRN / Inward stock transaction
      const txId = crypto.randomUUID();
      await client.query(
        `INSERT INTO stock_transactions (
          id, product_id, destination_bin_id, transaction_type, quantity,
          "referenceType", reference_id, remarks, created_by_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          txId,
          productId,
          targetBinId,
          'GRN_RECEIPT',
          item.qty,
          'OPENING_STOCK',
          txId,
          `Initial inventory import: VELAN_OPENING into ${item.loc}`,
          adminUserId
        ]
      );
    }

    await client.query('COMMIT');
    console.log('✅ COMMIT SUCCESSFUL!');
    console.log(`Successfully configured Velan Stores:
    - 1 Warehouse (VELAN STORES)
    - 1 Location (VELAN-MAIN)
    - ${uniqueLocNames.length} Storage Units (Racks & Bins)
    - ${PRODUCT_FAMILIES.length} Product Families
    - ${distinctProductsCount} Distinct Products across ${INVENTORY_RAW.length} location holdings
    - All initial stock balances and ledger transactions initialized!`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during import, transaction rolled back:', err);
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
