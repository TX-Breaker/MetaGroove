#!/usr/bin/env node

// Script di build per MetaGroove
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TARGET = process.env.TARGET || 'chrome';
const MODE = process.env.NODE_ENV || 'production';

console.log(`🚀 Building MetaGroove for ${TARGET} in ${MODE} mode...`);

// Pulisci directory di output
const distDir = path.join(__dirname, '..', 'dist', TARGET);
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

try {
  // Esegui webpack build
  const webpackCmd = `npx webpack --env target=${TARGET} --mode=${MODE}`;
  console.log(`📦 Running: ${webpackCmd}`);
  execSync(webpackCmd, { stdio: 'inherit' });

  // Crea package info
  const packageInfo = {
    name: 'MetaGroove',
    version: '1.0.0',
    target: TARGET,
    buildDate: new Date().toISOString(),
    mode: MODE
  };

  fs.writeFileSync(
    path.join(distDir, 'build-info.json'),
    JSON.stringify(packageInfo, null, 2)
  );

  console.log(`✅ Build completato per ${TARGET}!`);
  console.log(`📁 Output: ${distDir}`);

  // Mostra dimensioni file
  const stats = getDirectorySize(distDir);
  console.log(`📊 Dimensione totale: ${formatBytes(stats.size)}`);
  console.log(`📄 File totali: ${stats.files}`);

} catch (error) {
  console.error('❌ Build fallito:', error.message);
  process.exit(1);
}

function getDirectorySize(dirPath) {
  let totalSize = 0;
  let totalFiles = 0;

  function calculateSize(currentPath) {
    const stats = fs.statSync(currentPath);
    
    if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach(file => {
        calculateSize(path.join(currentPath, file));
      });
    } else {
      totalSize += stats.size;
      totalFiles++;
    }
  }

  calculateSize(dirPath);
  return { size: totalSize, files: totalFiles };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}