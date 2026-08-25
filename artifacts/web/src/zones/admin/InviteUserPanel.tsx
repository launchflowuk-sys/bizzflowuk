import { useState } from "react";
import { getStoredToken } from "@/lib/auth";

/**
 * Create a login and hand back a single-use invite link.
 *
 * Deliberately a copyable link rather than an emailed one: platform-level email isn't configured
 * (SMTP is per-tenant), and clients are routinely onboarded in person or over WhatsApp. A link the
 * admin can copy works in every case and has no delivery failure mode.
 *
 * The password is set by the person it belongs to. Before this existed, creating a login meant
 * putting a plaintext password in a Coolify environment variable and redeploying — so onboarding
 * needed infrastructure access and the operator handled the client's password.
 */
export function InviteUserPanel({ tenants, onCreated }: { tenants: any[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: "TENANT_ADMIN", tenantId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const f = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });
  const inputCls =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getStoredToken() },
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          tenantId: form.role === "SUPER_ADMIN" ? null : Number(form.tenantId),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create this login");
        return;
      }
      setInvite({
        url: window.location.origin + "/accept-invite?token=" + data.invite.token,
        expiresAt: data.invite.expiresAt,
      });
      setForm({ email: "", firstName: "", lastName: "", role: "TENANT_ADMIN", tenantId: "" });
      onCreated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!invite) return;
    navigator.clipboard?.writeText(invite.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-400"
      >
        + Invite user
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Invite a user</h2>
        <button
          onClick={() => { setOpen(false); setInvite(null); setError(""); }}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Close
        </button>
      </div>

      {invite ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Account created. Send this link to them — it works once, and expires on{" "}
            {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={invite.url}
              onFocus={(e) => e.currentTarget.select()}
              className={inputCls + " font-mono text-xs"}
            />
            <button
              onClick={copy}
              className="flex-shrink-0 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            This is the only time the link is shown — it can&apos;t be recovered later. If it&apos;s lost, issue a new
            one from the user&apos;s row.
          </p>
          <button onClick={() => setInvite(null)} className="text-sm font-semibold text-orange-600 hover:underline">
            Invite someone else
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">First name</label>
              <input className={inputCls} value={form.firstName} onChange={f("firstName")} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Last name</label>
              <input className={inputCls} value={form.lastName} onChange={f("lastName")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Email *</label>
            <input
              type="email"
              required
              className={inputCls}
              value={form.email}
              onChange={f("email")}
              placeholder="them@theircompany.co.uk"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Role</label>
              <select className={inputCls} value={form.role} onChange={f("role")}>
                <option value="TENANT_ADMIN">Business admin — full dashboard</option>
                <option value="STAFF">Staff — dashboard access</option>
                <option value="CUSTOMER">Customer — portal only</option>
                <option value="SUPER_ADMIN">Platform admin — every business</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                Business {form.role === "SUPER_ADMIN" ? "" : "*"}
              </label>
              <select
                className={inputCls}
                value={form.tenantId}
                onChange={f("tenantId")}
                disabled={form.role === "SUPER_ADMIN"}
                required={form.role !== "SUPER_ADMIN"}
              >
                <option value="">Choose a business…</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.role === "SUPER_ADMIN" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              A platform admin can see and edit every business on BizzFlow, including other clients. Only use this for
              your own team.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create login and get invite link"}
          </button>
        </form>
      )}
    </div>
  );
}
