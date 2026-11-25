/**
 * Post-tsc hook.
 * Keep dist/src and dist/cli layout so relative imports like ../../src/* resolve.
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const marker = path.join(distDir, '.build-ok');

if (!fs.existsSync(distDir)) {
  console.error('dist/ missing — run tsc first');
  process.exit(1);
}

fs.writeFileSync(marker, new Date().toISOString());
console.log('✓ Build complete (dist/src + dist/cli)');
