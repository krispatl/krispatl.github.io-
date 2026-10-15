const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'public');
fs.mkdirSync(out, { recursive: true });
// Explicit publish boundary: backend code, tests and operator docs stay out of the site.
for (const name of fs.readdirSync(root)) {
  if (/\.(html|css|js|ico|png|jpg|jpeg|svg|webp|woff2?|mp4|webm)$/i.test(name) || ['robots.txt', 'CNAME'].includes(name)) {
    if (fs.statSync(path.join(root, name)).isFile()) fs.copyFileSync(path.join(root, name), path.join(out, name));
  }
}
if (fs.existsSync(path.join(root, 'glitch-assets'))) fs.cpSync(path.join(root, 'glitch-assets'), path.join(out, 'glitch-assets'), { recursive: true });
