// Simple build: copy frontend files to _site/ for Cloudflare Pages
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend', 'public');
const dest = path.join(__dirname, '..', '_site');

if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Built to _site/');
