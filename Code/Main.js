import * as THREE from 'three';
import { FBXLoader } from 'three/loaders/FBXLoader.js';

const loader = new FBXLoader();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const viewers = [];

/* ---------- 3D model loading ---------- */

// Download a model file and parse it. Kept in one function so the
// loading method is easy to swap (e.g. to GLTFLoader for .glb files later).
async function loadModel(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buffer = await res.arrayBuffer();
  const folder = url.slice(0, url.lastIndexOf('/') + 1); // where textures live
  return loader.parse(buffer, folder);
}

// Centre any model and scale it to fill the canvas, whatever size it was exported at.
function fitToView(object, camera, fill = 0.85) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);

  const visibleH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const visibleW = visibleH * camera.aspect;
  const biggest = Math.max(size.x, size.y, size.z) || 1;

  const pivot = new THREE.Group();
  pivot.add(object);
  pivot.scale.setScalar((Math.min(visibleH, visibleW) * fill) / biggest);
  return pivot;
}

function createViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 4);

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(2, 3, 5);
  const rim = new THREE.DirectionalLight(0xe8492c, 0.8); // red-orange rim light to match the theme
  rim.position.set(-3, 1, -2);
  scene.add(key, rim);

  const viewer = { renderer, scene, camera, model: null };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  loadModel(canvas.dataset.model)
    .then((object) => {
      viewer.model = fitToView(object, camera);
      scene.add(viewer.model);
    })
    .catch((err) => {
      console.error('Failed to load model:', canvas.dataset.model, err);
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xe8492c })
      );
      viewer.model = cube;
      scene.add(cube);
    });

  return viewer;
}

document.querySelectorAll('.model-viewer').forEach((canvas) => viewers.push(createViewer(canvas)));

// One shared loop. requestAnimationFrame pauses by itself when the tab is hidden.
let last = performance.now();
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  for (const v of viewers) {
    if (v.model && !reduceMotion) v.model.rotation.y += dt * 0.8;
    v.renderer.render(v.scene, v.camera);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- Title menu: arrow keys + Enter, like a real game ---------- */

const titleScreen = document.getElementById('top');
const menuItems = [...document.querySelectorAll('.title-menu a')];
let selected = 0;

function select(index) {
  selected = (index + menuItems.length) % menuItems.length;
  menuItems.forEach((item, i) => item.classList.toggle('selected', i === selected));
}

menuItems.forEach((item, i) => {
  item.addEventListener('mouseenter', () => select(i));
  item.addEventListener('focus', () => select(i));
});

// Only react while the title screen is on screen, and never while typing in a field.
let titleVisible = true;
new IntersectionObserver(([entry]) => { titleVisible = entry.isIntersecting; }, { threshold: 0.5 })
  .observe(titleScreen);

document.addEventListener('keydown', (e) => {
  if (!titleVisible || e.target.closest('input, textarea, select')) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); select(selected + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); select(selected - 1); }
  else if (e.key === 'Enter' && (e.target === document.body || menuItems.includes(e.target))) {
    e.preventDefault();
    menuItems[selected].click();
  }
});

/* ---------- Save files: play the gameplay clip on hover / keyboard focus ---------- */

document.querySelectorAll('.hover-clip').forEach((video) => {
  const save = video.closest('.save');
  const play = () => {
    if (reduceMotion) return;
    video.play().then(() => video.classList.add('playing')).catch(() => {});
  };
  const stop = () => {
    video.pause();
    video.classList.remove('playing');
  };
  save.addEventListener('mouseenter', play);
  save.addEventListener('mouseleave', stop);
  save.addEventListener('focusin', play);
  save.addEventListener('focusout', stop);
});

/* ---------- Highlight the menu link for the section on screen ---------- */

const navLinks = new Map(
  [...document.querySelectorAll('.main-nav a')].map((a) => [a.getAttribute('href').slice(1), a])
);

const sectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      navLinks.forEach((a) => a.classList.remove('active'));
      navLinks.get(entry.target.id)?.classList.add('active');
    }
  },
  { rootMargin: '-45% 0px -50% 0px' }
);

navLinks.forEach((_, id) => {
  const section = document.getElementById(id);
  if (section) sectionObserver.observe(section);
});
