import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { Moon, Sun } from "lucide-react";
import { CardBack } from "@/components/card-back";
import { DEFAULT_CARD_TITLE, MAX_TITLE, loadCardTitle, saveCardTitle } from "@/lib/card-title";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  ALL_FILES, DEFAULT_ARRANGEMENT, cloneArrangement, loadSaved, parseArrangement, saveArrangement,
  type Arrangement, type FlowerItem,
} from "@/lib/flower-arrangement";
import { FlowerScene, webglAvailable, type AssetStatus } from "@/lib/flower-scene";
import { createGiftLink, readGiftLink } from "@/lib/gift-link";
import { loadButterflies, saveButterflies, type ButterflySettings } from "@/lib/butterfly-settings";
import { ButterflyEditor } from "@/components/butterfly-editor";
import { BouquetPicker } from "@/components/gift-bouquets";

type Notice = { tone: "ok" | "error" | "info"; text: string } | null;
type DialogKind = "catalogue" | "buy" | "send" | "bouquet" | null;

function FlowerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="12" cy="9" r="2.2" />
      <path d="M12 6.8c0-2.4 1.2-3.8 2.6-3.8 1.6 0 2.4 1.7 1.4 3.4M14.2 9.6c2.3.6 3.5 1.9 3.1 3.3-.5 1.5-2.3 1.7-3.6.6M11 11.1c-1 2.2-2.5 3.1-3.8 2.4-1.4-.8-1.1-2.6.3-3.5M9.8 8.5C7.5 7.9 6.4 6.6 6.9 5.2c.5-1.5 2.4-1.6 3.6-.4M12 11.2V21M12 17c-1.6-1.8-3.6-2.2-5-1.6M12 15c1.4-1.2 3-1.4 4.2-.8" />
    </svg>
  );
}

function fmtMb(n: number) {
  return (n / 1048576).toFixed(1);
}

