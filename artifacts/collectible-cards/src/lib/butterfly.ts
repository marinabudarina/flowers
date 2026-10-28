import * as THREE from "three";
import { DEFAULT_BUTTERFLIES, type ButterflySettings } from "./butterfly-settings";

/** Painted monarch-ish wing texture (right wing; left is mirrored geometry). */
function paintWing(color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  // Wing outline in canvas space: root at (0,128). Forewing up-right, hindwing down-right.
  const fore = new Path2D();
  fore.moveTo(4, 124);
  fore.bezierCurveTo(40, 40, 150, 6, 238, 14);
  fore.bezierCurveTo(250, 40, 236, 90, 200, 116);
  fore.bezierCurveTo(140, 132, 60, 134, 4, 128);
  const hind = new Path2D();
  hind.moveTo(4, 130);
  hind.bezierCurveTo(70, 132, 160, 140, 186, 176);
  hind.bezierCurveTo(196, 214, 150, 250, 96, 246);
  hind.bezierCurveTo(46, 236, 14, 180, 4, 130);
  const fill = (p: Path2D) => {
    const gr = g.createRadialGradient(10, 128, 6, 10, 128, 240);
    const base = new THREE.Color(color);
    gr.addColorStop(0, base.clone().multiplyScalar(0.45).getStyle());
    gr.addColorStop(0.55, color);
    gr.addColorStop(1, base.clone().lerp(new THREE.Color("#fff4cf"), 0.25).getStyle());
    g.fillStyle = gr; g.fill(p);
  };
  fill(fore); fill(hind);
  // Veins
  g.strokeStyle = "#1c120c"; g.lineCap = "round";
  const vein = (pts: number[], w: number) => {
    g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]);
    g.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); g.stroke();
  };
  g.save(); g.clip(fore);
  [[6,126,90,70,230,22],[6,126,110,90,226,60],[6,126,120,110,214,100],[6,126,80,112,170,124],[40,110,120,60,180,30]].forEach(v => vein(v, 3.2));
  g.restore();
  g.save(); g.clip(hind);
  [[6,130,90,150,180,180],[6,130,80,170,150,226],[6,130,60,180,100,244],[6,130,40,170,50,226]].forEach(v => vein(v, 3.2));
  g.restore();
  // Dark borders with white dots
  for (const p of [fore, hind]) { g.lineWidth = 14; g.stroke(p); }
  g.fillStyle = "#1c120c";
  g.beginPath(); g.ellipse(214, 34, 30, 20, -0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff7e6";
  const dots: [number, number, number][] = [[226,24,3.5],[208,30,3],[222,44,3],[236,58,2.4],[226,88,2.4],[196,32,2.6],[178,162,2.4],[176,196,2.6],[160,226,2.6],[130,242,2.4],[98,242,2.4],[66,230,2.2],[194,104,2.2]];
  for (const [x, y, r] of dots) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export type FlightOptions = { center: THREE.Vector3; radius: THREE.Vector3; size: number; speed?: number; color?: string; phase?: number };

/** Lightweight procedural butterfly with mirrored flapping wings and looping flight. */
export class Butterfly {
  readonly object = new THREE.Group();
  private body = new THREE.Group();
  private left = new THREE.Group();
  private right = new THREE.Group();
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private tex: THREE.Texture;
  private disposed = false;
  private prev = new THREE.Vector3();

  constructor(private opts: FlightOptions) {
    this.object.name = "butterfly";
    this.object.userData.butterfly = true;
    this.object.raycast = () => {};
    this.tex = paintWing(opts.color ?? "#f08a24");
    const wingMat = new THREE.MeshStandardMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, metalness: 0 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f1510, roughness: 0.6 });
    this.mats.push(wingMat, bodyMat);
    // Wing plane: x from root outward (0..1), z forward/back (texture v). Lies flat in XZ.
    const wingGeo = new THREE.PlaneGeometry(1, 1);
    wingGeo.rotateX(-Math.PI / 2);
    wingGeo.translate(0.5, 0, 0);
    const leftGeo = wingGeo.clone();
    leftGeo.scale(-1, 1, 1);
    // fix winding/normals after mirror
    const idx = leftGeo.index!; const a = idx.array as Uint16Array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; }
    leftGeo.computeVertexNormals();
    const thorax = new THREE.CapsuleGeometry(0.035, 0.5, 4, 8); thorax.rotateX(Math.PI / 2);
    const head = new THREE.SphereGeometry(0.06, 10, 8); head.translate(0, 0, -0.32);
    const antGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.32, 4); antGeo.translate(0, 0.16, 0);
    const knob = new THREE.SphereGeometry(0.018, 6, 5); knob.translate(0, 0.32, 0);
    this.geos.push(wingGeo, leftGeo, thorax, head, antGeo, knob);

    this.right.add(new THREE.Mesh(wingGeo, wingMat));
    this.left.add(new THREE.Mesh(leftGeo, wingMat));
    this.body.add(this.left, this.right, new THREE.Mesh(thorax, bodyMat), new THREE.Mesh(head, bodyMat));
    for (const s of [-1, 1]) {
      const ant = new THREE.Group();
      ant.add(new THREE.Mesh(antGeo, bodyMat), new THREE.Mesh(knob, bodyMat));
      ant.position.set(s * 0.02, 0.02, -0.34);
      ant.rotation.set(-1.0, 0, -s * 0.35);
      this.body.add(ant);
    }
    this.body.scale.setScalar(opts.size);
    this.object.add(this.body);
    this.object.traverse((o) => { o.raycast = () => {}; });
    this.update(0, false);
  }

  private pathAt(t: number, out: THREE.Vector3) {
    const { center: c, radius: r } = this.opts;
    // Lissajous-like loop with a wobble; never exceeds radius.
    out.set(
      c.x + r.x * (0.8 * Math.sin(t) + 0.2 * Math.sin(2.3 * t + 1)),
      c.y + r.y * (0.7 * Math.sin(2 * t + 0.6) + 0.3 * Math.sin(3.1 * t)),
      c.z + r.z * Math.cos(t),
    );
    return out;
  }

  /** Advance animation. When `animate` is false the butterfly holds a posed, still frame. */
  update(time: number, animate: boolean) {
    if (this.disposed) return;
    time += this.opts.phase ?? 0;
    const speed = this.opts.speed ?? 0.32;
    // Hover: periodically slow down the flight parameter.
    const s = animate ? time * speed - 0.35 * Math.sin(time * speed * 0.9) : 1.1 + (this.opts.phase ?? 0) * speed;
    const pos = this.pathAt(s, new THREE.Vector3());
    const ahead = this.pathAt(s + 0.05, new THREE.Vector3());
    const bob = animate ? Math.sin(time * 5.2) * 0.025 : 0;
    this.object.position.set(pos.x, pos.y + bob, pos.z);
    const dir = ahead.sub(pos);
    const yaw = Math.atan2(dir.x, -dir.z);
    const turn = dir.clone().sub(this.prev);
    this.prev.copy(dir);
    this.object.rotation.set(0, 0, 0);
    this.object.rotateY(-yaw);
    // pitch slightly upward so wings read toward camera, bank into turns
    this.body.rotation.x = 0.55 + (animate ? dir.y * 3 : 0);
    this.body.rotation.z = animate ? THREE.MathUtils.clamp(turn.x * -40, -0.5, 0.5) : 0.15;
    const hover = 0.5 + 0.5 * Math.sin(time * speed * 0.9);
    const rate = 9 + 5 * (1 - hover);
    const flap = animate ? 0.25 + 0.85 * (0.5 + 0.5 * Math.sin(time * rate)) : 0.55;
    this.right.rotation.z = flap;
    this.left.rotation.z = -flap;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.tex.dispose();
  }
}

/** A bounded group of independently colored butterflies sharing a flight area. */
export class ButterflyFlock {
  readonly object = new THREE.Group();
  private butterflies: Butterfly[] = [];
  private signature = "";

  constructor(private opts: FlightOptions) {
    this.object.name = "butterflies";
    this.object.userData.butterfly = true;
    this.setSettings(DEFAULT_BUTTERFLIES);
  }

  setSettings(settings: ButterflySettings) {
    const signature = JSON.stringify(settings);
    if (signature === this.signature) return;
    this.signature = signature;
    this.butterflies.forEach(butterfly => butterfly.dispose());
    this.butterflies = settings.items.map((item, i) => {
      const butterfly = new Butterfly({ ...this.opts, color: item.color, phase: i * 7.7 });
      butterfly.object.name = `butterfly-${item.id}`;
      this.object.add(butterfly.object);
      return butterfly;
    });
  }

  update(time: number, animate: boolean) {
    this.butterflies.forEach(butterfly => butterfly.update(time, animate));
  }

  dispose() {
    this.butterflies.forEach(butterfly => butterfly.dispose());
    this.butterflies = [];
    this.object.removeFromParent();
  }
}
