// ============================================
// MÉRIDIEN — Three.js + GSAP
// Morphing grain → globe + interactions
// Fix points noirs : suppression atmosphère additive + halos opaques
// ============================================

import * as THREE from 'three';

const isMobile = window.matchMedia('(max-width: 768px)').matches
              || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const PERF = {
  beanSegments:   isMobile ? 96  : 180,
  earthSegments:  isMobile ? 48  : 64,
  fbmSize:        isMobile ? 256 : 512,
  particleCount:  isMobile ? 180 : 500,
  pixelRatio:     isMobile ? 1.5 : Math.min(devicePixelRatio, 2),
};

const START = isMobile
  ? { beanX: 0.9, beanY: 0.8, beanZ: 0, fov: 52, camZ: 5.5 }
  : { beanX: 1.6, beanY: 0.2, beanZ: 0, fov: 45, camZ: 5   };

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

const camera = new THREE.PerspectiveCamera(START.fov, sizes.w / sizes.h, 0.1, 100);
const cameraBase = { x: 0, y: 0, z: START.camZ };
const cameraParallax = { x: 0, y: 0 };
const lookAtTarget = new THREE.Vector3(0, 0, 0);

camera.position.set(cameraBase.x, cameraBase.y, cameraBase.z);
camera.lookAt(lookAtTarget);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true });
renderer.setSize(sizes.w, sizes.h);
renderer.setPixelRatio(PERF.pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

/* ---------- Lights ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
scene.add(new THREE.HemisphereLight(0xFFF2D6, 0x3a2416, 0.7));
const key = new THREE.DirectionalLight(0xfff2d6, 1.2);
key.position.set(3, 4, 3); scene.add(key);
const fill = new THREE.DirectionalLight(0xF2E9DC, 0.7);
fill.position.set(0, 1, 5); scene.add(fill);
const gold = new THREE.PointLight(0xC9A227, 4, 14);
gold.position.set(-2, 1, 3); scene.add(gold);
const rim = new THREE.PointLight(0xFFE5B0, 2, 12);
rim.position.set(3, 2, -2); scene.add(rim);

/* ---------- State ---------- */
const state = {
  beanOpacity: 1,
  globeVisible: false,
  morph: 0,
  flash: 0,
};

/* ============================================
   TEXTURES
   ============================================ */
function fbmTexture(size = PERF.fbmSize){
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
    const a = hash(xi, yi), b = hash(xi + 1, yi);
    const cc = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + cc * (1 - u) * v + d * u * v;
  };
  const fbm = (x, y, octaves = 6) => {
    let v = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++){ v += amp * noise(x*freq, y*freq); freq *= 2; amp *= 0.5; }
    return v;
  };

  for (let y = 0; y < size; y++){
    for (let x = 0; x < size; x++){
      let n = fbm(x / 25, y / 25, 6);
      const micro = fbm(x / 3, y / 3, 3) * 0.15;
      n = n * 0.75 + micro * 0.25;
      const vein = Math.sin((x / size) * Math.PI * 14 + fbm(x / 20, y / 20, 4) * 10) * 0.5 + 0.5;
      n = n * 0.82 + vein * 0.18;
      const v = Math.floor(n * 255);
      const i = (y * size + x) * 4;
      data[i] = data[i+1] = data[i+2] = v;
      data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 5);
  tex.anisotropy = 8;
  return tex;
}

function roughnessTexture(size = 512){
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
    const a = hash(xi, yi), b = hash(xi + 1, yi);
    const cc = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + cc * (1 - u) * v + d * u * v;
  };
  for (let y = 0; y < size; y++){
    for (let x = 0; x < size; x++){
      const n = noise(x / 8, y / 8) * 0.5 + noise(x / 3, y / 3) * 0.5;
      const r = 0.55 + n * 0.35;
      const v = Math.floor(r * 255);
      const i = (y * size + x) * 4;
      data[i] = data[i+1] = data[i+2] = v;
      data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 6);
  return tex;
}

