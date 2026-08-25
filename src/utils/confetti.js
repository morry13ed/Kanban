import { BOARD_COLORS } from './helpers';

const COUNT = 80;
const GRAVITY = 0.32;
const DRAG = 0.995;
const FADE_AT = 900;
const LIFETIME = 1600;

// Small self-contained burst — no dependency, and it reuses the board palette
// so it looks like it belongs to the app.
export function fireConfetti(origin) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  // requestAnimationFrame is paused in a hidden tab, so the canvas would be
  // created and never torn down. Nobody would see it anyway.
  if (document.hidden) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const x0 = origin?.x ?? width / 2;
  const y0 = origin?.y ?? height / 3;

  const particles = Array.from({ length: COUNT }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
    const speed = 5 + Math.random() * 7;
    return {
      x: x0,
      y: y0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 4,
      tilt: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      color: BOARD_COLORS[Math.floor(Math.random() * BOARD_COLORS.length)],
    };
  });

  const start = performance.now();

  // If the tab is hidden partway through, rAF stops and the loop never reaches
  // its own cleanup. Timers still fire, so this guarantees teardown.
  const safety = setTimeout(() => canvas.remove(), LIFETIME + 500);

  const frame = (now) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.vy += GRAVITY;
      p.vx *= DRAG;
      p.vy *= DRAG;
      p.x += p.vx;
      p.y += p.vy;
      p.tilt += p.spin;

      ctx.save();
      ctx.globalAlpha =
        elapsed < FADE_AT
          ? 1
          : Math.max(0, 1 - (elapsed - FADE_AT) / (LIFETIME - FADE_AT));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    if (elapsed < LIFETIME) {
      requestAnimationFrame(frame);
    } else {
      clearTimeout(safety);
      canvas.remove();
    }
  };

  requestAnimationFrame(frame);
}
