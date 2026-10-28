import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const artifact = path.join(root, "artifacts/collectible-cards");
const source = process.env.FLOWER_MODELS_DIR;
const basePath = process.env.BASE_PATH;

if (!source || !basePath?.startsWith("/") || !basePath.endsWith("/")) {
  throw new Error("Set FLOWER_MODELS_DIR and BASE_PATH before preparing the Pages build.");
}

const files = [
  "dried_flower_stem_3d_model_(1)_1792843376965.glb",
  "dried_flower_stem_3d_model_1792843376965.glb",
  "dried_plant_3d_model_1792843376965.glb",
  "lotus_seed_pod_3d_model_1792843376965.glb",
  "orange_poppy_3d_model_(1)_1792843376965.glb",
  "orange_poppy_3d_model_1792843376966.glb",
  "pink_poppy_3d_model_1792843376966.glb",
  "poppy_flower_3d_model_1792843376966.glb",
  "poppy_seed_pod_3d_model_(1)_1792843376966.glb",
  "poppy_seed_pod_3d_model_1792843376966.glb",
  "yellow_poppy_flower_3d_model_1792843376966.glb",
];

const uniqueFiles = [...new Set(files)];
const publicFlowers = path.join(artifact, "public/flowers");
await mkdir(publicFlowers, { recursive: true });

for (const file of uniqueFiles) {
  const sourceFile = path.join(source, file);
  const info = await stat(sourceFile).catch(() => null);
  if (!info?.isFile() || info.size < 100) {
    throw new Error(`Required flower model is missing or empty: ${file}`);
  }
  await copyFile(sourceFile, path.join(publicFlowers, file));
}

const manifest = Object.fromEntries(
  uniqueFiles.map(file => [file, `${basePath}flowers/${encodeURIComponent(file)}`]),
);
await writeFile(
  path.join(artifact, "src/lib/flower-assets.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
