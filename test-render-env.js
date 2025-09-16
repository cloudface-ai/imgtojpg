#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 === RENDER ENVIRONMENT DIAGNOSTICS ===\n');

// 1. Check Node.js environment
console.log('📋 Node.js Environment:');
console.log(`- Node version: ${process.version}`);
console.log(`- Platform: ${process.platform}`);
console.log(`- Architecture: ${process.arch}`);
console.log(`- Current working directory: ${process.cwd()}`);
console.log(`- User ID: ${process.getuid()}`);
console.log(`- Group ID: ${process.getgid()}\n`);

// 2. Check file system permissions
console.log('📁 File System Check:');
try {
  const testDir = './test-permissions';
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
    console.log('✅ Created test directory');
  }
  
  const testFile = path.join(testDir, 'test.txt');
  fs.writeFileSync(testFile, 'test content');
  console.log('✅ Wrote test file');
  
  const stats = fs.statSync(testFile);
  console.log(`✅ File permissions: ${stats.mode.toString(8)}`);
  console.log(`✅ File owner: ${stats.uid}`);
  console.log(`✅ File group: ${stats.gid}`);
  
  fs.unlinkSync(testFile);
  fs.rmdirSync(testDir);
  console.log('✅ Cleaned up test files\n');
} catch (error) {
  console.log(`❌ File system test failed: ${error.message}\n`);
}

// 3. Check system dependencies
console.log('🛠️ System Dependencies Check:');

const commands = [
  { name: 'ImageMagick (magick)', cmd: 'magick -version', fallback: 'convert -version' },
  { name: 'ImageMagick (convert)', cmd: 'convert -version', fallback: null },
  { name: 'dcraw', cmd: 'dcraw -V', fallback: null },
  { name: 'libraw', cmd: 'raw-identify --help', fallback: null },
  { name: 'which magick', cmd: 'which magick', fallback: null },
  { name: 'which convert', cmd: 'which convert', fallback: null },
  { name: 'which dcraw', cmd: 'which dcraw', fallback: null },
  { name: 'ls -la /usr/bin/magick', cmd: 'ls -la /usr/bin/magick', fallback: null },
  { name: 'ls -la /usr/bin/convert', cmd: 'ls -la /usr/bin/convert', fallback: null },
  { name: 'ls -la /usr/bin/dcraw', cmd: 'ls -la /usr/bin/dcraw', fallback: null }
];

for (const tool of commands) {
  try {
    console.log(`\n🔍 Testing: ${tool.name}`);
    const result = execSync(tool.cmd, { stdio: 'pipe', timeout: 10000 }).toString();
    console.log(`✅ ${tool.name} works:`);
    console.log(result.split('\n')[0]); // Show first line only
  } catch (error) {
    console.log(`❌ ${tool.name} failed: ${error.message}`);
    
    if (tool.fallback) {
      try {
        console.log(`🔄 Trying fallback: ${tool.fallback}`);
        const fallbackResult = execSync(tool.fallback, { stdio: 'pipe', timeout: 10000 }).toString();
        console.log(`✅ Fallback works: ${fallbackResult.split('\n')[0]}`);
      } catch (fallbackError) {
        console.log(`❌ Fallback also failed: ${fallbackError.message}`);
      }
    }
  }
}

// 4. Check environment variables
console.log('\n🌍 Environment Variables:');
const relevantVars = ['PATH', 'LD_LIBRARY_PATH', 'MAGICK_HOME', 'NODE_ENV', 'PORT'];
for (const varName of relevantVars) {
  const value = process.env[varName];
  if (value) {
    console.log(`- ${varName}: ${value}`);
  } else {
    console.log(`- ${varName}: NOT SET`);
  }
}

// 5. Check available disk space
console.log('\n💾 Disk Space Check:');
try {
  const result = execSync('df -h .', { stdio: 'pipe' }).toString();
  console.log(result);
} catch (error) {
  console.log(`❌ Disk space check failed: ${error.message}`);
}

// 6. Check process limits
console.log('\n⚡ Process Limits:');
try {
  const result = execSync('ulimit -a', { stdio: 'pipe' }).toString();
  console.log(result);
} catch (error) {
  console.log(`❌ Process limits check failed: ${error.message}`);
}

console.log('\n🔍 === DIAGNOSTICS COMPLETE ===');
console.log('Check the output above to identify what\'s missing on Render!');
