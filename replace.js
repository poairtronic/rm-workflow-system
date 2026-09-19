const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'backend/src/inventory/inventory.service.ts');
const replacePath = path.join(__dirname, 'backend/src/inventory/recon-replacement.ts');

let content = fs.readFileSync(targetPath, 'utf8');
const newContentBlock = fs.readFileSync(replacePath, 'utf8');

const startStr = "  async getReconciliation(inventoryItemId?: string): Promise<ReconciliationResultDto[]> {";
const endStr = "    return results;\n  }";

const startIndex = content.indexOf(startStr);
if (startIndex === -1) {
  console.error("Could not find start");
  process.exit(1);
}

const endIndex = content.indexOf(endStr, startIndex) + endStr.length;

const newFileContent = content.substring(0, startIndex) + newContentBlock + content.substring(endIndex);
fs.writeFileSync(targetPath, newFileContent, 'utf8');
console.log("Success");
