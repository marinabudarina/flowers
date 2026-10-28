import { SculptArt } from "./art-icons";
import type { CardDef } from "@/lib/cards";

export function FallbackCard({ card }: { card: CardDef }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6 [perspective:1400px]" data-testid="fallback-card">
      <div
        key={card.id}
        className="rise relative flex aspect-[3/4.65] h-[min(78%,620px)] max-w-full flex-col fallback-card rounded-[28px] bg-[#0b0a0d] px-[7%] py-[6%] text-white"
        style={{ boxShadow: "0 1px 0 #1d1c21, 0 28px 32px -16px rgba(12,12,20,.65), 0 48px 40px -28px rgba(12,12,20,.4)", backgroundImage: "linear-gradient(calc(125deg + var(--tx, 0) * 45deg), hsl(calc(300deg + var(--hue, .5) * 100deg) 100% 50% / .16), transparent 48%, hsl(calc(170deg + var(--rim, .5) * 100deg) 100% 50% / .18))" }}
      >
        <div className="flex items-center justify-between text-[10px] text-white/45">
          <span>{card.date[0]}</span><span className="mx-2 h-px flex-1 bg-white/25" />
          <span>{card.date[1]}</span><span className="mx-2 h-px flex-1 bg-white/25" />
          <span>{card.date[2]}</span>
        </div>
        <h2 className="mt-[8%] text-center text-[clamp(28px,5.4vh,52px)] font-normal leading-[1.02] tracking-tight">
          {card.title[0]}<br />{card.title[1]}
        </h2>
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className="fallback-art absolute inset-2"><SculptArt id={card.id} /></div>
        </div>
        <p className="text-center text-[11px] leading-snug text-white/50">{card.caption[0]}<br />{card.caption[1]}</p>
        <div className="mt-[8%] flex items-center gap-1.5 text-[9px] text-white/55">
          {card.tags.map((t) => <span key={t} className="rounded-full border border-white/40 px-2.5 py-0.5">{t}</span>)}
          <span className="ml-auto font-mono">{card.index} / 03</span>
        </div>
      </div>
    </div>
  );
}
