// ============================================
// MÉRIDIEN — Three.js + GSAP
// Bean + Globe 3D + Cinematic camera + Finale tasse
// ============================================

import * as THREE from 'three';

/* ---------- Détection mobile ---------- */
const isMobile = window.matchMedia('(max-width: 768px)').matches
              || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const PERF = {
  beanSegments:   isMobile ? 96  : 200,
  earthSegments:  isMobile ? 48  : 64,
  cupSegments:    isMobile ? 32  : 64,
  fbmSize:        isMobile ? 256 : 512,
  particleCount:  isMobile ? 180 : 500,
  steamCount:     isMobile ? 20  : 40,
  splashCount:    isMobile ? 40  : 80,
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
renderer.toneMappingExposure = 1.35;

/* ---------- Lights ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xfff2d6, 2.0);
key.position.set(3, 4, 3); scene.add(key);
const gold = new THREE.PointLight(0xC9A227, 9, 14);
gold.position.set(-2, 1, 3); scene.add(gold);
const rim = new THREE.PointLight(0x8B5E3C, 5, 14);
rim.position.set(2, -1, -3); scene.add(rim);

const globeLight = new THREE.PointLight(0xC9A227, 7, 12);
globeLight.position.set(2, 2, 3);
scene.add(globeLight);

/* Lumière dédiée à la tasse finale */
const cupLight = new THREE.PointLight(0xFFE5B0, 4, 8);
cupLight.position.set(0, 0.5, 2.5);
scene.add(cupLight);

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
   GRAIN DE CAFÉ
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
    color: 0x7a4a24, roughness: 0.62, metalness: 0.05,
    clearcoat: 0.5, clearcoatRoughness: 0.55,
    sheen: 0.35, sheenColor: new THREE.Color(0xC9A227), sheenRoughness: 0.8,
    bumpMap: bump, bumpScale: 0.2,
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
   GLOBE 3D
   ============================================ */
const globeGroup = new THREE.Group();
globeGroup.position.set(0.3, 0, 0);
scene.add(globeGroup);

const earthGeo = new THREE.SphereGeometry(1.15, PERF.earthSegments, PERF.earthSegments);
const earthMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, roughness: 0.9, metalness: 0.05,
  transparent: true, opacity: 0,
});
const earth = new THREE.Mesh(earthGeo, earthMat);
earth.userData.baseOpacity = 1;
globeGroup.add(earth);

const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  (tex) => { earthMat.map = tex; earthMat.needsUpdate = true; },
  undefined,
  () => { earthMat.color = new THREE.Color(0x2a3a4a); }
);

const atmGeo = new THREE.SphereGeometry(1.32, 32, 32);
const atmMat = new THREE.MeshBasicMaterial({
  color: 0xC9A227, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, side: THREE.BackSide,
});
const atmosphere = new THREE.Mesh(atmGeo, atmMat);
atmosphere.userData.baseOpacity = 0.18;
globeGroup.add(atmosphere);

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
  { name: 'Yirgacheffe', lat: 6.16,  lon: 38.20  },
  { name: 'Huila',       lat: 2.53,  lon: -75.52 },
  { name: 'Cerrado',     lat: -15.78, lon: -47.93 },
];

