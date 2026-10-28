import type { CardId } from "@/lib/cards";
import { useId } from "react";

function sunPath(): string {
  const lens = [1, 0.82, 0.95, 0.78, 1.02, 0.86, 0.93, 0.8, 0.99, 0.84, 0.9, 0.79];
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const w = 0.085, L = lens[i];
    const P = (ang: number, r: number) => `${(Math.cos(ang) * r * 46).toFixed(2)},${(-Math.sin(ang) * r * 46).toFixed(2)}`;
    pts.push(P(a - w * 2.2, 0.3), P(a - w / L, L), P(a + w / L, L), P(a + w * 2.2, 0.3));
  }
  return "M" + pts.join("L") + "Z";
}
const SUN = sunPath();

export function ArtIcon({ id, size = 40 }: { id: CardId; size?: number }) {
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={`foil-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7ef0ff" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.7" stopColor="#ffd36e" stopOpacity="0.2" />
          <stop offset="1" stopColor="#c58bff" />
        </linearGradient>
      </defs>
      {id === "google" && (
        <g strokeWidth="13" fill="none" strokeLinecap="butt">
          <path d="M29 -24 A38 38 0 0 0 -32 -18" stroke="#ea4335" strokeWidth="16" />
          <path d="M-32 -18 A38 38 0 0 0 -30 22" stroke="#fbbc05" strokeWidth="16" />
          <path d="M-30 22 A38 38 0 0 0 30 22" stroke="#34a853" strokeWidth="16" />
          <path d="M30 22 A38 38 0 0 0 38 0 L2 0" stroke="#4285f4" strokeWidth="16" />
          <path d="M-32 -18 A38 38 0 0 1 29 -24" stroke={`url(#foil-${id})`} strokeWidth="6" opacity="0.6" />
        </g>
      )}
      {id === "critter" && (
        <g>
          <path
            d="M-22 -34h44q8 0 8 8v14h14q8 0 8 8v14q0 8-8 8h-14v22q0 4-4 4h-4q-4 0-4-4v-10h-4v10q0 4-4 4h-4q-4 0-4-4v-10h-4v10q0 4-4 4h-4q-4 0-4-4v-10h-4v10q0 4-4 4h-4q-4 0-4-4v-22h-14q-8 0-8-8v-14q0-8 8-8h14v-14q0-8 8-8z"
            fill="#f04bb5"
            stroke={`url(#foil-${id})`}
            strokeWidth="3"
          />
          <rect x="-20" y="-17" width="9" height="9" rx="2" fill="#1a0b1c" />
          <rect x="11" y="-17" width="9" height="9" rx="2" fill="#1a0b1c" />
        </g>
      )}
      {id === "sunburst" && <path d={SUN} fill="#d97757" stroke={`url(#foil-${id})`} strokeWidth="2.5" strokeLinejoin="round" />}
    </svg>
  );
}

