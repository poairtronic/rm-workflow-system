const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/dispatch/Type2DispatchView.tsx', 'utf8');

c = c.replace(
  "import { MultiItemSelectorGrid } from './MultiItemSelectorGrid';",
  "import { DispatchPayloadGrid } from './DispatchPayloadGrid';"
);

c = c.replace(
  "<MultiItemSelectorGrid />",
  "<DispatchPayloadGrid />"
);

fs.writeFileSync('frontend/src/components/dispatch/Type2DispatchView.tsx', c);

if (fs.existsSync('frontend/src/components/dispatch/MultiItemSelectorGrid.tsx')) {
  fs.unlinkSync('frontend/src/components/dispatch/MultiItemSelectorGrid.tsx');
}
