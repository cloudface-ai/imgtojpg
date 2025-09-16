(function(){
  if (typeof window === 'undefined') return;
  const LANG_KEY = 'lang'
  const supported = ['en'];
  const store = {};

  function getLang(){
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && supported.includes(saved)) return saved;
    return 'en';
  }

  async function load(lang){
    try{
      if (store[lang]) return store[lang];
      const res = await fetch('/locales/' + lang + '.json', { cache: 'no-store' });
      if (!res.ok) return (store[lang] = {});
      const json = await res.json();
      return (store[lang] = json || {});
    }catch(_){ return (store[lang] = {}); }
  }

  function apply(dict){
    try{
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && dict[key]) el.textContent = dict[key];
      });
    }catch(_){}
  }

  async function init(){
    const lang = getLang();
    const dict = await load(lang);
    apply(dict);
  }

  window.i18n = { set(lang){ if (supported.includes(lang)){ localStorage.setItem(LANG_KEY, lang); init(); } } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();


