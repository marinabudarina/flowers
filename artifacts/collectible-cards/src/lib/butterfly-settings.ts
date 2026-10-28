export type ButterflyItem = { id: string; color: string };
export type ButterflySettings = { version: 1; items: ButterflyItem[] };
export const MAX_BUTTERFLIES = 8;
export const DEFAULT_BUTTERFLIES: ButterflySettings = {
  version: 1, items: [{ id: "butterfly-1", color: "#f08a24" }],
};
const STORAGE_KEY = "budarina.butterflies.v1";

export function cloneButterflies(settings: ButterflySettings): ButterflySettings {
  return { version: 1, items: settings.items.map(item => ({ ...item })) };
}

export function parseButterflies(raw: unknown): ButterflySettings {
  if (!raw || typeof raw !== "object") throw new Error("Invalid butterfly settings.");
  const value = raw as Record<string, unknown>;
  if (value.version !== 1 || !Array.isArray(value.items) || value.items.length > MAX_BUTTERFLIES) {
    throw new Error(`Choose up to ${MAX_BUTTERFLIES} butterflies.`);
  }
  const ids = new Set<string>();
  const items = value.items.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid butterfly.");
    const { id, color } = item as Record<string, unknown>;
    if (typeof id !== "string" || !id.length || id.length > 80 || ids.has(id)) throw new Error("Invalid butterfly ID.");
    if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Choose a valid butterfly color.");
    ids.add(id);
    return { id, color: color.toLowerCase() };
  });
  return { version: 1, items };
}

export function loadButterflies(): { settings: ButterflySettings; error?: string } {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return { settings: value ? parseButterflies(JSON.parse(value)) : cloneButterflies(DEFAULT_BUTTERFLIES) };
  } catch (error) {
    return { settings: cloneButterflies(DEFAULT_BUTTERFLIES), error: error instanceof Error ? error.message : "Butterfly settings could not be read." };
  }
}

export function saveButterflies(settings: ButterflySettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parseButterflies(settings)));
}
