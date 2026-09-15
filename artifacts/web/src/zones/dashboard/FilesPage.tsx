import { useMemo, useRef, useState } from "react";
import { api, useApi, shortDate } from "./tradeApi";
import { getStoredToken } from "@/lib/auth";

/**
 * Files — the paperwork, on every phone.
 *
 * Public liability certificate, Gas Safe card, COSHH sheets, risk assessments,
 * blank forms. The point is the moment you need them: on site, in front of a
 * customer or an inspector, on a phone with one bar. So the list is flat and
 * searchable, the important ones pin to the top, and anything that has expired
 * says so before you hand it over.
 *
 * Upload goes through the storage flow the dashboard already uses: ask for a
 * target, PUT the bytes, then register the object. The file is never posted
 * through the API server itself.
 */

type FileRow = {
  id: number; name: string; category: string; objectPath: string;
  contentType: string | null; sizeBytes: number | null; notes: string | null;
  expiresAt: string | null; pinned: boolean; createdAt: string;
  url: string; expired: boolean; expiringSoon: boolean;
};

type Category = { key: string; label: string };

const ICONS: Record<string, string> = {
  insurance: "🛡", gas_safe: "🔥", coshh: "⚗", risk_assessment: "⚠",
  method_statement: "📋", template: "📄", other: "📎",
};

function prettySize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const { data: files, loading, error, reload } = useApi<FileRow[]>("/files");
  const { data: categories } = useApi<Category[]>("/files/categories");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (files ?? []).filter(f =>
      (!filter || f.category === filter) &&
      (!needle || `${f.name} ${f.notes ?? ""} ${f.category}`.toLowerCase().includes(needle)));
  }, [files, query, filter]);

  const expiringCount = (files ?? []).filter(f => f.expired || f.expiringSoon).length;

  async function handleUpload(file: File) {
    setBusy(true);
    setUploadError(null);
    try {
      // 1. Ask for a one-time target. The server only ever issues paths inside
      //    this tenant's own prefix.
      const target = await api.post<{ uploadURL: string; objectPath: string }>(
        "/dashboard/uploads/request-url",
        { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" },
      );

      // 2. Send the bytes straight to that target, not through the API.
      const put = await fetch(target.uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      // Never register a file whose bytes did not land — that is how you end up
      // with an index full of entries that 404 when somebody needs them.
      if (!put.ok) throw new Error("The file did not upload. Please try again.");

      // 3. Record it.
      await api.post("/files", {
        name: file.name,
        category: filter || "other",
        objectPath: target.objectPath,
        contentType: file.type || null,
        sizeBytes: file.size,
      });
      reload();
    } catch (err: any) {
      setUploadError(err?.message || "Could not upload that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function update(id: number, patch: Record<string, unknown>) {
    try { await api.patch(`/files/${id}`, patch); reload(); }
    catch (err: any) { setUploadError(err?.message || "Could not save that change."); }
  }

  async function remove(id: number, name: string) {
    if (!window.confirm(`Remove "${name}" from your files?\n\nThe document itself is kept — this only takes it off the list.`)) return;
    try { await api.del(`/files/${id}`); reload(); }
    catch (err: any) { setUploadError(err?.message || "Could not remove that file."); }
  }

  return (
    <div className="px-5 sm:px-10 pb-16 max-w-[1320px]">
      <div className="ws-heading">
        <div>
          <p className="ws-eyebrow">Your business / Workspace</p>
          <h1>Everything, in your pocket.</h1>
          <p className="ws-sub">
            Insurance, Gas Safe, COSHH sheets and the forms you actually need on site.
          </p>
        </div>
        <button type="button" className="ws-btn" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Uploading…" : <>Add a file <span aria-hidden="true">+</span></>}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
      />

      {uploadError && (
        <div role="alert" className="ws-panel mb-4" style={{ borderColor: "#e5b4ad", background: "#fbe9e7", color: "#8c2f22" }}>
          {uploadError}
        </div>
      )}

      {expiringCount > 0 && (
        <div className="ws-panel mb-4" style={{ borderColor: "#e5cf9b", background: "#faf0d8" }}>
          <p style={{ color: "#896723", fontWeight: 600 }}>
            {expiringCount} {expiringCount === 1 ? "document needs" : "documents need"} renewing.
          </p>
          <p style={{ color: "#896723", marginTop: "4px", fontSize: "14px" }}>
            An expired certificate is the one a customer asks to see.
          </p>
        </div>
      )}

      <section className="ws-panel">
        <div className="ws-panel-top" style={{ flexWrap: "wrap" }}>
          <h2>Your files</h2>
          <input
            className="ws-field"
            style={{ maxWidth: "280px" }}
            type="search"
            placeholder="Search your files…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
          <button type="button" className="ws-pill" data-tone={filter === "" ? "active" : "done"}
            onClick={() => setFilter("")} style={{ border: 0, cursor: "pointer" }}>
            All
          </button>
          {(categories ?? []).map(c => (
            <button key={c.key} type="button" className="ws-pill" data-tone={filter === c.key ? "active" : "done"}
              onClick={() => setFilter(c.key)} style={{ border: 0, cursor: "pointer" }}>
              {c.label}
            </button>
          ))}
        </div>

        {loading && <p style={{ color: "var(--ws-muted)" }}>Loading…</p>}
        {error && <p style={{ color: "#8c2f22" }}>{error}</p>}

        {!loading && !rows.length && (
          <p style={{ color: "var(--ws-muted)" }}>
            {files?.length
              ? "Nothing matches that search."
              : "No files yet. Add your public liability certificate first — it is the one you get asked for most."}
          </p>
        )}

        {!!rows.length && (
          <div className="ws-table-scroll">
            <table className="ws-table">
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Category</th>
                  <th scope="col">Expires</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {rows.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <span aria-hidden="true" style={{ fontSize: "18px" }}>{ICONS[f.category] ?? "📎"}</span>
                        <span style={{ minWidth: 0 }}>
                          <strong>{f.pinned ? "★ " : ""}{f.name}</strong>
                          <small>{prettySize(f.sizeBytes)}{f.notes ? ` · ${f.notes}` : ""}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <select
                        className="ws-field"
                        style={{ padding: "7px 10px", fontSize: "13px", maxWidth: "190px" }}
                        value={f.category}
                        onChange={e => update(f.id, { category: e.target.value })}
                      >
                        {(categories ?? []).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        className="ws-field"
                        style={{ padding: "7px 10px", fontSize: "13px", maxWidth: "165px" }}
                        type="date"
                        value={f.expiresAt ? String(f.expiresAt).slice(0, 10) : ""}
                        onChange={e => update(f.id, { expiresAt: e.target.value || null })}
                      />
                      {f.expired && <span className="ws-pill" data-tone="danger" style={{ marginTop: "6px" }}>Expired</span>}
                      {f.expiringSoon && <span className="ws-pill" data-tone="pending" style={{ marginTop: "6px" }}>Due {shortDate(f.expiresAt)}</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="ws-panel-link" style={{ marginRight: "14px" }}>
                        Open ↗
                      </a>
                      <button type="button" className="ws-panel-link" onClick={() => update(f.id, { pinned: !f.pinned })} style={{ marginRight: "14px" }}>
                        {f.pinned ? "Unpin" : "Pin"}
                      </button>
                      <button type="button" className="ws-panel-link" style={{ color: "#8c2f22" }} onClick={() => remove(f.id, f.name)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
