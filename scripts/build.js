const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const srcDistDir = path.join(distDir, 'src');

// Check if dist/src exists
if (fs.existsSync(srcDistDir)) {
  // Move all files from dist/src to dist
  const files = fs.readdirSync(srcDistDir);

  files.forEach(file => {
    const srcPath = path.join(srcDistDir, file);
    const destPath = path.join(distDir, file);

    // Remove destination if it exists (could be directory or file)
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.isDirectory()) {
        fs.rmSync(destPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(destPath);
      }
    }

    // Move file/directory
    fs.renameSync(srcPath, destPath);
  });

  // Remove empty src directory
  fs.rmdirSync(srcDistDir);

  console.log('✓ Build output restructured: dist/src/* → dist/*');
}
