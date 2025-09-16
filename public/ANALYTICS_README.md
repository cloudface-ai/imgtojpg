# imgtojpg.org Analytics Tool

A lightweight, privacy-focused website analytics solution built specifically for imgtojpg.org.

## 🚀 Features

- **Real-time Analytics Dashboard** - Beautiful, responsive dashboard with live updates
- **Privacy-First** - All data stored locally, no external tracking
- **Performance Monitoring** - Track Core Web Vitals (LCP, FID, CLS)
- **User Behavior Tracking** - Page views, scroll depth, time on page, interactions
- **Session Management** - Smart session handling with timeout detection
- **Data Export** - Export analytics data as JSON for external analysis
- **Zero Configuration** - Works out of the box without changing existing code

## 📁 Files Created

1. **`analytics.html`** - Main analytics dashboard
2. **`analytics-tracker.js`** - JavaScript tracking script
3. **`ANALYTICS_README.md`** - This documentation

## 🔧 Integration (No Code Changes Required)

### Option 1: Add to Existing Pages (Recommended)

Simply add this single line to the `<head>` section of any page you want to track:

```html
<script src="/analytics-tracker.js"></script>
```

**Example:**
```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Page Title</title>
    
    <!-- Add this line to enable analytics -->
    <script src="/analytics-tracker.js"></script>
    
    <!-- Your existing CSS and other scripts -->
    <link rel="stylesheet" href="style.css">
</head>
```

### Option 2: Add to All Pages at Once

Add the script to your main layout file or server-side template to automatically track all pages.

## 📊 What Gets Tracked Automatically

- **Page Views** - Every page load and navigation
- **Session Data** - Session start/resume, duration, timeout
- **User Behavior** - Clicks, form interactions, file uploads
- **Performance** - Page load times, Core Web Vitals
- **Engagement** - Scroll depth, time on page, visibility changes
- **Technical Data** - Screen resolution, language, timezone

## 🎯 Custom Event Tracking

You can track custom events from anywhere in your code:

```javascript
// Track a custom event
window.imgtojpgAnalytics.trackEvent('conversion_completed', {
    format: 'jpg',
    fileSize: '2.5MB',
    processingTime: '1.2s'
});

// Track user actions
window.imgtojpgAnalytics.trackEvent('button_clicked', {
    button: 'download_all',
    page: 'converter'
});
```

## 📈 Viewing Analytics

1. **Navigate to** `/analytics.html` on your website
2. **View real-time data** including:
   - Total visitors and page views
   - Bounce rate and session duration
   - Traffic overview charts
   - Top performing pages
   - Performance metrics

## 🔍 Data Storage

- **Local Storage** - All data stored in user's browser
- **Privacy** - No data sent to external servers
- **Persistence** - Data survives browser sessions
- **Export** - Users can export their own data

## 🛠️ Advanced Usage

### Get Current Stats

```javascript
const stats = window.imgtojpgAnalytics.getStats();
console.log('Current session:', stats);
```

### Export Data

```javascript
// Export current analytics data as JSON file
window.imgtojpgAnalytics.exportData();
```

### Clear Data

```javascript
// Clear all stored analytics data
window.imgtojpgAnalytics.clearData();
```

## 📱 Mobile Responsive

The analytics dashboard is fully responsive and works on all devices:
- Mobile phones
- Tablets
- Desktop computers
- All modern browsers

## 🔒 Privacy & Compliance

- **GDPR Compliant** - No personal data collected
- **No Cookies** - Uses localStorage only
- **User Control** - Users can export/delete their data
- **Transparent** - All tracking is visible in browser console

## 🚀 Performance Impact

- **Lightweight** - Minimal impact on page load
- **Async Loading** - Non-blocking script execution
- **Efficient** - Optimized event handling
- **Background** - Runs in background without user interaction

## 🎨 Customization

The analytics tool uses CSS variables and can be easily customized:

```css
:root {
    --analytics-primary: #667eea;
    --analytics-secondary: #764ba2;
    --analytics-success: #28a745;
    --analytics-warning: #ffc107;
    --analytics-danger: #dc3545;
}
```

## 📋 Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### Analytics Not Working?

1. Check browser console for errors
2. Verify script is loaded correctly
3. Check if localStorage is enabled
4. Ensure JavaScript is enabled

### Data Not Persisting?

1. Check browser privacy settings
2. Verify localStorage is not blocked
3. Check if browser is in incognito mode

### Performance Issues?

1. Check for JavaScript errors
2. Verify script loading order
3. Check browser performance tools

## 🔄 Updates & Maintenance

- **Automatic Updates** - Analytics data updates in real-time
- **Session Management** - Automatic cleanup of old sessions
- **Event Limiting** - Prevents memory issues with large datasets
- **Error Handling** - Graceful fallbacks for unsupported features

## 📞 Support

For questions or issues with the analytics tool:
1. Check browser console for error messages
2. Verify script integration
3. Test in different browsers
4. Check localStorage permissions

## 🎉 Getting Started

1. **Add the script** to your pages
2. **Visit** `/analytics.html` to see the dashboard
3. **Start tracking** user behavior automatically
4. **Customize** tracking as needed
5. **Export data** for external analysis

---

**Built with ❤️ for imgtojpg.org**
*No external dependencies, no tracking codes, just pure analytics power!*
