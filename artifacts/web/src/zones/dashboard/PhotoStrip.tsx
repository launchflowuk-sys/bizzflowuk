import { useEffect, useRef, useState } from "react";
import { api } from "./tradeApi";
import { getStoredToken } from "@/lib/auth";

/**
 * Photographs on a certificate, taken on the phone that is filling it in.
 *
 * THE RESIZE IS THE WHOLE POINT. A modern phone camera produces a four
 * megabyte JPEG and the useful version of it is nearer two hundred kilobytes.
 * That is not about our disk — the engineer is standing in a plant room on one
 * bar of signal, and an upload that never finishes is the thing that makes
 * somebody stop using the app and go back to the paper pad. So the file is
 * drawn into a canvas, capped at 1600px on the long edge and re-encoded as
 * JPEG before a single byte leaves the phone.
 *
 * `capture="environment"` on the input means the camera opens directly on a
 * phone rather than the photo library, while a laptop still gets a file
 * picker. One control, right behaviour on both.
 *
 * The thumbnails are fetched with the auth token and held as blob URLs,
 * because the bytes sit behind an authenticated route — an <img src> straight
 * at the API would arrive with no Authorization header and 401.
 */

type Photo = {
  id: number;
  applianceKey: string | null;
  caption: string | null;
  contentType: string;
  byteSize: number | null;
};

const MAX_EDGE = 1600;
const QUALITY = 0.82;

/** Draw it smaller, and hand back a data URL. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That file is not a photo we can read.");

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that photo.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  // JPEG regardless of what came in: a 12-megapixel PNG off a screenshot is
  // enormous and nothing here needs transparency.
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export default function PhotoStrip({ certificateId, applianceKey, photos, onChanged, disabled, label }: {
  certificateId: number;
  /** Null for a photo of the job rather than of one appliance. */
  applianceKey: string | null;
  photos: Photo[];
  onChanged: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mine = photos.filter(p => (p.applianceKey ?? null) === applianceKey);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError("");
    try {
      // One at a time on purpose. Parallel uploads on a weak connection make
      // every one of them slower and all of them likelier to fail.
      for (const file of Array.from(files)) {
        const dataUrl = await shrink(file);
        await api.post(`/certificates/${certificateId}/photos`, { dataUrl, applianceKey });
      }
      onChanged();
    } catch (e: any) {
      setError(e?.message || "That photo would not upload.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: number) {
    if (!confirm("Remove this photo?")) return;
    try { await api.del(`/certificates/${certificateId}/photos/${id}`); onChanged(); }
    catch (e: any) { setError(e?.message || "Could not remove that."); }
  }

  return (
    <div>
      {label && <p className="text-[13px] font-semibold text-slate-700 mb-2">{label}</p>}

      <div className="flex flex-wrap gap-2.5">
        {mine.map(p => (
          <Thumb key={p.id} certificateId={certificateId} photo={p}
            onRemove={disabled ? undefined : () => remove(p.id)} />
        ))}

        {!disabled && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="grid h-[92px] w-[92px] place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50">
            <span className="text-center text-[12px] font-semibold leading-tight">
              {busy ? "Adding…" : <>+<br />Photo</>}
            </span>
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        // Opens the camera on a phone, a file picker on a laptop.
        capture="environment"
        multiple
        hidden
        onChange={e => void add(e.target.files)}
      />

      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

/**
 * One thumbnail.
 *
 * Fetched rather than linked: the bytes are behind requireTenantAccess, so a
 * plain <img src> would arrive without the token and 401. The blob URL is
 * revoked on unmount — a long certificate with twenty photos otherwise leaks
 * twenty objects for as long as the tab is open.
 */
function Thumb({ certificateId, photo, onRemove }: {
  certificateId: number; photo: Photo; onRemove?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    (async () => {
      const token = getStoredToken();
      const res = await fetch(`/api/certificates/${certificateId}/photos/${photo.id}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok || !alive) return;
      url = URL.createObjectURL(await res.blob());
      if (alive) setSrc(url); else URL.revokeObjectURL(url);
    })().catch(() => { /* a thumbnail that will not load is not worth an error */ });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [certificateId, photo.id]);

  return (
    <div className="relative h-[92px] w-[92px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      {src
        ? <img src={src} alt={photo.caption ?? "Job photo"} className="h-full w-full object-cover" />
        : <span className="grid h-full w-full place-items-center text-[11px] text-slate-400">…</span>}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove photo"
          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-[14px] leading-none text-white">
          ×
        </button>
      )}
    </div>
  );
}