export default function FlowerShop() {
  const [location, navigate] = useLocation();
  const fullScreen = location === "/flowers";
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const behindCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlowerScene | null>(null);
  const [gl] = useState(() => webglAvailable());
  const [glError, setGlError] = useState<string | null>(null);
  const shared = useMemo(readGiftLink, []);
  const recipientMode = !!shared.gift && !fullScreen;
  const mainRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [opened, setOpened] = useState(false);
  const initial = useMemo(() => shared.gift ? { arrangement: shared.gift.arrangement, error: null } : loadSaved(), [shared]);
  const [saved, setSaved] = useState<Arrangement>(initial.arrangement);
  const [draft, setDraft] = useState<Arrangement>(initial.arrangement);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: string; dx: number; dy: number; pid: number } | null>(null);
  const [themes, setThemes] = useState<{ home: "light" | "dark"; card: "light" | "dark" }>(() => {
    try {
      const previous = localStorage.getItem("budarina.theme");
      return {
        home: (localStorage.getItem("budarina.homeTheme") ?? previous) === "dark" ? "dark" : "light",
        card: shared.gift?.theme ?? ((localStorage.getItem("budarina.cardTheme") ?? previous) === "dark" ? "dark" : "light"),
      };
    } catch { return { home: "light", card: "light" }; }
  });
  const theme = fullScreen ? themes.card : themes.home;
  const [butterflies, setButterflies] = useState<ButterflySettings>(() => shared.gift?.butterflies ?? loadButterflies().settings);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, AssetStatus>>({});
  const [notice, setNotice] = useState<Notice>(
    shared.error ? { tone: "error", text: shared.error } : initial.error ? { tone: "error", text: `Saved arrangement could not be read (${initial.error}). Showing the default.` } : null,
  );
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const importRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(() => shared.gift?.title ?? loadCardTitle());
  const [recipient, setRecipient] = useState(() => {
    if (shared.gift) return shared.gift.recipient;
    try { return localStorage.getItem("budarina.recipient")?.slice(0, 64) ?? ""; }
    catch { return ""; }
  });
  const [shareNotice, setShareNotice] = useState("");
  const [titleDraft, setTitleDraft] = useState(title);
  const [rot, setRot] = useState(0);
  const rotRef = useRef(0);
  const rotAnim = useRef(0);
  const tiltRef = useRef({ x: 0, y: 0, lx: 0, ly: 0 });
  const showBack = rot > 90;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  const items = editing ? draft.items : saved.items;
  const arrangementRef = useRef(editing ? draft : saved);
  arrangementRef.current = editing ? draft : saved;

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    document.documentElement.style.backgroundColor = theme === "dark" ? "#101010" : "#f1f1ee";
    return () => {
      document.documentElement.style.colorScheme = "";
      document.documentElement.style.backgroundColor = "";
    };
  }, [theme]);

  useEffect(() => {
    document.title = fullScreen ? "Our Flowers — Budarina" : "Budarina — Flower Shop";
  }, [fullScreen]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Scene lifecycle
  useEffect(() => {
    if (!gl || !canvasRef.current || !behindCanvasRef.current) return;
    let s: FlowerScene;
    try {
      s = new FlowerScene(canvasRef.current, behindCanvasRef.current);
    } catch (e) {
      setGlError(e instanceof Error ? e.message : "WebGL context could not be created");
      return;
    }
    s.onStatus = (file, st) => setStatus((p) => ({ ...p, [file]: st }));
    sceneRef.current = s;
    const ro = new ResizeObserver(() => s.resize());
    ro.observe(canvasRef.current);
    s.resize();
    return () => { ro.disconnect(); s.dispose(); sceneRef.current = null; };
  }, [gl]);

  useEffect(() => { sceneRef.current?.setItems(items); }, [items]);
  useEffect(() => { sceneRef.current?.setButterflies(butterflies); }, [butterflies, glError]);
  useEffect(() => { sceneRef.current?.select(editing || dragging ? selected : null); }, [selected, editing, dragging]);
  useEffect(() => { if (sceneRef.current) sceneRef.current.sway = !reduced && !editing && !dragging; }, [reduced, editing, dragging]);
  useEffect(() => { if (sceneRef.current) sceneRef.current.visible = !showBack || fullScreen; }, [showBack, fullScreen]);

  // Shared cursor lighting, with physical tilt disabled for reduced motion.
  useEffect(() => {
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    const lightTarget = { x: 0, y: 0 }, light = { x: 0, y: 0 };
    const foilTarget = { x: 0, y: 0 }, foil = { x: 0, y: 0 };
    let raf = 0;
    let lastFrame = performance.now();
    const move = (e: PointerEvent) => {
      if (drag.current || document.activeElement?.matches(".fs-recipient")) return;
      if (editingRef.current) { target.x = 0; target.y = 0; return; }
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
      const card = stageRef.current?.querySelector(".fs-card")?.getBoundingClientRect();
      if (card?.width && card.height) {
        lightTarget.x = Math.max(-4, Math.min(4, (e.clientX - card.left) / card.width * 2 - 1));
        lightTarget.y = Math.max(-4, Math.min(4, (e.clientY - card.top) / card.height * 2 - 1));
      }
      const word = stageRef.current?.querySelector(".fs-gift-foil")?.getBoundingClientRect();
      if (word?.width && word.height) {
        foilTarget.x = Math.max(-8, Math.min(8, (e.clientX - word.left) / word.width * 2 - 1));
        foilTarget.y = Math.max(-8, Math.min(8, (e.clientY - word.top) / word.height * 2 - 1));
      }
    };
    const leave = () => { target.x = 0; target.y = 0; lightTarget.x = 0; lightTarget.y = 0; foilTarget.x = 0; foilTarget.y = 0; };
    const tick = () => {
      const now = performance.now();
      const blend = 1 - Math.exp(-Math.min(now - lastFrame, 100) / 140);
      lastFrame = now;
      if (drag.current) { raf = requestAnimationFrame(tick); return; }
      if (editingRef.current || document.activeElement?.matches(".fs-recipient")) {
        target.x = 0; target.y = 0; lightTarget.x = 0; lightTarget.y = 0; foilTarget.x = 0; foilTarget.y = 0;
      }
      cur.x += (target.x - cur.x) * blend;
      cur.y += (target.y - cur.y) * blend;
      light.x += (lightTarget.x - light.x) * blend;
      light.y += (lightTarget.y - light.y) * blend;
      foil.x += (foilTarget.x - foil.x) * blend;
      foil.y += (foilTarget.y - foil.y) * blend;
      stageRef.current?.style.setProperty("--tx", reduced ? "0" : cur.x.toFixed(4));
      stageRef.current?.style.setProperty("--ty", reduced ? "0" : cur.y.toFixed(4));
      stageRef.current?.style.setProperty("--lx", light.x.toFixed(4));
      stageRef.current?.style.setProperty("--ly", light.y.toFixed(4));
      stageRef.current?.style.setProperty("--foil-x", foil.x.toFixed(4));
      stageRef.current?.style.setProperty("--foil-y", foil.y.toFixed(4));
      sceneRef.current?.setTilt(reduced ? 0 : cur.x, reduced ? 0 : cur.y);
      sceneRef.current?.setLighting(light.x, light.y);
      tiltRef.current = { x: cur.x, y: cur.y, lx: light.x, ly: light.y };
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move);
    document.documentElement.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [reduced]);

  const setRotation = useCallback((deg: number) => {
    const v = Math.max(0, Math.min(180, deg));
    rotRef.current = v;
    setRot(v);
    stageRef.current?.style.setProperty("--flip", `${v}deg`);
  }, []);
  const animateRotation = useCallback((to: number) => {
    cancelAnimationFrame(rotAnim.current);
    if (reduced) { setRotation(to); return; }
    const from = rotRef.current, start = performance.now(), dur = 700 * Math.max(0.3, Math.abs(to - from) / 180);
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setRotation(from + (to - from) * e);
      if (k < 1) rotAnim.current = requestAnimationFrame(step);
    };
    rotAnim.current = requestAnimationFrame(step);
  }, [reduced, setRotation]);
  useEffect(() => () => cancelAnimationFrame(rotAnim.current), []);
  // Full screen and editing always show the front.
  useEffect(() => { if (fullScreen || editing) { cancelAnimationFrame(rotAnim.current); setRotation(0); } }, [fullScreen, editing, setRotation]);
  useEffect(() => { if (shared.gift && !fullScreen) setRotation(180); }, [shared, fullScreen, setRotation]);

  const updateRecipient = (name: string) => {
    setRecipient(name);
    try { localStorage.setItem("budarina.recipient", name); }
    catch { flash({ tone: "error", text: "Name updated, but this browser could not save it." }); }
  };
  const giftLink = useMemo(
    () => createGiftLink({ title, recipient, theme: themes.card, arrangement: editing ? draft : saved, butterflies }),
    [title, recipient, themes.card, editing, draft, saved, butterflies],
  );
  const shareCard = async () => {
    setShareNotice("");
    try {
      if (navigator.share) {
        await navigator.share({ title, text: recipient ? `A card for ${recipient}` : "A card for you", url: giftLink });
        setShareNotice("Card shared.");
      } else {
        await navigator.clipboard.writeText(giftLink);
        setShareNotice("Card link copied. Paste it into your message.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareNotice("Could not share automatically. Select and copy the link below.");
    }
  };

  const commitTitle = (raw: string) => {
    const next = raw.trim().slice(0, MAX_TITLE) || DEFAULT_CARD_TITLE;
    setTitle(next);
    setTitleDraft(next);
    try { saveCardTitle(next); flash({ tone: "ok", text: "Card title saved in this browser." }); }
    catch { flash({ tone: "error", text: "Title changed for now, but this browser could not save it." }); }
  };

  const flash = useCallback((n: Notice) => setNotice(n), []);
  useEffect(() => {
    if (!notice || notice.tone === "error") return;
    const t = setTimeout(() => setNotice(null), 3600);
    return () => clearTimeout(t);
  }, [notice]);

  const changeButterflies = (next: ButterflySettings) => {
    setButterflies(next);
    try { saveButterflies(next); }
    catch (e) { flash({ tone: "error", text: `Butterflies changed, but could not be saved: ${e instanceof Error ? e.message : "storage unavailable"}.` }); }
  };

  const toggleTheme = (target: "home" | "card") => {
    const next = themes[target] === "light" ? "dark" : "light";
    setThemes(current => ({ ...current, [target]: next }));
    try { localStorage.setItem(`budarina.${target}Theme`, next); }
    catch { flash({ tone: "error", text: "Theme changed, but this browser could not save the preference." }); }
  };

  const applyArrangement = (next: Arrangement) => {
    arrangementRef.current = next;
    setDraft(next);
    if (fullScreen) {
      setSaved(cloneArrangement(next));
      try {
        saveArrangement(next);
        flash({ tone: "ok", text: "Saved automatically in this browser." });
      } catch (e) {
        flash({ tone: "error", text: `Auto-save failed: ${e instanceof Error ? e.message : "storage unavailable"}. Export JSON to keep these changes.` });
      }
    }
  };
  const update = (id: string, patch: Partial<FlowerItem>) => {
    const current = arrangementRef.current;
    applyArrangement({ ...current, items: current.items.map(i => i.id === id ? { ...i, ...patch } : i) });
  };

  const startEdit = (id?: string) => {
    setDraft(cloneArrangement(saved));
    setEditing(true);
    setSelected(id ?? saved.items.find((i) => i.visible)?.id ?? null);
  };
  const cancelEdit = () => { setDraft(cloneArrangement(saved)); setEditing(false); setSelected(null); flash({ tone: "info", text: "Changes discarded." }); };
  const saveDefault = () => {
    try {
      saveArrangement(draft);
      setSaved(cloneArrangement(draft));
      setEditing(false);
      setSelected(null);
      flash({ tone: "ok", text: "Saved as default in this browser only." });
    } catch (e) {
      flash({ tone: "error", text: `Save failed: ${e instanceof Error ? e.message : "storage unavailable"}. Export JSON to keep it.` });
    }
  };
  const toggleEdit = () => {
    if (!editing) { startEdit(); return; }
    if (fullScreen) { setEditing(false); setSelected(null); } else cancelEdit();
  };
  const resetDraft = () => {
    applyArrangement(cloneArrangement(DEFAULT_ARRANGEMENT));
    if (!fullScreen) flash({ tone: "info", text: "Reset to the original layout. Save to keep it." });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(editing ? draft : saved, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "budarina-arrangement.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash({ tone: "ok", text: "Arrangement exported as budarina-arrangement.json." });
  };
  const importJson = async (f: File) => {
    try {
      const next = parseArrangement(JSON.parse(await f.text()));
      if (!editing) setEditing(true);
      applyArrangement(next);
      setSelected(next.items.find((i) => i.visible)?.id ?? null);
      if (!fullScreen) flash({ tone: "ok", text: `Imported ${next.items.length} stems. Review, then Save as default.` });
    } catch (e) {
      flash({ tone: "error", text: `Import failed: ${e instanceof Error ? e.message : "invalid file"}` });
    }
  };

  // Full-screen plants are directly draggable; the home editor remains opt-in.
  const onCanvasDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = sceneRef.current;
    if ((!editing && !fullScreen) || !s) return;
    const id = s.pick(e.clientX, e.clientY);
    setSelected(id);
    if (!id) return;
    const item = arrangementRef.current.items.find((i) => i.id === id)!;
    const p = s.planePoint(e.clientX, e.clientY, item.z);
    if (!p) return;
    drag.current = { id, dx: item.x - p.x, dy: item.y - p.y, pid: e.pointerId };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current, s = sceneRef.current;
    if (!d || !s) return;
    const item = arrangementRef.current.items.find((i) => i.id === d.id);
    const p = item && s.planePoint(e.clientX, e.clientY, item.z);
    if (p) update(d.id, { x: +(p.x + d.dx).toFixed(3), y: +(p.y + d.dy).toFixed(3) });
  };
  const onCanvasUp = () => { drag.current = null; setDragging(false); };
  const onWheel = (e: React.WheelEvent) => {
    if (!editing || !selected) return;
    const it = draft.items.find((i) => i.id === selected);
    if (it) update(selected, { scale: +Math.max(0.1, it.scale * (e.deltaY > 0 ? 0.96 : 1.04)).toFixed(3) });
  };

  const files = Object.entries(status);
  const ready = ALL_FILES.filter((f) => status[f]?.state === "ready").length;
  const neededFiles = [...new Set(items.filter((i) => i.visible).map((i) => i.file))];
  const loading = neededFiles.filter((f) => status[f]?.state === "loading");
  const failed = neededFiles.filter((f) => status[f]?.state === "error");
  const bytes = loading.reduce((a, f) => a + (status[f]?.loaded ?? 0), 0);
  const total = loading.reduce((a, f) => a + (status[f]?.total ?? 0), 0);
  const showFallback = !gl || !!glError;
  const sel = draft.items.find((i) => i.id === selected) ?? null;

  const retryFailed = () => {
    failed.forEach((f) => sceneRef.current?.retry(f));
    setStatus((p) => { const n = { ...p }; failed.forEach((f) => delete n[f]); return n; });
    sceneRef.current?.setItems([...items]);
  };

  // Keep the BUDARINA FLOWERS type at least 16px clear of the navigation.
  useEffect(() => {
    const main = mainRef.current, nav = navRef.current;
    if (!main || !nav) return;
    const fit = () => {
      const room = main.clientHeight - 2 * (nav.getBoundingClientRect().bottom - main.getBoundingClientRect().top + 16);
      main.style.setProperty("--type-room", `${Math.max(40, room)}px`);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(nav); ro.observe(main);
    fit();
    return () => ro.disconnect();
  }, []);

  // Recipient: scroll scrubs the card from hero to keepsake while the message arrives.
  useEffect(() => {
    const main = mainRef.current;
    if (!recipientMode || !main) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const stage = stageRef.current, nav = navRef.current;
      if (!stage || !nav) return;
      const W = main.clientWidth, H = main.clientHeight;
      const max = Math.max(1, main.scrollHeight - H);
      const p = Math.max(0, Math.min(1, main.scrollTop / max));
      const w = stage.offsetWidth, h = stage.offsetHeight;
      const navB = nav.getBoundingClientRect().bottom - main.getBoundingClientRect().top;
      const side = W >= 900 && W / H > 1.15;
      let gx = 0, gy = 0, gs = 1, msgTop = 0;
      if (side) {
        gs = Math.min(0.82, ((W * 0.5 - 48) / w), (H - navB * 2 - 32) / h);
        gx = -W * 0.22;
      } else {
        gs = Math.min(0.66, (H * 0.36) / h, (W - 40) / w);
        gy = navB + 16 + (h * gs) / 2 - H / 2;
        msgTop = navB + 16 + h * gs + 24;
      }
      const raw = reduced ? (p > 0.4 ? 1 : 0) : p;
      const e = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      const reveal = reduced ? raw : Math.max(0, Math.min(1, (p - 0.3) / 0.55));
      main.style.setProperty("--gx", `${(gx * e).toFixed(1)}px`);
      main.style.setProperty("--gy", `${(gy * e).toFixed(1)}px`);
      main.style.setProperty("--gs", (1 + (gs - 1) * e).toFixed(4));
      main.style.setProperty("--msg-top", `${msgTop.toFixed(0)}px`);
      main.style.setProperty("--reveal", reveal.toFixed(3));
      main.style.setProperty("--hint", Math.max(0, 1 - p * 5).toFixed(3));
      main.dataset.giftLayout = side ? "side" : "stack";
      setOpened(reveal > 0.5);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
    main.addEventListener("scroll", queue, { passive: true });
    const ro = new ResizeObserver(queue);
    ro.observe(main);
    apply();
    return () => { cancelAnimationFrame(raf); main.removeEventListener("scroll", queue); ro.disconnect(); };
  }, [recipientMode, reduced]);

  const openGift = () => {
    const main = mainRef.current;
    if (main) main.scrollTo({ top: main.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  };

  const stageEl = (
      <div className="fs-stage" ref={stageRef}>
        <div
          className="fs-card"
          data-theme={themes.card}
          data-fallback={showFallback}
          data-testid="card-budarina"
          data-side={showBack ? "back" : "front"}
          role={!fullScreen && !editing ? "button" : undefined}
          tabIndex={!fullScreen && !editing ? 0 : undefined}
          aria-label={!fullScreen && !editing ? `Flip card to ${showBack ? "front" : "back"}` : undefined}
          onClick={() => { if (!fullScreen && !editing) animateRotation(showBack ? 0 : 180); }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (!fullScreen && !editing && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              animateRotation(showBack ? 0 : 180);
            }
          }}
        >
          <div className="fs-face fs-front" aria-hidden={showBack} inert={showBack} data-testid="card-front">
          {!showFallback && <canvas ref={behindCanvasRef} className="fs-canvas fs-canvas-behind" aria-hidden />}
          <div className="fs-card-title" style={{ "--title-fit": Math.min(1, 10 / title.length) } as CSSProperties} data-fallback={showFallback} data-testid="text-card-title">{title}</div>
          {showFallback ? (
            <img className="fs-fallback" src={`${import.meta.env.BASE_URL}budarina-card-fallback${themes.card === "dark" ? "-dark" : ""}.png`} alt="Budarina card with poppies, lotus pod and dried stems (flat reference image)" data-testid="img-fallback" />
          ) : (
            <canvas
              ref={canvasRef}
              className="fs-canvas"
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerUp={onCanvasUp}
              onPointerCancel={onCanvasUp}
              onLostPointerCapture={onCanvasUp}
              onWheel={onWheel}
              data-testid="canvas-flowers"
            />
          )}
          {!showFallback && loading.length > 0 && (
            <div className="fs-progress" data-testid="status-loading">
              <i style={{ transform: `scaleX(${neededFiles.length ? (neededFiles.length - loading.length + (total ? bytes / total : 0)) / neededFiles.length : 0})` }} />
            </div>
          )}
          </div>
          {!fullScreen && <CardBack gl={!showFallback} active={rot > 0} hidden={!showBack} reduced={reduced} tiltRef={tiltRef} recipient={recipient} onRecipientChange={updateRecipient} readOnly={recipientMode} butterflies={butterflies} />}
        </div>
        {!recipientMode && <div className="fs-card-actions">
        <button className="fs-cta" onClick={() => fullScreen ? navigate(`/${window.location.hash}`) : (setShareNotice(""), setDialog("send"))} data-testid={fullScreen ? "button-home" : "button-send-card"}>
          <FlowerIcon /> {fullScreen ? "home" : "send the card"}
        </button>
        {!fullScreen && !editing && (
          <button className="fs-inside" onClick={() => navigate(`/flowers${window.location.hash}`)} data-testid="button-inside">inside</button>
        )}
        </div>}
      </div>
  );

  return (
    <main ref={mainRef} className="fs-page" data-recipient={recipientMode} data-theme={theme} data-fullscreen={fullScreen} data-editing={editing} data-dragging={dragging} data-testid="page-flower-shop">
      <nav className="fs-nav" ref={navRef}>
        <span className="fs-brand" data-testid="text-brand">budarina</span>
        {!recipientMode && <div className="fs-nav-right">
          <button className="fs-theme-toggle" onClick={() => toggleTheme(fullScreen ? "card" : "home")} aria-label={`Switch ${fullScreen ? "card" : "home"} to ${theme === "light" ? "dark" : "light"} mode`} title={`${fullScreen ? "Card" : "Home"}: ${theme} mode`} data-testid="button-theme">
            {theme === "light" ? <Moon size={18} aria-hidden /> : <Sun size={18} aria-hidden />}
          </button>
          <span aria-hidden>/</span>
          <a className="fs-contact-link" href="https://www.instagram.com/marina_uiux/" target="_blank" rel="noopener noreferrer" data-testid="link-contact">contact</a>
          <span aria-hidden>/</span>
          <button onClick={() => setDialog("buy")} data-testid="button-buy">buy</button>
          <span aria-hidden>/</span>
          <button className="fs-edit-btn" aria-expanded={editing} aria-controls="fs-editor" onClick={toggleEdit} data-testid="button-edit">edit</button>
        </div>}
        {recipientMode && <span className="fs-nav-gift" data-testid="text-gift-label">a gift for {shared.gift?.recipient || "you"}</span>}
      </nav>
      <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }} data-testid="input-import" />

      <h1 className={fullScreen || recipientMode ? "sr-only" : "fs-type"} aria-label="Budarina flowers">
        <span>BUDARINA</span>
        <span>FLOWERS</span>
      </h1>

      {recipientMode ? (
        <div className="fs-gift-scroll">
          <div className="fs-gift-sticky">
            <div className="fs-gift-move">{stageEl}</div>
            <button className="fs-gift-hint" onClick={openGift} tabIndex={opened ? -1 : 0} data-testid="button-scroll-hint">
              <span>scroll to open</span><i aria-hidden />
            </button>
            <section className="fs-gift-message" data-open={opened} aria-hidden={!opened} inert={!opened} data-testid="section-gift-message">
              <p className="fs-gift-kicker">{shared.gift?.recipient ? `For ${shared.gift.recipient}` : "For you"}</p>
              <h2 data-testid="text-gift-headline">Flowers,<br />just for you.</h2>
              <p className="fs-gift-value" data-testid="text-gift-value"><span>$300</span> in flowers</p>
              <p className="fs-gift-copy">You’ve received a kind gift: a $300 gift card to spend at Budarina Flower Shop. Pick a bouquet that makes you happy.</p>
              <button className="fs-gift-pick" onClick={() => setDialog("bouquet")} data-testid="button-pick-bouquet">
                <FlowerIcon /> Pick bouquet
              </button>
              <p className="fs-gift-fine">Demo preview. No order, payment or redeemable balance is involved.</p>
            </section>
          </div>
        </div>
      ) : stageEl}

      <div className="fs-status" aria-live="polite">
        {showFallback && (
          <p data-testid="status-fallback">3D is unavailable in this browser ({glError ?? "WebGL not supported"}). Showing a flat image of the card instead.</p>
        )}
        {!showFallback && loading.length > 0 && (
          <p data-testid="text-progress">Loading {loading.length} of {neededFiles.length} flower models{total ? ` / ${fmtMb(bytes)} of ${fmtMb(total)} MB` : ""}</p>
        )}
        {!showFallback && failed.length > 0 && (
          <p className="err" data-testid="status-load-error">
            {failed.length} model{failed.length > 1 ? "s" : ""} failed to load. <button onClick={retryFailed} data-testid="button-retry">Retry</button>
          </p>
        )}
        {notice && (
          <p className={notice.tone === "error" ? "err" : ""} data-testid="status-notice">
            {notice.text} {notice.tone === "error" && <button onClick={() => setNotice(null)}>Dismiss</button>}
          </p>
        )}
      </div>

      {editing && (
        <aside id="fs-editor" className="fs-editor" aria-label="Edit card" data-testid="panel-editor">
          <header>
            <strong>Edit</strong>
            <span>{showFallback ? "3D is unavailable, so flowers can't be moved here. Title and butterflies still work." : fullScreen ? "Drag stems or adjust settings. Changes save automatically." : "Drag stems on the card. Scroll to resize."}</span>
          </header>
          <label className="fs-title-field">
            <span>Card title</span>
            <input value={titleDraft} maxLength={MAX_TITLE} onChange={(e) => setTitleDraft(e.target.value)} onBlur={() => commitTitle(titleDraft)} onKeyDown={(e) => { if (e.key === "Enter") commitTitle(titleDraft); }} data-testid="input-card-title-editor" />
          </label>
          <ButterflyEditor settings={butterflies} onChange={changeButterflies} />
          <h3>Flowers</h3>
          <ul className="fs-list">
            {draft.items.map((i) => (
              <li key={i.id} data-active={i.id === selected}>
                <button className="nm" onClick={() => setSelected(i.id)} data-testid={`button-select-${i.id}`}>
                  {i.label}
                  <small>{status[i.file]?.state === "error" ? "load error" : status[i.file]?.state === "loading" ? "loading" : ""}</small>
                </button>
                <button className="vis" onClick={() => update(i.id, { visible: !i.visible })} aria-pressed={i.visible} data-testid={`button-visible-${i.id}`}>
                  {i.visible ? "shown" : "hidden"}
                </button>
              </li>
            ))}
          </ul>
          {sel && !showFallback && (
            <div className="fs-controls">
              <p className="fs-note">Z-index: negative puts this flower behind the card title; 0 or higher puts it in front. Higher numbers overlap lower ones. Depth controls parallax separately.</p>
              {([
                ["x", "Left / right", -2, 2, 0.01],
                ["y", "Height (stem base)", -3, 1, 0.01],
                ["z", "Depth", -1.5, 2, 0.01],
                ["zIndex", "Z-index", -10, 10, 1],
                ["scale", "Size", 0.2, 4, 0.01],
                ["rx", "Tilt X", -180, 180, 1],
                ["ry", "Turn Y", -180, 180, 1],
                ["rz", "Lean Z", -180, 180, 1],
              ] as const).map(([k, label, min, max, step]) => (
                <label key={k}>
                  <span>{label}<em>{sel[k].toFixed(step < 1 ? 2 : 0)}</em></span>
                  <input type="range" min={min} max={max} step={step} value={sel[k]} onChange={(e) => update(sel.id, { [k]: Number(e.target.value) })} data-testid={`input-${k}`} />
                </label>
              ))}
            </div>
          )}
          <div className="fs-actions">
            <button onClick={resetDraft} data-testid="button-reset">Reset</button>
            <button onClick={exportJson} data-testid="button-export">Export</button>
            <button onClick={() => importRef.current?.click()} data-testid="button-import">Import</button>
            <button onClick={() => setDialog("catalogue")} data-testid="button-catalogue">Catalogue</button>
            {!fullScreen && <button onClick={cancelEdit} data-testid="button-cancel">Cancel</button>}
            <button className="primary" onClick={saveDefault} data-testid="button-save">{fullScreen ? "Done" : "Save as default"}</button>
          </div>
          <p className="fs-note">Saved in this browser only. Export JSON to reuse it elsewhere.</p>
        </aside>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="fs-dialog" data-theme={theme}>
          {dialog === "send" && (
            <>
              <DialogTitle>Send the card</DialogTitle>
              <DialogDescription>Share a link with this card's flowers, title and recipient name. This is a digital greeting, not a purchased or redeemable gift card.</DialogDescription>
              <label className="fs-title-field">
                <span>Recipient name</span>
                <input aria-label="Recipient name for sharing" value={recipient} maxLength={64} onChange={event => updateRecipient(event.target.value)} data-testid="input-send-recipient" />
              </label>
              <button className="fs-dialog-btn" onClick={shareCard} data-testid="button-share-card">{typeof navigator.share === "function" ? "Share card" : "Copy card link"}</button>
              <label className="fs-title-field">
                <span>Card link</span>
                <input readOnly value={giftLink} onFocus={event => event.target.select()} data-testid="input-card-link" />
              </label>
              <p role="status">{shareNotice}</p>
            </>
          )}
          {dialog === "catalogue" && (
            <>
              <DialogTitle>Our flowers</DialogTitle>
              <DialogDescription>Every stem on the card is a scanned model. Select one to place it.</DialogDescription>
              <ul className="fs-cat">
                {(editing ? draft : saved).items.map((i, n) => (
                  <li key={i.id}>
                    <span className="no">{String(n + 1).padStart(2, "0")}</span>
                    <span className="nm">{i.label}<small>{i.note}</small></span>
                    <span className="st">{!i.visible ? "hidden" : status[i.file]?.state ?? (showFallback ? "flat" : "queued")}</span>
                    <button disabled={showFallback} onClick={() => { setDialog(null); if (editing) setSelected(i.id); else startEdit(i.id); }} data-testid={`button-edit-${i.id}`}>Edit</button>
                  </li>
                ))}
              </ul>
              <p className="fs-note">{ready} of {ALL_FILES.length} model files loaded{files.some(([, s]) => s.state === "error") ? ", some failed" : ""}.</p>
            </>
          )}
          {dialog === "bouquet" && <BouquetPicker recipient={shared.gift?.recipient ?? ""} onClose={() => setDialog(null)} />}
          {dialog === "buy" && (
            <>
              <DialogTitle>Buy</DialogTitle>
              <DialogDescription>Online checkout is not available here. No payment is taken on this page.</DialogDescription>
              <p className="fs-note">Orders are arranged directly with the shop. Browse the catalogue to note the stems you want, then get in touch.</p>
              <button className="fs-dialog-btn" onClick={() => setDialog("catalogue")} data-testid="button-open-catalogue">Open catalogue</button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
