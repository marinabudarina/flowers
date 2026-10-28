export type Vec3 = { x: number; y: number; z: number };

export function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function rotateNormal(v: Vec3, ax: number, ay: number): Vec3 {
  const x = v.x * Math.cos(ay) + v.z * Math.sin(ay);
  const z = -v.x * Math.sin(ay) + v.z * Math.cos(ay);
  return { x, y: v.y * Math.cos(ax) - z * Math.sin(ax), z: v.y * Math.sin(ax) + z * Math.cos(ax) };
}

/** A stationary studio light and the viewer illuminate a moving bead normal. */
export function beadLighting(normal: Vec3, position: Vec3, scale: number) {
  const light = normalize({ x: -scale * 0.75 - position.x, y: -scale * 0.85 - position.y, z: scale * 1.45 - position.z });
  const view = normalize({ x: -position.x, y: -position.y, z: 1200 - position.z });
  const half = normalize({ x: light.x + view.x, y: light.y + view.y, z: light.z + view.z });
  const dot = (a: Vec3, b: Vec3) => Math.max(0, a.x * b.x + a.y * b.y + a.z * b.z);
  const facing = dot(normal, view);
  const diffuse = dot(normal, light);
  // Broad reflection plus a sharp peak: readable shimmer with concentrated sparkle.
  const alignment = dot(normal, half);
  const specular = .4 * Math.pow(alignment, 16) + .8 * Math.pow(alignment, 64);
  const fresnel = Math.pow(1 - facing, 3);
  // Thin-film reflection shifts at grazing angles, while retaining pigment.
  const shift = Math.max(-2, Math.min(2, Math.round((normal.x * light.x + normal.y * light.y) * 5 + fresnel * 3)));
  return { diffuse, specular, fresnel, shift, hx: half.x, hy: half.y };
}

export function shiftPigment(r: number, g: number, b: number, band: number): [number, number, number] {
  const a = band * 9 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return [
    clamp((.299 + .701 * c + .168 * s) * r + (.587 - .587 * c + .330 * s) * g + (.114 - .114 * c - .497 * s) * b),
    clamp((.299 - .299 * c - .328 * s) * r + (.587 + .413 * c + .035 * s) * g + (.114 - .114 * c + .292 * s) * b),
    clamp((.299 - .300 * c + 1.250 * s) * r + (.587 - .588 * c - 1.050 * s) * g + (.114 + .886 * c - .203 * s) * b),
  ];
}
