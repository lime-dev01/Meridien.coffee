// ============================================
// MÉRIDIEN — Three.js + GSAP
// Bean + Globe interactif (drag + click)
// ============================================

import * as THREE from 'three';

/* ---------- Mobile ---------- */
const isMobile = window.matchMedia('(max-width: 768px)').matches
              || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const PERF = {
  beanSegments:   isMobile ? 96  : 200,
  earthSegments:  isMobile ? 48  : 64,
  fbmSize:        isMobile ? 256 : 512,
  particleCount:  isMobile ? 180 : 500,
  pixelRatio:     isMobile ? 1.5 : Math.min(devicePixelRatio, 2),
};

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
const cameraBase = { x: 0, y: 0, z: 5 };
const cameraParallax = { x: 0, y: 0 };
const lookAtTarget = new THREE.Vector3(0, 0, 0);

camera.position.set(cameraBase.x, cameraBase.y, cameraBase.z);
camera.lookAt(lookAtTarget);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true });
renderer.setSize(sizes.w, sizes.h);
renderer.setPixelRatio(PERF.pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

/* ---------- Lights (assombris) ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const key = new THREE.DirectionalLight(0xfff2d6, 1.8);
key.position.set(3, 4, 3); scene.add(key);
const gold = new THREE.PointLight(0xC9A227, 7.5, 14);
gold.position.set(-2, 1, 3); scene.add(gold);
const rim = new THREE.PointLight(0x8B5E3C, 4.5, 14);
rim.position.set(2, -1, -3); scene.add(rim);

const globeLight = new THREE.PointLight(0xC9A227, 6.5, 12);
globeLight.position.set(2, 2, 3);
scene.add(globeLight);

/* ---------- State ---------- */
const state = {
  beanOpacity: 1,
  globeOpacity: 0,
};

/* ============================================
   TEXTURE DE BRUIT
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
  tex.anisotropy = 4;
  return tex;
}

/* ============================================
   GRAIN DE CAFÉ (assombri)
   ============================================ */
function createBean(){
  const geo = new THREE.SphereGeometry(1, PERF.beanSegments, PERF.beanSegments);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++){
    v.fromBufferAttribute(pos, i);
    v.x *= 0.75; v.y *= 0.85; v.z *= 1.32;
    if (v.x > 0){
      const creaseY = Math.exp(-Math.pow(v.y / 0.16, 2));
      const creaseZ = Math.exp(-Math.pow(v.z / 1.0, 4));
      v.x -= creaseY * creaseZ * 0.45;
    }
    v.x -= Math.exp(-Math.pow(v.x / 0.5, 2)) * 0.05 * Math.sign(v.x);
    v.x += Math.sin(v.z * 8 + v.x * 3) * 0.02;
    v.y += Math.cos(v.y * 7 + v.z * 2) * 0.018;
    v.z += Math.sin(v.x * 12 + v.y * 5) * 0.012;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const bump = fbmTexture(PERF.fbmSize);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x5a3418,          // ⬅️ plus sombre
    roughness: 0.68,          // ⬅️ moins brillant
    metalness: 0.04,
    clearcoat: 0.32,          // ⬅️ moins de reflet
    clearcoatRoughness: 0.7,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xC9A227),
    sheenRoughness: 0.85,
    bumpMap: bump, bumpScale: 0.22,
    transparent: true, opacity: 1,
  });
  return new THREE.Mesh(geo, mat);
}

const beanGroup = new THREE.Group();
const bean = createBean();
beanGroup.add(bean);
beanGroup.position.set(1.4, 0, 0);
scene.add(beanGroup);

/* ============================================
   GLOBE 3D — globeGroup (GSAP) + globeInner (user drag)
   ============================================ */
const globeGroup = new THREE.Group();
globeGroup.position.set(0.3, 0, 0);
scene.add(globeGroup);

const globeInner = new THREE.Group();
globeGroup.add(globeInner);

/* Terre */
const earthGeo = new THREE.SphereGeometry(1.15, PERF.earthSegments, PERF.earthSegments);
const earthMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, roughness: 0.9, metalness: 0.05,
  transparent: true, opacity: 0,
});
const earth = new THREE.Mesh(earthGeo, earthMat);
earth.userData.baseOpacity = 1;
globeInner.add(earth);

const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  (tex) => { earthMat.map = tex; earthMat.needsUpdate = true; },
  undefined,
  () => { earthMat.color = new THREE.Color(0x2a3a4a); }
);

/* Atmosphère */
const atmGeo = new THREE.SphereGeometry(1.32, 32, 32);
const atmMat = new THREE.MeshBasicMaterial({
  color: 0xC9A227, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, side: THREE.BackSide,
});
const atmosphere = new THREE.Mesh(atmGeo, atmMat);
atmosphere.userData.baseOpacity = 0.16;
globeInner.add(atmosphere);