function radialTex(){
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0,   'rgba(255,245,220,1)');
  g.addColorStop(0.3, 'rgba(255,229,176,0.6)');
  g.addColorStop(0.7, 'rgba(201,162,39,0.15)');
  g.addColorStop(1,   'rgba(201,162,39,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

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

/* ============================================
   GRAIN
   ============================================ */
const SPHERE_TARGET_RADIUS = 1.15;

function buildBeanGeometry(){
  const geo = new THREE.SphereGeometry(1, PERF.beanSegments, PERF.beanSegments);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++){
    v.fromBufferAttribute(pos, i);
    v.x *= 0.75; v.y *= 0.85; v.z *= 1.32;
    if (v.x > 0){
      const creaseY = Math.exp(-Math.pow(v.y / 0.22, 2));
      const creaseZ = Math.exp(-Math.pow(v.z / 1.0, 4));
      v.x -= creaseY * creaseZ * 0.32;
    }
    v.x -= Math.exp(-Math.pow(v.x / 0.5, 2)) * 0.04 * Math.sign(v.x);
    v.x += Math.sin(v.z * 14 + v.x * 6) * 0.018;
    v.y += Math.cos(v.y * 12 + v.z * 4) * 0.016;
    v.z += Math.sin(v.x * 18 + v.y * 8) * 0.014;
    v.x += Math.sin(v.y * 25 + v.z * 15) * 0.006;
    v.y += Math.cos(v.z * 22 + v.x * 11) * 0.005;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildSphereTargetGeometry(){
  return new THREE.SphereGeometry(SPHERE_TARGET_RADIUS, PERF.beanSegments, PERF.beanSegments);
}

const beanGeo = buildBeanGeometry();
const sphereGeo = buildSphereTargetGeometry();

const beanOrigPositions = new Float32Array(beanGeo.attributes.position.array);
const sphereTargetPositions = new Float32Array(sphereGeo.attributes.position.array);

const bump = fbmTexture(PERF.fbmSize);
const rough = roughnessTexture(512);

const beanMat = new THREE.MeshPhysicalMaterial({
  color: 0x5c3418,
  roughness: 0.85,
  roughnessMap: rough,
  metalness: 0.02,
  clearcoat: 0.15,
  clearcoatRoughness: 0.85,
  sheen: 0.15,
  sheenColor: new THREE.Color(0xC9A227),
  sheenRoughness: 0.95,
  bumpMap: bump,
  bumpScale: 0.18,
});

const bean = new THREE.Mesh(beanGeo, beanMat);
const beanGroup = new THREE.Group();
beanGroup.add(bean);
beanGroup.position.set(START.beanX, START.beanY, START.beanZ);
scene.add(beanGroup);

/* ============================================
   GLOBE 3D — SANS atmosphère additive
   ============================================ */
const globeGroup = new THREE.Group();
globeGroup.position.set(0.3, 0, 0);
globeGroup.visible = false;
scene.add(globeGroup);

const globeInner = new THREE.Group();
globeGroup.add(globeInner);

/* Terre — opaque, sobre */
const earthGeo = new THREE.SphereGeometry(SPHERE_TARGET_RADIUS, PERF.earthSegments, PERF.earthSegments);
const earthMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.95,
  metalness: 0.0,
  transparent: false,
  opacity: 1,
  depthWrite: true,
  depthTest: true,
});
const earth = new THREE.Mesh(earthGeo, earthMat);
globeInner.add(earth);

const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    earthMat.map = tex;
    earthMat.needsUpdate = true;
  },
  undefined,
  () => { earthMat.color = new THREE.Color(0x2a3a4a); }
);

