import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CARD_H } from "@/lib/flower-arrangement";
import { CURSOR_LIGHT, cursorLightPosition } from "@/lib/flower-lighting";
import { FOIL_FRAG, FOIL_VERT } from "@/lib/gold-foil-shader";

type Tilt = { x: number; y: number; lx: number; ly: number };
type Props = {
  text: string;
  active: boolean;
  reduced: boolean;
  enabled: boolean;
  tiltRef: React.MutableRefObject<Tilt>;
};

const PAD = 0.12; // canvas overhang around the word (fraction of font size) for serifs/relief

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}

/** Renders `text` as shader-lit gold foil on a canvas that covers only the glyph box.
 *  The HTML text remains underneath (gold fallback color) and is hidden once WebGL draws. */
export function GoldFoilText({ text, active, reduced, enabled, tiltRef }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    if (!enabled || !host || !canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    let disposed = false, lost = false, raf = 0, dirty = true;
    let prog: WebGLProgram | null = null, tex: WebGLTexture | null = null, buf: WebGLBuffer | null = null;
    const U: Record<string, WebGLUniformLocation | null> = {};
    let w = 0, h = 0;
    const last = { px: 9, py: 9, tx: 9, ty: 9 };

    const setup = () => {
      prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, FOIL_VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FOIL_FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
      gl.useProgram(prog);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ["uMask", "uRes", "uLightPosition", "uLightRadius", "uWordRect", "uTilt", "uGrain", "uRelief", "uLamp", "uDark"]) U[n] = gl.getUniformLocation(prog, n);
      tex = gl.createTexture();
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    };

    const buildMask = () => {
      const cs = getComputedStyle(host);
      const fs = parseFloat(cs.fontSize) || 16;
      const pad = Math.round(fs * PAD);
      const cw = host.clientWidth + pad * 2, ch = host.clientHeight + pad * 2;
      if (cw <= pad * 2 || ch <= pad * 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.round(cw * dpr); h = Math.round(ch * dpr);
      canvas.style.left = `${-pad}px`; canvas.style.top = `${-pad}px`;
      canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
      canvas.width = w; canvas.height = h;
      const draw = (blur: number) => {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d")!;
        x.scale(dpr, dpr);
        x.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        (x as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
        x.textBaseline = "alphabetic";
        x.fillStyle = "#fff";
        if (blur) x.filter = `blur(${blur}px)`;
        // place baseline where the HTML line box puts it
        const mt = x.measureText(text);
        const lh = host.clientHeight;
        const asc = mt.fontBoundingBoxAscent ?? fs * 0.8, desc = mt.fontBoundingBoxDescent ?? fs * 0.2;
        const base = pad + (lh - (asc + desc)) / 2 + asc;
        x.fillText(text.toUpperCase(), pad, base);
        return x.getImageData(0, 0, w, h).data;
      };
      const sharp = draw(0), soft = draw(Math.max(1, fs * 0.012));
      const px = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++) { px[i * 4] = sharp[i * 4 + 3]; px[i * 4 + 1] = soft[i * 4 + 3]; px[i * 4 + 3] = 255; }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.viewport(0, 0, w, h);
      dirty = true;
    };

    const card = host.closest<HTMLElement>(".fs-card");
    // Match the reverse flower camera, so both renderers use the same
    // card-space source rather than a separate spotlight local to the word.
    const lightCamera = new THREE.PerspectiveCamera(2 * Math.atan(CARD_H / 2 / 9) * 180 / Math.PI, 1, 0.1, 50);
    const lightPosition = new THREE.Vector3();
    const render = () => {
      if (disposed || lost || !prog || !w) return;
      const t = tiltRef.current;
      const px = t.lx, py = t.ly;
      const tx = reduced ? 0 : t.x, ty = reduced ? 0 : t.y;
      if (!dirty && Math.abs(px - last.px) + Math.abs(py - last.py) + Math.abs(tx - last.tx) + Math.abs(ty - last.ty) < 0.0015) return;
      Object.assign(last, { px, py, tx, ty }); dirty = false;
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1i(U.uMask, 0);
      gl.uniform2f(U.uRes, w, h);
      const bounds = card?.getBoundingClientRect();
      const word = canvas.getBoundingClientRect();
      if (!bounds?.width || !bounds.height) return;
      lightCamera.aspect = bounds.width / bounds.height;
      lightCamera.updateProjectionMatrix();
      lightCamera.position.set(-tx * 2.2, ty * 1.5, 9);
      lightCamera.lookAt(0, 0, 0);
      cursorLightPosition(px, py, lightCamera, lightPosition);
      gl.uniform3f(U.uLightPosition, lightPosition.x, lightPosition.y, lightPosition.z);
      gl.uniform1f(U.uLightRadius, CURSOR_LIGHT.radius);
      // Each glyph fragment is placed on the whole card, not on a tiny
      // word-local lighting plane. Canvas overhang is included in this rect.
      const unit = CARD_H / bounds.height;
      gl.uniform4f(U.uWordRect,
        (word.left - bounds.left - bounds.width / 2) * unit,
        (bounds.height / 2 - (word.top - bounds.top) - word.height) * unit,
        word.width * unit, word.height * unit);
      gl.uniform2f(U.uTilt, tx, ty);
      gl.uniform1f(U.uGrain, 0.55);
      gl.uniform1f(U.uRelief, 1.4);
      gl.uniform1f(U.uLamp, 1.0);
      gl.uniform1f(U.uDark, card?.dataset.theme === "dark" ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const loop = () => { render(); raf = requestAnimationFrame(loop); };
    let onScreen = true;
    const start = () => { cancelAnimationFrame(raf); if (activeRef.current && onScreen && !lost) raf = requestAnimationFrame(loop); else dirty = true; };
    startRef.current = start;

    const init = async () => {
      try { await document.fonts.ready; } catch { /* use whatever is loaded */ }
      if (disposed) return;
      try { setup(); buildMask(); render(); setReady(true); start(); }
      catch { setReady(false); }
    };
    init();

    const ro = new ResizeObserver(() => { if (prog && !lost) { buildMask(); render(); } });
    ro.observe(host);
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; start(); });
    io.observe(host);
    const onLost = (e: Event) => { e.preventDefault(); lost = true; cancelAnimationFrame(raf); setReady(false); };
    const onRestored = () => { lost = false; try { setup(); buildMask(); setReady(true); start(); } catch { setReady(false); } };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); startRef.current = null;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      if (!gl.isContextLost()) { gl.deleteTexture(tex); gl.deleteBuffer(buf); gl.deleteProgram(prog); }
    };
  }, [enabled, text, reduced, tiltRef]);

  const activeRef = useRef(active);
  const startRef = useRef<(() => void) | null>(null);
  useEffect(() => { activeRef.current = active; startRef.current?.(); }, [active]);

  return (
    <span ref={hostRef} className="fs-gift-foil" role="img" aria-label={text} data-foil={ready ? "gl" : "css"} data-testid="text-back-gift">
      <span aria-hidden="true" className="fs-gift-foil-text">{text}</span>
      {enabled && <canvas ref={canvasRef} className="fs-gift-foil-canvas" aria-hidden="true" data-testid="canvas-gift-foil" />}
    </span>
  );
}
