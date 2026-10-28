// Arrangement model for the Budarina card. Units are card-space world units:
// the card face spans x -1.5..1.5 and y -CARD_H/2..CARD_H/2. `y` is the stem base.
export const CARD_W = 3;
export const CARD_H = (3 * 405) / 613;

export type FlowerItem = {
  id: string;
  file: string;
  label: string;
  note: string;
  x: number;
  y: number;
  z: number;
  zIndex: number;
  scale: number;
  rx: number;
  ry: number;
  rz: number;
  visible: boolean;
};

export type Arrangement = { version: 1; items: FlowerItem[] };

const manifests = import.meta.glob<{ default: Record<string, string> }>("./flower-assets.json", { eager: true });
const manifest: Record<string, string> = Object.values(manifests)[0]?.default ?? {};

export function assetUrl(file: string): string {
  return manifest[file] ?? `/api/flower-assets/${encodeURIComponent(file)}`;
}

const F = {
  stemA: "dried_flower_stem_3d_model_(1)_1792843376965.glb",
  stemB: "dried_flower_stem_3d_model_1792843376965.glb",
  plant: "dried_plant_3d_model_1792843376965.glb",
  lotus: "lotus_seed_pod_3d_model_1792843376965.glb",
  orangeA: "orange_poppy_3d_model_(1)_1792843376965.glb",
  orangeB: "orange_poppy_3d_model_1792843376966.glb",
  pink: "pink_poppy_3d_model_1792843376966.glb",
  pale: "poppy_flower_3d_model_1792843376966.glb",
  podA: "poppy_seed_pod_3d_model_(1)_1792843376966.glb",
  podB: "poppy_seed_pod_3d_model_1792843376966.glb",
  yellow: "yellow_poppy_flower_3d_model_1792843376966.glb",
};

export const ALL_FILES = Object.values(F);

function it(id: string, file: string, label: string, note: string, x: number, top: number, z: number, rx = 0, ry = 0, rz = 0, visible = true): FlowerItem {
  const base = -1.12;
  return { id, file, label, note, x, y: base, z, zIndex: 1, scale: Math.max(0.5, top - base), rx, ry, rz, visible };
}

export const DEFAULT_ARRANGEMENT: Arrangement = {
  version: 1,
  items: [
    { ...it("pale", F.pale, "Red poppy", "Deep red poppy with crumpled petals", -0.74, 0.55, 0.15, 12), scale: 1.65, y: 0.55 - 1.65 },
    it("yellow", F.yellow, "Golden poppy", "Iceland poppy, saturated yolk yellow", -0.05, 0.42, 0.25, 12),
    it("pink", F.pink, "Pink poppy", "Tissue-thin pink, dark crown", 0.6, 0.76, 0.05, 12),
    { ...it("orangeA", F.orangeA, "Large orange poppy", "Low, wide, the warmest stem", -0.36, 0.1, 0.6, 14), scale: 1.45, y: -1.35 },
    it("orangeB", F.orangeB, "Orange poppy", "Medium head, leaning right", 0.7, 0.08, 0.35, 14),
    it("lotus", F.lotus, "Lotus seed pod", "Dried, honeycomb face", -0.9, -0.24, 0.45, 18),
    it("stemB", F.stemB, "Dry curved stem", "Rust-coloured seed spray", -1.2, -0.22, 0.2),
    it("plant", F.plant, "Dry slender plant", "Feathered grass head", -0.1, 0.22, -0.15, 0, 0, -20),
    it("stemA", F.stemA, "Dry stem, right", "Second rust spray", 1.1, -0.2, 0.1, 0, 0, -6),
    it("podB", F.podB, "Poppy seed pod", "Small pod, centre", 0.31, -0.3, 0.3),
    it("podA", F.podA, "Poppy seed pod, low", "Small pod, bottom", 0.06, -0.72, 0.5),
    it("podC", F.podB, "Poppy seed pod, right", "Copy of the centre pod", 1.03, -0.68, 0.4, 0, 40, 0, true),
    it("red", F.yellow, "Yellow poppy, spare", "Spare yellow stem, hidden by default", -1.0, 0.1, 0.0, 12, 30, 0, false),
  ],
};

export const STORAGE_KEY = "budarina.arrangement.v1";

export function cloneArrangement(a: Arrangement): Arrangement {
  return { version: 1, items: a.items.map((i) => ({ ...i })) };
}

export function parseArrangement(raw: unknown): Arrangement {
  if (!raw || typeof raw !== "object") throw new Error("Not an arrangement object.");
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) throw new Error("Missing an items list.");
  const known = new Set(ALL_FILES);
  const out: FlowerItem[] = items.map((r, n) => {
    const o = r as Record<string, unknown>;
    const num = (k: string) => {
      const v = Number(o[k]);
      if (!Number.isFinite(v)) throw new Error(`Item ${n + 1}: "${k}" is not a number.`);
      return v;
    };
    if (typeof o.id !== "string" || typeof o.file !== "string") throw new Error(`Item ${n + 1}: missing id or file.`);
    if (!known.has(o.file)) throw new Error(`Item ${n + 1}: unknown model "${o.file}".`);
    return {
      id: o.id, file: o.file,
      label: typeof o.label === "string" ? o.label : o.id,
      note: typeof o.note === "string" ? o.note : "",
      x: num("x"), y: num("y"), z: num("z"), scale: Math.max(0.05, num("scale")),
      zIndex: o.zIndex === undefined ? 1 : Math.max(-10, Math.min(10, Math.round(num("zIndex")))),
      rx: num("rx"), ry: num("ry"), rz: num("rz"), visible: o.visible !== false,
    };
  });
  return { version: 1, items: out };
}

export type LoadResult = { arrangement: Arrangement; source: "saved" | "default"; error?: string };

export function loadSaved(): LoadResult {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return { arrangement: cloneArrangement(DEFAULT_ARRANGEMENT), source: "default" };
    const arrangement = parseArrangement(JSON.parse(s));
    // Apply the requested flower replacement without discarding saved transforms.
    for (const item of arrangement.items) {
      if (item.id === "pale" && item.file === F.yellow) {
        item.file = F.pale;
        item.label = "Red poppy";
        item.note = "Deep red poppy with crumpled petals";
      }
    }
    return { arrangement, source: "saved" };
  } catch (e) {
    return { arrangement: cloneArrangement(DEFAULT_ARRANGEMENT), source: "default", error: e instanceof Error ? e.message : String(e) };
  }
}

export function saveArrangement(a: Arrangement) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
}
