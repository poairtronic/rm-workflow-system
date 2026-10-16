import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const p = require('pdf-parse');

const pdfPath = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\cbac1fad-0907-439f-ab6f-9fe66db442af\\.user_uploaded\\media_1792126297355.pdf';

async function extractAllVendors() {
  const parser = new p.PDFParse({ data: fs.readFileSync(pdfPath) });
  await parser.load();
  const doc = parser.doc;

  const allVendors = [];

  for (let pageIdx = 1; pageIdx <= 8; pageIdx++) {
    const namePageNum = pageIdx;
    const phonePageNum = pageIdx + 8;
    const addrPageNum = pageIdx + 16;

    const pageNames = await doc.getPage(namePageNum);
    const tcNames = await pageNames.getTextContent();

    const pagePhones = await doc.getPage(phonePageNum);
    const tcPhones = await pagePhones.getTextContent();

    const pageAddrs = await doc.getPage(addrPageNum);
    const tcAddrs = await pageAddrs.getTextContent();

    // Sort name items from top to bottom
    let rawNameItems = tcNames.items
      .map(it => ({ str: it.str.trim(), y: it.transform[5] }))
      .filter(it => it.str)
      .sort((a, b) => b.y - a.y);

    // Merge wrapped name lines (specifically S&T ENGINEERS on page 6)
    const nameItems = [];
    for (let k = 0; k < rawNameItems.length; k++) {
      if (
        k < rawNameItems.length - 1 &&
        rawNameItems[k].str.includes('(AN S&T GROUP') &&
        rawNameItems[k + 1].str.startsWith('COMPANY')
      ) {
        nameItems.push({
          str: `${rawNameItems[k].str} ${rawNameItems[k + 1].str}`,
          y: (rawNameItems[k].y + rawNameItems[k + 1].y) / 2
        });
        k++; // skip next line
      } else {
        nameItems.push(rawNameItems[k]);
      }
    }

    const phoneItems = tcPhones.items
      .map(it => ({ str: it.str.trim(), y: it.transform[5] }))
      .filter(it => it.str);

    const addrItems = tcAddrs.items
      .map(it => ({ str: it.str.trim(), y: it.transform[5] }))
      .filter(it => it.str);

    for (let i = 0; i < nameItems.length; i++) {
      const curY = nameItems[i].y;
      const prevY = i > 0 ? nameItems[i - 1].y : curY + 25;
      const nextY = i < nameItems.length - 1 ? nameItems[i + 1].y : curY - 25;
      const topY = (prevY + curY) / 2;
      const bottomY = (curY + nextY) / 2;

      // Find matching phones
      const matchedPhones = phoneItems
        .filter(it => it.y <= topY + 0.01 && it.y > bottomY - 0.01)
        .map(it => it.str)
        .join(', ');

      // Find matching address lines
      const matchedAddrs = addrItems
        .filter(it => it.y <= topY + 0.01 && it.y > bottomY - 0.01)
        .sort((a, b) => b.y - a.y)
        .map(it => it.str)
        .join(', ');

      allVendors.push({
        num: allVendors.length + 1,
        page: pageIdx,
        name: nameItems[i].str,
        phone: matchedPhones || null,
        address: matchedAddrs || null,
      });
    }
  }

  console.log(`Total extracted vendors: ${allVendors.length}`);
  const withPhone = allVendors.filter(v => v.phone).length;
  const withAddr = allVendors.filter(v => v.address).length;
  console.log(`Vendors with phone: ${withPhone}/${allVendors.length}`);
  console.log(`Vendors with address: ${withAddr}/${allVendors.length}`);

  fs.writeFileSync(
    'C:\\Users\\Admin\\OneDrive\\Desktop\\rm-workflow-system\\backend\\scripts\\extracted-vendors.json',
    JSON.stringify(allVendors, null, 2)
  );
  console.log('Saved to extracted-vendors.json');
}

extractAllVendors().catch(console.error);
