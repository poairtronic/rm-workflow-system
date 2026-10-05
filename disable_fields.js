const fs = require('fs');
const files = [
  'C:/Users/Admin/OneDrive/Desktop/rm-workflow-system/frontend/src/components/production/ProcessCreationWizard.tsx',
  'C:/Users/Admin/OneDrive/Desktop/rm-workflow-system/frontend/src/components/production/ProcessEditView.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\{...register\('baseUom'\)\}/g, "{...register('baseUom')} disabled title=\"Not saved yet\"");
  content = content.replace(/\{...register\('expectedCycleTimeMs', \{ valueAsNumber: true \}\)\}/g, "{...register('expectedCycleTimeMs', { valueAsNumber: true })} disabled title=\"Not saved yet\"");
  content = content.replace(/\{...register\('costCenter'\)\}/g, "{...register('costCenter')} disabled title=\"Not saved yet\"");
  fs.writeFileSync(file, content);
}
