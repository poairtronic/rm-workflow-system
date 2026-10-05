const fs = require('fs');

let c = fs.readFileSync('frontend/src/components/dispatch/Type1DispatchWizard.tsx', 'utf8');

c = c.replace(
  /\{sc\.code\} \(\{sc\.poNumber\}\)/g,
  "{sc.scNumber} ({sc.purchaseOrder?.poNumber || 'No PO'})"
);

fs.writeFileSync('frontend/src/components/dispatch/Type1DispatchWizard.tsx', c);
