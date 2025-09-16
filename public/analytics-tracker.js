/**
 * imgtojpg.org Analytics Tracker
 * A lightweight, privacy-focused analytics solution
 * Add this script to your pages to track real user behavior
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        TRACKING_ID: 'imgtojpg_' + Math.random().toString(36).substr(2, 9),
        SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
        SCROLL_THRESHOLDS: [25, 50, 75, 100],
        HEARTBEAT_INTERVAL: 30000, // 30 seconds
        MAX_EVENTS_PER_SESSION: 100,
        STORAGE_KEY: 'imgtojpg_analytics_data'
    };

    // Analytics Data Structure
    let analyticsData = {
        sessionId: null,
        startTime: null,
        lastActivity: null,
        pageViews: 0,
        events: [],
        scrollDepth: 0,
        timeOnPage: 0,
        referrer: null,
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        language: navigator.language || navigator.userLanguage,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    // Safe track wrapper to avoid constructor order issues
    function safeTrack(eventName, eventData = {}) {
        try {
            // Use EventTracker instance if available
            if (typeof eventTracker !== 'undefined' && eventTracker && typeof eventTracker.trackEvent === 'function') {
                eventTracker.trackEvent(eventName, eventData);
                return;
            }
            // Fallback: enqueue event into analyticsData for later persistence
            analyticsData.events = analyticsData.events || [];
            analyticsData.events.push({
                name: eventName,
                data: eventData,
                timestamp: Date.now(),
                page: window.location.pathname,
                url: window.location.href
            });
        } catch (e) {}
    }

    // Session Management
    class SessionManager {
        constructor() {
            this.initSession();
        }

        initSession() {
            const now = Date.now();
            const lastSession = this.getLastSession();
            
            // Check if we need to start a new session
            if (!lastSession || (now - lastSession.lastActivity) > CONFIG.SESSION_TIMEOUT) {
                this.startNewSession();
            } else {
                this.resumeSession(lastSession);
            }
            
            this.startHeartbeat();
        }

        startNewSession() {
            analyticsData.sessionId = this.generateSessionId();
            analyticsData.startTime = Date.now();
            analyticsData.lastActivity = Date.now();
            analyticsData.pageViews = 1;
            analyticsData.events = [];
            analyticsData.scrollDepth = 0;
            analyticsData.timeOnPage = 0;
            analyticsData.referrer = document.referrer;
            
            this.saveSession();
            safeTrack('session_started');
        }

        resumeSession(lastSession) {
            analyticsData = { ...lastSession };
            analyticsData.pageViews++;
            analyticsData.lastActivity = Date.now();
            analyticsData.referrer = document.referrer;
            
            this.saveSession();
            safeTrack('session_resumed');
        }

        generateSessionId() {
            return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        getLastSession() {
            try {
                const data = localStorage.getItem(CONFIG.STORAGE_KEY);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.warn('Analytics: Could not load session data');
                return null;
            }
        }

        saveSession() {
            try {
                analyticsData.lastActivity = Date.now();
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(analyticsData));
            } catch (e) {
                console.warn('Analytics: Could not save session data');
            }
        }

        startHeartbeat() {
            setInterval(() => {
                this.updateActivity();
            }, CONFIG.HEARTBEAT_INTERVAL);
        }

        updateActivity() {
            analyticsData.lastActivity = Date.now();
            analyticsData.timeOnPage += CONFIG.HEARTBEAT_INTERVAL / 1000;
            this.saveSession();
        }
    }

    // Event Tracking
    class EventTracker {
        constructor() {
            this.setupEventListeners();
        }

        trackEvent(eventName, eventData = {}) {
            const event = {
                name: eventName,
                data: eventData,
                timestamp: Date.now(),
                page: window.location.pathname,
                url: window.location.href
            };

            analyticsData.events.push(event);
            
            // Keep only the latest events
            if (analyticsData.events.length > CONFIG.MAX_EVENTS_PER_SESSION) {
                analyticsData.events = analyticsData.events.slice(-CONFIG.MAX_EVENTS_PER_SESSION);
            }

            // Save to session
            sessionManager.saveSession();
            
            // Log event (for debugging)
            if (window.console && console.log) {
                console.log('Analytics Event:', event);
            }
        }

        setupEventListeners() {
            // Track page visibility changes
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.trackEvent('page_hidden');
                } else {
                    this.trackEvent('page_visible');
                }
            });

            // Track scroll depth
            let maxScrollDepth = 0;
            window.addEventListener('scroll', () => {
                const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
                if (scrollPercent > maxScrollDepth) {
                    maxScrollDepth = scrollPercent;
                    analyticsData.scrollDepth = Math.max(analyticsData.scrollDepth, scrollPercent);
                    
                    // Track scroll milestones
                    CONFIG.SCROLL_THRESHOLDS.forEach(threshold => {
                        if (scrollPercent >= threshold && maxScrollDepth < threshold + 25) {
                            this.trackEvent('scroll_depth', { depth: threshold });
                        }
                    });
                }
            });

            // Track clicks on important elements
            document.addEventListener('click', (e) => {
                const target = e.target;
                
                // Track button clicks
                if (target.tagName === 'BUTTON' || target.tagName === 'A') {
                    this.trackEvent('element_clicked', {
                        element: target.tagName.toLowerCase(),
                        text: target.textContent?.trim().substring(0, 50),
                        className: target.className,
                        id: target.id
                    });
                }

                // Track form interactions
                if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                    this.trackEvent('form_interaction', {
                        element: target.tagName.toLowerCase(),
                        type: target.type || 'text',
                        name: target.name,
                        id: target.id
                    });
                }
            });

            // Track form submissions
            document.addEventListener('submit', (e) => {
                this.trackEvent('form_submitted', {
                    formId: e.target.id,
                    formAction: e.target.action,
                    formMethod: e.target.method
                });
            });

            // Track file uploads
            document.addEventListener('change', (e) => {
                if (e.target.type === 'file') {
                    this.trackEvent('file_selected', {
                        inputId: e.target.id,
                        inputName: e.target.name,
                        fileCount: e.target.files?.length || 0
                    });
                }
            });

            // Track page load performance
            window.addEventListener('load', () => {
                if (window.performance && window.performance.timing) {
                    const timing = window.performance.timing;
                    const loadTime = timing.loadEventEnd - timing.navigationStart;
                    
                    this.trackEvent('page_loaded', {
                        loadTime: loadTime,
                        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                        firstPaint: window.performance.getEntriesByType('paint')[0]?.startTime || 0
                    });
                }
            });

            // Track beforeunload
            window.addEventListener('beforeunload', () => {
                this.trackEvent('page_unload', {
                    timeOnPage: analyticsData.timeOnPage,
                    scrollDepth: analyticsData.scrollDepth
                });
            });
        }
    }

    // Page View Tracking
    class PageViewTracker {
        constructor() {
            this.trackPageView();
        }

        trackPageView() {
            const pageData = {
                title: document.title,
                url: window.location.href,
                path: window.location.pathname,
                search: window.location.search,
                hash: window.location.hash,
                referrer: document.referrer,
                timestamp: Date.now()
            };

            this.trackEvent('page_view', pageData);
        }

        trackEvent(eventName, eventData) {
            if (window.analytics && window.analytics.trackEvent) {
                window.analytics.trackEvent(eventName, eventData);
            }
        }
    }

    // Performance Monitoring
    class PerformanceMonitor {
        constructor() {
            this.monitorPerformance();
        }

        monitorPerformance() {
            // Monitor Core Web Vitals
            if ('PerformanceObserver' in window) {
                try {
                    // Largest Contentful Paint (LCP)
                    const lcpObserver = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        const lastEntry = entries[entries.length - 1];
                        this.trackEvent('lcp', { value: lastEntry.startTime });
                    });
                    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

                    // First Input Delay (FID)
                    const fidObserver = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        entries.forEach(entry => {
                            this.trackEvent('fid', { value: entry.processingStart - entry.startTime });
                        });
                    });
                    fidObserver.observe({ entryTypes: ['first-input'] });

                    // Cumulative Layout Shift (CLS)
                    let clsValue = 0;
                    const clsObserver = new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            if (!entry.hadRecentInput) {
                                clsValue += entry.value;
                            }
                        }
                        this.trackEvent('cls', { value: clsValue });
                    });
                    clsObserver.observe({ entryTypes: ['layout-shift'] });
                } catch (e) {
                    console.warn('Analytics: Performance monitoring not available');
                }
            }

            // Monitor resource loading
            if ('PerformanceObserver' in window) {
                try {
                    const resourceObserver = new PerformanceObserver((list) => {
                        list.getEntries().forEach(entry => {
                            if (entry.initiatorType === 'img' || entry.initiatorType === 'script' || entry.initiatorType === 'css') {
                                this.trackEvent('resource_loaded', {
                                    name: entry.name,
                                    type: entry.initiatorType,
                                    duration: entry.duration,
                                    size: entry.transferSize || 0
                                });
                            }
                        });
                    });
                    resourceObserver.observe({ entryTypes: ['resource'] });
                } catch (e) {
                    console.warn('Analytics: Resource monitoring not available');
                }
            }
        }

        trackEvent(eventName, eventData) {
            if (window.analytics && window.analytics.trackEvent) {
                window.analytics.trackEvent(eventName, eventData);
            }
        }
    }

    // Data Export and Management
    class DataManager {
        static exportData() {
            try {
                const data = localStorage.getItem(CONFIG.STORAGE_KEY);
                if (data) {
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `analytics_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } catch (e) {
                console.warn('Analytics: Could not export data');
            }
        }

        static clearData() {
            try {
                localStorage.removeItem(CONFIG.STORAGE_KEY);
                console.log('Analytics: Data cleared');
            } catch (e) {
                console.warn('Analytics: Could not clear data');
            }
        }

        static getStats() {
            try {
                const data = localStorage.getItem(CONFIG.STORAGE_KEY);
                if (data) {
                    const parsed = JSON.parse(data);
                    return {
                        sessionId: parsed.sessionId,
                        startTime: new Date(parsed.startTime),
                        lastActivity: new Date(parsed.lastActivity),
                        pageViews: parsed.pageViews,
                        eventsCount: parsed.events.length,
                        scrollDepth: parsed.scrollDepth,
                        timeOnPage: parsed.timeOnPage
                    };
                }
                return null;
            } catch (e) {
                console.warn('Analytics: Could not get stats');
                return null;
            }
        }
    }

    // Initialize Analytics
    let sessionManager, eventTracker, pageViewTracker, performanceMonitor;

    function initAnalytics() {
        try {
            sessionManager = new SessionManager();
            eventTracker = new EventTracker();
            pageViewTracker = new PageViewTracker();
            performanceMonitor = new PerformanceMonitor();

            // Make analytics globally available
            window.imgtojpgAnalytics = {
                trackEvent: (name, data) => eventTracker.trackEvent(name, data),
                exportData: DataManager.exportData,
                clearData: DataManager.clearData,
                getStats: DataManager.getStats,
                getData: () => analyticsData
            };

            console.log('imgtojpg.org Analytics initialized successfully');
        } catch (e) {
            console.error('Analytics initialization failed:', e);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAnalytics);
    } else {
        initAnalytics();
    }

    // Export for use in other scripts
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            WebsiteAnalytics: WebsiteAnalytics,
            SessionManager: SessionManager,
            EventTracker: EventTracker,
            DataManager: DataManager
        };
    }
})();
