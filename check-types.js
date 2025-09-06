const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Checking TypeScript compilation...');

try {
  // First check if tsconfig.json exists
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    console.error('tsconfig.json not found');
    process.exit(1);
  }

  console.log('Running TypeScript compiler...');
  
  // Try to run TypeScript compiler
  const result = execSync('npx tsc --noEmit --pretty', { 
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 60000
  });
  
  console.log('✅ TypeScript compilation successful!');
  if (result && result.trim()) {
    console.log('Output:', result);
  }
  
} catch (error) {
  console.error('❌ TypeScript compilation failed:');
  
  if (error.stdout) {
    console.error('STDOUT:', error.stdout);
  }
  
  if (error.stderr) {
    console.error('STDERR:', error.stderr);
  }
  
  if (error.message) {
    console.error('ERROR:', error.message);
  }
  
  process.exit(1);
}