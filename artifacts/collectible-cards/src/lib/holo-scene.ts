import * as THREE from "three";
import { CARDS, type CardDef } from "./cards";

const CARD_W = 3;
const CARD_H = 4.65;
const CARD_D = 0.012;

/* ---------- shapes ---------- */

function roundedPoly(pts: [number, number][], r: number): THREE.Shape {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const rr = Math.min(r, la * 0.48, lb * 0.48);
    const p1: [number, number] = [p[0] + ((a[0] - p[0]) / la) * rr, p[1] + ((a[1] - p[1]) / la) * rr];
    const p2: [number, number] = [p[0] + ((b[0] - p[0]) / lb) * rr, p[1] + ((b[1] - p[1]) / lb) * rr];
    if (i === 0) s.moveTo(p1[0], p1[1]);
    else s.lineTo(p1[0], p1[1]);
    s.quadraticCurveTo(p[0], p[1], p2[0], p2[1]);
  }
  s.closePath();
  return s;
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function gShape(): THREE.Shape {
  const R = 1, r = 0.6, bar = 0.2;
  const a0 = 0.72;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 100; i++) {
    const a = a0 + (Math.PI * 2 - a0) * i / 100;
    pts.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  pts.push([R, bar], [0.02, bar], [0.02, -bar]);
  const ia = Math.asin(bar / r);
  for (let i = 0; i <= 100; i++) {
    const a = Math.PI * 2 - ia - (Math.PI * 2 - ia - a0) * i / 100;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return roundedPoly(pts, 0.085);
}

function critterShape(): THREE.Shape {
  const pts: [number, number][] = [
    [-0.86, 0.78], [-0.86, 0.3], [-1.3, 0.3], [-1.3, -0.3], [-0.86, -0.3],
    [-0.86, -1.0], [-0.6, -1.02], [-0.6, -0.58], [-0.38, -0.58], [-0.38, -0.99],
    [-0.12, -1.01], [-0.12, -0.58], [0.12, -0.58], [0.12, -1.0], [0.38, -1.02],
    [0.38, -0.58], [0.6, -0.58], [0.6, -0.99], [0.86, -1.01], [0.86, -0.3],
    [1.3, -0.3], [1.3, 0.3], [0.86, 0.3], [0.86, 0.8],
  ].reverse() as [number, number][];
  return roundedPoly(pts, 0.2);
}

function sunShape(): THREE.Shape {
  const pts: [number, number][] = [];
  const rays = 12;
  const lens = [1, 0.82, 0.95, 0.78, 1.02, 0.86, 0.93, 0.8, 0.99, 0.84, 0.9, 0.79];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + 0.13;
    const w = 0.085;
    const L = lens[i];
    pts.push([Math.cos(a - w * 2.2) * 0.3, Math.sin(a - w * 2.2) * 0.3]);
    pts.push([Math.cos(a - w / L) * L, Math.sin(a - w / L) * L]);
    pts.push([Math.cos(a + w / L) * L, Math.sin(a + w / L) * L]);
    pts.push([Math.cos(a + w * 2.2) * 0.3, Math.sin(a + w * 2.2) * 0.3]);
  }
  return roundedPoly(pts, 0.07);
}

/* ---------- materials ---------- */

