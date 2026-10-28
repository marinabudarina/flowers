import { parseArrangement, type Arrangement } from "./flower-arrangement";
import { DEFAULT_CARD_TITLE, MAX_TITLE } from "./card-title";
import { cloneButterflies, DEFAULT_BUTTERFLIES, parseButterflies, type ButterflySettings } from "./butterfly-settings";

export type GiftSnapshot = {
  title: string;
  recipient: string;
  theme: "light" | "dark";
  arrangement: Arrangement;
  butterflies?: ButterflySettings;
};

export function readGiftLink(): { gift: GiftSnapshot | null; error: string | null } {
  const value = new URLSearchParams(window.location.hash.slice(1)).get("gift");
  if (!value) return { gift: null, error: null };
  try {
    if (value.length > 30000) throw new Error("Card link is too large.");
    const raw = JSON.parse(value);
    if (!raw || !Array.isArray(raw.arrangement?.items) || raw.arrangement.items.length > 48) {
      throw new Error("Card link is invalid.");
    }
    return {
      gift: {
        title: typeof raw.title === "string" ? raw.title.trim().slice(0, MAX_TITLE) || DEFAULT_CARD_TITLE : DEFAULT_CARD_TITLE,
        recipient: typeof raw.recipient === "string" ? raw.recipient.slice(0, 64) : "",
        theme: raw.theme === "dark" ? "dark" : "light",
        arrangement: parseArrangement(raw.arrangement),
        butterflies: raw.butterflies === undefined ? cloneButterflies(DEFAULT_BUTTERFLIES) : parseButterflies(raw.butterflies),
      },
      error: null,
    };
  } catch {
    return { gift: null, error: "This shared card could not be read. Showing your saved card instead." };
  }
}

export function createGiftLink(gift: GiftSnapshot): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.hash = new URLSearchParams({ gift: JSON.stringify(gift) }).toString();
  return url.href;
}