/* Marqueurs — sphère opaque + anneau opaque (PAS additif) */
function latLonToVec3(lat, lon, r){
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

const origins = [
  { name: 'Yirgacheffe', lat: 6.16,  lon: 38.20,  product: 'yirgacheffe' },
  { name: 'Huila',       lat: 2.53,  lon: -75.52, product: 'huila' },
  { name: 'Cerrado',     lat: -15.78, lon: -47.93, product: 'cerrado' },
];

const markers = [];
origins.forEach((o, i) => {
  const pos = latLonToVec3(o.lat, o.lon, SPHERE_TARGET_RADIUS * 1.02);

  /* Point doré opaque */
  const mGeo = new THREE.SphereGeometry(0.055, 20, 20);
  const mMat = new THREE.MeshStandardMaterial({
    color: 0xC9A227,
    roughness: 0.35,
    metalness: 0.4,
    emissive: 0xC9A227,
    emissiveIntensity: 0.5,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
  const m = new THREE.Mesh(mGeo, mMat);
  m.position.copy(pos);
  m.userData.origin = o.product;
  m.userData.index = i;
  globeInner.add(m);

  /* Anneau plat doré (à la place du halo additif) */
  const rGeo = new THREE.RingGeometry(0.075, 0.095, 32);
  const rMat = new THREE.MeshBasicMaterial({
    color: 0xFFE5B0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: true,
  });
  const ring = new THREE.Mesh(rGeo, rMat);
  ring.position.copy(pos);
  /* L'anneau doit être orienté vers l'extérieur du globe */
  ring.lookAt(pos.clone().multiplyScalar(2));
  globeInner.add(ring);

  markers.push({ dot: m, ring });
});

/* ============================================
   FLASH + RING
   ============================================ */
const flashMat = new THREE.SpriteMaterial({
  map: radialTex(),
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  depthTest: false,
});
const flash = new THREE.Sprite(flashMat);
flash.scale.set(6, 6, 1);
flash.position.set(0.3, 0, 0);
scene.add(flash);

const ringGeo = new THREE.RingGeometry(0.5, 0.6, 64);
const ringMat = new THREE.MeshBasicMaterial({
  color: 0xC9A227, transparent: true, opacity: 0,
  side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  depthWrite: false, depthTest: false,
});
const shockRing = new THREE.Mesh(ringGeo, ringMat);
shockRing.position.set(0.3, 0, 0);
scene.add(shockRing);

/* ============================================
   PARTICULES
   ============================================ */
const pCount = PERF.particleCount;
const pPos = new Float32Array(pCount * 3);
for (let i = 0; i < pCount * 3; i += 3){
  pPos[i]   = (Math.random() - 0.5) * 16;
  pPos[i+1] = (Math.random() - 0.5) * 10;
  pPos[i+2] = (Math.random() - 0.5) * 10;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));

const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.07, map: dotTex(), transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, color: 0xC9A227,
}));
scene.add(particles);

/* ============================================
   TIMELINE
   ============================================ */
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
  }
});

