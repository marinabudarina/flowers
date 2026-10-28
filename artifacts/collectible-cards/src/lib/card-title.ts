export const DEFAULT_CARD_TITLE = "Gift Card";
const KEY = "budarina.cardTitle";
export const MAX_TITLE = 28;

export function loadCardTitle(): string {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v.slice(0, MAX_TITLE) : DEFAULT_CARD_TITLE;
  } catch { return DEFAULT_CARD_TITLE; }
}

/** Throws if storage is unavailable or full. */
export function saveCardTitle(title: string) {
  localStorage.setItem(KEY, title);
}
