const fs = require('fs');
let c = fs.readFileSync('frontend/src/services/api.ts', 'utf8');

if (!c.includes('unwrapList')) {
  c = c.replace(
    'export const api = new ApiClient();',
    `export const api = new ApiClient();

export function unwrapList(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.data)) return response.data;
  if (response && Array.isArray(response.items)) return response.items;
  return [];
}`
  );
  fs.writeFileSync('frontend/src/services/api.ts', c);
}
