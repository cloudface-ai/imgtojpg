// Debug script to test RAW processing tools on Railway
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 RAW Processing Tools Diagnostic');
console.log('=====================================');

// Test system commands
const commands = [
  'dcraw -V',
  'dcraw_emu -V', 
  'libraw_dcraw_emu -V',
  'vips --version',
  'convert -version',
  'magick -version',
  'which dcraw',
  'which dcraw_emu',
  'which libraw_dcraw_emu',
  'which vips',
  'which convert',
  'which magick'
];

commands.forEach(cmd => {
  try {
    const output = execSync(cmd, { stdio: 'pipe', timeout: 5000 }).toString().trim();
    console.log(`✅ ${cmd}:`);
    console.log(`   ${output.split('\n')[0]}`); // First line only
  } catch (error) {
    console.log(`❌ ${cmd}: ${error.message.split('\n')[0]}`);
  }
});

console.log('\n🔍 System Information:');
console.log('=====================');
try {
  console.log('OS:', execSync('uname -a', { stdio: 'pipe' }).toString().trim());
  console.log('Architecture:', execSync('uname -m', { stdio: 'pipe' }).toString().trim());
} catch (e) {
  console.log('Could not get system info');
}

console.log('\n🔍 Available packages:');
console.log('=====================');
try {
  const packages = ['dcraw', 'libraw-bin', 'imagemagick', 'libvips-tools'];
  packages.forEach(pkg => {
    try {
      execSync(`dpkg -l | grep ${pkg}`, { stdio: 'pipe' });
      console.log(`✅ ${pkg}: installed`);
    } catch {
      console.log(`❌ ${pkg}: not found`);
    }
  });
} catch (e) {
  console.log('Could not check packages');
}

console.log('\n🔍 Testing RAW conversion with sample file:');
console.log('==========================================');

// This will help us understand what's happening during actual conversion
module.exports = { checkRawTools: () => console.log('RAW tools diagnostic complete') };
