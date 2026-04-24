/* =============================================================================
   SlingDoc 3D stage — main.js
   -----------------------------------------------------------------------------
   A single, looping Three.js animation that tells the core product story:

     1. A smartphone sits in view, screen dark.
     2. The camera opens. A viewfinder reticle appears.
     3. An employee ID badge floats into frame and is centered.
     4. A bright flash. Badge "captured" with a green check.
     5. The phone transitions to the Messages app.
     6. The word "clock-in" types itself out, letter by letter.
     7. The send button pulses, the message bubble flies up.
     8. An HTML overlay card fades in: "It's that easy!"
     9. Brief hold, fade, loop.

   Accessibility sync:
     - A live region (#stage-label) narrates the current phase for screen readers.
     - Reduced-motion users get a static HTML fallback instead of the 3D canvas.
     - Play/Pause and Replay buttons are keyboard-operable.
   ========================================================================== */

/* ---------------------------------------------------------------------------
   Timing state — declared up top so pre-boot motion toggling works safely
   --------------------------------------------------------------------------- */
let elapsed = 0;
let lastTimestamp = 0;
let isPlaying = false;

/* ---------------------------------------------------------------------------
   DOM refs (synchronous — don't need Three.js)
   --------------------------------------------------------------------------- */
const mount = document.getElementById('stage-canvas');
const labelEl = document.getElementById('stage-label');
const easyCard = document.getElementById('easy-card');
const playBtn = document.getElementById('stage-play');
const replayBtn = document.getElementById('stage-replay');
const motionToggle = document.getElementById('motion-toggle');
const stageEl = document.querySelector('.stage');

/* ---------------------------------------------------------------------------
   Motion preference & state
   --------------------------------------------------------------------------- */
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = motionQuery.matches;

function applyReduceMotion(on) {
  reduceMotion = on;
  stageEl.classList.toggle('is-static', on);
  document.getElementById('stage-static').hidden = !on;
  motionToggle.setAttribute('aria-pressed', String(on));
  if (on) {
    isPlaying = false;
    labelEl.textContent = 'Static view';
  } else {
    isPlaying = true;
    lastTimestamp = performance.now();
    elapsed = 0;
    // Kick the boot if the user enabled motion before the hero scrolled in
    startBoot && startBoot();
  }
}

motionToggle.addEventListener('click', () => applyReduceMotion(!reduceMotion));
motionQuery.addEventListener?.('change', e => applyReduceMotion(e.matches));

/* ---------------------------------------------------------------------------
   Deferred Three.js boot
   -----------------------------------------------------------------------------
   Three.js is ~1.2MB parsed. Instead of loading it at page open we wait
   until either (a) the hero stage enters the viewport, or (b) the user
   explicitly interacts with a play/replay control. This keeps the heavy JS
   parse off the LCP critical path on mobile.
   --------------------------------------------------------------------------- */
let startBoot;
const bootReady = new Promise(resolve => { startBoot = resolve; });

if (reduceMotion) {
  applyReduceMotion(true);
  // Static fallback is shown; Three.js will load if the user flips the toggle
  // back off — handled in applyReduceMotion.
} else if ('IntersectionObserver' in window && (stageEl || mount)) {
  const bootObserver = new IntersectionObserver((entries, obs) => {
    if (entries.some(e => e.isIntersecting)) {
      obs.disconnect();
      startBoot();
    }
  }, { rootMargin: '400px 0px' });
  bootObserver.observe(stageEl || mount);
  playBtn?.addEventListener('click', () => startBoot(), { once: true });
  replayBtn?.addEventListener('click', () => startBoot(), { once: true });
} else {
  startBoot();
}

/* Top-level await — nothing below runs until the hero is near the viewport
   AND the Three.js bundle has downloaded and parsed. */
await bootReady;
const THREE = await import('three');
const { RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js');

isPlaying = !reduceMotion;
lastTimestamp = performance.now();

/* ---------------------------------------------------------------------------
   Scene · camera · renderer
   --------------------------------------------------------------------------- */
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0.4, 6.6);
camera.lookAt(0, -0.2, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
mount.appendChild(renderer.domElement);

/* ---------------------------------------------------------------------------
   Lights — soft industrial studio feel
   --------------------------------------------------------------------------- */
const ambient = new THREE.AmbientLight(0xd6e4ff, 0.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
keyLight.position.set(3, 4, 4);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xb8e639, 0.9); // lime rim
rimLight.position.set(-3, 1, -2);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x6fa0ff, 0.6, 15);
fillLight.position.set(-2, -1, 3);
scene.add(fillLight);

/* ---------------------------------------------------------------------------
   Group that holds everything (lets us gently float/rotate the whole scene)
   --------------------------------------------------------------------------- */
const root = new THREE.Group();
scene.add(root);

/* ---------------------------------------------------------------------------
   PHONE
   ---------------------------------------------------------------------------
   Built from a rounded-box body, a rounded-box screen inset, and a
   CanvasTexture that we redraw to simulate the UI changing.
   --------------------------------------------------------------------------- */

const PHONE_W = 1.7;
const PHONE_H = 3.4;
const PHONE_D = 0.22;

const phoneGroup = new THREE.Group();
root.add(phoneGroup);

// Body — extruded from a rounded rect so we get big, pleasant face corners
// and a subtle edge bevel that stays correct regardless of depth.
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0x15171c,
  metalness: 0.35,
  roughness: 0.55,
  clearcoat: 0.6,
  clearcoatRoughness: 0.35
});

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const bodyShape = roundedRectShape(PHONE_W, PHONE_H, 0.22);
const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
  depth: PHONE_D,
  bevelEnabled: true,
  bevelThickness: 0.04,
  bevelSize: 0.03,
  bevelOffset: 0,
  bevelSegments: 4,
  curveSegments: 18
});
// Center on Z
bodyGeo.translate(0, 0, -PHONE_D / 2);
const body = new THREE.Mesh(bodyGeo, bodyMat);
phoneGroup.add(body);

/* Phone screen — canvas texture, drawn as the UI changes.
   We draw at 512×1024 so text stays crisp. */
