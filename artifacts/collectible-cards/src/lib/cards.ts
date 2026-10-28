export type CardId = "google" | "critter" | "sunburst";

export interface CardDef {
  id: CardId;
  index: string;
  date: [string, string, string];
  title: string[];
  caption: string[];
  tags: string[];
  label: string;
}

export const CARDS: CardDef[] = [
  {
    id: "google",
    index: "01",
    date: ["20", "09", "2022"],
    title: ["Google", "Antigravity"],
    caption: ["Orchestrate multiple autonomous", "agents working in parallel"],
    tags: ["VISUAL", "IDENTITY"],
    label: "Google Antigravity card, raised holographic G",
  },
  {
    id: "critter",
    index: "02",
    date: ["14", "03", "2023"],
    title: ["TypingMind", "Collections"],
    caption: ["A small friend who lives", "between your prompts"],
    tags: ["CHARACTER", "GLOSS"],
    label: "TypingMind Collections card, raised pink pixel creature",
  },
  {
    id: "sunburst",
    index: "03",
    date: ["11", "07", "2024"],
    title: ["Claude", "Sunburst"],
    caption: ["Thoughtful by default,", "radiant on inspection"],
    tags: ["MARK", "STUDY"],
    label: "Claude card, raised coral sunburst",
  },
];