const vert = /* glsl */ `
uniform float uScale; uniform float uPuff;
varying vec3 vN; varying vec3 vW; varying vec3 vObj; varying vec3 vON; varying vec3 vZ;
void main(){
  vObj = position; vON = normal;
  vZ = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  vec2 p = position.xy / uScale;
  // pillowed normals: front cap leans outward like a domed resin pour
  float cap = smoothstep(0.55, 1.0, normal.z);
  vec3 n = normal + vec3(p * uPuff * cap, 0.0);
  vec4 w = modelMatrix * vec4(position,1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform float uTime; uniform int uMode; uniform float uScale; uniform float uBand;
uniform vec3 uFaceA; uniform vec3 uFaceB; uniform vec3 uSideA; uniform vec3 uSideB; uniform vec3 uSideC;
varying vec3 vN; varying vec3 vW; varying vec3 vObj; varying vec3 vON; varying vec3 vZ;
vec3 pal(float t){ return 0.5 + 0.5*cos(6.28318*(t + vec3(0.0,0.33,0.67))); }
float rectMask(vec2 a, vec2 c, vec2 h, float soft){ vec2 d = abs(a-c)-h; return 1.0 - smoothstep(0.0, soft, max(d.x,d.y)); }
// procedural photo studio: dark cyclorama with crisp white softboxes
vec3 studio(vec3 R){
  vec2 a = vec2(atan(R.x, R.z), asin(clamp(R.y,-1.0,1.0)));
  vec3 c = mix(vec3(0.015,0.014,0.02), vec3(0.16,0.15,0.19), smoothstep(-0.4, 0.9, R.y));
  c += vec3(1.0) * 3.0 * rectMask(a, vec2(-0.62, 0.62), vec2(0.42, 0.2), 0.03);
  c += vec3(1.0) * 2.2 * rectMask(a, vec2(0.95, 0.15), vec2(0.07, 0.55), 0.02);
  c += vec3(1.0,0.96,0.92) * 1.6 * rectMask(a, vec2(-1.35, -0.05), vec2(0.05, 0.4), 0.02);
  c += vec3(0.9,0.95,1.0) * 0.9 * rectMask(a, vec2(0.2, -0.75), vec2(0.6, 0.06), 0.08);
  return c;
}
void main(){
  vec3 N = normalize(vN);
  vec3 ON = normalize(vON);
  vec3 V = normalize(cameraPosition - vW);
  vec3 R = reflect(-V, N);
  float ndv = clamp(dot(N,V), 0.0, 1.0);
  vec2 p = vObj.xy / uScale;
  float face = smoothstep(0.72, 0.97, ON.z);
  if(uMode == 2) face = 0.0;
  float side = 1.0 - face;

  // Face: ONE coherent dye that shifts magenta -> yellow -> orange with the object's tilt.
  vec3 Vc = normalize(cameraPosition - vW);
  float tilt = dot(vZ.xy, vec2(2.6, -2.0)) + dot(Vc.xy - vZ.xy, vec2(0.6, 0.4)) + sin(uTime*0.35)*0.35;
  float ft = fract(tilt * 0.5 + 0.08);
  // Palette uniforms are linear RGB, unlike CSS/sRGB literals. Keeping these
  // in the correct space prevents the final sRGB conversion washing out dye.
  vec3 mag = uFaceA, yel = vec3(1.0, 0.58, 0.002), org = uFaceB;
  vec3 faceCol = ft < 0.33 ? mix(mag, yel, smoothstep(0.0, 0.33, ft))
               : ft < 0.66 ? mix(yel, org, smoothstep(0.33, 0.66, ft))
               : mix(org, mag, smoothstep(0.66, 1.0, ft));
  // The character's glossy black eyes are not holographic resin.
  if(max(uFaceA.r, max(uFaceA.g, uFaceA.b)) < 0.02) {
    faceCol = uFaceA;
  }
  // Rim: contrasting lime / cyan / purple, moving on its own phase with local normal + tilt
  float rt = fract(dot(vZ.xy, vec2(-1.9, 2.4)) * 0.5 + dot(N.xy, vec2(0.35, 0.25)) + 0.55 + uTime*0.02);
  vec3 lime = uSideC, cyan = uSideA, purp = uSideB;
  vec3 sideCol = rt < 0.33 ? mix(lime, cyan, smoothstep(0.0, 0.33, rt))
               : rt < 0.66 ? mix(cyan, purp, smoothstep(0.33, 0.66, rt))
               : mix(purp, lime, smoothstep(0.66, 1.0, rt));
  vec3 albedo = mix(sideCol, faceCol, face);
  // single razor-thin bright line where face rolls into rim
  float band = exp(-pow((ON.z - 0.86) / 0.035, 2.0));
  albedo = mix(albedo, vec3(1.0), band * uBand * 0.28);

  vec3 L = normalize(vec3(-0.5, 0.8, 0.9));
  float diff = 0.5 + 0.5*max(dot(N, L), 0.0);
  vec3 col = albedo * mix(0.92, diff, side*0.8 + 0.2);
  // warm subsurface glow in the belly of the resin
  col += mix(faceCol, vec3(1.0,0.48,0.005), 0.25) * exp(-dot(p - vec2(0.05,-0.15), p - vec2(0.05,-0.15)) * 9.0) * 0.18 * face;

  vec3 env = studio(R);
  float fres = 0.04 + 0.96*pow(1.0 - ndv, 5.0);
  // clearcoat on the face, tinted chrome on sides
  // only the bright softboxes reflect: white highlights, no grey chrome wash
  vec3 hi = max(env - vec3(0.45), vec3(0.0));
  col += hi * (0.035 + fres * 0.12) * face;
  // saturated holographic sidewalls: dye-coloured, lit, with tinted + white glints
  vec3 sideLit = albedo * (0.7 + 0.35 * diff) + hi * albedo * 0.08;
  col = mix(col, sideLit, side);
  col += albedo * fres * 0.18 * side;
  float sp = pow(max(dot(N, normalize(L + V)), 0.0), 240.0);
  col += vec3(sp * 0.12);
  col = col / (1.0 + col * 0.1);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

interface Palette { faceA: number; faceB: number; sideA: number; sideB: number; sideC: number; band?: number; puff?: number; mode?: number }

const HOT: Palette = { faceA: 0xff1493, faceB: 0xff7417, sideA: 0x14e0ff, sideB: 0x9b30ff, sideC: 0x8cff2a, puff: 0.32, band: 0.55 };

function holoMat(pal: Palette, scale: number) {
  const c = (h: number) => new THREE.Color(h);
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: pal.mode ?? 0 },
      uScale: { value: scale },
      uPuff: { value: pal.puff ?? 0.34 },
      uBand: { value: pal.band ?? 0.9 },
      uFaceA: { value: c(pal.faceA) }, uFaceB: { value: c(pal.faceB) },
      uSideA: { value: c(pal.sideA) }, uSideB: { value: c(pal.sideB) }, uSideC: { value: c(pal.sideC) },
    },
  });
}

/** Preserve the clean rounded silhouette; do not warp bevel vertices. */
function sculpt(geo: THREE.ExtrudeGeometry, sc: number, _seed: number) {
  geo.scale(sc, sc, 1);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/* ---------- face texture ---------- */

function faceTexture(def: CardDef, renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const W = 1024, H = Math.round((1024 * CARD_H) / CARD_W);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const draw = () => {
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    const sans = "Geist, system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.42)";
    g.strokeStyle = "rgba(255,255,255,0.32)";
    g.lineWidth = 2;
    g.font = `400 30px ${sans}`;
    g.textBaseline = "middle";
    const ty = 104;
    g.textAlign = "left"; g.fillText(def.date[0], 84, ty);
    g.textAlign = "center"; g.fillText(def.date[1], W / 2, ty);
    g.textAlign = "right"; g.fillText(def.date[2], W - 84, ty);
    g.beginPath();
    g.moveTo(240, ty); g.lineTo(400, ty);
    g.moveTo(W - 400, ty); g.lineTo(W - 240, ty);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.96)";
    g.textAlign = "center";
    g.font = `400 ${def.title[1].length > 10 ? 132 : 140}px ${sans}`;
    g.fillText(def.title[0], W / 2, 270);
    g.fillText(def.title[1], W / 2, 410);
    g.fillStyle = "rgba(255,255,255,0.52)";
    g.font = `300 30px ${sans}`;
    g.fillText(def.caption[0], W / 2, H - 300);
    g.fillText(def.caption[1], W / 2, H - 262);
    // tags
    g.font = `400 26px ${sans}`;
    let x = 84;
    const py = H - 124;
    g.strokeStyle = "rgba(255,255,255,0.4)";
    g.fillStyle = "rgba(255,255,255,0.55)";
    for (const t of def.tags) {
      const w = g.measureText(t).width + 44;
      const r = 24;
      g.beginPath();
      g.roundRect(x, py - r, w, r * 2, r);
      g.stroke();
      g.textAlign = "center";
      g.fillText(t, x + w / 2, py + 1);
      x += w + 10;
    }
    // index + arrow
    g.textAlign = "right";
    g.font = `400 26px "Geist Mono", monospace`;
    g.fillText(def.index + " / 03", W - 140, py + 1);
    g.beginPath();
    g.moveTo(W - 112, py - 12); g.lineTo(W - 88, py + 12);
    g.moveTo(W - 88, py - 6); g.lineTo(W - 88, py + 12); g.lineTo(W - 106, py + 12);
    g.stroke();
    tex.needsUpdate = true;
  };
  draw();
  if (document.fonts) document.fonts.ready.then(draw).catch(() => {});
  return tex;
}

function shadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(12,12,18,0.8)");
  grd.addColorStop(0.4, "rgba(12,12,18,0.42)");
  grd.addColorStop(0.75, "rgba(12,12,18,0.09)");
  grd.addColorStop(1, "rgba(20,20,30,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* ---------- scene ---------- */

interface CardRig {
  group: THREE.Group;
  shadow: THREE.Mesh;
  mats: THREE.ShaderMaterial[];
}

export interface SceneOptions {
  reducedMotion: boolean;
  onContextLost: () => void;
}

const easeOutBack = (t: number) => {
  const c1 = 1.5, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class HoloScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  rigs: CardRig[] = [];
  active = 0;
  prev = -1;
  dir = 1;
  swapT = 1;
  clock = new THREE.Clock();
  raf = 0;
  reduced: boolean;
  // tilt springs
  tx = 0; ty = 0; vx = 0; vy = 0; gx = 0; gy = 0;
  dragging = false;
  private el: HTMLElement;
  private ro: ResizeObserver;
  private lost: () => void;

  constructor(el: HTMLElement, opts: SceneOptions) {
    this.el = el;
    this.reduced = opts.reducedMotion;
    this.lost = opts.onContextLost;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xffffff, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.addEventListener("webglcontextlost", this.onLost);
    this.renderer.debug.onShaderError = (gl, program, vs, fs) => {
      console.error("[holo] shader program failed", {
        program: gl.getProgramInfoLog(program),
        vertex: gl.getShaderInfoLog(vs),
        fragment: gl.getShaderInfoLog(fs),
      });
      this.lost();
    };
    el.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-2, 3, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe6ff, 0.6);
    rim.position.set(3, -1, 2);
    this.scene.add(rim);

    const shadowTex = shadowTexture();
    for (const def of CARDS) this.rigs.push(this.buildCard(def, shadowTex));
    this.rigs.forEach((r, i) => (r.group.visible = r.shadow.visible = i === 0));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.loop();
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    console.warn("[holo] WebGL context lost");
    this.lost();
  };

  private buildCard(def: CardDef, shadowTex: THREE.Texture): CardRig {
    const group = new THREE.Group();
    const body = new THREE.ExtrudeGeometry(roundedRect(CARD_W, CARD_H, 0.26), {
      depth: CARD_D, bevelEnabled: false, curveSegments: 24,
    });
    body.translate(0, 0, -CARD_D / 2);
    const matte = new THREE.MeshStandardMaterial({ color: 0x0b0a0d, roughness: 0.92, metalness: 0.05 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x1a191d, roughness: 0.6, metalness: 0.2 });
    group.add(new THREE.Mesh(body, [matte, edgeMat]));

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({ map: faceTexture(def, this.renderer), transparent: true, depthWrite: false }),
    );
    face.position.z = CARD_D / 2 + 0.004;
    group.add(face);

    const mats: THREE.ShaderMaterial[] = [];
    // Flat foil coating, not a domed surface. Its interference hue follows view angle.
    const foil = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vWorld; varying vec3 vNormal; varying vec2 vPos;
        void main(){
          vec4 w=modelMatrix*vec4(position,1.0);
          vWorld=w.xyz; vNormal=normalize(mat3(modelMatrix)*normal); vPos=position.xy;
          gl_Position=projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vWorld; varying vec3 vNormal; varying vec2 vPos;
        void main(){
          vec3 V=normalize(cameraPosition-vWorld);
          float angle=1.0-abs(dot(normalize(vNormal),V));
          float phase=angle*4.0+vPos.x*0.12+vPos.y*0.08+sin(uTime*0.25)*0.06;
          vec3 tint=0.5+0.5*cos(6.28318*(phase+vec3(0.0,0.33,0.67)));
          float sheen=0.5+0.5*sin(phase*8.0);
          gl_FragColor=vec4(tint,0.07+0.16*sheen+angle*0.16);
          #include <colorspace_fragment>
        }`,
    });
    mats.push(foil);
    const coating = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(CARD_W, CARD_H, 0.26)), foil);
    coating.position.z = CARD_D / 2 + 0.002;
    group.add(coating);
    const art = new THREE.Group();
    const front = CARD_D / 2 + 0.025;
    const ext = (shape: THREE.Shape, depth: number, bt: number, bs: number, cs = 24) =>
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 18, curveSegments: cs });
    // A single connected extrusion: the small front cap rolls outward to
    // its wider circumference. Almost no straight wall between the roundovers.
    const lift = 0.17;
    if (def.id === "google") {
      const sc = 0.98;
      const m = holoMat(HOT, sc);
      mats.push(m);
      art.add(new THREE.Mesh(sculpt(ext(gShape(), 0.015, 0.16, 0.075, 80), sc, 1.1), m));
    } else if (def.id === "critter") {
      const sc = 0.9;
      const m = holoMat({ ...HOT, puff: 0.4 }, sc);
      mats.push(m);
      art.add(new THREE.Mesh(sculpt(ext(critterShape(), 0.015, 0.16, 0.06), sc, 2.4), m));
      const eyeGeo = sculpt(ext(roundedPoly([[-0.12, -0.12], [0.12, -0.12], [0.12, 0.12], [-0.12, 0.12]], 0.04), 0.02, 0.05, 0.03, 8), sc, 0.3);
      const em = holoMat({ faceA: 0x120712, faceB: 0x1d0a22, sideA: 0x2a1030, sideB: 0x120712, sideC: 0x3a1650, band: 0.25, puff: 0.9 }, sc * 0.2);
      mats.push(em);
      for (const x of [-0.46, 0.46]) {
        const e = new THREE.Mesh(eyeGeo, em);
        e.position.set(x * sc, 0.32 * sc, 0.19);
        art.add(e);
      }
    } else {
      const sc = 1.12;
      const m = holoMat({ ...HOT, faceB: 0xff6a10, puff: 0.28 }, sc);
      mats.push(m);
      art.add(new THREE.Mesh(sculpt(ext(sunShape(), 0.015, 0.16, 0.04, 24), sc, 3.7), m));
    }
    art.position.set(0, -0.25, front + lift);
    // Logo and card share exactly the same orientation.
    art.rotation.set(0, 0, 0);
    group.add(art);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 1.6, CARD_H * 0.27),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    shadow.position.set(0, -CARD_H / 2 - 0.22, -0.9);
    this.scene.add(shadow);
    this.scene.add(group);
    return { group, shadow, mats };
  }

  resize() {
    const w = Math.max(1, this.el.clientWidth), h = Math.max(1, this.el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const vfov = (this.camera.fov * Math.PI) / 180;
    const needH = CARD_H * 1.48;
    const needW = CARD_W * 1.65;
    const dH = needH / 2 / Math.tan(vfov / 2);
    const dW = needW / 2 / (Math.tan(vfov / 2) * this.camera.aspect);
    this.camera.position.set(0, 0, Math.max(dH, dW));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  show(i: number, dir: number) {
    if (i === this.active) return;
    this.prev = this.active;
    this.active = i;
    this.dir = dir;
    this.swapT = this.reduced ? 1 : 0;
    this.rigs.forEach((r, k) => (r.group.visible = r.shadow.visible = k === i || k === this.prev));
    if (this.reduced) this.finishSwap();
  }

  private finishSwap() {
    if (this.prev >= 0) this.rigs[this.prev].group.visible = this.rigs[this.prev].shadow.visible = false;
    this.prev = -1;
  }

  /** nx, ny in -1..1 */
  setPointer(nx: number, ny: number, dragging: boolean) {
    this.dragging = dragging;
    const k = dragging ? 0.75 : 0.28;
    this.gx = THREE.MathUtils.clamp(ny * k, -0.8, 0.8);
    this.gy = THREE.MathUtils.clamp(nx * k, -0.9, 0.9);
  }
  release() {
    this.dragging = false;
    this.gx = 0; this.gy = 0;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 1 / 30);
    const t = this.clock.elapsedTime;

    // spring tilt (inertia)
    const stiff = this.dragging ? 120 : 38, damp = this.dragging ? 16 : 7.5;
    this.vx += (stiff * (this.gx - this.tx) - damp * this.vx) * dt;
    this.vy += (stiff * (this.gy - this.ty) - damp * this.vy) * dt;
    this.tx += this.vx * dt;
    this.ty += this.vy * dt;

    const sway = this.reduced ? 0 : 1;
    const floatY = Math.sin(t * 0.9) * 0.07 * sway;
    const swayX = Math.sin(t * 0.55) * 0.05 * sway;
    const swayY = Math.sin(t * 0.42 + 1) * 0.09 * sway;
    const swayZ = Math.sin(t * 0.37) * 0.015 * sway;

    if (this.swapT < 1) {
      this.swapT = Math.min(1, this.swapT + dt / 1.05);
      if (this.swapT >= 1) this.finishSwap();
    }
    const s = this.swapT;

    this.rigs.forEach((rig, i) => {
      for (const m of rig.mats) m.uniforms.uTime.value = this.reduced ? 0 : t;
      if (!rig.group.visible) return;
      const g = rig.group;
      let x = 0, y = floatY, z = 0, rx = this.tx + swayX, ry = this.ty + swayY, rz = swayZ, sc = 1;
      if (i === this.prev) {
        const e = easeInOut(Math.min(1, s * 1.25));
        x = -this.dir * 0.9 * Math.sin(e * Math.PI) ;
        z = -2.4 * e;
        sc = 1 - 0.18 * e;
        ry += -this.dir * 0.5 * Math.sin(e * Math.PI);
        rz += -this.dir * 0.08 * e;
        y += -0.15 * e;
      } else if (i === this.active && this.prev >= 0) {
        const e = easeOutBack(Math.max(0, (s - 0.12) / 0.88));
        const arc = Math.sin(Math.min(1, e) * Math.PI);
        x = this.dir * 1.6 * (1 - e) + this.dir * 0.5 * arc;
        z = -2.4 * (1 - e);
        sc = 0.82 + 0.18 * e;
        ry += this.dir * 0.85 * (1 - e);
        rz += this.dir * 0.12 * (1 - e);
      }
      g.position.set(x, y, z);
      g.rotation.set(rx, ry, rz);
      g.scale.setScalar(sc);
      g.renderOrder = i === this.active ? 2 : 1;
      rig.shadow.position.x = x;
      const lift = 1 - (y + 0.07) * 1.6;
      rig.shadow.scale.set(sc * Math.max(0.4, Math.abs(Math.cos(ry))) * lift, sc * lift, 1);
      (rig.shadow.material as THREE.MeshBasicMaterial).opacity = Math.min(1, 0.95 + Math.abs(ry) * 0.2 - (y + 0.07)) * (i === this.active ? 1 : 1 + z * 0.3);
    });

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.onLost);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) {
        const mm = mat as THREE.MeshBasicMaterial;
        mm.map?.dispose();
        mm.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}
