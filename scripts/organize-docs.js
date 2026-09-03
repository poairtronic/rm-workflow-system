const fs = require('fs');
const path = require('path');

const docsRoot = path.join(__dirname, '..', 'docs');

const structure = {
  requirements: [
    'requirements.md',
    'user-stories.md',
    'business-rules.md',
    'roles-permissions.md',
  ],
  architecture: [
    'system-architecture.md',
    'api-architecture.md',
    'deployment-architecture.md',
  ],
  workflow: [
    'overall-workflow.md',
    'design-workflow.md',
    'stores-workflow.md',
    'production-workflow.md',
    'material-lifecycle.md',
  ],
  database: ['database-design.md'],
  'ui-ux': ['design-system.md', 'ui-rules.md'],
  development: [
    'development-guide.md',
    'testing-guide.md',
    'deployment-guide.md',
  ],
};

// Create folders
Object.keys(structure).forEach((folder) => {
  fs.mkdirSync(path.join(docsRoot, folder), { recursive: true });
});

console.log('Docs subdirectories created successfully.');
