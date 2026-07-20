(function(){
  const btn = document.getElementById('mobileMenuButton');
  const menu = document.getElementById('mobileMenu');
  if(!btn || !menu) return;
  btn.setAttribute('aria-controls','mobileMenu');
  btn.setAttribute('aria-expanded','false');
  if(!btn.getAttribute('aria-label')) btn.setAttribute('aria-label','Toggle navigation menu');

  function onKeydown(e){ if(e.key === 'Escape'){ closeMenu(); btn.focus(); } }
  function openMenu(){
    menu.classList.remove('hidden');
    btn.setAttribute('aria-expanded','true');
    document.addEventListener('keydown', onKeydown);
  }
  function closeMenu(){
    menu.classList.add('hidden');
    btn.setAttribute('aria-expanded','false');
    document.removeEventListener('keydown', onKeydown);
  }

  btn.addEventListener('click', () => {
    if(menu.classList.contains('hidden')) openMenu(); else closeMenu();
  });

  document.addEventListener('click', (e) => {
    if(!menu.contains(e.target) && !btn.contains(e.target)) closeMenu();
  });
})();


