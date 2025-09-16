#!/usr/bin/env node

// Test script to check system dependencies
const { execSync } = require('child_process');
const fs = require('fs');

console.log('=== System Dependencies Test ===\n');

// Test ImageMagick
console.log('1. Testing ImageMagick...');
try {
  const magickVersion = execSync('magick -version', { stdio: 'pipe' }).toString();
  console.log('✅ ImageMagick available:', magickVersion.split('\n')[0]);
} catch (error) {
  console.log('❌ ImageMagick not available:', error.message);
}

// Test dcraw
console.log('\n2. Testing dcraw...');
try {
  const dcrawVersion = execSync('dcraw -V', { stdio: 'pipe' }).toString();
  console.log('✅ dcraw available:', dcrawVersion.split('\n')[0]);
} catch (error) {
  try {
    const dcrawVersion2 = execSync('dcraw --version', { stdio: 'pipe' }).toString();
    console.log('✅ dcraw available:', dcrawVersion2.split('\n')[0]);
  } catch (error2) {
    try {
      const dcrawVersion3 = execSync('dcraw -h', { stdio: 'pipe' }).toString();
      console.log('✅ dcraw available (help output):', dcrawVersion3.split('\n')[0]);
    } catch (error3) {
      try {
        const dcrawVersion4 = execSync('dcraw', { stdio: 'pipe' }).toString();
        console.log('✅ dcraw available (usage output):', dcrawVersion4.split('\n')[0]);
      } catch (error4) {
        console.log('❌ dcraw not available:', error4.message);
      }
    }
  }
}

// Test libraw
console.log('\n3. Testing libraw...');
try {
  const librawVersion = execSync('raw-identify --version', { stdio: 'pipe' }).toString();
  console.log('✅ libraw available:', librawVersion.split('\n')[0]);
} catch (error) {
  console.log('❌ libraw not available:', error.message);
}

// Test which commands
console.log('\n4. Checking command locations...');
try {
  const magickPath = execSync('which magick', { stdio: 'pipe' }).toString().trim();
  console.log('✅ magick path:', magickPath);
} catch (error) {
  console.log('❌ magick not found in PATH');
}

try {
  const dcrawPath = execSync('which dcraw', { stdio: 'pipe' }).toString().trim();
  console.log('✅ dcraw path:', dcrawPath);
} catch (error) {
  console.log('❌ dcraw not found in PATH');
}

// Test file permissions
console.log('\n5. Checking file permissions...');
try {
  const magickStat = fs.statSync('/usr/bin/magick');
  console.log('✅ magick executable:', magickStat.isFile(), 'mode:', magickStat.mode.toString(8));
} catch (error) {
  console.log('❌ Cannot stat magick:', error.message);
}

try {
  const dcrawStat = fs.statSync('/usr/bin/dcraw');
  console.log('✅ dcraw executable:', dcrawStat.isFile(), 'mode:', dcrawStat.mode.toString(8));
} catch (error) {
  console.log('❌ Cannot stat dcraw:', error.message);
}

console.log('\n=== Test Complete ===');
