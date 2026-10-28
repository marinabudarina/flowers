import { useEffect, useRef } from "react";
import { createRelief, type Relief } from "./bead-relief";
import { BeadCardBack } from "./bead-card-back";

const PAD = 60;

export function BeadCard({ flipped, onFlippedChange }: {
  flipped: boolean;
  onFlippedChange: (flipped: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const flipTarget = useRef(0);
  const wakeRef = useRef<() => void>(() => {});
  const toggle = () => {
    flipTarget.current = flipTarget.current === 0 ? 180 : 0;
    onFlippedChange(flipTarget.current === 180);
    wakeRef.current();
  };
  useEffect(() => {
    flipTarget.current = flipped ? 180 : 0;
    wakeRef.current();
  }, [flipped]);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cur = { x: 0, y: 0, flip: 0 };
    let raf = 0;
    let previous = performance.now();
    let relief: Relief | null = null;
    let backRelief: Relief | null = null;
    let disposed = false;
    let last = "";
    const canvas = wrap.querySelector<HTMLCanvasElement>(".bead-relief")!;
    const backCanvas = wrap.querySelector<HTMLCanvasElement>(".bead-back-relief")!;
    function wake() {
      if (disposed || raf || document.hidden) return;
      previous = performance.now() - 16;
      raf = requestAnimationFrame(tick);
    }
    wakeRef.current = wake;
    const sizeUp = () => {
      relief?.resize(wrap.clientWidth, wrap.clientHeight);
      backRelief?.resize(wrap.clientWidth, wrap.clientHeight);
      last = ""; wake();
    };
    const ro = new ResizeObserver(sizeUp);
    ro.observe(wrap);
    createRelief(canvas, `${import.meta.env.BASE_URL}google-beaded-floral.webp`, PAD)
      .then((r) => { if (disposed) { r.dispose(); return; } relief = r; sizeUp(); })
      .catch((error: unknown) => {
        if (disposed) return;
        console.error("Unable to initialize the 3D bead relief:", error);
        wrap.dataset.reliefError = "true";
      });
    createRelief(backCanvas, `${import.meta.env.BASE_URL}argon-beaded-four.webp`, PAD, {
      normalSrc: `${import.meta.env.BASE_URL}argon-beaded-four.normals.png`,
      width: 1.1304, height: .9808, left: .0544, top: .13,
      preserveAspectRatio: true,
    }).then((r) => {
      if (disposed) { r.dispose(); return; }
      backRelief = r; sizeUp();
    }).catch((error: unknown) => {
      if (!disposed) console.error("Unable to initialize the number 4 relief:", error);
    });
    // Follow the entire viewport, not just the card's hit area.
    const move = (event: PointerEvent) => {
      target.current = {
        x: Math.max(-1, Math.min(1, event.clientX / window.innerWidth * 2 - 1)),
        y: Math.max(-1, Math.min(1, event.clientY / window.innerHeight * 2 - 1)),
      };
      wake();
    };
    const reset = () => { target.current = { x: 0, y: 0 }; wake(); };
    const leaveWindow = (event: PointerEvent) => {
      if (event.relatedTarget === null) reset();
    };
    const releaseTouch = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") reset();
    };
    function tick(now: number) {
      raf = 0;
      if (disposed || document.hidden) return;
      const t = motion.matches ? { x: 0, y: 0 } : target.current;
      const ease = 1 - Math.exp(-Math.min(now - previous, 64) / 130);
      previous = now;
      cur.x += (t.x - cur.x) * ease;
      cur.y += (t.y - cur.y) * ease;
      cur.flip = motion.matches ? flipTarget.current : cur.flip + (flipTarget.current - cur.flip) * ease;
      const moving = Math.abs(t.x - cur.x) + Math.abs(t.y - cur.y) > .0008 ||
        Math.abs(flipTarget.current - cur.flip) > .02;
      if (!moving) { cur.x = t.x; cur.y = t.y; cur.flip = flipTarget.current; }
      wrap.style.setProperty("--tx", cur.x.toFixed(3));
      wrap.style.setProperty("--ty", cur.y.toFixed(3));
      wrap.style.setProperty("--flip", `${cur.flip.toFixed(3)}deg`);
      const backVisible = Math.cos((-cur.x * 30 + cur.flip) * Math.PI / 180) < 0;
      wrap.dataset.visibleSide = backVisible ? "back" : "front";
      // Ambient accents update at 25fps when idle; tilt stays display-smooth.
      const seconds = motion.matches ? undefined : Math.floor(now / 40) * .04;
      const sig = `${cur.x.toFixed(4)}:${cur.y.toFixed(4)}:${cur.flip.toFixed(3)}:${seconds ?? "still"}`;
      if (sig !== last) {
        last = sig;
        if (backVisible && backRelief) {
          backRelief.render(cur.x, cur.y, cur.flip - 180, seconds);
          wrap.dataset.backReady = "true";
        } else if (!backVisible && relief) {
          relief.render(cur.x, cur.y, cur.flip, seconds);
          wrap.dataset.reliefReady = "true";
        }
      }
      // Only shade the visible side. Hidden tabs and reduced motion stay idle.
      if (moving || (!motion.matches && (relief || backRelief))) raf = requestAnimationFrame(tick);
    }
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", move, { passive: true });
    window.addEventListener("pointerout", leaveWindow);
    window.addEventListener("pointerup", releaseTouch);
    window.addEventListener("pointercancel", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", wake);
    motion.addEventListener("change", wake);
    wake();
    return () => {
      cancelAnimationFrame(raf);
      disposed = true;
      ro.disconnect();
      relief?.dispose();
      backRelief?.dispose();
      wakeRef.current = () => {};
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      window.removeEventListener("pointerout", leaveWindow);
      window.removeEventListener("pointerup", releaseTouch);
      window.removeEventListener("pointercancel", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", wake);
      motion.removeEventListener("change", wake);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      id="collectible-card"
      className="bead-stage"
      data-testid="stage-card"
      role="button"
      tabIndex={0}
      aria-label={flipped ? "Argon Gemini. Flip to Google Antigravity." : "Google Antigravity. Flip to Argon Gemini."}
      aria-pressed={flipped}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!event.repeat) toggle();
        }
      }}
    >
      <article className="bead-card" aria-hidden={flipped}>
        <div className="bead-metal" aria-hidden="true" />
        <div className="bead-content">
          <div className="bead-date" data-testid="text-date">
            <span>20</span><i /><span>09</span><i /><span>2022</span>
          </div>
          <h2 className="bead-title" data-testid="text-title">Google<br />Antigravity</h2>
          <img
            className="bead-artwork"
            src={`${import.meta.env.BASE_URL}google-beaded-floral.webp`}
            alt=""
            width="1536"
            height="1536"
            draggable={false}
            fetchPriority="high"
            data-testid="img-bead-logo"
          />
          <p className="bead-caption">Orchestrate multiple autonomous<br />agents working in parallel</p>
          <div className="bead-foot">
            <span className="bead-tags"><b>VISUAL</b><b>IDENTITY</b></span>
            <svg width="40" height="20" viewBox="0 0 40 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
              <circle cx="10" cy="10" r="8" /><circle cx="10" cy="10" r="4.5" /><path d="M27 5l8 8M35 7v6h-6" />
            </svg>
          </div>
        </div>
        <div className="bead-sheen" aria-hidden="true" />
      </article>
      <article className="bead-card bead-card-back" aria-hidden={!flipped}>
        <BeadCardBack />
      </article>
      <canvas className="bead-relief" aria-hidden="true" data-testid="canvas-bead-relief" style={{ left: -PAD, top: -PAD }} />
      <canvas className="bead-relief bead-back-relief" aria-hidden="true" data-testid="canvas-back-relief" style={{ left: -PAD, top: -PAD }} />
    </div>
  );
}