const SCREEN_W = 512;
const SCREEN_H = 1024;
const screenCanvas = document.createElement('canvas');
screenCanvas.width = SCREEN_W;
screenCanvas.height = SCREEN_H;
const screenCtx = screenCanvas.getContext('2d');
const screenTexture = new THREE.CanvasTexture(screenCanvas);
screenTexture.colorSpace = THREE.SRGBColorSpace;
screenTexture.anisotropy = 8;

const screenMat = new THREE.MeshBasicMaterial({
  map: screenTexture,
  toneMapped: false
});
// Body front face sits at z = PHONE_D/2 + bevelThickness(0.04) = 0.15 after the
// geometry.translate(0,0,-PHONE_D/2). Screen must be forward of that or it
// gets hidden inside the body (looks totally black).
const SCREEN_FRONT_Z = PHONE_D / 2 + 0.045;
const screenGeo = new THREE.PlaneGeometry(PHONE_W - 0.16, PHONE_H - 0.28);
const screen = new THREE.Mesh(screenGeo, screenMat);
screen.position.z = SCREEN_FRONT_Z;
phoneGroup.add(screen);

// Thin black bezel behind the screen so any gap reads as bezel, not dark body
const bezelMat = new THREE.MeshBasicMaterial({ color: 0x05060a });
const bezelGeo = new THREE.PlaneGeometry(PHONE_W - 0.05, PHONE_H - 0.12);
const bezel = new THREE.Mesh(bezelGeo, bezelMat);
bezel.position.z = SCREEN_FRONT_Z - 0.002;
phoneGroup.add(bezel);

// Small speaker notch + front camera dot at top of screen
const notchGeo = new THREE.PlaneGeometry(0.55, 0.14);
const notchMat = new THREE.MeshBasicMaterial({ color: 0x07080a });
const notch = new THREE.Mesh(notchGeo, notchMat);
notch.position.set(0, (PHONE_H - 0.28) / 2 - 0.12, SCREEN_FRONT_Z + 0.003);
phoneGroup.add(notch);

/* ---------------------------------------------------------------------------
   BADGE — employee ID on a lanyard
   --------------------------------------------------------------------------- */
const badgeGroup = new THREE.Group();
root.add(badgeGroup);

// Badge card
const BADGE_W = 1.25;
const BADGE_H = 1.65;
const BADGE_D = 0.04;

// Canvas texture for the badge front (photo + name)
const badgeCanvas = document.createElement('canvas');
badgeCanvas.width = 512;
badgeCanvas.height = 680;
drawBadge(badgeCanvas.getContext('2d'));
const badgeTexture = new THREE.CanvasTexture(badgeCanvas);
badgeTexture.colorSpace = THREE.SRGBColorSpace;
badgeTexture.anisotropy = 8;

const badgeMats = [
  new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.85 }), // side
  new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ map: badgeTexture, roughness: 0.7 }), // FRONT
  new THREE.MeshStandardMaterial({ color: 0xe5e1d4, roughness: 0.85 })    // back
];
const badgeGeo = new RoundedBoxGeometry(BADGE_W, BADGE_H, BADGE_D, 3, 0.06);
const badge = new THREE.Mesh(badgeGeo, badgeMats);
badgeGroup.add(badge);

// Lanyard (a small simple cloth-like strip hanging from top of badge)
const lanyardShape = new THREE.Shape();
lanyardShape.moveTo(-0.08, 0);
lanyardShape.lineTo(0.08, 0);
lanyardShape.lineTo(0.08, 0.9);
lanyardShape.lineTo(-0.08, 0.9);
lanyardShape.lineTo(-0.08, 0);
const lanyardGeo = new THREE.ExtrudeGeometry(lanyardShape, {
  depth: 0.01,
  bevelEnabled: false
});
const lanyardMat = new THREE.MeshStandardMaterial({ color: 0x0a1a3c, roughness: 0.9 });
const lanyard = new THREE.Mesh(lanyardGeo, lanyardMat);
lanyard.position.set(0, BADGE_H / 2, 0);
badgeGroup.add(lanyard);

// Clip ring at top of badge
const clipGeo = new THREE.TorusGeometry(0.06, 0.018, 8, 18);
const clipMat = new THREE.MeshStandardMaterial({ color: 0x9a9890, metalness: 0.8, roughness: 0.3 });
const clip = new THREE.Mesh(clipGeo, clipMat);
clip.position.set(0, BADGE_H / 2 + 0.02, 0);
clip.rotation.x = Math.PI / 2;
badgeGroup.add(clip);

// Start badge far off-stage
badgeGroup.position.set(4.5, 0, 0.35);
badgeGroup.rotation.set(0.05, -0.35, -0.12);
badgeGroup.visible = false;

/* ---------------------------------------------------------------------------
   FLASH OVERLAY — a bright plane in front of the phone, flashes during capture
   --------------------------------------------------------------------------- */
const flashMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  depthWrite: false
});
const flashGeo = new THREE.PlaneGeometry(PHONE_W - 0.16, PHONE_H - 0.28);
const flashMesh = new THREE.Mesh(flashGeo, flashMat);
flashMesh.position.z = SCREEN_FRONT_Z + 0.005;
phoneGroup.add(flashMesh);

/* ---------------------------------------------------------------------------
   Floor shadow (fake cheap contact shadow)
   --------------------------------------------------------------------------- */
const shadowGeo = new THREE.PlaneGeometry(3, 1.5);
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = 128; shadowCanvas.height = 64;
(() => {
  const c = shadowCanvas.getContext('2d');
  const grad = c.createRadialGradient(64, 32, 5, 64, 32, 52);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, 128, 64);
})();
const shadowTex = new THREE.CanvasTexture(shadowCanvas);
const shadowMat = new THREE.MeshBasicMaterial({
  map: shadowTex,
  transparent: true,
  depthWrite: false,
  opacity: 0.7
});
const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -2.1;
root.add(shadowPlane);

/* ---------------------------------------------------------------------------
   Timeline configuration
   ---------------------------------------------------------------------------
   Each phase: { id, label, start (ms), end (ms) }
   --------------------------------------------------------------------------- */
