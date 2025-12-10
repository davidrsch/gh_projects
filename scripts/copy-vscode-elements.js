const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '..', 'node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js');
const targetDir = path.join(__dirname, '..', 'media', 'third-party');
const targetFile = path.join(targetDir, 'vscode-elements.js');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Check if source exists
if (fs.existsSync(sourceFile)) {
  fs.copyFileSync(sourceFile, targetFile);
  console.log('Copied vscode-elements.js to media/third-party/');
} else {
  console.log('Source vscode-elements file not found, skipping copy');
}
