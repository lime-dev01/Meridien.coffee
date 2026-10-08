// ============================================
// MÉRIDIEN — Three.js + GSAP
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

const loaderEl = document.querySelector('.loader');
setTimeout(() => loaderEl.classList.add('hidden'), 1500);

const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
function raf(t){ lenis.raf(t); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
gsap.registerPlugin(ScrollTrigger);

document.querySelectorAll('.section__eyebrow, .section__title, .section__text, .produit, .footer__quote').forEach(el => {
  gsap.from(el, { opacity: 0, y: 40, duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 85%' } });
});
gsap.to('.hero__content', { opacity: 0, y: -80, ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });

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

const state = {
  beanOpacity: 1,
  globeVisible: false,
  morph: 0,
  flash: 0,
  beanGone: false,
};

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

const globeGroup = new THREE.Group();
globeGroup.position.set(0.3, 0, 0);
globeGroup.visible = false;
scene.add(globeGroup);

const globeInner = new THREE.Group();
globeGroup.add(globeInner);

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
  ring.lookAt(pos.clone().multiplyScalar(2));
  globeInner.add(ring);

  markers.push({ dot: m, ring });
});

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
scene.add(particles);/* ============================================
   SÉQUENCE FINALE — Nappe liquide + bulles + impact
   ============================================ */

/* --- Nappe liquide : plan TRÈS grand, HORIZONTAL --- */
const liquidGeo = new THREE.PlaneGeometry(80, 40, 200, 100);
const liquidMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime:         { value: 0 },
    uProgress:     { value: 0 },
    uAgitation:    { value: 1.5 },   // ⬅️ démarre fort
    uImpactTime:   { value: -1 },
    uColor1:       { value: new THREE.Color(0x4a2a18) },  // café foncé profond
    uColor2:       { value: new THREE.Color(0x8a5a38) },  // brun torréfié
    uColor3:       { value: new THREE.Color(0xb8825a) },  // brun clair (reflets)
  },
  vertexShader: `
    varying vec2 vUv;
    varying float vWave;
    uniform float uTime;
    uniform float uAgitation;

    void main(){
      vUv = uv;
      vec3 pos = position;

      /* Houle basse fréquence */
            float wave1 = sin(pos.x * 0.35 + uTime * 0.9) * 0.18
                  + cos(pos.x * 0.55 + uTime * 0.6) * 0.12
                  + sin(pos.z * 0.4 + uTime * 0.8) * 0.08;

      /* Clapotis haute fréquence, proportionnel à l'agitation */
      float wave2 = (sin(pos.x * 1.8 + uTime * 2.8) * 0.18
                   + sin(pos.x * 3.2 - uTime * 3.4) * 0.12
                   + cos(pos.z * 2.1 + uTime * 2.1) * 0.15) * uAgitation;

      /* Micro-respiration permanente */
      float breath = sin(uTime * 0.4) * 0.04;

      float wave = wave1 * (0.5 + uAgitation * 0.5) + wave2 + breath;
      pos.z += wave;

      vWave = wave;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vWave;
    uniform float uTime;
    uniform float uProgress;
    uniform float uAgitation;
    uniform float uImpactTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;

    float hash(vec2 p){
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
                 mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
    }
    float fbm(vec2 p){
      float v = 0.0;
      float a = 0.5;
      for(int i = 0; i < 5; i++){
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main(){
      vec2 uv = vUv;

      /* Reflets organiques : 2 bruits à vitesses différentes */
      float n1 = fbm(uv * 2.5 + vec2(uTime * 0.12, uTime * 0.08));
      float n2 = fbm(uv * 5.0 + vec2(-uTime * 0.18, uTime * 0.06));

      vec2 distUv = uv + vec2((n1 - 0.5) * 0.06, (n2 - 0.5) * 0.04);

      /* Couleur de base café clair */
      float blend = fbm(distUv * 1.8 + uTime * 0.04);
      vec3 col = mix(uColor1, uColor2, blend);

      /* Reflets mouvants qui suivent les vagues */
      float crest = smoothstep(-0.1, 0.4, vWave);
      col = mix(col, uColor3, crest * 0.35);

      /* Écume dorée claire sur les crêtes */
      float highlight = smoothstep(0.78, 0.98, blend);
      col = mix(col, uColor3, highlight * 0.30);

      /* Ondulation circulaire impact — grosse, visible, dégressive */
      if (uImpactTime >= 0.0) {
        float t = uImpactTime;
        vec2 center = vec2(0.5, 0.5);
        float d = distance(uv, center);

        /* Plusieurs anneaux qui partent du centre */
        float waveR1 = t * 0.35;
        float waveR2 = t * 0.5;
        float waveR3 = t * 0.7;

        float ring1 = exp(-pow((d - waveR1) * 20.0, 2.0));
        float ring2 = exp(-pow((d - waveR2) * 25.0, 2.0)) * 0.7;
        float ring3 = exp(-pow((d - waveR3) * 30.0, 2.0)) * 0.5;

        float ripple = (ring1 + ring2 + ring3) * exp(-t * 0.9);

        /* Le ripple modifie la luminosité et la couleur */
        col += uColor3 * ripple * 0.9;
        col = mix(col, uColor2, ripple * 0.5);
      }

      /* Fondu très large sur les bords (bien au-delà du champ visible) */
            /* Fondu très court, uniquement sur les bords extrêmes */
      float edgeFade = smoothstep(0.0, 0.03, uv.x) * smoothstep(1.0, 0.97, uv.x)
                     * smoothstep(0.0, 0.03, uv.y) * smoothstep(1.0, 0.97, uv.y);

      /* Alpha presque opaque au centre */
      float alpha = clamp(edgeFade * uProgress * 1.4, 0.0, 1.0);

      gl_FragColor = vec4(col, alpha);
    }
  `,
});
const liquid = new THREE.Mesh(liquidGeo, liquidMat);
liquid.position.set(0, -8, 0);
liquid.rotation.x = -Math.PI / 2;   // ⬅️ PARFAITEMENT HORIZONTAL
liquid.visible = false;
scene.add(liquid);

