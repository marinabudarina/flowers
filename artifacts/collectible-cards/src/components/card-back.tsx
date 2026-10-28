import { useEffect, useRef, useState } from "react";
import { FlowerBackScene } from "@/lib/flower-back-scene";
import { GoldFoilText } from "@/components/gold-foil-text";
import type { ButterflySettings } from "@/lib/butterfly-settings";

type Props = {
  gl: boolean;
  active: boolean;
  hidden: boolean;
  reduced: boolean;
  tiltRef: React.MutableRefObject<{ x: number; y: number; lx: number; ly: number }>;
  recipient: string;
  butterflies: ButterflySettings;
  onRecipientChange: (name: string) => void;
  readOnly?: boolean;
};

export function CardBack({ gl, active, hidden, reduced, tiltRef, recipient, butterflies, onRecipientChange, readOnly = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlowerBackScene | null>(null);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error" | "nogl">(gl ? "idle" : "nogl");
  const [err, setErr] = useState("");

  // Lazily create the renderer the first time the card is turned.
  useEffect(() => { if (active) setMounted(true); }, [active]);

  useEffect(() => {
    if (!gl || !mounted || !canvasRef.current) return;
    let s: FlowerBackScene;
    try { s = new FlowerBackScene(canvasRef.current); }
    catch (e) { setState("nogl"); setErr(e instanceof Error ? e.message : "WebGL context failed"); return; }
    s.onStatus = (st, m) => { setState(st); if (m) setErr(m); };
    sceneRef.current = s;
    s.load();
    const ro = new ResizeObserver(() => s.resize());
    ro.observe(canvasRef.current);
    return () => { ro.disconnect(); s.dispose(); sceneRef.current = null; };
  }, [gl, mounted]);

  useEffect(() => {
    sceneRef.current?.setButterflies(butterflies);
  }, [butterflies, gl, mounted]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.sway = !reduced;
    s.setActive(active);
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const { x, y, lx, ly } = tiltRef.current;
      s.setTilt(reduced ? 0 : x, reduced ? 0 : y);
      s.setLighting(lx, ly);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, reduced, mounted, state, tiltRef]);

  return (
    <div className="fs-face fs-back" aria-hidden={hidden} inert={hidden} data-testid="card-back">
      <p className="fs-back-amount" data-testid="text-back-amount"><span>$300</span><GoldFoilText text="GIFT" enabled={gl && mounted} active={active && !hidden} reduced={reduced} tiltRef={tiltRef} /></p>
      {gl && mounted && state !== "nogl" && (
        <canvas ref={canvasRef} className="fs-back-canvas" role="img" aria-label="Red poppy, 3D model" data-testid="canvas-back-flower" />
      )}
      {state === "loading" && <span className="fs-back-state" data-testid="status-back-loading">loading poppy</span>}
      {state === "error" && (
        <span className="fs-back-state" data-testid="status-back-error">
          Poppy failed to load. <button onClick={(e) => { e.stopPropagation(); setState("loading"); sceneRef.current?.load(); }} data-testid="button-back-retry">Retry</button>
        </span>
      )}
      {state === "nogl" && (
        <span className="fs-back-state" data-testid="status-back-nogl">3D red poppy unavailable: WebGL is not supported here{err ? ` (${err})` : ""}.</span>
      )}
      <div className="fs-back-copy">
        <p data-testid="text-back-copy">Big bouquets and happy smiles for dear</p>
        {readOnly ? (
          <span className="fs-recipient fs-recipient-static" data-testid="text-recipient">{recipient || "\u00a0"}</span>
        ) : <input
          className="fs-recipient"
          aria-label="Recipient name"
          value={recipient}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onRecipientChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          data-testid="input-recipient"
        />}
      </div>
    </div>
  );
}