const TIMELINE = [
  { id: 'intro',         label: 'Your phone.',            start:     0, end:   800 },
  { id: 'home',          label: 'Home screen',            start:   800, end:  2400 },
  { id: 'camera-on',     label: 'Opening camera…',        start:  2400, end:  3000 },
  { id: 'badge-enter',   label: 'Snap your badge',        start:  3000, end:  4300 },
  { id: 'shutter-press', label: 'Tap to capture',         start:  4300, end:  4700 },
  { id: 'flash',         label: 'Captured',               start:  4700, end:  5100 },
  { id: 'to-sms',        label: 'Switching to messages',  start:  5100, end:  5800 },
  { id: 'typing',        label: 'Texting "clock in"',     start:  5800, end:  7600 },
  { id: 'send-press',    label: 'Tap send',               start:  7600, end:  7900 },
  { id: 'sending',       label: 'Sending…',               start:  7900, end:  8600 },
  { id: 'confirm',       label: 'Clocked in ✓',           start:  8600, end: 10600 },
  { id: 'fade',          label: '',                       start: 10600, end: 12000 }
];
const LOOP_DURATION = TIMELINE[TIMELINE.length - 1].end;

/* ---------------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------------- */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/* ---------------------------------------------------------------------------
   Badge texture drawing (static, once)
   --------------------------------------------------------------------------- */