const markers = [];
origins.forEach((o, i) => {
  const pos = latLonToVec3(o.lat, o.lon, 1.18);

  const mGeo = new THREE.SphereGeometry(0.028, 12, 12);
  const mMat = new THREE.MeshBasicMaterial({ color: 0xC9A227, transparent: true, opacity: 0 });
  const m = new THREE.Mesh(mGeo, mMat);
  m.position.copy(pos);
  m.userData.baseOpacity = 1;
  globeGroup.add(m);

  const hGeo = new THREE.SphereGeometry(0.075, 12, 12);
  const hMat = new THREE.MeshBasicMaterial({
    color: 0xC9A227, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(hGeo, hMat);
  halo.position.copy(pos);
  halo.userData.baseOpacity = 0.45;
  globeGroup.add(halo);

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
   TASSE DE CAFÉ (finale)
   ============================================ */
const cupGroup = new THREE.Group();
cupGroup.position.set(0, -1.5, 0.5);
scene.add(cupGroup);

/* Porcelaine */
const porcelainMat = new THREE.MeshPhysicalMaterial({
  color: 0xF2E9DC, roughness: 0.35, metalness: 0.02,
  clearcoat: 0.7, clearcoatRoughness: 0.25,
  side: THREE.DoubleSide,
  transparent: true, opacity: 0,
});

/* Corps de la tasse */
const cupBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.6, 0.45, 0.85, PERF.cupSegments, 1, true),
  porcelainMat
);
cupBody.userData.baseOpacity = 1;
cupGroup.add(cupBody);

/* Fond de la tasse */
const cupBottomGeo = new THREE.CircleGeometry(0.45, PERF.cupSegments);
cupBottomGeo.rotateX(-Math.PI / 2);
const cupBottom = new THREE.Mesh(cupBottomGeo, porcelainMat);
cupBottom.position.y = -0.425;
cupBottom.userData.baseOpacity = 1;
cupGroup.add(cupBottom);

/* Anse */
const handle = new THREE.Mesh(
  new THREE.TorusGeometry(0.2, 0.06, 16, 32, Math.PI * 1.4),
  porcelainMat
);
handle.position.set(0.62, 0, 0);
handle.rotation.z = Math.PI * 0.55;
handle.userData.baseOpacity = 1;
cupGroup.add(handle);

/* Soucoupe */
const saucer = new THREE.Mesh(
  new THREE.CylinderGeometry(1.0, 1.05, 0.05, PERF.cupSegments),
  porcelainMat
);
saucer.position.y = -0.47;
saucer.userData.baseOpacity = 1;
cupGroup.add(saucer);

/* Café liquide */
const coffeeMat = new THREE.MeshPhysicalMaterial({
  color: 0x2a1208, roughness: 0.12, metalness: 0.4,
  clearcoat: 1, clearcoatRoughness: 0.05,
  transparent: true, opacity: 0,
});
const coffeeGeo = new THREE.CircleGeometry(0.5, 48);
coffeeGeo.rotateX(-Math.PI / 2);
const coffeeLiquid = new THREE.Mesh(coffeeGeo, coffeeMat);
coffeeLiquid.position.y = 0.15;
coffeeLiquid.userData.baseOpacity = 1;
cupGroup.add(coffeeLiquid);

/* Vapeur */
const steamCount = PERF.steamCount;
const steamPosArr = new Float32Array(steamCount * 3);
const steamData = [];
for (let i = 0; i < steamCount; i++) {
  const x = (Math.random() - 0.5) * 0.6;
  const z = (Math.random() - 0.5) * 0.6;
  steamPosArr[i*3]   = x;
  steamPosArr[i*3+1] = 0.2 + Math.random() * 1.5;
  steamPosArr[i*3+2] = z;
  steamData.push({
    baseX: x, baseZ: z,
    speed: 0.15 + Math.random() * 0.25,
    phase: Math.random() * Math.PI * 2,
  });
}
const steamGeo = new THREE.BufferGeometry();
steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPosArr, 3));
const steamMat = new THREE.PointsMaterial({
  size: 0.2, map: dotTex(), transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, color: 0xF2E9DC, opacity: 0,
});
const steam = new THREE.Points(steamGeo, steamMat);
steam.userData.baseOpacity = 0.4;
steam.position.y = 0.15;
cupGroup.add(steam);

/* Éclaboussures (hémisphère de particules) */
const splashCount = PERF.splashCount;
const splashPosArr = new Float32Array(splashCount * 3);
for (let i = 0; i < splashCount; i++) {
  const theta = Math.random() * Math.PI * 0.5;
  const phi = Math.random() * Math.PI * 2;
  const r = 0.15 + Math.random() * 0.35;
  splashPosArr[i*3]   = Math.sin(theta) * Math.cos(phi) * r;
  splashPosArr[i*3+1] = Math.cos(theta) * r * 1.4;
  splashPosArr[i*3+2] = Math.sin(theta) * Math.sin(phi) * r;
}
const splashGeo = new THREE.BufferGeometry();
splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPosArr, 3));
const splashMat = new THREE.PointsMaterial({
  size: 0.08, map: dotTex(), transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, color: 0x8B5E3C, opacity: 0,
});
const splash = new THREE.Points(splashGeo, splashMat);
splash.position.y = 0.15;
splash.scale.setScalar(0.01);
cupGroup.add(splash);

