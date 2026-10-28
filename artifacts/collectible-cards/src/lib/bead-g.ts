// Canvas2D renderer for a Google G assembled from individual glass beads.
export type Bead = { x: number; y: number; r: number; c: [number, number, number]; j: number };

const RED: [number, number, number] = [234, 67, 53];
const YEL: [number, number, number] = [251, 188, 5];
const GRN: [number, number, number] = [52, 168, 83];
const BLU: [number, number, number] = [66, 133, 244];

function colorAt(x: number, y: number): [number, number, number] | null {
  const d = Math.hypot(x, y);
  const R = 1, r = 0.6;
  const inBar = x >= -0.02 && x <= 0.99 && y >= -0.2 && y <= 0.19;
  if (inBar) return BLU;
  if (d > R || d < r) return null;
  let a = (Math.atan2(y, x) * 180) / Math.PI; // screen: y down
  if (a < 0) a += 360;
  if (a > 318 || (a < 0.01 && y < 0)) return null; // opening top-right
  if (a < 2 && y < -0.2) return null;
  if (a <= 38) return BLU;
  if (a <= 148) return GRN;
  if (a <= 212) return YEL;
  return RED;
}

export function buildBeads(rows = 46): Bead[] {
  const s = 2 / rows;
  const h = s * Math.sqrt(3) / 2;
  const out: Bead[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let j = 0, y = -1 + h / 2; y < 1; y += h, j++) {
    for (let x = -1 + (j % 2 ? s : s / 2); x < 1; x += s) {
      const c = colorAt(x, y);
      if (!c) continue;
      out.push({ x: x + (rnd() - 0.5) * s * 0.06, y: y + (rnd() - 0.5) * s * 0.06, r: s * (0.47 + rnd() * 0.04), c, j: rnd() });
    }
  }
  return out;
}

const rgb = (c: number[], k = 1, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;

export function drawBeads(ctx: CanvasRenderingContext2D, beads: Bead[], size: number, lx: number, ly: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, S = size / 2;
  const sx = -lx, sy = -ly; // shadow direction away from light
  // 1. colored light bounce onto the metal (soft, low alpha)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of beads) {
    if (b.j > 0.18) continue;
    const px = cx + b.x * S, py = cy + b.y * S, rr = b.r * S * 6;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, rgb(b.c, 1, 0.07));
    g.addColorStop(1, rgb(b.c, 1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  ctx.restore();
  // 2. contact shadows / occlusion
  for (const b of beads) {
    const px = cx + b.x * S, py = cy + b.y * S, rr = b.r * S;
    const g = ctx.createRadialGradient(px + sx * rr * 0.55, py + sy * rr * 0.55, 0, px + sx * rr * 0.55, py + sy * rr * 0.55, rr * 1.45);
    g.addColorStop(0, "rgba(0,0,0,0.75)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px + sx * rr * 0.55, py + sy * rr * 0.55, rr * 1.45, 0, Math.PI * 2);
    ctx.fill();
  }
  // 3. bead spheres
  for (const b of beads) {
    const px = cx + b.x * S, py = cy + b.y * S, rr = b.r * S;
    const v = 0.85 + b.j * 0.3;
    const g = ctx.createRadialGradient(px + lx * rr * 0.42, py + ly * rr * 0.42, rr * 0.05, px, py, rr);
    g.addColorStop(0, rgb(b.c, 1.55 * v));
    g.addColorStop(0.35, rgb(b.c, 1.0 * v));
    g.addColorStop(0.8, rgb(b.c, 0.5 * v));
    g.addColorStop(1, rgb(b.c, 0.22));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fill();
    // inner glass caustic on far side
    const t = ctx.createRadialGradient(px - lx * rr * 0.45, py - ly * rr * 0.45, 0, px - lx * rr * 0.45, py - ly * rr * 0.45, rr * 0.5);
    t.addColorStop(0, rgb(b.c, 1.7, 0.55));
    t.addColorStop(1, rgb(b.c, 1.7, 0));
    ctx.fillStyle = t;
    ctx.fill();
    // specular
    const hx = px + lx * rr * 0.45, hy = py + ly * rr * 0.45, hr = rr * 0.32;
    const sp = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    sp.addColorStop(0, "rgba(255,255,250,0.95)");
    sp.addColorStop(0.4, "rgba(255,255,250,0.35)");
    sp.addColorStop(1, "rgba(255,255,250,0)");
    ctx.fillStyle = sp;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
  }
}
