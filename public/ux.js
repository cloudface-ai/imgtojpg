(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Respect reduced motion preference globally
  (function injectReducedMotionCSS(){
    try{
      const style = document.createElement('style');
      style.setAttribute('data-reduced-motion','1');
      style.textContent = '@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}';
      document.head.appendChild(style);
    }catch(_){}
  })();

  // Toast UI
  function ensureToastContainer() {
    let c = document.getElementById('toast-container');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'toast-container';
    c.style.position = 'fixed';
    c.style.top = '14px';
    c.style.right = '14px';
    c.style.zIndex = '99999';
    c.style.display = 'flex';
    c.style.flexDirection = 'column';
    c.style.gap = '8px';
    document.body.appendChild(c);
    return c;
  }

  function iconFor(type) {
    if (type === 'success') return '✅';
    if (type === 'error') return '❌';
    if (type === 'info') return 'ℹ️';
    return '🔔';
  }

  function showToast(type, message, timeout = 3000) {
    try {
      const c = ensureToastContainer();
      const t = document.createElement('div');
      t.setAttribute('role', 'status');
      t.style.minWidth = '260px';
      t.style.maxWidth = '360px';
      t.style.background = type === 'error' ? '#991b1b' : (type === 'success' ? '#065f46' : '#111827');
      t.style.color = '#fff';
      t.style.borderRadius = '10px';
      t.style.boxShadow = '0 10px 20px rgba(0,0,0,.25)';
      t.style.padding = '10px 12px';
      t.style.fontSize = '14px';
      t.style.display = 'flex';
      t.style.alignItems = 'center';
      t.style.gap = '8px';
      t.innerHTML = `<span>${iconFor(type)}</span><div style="line-height:1.35">${message}</div>`;
      c.appendChild(t);
      setTimeout(() => {
        t.style.opacity = '0';
        t.style.transition = 'opacity .3s ease';
        setTimeout(() => t.remove(), 300);
      }, timeout);
    } catch (_) {}
  }

  // Expose globally
  window.showToast = showToast;
  window.notifyConversionDone = function(totalFiles){
    try{
      const msg = totalFiles ? `Conversion complete. ${totalFiles} file(s) ready.` : 'Conversion complete. Files are ready.';
      showToast('success', msg, 5000);
      if (window.speak && typeof window.speak === 'function') {
        try { window.speak('Conversion complete. Files are ready.'); } catch(_){}
      }
      if ('Notification' in window) {
        const fire = () => {
          try { new Notification('imgtojpg.org', { body: 'Your conversion is complete.', icon: '/favicon-32x32.png' }); } catch(_){}
        };
        if (Notification.permission === 'granted') fire();
        else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(p => { if (p === 'granted') fire(); });
        }
      }
    }catch(_){}
  };

  // Global error toasts (non-intrusive)
  window.addEventListener('error', (e) => {
    if (!e || !e.message) return;
    showToast('error', e.message.toString().slice(0, 180));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = (e && (e.reason?.message || e.reason)) || 'Unexpected error';
    showToast('error', String(msg).slice(0, 180));
  });

  // Keyboard shortcuts: u (upload), c (convert), d (download all)
  function isTypingTarget(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  function clickIfVisible(selector) {
    const el = document.querySelector(selector);
    if (el && el.offsetParent !== null) {
      el.click();
      return true;
    }
    return false;
  }

  document.addEventListener('keydown', (e) => {
    if (isTypingTarget(document.activeElement)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key?.toLowerCase();
    if (key === 'u') {
      // Upload: focus file input and open picker
      const finput = document.getElementById('fileInput');
      if (finput) {
        finput.click();
        showToast('info', 'Opening file picker…');
        e.preventDefault();
      }
    } else if (key === 'c') {
      // Convert: submit the first visible form with id=uploadForm
      const form = document.getElementById('uploadForm');
      if (form && form.offsetParent !== null) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
        showToast('info', 'Starting conversion…');
        e.preventDefault();
      }
    } else if (key === 'd') {
      // Download all if button visible
      if (clickIfVisible('#downloadAll')) {
        showToast('info', 'Preparing download…');
        e.preventDefault();
      }
    }
  });

  // Auto-detect completion on common UI patterns without changing existing logic
  (function watchForCompletion(){
    try{
      const results = document.getElementById('results');
      const convertStatus = document.getElementById('convertStatus');
      let notified = false;
      function maybeNotify(){
        if (notified) return;
        const resultsVisible = results && results.classList && !results.classList.contains('hidden');
        const statusDone = convertStatus && /done|complete|completed/i.test(convertStatus.textContent || '');
        if (resultsVisible || statusDone) {
          notified = true;
          const items = document.querySelectorAll('#imageContainer a[download]');
          window.notifyConversionDone(items && items.length ? items.length : undefined);
        }
      }
      const mo = new MutationObserver(maybeNotify);
      mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      window.addEventListener('conversion:complete', (ev)=>{
        notified = true;
        const count = ev && ev.detail && ev.detail.count;
        window.notifyConversionDone(count);
      });
    }catch(_){}
  })();

  // Beta badge and anonymous analytics opt-out
  (function betaBadge(){
    try{
      const badge = document.createElement('div');
      badge.style.position = 'fixed';
      badge.style.left = '14px';
      badge.style.bottom = '14px';
      badge.style.zIndex = '99997';
      badge.style.background = '#1f2937';
      badge.style.color = '#fff';
      badge.style.borderRadius = '10px';
      badge.style.fontSize = '12px';
      badge.style.padding = '6px 8px';
      badge.style.boxShadow = '0 6px 20px rgba(0,0,0,.25)';
      badge.innerHTML = '<b>Beta</b> · Anonymous usage helps improve the tool';
      const opt = document.createElement('button');
      opt.textContent = (localStorage.getItem('anon_optout') === '1') ? 'Enable analytics' : 'Disable analytics';
      opt.style.marginLeft = '8px';
      opt.style.background = '#374151';
      opt.style.color = '#fff';
      opt.style.border = 'none';
      opt.style.borderRadius = '8px';
      opt.style.padding = '4px 8px';
      opt.style.cursor = 'pointer';
      opt.addEventListener('click', ()=>{
        const curr = localStorage.getItem('anon_optout') === '1';
        localStorage.setItem('anon_optout', curr ? '0' : '1');
        opt.textContent = curr ? 'Disable analytics' : 'Enable analytics';
        showToast('info', curr ? 'Anonymous analytics enabled.' : 'Anonymous analytics disabled.');
      });
      badge.appendChild(opt);
      document.body.appendChild(badge);
    }catch(_){}
  })();

  // Frontend telemetry hooks (no PII)
  (function telemetry(){
    function allowed(){ return localStorage.getItem('anon_optout') !== '1'; }
    function device(){ return window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop'; }
    function lang(){ return (navigator.language||'en').toLowerCase(); }
    function tz(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'; }catch(_){ return 'unknown'; } }
    function ga(name, params){ try{ if (!allowed()) return; if (window.gtag) gtag('event', name, params||{}); }catch(_){} }
    function et(cat, act, params){ try{ if (!allowed()) return; if (window.EventTracker && EventTracker.trackEvent) EventTracker.trackEvent(cat, act, params); }catch(_){} }

    // Hook into form submit start
    const form = document.getElementById('uploadForm');
    if (form){
      form.addEventListener('submit', function(){
        try{
          const files = (document.getElementById('fileInput')||{}).files || [];
          const count = files.length || 0;
          const exts = Array.from(files).slice(0,10).map(f=> (f.name.split('.').pop()||'').toLowerCase());
          const outSel = document.getElementById('outputFormat');
          const out = outSel ? String(outSel.value||'jpg').toLowerCase() : 'jpg';
          ga('conversion_start', { file_count: count, in_exts: exts.join(','), out_fmt: out, device: device(), lang: lang(), tz: tz() });
          et('conversion','start',{ file_count: count, out_fmt: out });
        }catch(_){}
      }, { capture: true });
    }

    // Hook into completion from earlier watcher
    window.addEventListener('conversion:complete', (ev)=>{
      try{
        const detail = ev && ev.detail || {};
        ga('conversion_done', { file_count: detail.count||0, device: device(), lang: lang(), tz: tz() });
        et('conversion','done',{ file_count: detail.count||0 });
      }catch(_){}
    });
  })();

  // Small “Beta” badge next to brand name
  (function headerBetaBadge(){
    try{
      const candidates = Array.from(document.querySelectorAll('a, div, span'))
        .filter(el => /imgtojpg\.org/i.test(el.textContent || ''));
      if (!candidates.length) return;
      const brand = candidates[0];
      if (brand.querySelector('.beta-pill')) return;
      const pill = document.createElement('sup');
      pill.className = 'beta-pill';
      pill.setAttribute('aria-label', 'Beta');
      pill.style.marginLeft = '6px';
      pill.style.background = '#ef4444';
      pill.style.color = '#fff';
      pill.style.borderRadius = '9999px';
      pill.style.padding = '1px 6px';
      pill.style.fontSize = '10px';
      pill.style.verticalAlign = 'top';
      pill.textContent = 'Beta';
      brand.appendChild(pill);
    }catch(_){}
  })();
})();


