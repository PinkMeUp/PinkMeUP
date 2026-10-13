const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const config = {};
for (const key of ['API_ORIGIN', 'API_URL']) {
  if (!process.env[key]) continue;
  const url = new URL(process.env[key]);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${key} must be a public HTTP(S) URL without credentials, query or fragment`);
  }
  if (key === 'API_ORIGIN' && url.pathname !== '/') throw new Error('API_ORIGIN must not include a path; use API_URL for a custom API path');
  config[key] = process.env[key].replace(/\/$/, '');
}
fs.mkdirSync(output, {recursive: true});
for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
  if (entry.name.endsWith('.html') || ['js', 'css', 'data', 'Icons', 'favicon.svg', 'serve.json'].includes(entry.name)) {
    fs.cpSync(path.join(root, entry.name), path.join(output, entry.name), {recursive: true});
  }
}
const script = Object.entries(config).map(([key, value]) => `window.${key} = ${JSON.stringify(value)};`).join('\n');
fs.writeFileSync(path.join(output, 'js/runtime-config.js'), script+'\n');
console.log('Built frontend/dist with '+(Object.keys(config).join(', ') || 'same-origin API configuration'));
