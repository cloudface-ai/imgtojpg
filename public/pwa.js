(function(){
  if (!('serviceWorker' in navigator)) return;

  // Register service worker
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });

  // Install prompt UI
  let deferredPrompt = null;
  const LS_LAST = 'pwa_cta_last';
  const LS_INSTALLED = 'pwa_installed';
  const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Mark installed to avoid future prompts
  window.addEventListener('appinstalled', () => {
    try { localStorage.setItem(LS_INSTALLED, '1'); } catch(_){}
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    try {
      if (window.gtag) gtag('event', 'pwa_beforeinstallprompt');
      if (window.EventTracker && EventTracker.trackEvent) EventTracker.trackEvent('pwa', 'beforeinstallprompt');
    } catch(_){}
    // Skip if already installed or recently shown
    try {
      const isStandalone = window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches);
      const isiOSStandalone = window.navigator.standalone === true;
      const installed = localStorage.getItem(LS_INSTALLED) === '1';
      const last = Number(localStorage.getItem(LS_LAST) || '0');
      const now = Date.now();
      if (installed || isStandalone || isiOSStandalone) return;
      if (last && (now - last) < COOLDOWN_MS) return;
    } catch(_){}
    showInstallCTA();
  });

  function showInstallCTA(){
    try{
      if (document.getElementById('pwa-install-cta')) return;
      try { localStorage.setItem(LS_LAST, String(Date.now())); } catch(_){}
      const cta = document.createElement('div');
      cta.id = 'pwa-install-cta';
      cta.style.position = 'fixed';
      cta.style.bottom = '16px';
      cta.style.left = '50%';
      cta.style.transform = 'translateX(-50%)';
      cta.style.zIndex = '99998';
      cta.style.background = '#111827';
      cta.style.color = '#fff';
      cta.style.borderRadius = '10px';
      cta.style.boxShadow = '0 10px 20px rgba(0,0,0,.25)';
      cta.style.padding = '8px 10px';
      cta.style.fontSize = '13px';
      cta.style.display = 'flex';
      cta.style.alignItems = 'center';
      cta.style.gap = '8px';
      cta.innerHTML = '<span>📲</span><div>Install imgtojpg as an app?</div>';
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.marginLeft = '8px';
      const btnInstall = document.createElement('button');
      btnInstall.textContent = 'Install';
      btnInstall.style.background = '#2563eb';
      btnInstall.style.color = '#fff';
      btnInstall.style.border = 'none';
      btnInstall.style.borderRadius = '8px';
      btnInstall.style.padding = '6px 10px';
      btnInstall.style.cursor = 'pointer';
      const btnClose = document.createElement('button');
      btnClose.textContent = 'Not now';
      btnClose.style.background = '#374151';
      btnClose.style.color = '#fff';
      btnClose.style.border = 'none';
      btnClose.style.borderRadius = '8px';
      btnClose.style.padding = '6px 10px';
      btnClose.style.cursor = 'pointer';
      actions.appendChild(btnInstall);
      actions.appendChild(btnClose);
      cta.appendChild(actions);
      document.body.appendChild(cta);

      // Mobile-friendly sizing
      const small = Math.min(window.innerWidth, window.innerHeight) < 420;
      if (small) {
        cta.style.fontSize = '12px';
        btnInstall.style.padding = '5px 8px';
        btnClose.style.padding = '5px 8px';
        cta.style.padding = '8px 9px';
      }

      btnInstall.addEventListener('click', async ()=>{
        if (!deferredPrompt) return cleanup();
        try {
          if (window.gtag) gtag('event', 'pwa_install_click');
          if (window.EventTracker && EventTracker.trackEvent) EventTracker.trackEvent('pwa', 'install_click');
        } catch(_){}
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        cleanup();
        if (window.showToast) window.showToast('success', outcome === 'accepted' ? 'App install started.' : 'Install dismissed.');
        try {
          if (window.gtag) gtag('event', 'pwa_install_choice', { outcome });
          if (window.EventTracker && EventTracker.trackEvent) EventTracker.trackEvent('pwa', 'install_choice_' + outcome);
        } catch(_){}
        if (outcome !== 'accepted') {
          // set cooldown so we don't nag repeatedly
          try { localStorage.setItem(LS_LAST, String(Date.now())); } catch(_){}
        }
      });
      btnClose.addEventListener('click', cleanup);

      function cleanup(){
        const el = document.getElementById('pwa-install-cta');
        if (el) el.remove();
      }
    }catch(_){/* ignore */}
  }
})();