/* Onde (ring sur la surface du café) */
const rippleGeo = new THREE.RingGeometry(0.05, 0.12, 48);
rippleGeo.rotateX(-Math.PI / 2);
const rippleMat = new THREE.MeshBasicMaterial({
  color: 0xC9A227, transparent: true, opacity: 0,
  side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
});
const ripple = new THREE.Mesh(rippleGeo, rippleMat);
ripple.position.y = 0.16;
ripple.scale.setScalar(0.01);
cupGroup.add(ripple);

/* ============================================
   TIMELINE SCROLL
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
  /* PHASE 1 — Hero → Origine */
  .to(beanGroup.rotation, { y: Math.PI * 2, x: 0.4, ease: 'none', duration: 1 }, 0)
  .to(beanGroup.position, { x: 2.2, y: -1.2, z: 0.5, ease: 'none', duration: 1 }, 0)
  .to(beanGroup.scale, { x: 0.85, y: 0.85, z: 0.85, ease: 'none', duration: 1 }, 0)
  .to(cameraBase, { z: 4.2, x: 0.3, y: -0.15, ease: 'power2.inOut', duration: 1 }, 0)
  .to(camera, { fov: 42, ease: 'power2.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 0)
  .to(lookAtTarget, { x: 0.4, y: -0.3, ease: 'power2.inOut', duration: 1 }, 0)

  /* PHASE 2 — Origine → Voyage */
  .to(beanGroup.rotation, { y: Math.PI * 4, x: -0.5, ease: 'none', duration: 1 }, 1)
  .to(beanGroup.position, { x: -2.3, y: 1.4, z: 0.2, ease: 'none', duration: 1 }, 1)
  .to(bean.material.color, { r: 0.45, g: 0.25, b: 0.12, ease: 'none', duration: 1 }, 1)
  .to(bean.material, { roughness: 0.48, ease: 'none', duration: 1 }, 1)
  .to(beanGroup.scale, { x: 1.0, y: 1.0, z: 1.0, ease: 'none', duration: 1 }, 1)
  .to(state, { beanOpacity: 0, ease: 'power2.in', duration: 0.6 }, 1.4)
  .to(state, { globeOpacity: 1, ease: 'power2.out', duration: 0.6 }, 1.4)
  .to(cameraBase, { z: 5.2, x: -0.5, y: 0.35, ease: 'power2.inOut', duration: 1 }, 1)
  .to(camera, { fov: 48, ease: 'power2.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 1)
  .to(lookAtTarget, { x: -0.3, y: 0.15, ease: 'power2.inOut', duration: 1 }, 1)

  /* PHASE 3 — Voyage (focus globe) */
  .to(globeGroup.rotation, { y: Math.PI * 1.5, ease: 'none', duration: 1 }, 2)
  .to(cameraBase, { z: 4.6, x: 0.9, y: -0.2, ease: 'power1.inOut', duration: 1 }, 2)
  .to(camera, { fov: 40, ease: 'power1.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 2)
  .to(lookAtTarget, { x: 0.35, y: 0, ease: 'power1.inOut', duration: 1 }, 2)

  /* PHASE 4 — Voyage → Produits */
  .to(state, { globeOpacity: 0, ease: 'power2.in', duration: 0.6 }, 3)
  .to(state, { beanOpacity: 1, ease: 'power2.out', duration: 0.6 }, 3)
  .to(beanGroup.rotation, { y: Math.PI * 6, x: 0.2, ease: 'none', duration: 1 }, 3)
  .to(beanGroup.position, { x: 2.0, y: -1.8, z: -0.6, ease: 'none', duration: 1 }, 3)
  .to(bean.material.color, { r: 0.28, g: 0.15, b: 0.08, ease: 'none', duration: 1 }, 3)
  .to(beanGroup.scale, { x: 0.6, y: 0.6, z: 0.6, ease: 'none', duration: 1 }, 3)
  .to(cameraBase, { z: 6.5, x: 0.5, y: -0.4, ease: 'power2.inOut', duration: 1 }, 3)
  .to(camera, { fov: 50, ease: 'power2.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 3)
  .to(lookAtTarget, { x: 0.6, y: -0.5, ease: 'power2.inOut', duration: 1 }, 3)

  /* ============================================
     PHASE 5 — FINALE : LE GRAIN TOMBE DANS LA TASSE
     ============================================ */

  /* 5.1 — La tasse apparaît + grain se repositionne au-dessus */
  .to(porcelainMat, { opacity: 1, ease: 'power2.out', duration: 0.35 }, 4)
  .to(coffeeMat, { opacity: 1, ease: 'power2.out', duration: 0.35 }, 4.15)
  .to(beanGroup.scale, { x: 0.42, y: 0.42, z: 0.42, ease: 'power2.out', duration: 0.4 }, 4)
  .to(beanGroup.position, { x: 0, y: 0.7, z: 0.5, ease: 'power2.out', duration: 0.45 }, 4)
  .to(beanGroup.rotation, { y: Math.PI * 8, x: 0.4, ease: 'none', duration: 0.6 }, 4)
  .to(bean.material.color, { r: 0.35, g: 0.19, b: 0.1, ease: 'power2.out', duration: 0.4 }, 4)

  /* 5.2 — Le grain CHUTE (accélération) */
  .to(beanGroup.position, { y: -1.35, ease: 'power2.in', duration: 0.35 }, 4.45)
  .to(beanGroup.rotation, { x: 1.8, y: Math.PI * 9.5, ease: 'power1.in', duration: 0.35 }, 4.45)

  /* 5.3 — IMPACT : grain disparaît, splash + onde */
  .to(beanGroup.scale, { x: 0.001, y: 0.001, z: 0.001, ease: 'power2.in', duration: 0.05 }, 4.8)
  .to(splashMat, { opacity: 0.9, duration: 0.05 }, 4.8)
  .to(splash.scale, { x: 1, y: 1, z: 1, ease: 'power3.out', duration: 0.4 }, 4.8)
  .to(splashMat, { opacity: 0, ease: 'power2.in', duration: 0.35 }, 4.92)
  .to(rippleMat, { opacity: 0.8, duration: 0.08 }, 4.8)
  .to(ripple.scale, { x: 4, y: 1, z: 4, ease: 'power3.out', duration: 0.5 }, 4.8)
  .to(rippleMat, { opacity: 0, ease: 'power2.in', duration: 0.4 }, 4.92)

  /* 5.4 — Vapeur qui monte */
  .to(steamMat, { opacity: 0.4, ease: 'power2.out', duration: 0.4 }, 4.95)

  /* 5.5 — Caméra recule + particules faiblissent */
  .to(cameraBase, { z: 7.5, x: 0, y: 0.2, ease: 'power2.inOut', duration: 1 }, 4)
  .to(camera, { fov: 48, ease: 'power2.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 4)
  .to(lookAtTarget, { x: 0, y: -0.55, ease: 'power2.inOut', duration: 1 }, 4)
  .to(particles.material, { size: 0.02, opacity: 0.15, ease: 'none', duration: 1 }, 4);

/* ============================================
   SOURIS
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

  /* Grain */
  beanGroup.rotation.y += 0.0025;
  bean.material.opacity = state.beanOpacity;
  bean.material.transparent = true;

  /* Globe */
  if (state.globeOpacity > 0.01){
    globeGroup.rotation.y += 0.0018;
  }

  markers.forEach((m, i) => {
    const pulse = 1 + Math.sin(t * 2.2 + i * 0.8) * 0.35;
    m.dot.scale.setScalar(pulse);
    const hpulse = 1 + Math.sin(t * 2.2 + i * 0.8) * 0.55;
    m.halo.scale.setScalar(hpulse);
  });

  globeGroup.traverse(child => {
    if (child.material && child.userData.baseOpacity !== undefined){
      child.material.opacity = state.globeOpacity * child.userData.baseOpacity;
      child.material.transparent = true;
    }
  });

  /* Particules dorées */
  particles.rotation.y = t * 0.05;
  particles.rotation.x = Math.sin(t * 0.3) * 0.05;

  /* Lumière dorée orbite */
  gold.position.x = Math.cos(t * 0.6) * 3 + beanGroup.position.x;
  gold.position.z = Math.sin(t * 0.6) * 3;

  /* Vapeur — monte et se dissipe */
  if (steamMat.opacity > 0.01) {
    const posArr = steamGeo.attributes.position;
    for (let i = 0; i < steamCount; i++){
      const s = steamData[i];
      let y = posArr.array[i*3+1] + s.speed * 0.016;
      if (y > 2.2) y = 0.2;
      posArr.array[i*3]   = s.baseX + Math.sin(t * 1.1 + s.phase) * 0.12;
      posArr.array[i*3+1] = y;
      posArr.array[i*3+2] = s.baseZ + Math.cos(t * 0.9 + s.phase) * 0.08;
    }
    posArr.needsUpdate = true;
  }

  /* Caméra : base + parallaxe */
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