tl
  /* PHASE 1 */
  .to(beanGroup.rotation, { y: Math.PI * 2, x: 0.4, ease: 'none', duration: 1 }, 0)
  .to(beanGroup.position, { x: START.beanX + 0.6, y: -1.3, z: 0.5, ease: 'none', duration: 1 }, 0)
  .to(beanGroup.scale, { x: 0.85, y: 0.85, z: 0.85, ease: 'none', duration: 1 }, 0)
  .to(cameraBase, { z: START.camZ - 0.8, x: 0.3, y: -0.15, ease: 'power2.inOut', duration: 1 }, 0)
  .to(camera, { fov: START.fov - 3, ease: 'power2.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 0)
  .to(lookAtTarget, { x: 0.4, y: -0.3, ease: 'power2.inOut', duration: 1 }, 0)

  /* PHASE 2 — MÉTAMORPHOSE */
  .to(beanGroup.rotation, { y: Math.PI * 5, x: 0.6, ease: 'power2.in', duration: 0.5 }, 1.2)
  .to(beanGroup.position, { x: 0.3, y: 0, z: 0, ease: 'power2.inOut', duration: 0.5 }, 1.2)
  .to(beanGroup.scale, { x: 1, y: 1, z: 1, ease: 'power2.inOut', duration: 0.5 }, 1.2)
  .to(cameraBase, { z: 5.2, x: 0.1, y: 0.1, ease: 'power2.inOut', duration: 0.6 }, 1.2)
  .to(camera, { fov: START.fov + 1, ease: 'power2.inOut', duration: 0.6, onUpdate: () => camera.updateProjectionMatrix() }, 1.2)
  .to(lookAtTarget, { x: 0.15, y: 0, ease: 'power2.inOut', duration: 0.6 }, 1.2)

  .to(state, { morph: 1, ease: 'power3.inOut', duration: 0.35 }, 1.75)

  .to(state, { beanOpacity: 0, ease: 'none', duration: 0.02 }, 2.1)
  .to(state, { globeVisible: true, ease: 'none', duration: 0.02 }, 2.1)

  .to(state, { flash: 0.7, ease: 'power2.out', duration: 0.1 }, 2.05)
  .to(state, { flash: 0, ease: 'power2.in', duration: 0.35 }, 2.15)
  .fromTo(shockRing.scale,
    { x: 0.5, y: 0.5, z: 0.5 },
    { x: 7, y: 7, z: 7, ease: 'power3.out', duration: 0.5 }, 2.1)
  .fromTo(ringMat,
    { opacity: 0 },
    { opacity: 0.6, ease: 'power2.out', duration: 0.08 }, 2.1)
  .to(ringMat, { opacity: 0, ease: 'power2.in', duration: 0.4 }, 2.18)

  /* PHASE 3 — Voyage */
  .to(globeGroup.rotation, { y: Math.PI * 0.9, ease: 'none', duration: 1 }, 2.5)
  .to(cameraBase, { z: 4.4, x: 0.5, y: -0.1, ease: 'power1.inOut', duration: 1 }, 2.5)
  .to(camera, { fov: 40, ease: 'power1.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 2.5)
  .to(lookAtTarget, { x: 0.3, y: 0, ease: 'power1.inOut', duration: 1 }, 2.5)

  /* PHASE 4 */
  .to(state, { flash: 0.6, ease: 'power2.out', duration: 0.1 }, 3.65)
  .to(state, { flash: 0, ease: 'power2.in', duration: 0.3 }, 3.75)

  .to(state, { globeVisible: false, ease: 'none', duration: 0.02 }, 3.75)
  .to(state, { beanOpacity: 1, ease: 'none', duration: 0.02 }, 3.75)

  .to(state, { morph: 0, ease: 'power3.inOut', duration: 0.35 }, 3.72)

  .to(beanGroup.rotation, { y: Math.PI * 7, x: 0.2, ease: 'none', duration: 0.6 }, 4.1)
  .to(beanGroup.position, { x: 2.0, y: -1.8, z: -0.6, ease: 'power2.inOut', duration: 0.6 }, 4.1)
  .to(beanMat.color, { r: 0.28, g: 0.15, b: 0.07, ease: 'power1.inOut', duration: 0.6 }, 4.1)
  .to(beanGroup.scale, { x: 0.55, y: 0.55, z: 0.55, ease: 'power2.inOut', duration: 0.6 }, 4.1)

  .to(cameraBase, { z: 6.2, x: 0.5, y: -0.4, ease: 'power2.inOut', duration: 0.6 }, 4.1)
  .to(camera, { fov: 50, ease: 'power2.inOut', duration: 0.6, onUpdate: () => camera.updateProjectionMatrix() }, 4.1)
  .to(lookAtTarget, { x: 0.5, y: -0.4, ease: 'power2.inOut', duration: 0.6 }, 4.1)

  /* PHASE 5 */
  .to(beanGroup.rotation, { y: Math.PI * 9, ease: 'none', duration: 1 }, 4.7)
  .to(beanGroup.position, { x: 1.6, y: -1.2, z: -0.3, ease: 'power1.inOut', duration: 1 }, 4.7)
  .to(state, { beanOpacity: 0.35, ease: 'power2.out', duration: 1 }, 4.7)
  .to(particles.material, { size: 0.04, opacity: 0.5, ease: 'none', duration: 1 }, 4.7)
  .to(cameraBase, { z: 7, x: 0.3, y: -0.2, ease: 'power2.inOut', duration: 1 }, 4.7)
  .to(camera, { fov: 52, ease: 'power2.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 4.7)
  .to(lookAtTarget, { x: 0.2, y: -0.3, ease: 'power2.inOut', duration: 1 }, 4.7);

/* ============================================
   INTERACTIONS
   ============================================ */
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

let isDragging = false;
let hasMoved = false;
let prevPointer = { x: 0, y: 0 };

const dotMeshes = markers.map(m => m.dot);

function updatePointerNDC(e){
  pointerNDC.x = (e.clientX / sizes.w) * 2 - 1;
  pointerNDC.y = -(e.clientY / sizes.h) * 2 + 1;
}

function hitMarker(){
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(dotMeshes);
  return hits.length > 0 ? hits[0].object.userData.index : -1;
}

document.addEventListener('pointermove', (e) => {
  if (isDragging && !isMobile) {
    const dx = e.clientX - prevPointer.x;
    const dy = e.clientY - prevPointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) hasMoved = true;

    globeInner.rotation.y += dx * 0.006;
    globeInner.rotation.x += dy * 0.006;
    globeInner.rotation.x = Math.max(-0.9, Math.min(0.9, globeInner.rotation.x));

    prevPointer.x = e.clientX;
    prevPointer.y = e.clientY;
  }

  if (state.globeVisible && !isDragging) {
    updatePointerNDC(e);
    const idx = hitMarker();
    document.body.style.cursor = idx >= 0 ? 'pointer' : '';
  } else {
    document.body.style.cursor = '';
  }
});

document.addEventListener('pointerdown', (e) => {
  if (!state.globeVisible) return;
  if (e.target.closest('a, button')) return;

  isDragging = true;
  hasMoved = false;
  prevPointer.x = e.clientX;
  prevPointer.y = e.clientY;

  if (!isMobile) {
    document.body.style.cursor = 'grabbing';
    lenis.stop();
  }
});

document.addEventListener('pointerup', (e) => {
  if (!isDragging) return;
  const wasDrag = hasMoved;
  isDragging = false;
  document.body.style.cursor = '';
  if (!isMobile) lenis.start();
  if (wasDrag) return;

  if (state.globeVisible) {
    updatePointerNDC(e);
    const idx = hitMarker();
    if (idx >= 0) {
      const originKey = dotMeshes[idx].userData.origin;
      const target = document.querySelector(`.produit[data-origin="${originKey}"]`);
      if (target) {
        target.classList.remove('highlight');
        void target.offsetWidth;
        target.classList.add('highlight');
        setTimeout(() => target.classList.remove('highlight'), 2400);
        lenis.scrollTo(target, { offset: -100, duration: 1.6 });
      }
    }
  }
});

/* ---------- Mouse parallax ---------- */
const mouse = { x: 0, y: 0 };
if (!isMobile) {
  addEventListener('mousemove', e => {
    mouse.x = (e.clientX / sizes.w) * 2 - 1;
    mouse.y = -((e.clientY / sizes.h) * 2 - 1);
  });
}

/* ---------- Resize ---------- */
addEventListener('resize', () => {
  sizes.w = innerWidth; sizes.h = innerHeight;
  camera.aspect = sizes.w / sizes.h;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.w, sizes.h);
});

/* ============================================
   LOOP
   ============================================ */
const clock = new THREE.Clock();

function tick(){
  const t = clock.getElapsedTime();

  /* ===== MORPHING ===== */
  const isMorphing = state.morph > 0.002 && state.morph < 0.998;

  if (isMorphing) {
    const arr = beanGeo.attributes.position.array;
    for (let i = 0; i < arr.length; i++){
      arr[i] = beanOrigPositions[i] * (1 - state.morph) + sphereTargetPositions[i] * state.morph;
    }
    beanGeo.attributes.position.needsUpdate = true;
    beanGeo.computeVertexNormals();
  } else if (state.morph <= 0.002 && beanGeo.attributes.position.array[0] !== beanOrigPositions[0]) {
    beanGeo.attributes.position.array.set(beanOrigPositions);
    beanGeo.attributes.position.needsUpdate = true;
    beanGeo.computeVertexNormals();
  } else if (state.morph >= 0.998 && beanGeo.attributes.position.array[0] !== sphereTargetPositions[0]) {
    beanGeo.attributes.position.array.set(sphereTargetPositions);
    beanGeo.attributes.position.needsUpdate = true;
    beanGeo.computeVertexNormals();
  }

  flashMat.opacity = state.flash;

  /* Grain */
  if (!isDragging || !state.globeVisible) {
    beanGroup.rotation.y += 0.0025;
  }
  beanMat.opacity = state.beanOpacity;
  if (beanMat.transparent !== (state.beanOpacity < 0.98)) {
    beanMat.transparent = state.beanOpacity < 0.98;
    beanMat.needsUpdate = true;
  }

  /* Globe — toggle visible (pas de fondu, donc pas de problème de tri) */
  if (globeGroup.visible !== state.globeVisible) {
    globeGroup.visible = state.globeVisible;
  }

  /* Rotation globe auto */
  if (state.globeVisible && !isDragging) {
    globeInner.rotation.y += 0.0015;
  }

  /* Pulsation des anneaux (pas des halos additifs) */
  markers.forEach((m, i) => {
    const pulse = 1 + Math.sin(t * 2.2 + i * 0.8) * 0.3;
    m.dot.scale.setScalar(pulse);
    const rpulse = 1 + Math.sin(t * 2.2 + i * 0.8) * 0.5;
    m.ring.scale.setScalar(rpulse);
  });

  /* Particules */
  particles.rotation.y = t * 0.05;
  particles.rotation.x = Math.sin(t * 0.3) * 0.05;

  /* Lumière dorée orbite */
  gold.position.x = Math.cos(t * 0.6) * 3 + beanGroup.position.x;
  gold.position.z = Math.sin(t * 0.6) * 3;

  /* Caméra */
  cameraParallax.x += (mouse.x * 0.35 - cameraParallax.x) * 0.05;
  cameraParallax.y += (mouse.y * 0.25 - cameraParallax.y) * 0.05;

  camera.position.set(
    cameraBase.x + cameraParallax.x,
    cameraBase.y + cameraParallax.y,
