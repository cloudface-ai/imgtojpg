// Lightweight speakable accessibility (opt-in) using Web Speech API
(function () {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return; // no TTS supported; fail quietly

  const STATE_KEY = 'speak_enabled';
  const RATE_KEY = 'speak_rate';
  const INIT_KEY = 'speak_initialized';

  function speak(text) {
    try {
      if (!getEnabled()) return;
      if (!text || !String(text).trim()) return;
      const utter = new SpeechSynthesisUtterance(String(text).trim());
      const rate = Number(localStorage.getItem(RATE_KEY) || '1');
      utter.rate = Math.min(1.4, Math.max(0.7, rate));
      synth.cancel();
      synth.speak(utter);
    } catch (_) {}
  }

  function getEnabled() {
    return localStorage.getItem(STATE_KEY) === '1';
  }
  function setEnabled(v) {
    localStorage.setItem(STATE_KEY, v ? '1' : '0');
  }

  function ensureStyles() {
    if (document.getElementById('speakable-style')) return;
    const style = document.createElement('style');
    style.id = 'speakable-style';
    style.textContent = `
      .speak-toggle{position:fixed;right:14px;bottom:14px;z-index:9999;background:#111827;color:#fff;border:none;border-radius:9999px;padding:10px 14px;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer}
      .speak-toggle.on{background:#2563eb}
      .speak-toggle:focus{outline:2px solid #93c5fd;outline-offset:2px}
      .speak-toolbar{position:fixed;right:14px;bottom:64px;z-index:9999;background:#111827;color:#fff;border-radius:10px;padding:8px 10px;display:none;gap:6px;align-items:center}
      .speak-toolbar.show{display:flex}
      .speak-toolbar input{width:100px}
      .speak-hint{position:fixed;right:14px;bottom:110px;z-index:9999;max-width:240px;background:#111827;color:#fff;padding:10px 12px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.25);font-size:13px;line-height:1.35}
      .speak-hint.hidden{display:none}
      .speak-hint b{color:#93c5fd}
      .speak-help{margin-left:8px;background:#374151;color:#fff;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px}
    `;
    document.head.appendChild(style);
  }

  function createUI() {
    ensureStyles();
    // First-run default: OFF
    if (!localStorage.getItem(INIT_KEY)) {
      localStorage.setItem(INIT_KEY, '1');
      localStorage.setItem(STATE_KEY, '0');
    }
    const btn = document.createElement('button');
    btn.className = 'speak-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', getEnabled() ? 'true' : 'false');
    btn.title = 'Toggle read out loud';
    btn.textContent = getEnabled() ? '🔊 Speak: On' : '🔇 Speak: Off';
    if (getEnabled()) btn.classList.add('on');

    const toolbar = document.createElement('div');
    toolbar.className = 'speak-toolbar';
    toolbar.innerHTML = `
      <label style="font-size:12px">Rate <input id="speak-rate" type="range" min="0.7" max="1.4" step="0.1"></label>
      <button type="button" class="speak-help" aria-label="About Speak">Help</button>
    `;
    document.body.appendChild(toolbar);

    const rateInput = toolbar.querySelector('#speak-rate');
    rateInput.value = String(localStorage.getItem(RATE_KEY) || '1');
    rateInput.addEventListener('input', () => {
      localStorage.setItem(RATE_KEY, rateInput.value);
      if (getEnabled()) speak('Speech rate updated');
    });

    const helpBtn = toolbar.querySelector('.speak-help');
    helpBtn.addEventListener('click', () => {
      const msg = 'Speak reads key updates aloud when enabled. Toggle with the blue button. Adjust speed with the slider.';
      alert(msg);
    });

    btn.addEventListener('click', () => {
      const next = !getEnabled();
      setEnabled(next);
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
      btn.textContent = next ? '🔊 Speak: On' : '🔇 Speak: Off';
      btn.classList.toggle('on', next);
      toolbar.classList.toggle('show', next);
      if (!next) {
        synth.cancel();
      }
    });

    // Show toolbar on focus for keyboard users
    btn.addEventListener('focus', () => {
      if (getEnabled()) toolbar.classList.add('show');
    });
    btn.addEventListener('blur', () => {
      setTimeout(() => toolbar.classList.remove('show'), 200);
    });

    document.body.appendChild(btn);

    // One-time subtle hint bubble
    if (!localStorage.getItem('speak_hint_shown')) {
      const hint = document.createElement('div');
      hint.className = 'speak-hint';
      hint.innerHTML = 'Need audio assistance? Toggle <b>Speak</b> to hear progress and completion.';
      document.body.appendChild(hint);
      setTimeout(() => { hint.classList.add('hidden'); localStorage.setItem('speak_hint_shown','1'); }, 5000);
    }
  }

  function observeDynamicUpdates() {
    // Status text announcements
    const statusEl = document.getElementById('statusText');
    if (statusEl) {
      const statusObserver = new MutationObserver(() => {
        if (!getEnabled()) return;
        const txt = statusEl.textContent || '';
        // avoid spamming very frequent changes
        if (txt.trim()) speak(txt.trim());
      });
      statusObserver.observe(statusEl, { childList: true, subtree: true, characterData: true });
    }

    // Progress announcements (every 10%)
    const bar = document.getElementById('progressBar');
    if (bar) {
      let lastBucket = -1;
      const barObserver = new MutationObserver(() => {
        if (!getEnabled()) return;
        const style = bar.style.width || '';
        const m = style.match(/(\d+)%/);
        if (m) {
          const pct = parseInt(m[1], 10);
          const bucket = Math.floor(pct / 10);
          if (bucket !== lastBucket) {
            lastBucket = bucket;
            speak(`Progress ${pct} percent`);
          }
        }
      });
      barObserver.observe(bar, { attributes: true, attributeFilter: ['style'] });
    }

    // Announce conversion completion if text present on page
    const results = document.getElementById('results');
    if (results) {
      const resultsObserver = new MutationObserver(() => {
        if (!getEnabled()) return;
        if (!results.classList.contains('hidden')) {
          speak('Conversion complete. Downloads are ready.');
        }
      });
      resultsObserver.observe(results, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function init() {
    createUI();
    observeDynamicUpdates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


