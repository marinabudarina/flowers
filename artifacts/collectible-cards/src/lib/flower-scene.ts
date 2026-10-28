import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CARD_H, assetUrl, type FlowerItem } from "./flower-arrangement";
import { FlowerLighting, prepareFlowerMaterial } from "./flower-lighting";
import { ButterflyFlock } from "./butterfly";
import type { ButterflySettings } from "./butterfly-settings";

export type AssetStatus = { state: "loading" | "ready" | "error"; loaded: number; total: number; error?: string };

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const D = 9;
const DEG = Math.PI / 180;

type Entry = { group: THREE.Group; item: FlowerItem; phase: number };

export class FlowerScene {
  renderer: THREE.WebGLRenderer;
  private behindRenderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private entries = new Map<string, Entry>();
  private templates = new Map<string, Promise<THREE.Object3D>>();
  private raf = 0;
  private tilt = { x: 0, y: 0 };
  private lightPointer = { x: 0, y: 0 };
  private lighting: FlowerLighting;
  private selection: THREE.BoxHelper | null = null;
  private selectedId: string | null = null;
  private clock = new THREE.Clock();
  private butterfly = new ButterflyFlock({ center: new THREE.Vector3(0, 0.15, 0.9), radius: new THREE.Vector3(1.05, 0.38, 0.35), size: 0.17 });
  sway = true;
  visible = true;
  onStatus: (file: string, s: AssetStatus) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, behindCanvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    try {
      this.behindRenderer = new THREE.WebGLRenderer({ canvas: behindCanvas, alpha: true, antialias: true });
    } catch (error) {
      this.renderer.dispose();
      throw error;
    }
    for (const renderer of [this.renderer, this.behindRenderer]) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.autoClear = false;
      renderer.setClearColor(0x000000, 0);
    }
    this.camera = new THREE.PerspectiveCamera(2 * Math.atan(CARD_H / 2 / D) / DEG, 613 / 405, 0.1, 50);
    this.camera.position.set(0, 0, D);
    this.lighting = new FlowerLighting(this.scene);
    this.butterfly.object.visible = false;
    this.scene.add(this.butterfly.object);
    this.loop();
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.behindRenderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setTilt(x: number, y: number) {
    this.tilt.x = x;
    this.tilt.y = y;
  }

  setLighting(x: number, y: number) {
    this.lightPointer = { x, y };
  }

  private loadTemplate(file: string) {
    let p = this.templates.get(file);
    if (p) return p;
    p = new Promise<THREE.Object3D>((resolve, reject) => {
      this.onStatus(file, { state: "loading", loaded: 0, total: 0 });
      new GLTFLoader().load(
        assetUrl(file),
        (gltf) => {
          const model = gltf.scene;
          model.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              const mats = Array.isArray(m.material) ? m.material : [m.material];
              mats.forEach(prepareFlowerMaterial);
            }
          });
          // Normalise by bounds: height 1, base at y=0, centred on x/z.
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const c = box.getCenter(new THREE.Vector3());
          const s = 1 / Math.max(size.y, 1e-4);
          model.position.set(-c.x, -box.min.y, -c.z);
          const wrap = new THREE.Group();
          wrap.add(model);
          wrap.scale.setScalar(s);
          this.onStatus(file, { state: "ready", loaded: 1, total: 1 });
          resolve(wrap);
        },
        (ev) => this.onStatus(file, { state: "loading", loaded: ev.loaded, total: ev.lengthComputable ? ev.total : 0 }),
        (err) => {
          const msg = err instanceof Error ? err.message : "Could not fetch model";
          this.onStatus(file, { state: "error", loaded: 0, total: 0, error: msg });
          this.templates.delete(file);
          reject(new Error(msg));
        },
      );
    });
    this.templates.set(file, p);
    return p;
  }

  retry(file: string) {
    this.templates.delete(file);
  }

  setItems(items: FlowerItem[]) {
    const ids = new Set(items.map((i) => i.id));
    for (const [id, e] of this.entries) {
      if (!ids.has(id)) { this.scene.remove(e.group); this.entries.delete(id); }
    }
    items.forEach((item, n) => {
      let e = this.entries.get(item.id);
      if (!e) {
        const group = new THREE.Group();
        group.userData.id = item.id;
        e = { group, item, phase: n * 1.7 };
        this.entries.set(item.id, e);
        this.scene.add(group);
      }
      e.item = item;
      if (item.visible && e.group.children.length === 0 && !e.group.userData.pending) {
        const g = e.group;
        g.userData.pending = true;
        this.loadTemplate(item.file).then(
          (t) => { g.userData.pending = false; if (g.children.length === 0) g.add(t.clone(true)); this.refreshSelection(); },
          () => { g.userData.pending = false; },
        );
      }
      this.apply(e);
    });
    this.refreshSelection();
  }

  setButterflies(settings: ButterflySettings) {
    this.butterfly.setSettings(settings);
  }

  private apply(e: Entry) {
    const { group: g, item } = e;
    g.visible = item.visible;
    g.position.set(item.x, item.y, item.z);
    g.rotation.set(item.rx * DEG, item.ry * DEG, item.rz * DEG, "XYZ");
    g.scale.setScalar(item.scale);
  }

  select(id: string | null) {
    this.selectedId = id;
    this.refreshSelection();
  }

  private refreshSelection() {
    if (this.selection) { this.scene.remove(this.selection); this.selection.dispose(); this.selection = null; }
    const e = this.selectedId ? this.entries.get(this.selectedId) : null;
    if (e && e.item.visible && e.group.children.length) {
      this.selection = new THREE.BoxHelper(e.group, 0x111111);
      this.scene.add(this.selection);
    }
  }

  private ndc(cx: number, cy: number) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  }

  pick(cx: number, cy: number): string | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.ndc(cx, cy), this.camera);
    const groups = [...this.entries.values()].filter((e) => e.item.visible).map((e) => e.group);
    const layerOf = (object: THREE.Object3D) => {
      let parent: THREE.Object3D | null = object;
      while (parent && parent.userData.id === undefined) parent = parent.parent;
      return this.entries.get(parent?.userData.id)?.item.zIndex ?? 1;
    };
    const hit = ray.intersectObjects(groups, true)
      .sort((a, b) => layerOf(b.object) - layerOf(a.object) || a.distance - b.distance)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && o.userData.id === undefined) o = o.parent;
    return (o?.userData.id as string) ?? null;
  }

  planePoint(cx: number, cy: number, z: number): THREE.Vector3 | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.ndc(cx, cy), this.camera);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), new THREE.Vector3());
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden || !this.visible) return;
    const t = this.clock.getElapsedTime();
    this.camera.position.set(-this.tilt.x * 2.8, this.tilt.y * 1.9, D);
    this.camera.lookAt(0, 0, 0);
    this.lighting.update(this.lightPointer.x, this.lightPointer.y, this.camera);
    for (const e of this.entries.values()) {
      this.apply(e);
      if (this.sway) e.group.rotation.z += Math.sin(t * 0.6 + e.phase) * 0.012;
    }
    this.selection?.update();
    this.butterfly.update(t, this.sway);
    // The DOM title sits between these transparent surfaces. Render each
    // integer layer separately so z-index remains independent of 3D depth.
    this.renderLayers(this.behindRenderer, true);
    this.renderLayers(this.renderer, false);
    for (const entry of this.entries.values()) entry.group.visible = entry.item.visible;
    if (this.selection) this.selection.visible = true;
  };

  private renderLayers(renderer: THREE.WebGLRenderer, behind: boolean) {
    renderer.clear();
    const layers = [...new Set([...this.entries.values()]
      .filter(e => e.item.visible && (e.item.zIndex < 0) === behind)
      .map(e => e.item.zIndex))].sort((a, b) => a - b);
    if (this.selection) this.selection.visible = false;
    for (const layer of layers) {
      for (const e of this.entries.values()) {
        e.group.visible = e.item.visible && e.item.zIndex === layer;
      }
      renderer.clearDepth();
      renderer.render(this.scene, this.camera);
    }
    if (!behind) {
      // Butterfly renders once, on the foreground surface only.
      for (const e of this.entries.values()) e.group.visible = false;
      this.butterfly.object.visible = true;
      renderer.clearDepth();
      renderer.render(this.scene, this.camera);
      this.butterfly.object.visible = false;
    }
    if (!behind && this.selection) {
      for (const e of this.entries.values()) e.group.visible = false;
      this.selection.visible = true;
      renderer.clearDepth();
      renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.butterfly.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.renderer.dispose();
    this.behindRenderer.dispose();
  }
}
