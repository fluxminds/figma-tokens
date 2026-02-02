const fs = require('fs');
const path = require('path');

// Read the source HTML file which already includes inline CSS and JS
const srcHtml = fs.readFileSync(path.join(__dirname, '../src/ui.html'), 'utf-8');

// Write to dist directory
fs.writeFileSync(path.join(__dirname, '../dist/ui.html'), srcHtml);

console.log('UI built successfully');