function roundedPath(pts: [number, number][], r: number): string {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const rr = Math.min(r, la * 0.48, lb * 0.48);
    const p1 = [p[0] + ((a[0] - p[0]) / la) * rr, p[1] + ((a[1] - p[1]) / la) * rr];
    const p2 = [p[0] + ((b[0] - p[0]) / lb) * rr, p[1] + ((b[1] - p[1]) / lb) * rr];
    d += `${i === 0 ? "M" : "L"}${p1[0].toFixed(2)} ${p1[1].toFixed(2)}Q${p[0].toFixed(2)} ${p[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + "Z";
}
const CRITTER_PTS: [number, number][] = [
  [-0.86, 0.78], [-0.86, 0.3], [-1.3, 0.3], [-1.3, -0.3], [-0.86, -0.3],
  [-0.86, -1.0], [-0.6, -1.02], [-0.6, -0.58], [-0.38, -0.58], [-0.38, -0.99],
  [-0.12, -1.01], [-0.12, -0.58], [0.12, -0.58], [0.12, -1.0], [0.38, -1.02],
  [0.38, -0.58], [0.6, -0.58], [0.6, -0.99], [0.86, -1.01], [0.86, -0.3],
  [1.3, -0.3], [1.3, 0.3], [0.86, 0.3], [0.86, 0.8],
];
const CRITTER_D = roundedPath(CRITTER_PTS.map(([x, y]) => [x * 40, -y * 40 + 4] as [number, number]), 8);
const G_D = "M27 -26 A37 37 0 1 0 37 2 L3 2";

const FACE = "hsl(calc(318deg + var(--hue, 0.5) * 96deg) 100% calc(50% + var(--hue, 0.5) * 8%))";
const RIM = "hsl(calc(88deg + var(--rim, 0.5) * 195deg) 96% 55%)";

/** Sculpted SVG stand-in for the WebGL object: inflated rim in one contrasting holo hue,
 *  a single coherent face dye driven by pointer/tilt CSS variables, warm belly glow, razor glints. */
export function SculptArt({ id }: { id: CardId }) {
  const uid = useId().replace(/:/g, "");
  const isG = id === "google";
  const d = id === "critter" ? CRITTER_D : id === "sunburst" ? SUN : G_D;
  const base = isG ? 17 : id === "sunburst" ? 7 : 0;
  const shape = (extra: number, style: React.CSSProperties, key: string, dx = 0, dy = 0, extraProps: React.SVGProps<SVGPathElement> = {}) => (
    <path
      key={key}
      d={d}
      fill={isG ? "none" : undefined}
      strokeWidth={base + extra}
      strokeLinejoin="round"
      strokeLinecap="round"
      transform={dx || dy ? `translate(${dx} ${dy})` : undefined}
      style={isG ? { ...style, stroke: style.fill, fill: "none" } : { stroke: style.fill, ...style }}
      {...extraProps}
    />
  );
  const u = (n: string) => `url(#${n}-${uid})`;
  return (
    <svg viewBox="-64 -64 128 128" className="sculpt-art h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <filter id={`soft-${uid}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2" /></filter>
        <filter id={`seam-${uid}`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.9" /></filter>
        <linearGradient id={`roll-${uid}`} x1="0.15" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="0.65" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id={`belly-${uid}`} cx="0.5" cy="0.58" r="0.32">
          <stop offset="0" stopColor="#ffb524" stopOpacity="0.18" />
          <stop offset="0.5" stopColor="#ffe08a" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffd060" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`gloss-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="0.22" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.85" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
        <mask id={`clip-${uid}`} maskUnits="userSpaceOnUse" x="-64" y="-64" width="128" height="128">
          {isG ? <path d={d} fill="none" stroke="#fff" strokeWidth={base + 2} /> : <path d={d} fill="#fff" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />}
        </mask>
      </defs>
      <g className="sculpt-body">
        {/* soft contact shadow cast onto the card */}
        {shape(15, { fill: "rgba(0,0,0,0.85)" }, "shadow", 2.5, 7, { filter: u("soft") })}
        {/* inflated holographic rim, wider than the face */}
        {shape(13, { fill: RIM }, "rim")}
        {shape(13, { fill: u("roll") }, "roll")}
        {/* one coherent resin dye */}
        {shape(2, { fill: FACE }, "face")}
        <g mask={u("clip")}>
          <rect x="-64" y="-64" width="128" height="128" fill={u("gloss")} />
          <rect x="-64" y="-64" width="128" height="128" fill={u("belly")} />
        </g>
        {/* razor white line along the inner top-left edge */}
        <g mask={u("clip")} opacity="0.15">
          {isG ? (
            <path d={d} fill="none" stroke="#fff" strokeWidth={1} transform="translate(1.3 1.6)" opacity="0.9" style={{ strokeDasharray: "70 400" }} />
          ) : (
            <path d={d} fill="none" stroke="#fff" strokeWidth={1.1} transform="translate(1.1 1.3)" opacity="0.85" />
          )}
        </g>
        {/* studio softbox glints */}
        {id === "critter" && (
          <g fill="#fff" opacity="0.15">
            <rect x="-30" y="-27" width="14" height="2.2" rx="1.1" opacity="0.95" />
            <rect x="44" y="-6" width="1.8" height="9" rx="0.9" opacity="0.8" />
          </g>
        )}
        {id === "sunburst" && <ellipse cx="-14" cy="-26" rx="5" ry="1.4" fill="#fff" transform="rotate(-62 -14 -26)" opacity="0.12" />}
        {isG && <path d="M-22 -28 A36 36 0 0 1 14 -35" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.12" />}
        {id === "critter" &&
          [-23, 14].map((x) => (
            <g key={x}>
              <rect x={x} y={-13} width="10" height="10" rx="2" fill="#0d0409" />
              <rect x={x + 0.8} y={-12.2} width="8.4" height="8.4" rx="1.6" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />
              <rect x={x + 1.6} y={-11.4} width="3.2" height="1.3" rx="0.6" fill="#fff" opacity="0.9" />
            </g>
          ))}
      </g>
    </svg>
  );
}
