import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export const addressSelect = { id: true, label: true, recipientName: true, phone: true, address: true, city: true, postalCode: true, isDefault: true } satisfies Prisma.CustomerAddressSelect;
/** Lock the owning customer so concurrent creates/edits/deletes preserve one default address. */
export async function addressTransaction<T>(customerId: string, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM Customer WHERE id = ${customerId} FOR UPDATE`;
      return work(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (e) { if (attempt < 2 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") continue; throw e; }
  }
}
export async function ensureDefaultAddress(tx: Prisma.TransactionClient, customerId: string, avoidId?: string) {
  const rows = await tx.customerAddress.findMany({ where: { customerId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }], select: { id: true, isDefault: true } });
  if (!rows.length) return;
  const chosen = rows.find(r => r.isDefault) || rows.find(r => r.id !== avoidId) || rows[0];
  await tx.customerAddress.updateMany({ where: { customerId, isDefault: true, NOT: { id: chosen.id } }, data: { isDefault: false } });
  await tx.customerAddress.update({ where: { id: chosen.id, customerId }, data: { isDefault: true } });
}