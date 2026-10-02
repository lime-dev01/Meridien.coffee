// ============================================
// MÉRIDIEN — Three.js + GSAP
// ============================================

import * as THREE from 'three';

/* ---------- Loader ---------- */
const loaderEl = document.querySelector('.loader');
setTimeout(() => loaderEl.classList.add('hidden'), 1500);

/* ---------- Lenis ---------- */
const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
function raf(t){ lenis.raf(t); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
gsap.registerPlugin(ScrollTrigger);

/* ---------- Reveal ---------- */
document.querySelectorAll('.section__eyebrow, .section__title, .section__text, .produit, .footer__quote').forEach(el => {
  gsap.from(el, { opacity: 0, y: 40, duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 85%' } });
});
gsap.to('.hero__content', { opacity: 0, y: -80, ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });

/* ---------- Scene ---------- */
const canvas = document.querySelector('#webgl');
const scene = new THREE.Scene();
const sizes = { w: innerWidth, h: innerHeight };
const camera = new THREE.PerspectiveCamera(45, sizes.w / sizes.h, 0.1, 100);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(sizes.w, sizes.h);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

/* ---------- Lights ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const key = new THREE.DirectionalLight(0xfff2d6, 1.6);
key.position.set(3, 4, 3); scene.add(key);
const gold = new THREE.PointLight(0xC9A227, 6, 14);
gold.position.set(-2, 1, 3); scene.add(gold);
const rim = new THREE.PointLight(0x8B5E3C, 4, 14);
rim.position.set(2, -1, -3); scene.add(rim);

/* ---------- Texture de bruit pour bump ---------- */
function noiseTexture(size = 512){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4){
    const n = 90 + Math.random() * 90;
    img.data[i] = img.data[i+1] = img.data[i+2] = n;
    img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/* ---------- Grain de café réaliste ---------- */
function createBean(){
  const geo = new THREE.SphereGeometry(1, 160, 160);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++){
    v.fromBufferAttribute(pos, i);

    // forme : ellipsoïde aplati
    v.x *= 0.78;   // largeur
    v.y *= 0.88;   // épaisseur
    v.z *= 1.30;   // longueur

    // CREUX central sur la face +X (la rainure du grain)
    if (v.x > 0){
      const creaseY = Math.exp(-Math.pow(v.y / 0.18, 2));
      const creaseZ = Math.exp(-Math.pow(v.z / 1.05, 4));
      v.x -= creaseY * creaseZ * 0.38;
    }

    // irrégularités organiques (bosse légère)
    v.x += Math.sin(v.z * 5) * 0.014;
    v.y += Math.cos(v.z * 6) * 0.012;
    v.z += Math.sin(v.x * 4) * 0.01;

    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x8a5a2b,
    roughness: 0.58,
    metalness: 0.08,
    clearcoat: 0.35,
    clearcoatRoughness: 0.6,
    bumpMap: noiseTexture(),
    bumpScale: 0.04,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xC9A227),
  });

  return new THREE.Mesh(geo, mat);
}

const beanGroup = new THREE.Group();
const bean = createBean();
beanGroup.add(bean);
beanGroup.position.set(1.4, 0, 0);
scene.add(beanGroup);

/* ---------- Particules dorées ---------- */
const pCount = 500;
const pPos = new Float32Array(pCount * 3);
for (let i = 0; i < pCount * 3; i += 3){
  pPos[i]   = (Math.random() - 0.5) * 16;
  pPos[i+1] = (Math.random() - 0.5) * 10;
  pPos[i+2] = (Math.random() - 0.5) * 10;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));

function dotTex(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.5, 'rgba(201,162,39,0.6)');
  g.addColorStop(1, 'rgba(201,162,39,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.07, map: dotTex(), transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, color: 0xC9A227,
}));
scene.add(particles);

/* ---------- NARRATION AU SCROLL ---------- */
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
  }
});

tl
  // ==== Phase 1 : Hero → Origine (grain cru, tourne, va à droite) ====
  .to(beanGroup.rotation, { y: Math.PI * 2, x: 0.25, ease: 'none', duration: 1 }, 0)
  .to(beanGroup.position, { x: 1.7, y: 0.1, z: 0, ease: 'none', duration: 1 }, 0)
  // couleur : cru (légèrement verdâtre) → doré

  // ==== Phase 2 : Origine → Voyage (torréfaction) ====
  .to(beanGroup.rotation, { y: Math.PI * 4, x: -0.25, ease: 'none', duration: 1 }, 1)
  .to(beanGroup.position, { x: -1.7, y: -0.1, z: 0.4, ease: 'none', duration: 1 }, 1)
  .to(bean.material.color, { r: 0.42, g: 0.24, b: 0.12, ease: 'none', duration: 1 }, 1)
  .to(bean.material, { roughness: 0.42, ease: 'none', duration: 1 }, 1)

  // ==== Phase 3 : Voyage → Produits (brun foncé, rétrécit) ====
  .to(beanGroup.rotation, { y: Math.PI * 6, x: 0.1, ease: 'none', duration: 1 }, 2)
  .to(beanGroup.position, { x: 1.5, y: 0, z: -0.8, ease: 'none', duration: 1 }, 2)
  .to(beanGroup.scale, { x: 0.55, y: 0.55, z: 0.55, ease: 'none', duration: 1 }, 2)
  .to(bean.material.color, { r: 0.28, g: 0.15, b: 0.08, ease: 'none', duration: 1 }, 2)

  // ==== Phase 4 : Produits → Footer (disparition en poussière) ====
  .to(beanGroup.scale, { x: 0.001, y: 0.001, z: 0.001, ease: 'power2.in', duration: 1 }, 3)
  .to(beanGroup.rotation, { y: Math.PI * 10, ease: 'none', duration: 1 }, 3)
  .to(particles.material, { size: 0.02, opacity: 0.2, ease: 'none', duration: 1 }, 3);

/* ---------- Souris (parallaxe) ---------- */
const mouse = { x: 0, y: 0 };
addEventListener('mousemove', e => {
  mouse.x = (e.clientX / sizes.w) * 2 - 1;
  mouse.y = -((e.clientY / sizes.h) * 2 - 1);
});

/* ---------- Resize ---------- */
addEventListener('resize', () => {
  sizes.w = innerWidth; sizes.h = innerHeight;
  camera.aspect = sizes.w / sizes.h;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.w, sizes.h);
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
function tick(){
  const t = clock.getElapsedTime();

  // rotation continue auto
  beanGroup.rotation.y += 0.0025;

  // particules tournent doucement + pulse
  particles.rotation.y = t * 0.05;
  particles.rotation.x = Math.sin(t * 0.3) * 0.05;

  // lumière dorée orbite autour du grain
  gold.position.x = Math.cos(t * 0.6) * 3 + beanGroup.position.x;
  gold.position.z = Math.sin(t * 0.6) * 3;

  // caméra parallaxe souris
  camera.position.x += (mouse.x * 0.35 - camera.position.x) * 0.05;
  camera.position.y += (mouse.y * 0.25 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

console.log('%cMéridien ☕🌍', 'font-family: serif; font-size: 20px; color: #C9A227;');