function drawBadge(c) {
  // paper background
  c.fillStyle = '#FAF8F2';
  c.fillRect(0, 0, 512, 680);

  // header bar (navy with lime strip)
  c.fillStyle = '#0A1A3C';
  c.fillRect(0, 0, 512, 90);
  c.fillStyle = '#B8E639';
  c.fillRect(0, 90, 512, 6);

  // brand text
  c.fillStyle = '#FAF8F2';
  c.font = '600 34px "Bricolage Grotesque", sans-serif';
  c.textBaseline = 'middle';
  c.fillText('sling', 40, 46);
  c.fillStyle = '#B8E639';
  c.fillText('doc', 40 + c.measureText('sling').width + 2, 46);

  // photo circle placeholder
  c.save();
  c.beginPath();
  c.arc(256, 240, 100, 0, Math.PI * 2);
  c.closePath();
  c.clip();

  // simple gradient avatar
  const grad = c.createLinearGradient(156, 140, 356, 340);
  grad.addColorStop(0, '#1E3A7A');
  grad.addColorStop(1, '#0A1A3C');
  c.fillStyle = grad;
  c.fillRect(156, 140, 200, 200);

  // silhouette head & shoulders
  c.fillStyle = '#D4D0C0';
  c.beginPath();
  c.arc(256, 220, 42, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(256, 330, 78, 52, 0, 0, Math.PI * 2);
  c.fill();

  c.restore();

  // circle outline
  c.strokeStyle = '#0A1A3C';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(256, 240, 100, 0, Math.PI * 2);
  c.stroke();

  // name
  c.fillStyle = '#0A1A3C';
  c.font = '600 36px "Bricolage Grotesque", sans-serif';
  c.textAlign = 'center';
  c.fillText('MARIA SANTOS', 256, 400);

  // role
  c.font = '400 22px "Manrope", sans-serif';
  c.fillStyle = '#5E5E55';
  c.fillText('Site Lead · Jobsite A', 256, 440);

  // barcode
  c.fillStyle = '#0A1A3C';
  let x = 70;
  while (x < 442) {
    const w = Math.random() < 0.5 ? 2 : 4;
    c.fillRect(x, 490, w, 60);
    x += w + (Math.random() < 0.5 ? 2 : 3);
  }

  // id number
  c.fillStyle = '#3A3A36';
  c.font = '500 18px "JetBrains Mono", monospace';
  c.fillText('ID · 4829-SLD-0071', 256, 585);

  // footer chip
  c.fillStyle = '#0A1A3C';
  c.fillRect(50, 620, 412, 40);
  c.fillStyle = '#B8E639';
  c.font = '500 16px "JetBrains Mono", monospace';
  c.fillText('AUTHORIZED PERSONNEL · 2026', 256, 641);
}

/* ---------------------------------------------------------------------------
   Phone screen drawing — redraws when phase state changes
   ---------------------------------------------------------------------------
   Each phase writes its own layer; we use a small dirty-flag system so we
   only repaint when something changes (typed letters, bubble position, etc).
   --------------------------------------------------------------------------- */

// State that drives the drawing
const screenState = {
  phase: 'intro',
  phaseT: 0,           // local progress 0..1 within phase
  typedChars: 0,       // for typing phase
  bubbleY: 0,          // sending phase
  shutterFlashT: 0,    // for capture UX
  captured: false      // whether we've snapped the badge
};

/* ---------------------------------------------------------------------------
   App-icon glyphs for the home screen
   --------------------------------------------------------------------------- */
function drawAppGlyph(c, kind, cx, cy, size, bg) {
  const darkBg = bg === '#ffffff' || bg === '#ffd74a' || bg === '#f0efe5';
  const fg = darkBg ? '#0a1a3c' : '#ffffff';
  const s = size * 0.38;
  c.save();
  c.fillStyle = fg;
  c.strokeStyle = fg;
  c.lineWidth = 4;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  switch (kind) {
    case 'phone': {
      c.beginPath();
      c.moveTo(cx - s * 0.45, cy - s * 0.45);
      c.quadraticCurveTo(cx - s * 0.55, cy - s * 0.55, cx - s * 0.1, cy - s * 0.55);
      c.lineTo(cx, cy - s * 0.25);
      c.lineTo(cx - s * 0.15, cy - s * 0.05);
      c.quadraticCurveTo(cx + s * 0.1, cy + s * 0.25, cx + s * 0.35, cy + s * 0.1);
      c.lineTo(cx + s * 0.55, cy + s * 0.3);
      c.quadraticCurveTo(cx + s * 0.55, cy + s * 0.55, cx + s * 0.15, cy + s * 0.55);
      c.quadraticCurveTo(cx - s * 0.55, cy + s * 0.2, cx - s * 0.45, cy - s * 0.45);
      c.fill();
      break;
    }
    case 'chat': {
      c.beginPath();
      c.roundRect(cx - s * 0.55, cy - s * 0.45, s * 1.1, s * 0.85, s * 0.28);
      c.fill();
      c.beginPath();
      c.moveTo(cx - s * 0.35, cy + s * 0.35);
      c.lineTo(cx - s * 0.5, cy + s * 0.55);
      c.lineTo(cx - s * 0.15, cy + s * 0.35);
      c.closePath();
      c.fill();
      // dots
      c.fillStyle = bg;
      [-0.22, 0, 0.22].forEach(dx => {
        c.beginPath();
        c.arc(cx + s * dx, cy - s * 0.05, s * 0.06, 0, Math.PI * 2);
        c.fill();
      });
      break;
    }
    case 'camera': {
      // top nub
      c.fillStyle = fg;
      c.beginPath();
      c.roundRect(cx - s * 0.22, cy - s * 0.55, s * 0.44, s * 0.15, 4);
      c.fill();
      // body
      c.beginPath();
      c.roundRect(cx - s * 0.6, cy - s * 0.4, s * 1.2, s * 0.85, 10);
      c.stroke();
      // lens
      c.beginPath();
      c.arc(cx, cy + s * 0.05, s * 0.28, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(cx, cy + s * 0.05, s * 0.1, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'clock': {
      c.beginPath();
      c.arc(cx, cy, s * 0.55, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(cx, cy); c.lineTo(cx, cy - s * 0.38);
      c.moveTo(cx, cy); c.lineTo(cx + s * 0.28, cy);
      c.stroke();
      c.beginPath();
      c.arc(cx, cy, s * 0.06, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'mail': {
      c.beginPath();
      c.roundRect(cx - s * 0.55, cy - s * 0.3, s * 1.1, s * 0.65, 6);
      c.fill();
      c.strokeStyle = bg;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(cx - s * 0.5, cy - s * 0.25);
      c.lineTo(cx, cy + s * 0.08);
      c.lineTo(cx + s * 0.5, cy - s * 0.25);
      c.stroke();
      break;
    }
    case 'photos': {
      const colors = ['#f5a623', '#e84d3d', '#6bd9a8', '#4a90e2', '#9b4aea'];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        c.fillStyle = colors[i];
        c.save();
        c.translate(cx + Math.cos(a) * s * 0.2, cy + Math.sin(a) * s * 0.2);
        c.rotate(a);
        c.beginPath();
        c.ellipse(0, 0, s * 0.28, s * 0.15, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      break;
    }
    case 'map': {
      c.fillStyle = '#c6e3a8';
      c.beginPath();
      c.roundRect(cx - s * 0.6, cy - s * 0.5, s * 1.2, s, 6);
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(cx - s * 0.5, cy - s * 0.3);
      c.quadraticCurveTo(cx, cy, cx + s * 0.4, cy + s * 0.3);
      c.stroke();
      c.fillStyle = '#e84d3d';
      c.beginPath();
      c.arc(cx + s * 0.15, cy - s * 0.05, s * 0.12, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'note': {
      c.strokeStyle = fg;
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(cx - s * 0.15, cy + s * 0.35);
      c.lineTo(cx - s * 0.15, cy - s * 0.45);
      c.lineTo(cx + s * 0.4, cy - s * 0.55);
      c.lineTo(cx + s * 0.4, cy + s * 0.2);
      c.stroke();
      c.fillStyle = fg;
      c.beginPath();
      c.ellipse(cx - s * 0.25, cy + s * 0.35, s * 0.15, s * 0.1, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(cx + s * 0.3, cy + s * 0.2, s * 0.15, s * 0.1, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'cal': {
      c.fillStyle = '#e84d3d';
      c.fillRect(cx - s * 0.5, cy - s * 0.5, s, s * 0.22);
      c.fillStyle = '#333';
      c.font = `700 ${Math.round(s * 0.55)}px "Bricolage Grotesque", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('24', cx, cy + s * 0.15);
      break;
    }
    case 'weather': {
      c.fillStyle = '#ffd03a';
      c.beginPath();
      c.arc(cx - s * 0.15, cy - s * 0.1, s * 0.28, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(cx - s * 0.05, cy + s * 0.15, s * 0.22, 0, Math.PI * 2);
      c.arc(cx + s * 0.2, cy + s * 0.15, s * 0.18, 0, Math.PI * 2);
      c.arc(cx + s * 0.05, cy + s * 0.05, s * 0.2, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'notes': {
      c.fillStyle = '#fff';
      c.fillRect(cx - s * 0.45, cy - s * 0.5, s * 0.9, s);
      c.strokeStyle = '#d4b038';
      c.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(cx - s * 0.35, cy - s * 0.3 + i * s * 0.22);
        c.lineTo(cx + s * 0.35, cy - s * 0.3 + i * s * 0.22);
        c.stroke();
      }
      break;
    }
    case 'gear': {
      const spokes = 8;
      c.fillStyle = fg;
      c.beginPath();
      for (let i = 0; i < spokes * 2; i++) {
        const a = (i / (spokes * 2)) * Math.PI * 2;
        const r = (i % 2 === 0) ? s * 0.5 : s * 0.38;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
      c.fillStyle = bg;
      c.beginPath();
      c.arc(cx, cy, s * 0.18, 0, Math.PI * 2);
      c.fill();
      break;
    }
  }
  c.restore();
}

/* ---------------------------------------------------------------------------
   Home-screen draw (app-icon grid with Camera about to be tapped)
   --------------------------------------------------------------------------- */
function drawHome(c, W, H, t) {
  // Wallpaper
  const wall = c.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#2a3768');
  wall.addColorStop(0.5, '#1a234a');
  wall.addColorStop(1, '#0a1130');
  c.fillStyle = wall;
  c.fillRect(0, 0, W, H);

  // subtle radial glow
  const glow = c.createRadialGradient(W / 2, H * 0.35, 20, W / 2, H * 0.35, H * 0.5);
  glow.addColorStop(0, 'rgba(184,230,57,0.08)');
  glow.addColorStop(1, 'rgba(184,230,57,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);

  // Status bar (white)
  c.fillStyle = '#fff';
  c.font = '600 28px "JetBrains Mono", monospace';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText('7:58', 36, 44);
  c.textAlign = 'right';
  c.fillText('LTE •••• ◼', W - 36, 44);
  c.textAlign = 'left';

  // Icon grid: 4 cols × 3 rows
  const apps = [
    { name: 'FaceTime', bg: '#1fb854', icon: 'phone' },
    { name: 'Messages', bg: '#5ad56a', icon: 'chat' },
    { name: 'Mail',     bg: '#2f8cff', icon: 'mail' },
    { name: 'Clock',    bg: '#0a0a0a', icon: 'clock' },
    { name: 'Camera',   bg: '#2b2b2e', icon: 'camera' }, // ← highlighted
    { name: 'Photos',   bg: '#f7f5ea', icon: 'photos' },
    { name: 'Maps',     bg: '#f0efe5', icon: 'map' },
    { name: 'Music',    bg: '#ff3a6b', icon: 'note' },
    { name: 'Calendar', bg: '#ffffff', icon: 'cal' },
    { name: 'Weather',  bg: '#54a7ff', icon: 'weather' },
    { name: 'Notes',    bg: '#ffd74a', icon: 'notes' },
    { name: 'Settings', bg: '#8b8b8b', icon: 'gear' }
  ];
  const cameraIndex = 4;

  const cols = 4, rows = 3;
  const padX = 46;
  const padTop = 130;
  const iconSize = 96;
  const gridW = W - padX * 2;
  const gapX = (gridW - iconSize * cols) / (cols - 1);
  const gapY = 50;
  const rowStride = iconSize + gapY + 28;

  apps.forEach((app, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padX + col * (iconSize + gapX);
    const y = padTop + row * rowStride;
    const isCam = (i === cameraIndex);

    // Camera: pulse + press in second half of phase
    let tileX = x, tileY = y, tileSize = iconSize;
    if (isCam && t > 0.55) {
      const ht = (t - 0.55) / 0.45;
      const pulse = 0.5 + 0.5 * Math.sin(ht * Math.PI * 2.4);
      // Highlight ring
      c.save();
      c.globalAlpha = 0.35 + pulse * 0.55;
      c.strokeStyle = '#B8E639';
      c.lineWidth = 6;
      c.beginPath();
      c.roundRect(x - 10, y - 10, iconSize + 20, iconSize + 20, 28);
      c.stroke();
      c.restore();
      // Press scale near the very end
      if (t > 0.88) {
        const pt = (t - 0.88) / 0.12;
        const scale = 1 - pt * 0.1;
        tileSize = iconSize * scale;
        tileX = x + (iconSize - tileSize) / 2;
        tileY = y + (iconSize - tileSize) / 2;
      }
    }

    // Tile with soft shadow
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.35)';
    c.shadowBlur = 12;
    c.shadowOffsetY = 4;
    c.fillStyle = app.bg;
    c.beginPath();
    c.roundRect(tileX, tileY, tileSize, tileSize, 22);
    c.fill();
    c.restore();

    // Glyph
    drawAppGlyph(c, app.icon, tileX + tileSize / 2, tileY + tileSize / 2, tileSize, app.bg);

    // Label
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.font = '500 17px "Manrope", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText(app.name, x + iconSize / 2, y + iconSize + 10);
  });

  // Page dots
  c.textAlign = 'left';
  c.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(W / 2 + (i - 1) * 22, H - 230, 4.5, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(W / 2, H - 230, 5.5, 0, Math.PI * 2);
  c.fill();

  // Dock
  c.fillStyle = 'rgba(255,255,255,0.08)';
  c.beginPath();
  c.roundRect(30, H - 190, W - 60, 140, 32);
  c.fill();

  // Dock icons (Phone, Safari, Messages, Music)
  const dockApps = [
    { bg: '#1fb854', icon: 'phone' },
    { bg: '#1f8bff', icon: 'map' },
    { bg: '#5ad56a', icon: 'chat' },
    { bg: '#ff3a6b', icon: 'note' }
  ];
  const dockSize = 80;
  const dockGap = (W - 60 - dockSize * 4) / 5;
  dockApps.forEach((app, i) => {
    const dx = 30 + dockGap * (i + 1) + dockSize * i;
    const dy = H - 190 + (140 - dockSize) / 2;
    c.fillStyle = app.bg;
    c.beginPath();
    c.roundRect(dx, dy, dockSize, dockSize, 18);
    c.fill();
    drawAppGlyph(c, app.icon, dx + dockSize / 2, dy + dockSize / 2, dockSize, app.bg);
  });

  // Home indicator bar
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.beginPath();
  c.roundRect(W / 2 - 90, H - 18, 180, 6, 3);
  c.fill();
}

function drawScreen() {
  const c = screenCtx;
  const W = SCREEN_W, H = SCREEN_H;

  // Clear
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);

  const phase = screenState.phase;

  if (phase === 'intro') {
    // screen off + subtle highlight
    c.fillStyle = '#0a0c10';
    c.fillRect(0, 0, W, H);
    const sheen = c.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, 'rgba(255,255,255,0.04)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    c.fillStyle = sheen;
    c.fillRect(0, 0, W, H);
    return;
  }

  if (phase === 'home') {
    drawHome(c, W, H, screenState.phaseT);
    return;
  }

  // Status bar — time, signal, battery (shared across all "on" phases)
  function drawStatusBar(tint = '#fff') {
    c.fillStyle = tint;
    c.font = '600 28px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('7:58', 36, 44);
    c.textAlign = 'right';
    c.fillText('LTE •••• ◼', W - 36, 44);
    c.textAlign = 'left';
  }

  if (phase === 'camera-on' || phase === 'badge-enter' || phase === 'shutter-press' || phase === 'flash') {
    // Camera viewfinder
    c.fillStyle = '#0a0c10';
    c.fillRect(0, 0, W, H);

    drawStatusBar('#f7f7f0');

    // Viewfinder frame geometry
    const vfMargin = 70;
    const vfTop = 120;
    const vfH = H - 360;
    const vfW = W - vfMargin * 2;

    // ====== Badge image INSIDE the viewfinder (like a real photo preview) ======
    // Slides in from the right during badge-enter, settles centered, then stays
    let badgeProgress = 0;
    if (phase === 'badge-enter') badgeProgress = easeOutBack(clamp(screenState.phaseT * 1.15, 0, 1));
    else if (phase === 'shutter-press' || phase === 'flash') badgeProgress = 1;

    if (badgeProgress > 0) {
      c.save();
      // Clip to viewfinder area so the badge slides in from the edge cleanly
      c.beginPath();
      c.rect(vfMargin, vfTop, vfW, vfH);
      c.clip();

      // Badge display size inside viewfinder
      const bDispW = vfW * 0.72;
      const bDispH = bDispW * (680 / 512); // preserve badge canvas aspect
      const bFinalX = vfMargin + (vfW - bDispW) / 2;
      const bStartX = W + 40; // off-screen right
      const bX = lerp(bStartX, bFinalX, badgeProgress);
      const bY = vfTop + (vfH - bDispH) / 2;
      // slight tilt on entry
      const tilt = lerp(0.12, 0, badgeProgress);

      c.translate(bX + bDispW / 2, bY + bDispH / 2);
      c.rotate(tilt);
      c.drawImage(badgeCanvas, -bDispW / 2, -bDispH / 2, bDispW, bDispH);
      c.restore();
    }

    // Corner brackets (drawn OVER the badge so they read as viewfinder chrome)
    c.strokeStyle = '#B8E639';
    c.lineWidth = 4;
    function bracket(x, y, flipX, flipY) {
      const L = 40;
      c.beginPath();
      c.moveTo(x + (flipX ? -L : L), y);
      c.lineTo(x, y);
      c.lineTo(x, y + (flipY ? -L : L));
      c.stroke();
    }
    bracket(vfMargin, vfTop, false, false);
    bracket(W - vfMargin, vfTop, true, false);
    bracket(vfMargin, vfTop + vfH, false, true);
    bracket(W - vfMargin, vfTop + vfH, true, true);

    // viewfinder label
    c.fillStyle = '#B8E639';
    c.font = '500 22px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.fillText('ALIGN BADGE IN FRAME', W / 2, vfTop + vfH + 46);

    // reticle dot (small, only when nothing in frame)
    if (phase === 'camera-on') {
      c.fillStyle = 'rgba(184, 230, 57, 0.8)';
      c.beginPath();
      c.arc(W / 2, vfTop + vfH / 2, 6, 0, Math.PI * 2);
      c.fill();
    }

    // "captured ✓" card in flash phase (second half)
    if (phase === 'flash' && screenState.phaseT > 0.5) {
      const cardAlpha = easeOut(clamp((screenState.phaseT - 0.5) * 2, 0, 1));
      c.globalAlpha = cardAlpha;
      c.fillStyle = '#B8E639';
      c.beginPath();
      c.roundRect(W / 2 - 110, H / 2 - 50, 220, 100, 16);
      c.fill();
      c.fillStyle = '#0A1A3C';
      c.font = '700 44px "Bricolage Grotesque", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('✓', W / 2 - 66, H / 2);
      c.font = '600 28px "Manrope", sans-serif';
      c.textAlign = 'left';
      c.fillText('Captured', W / 2 - 36, H / 2);
      c.globalAlpha = 1;
      c.textBaseline = 'alphabetic';
    }

    // Shutter button (white dot) — animate press during shutter-press phase
    const btnX = W / 2;
    const btnY = H - 140;
    let outerR = 58;
    let innerR = 48;
    let ringAlpha = 1;
    if (phase === 'shutter-press') {
      // Press down + inner dot compresses
      const pt = screenState.phaseT;
      // 0-0.5 press in, 0.5-1 release out
      const pressCurve = pt < 0.5 ? easeOut(pt * 2) : easeOut(1 - (pt - 0.5) * 2);
      innerR = lerp(48, 34, pressCurve);
      outerR = lerp(58, 54, pressCurve);
      ringAlpha = 1 - pressCurve * 0.3;
    } else if (phase === 'flash') {
      innerR = 46;
      outerR = 58;
    }
    // Outer ring
    c.strokeStyle = `rgba(255,255,255,${ringAlpha})`;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(btnX, btnY, outerR, 0, Math.PI * 2);
    c.stroke();
    // Inner white dot
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(btnX, btnY, innerR, 0, Math.PI * 2);
    c.fill();
    // Tap ripple during shutter-press
    if (phase === 'shutter-press') {
      const pt = screenState.phaseT;
      const rippleR = lerp(60, 130, easeOut(pt));
      const rippleA = (1 - pt) * 0.5;
      c.strokeStyle = `rgba(184,230,57,${rippleA})`;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(btnX, btnY, rippleR, 0, Math.PI * 2);
      c.stroke();
    }

    return;
  }

  if (phase === 'to-sms' || phase === 'typing' || phase === 'send-press' || phase === 'sending' || phase === 'confirm' || phase === 'fade') {
    // iOS-ish messages conversation background
    const bgGrad = c.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#f7f7f0');
    bgGrad.addColorStop(1, '#ebe8dc');
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, W, H);

    // Status bar
    drawStatusBar('#0A1A3C');

    // Messages header
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fillRect(0, 80, W, 120);
    c.strokeStyle = 'rgba(10,26,60,0.08)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, 200); c.lineTo(W, 200);
    c.stroke();

    // recipient avatar (small lime circle with S)
    c.fillStyle = '#B8E639';
    c.beginPath();
    c.arc(W / 2, 130, 32, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#0A1A3C';
    c.font = '700 28px "Bricolage Grotesque", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('S', W / 2, 132);

    // "To: SlingDoc"
    c.fillStyle = '#0A1A3C';
    c.font = '600 22px "Manrope", sans-serif';
    c.textBaseline = 'middle';
    c.fillText('SlingDoc', W / 2, 180);
    c.textBaseline = 'alphabetic';

    // Attached photo bubble (shown after typing begins)
    if (phase === 'typing' || phase === 'send-press' || phase === 'sending' || phase === 'confirm' || phase === 'fade') {
      // mini badge image bubble (right-aligned outgoing)
      const bx = W - 270;
      const by = 260;
      const bw = 200;
      const bh = 260;
      c.save();
      c.beginPath();
      c.roundRect(bx, by, bw, bh, 22);
      c.clip();
      // stretched badge texture as a mini-image — we reuse the badge canvas
      c.drawImage(badgeCanvas, bx, by, bw, bh);
      c.restore();
      // bubble outline
      c.strokeStyle = 'rgba(10,26,60,0.1)';
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(bx, by, bw, bh, 22);
      c.stroke();
    }

    // Input bar at bottom
    const inputY = H - 160;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.roundRect(40, inputY, W - 80 - 90, 90, 45);
    c.fill();
    c.strokeStyle = 'rgba(10,26,60,0.1)';
    c.lineWidth = 2;
    c.stroke();

    // typed text
    const fullText = 'clock in';
    const typed = fullText.slice(0, screenState.typedChars);
    c.fillStyle = '#0A1A3C';
    c.font = '500 34px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(typed, 80, inputY + 45);

    // caret
    if ((phase === 'typing' || phase === 'to-sms') &&
        Math.floor(performance.now() / 400) % 2 === 0 &&
        screenState.typedChars < fullText.length) {
      const tw = c.measureText(typed).width;
      c.fillStyle = '#B8E639';
      c.fillRect(80 + tw + 4, inputY + 16, 3, 58);
    }

    // Send button — lights up once typed is complete, compresses during send-press
    const canSend = screenState.typedChars >= fullText.length;
    let sendR = 38;
    let sendBg = canSend ? '#B8E639' : '#d9d6ca';
    if (phase === 'send-press') {
      const pt = screenState.phaseT;
      const pressCurve = pt < 0.5 ? easeOut(pt * 2) : easeOut(1 - (pt - 0.5) * 2);
      sendR = lerp(38, 30, pressCurve);
      // darken briefly on press
      sendBg = pressCurve > 0.3 ? '#8fb82c' : '#B8E639';
    }
    c.fillStyle = sendBg;
    c.beginPath();
    c.arc(W - 80, inputY + 45, sendR, 0, Math.PI * 2);
    c.fill();
    // up-arrow glyph
    c.strokeStyle = '#0A1A3C';
    c.lineWidth = 3;
    const arrowShrink = sendR / 38;
    c.beginPath();
    c.moveTo(W - 80 - 14 * arrowShrink, inputY + 45 + 10 * arrowShrink);
    c.lineTo(W - 80, inputY + 45 - 13 * arrowShrink);
    c.lineTo(W - 80 + 14 * arrowShrink, inputY + 45 + 10 * arrowShrink);
    c.moveTo(W - 80, inputY + 45 - 13 * arrowShrink);
    c.lineTo(W - 80, inputY + 45 + 15 * arrowShrink);
    c.stroke();

    // Tap ripple on send-press
    if (phase === 'send-press') {
      const pt = screenState.phaseT;
      const rippleR = lerp(38, 90, easeOut(pt));
      const rippleA = (1 - pt) * 0.55;
      c.strokeStyle = `rgba(184,230,57,${rippleA})`;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(W - 80, inputY + 45, rippleR, 0, Math.PI * 2);
      c.stroke();
    }

    // "Sending" or "sent" state: animate a bubble flying up from the input
    if (phase === 'sending' || phase === 'confirm' || phase === 'fade') {
      // Outgoing text bubble
      const bubblePhase = phase === 'sending' ? screenState.phaseT : 1;
      const bubbleStartY = inputY + 20;
      const bubbleEndY = 550;
      const by2 = lerp(bubbleStartY, bubbleEndY, easeOut(bubblePhase));
      const alpha = clamp(bubblePhase * 1.4, 0, 1);

      c.globalAlpha = alpha;
      const label = 'clock in';
      c.font = '600 34px "JetBrains Mono", monospace';
      const tw = c.measureText(label).width;
      const bx2 = W - tw - 130;
      const bwOuter = tw + 60;
      const bhOuter = 80;
      c.fillStyle = '#0A1A3C';
      c.beginPath();
      c.roundRect(bx2, by2, bwOuter, bhOuter, 40);
      c.fill();
      c.fillStyle = '#B8E639';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(label, bx2 + 30, by2 + bhOuter / 2);
      c.globalAlpha = 1;

      // delivered indicator
      if (phase === 'confirm' || phase === 'fade') {
        c.fillStyle = '#5E5E55';
        c.font = '500 18px "Manrope", sans-serif';
        c.textAlign = 'right';
        c.fillText('Delivered · 7:58 AM', W - 50, bubbleEndY + 110);

        // Incoming auto-reply
        const replyAlpha = phase === 'confirm'
          ? easeOut(clamp(screenState.phaseT * 1.1, 0, 1))
          : 1;
        c.globalAlpha = replyAlpha;
        const reply = 'Clocked in ✓ 7:58 AM';
        c.font = '500 30px "JetBrains Mono", monospace';
        const rtw = c.measureText(reply).width;
        const rby = bubbleEndY + 150;
        c.fillStyle = '#ffffff';
        c.strokeStyle = 'rgba(10,26,60,0.08)';
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(60, rby, rtw + 60, 80, 40);
        c.fill();
        c.stroke();
        c.fillStyle = '#0A1A3C';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(reply, 90, rby + 40);
        c.globalAlpha = 1;
      }

      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
    }

    // Fade-to-black overlay for fade phase
    if (phase === 'fade') {
      c.fillStyle = `rgba(0,0,0,${screenState.phaseT * 0.6})`;
      c.fillRect(0, 0, W, H);
    }
  }
}

/* ---------------------------------------------------------------------------
   Per-phase transforms (positions phone/badge/lights for each beat)
   --------------------------------------------------------------------------- */
function applyPhaseTransforms(phaseId, t) {
  // Baseline phone position
  let phoneY = 0;
  let phoneRotY = 0;
  let phoneRotX = 0;

  // gentle global float (the whole scene always breathes a little)
  const floatY = Math.sin(performance.now() / 1400) * 0.04;

  switch (phaseId) {
    case 'intro': {
      // Phone rotates into view from a tilted starting pose
      const e = easeOut(t);
      phoneRotY = lerp(-0.7, -0.05, e);
      phoneRotX = lerp(0.25, 0.02, e);
      phoneY = lerp(-0.4, 0, e);
      break;
    }
    case 'home':
    case 'camera-on':
    case 'badge-enter': {
      // Phone steady, face-forward
      phoneRotY = -0.05;
      phoneRotX = 0.02;
      phoneY = 0;
      break;
    }
    case 'shutter-press': {
      // Tiny dip on press
      phoneRotY = -0.05;
      phoneRotX = 0.02;
      const pt = t < 0.5 ? easeOut(t * 2) : easeOut(1 - (t - 0.5) * 2);
      phoneY = lerp(0, -0.02, pt);
      flashMat.opacity = 0;
      break;
    }
    case 'flash': {
      // Flash pulse: 0 → 0.85 → 0
      phoneRotY = -0.05;
      phoneRotX = 0.02;
      const fT = t;
      let flashA = 0;
      if (fT < 0.25) flashA = fT / 0.25 * 0.85;
      else if (fT < 0.55) flashA = (1 - (fT - 0.25) / 0.3) * 0.85;
      flashMat.opacity = flashA;
      screenState.shutterFlashT = flashA;
      break;
    }
    case 'to-sms': {
      phoneRotY = -0.05;
      phoneRotX = 0.02;
      flashMat.opacity = 0;
      break;
    }
    case 'typing':
    case 'send-press':
    case 'sending':
    case 'confirm':
    case 'fade': {
      phoneRotY = -0.05;
      phoneRotX = 0.02;
      if (phaseId === 'send-press') {
        const pt = t < 0.5 ? easeOut(t * 2) : easeOut(1 - (t - 0.5) * 2);
        phoneY = lerp(0, -0.02, pt);
      }
      break;
    }
  }

  // Hide the 3D badge entirely — badge is now drawn inside the camera viewfinder
  // on the phone screen itself (which is what a phone taking a photo actually shows)
  badgeGroup.visible = false;

  phoneGroup.position.y = phoneY + floatY;
  phoneGroup.rotation.y = phoneRotY + Math.sin(performance.now() / 2400) * 0.015;
  phoneGroup.rotation.x = phoneRotX;

  // Fade entire root during fade phase
  if (phaseId === 'fade') {
    root.position.y = lerp(0, 0.3, easeInOut(t));
  } else {
    root.position.y = 0;
  }
}

/* ---------------------------------------------------------------------------
   Animation timeline driver
   (Timing state is declared at the top of the file so the motion toggle
   works before Three.js has loaded.)
   --------------------------------------------------------------------------- */

function getPhaseInfo(ms) {
  for (const p of TIMELINE) {
    if (ms < p.end) {
      const t = clamp((ms - p.start) / (p.end - p.start), 0, 1);
      return { ...p, t };
    }
  }
  const last = TIMELINE[TIMELINE.length - 1];
  return { ...last, t: 1 };
}

let lastAnnouncedPhase = null;

function updateFromElapsed(ms) {
  const { id, label, t } = getPhaseInfo(ms);

  // Typing progression
  if (id === 'typing') {
    const fullLength = 'clock in'.length;
    screenState.typedChars = Math.floor(t * (fullLength + 0.5));
    screenState.typedChars = clamp(screenState.typedChars, 0, fullLength);
  } else if (id === 'home' || id === 'camera-on' || id === 'badge-enter' ||
             id === 'shutter-press' || id === 'flash' || id === 'to-sms') {
    screenState.typedChars = 0;
  } else if (id === 'send-press' || id === 'sending' || id === 'confirm' || id === 'fade') {
    screenState.typedChars = 'clock in'.length;
  }

  // Update state for draw
  screenState.phase = id;
  screenState.phaseT = t;
  drawScreen();
  screenTexture.needsUpdate = true;

  // 3D transforms
  applyPhaseTransforms(id, t);

  // A11y label + "It's that easy!" HTML card
  if (id !== lastAnnouncedPhase) {
    labelEl.textContent = label || '…';
    lastAnnouncedPhase = id;
  }

  // Show HTML "It's that easy!" card during the confirm phase
  if (id === 'confirm') {
    easyCard.classList.add('is-visible');
    easyCard.setAttribute('aria-hidden', 'false');
  } else {
    easyCard.classList.remove('is-visible');
    easyCard.setAttribute('aria-hidden', 'true');
  }
}

/* ---------------------------------------------------------------------------
   Sizing
   --------------------------------------------------------------------------- */
function resize() {
  const rect = mount.getBoundingClientRect();
  const w = rect.width || 400;
  const h = rect.height || 420;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Adjust camera zoom for small containers — pull back a bit on portrait
  camera.fov = w < 420 ? 38 : 32;
  camera.updateProjectionMatrix();
}
const ro = new ResizeObserver(resize);
ro.observe(mount);
resize();

/* ---------------------------------------------------------------------------
   Main loop
   --------------------------------------------------------------------------- */
function tick(ts) {
  requestAnimationFrame(tick);

  if (reduceMotion) {
    // Draw a still "confirm" frame so the canvas has something on it if toggled off later
    renderer.render(scene, camera);
    return;
  }

  const dt = lastTimestamp ? ts - lastTimestamp : 16;
  lastTimestamp = ts;

  if (isPlaying) {
    elapsed += dt;
    if (elapsed > LOOP_DURATION) elapsed = 0; // loop
  }

  updateFromElapsed(elapsed);
  renderer.render(scene, camera);
}
requestAnimationFrame(tick);

/* ---------------------------------------------------------------------------
   UI controls
   --------------------------------------------------------------------------- */
playBtn.addEventListener('click', () => {
  isPlaying = !isPlaying;
  playBtn.classList.toggle('is-paused', !isPlaying);
  playBtn.setAttribute('aria-label', isPlaying ? 'Pause animation' : 'Play animation');
  if (isPlaying) lastTimestamp = performance.now();
});

replayBtn.addEventListener('click', () => {
  elapsed = 0;
  isPlaying = true;
  playBtn.classList.remove('is-paused');
  playBtn.setAttribute('aria-label', 'Pause animation');
  lastTimestamp = performance.now();
});

// Pause when stage scrolled off-screen (saves battery)
const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) {
      // note: we don't toggle isPlaying here; we just skip advancing time
      // by resetting lastTimestamp on re-entry
    } else {
      lastTimestamp = performance.now();
    }
  }
}, { threshold: 0.1 });
io.observe(stageEl);

// Apply initial reduce-motion from system preference
if (reduceMotion) applyReduceMotion(true);

/* ---------------------------------------------------------------------------
   Polyfill for CanvasRenderingContext2D.roundRect in older browsers
   --------------------------------------------------------------------------- */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    this.beginPath();
    this.moveTo(x + r.tl, y);
    this.lineTo(x + w - r.tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    this.lineTo(x + w, y + h - r.br);
    this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    this.lineTo(x + r.bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    this.lineTo(x, y + r.tl);
    this.quadraticCurveTo(x, y, x + r.tl, y);
    this.closePath();
    return this;
  };
}
