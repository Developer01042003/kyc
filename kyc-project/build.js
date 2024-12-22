const fs = require('fs');
const path = require('path');

// Copy index.html to 404.html for client-side routing
fs.copyFileSync(
  path.join(__dirname, 'dist', 'index.html'),
  path.join(__dirname, 'dist', '404.html')
);
