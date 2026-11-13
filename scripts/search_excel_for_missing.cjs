const ExcelJS = require('exceljs');

async function main() {
  const excelPath = 'C:/Users/Admin/.gemini/antigravity/brain/29bb365a-859e-47c0-9357-de39327d2bbb/.user_uploaded/media_1794541522235_3535c015.xlsx';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  const worksheet = workbook.worksheets[0];
  console.log(`Worksheet name: ${worksheet.name}, rows: ${worksheet.rowCount}`);

  const rows = [];
  const headers = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.text;
      });
    } else {
      const obj = {};
      row.eachCell((cell, colNumber) => {
        obj[headers[colNumber] || `col_${colNumber}`] = cell.text;
      });
      rows.push(obj);
    }
  });

  const m1210 = rows.filter(r => JSON.stringify(r).includes('1210'));
  console.log('Matches for 1210:', m1210.length, m1210);

  const m667 = rows.filter(r => JSON.stringify(r).includes('667'));
  console.log('Matches for 667:', m667.length, m667);

  const m2181 = rows.filter(r => JSON.stringify(r).includes('2181'));
  console.log('Matches for 2181:', m2181.length, m2181);

  const m1853 = rows.filter(r => JSON.stringify(r).includes('1853'));
  console.log('Matches for 1853:', m1853.length, m1853);
}

main().catch(console.error);
