"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { UserPlus } from "lucide-react";

type AdminRow = { id: string; email: string; name: string; role: string; permissions: string[]; isActive: boolean; lastLoginAt: string | null; createdAt: string };
type AuditRow = { id: string; actor: string; actorEmail: string | null; action: string; entityType: string | null; entityId: string | null; createdAt: string };
type Roles = Record<string, readonly string[]>;

export default function AdminTeamPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]); const [audit, setAudit] = useState<AuditRow[]>([]);
  const [roles, setRoles] = useState<Roles>({}); const [tab, setTab] = useState<"team" | "audit">("team");
  const [loading, setLoading] = useState(true); const [forbidden, setForbidden] = useState(false); const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const teamResponse = await fetch("/api/admin/team");
      if (teamResponse.status === 403) { setForbidden(true); return; }
      if (!teamResponse.ok) throw new Error("Could not load admin team");
      const teamData = await teamResponse.json(); setAdmins(teamData.admins ?? []); setRoles(teamData.roles ?? {});
      const auditResponse = await fetch("/api/admin/audit");
      if (auditResponse.ok) { const auditData = await auditResponse.json(); setAudit(auditData.audit ?? []); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load team"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: String(form.get("name")), email: String(form.get("email")), password: String(form.get("password")), role: String(form.get("role")) }) });
    const data = await response.json(); if (!response.ok) return toast.error(data.error || "Could not create admin");
    toast.success("Staff account created"); event.currentTarget.reset(); setCreating(false); await load();
  }

  async function updateAdmin(id: string, change: { role?: string; isActive?: boolean }) {
    const response = await fetch(`/api/admin/team/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
    const data = await response.json(); if (!response.ok) return toast.error(data.error || "Could not update account"); toast.success("Staff access updated"); await load();
  }

  if (loading) return <main className="p-8 text-center text-darkText/50">Loading admin access…</main>;
  if (forbidden) return <main className="p-8"><section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="font-black text-amber-900">Super-admin access required</h1><p className="mt-1 text-sm text-amber-800">Staff roles and audit history are protected by server-side permissions.</p></section></main>;

  return <main className="p-6 md:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-black uppercase tracking-wider text-brand-link">Security</p><h1 className="text-2xl font-black text-darkText">Admin team & audit</h1><p className="mt-2 text-sm text-darkText/60">Assign least-privilege roles. Sensitive APIs enforce these permissions on the server.</p></div>{tab === "team" ? <button onClick={() => setCreating((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-black text-brand-dark"><UserPlus className="h-4 w-4" />Add staff</button> : null}</div><div className="mt-6 flex gap-2 border-b border-borderGray pb-3"><button onClick={() => setTab("team")} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "team" ? "bg-brand-primary text-brand-dark" : "bg-white"}`}>Team</button><button onClick={() => setTab("audit")} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "audit" ? "bg-brand-primary text-brand-dark" : "bg-white"}`}>Audit history</button></div>
    {creating && tab === "team" ? <form onSubmit={createAdmin} className="mt-5 grid gap-4 rounded-2xl border border-borderGray bg-white p-5 shadow-card md:grid-cols-2"><label className="text-sm font-bold">Name<input name="name" minLength={2} required className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal" /></label><label className="text-sm font-bold">Email<input name="email" type="email" required className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal" /></label><label className="text-sm font-bold">Temporary password (12+ characters)<input name="password" type="password" minLength={12} required autoComplete="new-password" className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal" /></label><label className="text-sm font-bold">Role<select name="role" required className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal">{Object.keys(roles).filter((role) => role !== "super_admin").map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label><button className="rounded-xl bg-brand-primary px-4 py-3 font-black text-brand-dark md:col-span-2">Create staff account</button></form> : null}
    {tab === "team" ? <section className="mt-5 grid gap-4 xl:grid-cols-2">{admins.map((row) => <article key={row.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-brand-dark">{row.name}</h2><p className="mt-1 text-sm text-darkText/55">{row.email}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{row.isActive ? "Active" : "Disabled"}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-xs font-bold text-darkText/55">Role<select value={row.role} onChange={(event) => void updateAdmin(row.id, { role: event.target.value })} className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2 text-sm font-semibold capitalize">{Object.keys(roles).map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label><button onClick={() => void updateAdmin(row.id, { isActive: !row.isActive })} className="self-end rounded-xl border border-borderGray px-4 py-2 text-sm font-bold text-darkText/70">{row.isActive ? "Disable" : "Enable"}</button></div><p className="mt-3 text-xs leading-5 text-darkText/45">{roles[row.role]?.join(" · ") || "Custom permissions"}</p><p className="mt-2 text-xs text-darkText/40">Last login: {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString("en-PK") : "Never"}</p></article>)}</section> : <section className="mt-5 overflow-x-auto rounded-2xl border border-borderGray bg-white shadow-card"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-borderGray bg-lightGray"><tr><th className="p-3">When</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Record</th></tr></thead><tbody>{audit.map((row) => <tr key={row.id} className="border-b border-borderGray/70"><td className="p-3 text-darkText/55">{new Date(row.createdAt).toLocaleString("en-PK")}</td><td className="p-3"><p className="font-bold">{row.actor}</p><p className="text-xs text-darkText/45">{row.actorEmail}</p></td><td className="p-3 font-semibold">{row.action.replaceAll("_", " ")}</td><td className="p-3 text-darkText/55">{row.entityType || "—"}{row.entityId ? ` · ${row.entityId}` : ""}</td></tr>)}</tbody></table>{audit.length === 0 ? <p className="p-8 text-center text-darkText/50">No admin audit events yet.</p> : null}</section>}
  </main>;
}
