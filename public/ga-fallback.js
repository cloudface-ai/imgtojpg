/**
 * Google Analytics Fallback Handler
 * Handles ERR_BLOCKED_BY_CLIENT gracefully
 */

(function() {
    'use strict';
    
    // Check if Google Analytics is blocked
    function isGABlocked() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://www.googletagmanager.com/gtag/js?id=G-2P190S3BCE';
            script.onload = () => resolve(false);
            script.onerror = () => resolve(true);
            
            // Timeout after 3 seconds
            setTimeout(() => resolve(true), 3000);
            
            // Don't actually append to avoid duplicate loading
            script.remove();
        });
    }
    
    // Fallback analytics function
    function fallbackGtag() {
        console.log('📊 Analytics blocked by ad blocker - using fallback tracking');
        
        // Create a mock gtag function that logs to console
        window.gtag = function() {
            const args = Array.from(arguments);
            console.log('📊 Analytics Event (Fallback):', args);
            
            // Store events locally for debugging
            if (!window.fallbackAnalytics) {
                window.fallbackAnalytics = [];
            }
            window.fallbackAnalytics.push({
                timestamp: new Date().toISOString(),
                args: args
            });
        };
        
        // Initialize dataLayer
        window.dataLayer = window.dataLayer || [];
    }
    
    // Initialize Google Analytics with fallback
    async function initGA() {
        const isBlocked = await isGABlocked();
        
        if (isBlocked) {
            fallbackGtag();
        } else {
            // GA is not blocked, proceed normally
            console.log('📊 Google Analytics loaded successfully');
        }
        
        // Always initialize dataLayer and gtag
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-2P190S3BCE', {
            'send_page_view': false,
            'custom_map': {'dimension1': 'user_type'}
        });
        
        window.gtag = gtag;
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGA);
    } else {
        initGA();
    }
    
})();

