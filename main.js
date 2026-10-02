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
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const key = new THREE.DirectionalLight(0xfff2d6, 1.8);
key.position.set(3, 4, 3); scene.add(key);
const gold = new THREE.PointLight(0xC9A227, 8, 14);
gold.position.set(-2, 1, 3); scene.add(gold);
const rim = new THREE.PointLight(0x8B5E3C, 5, 14);
rim.position.set(2, -1, -3); scene.add(rim);

/* ---------- Texture de bruit réaliste (fBm multi-octaves) ---------- */
function fbmTexture(size = 512){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const hash = (x, y) => {
    let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const cc = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + cc * (1 - u) * v + d * u * v;
  };
  const fbm = (x, y) => {
    let v = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < 5; i++){
      v += amp * noise(x * freq, y * freq);
      freq *= 2; amp *= 0.5;
    }
    return v;
  };

  for (let y = 0; y < size; y++){
    for (let x = 0; x < size; x++){
      let n = fbm(x / 40, y / 40);
      const vein = Math.sin((x / size) * Math.PI * 10 + fbm(x / 30, y / 30) * 8) * 0.5 + 0.5;
      n = n * 0.65 + vein * 0.35;
      const v = Math.floor(n * 255);
      const i = (y * size + x) * 4;
      data[i] = data[i+1] = data[i+2] = v;
      data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.anisotropy = 8;
  return tex;
}

/* ---------- Grain de café réaliste ---------- */
function createBean(){
  const geo = new THREE.SphereGeometry(1, 200, 200);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++){
    v.fromBufferAttribute(pos, i);

    // Forme : ellipsoïde
    v.x *= 0.75;
    v.y *= 0.85;
    v.z *= 1.32;

    // Rainure centrale sur +X
    if (v.x > 0){
      const creaseY = Math.exp(-Math.pow(v.y / 0.16, 2));
      const creaseZ = Math.exp(-Math.pow(v.z / 1.0, 4));
      v.x -= creaseY * creaseZ * 0.45;
    }

    // Méplat sous le grain
    v.x -= Math.exp(-Math.pow(v.x / 0.5, 2)) * 0.05 * Math.sign(v.x);

    // Micro-reliefs
    v.x += Math.sin(v.z * 8 + v.x * 3) * 0.02;
    v.y += Math.cos(v.y * 7 + v.z * 2) * 0.018;
    v.z += Math.sin(v.x * 12 + v.y * 5) * 0.012;

    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const bump = fbmTexture(512);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x7a4a24,
    roughness: 0.62,
    metalness: 0.05,
    clearcoat: 0.5,
    clearcoatRoughness: 0.55,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xC9A227),
    sheenRoughness: 0.8,
    bumpMap: bump,
    bumpScale: 0.2,
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

/* ---------- NARRATION AU SCROLL (zigzag) ---------- */
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
  }
});

tl
  // Hero → Origine : grain descend à DROITE
  .to(beanGroup.rotation, { y: Math.PI * 2, x: 0.4, ease: 'none' }, 0)
  .to(beanGroup.position, { x: 2.2, y: -1.2, z: 0.5, ease: 'none' }, 0)
  .to(beanGroup.scale, { x: 0.85, y: 0.85, z: 0.85, ease: 'none' }, 0)

  // Origine → Voyage : remonte à GAUCHE + torréfaction
  .to(beanGroup.rotation, { y: Math.PI * 4, x: -0.5, ease: 'none' }, 1)
  .to(beanGroup.position, { x: -2.3, y: 1.4, z: 0.2, ease: 'none' }, 1)
  .to(bean.material.color, { r: 0.45, g: 0.25, b: 0.12, ease: 'none' }, 1)
  .to(bean.material, { roughness: 0.48, ease: 'none' }, 1)
  .to(beanGroup.scale, { x: 1.0, y: 1.0, z: 1.0, ease: 'none' }, 1)

  // Voyage → Produits : descend à DROITE + brun foncé
  .to(beanGroup.rotation, { y: Math.PI * 6, x: 0.2, ease: 'none' }, 2)
  .to(beanGroup.position, { x: 2.0, y: -1.8, z: -0.6, ease: 'none' }, 2)
  .to(bean.material.color, { r: 0.28, g: 0.15, b: 0.08, ease: 'none' }, 2)
  .to(beanGroup.scale, { x: 0.6, y: 0.6, z: 0.6, ease: 'none' }, 2)

  // Produits → Footer : disparition en poussière
  .to(beanGroup.scale, { x: 0.001, y: 0.001, z: 0.001, ease: 'power2.in' }, 3)
  .to(beanGroup.rotation, { y: Math.PI * 10, ease: 'none' }, 3)
  .to(beanGroup.position, { y: -3, x: 0, ease: 'power1.in' }, 3)
  .to(particles.material, { size: 0.02, opacity: 0.15, ease: 'none' }, 3);

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

  beanGroup.rotation.y += 0.0025;

  particles.rotation.y = t * 0.05;
  particles.rotation.x = Math.sin(t * 0.3) * 0.05;

  gold.position.x = Math.cos(t * 0.6) * 3 + beanGroup.position.x;
  gold.position.z = Math.sin(t * 0.6) * 3;

  camera.position.x += (mouse.x * 0.35 - camera.position.x) * 0.05;
  camera.position.y += (mouse.y * 0.25 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

console.log('%cMéridien ☕🌍', 'font-family: serif; font-size: 20px; color: #C9A227;');
