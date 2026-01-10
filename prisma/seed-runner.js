/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

// This script identifies if it should run the TypeScript version (development)
// or the compiled JavaScript version (production) of the seed script.

const tsPath = path.join(__dirname, '../src/scripts/seed.ts');
const jsPath = path.join(__dirname, '../dist/scripts/seed.js');

if (fs.existsSync(tsPath)) {
  // Development: Use ts-node to run the TypeScript file
  require('ts-node/register');
  require(tsPath);
} else if (fs.existsSync(jsPath)) {
  // Production: Run the compiled JavaScript file
  require(jsPath);
} else {
  console.error('Seed script not found at:');
  console.error('TS Path:', tsPath);
  console.error('JS Path:', jsPath);
  process.exit(1);
}
