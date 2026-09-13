import { prisma } from "@/lib/prisma";
import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { addressSchema } from "@/lib/customer-address-schema";
import { addressSelect, addressTransaction, ensureDefaultAddress } from "@/lib/customer-address-service";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => { const c = await customerActor(); return { addresses: await prisma.customerAddress.findMany({ where: { customerId: c.id }, select: addressSelect, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }) }; }); }
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const c = await customerActor(); const input = addressSchema.parse(await request.json());
  return addressTransaction(c.id, async tx => {
    if (input.isDefault) await tx.customerAddress.updateMany({ where: { customerId: c.id, isDefault: true }, data: { isDefault: false } });
    const row = await tx.customerAddress.create({ data: { ...input, customerId: c.id }, select: addressSelect });
    await ensureDefaultAddress(tx, c.id);
    return { address: await tx.customerAddress.findUnique({ where: { id: row.id }, select: addressSelect }) };
  });
}); }