/* --- Bulles --- */
const bubbleCount = isMobile ? 40 : 90;
const bubbleGeo = new THREE.SphereGeometry(1, 8, 8);
const bubbleMat = new THREE.MeshBasicMaterial({
  color: 0xd4a878,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, bubbleCount);
bubbles.visible = false;
bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(bubbles);

const bubbleData = [];
const dummyMat = new THREE.Matrix4();
const dummyScale = new THREE.Vector3();
const dummyPos = new THREE.Vector3();
const dummyQuat = new THREE.Quaternion();

for (let i = 0; i < bubbleCount; i++){
  bubbleData.push({
    x: (Math.random() - 0.5) * 12,
    y: -8 + Math.random() * 8,
    z: (Math.random() - 0.5) * 6 - 1,
    speed: 0.3 + Math.random() * 0.6,
    size: 0.02 + Math.random() * 0.06,
    phase: Math.random() * Math.PI * 2,
  });
}

/* --- Gouttelettes d'impact --- */
const dropletCount = isMobile ? 16 : 30;
const dropletGeo = new THREE.SphereGeometry(1, 6, 6);
const dropletMat = new THREE.MeshBasicMaterial({
  color: 0xe0b088,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const droplets = new THREE.InstancedMesh(dropletGeo, dropletMat, dropletCount);
droplets.visible = false;
droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(droplets);

const dropletData = [];
for (let i = 0; i < dropletCount; i++){
  const angle = (i / dropletCount) * Math.PI * 2 + Math.random() * 0.4;
  const speed = 1.8 + Math.random() * 1.8;
  dropletData.push({
    vx: Math.cos(angle) * speed,
    vy: 2.8 + Math.random() * 2.2,
    vz: Math.sin(angle) * speed * 0.5,
    size: 0.04 + Math.random() * 0.05,
    startY: -3,
  });
}

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

  /* PHASE 2 — Morphing */
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

  /* PHASE 3 — Globe */
  .to(globeGroup.rotation, { y: Math.PI * 0.9, ease: 'none', duration: 1 }, 2.5)
  .to(cameraBase, { z: 4.4, x: 0.5, y: -0.1, ease: 'power1.inOut', duration: 1 }, 2.5)
  .to(camera, { fov: 40, ease: 'power1.inOut', duration: 1, onUpdate: () => camera.updateProjectionMatrix() }, 2.5)
  .to(lookAtTarget, { x: 0.3, y: 0, ease: 'power1.inOut', duration: 1 }, 2.5)

  /* PHASE 4 — Retour grain */
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

  /* PHASE 5 — Grain flotte */
  .to(beanGroup.rotation, { y: Math.PI * 9, ease: 'none', duration: 0.6 }, 4.7)
  .to(beanGroup.position, { x: 1.6, y: -1.2, z: -0.3, ease: 'power1.inOut', duration: 0.6 }, 4.7)
  .to(particles.material, { size: 0.04, opacity: 0.5, ease: 'none', duration: 0.6 }, 4.7)
  .to(cameraBase, { z: 7, x: 0.3, y: -0.2, ease: 'power2.inOut', duration: 0.6 }, 4.7)
  .to(camera, { fov: 52, ease: 'power2.inOut', duration: 0.6, onUpdate: () => camera.updateProjectionMatrix() }, 4.7)
  .to(lookAtTarget, { x: 0.2, y: -0.3, ease: 'power2.inOut', duration: 0.6 }, 4.7)

  /* PHASE 6 — CHUTE DU GRAIN */
  .to(beanGroup.position, { y: -14, ease: 'power2.in', duration: 0.7 }, 5.3)
  .to(beanGroup.rotation, { x: 4, y: Math.PI * 12, ease: 'power1.in', duration: 0.7 }, 5.3)
  .set(state, { beanGone: true }, 6.0)
  .set(state, { beanOpacity: 0 }, 6.0)
  .set(beanGroup, { visible: false }, 6.0)

  /* ==========================================
     PHASE 7 — IMPACT LIQUIDE + MONTÉE
     ========================================== */

  /* Gouttelettes qui jaillissent à l'impact */
  .set(droplets, { visible: true }, 6.0)
  .to(dropletMat, { opacity: 0.95, ease: 'power2.out', duration: 0.05 }, 6.0)
  .to(dropletMat, { opacity: 0, ease: 'power2.in', duration: 0.9 }, 6.5)
  .set(droplets, { visible: false }, 7.4)

  /* Impact : ondulation dans le shader */
  .set(liquidMat.uniforms.uImpactTime, { value: 0 }, 6.0)
  .to(liquidMat.uniforms.uImpactTime, { value: 3, ease: 'power1.out', duration: 2 }, 6.0)

  /* Agitation : forte au début, décroît lentement */
  .set(liquidMat.uniforms.uAgitation, { value: 1.5 }, 6.0)
  .to(liquidMat.uniforms.uAgitation, { value: 0.3, ease: 'power2.out', duration: 3.5 }, 6.0)

  /* Liquide apparaît et monte */
  .set(liquid, { visible: true }, 6.0)
  .to(liquidMat.uniforms.uProgress, { value: 1, ease: 'power2.out', duration: 1.5 }, 6.0)
  .to(liquid.position, { y: -3.5, ease: 'power2.out', duration: 1.5 }, 6.0)

  /* Bulles apparaissent */
    .set(bubbles, { visible: true }, 6.2)
  .to(bubbleMat, { opacity: 0.55, ease: 'power2.out', duration: 1 }, 6.2)
  
  /* Caméra recule */
  .to(cameraBase, { z: 8.5, x: 0, y: 0.5, ease: 'power2.inOut', duration: 1.5 }, 6.0)
  .to(camera, { fov: 55, ease: 'power2.inOut', duration: 1.5, onUpdate: () => camera.updateProjectionMatrix() }, 6.0)
  .to(lookAtTarget, { x: 0, y: -1.5, ease: 'power2.inOut', duration: 1.5 }, 6.0);

/* ============================================
   INTERACTIONS
   ============================================ */
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

let isDragging = false;
let hasMoved = false;
let prevPointer = { x: 0, y: 0 };
let dropletLocalTime = 0;

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

const mouse = { x: 0, y: 0 };
if (!isMobile) {
  addEventListener('mousemove', e => {
    mouse.x = (e.clientX / sizes.w) * 2 - 1;
    mouse.y = -((e.clientY / sizes.h) * 2 - 1);
  });
}

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

  if (!state.beanGone) {
    if (!isDragging || !state.globeVisible) {
      beanGroup.rotation.y += 0.0025;
    }
    beanMat.opacity = state.beanOpacity;
    if (beanMat.transparent !== (state.beanOpacity < 0.98)) {
      beanMat.transparent = state.beanOpacity < 0.98;
      beanMat.needsUpdate = true;
    }
  } else {
    beanGroup.visible = false;
  }

  if (globeGroup.visible !== state.globeVisible) {
    globeGroup.visible = state.globeVisible;
  }

  if (state.globeVisible && !isDragging) {
    globeInner.rotation.y += 0.0015;
  }

  markers.forEach((m, i) => {
    const pulse = 1 + Math.sin(t * 2.2 + i * 0.8) * 0.3;
    m.dot.scale.setScalar(pulse);
    const rpulse = 1 + Math.sin(t * 2.2 + i * 0.8) * 0.5;
    m.ring.scale.setScalar(rpulse);
  });

  particles.rotation.y = t * 0.05;
  particles.rotation.x = Math.sin(t * 0.3) * 0.05;

  liquidMat.uniforms.uTime.value = t;

  /* ===== Gouttelettes ===== */
  if (droplets.visible) {
    const impactT = liquidMat.uniforms.uImpactTime.value;
    if (impactT >= 0) {
      dropletLocalTime += 0.016;

      for (let i = 0; i < dropletCount; i++){
        const d = dropletData[i];
        const px = d.vx * dropletLocalTime;
        const py = d.startY + d.vy * dropletLocalTime - 5.5 * dropletLocalTime * dropletLocalTime;
        const pz = d.vz * dropletLocalTime;

        dummyPos.set(px, py, pz);
        const scale = Math.max(0.01, 1 - dropletLocalTime * 0.5);
        dummyScale.setScalar(d.size * scale);
        dummyQuat.set(0, 0, 0, 1);
        dummyMat.compose(dummyPos, dummyQuat, dummyScale);
        droplets.setMatrixAt(i, dummyMat);
      }
      droplets.instanceMatrix.needsUpdate = true;
    }
  } else {
    dropletLocalTime = 0;
  }

  /* ===== Bulles ===== */
  if (bubbles.visible) {
    const liquidY = liquid.position.y;
    const liquidTop = liquidY + 1.2;

    for (let i = 0; i < bubbleCount; i++){
      const b = bubbleData[i];
      b.y += b.speed * 0.016 * 2;

      if (b.y > liquidTop){
        b.y = liquidY - 1.5 + Math.random() * 0.5;
        b.x = (Math.random() - 0.5) * 12;
        b.z = (Math.random() - 0.5) * 6 - 1;
      }

      const wobX = Math.sin(t * 2 + b.phase) * 0.05;
      const wobZ = Math.cos(t * 1.7 + b.phase) * 0.05;

      dummyPos.set(b.x + wobX, b.y, b.z + wobZ);
      dummyScale.setScalar(b.size);
      dummyQuat.set(0, 0, 0, 1);
      dummyMat.compose(dummyPos, dummyQuat, dummyScale);
      bubbles.setMatrixAt(i, dummyMat);
    }
    bubbles.instanceMatrix.needsUpdate = true;
  }

  if (!state.beanGone) {
    gold.position.x = Math.cos(t * 0.6) * 3 + beanGroup.position.x;
    gold.position.z = Math.sin(t * 0.6) * 3;
  }

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

console.log('%cMéridien', 'font-family: serif; font-size: 20px; color: #C9A227;');
