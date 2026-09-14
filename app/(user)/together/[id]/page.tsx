"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useCart, type CartLine } from "@/context/CartContext";
type Member = { id: string; customer: { name: string } };
type Comment = { id: string; memberId: string; text: string; createdAt: string; member: { customer: { name: string } } };
type Item = { id: string; productId: string; quantity: number; variant: string; product: { name: string; image: string; price: string; stock: number; variants: string[]; isActive: boolean; vendorPublication: { status: string; stock: number; vendor: { shopName: string; storeSlug: string | null; status: string } } | null }; comments: Comment[] };
type Room = { name: string; archived: boolean; members: Member[]; items: Item[] };
const button = "rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50";
export default function RoomPage({ params }: { params: { id: string } }) {
  const { isCustomer, openAuthModal } = useCustomerAuth();
  const { addItem, items: cartItems } = useCart();
  const [room, setRoom] = useState<Room | null>(null);
  const [memberId, setMemberId] = useState("");
  const [owner, setOwner] = useState(false);
  const [message, setMessage] = useState("Loading...");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/together/${params.id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setRoom(data.room); setMemberId(data.memberId); setOwner(data.owner);
  }, [params.id]);
  useEffect(() => { if (isCustomer) void load().then(() => setMessage("")).catch(e => setMessage(e.message)); }, [isCustomer, load]);
  async function action(body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/together/${params.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.invitePath) {
        const url = `${window.location.origin}${data.invitePath}`; setInvite(url);
        try { await navigator.clipboard.writeText(url); setMessage("Invite link copied. Expires in 7 days."); }
        catch { setMessage("Copy the invitation link below. Expires in 7 days."); }
      } else if (data.lines) {
        (data.lines as CartLine[]).forEach(line => addItem(line)); setMessage("Added to your cart");
      } else { await load(); setMessage(data.alreadyShared ? "This product and variant are already shared." : "Saved."); }
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update room."); return false; }
    finally { setBusy(false); }
  }
  if (!isCustomer) return <main className="p-6"><button onClick={() => openAuthModal("login")} className={`${button} bg-brand-primary`}>Sign in to open this private room</button></main>;
  return <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-8">
    <p className="text-sm font-semibold text-brand-primary">Family Cart / Shop Together</p>
    <h1 className="mt-2 break-words text-3xl font-bold">{room?.name || "Family Cart"}</h1>
    <p role="status" className="my-3 break-words">{message}</p>
    {room && <>
      <p className="text-sm text-gray-600">{room.members.length} members · {room.archived ? "Archived room" : "Each member shops and checks out independently."}</p>
      <div className="my-4 flex flex-wrap gap-2">
        {owner && !room.archived && <button disabled={busy} onClick={() => void action({ action: "invite" })} className={`${button} bg-brand-primary`}>Copy Invite Link</button>}
        <Link href="/products" className={button}>Browse products</Link><Link href="/cart" className={button}>My cart</Link>
      </div>
      {invite && <label className="mb-5 block text-sm">Invite link (expires in 7 days)<input aria-label="Invitation link" readOnly value={invite} onFocus={e => e.currentTarget.select()} className="mt-1 w-full min-w-0 rounded-xl border p-2" /></label>}
      {!room.archived && <form className="joro-form mb-6 grid min-w-0 gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={async e => {
        e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
        const raw = String(f.get("product")).trim(); const productId = raw.split("/products/").pop()?.split(/[?#]/)[0] || raw;
        if (await action({ action: "add", productId, quantity: Number(f.get("quantity")), variant: String(f.get("variant")).trim() })) form.reset();
      }}>
        <label className="min-w-0">Product link or ID<input name="product" required className="w-full min-w-0" /></label>
        <label className="min-w-0">Variant (if applicable)<input name="variant" maxLength={200} className="w-full min-w-0" /></label>
        <label className="min-w-0">Quantity<input name="quantity" type="number" min={1} max={1000} defaultValue={1} required className="w-full min-w-0" /></label>
        <button disabled={busy} className={`${button} self-end bg-brand-primary`}>Add product</button>
      </form>}
      <div className="grid min-w-0 gap-5 md:grid-cols-2">{room.items.map(item => {
        const p = item.product; const vp = p.vendorPublication;
        const validVariant = Array.isArray(p.variants) && (p.variants.length ? p.variants.includes(item.variant) : !item.variant);
        const available = p.isActive && validVariant && p.stock >= item.quantity && (!vp || vp.status === "active" && vp.stock >= item.quantity && vp.vendor.status === "approved");
        return <article key={item.id} className="min-w-0 rounded-2xl border bg-white p-4">
          {p.image ? <img src={p.image} alt={p.name} className="mb-4 h-48 w-full rounded-xl object-contain" /> : <div className="mb-4 flex h-32 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-500">No product image</div>}
          <h2 className="break-words text-xl font-bold">{p.name}</h2>
          <p className="my-2 font-semibold">PKR {Number(p.price).toLocaleString("en-PK")}</p>
          <p className="break-words text-sm">{vp?.vendor.shopName || "JORO"}{item.variant && ` · ${item.variant}`} · Quantity {item.quantity}</p>
          <p className={`mt-2 text-sm ${available ? "text-green-700" : "text-red-700"}`}>{available ? "Available" : "Currently unavailable"}</p>
          <div className="my-4 flex flex-wrap gap-2">
            <Link href={`/products/${item.productId}`} className={button}>View Product</Link>
            {vp?.vendor.storeSlug && <Link href={`/stores/${vp.vendor.storeSlug}`} className={button}>View Store</Link>}
            <button disabled={busy || !available || room.archived} className={`${button} bg-brand-primary`} onClick={() => {
              const existing = cartItems.find(line => line.productId === item.productId && (line.variant || "") === item.variant);
              void action({ action: "cart", itemIds: [item.id], quantity: (existing?.quantity || 0) + item.quantity });
            }}>Add to My Cart</button>
            {owner && !room.archived && <button disabled={busy} className={button} onClick={() => void action({ action: "remove", itemId: item.id })}>Remove product</button>}
          </div>
          <h3 className="mb-2 font-semibold">Comments</h3>
          {!item.comments.length && <p className="mb-3 text-sm text-gray-500">No comments yet. Start the conversation.</p>}
          <ol className="max-h-96 space-y-3 overflow-y-auto">{item.comments.map(comment => <li key={comment.id} className="min-w-0 rounded-xl bg-gray-50 p-3 text-sm">
            <strong className="break-words">{comment.member.customer.name}</strong><time dateTime={comment.createdAt} className="mt-1 block text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString("en-PK")}</time>
            {editing === comment.id ? <form className="joro-form mt-2" onSubmit={async e => { e.preventDefault(); if (await action({ action: "editComment", itemId: item.id, commentId: comment.id, text: new FormData(e.currentTarget).get("text") })) setEditing(null); }}>
              <textarea aria-label="Edit comment" name="text" defaultValue={comment.text} maxLength={2000} required className="w-full min-w-0" />
              <div className="mt-2 flex gap-2"><button disabled={busy} className={button}>Save comment</button><button type="button" onClick={() => setEditing(null)} className={button}>Cancel</button></div>
            </form> : <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{comment.text}</p>}
            {comment.memberId === memberId && !room.archived && editing !== comment.id && <div className="mt-2 flex gap-4"><button disabled={busy} onClick={() => setEditing(comment.id)} className="underline">Edit</button><button disabled={busy} onClick={() => void action({ action: "deleteComment", itemId: item.id, commentId: comment.id })} className="underline">Delete</button></div>}
          </li>)}</ol>
          {!room.archived && <form className="joro-form mt-4" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; if (await action({ action: "comment", itemId: item.id, text: new FormData(form).get("text") })) form.reset(); }}>
            <label className="block">Add a comment<textarea name="text" maxLength={2000} required rows={2} className="w-full min-w-0" /></label>
            <button disabled={busy} className={`${button} mt-2 bg-brand-soft`}>Post comment</button>
          </form>}
        </article>;
      })}</div>
      {!room.items.length && <p className="rounded-xl bg-brand-soft p-5">No shared products yet. Add a product link to get started.</p>}
      <section className="mt-6 rounded-2xl border p-4"><h2 className="font-semibold">Members</h2><ul className="mt-2 flex flex-wrap gap-3">{room.members.map(member => <li key={member.id} className="max-w-full break-words rounded-lg bg-brand-soft px-3 py-2 text-sm">{member.customer.name}</li>)}</ul></section>
    </>}
  </main>;
}
