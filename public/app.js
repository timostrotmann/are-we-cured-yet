'use strict';
const header = document.querySelector('header');
const menuToggle = header.querySelector('.menu-toggle');
const navigation = document.getElementById('primary-navigation');
const mobileMenu = window.matchMedia('(max-width: 650px)');
const setMenuOpen = (open, returnFocus = false) => {
  header.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  if (returnFocus) menuToggle.focus();
};
header.classList.add('menu-ready');
menuToggle.hidden = false;
menuToggle.addEventListener('click', () => setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true'));
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenuOpen(false)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false, true);
  }
});
document.addEventListener('click', event => {
  if (!header.contains(event.target)) setMenuOpen(false);
});
document.addEventListener('focusin', event => {
  if (!header.contains(event.target)) setMenuOpen(false);
});
mobileMenu.addEventListener('change', () => setMenuOpen(false));
