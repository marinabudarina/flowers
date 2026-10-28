// Textured convex relief. The original artwork is the material: it is
// alpha-extracted (alpha = max RGB, rgb unpremultiplied, which reproduces the
// glow exactly when composited on black) and mapped onto a subdivided
// heightfield mesh. Triangles are software-projected with the same transform
// as the CSS card (perspective 1200px, rotateX(ty*20deg) rotateY(-tx*30deg)).
// Only this surface carries the artwork. Never stack copies of the image to
// imitate thickness: their perspective separates into multiple Gs on rotation.
import { createNormalLighting } from "@/lib/bead-normal-lighting";

const PERSPECTIVE = 1200;
const MESH = 32;      // mesh cells across the artwork's bounding box
const HF = 96;        // heightfield resolution

export type Relief = {
  resize: (cardW: number, cardH: number) => void;
  render: (tx: number, ty: number, flip?: number, seconds?: number) => void;
  dispose: () => void;
};

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

export async function createRelief(canvas: HTMLCanvasElement, src: string, pad: number, options?: {
  normalSrc: string;
  width: number;
  height: number;
  left: number;
  top: number;
  preserveAspectRatio?: boolean;
}): Promise<Relief> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  const normalImage = new Image();
  normalImage.decoding = "async";
  normalImage.src = options?.normalSrc ?? `${import.meta.env.BASE_URL}google-beaded-floral.normals.png`;
  await Promise.all([img.decode(), normalImage.decode()]);
  const S = Math.min(1024, img.naturalWidth || 768);

  const read = canvasOf(S, S).getContext("2d", { willReadFrequently: true })!;
  read.drawImage(img, 0, 0, S, S);
  const raw = read.getImageData(0, 0, S, S);
  const d = raw.data;

  const base = new ImageData(S, S), shade = new ImageData(S, S);
  const B = base.data, Sh = shade.data;
  const mask = new Float32Array(HF * HF), red = new Float32Array(HF * HF), cnt = new Float32Array(HF * HF);
  let minX = S, minY = S, maxX = 0, maxY = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = (y * S + x) * 4;
    const r = d[k], g = d[k + 1], b = d[k + 2];
    const m = Math.max(r, g, b);
    const a = m < 6 ? 0 : m;
    const inv = a ? 255 / a : 0;
    const ur = r * inv, ug = g * inv, ub = b * inv;
    B[k] = ur; B[k + 1] = ug; B[k + 2] = ub; B[k + 3] = a;
    Sh[k + 3] = a * .55;
    const mn = Math.min(r, g, b), sat = m ? (m - mn) / m : 0;
    if (a > 30) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const hi = ((y * HF / S) | 0) * HF + ((x * HF / S) | 0);
    mask[hi] += a > 40 ? 1 : 0;
    red[hi] += (r > g * 1.6 && r > b * 1.6 && sat > .55) ? 1 : 0;
    cnt[hi]++;
  }
  const tex = (data: ImageData) => { const c = canvasOf(S, S); c.getContext("2d")!.putImageData(data, 0, 0); return c; };
  const normalRead = canvasOf(S, S);
  const normalCtx = normalRead.getContext("2d", { willReadFrequently: true })!;
  normalCtx.drawImage(normalImage, 0, 0, S, S);
  const lighting = createNormalLighting(base, normalCtx.getImageData(0, 0, S, S));
  normalRead.width = normalRead.height = 0;
  const shadowTex = tex(shade);

  // Heightfield: plateau + convex dome from distance-to-silhouette, flowers proud.
  const filled = new Uint8Array(HF * HF);
  for (let i = 0; i < HF * HF; i++) { filled[i] = mask[i] / cnt[i] > .18 ? 1 : 0; red[i] /= cnt[i]; }
  const dist = new Float32Array(HF * HF);
  for (let j = 0; j < HF; j++) for (let i = 0; i < HF; i++) {
    const k = j * HF + i;
    if (!filled[k]) continue;
    dist[k] = Math.min(i ? dist[k - 1] + 1 : 1, j ? dist[k - HF] + 1 : 1);
  }
  for (let j = HF - 1; j >= 0; j--) for (let i = HF - 1; i >= 0; i--) {
    const k = j * HF + i;
    if (!filled[k]) continue;
    dist[k] = Math.min(dist[k], i < HF - 1 ? dist[k + 1] + 1 : 1, j < HF - 1 ? dist[k + HF] + 1 : 1);
  }
  let height = new Float32Array(HF * HF);
  for (let k = 0; k < HF * HF; k++) {
    if (!filled[k]) continue;
    height[k] = .5 + .4 * Math.sin(Math.min(1, dist[k] / 7) * Math.PI / 2) + .45 * Math.min(1, red[k] * 2.5);
  }
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(HF * HF);
    for (let j = 0; j < HF; j++) for (let i = 0; i < HF; i++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = i + dx, y = j + dy;
        if (x < 0 || y < 0 || x >= HF || y >= HF) continue;
        s += height[y * HF + x]; n++;
      }
      out[j * HF + i] = filled[j * HF + i] ? Math.max(height[j * HF + i] * .5, s / n) : s / n * .6;
    }
    height = out;
  }
  const sampleH = (u: number, v: number) => {
    const fx = Math.max(0, Math.min(HF - 1.001, u * HF - .5)), fy = Math.max(0, Math.min(HF - 1.001, v * HF - .5));
    const x = fx | 0, y = fy | 0, ax = fx - x, ay = fy - y, k = y * HF + x;
    return (height[k] * (1 - ax) + height[k + 1] * ax) * (1 - ay) + (height[k + HF] * (1 - ax) + height[k + HF + 1] * ax) * ay;
  };
  const occupied = (u0: number, v0: number, u1: number, v1: number) => {
    for (let y = Math.max(0, Math.floor(v0 * HF) - 1); y <= Math.min(HF - 1, Math.ceil(v1 * HF)); y++)
      for (let x = Math.max(0, Math.floor(u0 * HF) - 1); x <= Math.min(HF - 1, Math.ceil(u1 * HF)); x++)
        if (mask[y * HF + x] > 0 || height[y * HF + x] > .02) return true;
    return false;
  };

  // Mesh in texture space (normalized uv), cached once.
  const m = 6 / S;
  const U0 = Math.max(0, minX / S - m), V0 = Math.max(0, minY / S - m);
  const U1 = Math.min(1, maxX / S + m), V1 = Math.min(1, maxY / S + m);
  const NV = MESH + 1;
  const vu = new Float32Array(NV * NV), vv = new Float32Array(NV * NV), vh = new Float32Array(NV * NV);
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const k = j * NV + i;
    vu[k] = U0 + (U1 - U0) * i / MESH; vv[k] = V0 + (V1 - V0) * j / MESH;
    vh[k] = sampleH(vu[k], vv[k]);
  }
  const tris: number[] = [];
  for (let j = 0; j < MESH; j++) for (let i = 0; i < MESH; i++) {
    const a = j * NV + i, b = a + 1, c = a + NV, e = c + 1;
    if (!occupied(vu[a], vv[a], vu[e], vv[e])) continue;
    tris.push(a, b, e, a, e, c);
  }
  const triIdx = Uint32Array.from(tris);
  const TN = triIdx.length / 3;
  const triDepth = new Float32Array(TN), triOrder = new Uint32Array(TN);
  const sx = new Float32Array(NV * NV), sy = new Float32Array(NV * NV), sz = new Float32Array(NV * NV);

  const ctx = canvas.getContext("2d")!;
  let W = 0, H = 0, dpr = 1, ox = 0, oy = 0, artW = 0, artH = 0, relief = 0, artX = 0, artY = 0;

  const resize = (cardW: number, cardH: number) => {
    W = cardW; H = cardH;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = W + pad * 2, ch = H + pad * 2;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
    ox = cw / 2; oy = ch / 2;
    artW = W * (options?.width ?? 1.062);
    artH = options ? H * options.height : artW;
    artX = (options?.left ?? -0.031) * W - W / 2;
    if (options?.preserveAspectRatio) {
      const naturalWidth = artH * img.naturalWidth / img.naturalHeight;
      artX -= (naturalWidth - artW) / 2;
      artW = naturalWidth;
    }
    artY = (options?.top ?? 0.25) * H - H / 2;
    relief = W * 0.06;
  };

  let cx = 1, sxr = 0, cy = 1, syr = 0;
  const P = { x: 0, y: 0, z: 0 };
  const project = (x: number, y: number, z: number) => {
    const x1 = x * cy + z * syr, z1 = -x * syr + z * cy;
    const y2 = y * cx - z1 * sxr, z2 = y * sxr + z1 * cx;
    const s = PERSPECTIVE / (PERSPECTIVE - z2);
    P.x = ox + x1 * s; P.y = oy + y2 * s; P.z = z2;
  };

  // The only planar layer is a blurred black contact shadow, not color artwork.
  const drawPlane = (source: HTMLCanvasElement, z: number, dx = 0, dy = 0) => {
    project(artX + dx, artY + dy, z); const ax = P.x, ay = P.y;
    project(artX + dx + artW, artY + dy, z); const bx = P.x, by = P.y;
    project(artX + dx, artY + dy + artH, z); const qx = P.x, qy = P.y;
    ctx.setTransform(dpr * (bx - ax) / S, dpr * (by - ay) / S, dpr * (qx - ax) / S, dpr * (qy - ay) / S, dpr * ax, dpr * ay);
    ctx.drawImage(source, 0, 0);
  };

  const drawTri = (source: HTMLCanvasElement, i0: number, i1: number, i2: number) => {
    let x0 = sx[i0], y0 = sy[i0], x1 = sx[i1], y1 = sy[i1], x2 = sx[i2], y2 = sy[i2];
    const u0 = vu[i0] * S, v0 = vv[i0] * S, u1 = vu[i1] * S, v1 = vv[i1] * S, u2 = vu[i2] * S, v2 = vv[i2] * S;
    // Affine from texture to screen, solved on the true vertices.
    const den = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
    if (!den) return;
    const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / den;
    const c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / den;
    const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / den;
    const dd = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / den;
    const e = x0 - a * u0 - c * v0, f = y0 - b * u0 - dd * v0;
    // Clip with a slightly inflated triangle to hide antialiasing seams.
    const mx = (x0 + x1 + x2) / 3, my = (y0 + y1 + y2) / 3, grow = .7;
    const inflate = (x: number, y: number) => { const l = Math.hypot(x - mx, y - my) || 1; return [x + (x - mx) / l * grow, y + (y - my) / l * grow]; };
    [x0, y0] = inflate(x0, y0); [x1, y1] = inflate(x1, y1); [x2, y2] = inflate(x2, y2);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.clip();
    ctx.transform(a, b, c, dd, e, f);
    ctx.drawImage(source, 0, 0);
    ctx.restore();
  };

  const render = (tx: number, ty: number, flip = 0, seconds?: number) => {
    if (!W) return;
    const ax = ty * 20 * Math.PI / 180, ay = (-tx * 30 + flip) * Math.PI / 180;
    cx = Math.cos(ax); sxr = Math.sin(ax); cy = Math.cos(ay); syr = Math.sin(ay);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Soft contact shadow on the metal, light from upper-left.
    ctx.globalAlpha = .5;
    ctx.filter = "blur(3px)";
    drawPlane(shadowTex, 0, relief * .35, relief * .5);
    ctx.filter = "none";
    ctx.globalAlpha = 1;

    // A single normal-lit material, controlled only by pointer position.
    const material = lighting.render(tx, ty, seconds);

    for (let k = 0; k < NV * NV; k++) {
      // Preserve the low mounted relief, but with just one textured surface.
      const capHeight = (.4 + vh[k] * .025) * relief;
      project(artX + vu[k] * artW, artY + vv[k] * artH, capHeight);
      sx[k] = P.x; sy[k] = P.y; sz[k] = P.z;
    }
    for (let t = 0; t < TN; t++) {
      triDepth[t] = sz[triIdx[t * 3]] + sz[triIdx[t * 3 + 1]] + sz[triIdx[t * 3 + 2]];
      triOrder[t] = t;
    }
    triOrder.sort((a, b) => triDepth[a] - triDepth[b]);
    for (let n = 0; n < TN; n++) {
      const t = triOrder[n];
      drawTri(material, triIdx[t * 3], triIdx[t * 3 + 1], triIdx[t * 3 + 2]);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  return {
    resize, render,
    dispose: () => {
      lighting.dispose();
      shadowTex.width = shadowTex.height = 0;
      canvas.width = canvas.height = 0;
    },
  };
}
