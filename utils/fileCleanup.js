// utils/fileCleanup.js
const fs = require('fs').promises;
const path = require('path');

class FileCleanupManager {
  constructor() {
    this.uploadsDir = path.join(__dirname, '..', 'uploads');
    this.convertedDir = path.join(__dirname, '..', 'public', 'converted');
    this.maxAge = 60 * 60 * 1000; // 60 minutes in milliseconds
    this.cleanupInterval = 30 * 60 * 1000; // Run cleanup every 30 minutes
    this.isRunning = false;
  }

  /**
   * Start the automatic file cleanup service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ File cleanup service is already running');
      return;
    }

    console.log('🧹 Starting file cleanup service...');
    this.isRunning = true;

    // Run cleanup immediately on start
    this.performCleanup();

    // Schedule regular cleanup
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);

    console.log(`✅ File cleanup service started - running every ${this.cleanupInterval / 60000} minutes`);
  }

  /**
   * Stop the automatic file cleanup service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping file cleanup service...');
    this.isRunning = false;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    console.log('✅ File cleanup service stopped');
  }

  /**
   * Perform cleanup of old files
   */
  async performCleanup() {
    try {
      console.log('🧹 Starting file cleanup...');
      
      const startTime = Date.now();
      let totalDeleted = 0;
      let totalSizeFreed = 0;

      // Cleanup uploads directory
      const uploadsResult = await this.cleanupDirectory(this.uploadsDir);
      totalDeleted += uploadsResult.deleted;
      totalSizeFreed += uploadsResult.sizeFreed;

      // Cleanup converted files directory
      const convertedResult = await this.cleanupDirectory(this.convertedDir);
      totalDeleted += convertedResult.deleted;
      totalSizeFreed += convertedResult.sizeFreed;

      const duration = Date.now() - startTime;
      console.log(`✅ File cleanup completed in ${duration}ms`);
      console.log(`📊 Deleted ${totalDeleted} files, freed ${this.formatBytes(totalSizeFreed)}`);

    } catch (error) {
      console.error('❌ Error during file cleanup:', error);
    }
  }

  /**
   * Clean up a specific directory
   */
  async cleanupDirectory(dirPath) {
    let deleted = 0;
    let sizeFreed = 0;

    try {
      // Check if directory exists
      await fs.access(dirPath);
      
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        try {
          const stats = await fs.stat(fullPath);
          const age = Date.now() - stats.mtime.getTime();
          
          // Delete files older than maxAge
          if (age > this.maxAge) {
            if (entry.isDirectory()) {
              // Recursively delete directory and its contents
              const dirResult = await this.deleteDirectory(fullPath);
              deleted += dirResult.deleted;
              sizeFreed += dirResult.sizeFreed;
              console.log(`🗑️ Deleted old directory: ${entry.name} (${this.formatBytes(dirResult.sizeFreed)})`);
            } else {
              // Delete individual file
              await fs.unlink(fullPath);
              deleted++;
              sizeFreed += stats.size;
              console.log(`🗑️ Deleted old file: ${entry.name} (${this.formatBytes(stats.size)})`);
            }
          }
        } catch (statError) {
          console.warn(`⚠️ Could not access ${fullPath}:`, statError.message);
        }
      }
    } catch (accessError) {
      // Directory doesn't exist, which is fine
      if (accessError.code !== 'ENOENT') {
        console.warn(`⚠️ Could not access directory ${dirPath}:`, accessError.message);
      }
    }

    return { deleted, sizeFreed };
  }

  /**
   * Recursively delete a directory and its contents
   */
  async deleteDirectory(dirPath) {
    let deleted = 0;
    let sizeFreed = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subResult = await this.deleteDirectory(fullPath);
          deleted += subResult.deleted;
          sizeFreed += subResult.sizeFreed;
        } else {
          try {
            const stats = await fs.stat(fullPath);
            await fs.unlink(fullPath);
            deleted++;
            sizeFreed += stats.size;
          } catch (fileError) {
            console.warn(`⚠️ Could not delete file ${fullPath}:`, fileError.message);
          }
        }
      }
      
      // Remove the directory itself
      await fs.rmdir(dirPath);
    } catch (error) {
      console.warn(`⚠️ Could not delete directory ${dirPath}:`, error.message);
    }

    return { deleted, sizeFreed };
  }

  /**
   * Manually clean up a specific session
   */
  async cleanupSession(sessionId) {
    try {
      const sessionPath = path.join(this.convertedDir, sessionId);
      await fs.access(sessionPath);
      
      const result = await this.deleteDirectory(sessionPath);
      console.log(`🗑️ Manually cleaned session ${sessionId}: ${result.deleted} files, ${this.formatBytes(result.sizeFreed)} freed`);
      
      return result;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`ℹ️ Session ${sessionId} not found (already cleaned)`);
        return { deleted: 0, sizeFreed: 0 };
      }
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getStats() {
    try {
      const uploadsStats = await this.getDirectoryStats(this.uploadsDir);
      const convertedStats = await this.getDirectoryStats(this.convertedDir);
      
      return {
        uploads: uploadsStats,
        converted: convertedStats,
        total: {
          files: uploadsStats.files + convertedStats.files,
          size: uploadsStats.size + convertedStats.size,
          sizeFormatted: this.formatBytes(uploadsStats.size + convertedStats.size)
        }
      };
    } catch (error) {
      console.error('❌ Error getting cleanup stats:', error);
      return null;
    }
  }

  /**
   * Get statistics for a directory
   */
  async getDirectoryStats(dirPath) {
    let files = 0;
    let size = 0;

    try {
      await fs.access(dirPath);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        try {
          const stats = await fs.stat(fullPath);
          
          if (entry.isDirectory()) {
            const subStats = await this.getDirectoryStats(fullPath);
            files += subStats.files;
            size += subStats.size;
          } else {
            files++;
            size += stats.size;
          }
        } catch (statError) {
          // Skip files we can't access
        }
      }
    } catch (accessError) {
      // Directory doesn't exist
    }

    return { files, size, sizeFormatted: this.formatBytes(size) };
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if cleanup service is running
   */
  isCleanupRunning() {
    return this.isRunning;
  }
}

// Create singleton instance
const fileCleanupManager = new FileCleanupManager();

module.exports = fileCleanupManager;
