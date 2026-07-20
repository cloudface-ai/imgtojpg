#!/usr/bin/env node

// Production cleanup script
// Removes console logs, TODO comments, and optimizes files for production

const fs = require('fs');
const path = require('path');

class ProductionCleanup {
  constructor() {
    this.processedFiles = 0;
    this.removedLogs = 0;
    this.removedTodos = 0;
  }

  async run() {
    console.log('🧹 Starting production cleanup...');
    
    try {
      await this.cleanupPublicDirectory();
      await this.cleanupServerFiles();
      
      console.log('\n✅ Production cleanup completed!');
      console.log(`📊 Statistics:`);
      console.log(`   - Files processed: ${this.processedFiles}`);
      console.log(`   - Console logs removed: ${this.removedLogs}`);
      console.log(`   - TODO comments removed: ${this.removedTodos}`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  }

  async cleanupPublicDirectory() {
    const publicDir = path.join(__dirname, '..', 'public');
    const files = await this.getHtmlFiles(publicDir);
    
    for (const file of files) {
      await this.cleanupHtmlFile(file);
    }
  }

  async cleanupServerFiles() {
    const serverFiles = [
      path.join(__dirname, '..', 'server.js'),
      path.join(__dirname, '..', 'utils', 'fileCleanup.js'),
      path.join(__dirname, '..', 'middleware', 'auth.js'),
      path.join(__dirname, '..', 'routes', 'api.js'),
      path.join(__dirname, '..', 'services', 'payments.js')
    ];

    for (const file of serverFiles) {
      if (fs.existsSync(file)) {
        await this.cleanupJsFile(file);
      }
    }
  }

  async getHtmlFiles(dir) {
    const files = [];
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        const subFiles = await this.getHtmlFiles(fullPath);
        files.push(...subFiles);
      } else if (item.name.endsWith('.html')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async cleanupHtmlFile(filePath) {
    try {
      let content = await fs.promises.readFile(filePath, 'utf8');
      const originalContent = content;
      
      // Remove console.log statements from <script> tags
      content = content.replace(
        /<script[^>]*>([\s\S]*?)<\/script>/gi,
        (match, scriptContent) => {
          const cleanedScript = this.removeConsoleLogs(scriptContent);
          return match.replace(scriptContent, cleanedScript);
        }
      );
      
      // Remove TODO comments
      content = content.replace(/<!--\s*TODO:.*?-->/gi, '');
      content = content.replace(/\/\/\s*TODO:.*$/gm, '');
      
      if (content !== originalContent) {
        await fs.promises.writeFile(filePath, content, 'utf8');
        console.log(`✅ Cleaned: ${path.relative(process.cwd(), filePath)}`);
        this.processedFiles++;
      }
      
    } catch (error) {
      console.warn(`⚠️ Could not clean ${filePath}:`, error.message);
    }
  }

  async cleanupJsFile(filePath) {
    try {
      let content = await fs.promises.readFile(filePath, 'utf8');
      const originalContent = content;
      
      // Remove console logs (but keep error logs for production debugging)
      content = this.removeConsoleLogs(content);
      
      // Remove TODO comments
      content = content.replace(/\/\/\s*TODO:.*$/gm, '');
      content = content.replace(/\/\*\s*TODO:.*?\*\//gs, '');
      
      if (content !== originalContent) {
        await fs.promises.writeFile(filePath, content, 'utf8');
        console.log(`✅ Cleaned: ${path.relative(process.cwd(), filePath)}`);
        this.processedFiles++;
      }
      
    } catch (error) {
      console.warn(`⚠️ Could not clean ${filePath}:`, error.message);
    }
  }

  removeConsoleLogs(content) {
    // Remove console.log, console.info, console.warn (but keep console.error)
    const patterns = [
      /console\.log\s*\([^)]*\)\s*;?/g,
      /console\.info\s*\([^)]*\)\s*;?/g,
      /console\.warn\s*\([^)]*\)\s*;?/g,
      /console\.debug\s*\([^)]*\)\s*;?/g
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        this.removedLogs += matches.length;
      }
      content = content.replace(pattern, '');
    });

    return content;
  }
}

// Run cleanup if called directly
if (require.main === module) {
  const cleanup = new ProductionCleanup();
  cleanup.run();
}

module.exports = ProductionCleanup;
