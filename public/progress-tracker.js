// Universal Progress Tracker for all converters
// Real-time progress tracking without changing other functionality

class ProgressTracker {
    constructor() {
        this.sessionId = null;
        this.pollInterval = null;
        this.isActive = false;
    }

    // Generate unique session ID
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Start progress tracking with real-time polling
    startTracking(sessionId, progressBarElement, statusElement, onComplete) {
        this.sessionId = sessionId || this.generateSessionId();
        this.isActive = true;
        
        console.log(`🎯 Starting progress tracking for session: ${this.sessionId}`);
        
        // Clear any existing interval
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        // Start polling for progress updates
        this.pollInterval = setInterval(async () => {
            if (!this.isActive) {
                clearInterval(this.pollInterval);
                return;
            }

            try {
                const response = await fetch(`/progress/${this.sessionId}`);
                if (response.ok) {
                    const progressData = await response.json();
                    
                    if (progressData && progressData.success) {
                        this.updateProgress(progressData, progressBarElement, statusElement);
                        
                        // Check if conversion is complete
                        if (progressData.status === 'done' || progressData.percent >= 100) {
                            this.stopTracking();
                            if (onComplete) onComplete(progressData);
                        }
                    }
                }
            } catch (error) {
                console.log('Progress polling error:', error.message);
            }
        }, 500); // Poll every 500ms for smooth progress

        return this.sessionId;
    }

    // Update progress UI elements
    updateProgress(progressData, progressBarElement, statusElement) {
        if (!progressData) return;

        const percent = Math.max(0, Math.min(100, progressData.percent || 0));
        const status = progressData.status || 'processing';
        const currentFile = progressData.currentFile || '';
        
        // Update progress bar
        if (progressBarElement) {
            progressBarElement.style.width = `${percent}%`;
        }

        // Update status text with detailed info
        if (statusElement) {
            let statusText = '';
            
            if (status === 'processing') {
                statusText = `Converting... ${percent}%`;
                if (currentFile) {
                    statusText += ` (${currentFile})`;
                }
            } else if (status === 'done') {
                statusText = 'Conversion completed!';
            } else if (status === 'queued') {
                statusText = 'Starting conversion...';
            } else {
                statusText = `${status} ${percent}%`;
            }
            
            statusElement.textContent = statusText;
        }

        console.log(`📊 Progress: ${percent}% - ${status}${currentFile ? ` - ${currentFile}` : ''}`);
    }

    // Stop progress tracking
    stopTracking() {
        this.isActive = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        console.log(`⏹️ Stopped progress tracking for session: ${this.sessionId}`);
    }

    // Enhanced XHR upload with progress tracking
    uploadWithProgress(formData, uploadProgressBar, uploadStatusElement, convertProgressBar, convertStatusElement, onSuccess, onError) {
        const xhr = new XMLHttpRequest();
        
        // Add session ID to form data
        const sessionId = this.generateSessionId();
        formData.append('clientSessionId', sessionId);
        
        xhr.open('POST', '/convert');
        xhr.timeout = 1800000; // 30 minutes timeout for large files
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && uploadProgressBar && uploadStatusElement) {
                const percent = Math.round((e.loaded / e.total) * 100);
                uploadProgressBar.style.width = `${percent}%`;
                uploadStatusElement.textContent = `Uploading... ${percent}%`;
                console.log(`📤 Upload: ${percent}%`);
            }
        });

        // Handle upload completion and start conversion tracking
        xhr.onload = () => {
            if (uploadProgressBar && uploadStatusElement) {
                uploadProgressBar.style.width = '100%';
                uploadStatusElement.textContent = 'Upload complete. Starting conversion...';
            }

            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    
                    // Start real conversion progress tracking
                    if (convertProgressBar && convertStatusElement) {
                        convertProgressBar.style.width = '0%';
                        convertStatusElement.textContent = 'Converting... 0%';
                        
                        this.startTracking(sessionId, convertProgressBar, convertStatusElement, (progressData) => {
                            if (onSuccess) onSuccess(response);
                        });
                    } else {
                        // No conversion progress elements, just call success
                        if (onSuccess) onSuccess(response);
                    }
                } catch (error) {
                    console.error('Error parsing response:', error);
                    if (onError) onError('Invalid response from server');
                }
            } else {
                if (onError) onError(`Upload failed: ${xhr.status}`);
            }
        };

        // Handle upload errors
        xhr.onerror = () => {
            if (onError) onError('Upload failed');
        };

        // Handle timeout errors
        xhr.ontimeout = () => {
            if (onError) onError('Request timeout - file too large or conversion taking too long');
        };

        xhr.send(formData);
        return sessionId;
    }
}

// Global progress tracker instance
window.ProgressTracker = new ProgressTracker();
