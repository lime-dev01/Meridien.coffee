// ============================================
// MÉRIDIEN — JS principal
// ============================================

// Loader : disparaît après chargement
window.addEventListener('load', () => {
  const loader = document.querySelector('.loader');
  setTimeout(() => loader.classList.add('hidden'), 1200);
});

// Console : petit message de bienvenue
console.log('%cMéridien ☕🌍', 'font-family: serif; font-size: 20px; color: #C9A227;');