/* Marqueurs */
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
  const pos = latLonToVec3(o.lat, o.lon, 1.18);

  const mGeo = new THREE.SphereGeometry(0.04, 14, 14);
  const mMat = new THREE.MeshBasicMaterial({ color: 0xC9A227, transparent: true, opacity: 0 });
  const m = new THREE.Mesh(mGeo, mMat);
  m.position.copy(pos);
  m.userData.baseOpacity = 1;
  m.userData.origin = o.product;
  m.userData.index = i;
  globeInner.add(m);

  const hGeo = new THREE.SphereGeometry(0.09, 14, 14);
  const hMat = new THREE.MeshBasicMaterial({
    color: 0xC9A227, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(hGeo, hMat);
  halo.position.copy(pos);
  halo.userData.baseOpacity = 0.5;
  globeInner.add(halo);

  markers.push({ dot: m, halo });
});

/* ============================================
   PARTICULES DORÉES
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

/* ============================================
   TIMELINE — TRANSITIONS PROPRES
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
  /* ==========================================
     PHASE 1 — Hero → Origine
     Grain descend à droite, caméra avance
     ========================================== */
  .to(beanGroup.rotation, { y: Math.PI * 2, x: 0.4, ease: 'none', duration: 1 }, 0)
  .to(beanGroup.position, { x: 2.2, y: -1.2, z: 0.5, ease: 'none', duration: 1 }, 0)
  .to(beanGroup.scale, { x: 0.85, y: 0.85, z: 0.85, ease: 'none', duration: 1 }, 0)
  .to(cameraBase, { z: 4.2, x: 0.3, y: -0.15, ease: 'power2.inOut', duration: 1 }, 0)
  .to(camera, { fov: 42, ease: 'power2.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 0)
  .to(lookAtTarget, { x: 0.4, y: -0.3, ease: 'power2.inOut', duration: 1 }, 0)

  /* ==========================================
     PHASE 2 — Origine → Voyage
     Grain torréfié part à gauche et DISPARAÎT COMPLÈTEMENT
     ========================================== */
  .to(beanGroup.rotation, { y: Math.PI * 4, x: -0.5, ease: 'none', duration: 1 }, 1)
  .to(beanGroup.position, { x: -2.8, y: 1.6, z: 0.2, ease: 'power2.inOut', duration: 1 }, 1)
  .to(bean.material.color, { r: 0.42, g: 0.24, b: 0.12, ease: 'none', duration: 0.8 }, 1)
  .to(beanGroup.scale, { x: 0.7, y: 0.7, z: 0.7, ease: 'power2.inOut', duration: 1 }, 1)

  /* Grain fade out — 1.4 → 1.65 */
  .to(state, { beanOpacity: 0, ease: 'power2.in', duration: 0.25 }, 1.4)

  /* Caméra recule et se recentre sur le globe — 1 → 2 */
  .to(cameraBase, { z: 5.4, x: 0, y: 0.15, ease: 'power2.inOut', duration: 1 }, 1)
  .to(camera, { fov: 46, ease: 'power2.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 1)
  .to(lookAtTarget, { x: 0.1, y: 0.05, ease: 'power2.inOut', duration: 1 }, 1)

  /* Globe fade in — SEULEMENT après que le grain soit bien parti (1.7 → 2.0) */
  .to(state, { globeOpacity: 1, ease: 'power2.out', duration: 0.3 }, 1.7)

  /* ==========================================
     PHASE 3 — Voyage (focus globe)
     Rotation GSAP douce + caméra orbite légèrement
     ========================================== */
  .to(globeGroup.rotation, { y: Math.PI * 0.8, ease: 'none', duration: 1 }, 2)
  .to(cameraBase, { z: 4.4, x: 0.6, y: -0.1, ease: 'power1.inOut', duration: 1 }, 2)
  .to(camera, { fov: 40, ease: 'power1.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 2)
  .to(lookAtTarget, { x: 0.3, y: 0, ease: 'power1.inOut', duration: 1 }, 2)

  /* ==========================================
     PHASE 4 — Voyage → Produits
     Globe fade OUT d'abord (3.0 → 3.35)
     ========================================== */
  .to(state, { globeOpacity: 0, ease: 'power2.in', duration: 0.35 }, 3)

  /* Grain fade IN ensuite (3.4 → 3.65) à sa nouvelle position */
  .to(beanGroup.position, { x: 2.0, y: -1.8, z: -0.6, ease: 'power2.inOut', duration: 0.5 }, 3)
  .to(beanGroup.rotation, { y: Math.PI * 6, x: 0.2, ease: 'none', duration: 1 }, 3)
  .to(bean.material.color, { r: 0.22, g: 0.12, b: 0.06, ease: 'power1.inOut', duration: 0.5 }, 3)
  .to(beanGroup.scale, { x: 0.55, y: 0.55, z: 0.55, ease: 'power2.inOut', duration: 0.6 }, 3)
  .to(state, { beanOpacity: 1, ease: 'power2.out', duration: 0.25 }, 3.4)

  /* Caméra recule */
  .to(cameraBase, { z: 6.2, x: 0.5, y: -0.4, ease: 'power2.inOut', duration: 1 }, 3)
  .to(camera, { fov: 50, ease: 'power2.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 3)
  .to(lookAtTarget, { x: 0.5, y: -0.4, ease: 'power2.inOut', duration: 1 }, 3)

  /* ==========================================
     PHASE 5 — Produits → Footer
     Grain flotte doucement et s'estompe
     ========================================== */
  .to(beanGroup.rotation, { y: Math.PI * 8, ease: 'none', duration: 1 }, 4)
  .to(beanGroup.position, { x: 1.6, y: -1.2, z: -0.3, ease: 'power1.inOut', duration: 1 }, 4)
  .to(state, { beanOpacity: 0.4, ease: 'power2.out', duration: 1 }, 4)
  .to(particles.material, { size: 0.04, opacity: 0.5, ease: 'none', duration: 1 }, 4)
  .to(cameraBase, { z: 7, x: 0.3, y: -0.2, ease: 'power2.inOut', duration: 1 }, 4)
  .to(camera, { fov: 52, ease: 'power2.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 4)
  .to(lookAtTarget, { x: 0.2, y: -0.3, ease: 'power2.inOut', duration: 1 }, 4);

/* ============================================
   INTERACTION — Raycaster + Drag + Click
   ============================================ */
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

let isDragging = false;
let hasMoved = false;
let prevPointer = { x: 0, y: 0 };
let pointerDownPos = { x: 0, y: 0 };

const dotMeshes = markers.map(m => m.dot);

function updatePointerNDC(e){
  pointerNDC.x = (e.clientX / sizes.w) * 2 - 1;
  pointerNDC.y = -(e.clientY / sizes.h) * 2 + 1;
}

function hitMarker(){
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(dotMeshes);
  if (hits.length > 0) return hits[0].object.userData.index;
  return -1;
}

/* Hover souris */
document.addEventListener('pointermove', (e) => {
  /* Drag du globe (desktop uniquement) */
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

  /* Hover sur marqueur */
  if (state.globeOpacity > 0.5 && !isDragging) {
    updatePointerNDC(e);
    const idx = hitMarker();
    document.body.style.cursor = idx >= 0 ? 'pointer' : '';
  } else {
    document.body.style.cursor = '';
  }
});

document.addEventListener('pointerdown', (e) => {
  if (state.globeOpacity < 0.5) return;
  if (e.target.closest('a, button')) return; // ne pas hijack les liens

  isDragging = true;
  hasMoved = false;
  prevPointer.x = e.clientX;
  prevPointer.y = e.clientY;
  pointerDownPos.x = e.clientX;
  pointerDownPos.y = e.clientY;

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

  if (wasDrag) return; // c'était un drag, pas un clic

  /* Clic sur un marqueur → scroll vers le produit */
  if (state.globeOpacity > 0.5) {
    updatePointerNDC(e);
    const idx = hitMarker();
    if (idx >= 0) {
      const originKey = dotMeshes[idx].userData.origin;
      const target = document.querySelector(`.produit[data-origin="${originKey}"]`);
      if (target) {
        target.classList.remove('highlight');
        void target.offsetWidth; // reset animation
        target.classList.add('highlight');
        setTimeout(() => target.classList.remove('highlight'), 2400);

        lenis.scrollTo(target, { offset: -100, duration: 1.6 });
      }
    }
  }
});

/* ============================================
   MOUSE PARALLAX (desktop)
   ============================================ */
const mouse = { x: 0, y: 0 };
if (!isMobile) {
  addEventListener('mousemove', e => {
    mouse.x = (e.clientX / sizes.w) * 2 - 1;
    mouse.y = -((e.clientY / sizes.h) * 2 - 1);
  });
}

/* ============================================
   RESIZE
   ============================================ */
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

  /* Grain — rotation auto + opacité */
  if (!isDragging || state.globeOpacity < 0.5) {
    beanGroup.rotation.y += 0.0025;
  }
  bean.material.opacity = state.beanOpacity;
  bean.material.transparent = true;

  /* Globe — rotation auto si pas en drag */
  if (state.globeOpacity > 0.01 && !isDragging) {
    globeInner.rotation.y += 0.0015;
  }

  /* Pulsation des marqueurs */
  markers.forEach((m, i) => {
    const pulse = 1 + Math.sin(t * 2.2 + i * 0.8) * 0.3;
    m.dot.scale.setScalar(pulse);
    const hpulse = 1 + Math.sin(t * 2.2 + i * 0.8) * 0.55;
    m.halo.scale.setScalar(hpulse);
  });

  /* Opacité du globe */
  globeInner.traverse(child => {
    if (child.material && child.userData.baseOpacity !== undefined){
      child.material.opacity = state.globeOpacity * child.userData.baseOpacity;
      child.material.transparent = true;
    }
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
    cameraBase.z
  );
  camera.lookAt(lookAtTarget);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

console.log('%cMéridien ☕🌍', 'font-family: serif; font-size: 20px; color: #C9A227;');
