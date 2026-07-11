'use client';

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  twinkle: number;
  hue: number; // 0 = white, 1 = violet, 2 = blue, 3 = mint
}

const STAR_COLORS = ['255, 255, 255', '167, 139, 250', '124, 200, 255', '79, 240, 200'];
const LINK_RADIUS = 150; // stars within this distance of the cursor join constellations
const STAR_LINK_DIST = 110; // max distance between two stars to draw a line

/**
 * Full-viewport canvas starfield. Stars drift and twinkle; stars near the
 * pointer link up into glowing constellations.
 */
export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    const pointer = { x: -9999, y: -9999, active: false };

    const seed = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(220, Math.floor((width * height) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.4 + Math.random() * 1.3,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        twinkle: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.72 ? 0 : 1 + Math.floor(Math.random() * 3),
      }));
    };

    const onPointerMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };

    seed();
    window.addEventListener('resize', seed);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);

    let raf = 0;
    let t = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      t += 0.016;
      ctx.clearRect(0, 0, width, height);

      // Move + draw stars
      for (const s of stars) {
        if (!reduced) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < -5) s.x = width + 5;
          if (s.x > width + 5) s.x = -5;
          if (s.y < -5) s.y = height + 5;
          if (s.y > height + 5) s.y = -5;
        }
        const tw = reduced ? 0.75 : 0.55 + 0.45 * Math.sin(t * 1.6 + s.twinkle);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${STAR_COLORS[s.hue]}, ${0.35 + tw * 0.5})`;
        ctx.fill();
      }

      // Constellations near the pointer
      if (pointer.active && !reduced) {
        const near = stars.filter((s) => {
          const dx = s.x - pointer.x;
          const dy = s.y - pointer.y;
          return dx * dx + dy * dy < LINK_RADIUS * LINK_RADIUS;
        });

        for (let i = 0; i < near.length; i++) {
          const a = near[i];
          const da = Math.hypot(a.x - pointer.x, a.y - pointer.y);
          const proximity = 1 - da / LINK_RADIUS;

          // brighten linked stars
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r + 0.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${STAR_COLORS[a.hue]}, ${0.5 + proximity * 0.5})`;
          ctx.fill();

          for (let j = i + 1; j < near.length; j++) {
            const b = near[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < STAR_LINK_DIST) {
              const alpha = (1 - d / STAR_LINK_DIST) * proximity * 0.55;
              const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
              grad.addColorStop(0, `rgba(167, 139, 250, ${alpha})`);
              grad.addColorStop(1, `rgba(79, 240, 200, ${alpha})`);
              ctx.strokeStyle = grad;
              ctx.lineWidth = 0.7;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', seed);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
