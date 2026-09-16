import { useEffect, useRef, useState } from "react";

/**
 * Signing with a finger, on the doorstep.
 *
 * THE DETAIL THAT DECIDES WHETHER THIS WORKS: `touch-action: none` on the
 * canvas. Without it the browser treats the first drag as a scroll, the page
 * moves under the finger and the signature comes out as a single stray dot.
 * Every hand-rolled signature pad that feels broken on a phone is broken for
 * this reason.
 *
 * Pointer events rather than touch + mouse handlers, so a finger, a stylus and
 * a trackpad all arrive through one path with pressure available where the
 * device reports it.
 *
 * The canvas is backed at device pixel ratio and drawn at CSS pixels, because a
 * 1x canvas on a phone gives a signature with visibly stepped edges — and this
 * ends up printed on a legal record.
 */
export default function SignaturePad({ label, hint, existing, onSave, onClear, disabled, busy }: {
  label: string;
  hint?: string;
  /** True when one is already stored, so the pad shows the state rather than a blank box. */
  existing?: boolean;
  onSave: (dataUrl: string) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [signing, setSigning] = useState(!existing);

  /** Size the bitmap to the box, at the screen's real pixel density. */
  useEffect(() => {
    if (!signing) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const fit = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const w = wrap.clientWidth;
      const h = 170;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0F172A";
    };

    fit();
    // Rotating the phone resizes the box. The stroke so far is lost, which is
    // why the pad is cleared and said to be cleared rather than silently
    // keeping a signature that no longer matches what is on screen.
    const ro = new ResizeObserver(() => { fit(); dirty.current = false; setHasInk(false); });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [signing]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // A dot, so a full stop or the tittle of an "i" registers rather than
    // needing a drag before anything appears.
    ctx.lineTo(p.x + 0.01, p.y);
    ctx.stroke();
    dirty.current = true;
    setHasInk(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function up() { drawing.current = false; }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    setHasInk(false);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) return;
    await onSave(canvas.toDataURL("image/png"));
    setSigning(false);
  }

  if (!signing) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="text-[14px] font-semibold text-green-800">{label} — signed</p>
        {!disabled && (
          <button type="button"
            onClick={async () => { await onClear?.(); clear(); setSigning(true); }}
            className="mt-1 text-[13px] font-semibold text-green-800 underline">
            Sign again
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-[13px] font-semibold text-slate-700">{label}</p>
      {hint && <p className="mt-0.5 mb-2 text-[12.5px] text-slate-500">{hint}</p>}
      <div ref={wrapRef} className="relative rounded-xl border border-slate-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
          // Without this the first drag scrolls the page instead of drawing.
          style={{ touchAction: "none", display: "block", cursor: disabled ? "not-allowed" : "crosshair" }}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-[14px] text-slate-400">
            Sign here
          </span>
        )}
        <span className="pointer-events-none absolute bottom-3 left-4 right-4 border-b border-dashed border-slate-300" />
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={save} disabled={!hasInk || disabled || busy}
          className="inline-flex h-10 items-center rounded-xl bg-[var(--brand)] px-4 text-[14px] font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save signature"}
        </button>
        <button type="button" onClick={clear} disabled={!hasInk || disabled}
          className="inline-flex h-10 items-center rounded-xl border border-slate-300 px-4 text-[14px] font-semibold text-slate-600 disabled:opacity-50">
          Clear
        </button>
      </div>
    </div>
  );
}
