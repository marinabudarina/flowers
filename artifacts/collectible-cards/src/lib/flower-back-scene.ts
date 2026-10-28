import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CARD_H, assetUrl } from "./flower-arrangement";
import { FlowerLighting, prepareFlowerMaterial } from "./flower-lighting";
import { ButterflyFlock } from "./butterfly";
import type { ButterflySettings } from "./butterfly-settings";

export const BACK_FLOWER = "poppy_flower_3d_model_1792843376966.glb";
const D = 9;
const DEG = Math.PI / 180;

/** Single-renderer scene for the card reverse: one red poppy, Figma placement.
 *  Uses the same card-space camera convention as FlowerScene (card spans x -1.5..1.5).
 *  The render loop only runs while `active` is true, so it idles when the front shows. */
export class FlowerBackScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(2 * Math.atan(CARD_H / 2 / D) / DEG, 612 / 400, 0.1, 50);
  private flower = new THREE.Group();
  private raf = 0;
  private tilt = { x: 0, y: 0 };
  private lightPointer = { x: 0, y: 0 };
  private lighting: FlowerLighting;
  private clock = new THREE.Clock();
  private active = false;
  private disposed = false;
  private butterfly = new ButterflyFlock({ center: new THREE.Vector3(0.25, 0.25, 0.9), radius: new THREE.Vector3(0.85, 0.32, 0.3), size: 0.19, speed: 0.36 });
  sway = true;
  onStatus: (s: "loading" | "ready" | "error", msg?: string) => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0, D);
    this.lighting = new FlowerLighting(this.scene);
    // Bloom upper-centre-right, stem running out past the bottom edge (clipped by the face).
    this.flower.position.set(0.22, -1.8, 0.1);
    this.flower.rotation.set(14 * DEG, 0, -4 * DEG);
    this.flower.scale.setScalar(2.65);
    this.scene.add(this.flower);
    this.scene.add(this.butterfly.object);
  }

  load() {
    if (this.disposed) return;
    this.onStatus("loading");
    new GLTFLoader().load(assetUrl(BACK_FLOWER), (gltf) => {
      if (this.disposed) { this.disposeModel(gltf.scene); return; }
      const model = gltf.scene;
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach(prepareFlowerMaterial);
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const c = box.getCenter(new THREE.Vector3());
      model.position.set(-c.x, -box.min.y, -c.z);
      const wrap = new THREE.Group();
      wrap.add(model);
      wrap.scale.setScalar(1 / Math.max(size.y, 1e-4));
      this.flower.clear();
      this.flower.add(wrap);
      this.onStatus("ready");
      this.renderOnce();
    }, undefined, (err) => {
      if (!this.disposed) this.onStatus("error", err instanceof Error ? err.message : "Could not fetch model");
    });
  }

  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    cancelAnimationFrame(this.raf);
    if (on) { this.resize(); this.loop(); }
  }

  setTilt(x: number, y: number) { this.tilt.x = x; this.tilt.y = y; }
  setButterflies(settings: ButterflySettings) { this.butterfly.setSettings(settings); }
  setLighting(x: number, y: number) { this.lightPointer = { x, y }; }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  private renderOnce() {
    // The two face rotations cancel, so parallax uses the front's direction.
    this.camera.position.set(-this.tilt.x * 2.2, this.tilt.y * 1.5, D);
    this.camera.lookAt(0, 0, 0);
    this.lighting.update(this.lightPointer.x, this.lightPointer.y, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  private loop = () => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const t = this.clock.getElapsedTime();
    this.flower.rotation.z = -4 * DEG + (this.sway ? Math.sin(t * 0.6) * 0.02 : 0);
    this.butterfly.update(t, this.sway);
    this.renderOnce();
  };

  private disposeModel(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
          for (const value of Object.values(mat)) if (value instanceof THREE.Texture) value.dispose();
          mat.dispose();
        });
      }
    });
  }

  dispose() {
    this.disposed = true;
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.butterfly.dispose();
    this.disposeModel(this.scene);
    this.renderer.dispose();
  }
}
