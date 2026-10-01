// ============================================
// MÉRIDIEN — JS principal
// ============================================

/* ---------- 1. Loader ---------- */
window.addEventListener('load', () => {
  const loader = document.querySelector('.loader');
  setTimeout(() => loader.classList.add('hidden'), 1200);
});

/* ---------- 2. Smooth scroll (Lenis) ---------- */
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------- 3. GSAP ScrollTrigger ---------- */
gsap.registerPlugin(ScrollTrigger);

/* Apparitions au scroll */
const revealElements = document.querySelectorAll(
  '.section__eyebrow, .section__title, .section__text, .produit, .footer__quote'
);

revealElements.forEach((el) => {
  gsap.from(el, {
    opacity: 0,
    y: 40,
    duration: 1.1,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: el,
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
  });
});

/* Parallaxe sur le grain */
gsap.to('.hero__grain', {
  y: 150,
  ease: 'none',
  scrollTrigger: {
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 1,
  },
});

/* Le hero s'efface au scroll */
gsap.to('.hero__content', {
  opacity: 0,
  y: -80,
  ease: 'none',
  scrollTrigger: {
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 1,
  },
});

/* ---------- 4. Console ---------- */
console.log('%cMéridien ☕🌍', 'font-family: serif; font-size: 20px; color: #C9A227;');
