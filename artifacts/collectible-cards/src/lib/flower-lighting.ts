import * as THREE from "three";

/** Shared softbox size and placement for the flowers and gold-foil shader. */
export const CURSOR_LIGHT = { depth: 3.2, radius: 1.15, intensity: 30 };
export const CURSOR_LIGHT_SAMPLES = [
  [0, 0, 0.4], [-1, 0, 0.15], [1, 0, 0.15], [0, -1, 0.15], [0, 1, 0.15],
] as const;

const pointerRay = new THREE.Vector3();
export function cursorLightPosition(x: number, y: number, camera: THREE.PerspectiveCamera, out: THREE.Vector3) {
  camera.updateMatrixWorld();
  pointerRay.set(x, -y, 0.5).unproject(camera).sub(camera.position).normalize();
  const distance = (CURSOR_LIGHT.depth - camera.position.z) / pointerRay.z;
  return out.copy(camera.position).addScaledVector(pointerRay, distance);
}

/** Original studio lighting, plus one additional cursor-following light. */
export class FlowerLighting {
  private center = new THREE.Vector3();
  // A five-point softbox approximation illuminates a broad area without
  // replacing the studio lights or modifying any flower materials.
  private cursor = CURSOR_LIGHT_SAMPLES.map(([, , weight]) =>
    new THREE.PointLight(0xfffaf0, CURSOR_LIGHT.intensity * weight, 0, 2));

  constructor(scene: THREE.Scene) {
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 4, 6);
    const fill = new THREE.DirectionalLight(0xfff1e0, 0.7);
    fill.position.set(4, -1, 3);
    this.cursor.forEach((light, i) => {
      const [x, y] = CURSOR_LIGHT_SAMPLES[i];
      light.position.set(x * CURSOR_LIGHT.radius, y * CURSOR_LIGHT.radius, CURSOR_LIGHT.depth);
    });
    scene.add(new THREE.HemisphereLight(0xfffaf0, 0x9a8f80, 1.7), key, fill, ...this.cursor);
  }

  update(x: number, y: number, camera: THREE.PerspectiveCamera) {
    cursorLightPosition(x, y, camera, this.center);
    this.cursor.forEach((light, i) => {
      const [x, y] = CURSOR_LIGHT_SAMPLES[i];
      light.position.copy(this.center);
      light.position.x += x * CURSOR_LIGHT.radius;
      light.position.y += y * CURSOR_LIGHT.radius;
    });
  }
}

export function prepareFlowerMaterial(material: THREE.Material) {
  material.side = THREE.DoubleSide;
}
