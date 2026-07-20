#!/usr/bin/env node

// Security enhancement script
// Replaces innerHTML usage with safer alternatives

const fs = require('fs');
const path = require('path');

class SecurityEnhancement {
  constructor() {
    this.processedFiles = 0;
    this.replacements = 0;
  }

  async run() {
    console.log('🔒 Starting security enhancements...');
    
    try {
      await this.enhancePublicFiles();
      
      console.log('\n✅ Security enhancement completed!');
      console.log(`📊 Statistics:`);
      console.log(`   - Files processed: ${this.processedFiles}`);
      console.log(`   - innerHTML replacements: ${this.replacements}`);
      
    } catch (error) {
      console.error('❌ Security enhancement failed:', error);
      process.exit(1);
    }
  }

  async enhancePublicFiles() {
    const publicDir = path.join(__dirname, '..', 'public');
    const files = await this.getHtmlFiles(publicDir);
    
    for (const file of files) {
      await this.enhanceHtmlFile(file);
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

  async enhanceHtmlFile(filePath) {
    try {
      let content = await fs.promises.readFile(filePath, 'utf8');
      const originalContent = content;
      
      // Replace innerHTML with safer alternatives in script tags
      content = content.replace(
        /<script[^>]*>([\s\S]*?)<\/script>/gi,
        (match, scriptContent) => {
          const enhancedScript = this.enhanceScriptContent(scriptContent);
          return match.replace(scriptContent, enhancedScript);
        }
      );
      
      if (content !== originalContent) {
        await fs.promises.writeFile(filePath, content, 'utf8');
        console.log(`✅ Enhanced: ${path.relative(process.cwd(), filePath)}`);
        this.processedFiles++;
      }
      
    } catch (error) {
      console.warn(`⚠️ Could not enhance ${filePath}:`, error.message);
    }
  }

  enhanceScriptContent(content) {
    // Replace common innerHTML patterns with safer alternatives
    
    // Pattern 1: Simple text content replacement
    content = content.replace(
      /(\w+)\.innerHTML\s*=\s*['"`]([^'"`]*)['"`]/g,
      (match, element, text) => {
        this.replacements++;
        return `${element}.textContent = ${text}`;
      }
    );
    
    // Pattern 2: Template literal innerHTML
    content = content.replace(
      /(\w+)\.innerHTML\s*=\s*`([^`]*)`/g,
      (match, element, template) => {
        this.replacements++;
        // For template literals, we'll keep innerHTML but add sanitization
        return `${element}.innerHTML = this.sanitizeHtml(\`${template}\`)`;
      }
    );
    
    // Add sanitization function if we made replacements
    if (this.replacements > 0 && !content.includes('sanitizeHtml')) {
      const sanitizeFunction = `
// Security: HTML sanitization function
function sanitizeHtml(html) {
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
}

`;
      content = sanitizeFunction + content;
    }
    
    return content;
  }
}

// Run enhancement if called directly
if (require.main === module) {
  const enhancement = new SecurityEnhancement();
  enhancement.run();
}

module.exports = SecurityEnhancement;
