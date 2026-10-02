// ============================================
// MÉRIDIEN — JS principal (Three.js + GSAP)
// ============================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---------- 1. Loader ---------- */
const loader = document.querySelector('.loader');
const hideLoader = () => setTimeout(() => loader.classList.add('hidden'), 800);

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

const revealElements = document.querySelectorAll(
  '.section__eyebrow, .section__title, .section__text, .produit, .footer__quote'
);
revealElements.forEach((el) => {
  gsap.from(el, {
    opacity: 0,
    y: 40,
    duration: 1.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 85%' },
  });
});

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

/* ---------- 4. Scène Three.js ---------- */
const canvas = document.querySelector('#webgl');
const scene = new THREE.Scene();

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 100);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

/* ---------- 5. Lumières ---------- */
const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xfff2d6, 1.4);
keyLight.position.set(3, 4, 3);
scene.add(keyLight);

const goldLight = new THREE.PointLight(0xC9A227, 4, 10);
goldLight.position.set(-2, 1, 2);
scene.add(goldLight);

const rimLight = new THREE.PointLight(0x8B5E3C, 3, 10);
rimLight.position.set(2, -1, -2);
scene.add(rimLight);

/* ---------- 6. Groupe du grain (rotation globale) ---------- */
const beanGroup = new THREE.Group();
beanGroup.position.x = 1.3;
scene.add(beanGroup);

/* Fallback : grain procédural au cas où le GLB ne charge pas */
function createFallbackBean() {
  const geo = new THREE.SphereGeometry(1, 64, 64);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // aplatir légèrement + rainure centrale
    v.y *= 0.7;
    v.z *= 1.1;
    const crease = Math.exp(-Math.pow(v.x * 4, 2));
    v.z -= crease * 0.25;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6b3a1f,
    roughness: 0.55,
    metalness: 0.15,
  });
  return new THREE.Mesh(geo, mat);
}

/* Chargement du modèle GLB */
const gltfLoader = new GLTFLoader();
gltfLoader.load(
  'assets/models/grain.glb',
  (gltf) => {
    const model = gltf.scene;
    // auto-scale pour tenir dans la scène
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    model.scale.setScalar(scale);

    // recentrer
    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    beanGroup.add(model);
    hideLoader();
  },
  undefined,
  (err) => {
    console.warn('GLB introuvable, fallback procédural :', err);
    beanGroup.add(createFallbackBean());
    hideLoader();
  }
);

/* ---------- 7. Particules dorées ---------- */
const particlesCount = 250;
const positions = new Float32Array(particlesCount * 3);
for (let i = 0; i < particlesCount * 3; i += 3) {
  positions[i]     = (Math.random() - 0.5) * 12;
  positions[i + 1] = (Math.random() - 0.5) * 8;
  positions[i + 2] = (Math.random() - 0.5) * 8;
}
const particlesGeo = new THREE.BufferGeometry();
particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

// texture ronde pour les points
function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.4, 'rgba(201,162,39,0.8)');
  g.addColorStop(1, 'rgba(201,162,39,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const particlesMat = new THREE.PointsMaterial({
  size: 0.08,
  map: makeDotTexture(),
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  color: 0xC9A227,
});
const particles = new THREE.Points(particlesGeo, particlesMat);
scene.add(particles);

/* ---------- 8. Scroll : rotation + déplacement du grain ---------- */
gsap.to(beanGroup.rotation, {
  y: Math.PI * 2,
  ease: 'none',
  scrollTrigger: {
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 1,
  },
});
gsap.to(beanGroup.position, {
  x: 0,
  z: -3,
  ease: 'none',
  scrollTrigger: {
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 1,
  },
});

/* ---------- 9. Souris : parallaxe légère ---------- */
const mouse = { x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / sizes.width) * 2 - 1;
  mouse.y = -((e.clientY / sizes.height) * 2 - 1);
});

/* ---------- 10. Resize ---------- */
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
});

/* ---------- 11. Animation loop ---------- */
const clock = new THREE.Clock();

function tick() {
  const t = clock.getElapsedTime();

  // rotation douce auto du grain
  beanGroup.rotation.y += 0.003;
  beanGroup.rotation.x = Math.sin(t * 0.5) * 0.1;

  // particules qui flottent
  particles.rotation.y = t * 0.05;

  // lumière dorée qui orbite
  goldLight.position.x = Math.cos(t * 0.6) * 3;
  goldLight.position.z = Math.sin(t * 0.6) * 3;

  // parallaxe caméra à la souris
  camera.position.x += (mouse.x * 0.4 - camera.position.x) * 0.05;
  camera.position.y += (mouse.y * 0.3 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

/* ---------- 12. Console ---------- */
console.log('%cMéridien ☕🌍', 'font-family: serif; font-size: 20px; color: #C9A227;');
