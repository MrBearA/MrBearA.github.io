import * as THREE from 'three';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Title screen 3D: the MrBear voxel bear ----------
   Everything is built in code (no model file to download), so the page loads faster. */

const COLORS = { ink: 0x25283b, night: 0x1c1e2c, accent: 0xe8492c, soft: 0xffb4a5 };

// The same pixel bear as my itch.io banner. Each letter is one block colour.
const BEAR = [
  '..OO........OO..',
  '.OXXO......OXXO.',
  '.OXRXOOOOOOXRXO.',
  '..OXXXXXXXXXXO..',
  '..OXXXXXXXXXXO..',
  '.OXXXXXXXXXXXXO.',
  '.OXXWWXXXXWWXXO.',
  '.OXXWKXXXXWKXXO.',
  '.OXXXXXXXXXXXXO.',
  '.OXXXXSSSSXXXXO.',
  '.OXXXSSKKSSXXXO.',
  '.OXXXSSSSSSXXXO.',
  '..OXXXSRRSXXXO..',
  '...OXXXXXXXXO...',
  '....OOOOOOOO....',
];
const BEAR_COLORS = { O: 0x25283b, X: 0x7a5c4a, R: 0xffb4a5, W: 0xffffff, K: 0x1c1e2c, S: 0xd6b896 };

// Games shown in the "Now playing" bubble next to the bear. Image paths are relative to Main.html.
const NOW_PLAYING = [
  { name: 'SLOP MACHINE', image: '../Image/games/slop-machine-card.jpg', target: '#file-slop' },
  { name: 'Kuisina', image: '../Image/games/kuisina-card.jpg', target: '#file-kuisina' },
  { name: 'Pathways', image: '../Image/games/pathways-card.jpg', target: '#file-pathways' },
];

function buildBear() {
  const size = 0.21, depth = 5;
  const rows = BEAR.length, cols = BEAR[0].length;
  const cube = new THREE.BoxGeometry(size, size, size);
  const mats = {};
  const mat = (k) => mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: BEAR_COLORS[k], roughness: 0.75 }));
  const bear = new THREE.Group();
  const add = (k, c, r, z) => {
    const m = new THREE.Mesh(cube, mat(k));
    m.position.set((c - cols / 2 + 0.5) * size, (rows / 2 - r) * size, z);
    bear.add(m);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = BEAR[r][c];
      if (k === '.') continue;
      for (let z = 0; z < depth; z++) {
        // Only the front layer shows the face; the rest of the head is fur with an ink outline.
        const front = z === 0;
        add(front || k === 'O' ? k : 'X', c, r, ((depth - 1) / 2 - z) * size);
      }
      // The snout sticks out one block.
      if (r >= 9 && (k === 'S' || k === 'K' || k === 'R')) add(k, c, r, ((depth - 1) / 2 + 1) * size);
    }
  }
  return bear;
}

function createHero(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.5, 9.4);
  camera.lookAt(0, 0.45, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2030, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 6);
  const rim = new THREE.DirectionalLight(COLORS.accent, 2.4); // red-orange rim light to match the theme
  rim.position.set(-4, 2, -3);
  scene.add(key, rim);

  const bear = buildBear();
  scene.add(bear);

  let announced = false; // tell the loading screen after the first frame is drawn

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

  // Drag to turn the whole thing.
  let dragX = null, turn = 0;
  canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (dragX === null) return; turn += (e.clientX - dragX) * 0.01; dragX = e.clientX; });
  const stop = () => { dragX = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  return {
    render(t) {
      const spin = (reduceMotion ? 0.4 : t * 0.6) + turn;
      bear.rotation.y = spin;
      bear.position.y = 0.05 + (reduceMotion ? 0 : Math.sin(t * 2) * 0.06);
      renderer.render(scene, camera);
      if (!announced) { announced = true; window.dispatchEvent(new Event('boot:model-ready')); }
    },
  };
}

const heroes = [...document.querySelectorAll('.model-viewer')].map(createHero);

// One shared loop. requestAnimationFrame pauses by itself when the tab is hidden.
const start = performance.now();
function tick(now) {
  const t = (now - start) / 1000;
  for (const h of heroes) h.render(t);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- "Now playing" bubble: cycles through my games ---------- */

const bubble = document.getElementById('now-playing');
if (bubble && NOW_PLAYING.length) {
  const img = bubble.querySelector('img');
  const name = bubble.querySelector('.np-name');
  NOW_PLAYING.forEach((g) => { new Image().src = g.image; }); // preload so the swap is instant
  let i = 0, paused = false;
  const show = (k) => {
    const g = NOW_PLAYING[k];
    bubble.classList.add('swap');
    setTimeout(() => {
      img.src = g.image;
      name.textContent = g.name;
      bubble.href = g.target;
      bubble.setAttribute('aria-label', `Now playing: ${g.name}. Go to its save file`);
      bubble.classList.remove('swap');
    }, reduceMotion ? 0 : 180);
  };
  show(0);
  bubble.addEventListener('mouseenter', () => { paused = true; });
  bubble.addEventListener('mouseleave', () => { paused = false; });
  bubble.addEventListener('focus', () => { paused = true; });
  bubble.addEventListener('blur', () => { paused = false; });
  if (!reduceMotion) setInterval(() => { if (!paused) { i = (i + 1) % NOW_PLAYING.length; show(i); } }, 3000);
}

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
